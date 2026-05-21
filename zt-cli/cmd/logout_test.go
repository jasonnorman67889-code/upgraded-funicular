package cmd

import (
	"errors"
	"strings"
	"testing"

	"zt-cli/internal/store"

	"github.com/spf13/cobra"
	"github.com/zalando/go-keyring"
	"golang.org/x/oauth2"
)

type keyringWithDeleteErrors struct {
	values          map[string]string
	deleteErrByUser map[string]error
}

func (k *keyringWithDeleteErrors) Set(service, user, secret string) error {
	if k.values == nil {
		k.values = make(map[string]string)
	}
	k.values[service+":"+user] = secret
	return nil
}

func (k *keyringWithDeleteErrors) Get(service, user string) (string, error) {
	if k.values == nil {
		return "", keyring.ErrNotFound
	}
	v, ok := k.values[service+":"+user]
	if !ok || v == "" {
		return "", keyring.ErrNotFound
	}
	return v, nil
}

func (k *keyringWithDeleteErrors) Delete(service, user string) error {
	if err := k.deleteErrByUser[user]; err != nil {
		return err
	}
	if k.values != nil {
		delete(k.values, service+":"+user)
	}
	return nil
}

func TestLogoutClearsTokenAndSigner(t *testing.T) {
	keyringClient := &testKeyring{}
	tokenStore := store.NewTokenStoreWithClient(keyringClient)

	if err := tokenStore.Save(&oauth2.Token{AccessToken: "token-1", TokenType: "Bearer"}); err != nil {
		t.Fatalf("save token: %v", err)
	}
	if err := tokenStore.SaveLastSigner("RS256-TPM"); err != nil {
		t.Fatalf("save signer: %v", err)
	}

	root := &cobra.Command{Use: "zt-cli"}
	addLogoutCommand(root, tokenStore)
	root.SetArgs([]string{"logout"})

	if err := root.Execute(); err != nil {
		t.Fatalf("logout execute: %v", err)
	}

	_, err := tokenStore.Load()
	if !errors.Is(err, store.ErrTokenNotFound) {
		t.Fatalf("expected token cleared, got error=%v", err)
	}

	_, err = tokenStore.LoadLastSigner()
	if !errors.Is(err, store.ErrTokenNotFound) {
		t.Fatalf("expected signer cleared, got error=%v", err)
	}
}

func TestLogoutReturnsContextOnTokenClearFailure(t *testing.T) {
	keyringClient := &keyringWithDeleteErrors{
		deleteErrByUser: map[string]error{"oidc-token": errors.New("boom")},
	}
	tokenStore := store.NewTokenStoreWithClient(keyringClient)

	root := &cobra.Command{Use: "zt-cli"}
	addLogoutCommand(root, tokenStore)
	root.SetArgs([]string{"logout"})

	err := root.Execute()
	if err == nil {
		t.Fatal("expected logout error")
	}
	if !strings.Contains(err.Error(), "clear token from OS keychain") {
		t.Fatalf("expected contextual token clear error, got: %v", err)
	}
}

func TestLogoutReturnsContextOnSignerClearFailure(t *testing.T) {
	keyringClient := &keyringWithDeleteErrors{
		deleteErrByUser: map[string]error{"posture-last-signer": errors.New("boom")},
	}
	tokenStore := store.NewTokenStoreWithClient(keyringClient)

	if err := tokenStore.Save(&oauth2.Token{AccessToken: "token-1", TokenType: "Bearer"}); err != nil {
		t.Fatalf("save token: %v", err)
	}

	root := &cobra.Command{Use: "zt-cli"}
	addLogoutCommand(root, tokenStore)
	root.SetArgs([]string{"logout"})

	err := root.Execute()
	if err == nil {
		t.Fatal("expected logout error")
	}
	if !strings.Contains(err.Error(), "clear signer metadata from OS keychain") {
		t.Fatalf("expected contextual signer clear error, got: %v", err)
	}
}
