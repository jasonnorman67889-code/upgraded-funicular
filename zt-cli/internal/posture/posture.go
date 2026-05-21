package posture

import (
	"context"
	"crypto"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/zalando/go-keyring"
)

const (
	serviceName          = "zt-cli"
	signingKeyUser       = "posture-signing-ed25519"
	defaultSchemaVersion = "v1"
	algorithmEd25519     = "Ed25519"
	algorithmRS256TPM    = "RS256-TPM"
)

var ErrTPMUnavailable = errors.New("tpm signer unavailable")

// SecretStore is the minimal key-value contract used for signing key persistence.
type SecretStore interface {
	Set(service, user, secret string) error
	Get(service, user string) (string, error)
}

type keyringStore struct{}

func (keyringStore) Set(service, user, secret string) error {
	return keyring.Set(service, user, secret)
}

func (keyringStore) Get(service, user string) (string, error) {
	return keyring.Get(service, user)
}

// Manager gathers local device posture and signs it with a persisted key.
type Manager struct {
	store     SecretStore
	tpmSigner hardwareSigner
}

type hardwareSigner interface {
	Sign(payload []byte) (algorithm string, keyID string, publicMaterial string, signature string, err error)
}

// DevicePosture contains local posture signals for Zero Trust policy evaluation.
type DevicePosture struct {
	SchemaVersion       string    `json:"schemaVersion"`
	CollectedAt         time.Time `json:"collectedAt"`
	Hostname            string    `json:"hostname"`
	OS                  string    `json:"os"`
	Architecture        string    `json:"architecture"`
	GoVersion           string    `json:"goVersion"`
	SecurityAgentActive bool      `json:"securityAgentActive"`
	DeviceCertPresent   bool      `json:"deviceCertPresent"`
}

// SignedAssertion is a posture payload plus signature metadata.
type SignedAssertion struct {
	Algorithm   string        `json:"algorithm"`
	KeyID       string        `json:"keyId"`
	PublicKey   string        `json:"publicKey"`
	Payload     DevicePosture `json:"payload"`
	PayloadHash string        `json:"payloadHash"`
	Signature   string        `json:"signature"`
}

// NewManager creates a posture manager backed by OS keychain.
func NewManager() *Manager {
	return &Manager{
		store:     keyringStore{},
		tpmSigner: newSystemTPMSigner(),
	}
}

// NewManagerWithStore creates a posture manager with a custom secret store for tests.
func NewManagerWithStore(store SecretStore) *Manager {
	return &Manager{
		store:     store,
		tpmSigner: newSystemTPMSigner(),
	}
}

// NewManagerWithDeps creates a posture manager with explicit dependencies for tests.
func NewManagerWithDeps(store SecretStore, tpmSigner hardwareSigner) *Manager {
	return &Manager{
		store:     store,
		tpmSigner: tpmSigner,
	}
}

// AssessAndSign collects posture telemetry and signs it with TPM if available, otherwise Ed25519.
func (m *Manager) AssessAndSign(_ context.Context) (*SignedAssertion, error) {
	payload, err := collectPosture()
	if err != nil {
		return nil, err
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal posture payload: %w", err)
	}

	hash := sha256.Sum256(payloadBytes)

	if m.tpmSigner != nil {
		algorithm, keyID, publicMaterial, signature, signErr := m.tpmSigner.Sign(payloadBytes)
		if signErr == nil {
			return &SignedAssertion{
				Algorithm:   algorithm,
				KeyID:       keyID,
				PublicKey:   publicMaterial,
				Payload:     payload,
				PayloadHash: hex.EncodeToString(hash[:]),
				Signature:   signature,
			}, nil
		}

		if !errors.Is(signErr, ErrTPMUnavailable) {
			return nil, fmt.Errorf("sign posture payload with TPM: %w", signErr)
		}
	}

	privateKey, publicKey, err := m.loadOrCreateSigningKey()
	if err != nil {
		return nil, err
	}

	signature := ed25519.Sign(privateKey, payloadBytes)
	pubHash := sha256.Sum256(publicKey)
	keyID := hex.EncodeToString(pubHash[:8])

	return &SignedAssertion{
		Algorithm:   algorithmEd25519,
		KeyID:       keyID,
		PublicKey:   base64.RawURLEncoding.EncodeToString(publicKey),
		Payload:     payload,
		PayloadHash: hex.EncodeToString(hash[:]),
		Signature:   base64.RawURLEncoding.EncodeToString(signature),
	}, nil
}

// VerifyAssertion validates payload hash and signature based on algorithm.
func VerifyAssertion(assertion *SignedAssertion) error {
	if assertion == nil {
		return errors.New("assertion is required")
	}

	payloadBytes, err := json.Marshal(assertion.Payload)
	if err != nil {
		return fmt.Errorf("marshal payload for verification: %w", err)
	}

	hash := sha256.Sum256(payloadBytes)
	if assertion.PayloadHash != hex.EncodeToString(hash[:]) {
		return errors.New("payload hash mismatch")
	}

	signatureBytes, err := base64.RawURLEncoding.DecodeString(assertion.Signature)
	if err != nil {
		return fmt.Errorf("decode signature: %w", err)
	}

	switch assertion.Algorithm {
	case algorithmEd25519:
		publicKeyBytes, err := base64.RawURLEncoding.DecodeString(assertion.PublicKey)
		if err != nil {
			return fmt.Errorf("decode public key: %w", err)
		}
		if len(publicKeyBytes) != ed25519.PublicKeySize {
			return errors.New("invalid Ed25519 public key size")
		}
		if !ed25519.Verify(ed25519.PublicKey(publicKeyBytes), payloadBytes, signatureBytes) {
			return errors.New("signature verification failed")
		}
		return nil

	case algorithmRS256TPM:
		certBytes, err := base64.RawURLEncoding.DecodeString(assertion.PublicKey)
		if err != nil {
			return fmt.Errorf("decode TPM certificate: %w", err)
		}
		cert, err := x509.ParseCertificate(certBytes)
		if err != nil {
			return fmt.Errorf("parse TPM certificate: %w", err)
		}
		rsaKey, ok := cert.PublicKey.(*rsa.PublicKey)
		if !ok {
			return errors.New("TPM certificate public key is not RSA")
		}
		if err := rsa.VerifyPKCS1v15(rsaKey, crypto.SHA256, hash[:], signatureBytes); err != nil {
			return fmt.Errorf("TPM signature verification failed: %w", err)
		}
		return nil

	default:
		return fmt.Errorf("unsupported signature algorithm: %s", assertion.Algorithm)
	}
}

func collectPosture() (DevicePosture, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return DevicePosture{}, fmt.Errorf("read hostname: %w", err)
	}

	return DevicePosture{
		SchemaVersion:       defaultSchemaVersion,
		CollectedAt:         time.Now().UTC().Truncate(time.Second),
		Hostname:            hostname,
		OS:                  runtime.GOOS,
		Architecture:        runtime.GOARCH,
		GoVersion:           runtime.Version(),
		SecurityAgentActive: envBool("ZTCLI_SECURITY_AGENT_ACTIVE"),
		DeviceCertPresent:   envBool("ZTCLI_DEVICE_CERT_PRESENT"),
	}, nil
}

func envBool(name string) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(name)))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func (m *Manager) loadOrCreateSigningKey() (ed25519.PrivateKey, ed25519.PublicKey, error) {
	encoded, err := m.store.Get(serviceName, signingKeyUser)
	if err != nil {
		if !errors.Is(err, keyring.ErrNotFound) {
			return nil, nil, fmt.Errorf("read posture signing key: %w", err)
		}
		_, privateKey, genErr := ed25519.GenerateKey(rand.Reader)
		if genErr != nil {
			return nil, nil, fmt.Errorf("generate posture signing key: %w", genErr)
		}
		encoded = base64.RawURLEncoding.EncodeToString(privateKey)
		if setErr := m.store.Set(serviceName, signingKeyUser, encoded); setErr != nil {
			return nil, nil, fmt.Errorf("persist posture signing key: %w", setErr)
		}
		publicKey := privateKey.Public().(ed25519.PublicKey)
		return privateKey, publicKey, nil
	}

	privateKeyBytes, decodeErr := base64.RawURLEncoding.DecodeString(encoded)
	if decodeErr != nil {
		return nil, nil, fmt.Errorf("decode posture signing key: %w", decodeErr)
	}
	if len(privateKeyBytes) != ed25519.PrivateKeySize {
		return nil, nil, errors.New("invalid posture signing key size")
	}
	privateKey := ed25519.PrivateKey(privateKeyBytes)
	publicKey := privateKey.Public().(ed25519.PublicKey)
	return privateKey, publicKey, nil
}
