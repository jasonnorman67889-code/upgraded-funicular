package cmd

import "strings"

func parseScopes(scopeCSV string) []string {
	parts := strings.Split(scopeCSV, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		scope := strings.TrimSpace(part)
		if scope != "" {
			result = append(result, scope)
		}
	}
	if len(result) == 0 {
		return []string{"openid", "profile", "email"}
	}
	return result
}
