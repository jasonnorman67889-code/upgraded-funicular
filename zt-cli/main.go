package main

import (
	"os"

	"zt-cli/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		_, _ = os.Stderr.WriteString("Error: " + err.Error() + "\n")
		os.Exit(1)
	}
}
