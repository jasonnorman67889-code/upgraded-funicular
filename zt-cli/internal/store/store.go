package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/zalando/go-keyring"
	"golang.org/x/oauth2"
)

const (
	serviceName = "zt-cli"
	tokenUser   = "oidc-token"
	signerUser  = "posture-last-signer"
)

// ErrTokenNotFound is returned when no token is present in secure storage.
var ErrTokenNotFound = errors.New("token not found")

// KeyringClient abstracts keyring operations for testability.
type KeyringClient interface {
	Set(service, user, secret string) error
	Get(service, user string) (string, error)
	Delete(service, user string) error
}

type osKeyringClient struct{}

func (osKeyringClient) Set(service, user, secret string) error {
	return keyring.Set(service, user, secret)
}

func (osKeyringClient) Get(service, user string) (string, error) {
	return keyring.Get(service, user)
}

func (osKeyringClient) Delete(service, user string) error {
	return keyring.Delete(service, user)
}

// TokenStore persists OIDC tokens in OS credential storage.
type TokenStore struct {
	client  KeyringClient
	service string
	user    string
}

// NewTokenStore creates a production token store backed by OS keyring.
func NewTokenStore() *TokenStore {
	return &TokenStore{
		client:  osKeyringClient{},
		service: serviceName,
		user:    tokenUser,
	}
}

// NewTokenStoreWithClient creates a token store with a custom keyring client for tests.
func NewTokenStoreWithClient(client KeyringClient) *TokenStore {
	return &TokenStore{
		client:  client,
		service: serviceName,
		user:    tokenUser,
	}
}

type storedToken struct {
	AccessToken  string    `json:"access_token"`
	TokenType    string    `json:"token_type,omitempty"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	Expiry       time.Time `json:"expiry,omitempty"`
}

// Save writes token payload to secure storage.
func (s *TokenStore) Save(token *oauth2.Token) error {
	if token == nil || token.AccessToken == "" {
		return errors.New("cannot save empty token")
	}

	payload := storedToken{
		AccessToken:  token.AccessToken,
		TokenType:    token.TokenType,
		RefreshToken: token.RefreshToken,
		Expiry:       token.Expiry,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal token payload: %w", err)
	}

	if err := s.client.Set(s.service, s.user, string(data)); err != nil {
		return fmt.Errorf("write token to OS keychain: %w", err)
	}

	return nil
}

// Load returns token from secure storage.
func (s *TokenStore) Load() (*oauth2.Token, error) {
	value, err := s.client.Get(s.service, s.user)
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return nil, ErrTokenNotFound
		}
		return nil, fmt.Errorf("read token from OS keychain: %w", err)
	}

	var parsed storedToken
	if err := json.Unmarshal([]byte(value), &parsed); err != nil {
		return nil, fmt.Errorf("decode token payload: %w", err)
	}

	if parsed.AccessToken == "" {
		return nil, errors.New("stored token is missing access token")
	}

	return &oauth2.Token{
		AccessToken:  parsed.AccessToken,
		TokenType:    parsed.TokenType,
		RefreshToken: parsed.RefreshToken,
		Expiry:       parsed.Expiry,
	}, nil
}

// Clear removes token from secure storage.
func (s *TokenStore) Clear() error {
	err := s.client.Delete(s.service, s.user)
	if err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return fmt.Errorf("remove token from OS keychain: %w", err)
	}
	return nil
}

// SaveLastSigner writes the most recently used posture signer label.
func (s *TokenStore) SaveLastSigner(signer string) error {
	if signer == "" {
		return errors.New("cannot save empty signer")
	}
	if err := s.client.Set(s.service, signerUser, signer); err != nil {
		return fmt.Errorf("write signer metadata to OS keychain: %w", err)
	}
	return nil
}

// LoadLastSigner reads the most recently used posture signer label.
func (s *TokenStore) LoadLastSigner() (string, error) {
	value, err := s.client.Get(s.service, signerUser)
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return "", ErrTokenNotFound
		}
		return "", fmt.Errorf("read signer metadata from OS keychain: %w", err)
	}
	if value == "" {
		return "", ErrTokenNotFound
	}
	return value, nil
}

// ClearLastSigner removes signer metadata from secure storage.
func (s *TokenStore) ClearLastSigner() error {
	err := s.client.Delete(s.service, signerUser)
	if err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return fmt.Errorf("remove signer metadata from OS keychain: %w", err)
	}
	return nil
}
