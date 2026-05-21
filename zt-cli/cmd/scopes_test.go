package cmd

import (
	"reflect"
	"testing"
)

func TestParseScopesDefaults(t *testing.T) {
	got := parseScopes("   , , ")
	want := []string{"openid", "profile", "email"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("parseScopes defaults mismatch: got %v want %v", got, want)
	}
}

func TestParseScopesTrimsAndFilters(t *testing.T) {
	got := parseScopes("openid, profile, ,email , custom.scope")
	want := []string{"openid", "profile", "email", "custom.scope"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("parseScopes mismatch: got %v want %v", got, want)
	}
}
