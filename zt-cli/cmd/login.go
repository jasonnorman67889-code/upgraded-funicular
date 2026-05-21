package cmd

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"zt-cli/internal/auth"
	"zt-cli/internal/posture"
	"zt-cli/internal/store"
)

func addLoginCommand(rootCmd *cobra.Command, opts *options, tokenStore *store.TokenStore, postureManager *posture.Manager) {
	rootCmd.AddCommand(&cobra.Command{
		Use:   "login",
		Short: "Authenticate and store token in OS keychain",
		RunE: func(cmd *cobra.Command, args []string) error {
			if strings.TrimSpace(opts.providerURL) == "" || strings.TrimSpace(opts.clientID) == "" {
				return errors.New("both --provider-url and --client-id are required (or set ZTCLI_PROVIDER_URL and ZTCLI_CLIENT_ID)")
			}

			ctx, cancel := context.WithTimeout(cmd.Context(), opts.timeout)
			defer cancel()

			signedPosture, err := postureManager.AssessAndSign(ctx)
			if err != nil {
				return fmt.Errorf("assess and sign device posture: %w", err)
			}

			postureRaw, err := json.Marshal(signedPosture)
			if err != nil {
				return fmt.Errorf("marshal signed device posture: %w", err)
			}
			postureBlob := base64.RawURLEncoding.EncodeToString(postureRaw)

			token, err := auth.AuthenticateUser(ctx, auth.Options{
				ProviderURL:    opts.providerURL,
				ClientID:       opts.clientID,
				Scopes:         parseScopes(opts.scopeCSV),
				CallbackHost:   opts.callbackHost,
				CallbackPort:   opts.callbackPort,
				OpenBrowser:    opts.openBrowser,
				AuthCodeParams: map[string]string{"device_posture_assertion": postureBlob},
				RequestTimeout: opts.timeout,
			})
			if err != nil {
				return fmt.Errorf("authenticate user: %w", err)
			}

			if err := tokenStore.Save(token); err != nil {
				return fmt.Errorf("save token: %w", err)
			}

			if err := tokenStore.SaveLastSigner(signedPosture.Algorithm); err != nil {
				return fmt.Errorf("save signer metadata: %w", err)
			}

			fmt.Printf("Device posture signed with key ID: %s\n", signedPosture.KeyID)
			if !token.Expiry.IsZero() {
				fmt.Printf("Login successful. Token saved in OS keychain. Expires at: %s\n", token.Expiry.Format(time.RFC3339))
			} else {
				fmt.Println("Login successful. Token saved in OS keychain.")
			}
			return nil
		},
	})
}
