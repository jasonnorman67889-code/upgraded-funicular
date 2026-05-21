package cmd

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/spf13/cobra"
	"github.com/zalando/go-keyring"
	"golang.org/x/oauth2"
	"zt-cli/internal/store"
)

type testKeyring struct {
	values map[string]string
}

func (k *testKeyring) Set(service, user, secret string) error {
	if k.values == nil {
		k.values = make(map[string]string)
	}
	k.values[service+":"+user] = secret
	return nil
}

func (k *testKeyring) Get(service, user string) (string, error) {
	if k.values == nil {
		return "", keyring.ErrNotFound
	}
	v, ok := k.values[service+":"+user]
	if !ok || v == "" {
		return "", keyring.ErrNotFound
	}
	return v, nil
}

func (k *testKeyring) Delete(service, user string) error {
	if k.values != nil {
		delete(k.values, service+":"+user)
	}
	return nil
}

func TestStatusTextShowsMappedSignerLabel(t *testing.T) {
	keyringClient := &testKeyring{}
	tokenStore := store.NewTokenStoreWithClient(keyringClient)

	err := tokenStore.Save(&oauth2.Token{AccessToken: "a1", TokenType: "Bearer", Expiry: time.Now().Add(5 * time.Minute)})
	if err != nil {
		t.Fatalf("save token: %v", err)
	}
	if err := tokenStore.SaveLastSigner("Ed25519"); err != nil {
		t.Fatalf("save signer: %v", err)
	}

	root := &cobra.Command{Use: "zt-cli"}
	addStatusCommand(root, tokenStore)
	root.SetArgs([]string{"status"})

	var out bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&out)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute status: %v", err)
	}

	got := out.String()
	if !strings.Contains(got, "Last signer: Ed25519 fallback") {
		t.Fatalf("expected fallback signer label, got output: %s", got)
	}
}

func TestStatusJSONOutput(t *testing.T) {
	keyringClient := &testKeyring{}
	tokenStore := store.NewTokenStoreWithClient(keyringClient)

	err := tokenStore.Save(&oauth2.Token{AccessToken: "a1", TokenType: "Bearer", Expiry: time.Now().Add(5 * time.Minute)})
	if err != nil {
		t.Fatalf("save token: %v", err)
	}
	if err := tokenStore.SaveLastSigner("RS256-TPM"); err != nil {
		t.Fatalf("save signer: %v", err)
	}

	root := &cobra.Command{Use: "zt-cli"}
	addStatusCommand(root, tokenStore)
	root.SetArgs([]string{"status", "--json"})

	var out bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&out)

	if err := root.Execute(); err != nil {
		t.Fatalf("execute status --json: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(out.Bytes()), &payload); err != nil {
		t.Fatalf("parse json output: %v; output=%s", err, out.String())
	}

	if authed, ok := payload["authenticated"].(bool); !ok || !authed {
		t.Fatalf("expected authenticated=true, got: %v", payload["authenticated"])
	}
	if payload["lastSigner"] != "RS256-TPM" {
		t.Fatalf("expected lastSigner RS256-TPM, got: %v", payload["lastSigner"])
	}
	if payload["tokenType"] != "Bearer" {
		t.Fatalf("expected tokenType Bearer, got: %v", payload["tokenType"])
	}
}

func TestStatusJSONNotAuthenticated(t *testing.T) {
	tokenStore := store.NewTokenStoreWithClient(&testKeyring{})

	root := &cobra.Command{Use: "zt-cli"}
	addStatusCommand(root, tokenStore)
	root.SetArgs([]string{"status", "--json"})

	var out bytes.Buffer
	root.SetOut(&out)
	root.SetErr(&out)

	err := root.Execute()
	if err != nil && !errors.Is(err, store.ErrTokenNotFound) {
		t.Fatalf("unexpected execute error: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(out.Bytes()), &payload); err != nil {
		t.Fatalf("parse json output: %v; output=%s", err, out.String())
	}
	if authed, ok := payload["authenticated"].(bool); !ok || authed {
		t.Fatalf("expected authenticated=false, got: %v", payload["authenticated"])
	}
}
