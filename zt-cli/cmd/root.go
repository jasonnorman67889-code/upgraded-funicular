package cmd

import (
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"zt-cli/internal/posture"
	"zt-cli/internal/store"
)

type options struct {
	providerURL  string
	clientID     string
	scopeCSV     string
	callbackHost string
	callbackPort int
	openBrowser  bool
	timeout      time.Duration
}

// Execute runs the root Cobra command.
func Execute() error {
	return newRootCmd().Execute()
}

func newRootCmd() *cobra.Command {
	opts := options{}
	tokenStore := store.NewTokenStore()
	postureManager := posture.NewManager()

	rootCmd := &cobra.Command{
		Use:   "zt-cli",
		Short: "Zero Trust command-line interface",
		Long:  "zt-cli performs Zero Trust login and secure token handling using OIDC Authorization Code flow with PKCE.",
	}

	rootCmd.PersistentFlags().StringVar(&opts.providerURL, "provider-url", os.Getenv("ZTCLI_PROVIDER_URL"), "OIDC provider base URL")
	rootCmd.PersistentFlags().StringVar(&opts.clientID, "client-id", os.Getenv("ZTCLI_CLIENT_ID"), "OIDC client ID")
	rootCmd.PersistentFlags().StringVar(&opts.scopeCSV, "scopes", valueOrDefault(os.Getenv("ZTCLI_SCOPES"), "openid,profile,email"), "Comma-separated OIDC scopes")
	rootCmd.PersistentFlags().StringVar(&opts.callbackHost, "callback-host", valueOrDefault(os.Getenv("ZTCLI_CALLBACK_HOST"), "127.0.0.1"), "Local callback host")
	rootCmd.PersistentFlags().IntVar(&opts.callbackPort, "callback-port", 0, "Local callback port (0 selects random free port)")
	rootCmd.PersistentFlags().BoolVar(&opts.openBrowser, "open-browser", true, "Automatically open authorization URL in default browser")
	rootCmd.PersistentFlags().DurationVar(&opts.timeout, "timeout", 3*time.Minute, "Authentication timeout")

	addLoginCommand(rootCmd, &opts, tokenStore, postureManager)
	addLogoutCommand(rootCmd, tokenStore)
	addStatusCommand(rootCmd, tokenStore)

	return rootCmd
}

func valueOrDefault(value string, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}
