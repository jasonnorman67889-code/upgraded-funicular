package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/spf13/cobra"
	"zt-cli/internal/store"
)

func addStatusCommand(rootCmd *cobra.Command, tokenStore *store.TokenStore) {
	var jsonOutput bool

	statusCmd := &cobra.Command{
		Use:   "status",
		Short: "Show token status from OS keychain",
		RunE: func(cmd *cobra.Command, args []string) error {
			out := cmd.OutOrStdout()
			token, err := tokenStore.Load()
			if err != nil {
				if errors.Is(err, store.ErrTokenNotFound) {
					if jsonOutput {
						return writeJSONStatus(out, statusPayload{Authenticated: false})
					}
					fmt.Fprintln(out, "Status: not authenticated")
					return nil
				}
				return err
			}

			lastSignerLabel := formatSignerLabel("", false)
			lastSigner, signerErr := tokenStore.LoadLastSigner()
			if signerErr == nil {
				lastSignerLabel = formatSignerLabel(lastSigner, true)
			} else if !errors.Is(signerErr, store.ErrTokenNotFound) {
				return signerErr
			}

			expiryText := "not provided by IdP"
			state := "unknown"
			if !token.Expiry.IsZero() {
				expiryText = token.Expiry.Format(time.RFC3339)
				if token.Expiry.Before(time.Now()) {
					state = "expired"
				} else {
					state = "valid"
				}
			}

			if jsonOutput {
				return writeJSONStatus(out, statusPayload{
					Authenticated: true,
					LastSigner:    lastSignerLabel,
					TokenType:     token.TokenType,
					Expiry:        expiryText,
					State:         state,
				})
			}

			fmt.Fprintln(out, "Status: authenticated")
			fmt.Fprintf(out, "Last signer: %s\n", lastSignerLabel)
			if token.TokenType != "" {
				fmt.Fprintf(out, "Token type: %s\n", token.TokenType)
			}
			if token.Expiry.IsZero() {
				fmt.Fprintln(out, "Expiry: not provided by IdP")
				return nil
			}

			fmt.Fprintf(out, "Expiry: %s\n", token.Expiry.Format(time.RFC3339))
			if token.Expiry.Before(time.Now()) {
				fmt.Fprintln(out, "State: expired")
			} else {
				fmt.Fprintln(out, "State: valid")
			}
			return nil
		},
	}

	statusCmd.Flags().BoolVar(&jsonOutput, "json", false, "Print status as JSON")
	rootCmd.AddCommand(statusCmd)
}

type statusPayload struct {
	Authenticated bool   `json:"authenticated"`
	LastSigner    string `json:"lastSigner,omitempty"`
	TokenType     string `json:"tokenType,omitempty"`
	Expiry        string `json:"expiry,omitempty"`
	State         string `json:"state,omitempty"`
}

func writeJSONStatus(out io.Writer, payload statusPayload) error {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal status json: %w", err)
	}
	_, err = fmt.Fprintln(out, string(encoded))
	return err
}

func formatSignerLabel(raw string, present bool) string {
	if !present {
		return "Unknown"
	}
	switch raw {
	case "RS256-TPM":
		return "RS256-TPM"
	case "Ed25519":
		return "Ed25519 fallback"
	default:
		if raw == "" {
			return "Unknown"
		}
		return raw
	}
}
