package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"zt-cli/internal/store"
)

func addLogoutCommand(rootCmd *cobra.Command, tokenStore *store.TokenStore) {
	rootCmd.AddCommand(&cobra.Command{
		Use:   "logout",
		Short: "Delete token from OS keychain",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := tokenStore.Clear(); err != nil {
				return err
			}
			if err := tokenStore.ClearLastSigner(); err != nil {
				return err
			}
			fmt.Println("Logged out. Token removed from OS keychain.")
			return nil
		},
	})
}
