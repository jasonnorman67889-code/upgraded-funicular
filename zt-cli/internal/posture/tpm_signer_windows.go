//go:build windows

package posture

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

type windowsTPMSigner struct{}

type tpmPowerShellResult struct {
	Algorithm string `json:"algorithm"`
	KeyID     string `json:"keyId"`
	PublicKey string `json:"publicKey"`
	Signature string `json:"signature"`
}

func newSystemTPMSigner() hardwareSigner {
	if !isWindowsTPMReady() {
		return nil
	}
	return &windowsTPMSigner{}
}

func isWindowsTPMReady() bool {
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", "$t = Get-Tpm; if ($t.TpmPresent -and $t.TpmReady) { Write-Output 'READY' } else { Write-Output 'NOT_READY' }")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return false
	}
	return strings.Contains(string(out), "READY")
}

func (s *windowsTPMSigner) Sign(payload []byte) (algorithm string, keyID string, publicMaterial string, signature string, err error) {
	payloadB64 := base64.StdEncoding.EncodeToString(payload)
	script := strings.Join([]string{
		"$ErrorActionPreference = 'Stop'",
		"$subject = 'CN=ZTCLI TPM Posture Signing'",
		"$provider = 'Microsoft Platform Crypto Provider'",
		"$storePath = 'Cert:\\CurrentUser\\My'",
		"$cert = Get-ChildItem -Path $storePath | Where-Object { $_.Subject -eq $subject -and $_.HasPrivateKey } | Select-Object -First 1",
		"if (-not $cert) {",
		"  $cert = New-SelfSignedCertificate -Subject $subject -CertStoreLocation $storePath -Provider $provider -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm sha256 -NotAfter (Get-Date).AddYears(2) -KeyExportPolicy NonExportable",
		"}",
		"$payload = [Convert]::FromBase64String('" + payloadB64 + "')",
		"$rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($cert)",
		"if (-not $rsa) { throw 'RSA private key not available from TPM certificate' }",
		"$sig = $rsa.SignData($payload, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)",
		"$result = @{ algorithm = 'RS256-TPM'; keyId = $cert.Thumbprint; publicKey = [Convert]::ToBase64String($cert.RawData); signature = [Convert]::ToBase64String($sig) }",
		"$result | ConvertTo-Json -Compress",
	}, "; ")

	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	out, execErr := cmd.CombinedOutput()
	if execErr != nil {
		if strings.Contains(strings.ToLower(string(out)), "platform crypto provider") || strings.Contains(strings.ToLower(string(out)), "tpm") {
			return "", "", "", "", fmt.Errorf("%w: %s", ErrTPMUnavailable, strings.TrimSpace(string(out)))
		}
		return "", "", "", "", fmt.Errorf("run Windows TPM signer: %w (%s)", execErr, strings.TrimSpace(string(out)))
	}

	var parsed tpmPowerShellResult
	if err := json.Unmarshal(out, &parsed); err != nil {
		return "", "", "", "", fmt.Errorf("parse TPM signer response: %w", err)
	}
	if parsed.Algorithm == "" || parsed.KeyID == "" || parsed.PublicKey == "" || parsed.Signature == "" {
		return "", "", "", "", errors.New("incomplete TPM signer response")
	}

	publicCertBytes, err := base64.StdEncoding.DecodeString(parsed.PublicKey)
	if err != nil {
		return "", "", "", "", fmt.Errorf("decode TPM public certificate: %w", err)
	}
	signatureBytes, err := base64.StdEncoding.DecodeString(parsed.Signature)
	if err != nil {
		return "", "", "", "", fmt.Errorf("decode TPM signature: %w", err)
	}

	return parsed.Algorithm,
		parsed.KeyID,
		base64.RawURLEncoding.EncodeToString(publicCertBytes),
		base64.RawURLEncoding.EncodeToString(signatureBytes),
		nil
}
