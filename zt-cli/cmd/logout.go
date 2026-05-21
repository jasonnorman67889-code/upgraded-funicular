package cmd

import (
	"fmt"

	"zt-cli/internal/store"

	"github.com/spf13/cobra"
)

func addLogoutCommand(rootCmd *cobra.Command, tokenStore *store.TokenStore) {
	rootCmd.AddCommand(&cobra.Command{
		Use:   "logout",
		Short: "Delete token from OS keychain",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := tokenStore.Clear(); err != nil {
				return fmt.Errorf("clear token from OS keychain: %w", err)
			}
			if err := tokenStore.ClearLastSigner(); err != nil {
				return fmt.Errorf("clear signer metadata from OS keychain: %w", err)
			}
			fmt.Println("Logged out. Token removed from OS keychain.")
			return nil
		},
	})
}
