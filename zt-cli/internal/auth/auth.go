package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"golang.org/x/oauth2"
)

const defaultAuthTimeout = 2 * time.Minute

// Options controls OIDC + PKCE login behavior for the CLI.
type Options struct {
	ProviderURL    string
	ClientID       string
	Scopes         []string
	CallbackHost   string
	CallbackPort   int
	OpenBrowser    bool
	AuthCodeParams map[string]string
	RequestTimeout time.Duration
}

func randomString(length int) (string, error) {
	if length <= 0 {
		return "", errors.New("length must be positive")
	}

	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate random bytes: %w", err)
	}

	encoded := base64.RawURLEncoding.EncodeToString(bytes)
	if len(encoded) < length {
		return "", errors.New("encoded random value too short")
	}
	return encoded[:length], nil
}

func generateChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func normalizeProviderURL(providerURL string) (string, error) {
	trimmed := strings.TrimSpace(providerURL)
	if trimmed == "" {
		return "", errors.New("provider URL is required")
	}
	trimmed = strings.TrimRight(trimmed, "/")
	if _, err := url.ParseRequestURI(trimmed); err != nil {
		return "", fmt.Errorf("invalid provider URL: %w", err)
	}
	return trimmed, nil
}

func openInBrowser(target string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", target)
	case "darwin":
		cmd = exec.Command("open", target)
	default:
		cmd = exec.Command("xdg-open", target)
	}
	return cmd.Start()
}

func withDefaults(opts Options) Options {
	if opts.CallbackHost == "" {
		opts.CallbackHost = "127.0.0.1"
	}
	if len(opts.Scopes) == 0 {
		opts.Scopes = []string{"openid", "profile", "email"}
	}
	if opts.RequestTimeout <= 0 {
		opts.RequestTimeout = defaultAuthTimeout
	}
	return opts
}

// AuthenticateUser executes an OIDC Authorization Code + PKCE flow and returns short-lived tokens.
func AuthenticateUser(ctx context.Context, opts Options) (*oauth2.Token, error) {
	opts = withDefaults(opts)

	providerURL, err := normalizeProviderURL(opts.ProviderURL)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(opts.ClientID) == "" {
		return nil, errors.New("client ID is required")
	}

	codeVerifier, err := randomString(64)
	if err != nil {
		return nil, fmt.Errorf("generate code verifier: %w", err)
	}
	codeChallenge := generateChallenge(codeVerifier)
	state, err := randomString(32)
	if err != nil {
		return nil, fmt.Errorf("generate state: %w", err)
	}

	addr := net.JoinHostPort(opts.CallbackHost, fmt.Sprintf("%d", opts.CallbackPort))
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("start callback listener: %w", err)
	}
	defer listener.Close()

	callbackURL := url.URL{
		Scheme: "http",
		Host:   listener.Addr().String(),
		Path:   "/callback",
	}

	config := &oauth2.Config{
		ClientID: opts.ClientID,
		Endpoint: oauth2.Endpoint{
			AuthURL:  providerURL + "/protocol/openid-connect/auth",
			TokenURL: providerURL + "/protocol/openid-connect/token",
		},
		RedirectURL: callbackURL.String(),
		Scopes:      opts.Scopes,
	}

	mux := http.NewServeMux()
	codeChan := make(chan string, 1)
	errChan := make(chan error, 1)
	server := &http.Server{Handler: mux}

	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			select {
			case errChan <- fmt.Errorf("unexpected callback method: %s", r.Method):
			default:
			}
			return
		}

		if r.URL.Query().Get("state") != state {
			http.Error(w, "State mismatch error", http.StatusBadRequest)
			select {
			case errChan <- errors.New("state mismatch (possible CSRF)"):
			default:
			}
			return
		}

		if reason := r.URL.Query().Get("error"); reason != "" {
			http.Error(w, "Authentication failed", http.StatusBadRequest)
			details := r.URL.Query().Get("error_description")
			select {
			case errChan <- fmt.Errorf("authorization error: %s %s", reason, details):
			default:
			}
			return
		}

		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Code not found", http.StatusBadRequest)
			select {
			case errChan <- errors.New("no authorization code returned by provider"):
			default:
			}
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, "<h1>Authentication successful</h1><p>You can close this window and return to the terminal.</p>")

		select {
		case codeChan <- code:
		default:
		}
	})

	go func() {
		if serveErr := server.Serve(listener); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			select {
			case errChan <- fmt.Errorf("callback server error: %w", serveErr):
			default:
			}
		}
	}()

	authURLParams := []oauth2.AuthCodeOption{
		oauth2.AccessTypeOffline,
		oauth2.SetAuthURLParam("code_challenge", codeChallenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	}
	for name, value := range opts.AuthCodeParams {
		if strings.TrimSpace(name) == "" {
			continue
		}
		authURLParams = append(authURLParams, oauth2.SetAuthURLParam(name, value))
	}

	authURL := config.AuthCodeURL(state, authURLParams...)

	fmt.Printf("Open this URL to authenticate:\n\n%s\n\n", authURL)
	if opts.OpenBrowser {
		if browserErr := openInBrowser(authURL); browserErr != nil {
			fmt.Printf("Could not open browser automatically: %v\n", browserErr)
		}
	}

	waitCtx, cancelWait := context.WithTimeout(ctx, opts.RequestTimeout)
	defer cancelWait()

	shutdown := func() {
		shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelShutdown()
		_ = server.Shutdown(shutdownCtx)
	}

	var code string
	select {
	case code = <-codeChan:
		shutdown()
	case flowErr := <-errChan:
		shutdown()
		return nil, flowErr
	case <-waitCtx.Done():
		shutdown()
		return nil, fmt.Errorf("authentication timed out: %w", waitCtx.Err())
	}

	token, err := config.Exchange(
		ctx,
		code,
		oauth2.SetAuthURLParam("code_verifier", codeVerifier),
	)
	if err != nil {
		return nil, fmt.Errorf("exchange auth code for token: %w", err)
	}

	return token, nil
}
