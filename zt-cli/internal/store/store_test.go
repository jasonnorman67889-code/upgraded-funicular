package store

import (
	"errors"
	"testing"
	"time"

	"github.com/zalando/go-keyring"
	"golang.org/x/oauth2"
)

type fakeKeyring struct {
	values    map[string]string
	setErr    error
	getErr    error
	deleteErr error
}

func (f *fakeKeyring) Set(service, user, secret string) error {
	if f.setErr != nil {
		return f.setErr
	}
	if f.values == nil {
		f.values = make(map[string]string)
	}
	f.values[service+":"+user] = secret
	return nil
}

func (f *fakeKeyring) Get(service, user string) (string, error) {
	if f.getErr != nil {
		return "", f.getErr
	}
	if f.values == nil {
		return "", keyring.ErrNotFound
	}
	value, ok := f.values[service+":"+user]
	if !ok || value == "" {
		return "", keyring.ErrNotFound
	}
	return value, nil
}

func (f *fakeKeyring) Delete(service, user string) error {
	if f.deleteErr != nil {
		return f.deleteErr
	}
	if f.values != nil {
		delete(f.values, service+":"+user)
	}
	return nil
}

func TestTokenStoreSaveLoadRoundTrip(t *testing.T) {
	f := &fakeKeyring{}
	s := NewTokenStoreWithClient(f)

	expiry := time.Now().UTC().Add(30 * time.Minute).Truncate(time.Second)
	in := &oauth2.Token{
		AccessToken:  "access-1",
		TokenType:    "Bearer",
		RefreshToken: "refresh-1",
		Expiry:       expiry,
	}

	if err := s.Save(in); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	out, err := s.Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if out.AccessToken != in.AccessToken || out.TokenType != in.TokenType || out.RefreshToken != in.RefreshToken || !out.Expiry.Equal(in.Expiry) {
		t.Fatalf("round trip mismatch: got %#v want %#v", out, in)
	}
}

func TestTokenStoreLoadNotFound(t *testing.T) {
	f := &fakeKeyring{getErr: keyring.ErrNotFound}
	s := NewTokenStoreWithClient(f)

	_, err := s.Load()
	if !errors.Is(err, ErrTokenNotFound) {
		t.Fatalf("expected ErrTokenNotFound, got %v", err)
	}
}

func TestTokenStoreClearIgnoresNotFound(t *testing.T) {
	f := &fakeKeyring{deleteErr: keyring.ErrNotFound}
	s := NewTokenStoreWithClient(f)

	if err := s.Clear(); err != nil {
		t.Fatalf("Clear() unexpected error: %v", err)
	}
}

func TestTokenStoreSaveEmptyToken(t *testing.T) {
	s := NewTokenStoreWithClient(&fakeKeyring{})

	if err := s.Save(&oauth2.Token{}); err == nil {
		t.Fatal("expected error for empty token")
	}
}

func TestTokenStoreSaveLoadLastSignerRoundTrip(t *testing.T) {
	f := &fakeKeyring{}
	s := NewTokenStoreWithClient(f)

	if err := s.SaveLastSigner("RS256-TPM"); err != nil {
		t.Fatalf("SaveLastSigner() error = %v", err)
	}

	signer, err := s.LoadLastSigner()
	if err != nil {
		t.Fatalf("LoadLastSigner() error = %v", err)
	}
	if signer != "RS256-TPM" {
		t.Fatalf("LoadLastSigner() = %q, want %q", signer, "RS256-TPM")
	}
}

func TestTokenStoreLoadLastSignerNotFound(t *testing.T) {
	f := &fakeKeyring{getErr: keyring.ErrNotFound}
	s := NewTokenStoreWithClient(f)

	_, err := s.LoadLastSigner()
	if !errors.Is(err, ErrTokenNotFound) {
		t.Fatalf("expected ErrTokenNotFound, got %v", err)
	}
}
