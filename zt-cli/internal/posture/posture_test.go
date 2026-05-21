package posture

import (
	"errors"
	"testing"

	"github.com/zalando/go-keyring"
)

type fakeSecretStore struct {
	value  string
	setErr error
	getErr error
}

type fakeHardwareSigner struct {
	algorithm      string
	keyID          string
	publicMaterial string
	signature      string
	err            error
}

func (f *fakeHardwareSigner) Sign(payload []byte) (string, string, string, string, error) {
	if f.err != nil {
		return "", "", "", "", f.err
	}
	return f.algorithm, f.keyID, f.publicMaterial, f.signature, nil
}

func (f *fakeSecretStore) Set(service, user, secret string) error {
	if f.setErr != nil {
		return f.setErr
	}
	f.value = secret
	return nil
}

func (f *fakeSecretStore) Get(service, user string) (string, error) {
	if f.getErr != nil {
		return "", f.getErr
	}
	if f.value == "" {
		return "", keyring.ErrNotFound
	}
	return f.value, nil
}

func TestAssessAndSignAndVerify(t *testing.T) {
	manager := NewManagerWithDeps(&fakeSecretStore{getErr: keyring.ErrNotFound}, nil)
	assertion, err := manager.AssessAndSign(nil)
	if err != nil {
		t.Fatalf("AssessAndSign() error = %v", err)
	}
	if verifyErr := VerifyAssertion(assertion); verifyErr != nil {
		t.Fatalf("VerifyAssertion() error = %v", verifyErr)
	}
}

func TestVerifyAssertionDetectsTampering(t *testing.T) {
	manager := NewManagerWithDeps(&fakeSecretStore{getErr: keyring.ErrNotFound}, nil)
	assertion, err := manager.AssessAndSign(nil)
	if err != nil {
		t.Fatalf("AssessAndSign() error = %v", err)
	}

	assertion.Payload.Hostname = assertion.Payload.Hostname + "-tampered"
	if err := VerifyAssertion(assertion); err == nil {
		t.Fatal("expected verification error for tampered payload")
	}
}

func TestAssessAndSignUsesTPMSignerWhenAvailable(t *testing.T) {
	store := &fakeSecretStore{getErr: keyring.ErrNotFound}
	tpm := &fakeHardwareSigner{
		algorithm:      algorithmRS256TPM,
		keyID:          "TPM-KEY-1",
		publicMaterial: "cHVibGlj",
		signature:      "c2ln",
	}

	manager := NewManagerWithDeps(store, tpm)
	assertion, err := manager.AssessAndSign(nil)
	if err != nil {
		t.Fatalf("AssessAndSign() error = %v", err)
	}

	if assertion.Algorithm != algorithmRS256TPM {
		t.Fatalf("expected TPM algorithm, got %s", assertion.Algorithm)
	}
	if assertion.KeyID != "TPM-KEY-1" {
		t.Fatalf("expected TPM key ID, got %s", assertion.KeyID)
	}
	if assertion.PublicKey != "cHVibGlj" {
		t.Fatalf("expected TPM public material, got %s", assertion.PublicKey)
	}
	if assertion.Signature != "c2ln" {
		t.Fatalf("expected TPM signature, got %s", assertion.Signature)
	}
}

func TestAssessAndSignFallsBackWhenTPMUnavailable(t *testing.T) {
	store := &fakeSecretStore{getErr: keyring.ErrNotFound}
	tpm := &fakeHardwareSigner{err: ErrTPMUnavailable}

	manager := NewManagerWithDeps(store, tpm)
	assertion, err := manager.AssessAndSign(nil)
	if err != nil {
		t.Fatalf("AssessAndSign() error = %v", err)
	}

	if assertion.Algorithm != algorithmEd25519 {
		t.Fatalf("expected Ed25519 fallback, got %s", assertion.Algorithm)
	}
	if verifyErr := VerifyAssertion(assertion); verifyErr != nil {
		t.Fatalf("VerifyAssertion() error = %v", verifyErr)
	}
}

func TestAssessAndSignFailsWhenTPMSignerHardFails(t *testing.T) {
	store := &fakeSecretStore{getErr: keyring.ErrNotFound}
	tpm := &fakeHardwareSigner{err: errors.New("hardware signer I/O failure")}

	manager := NewManagerWithDeps(store, tpm)
	_, err := manager.AssessAndSign(nil)
	if err == nil {
		t.Fatal("expected error when TPM signer hard fails")
	}
}
