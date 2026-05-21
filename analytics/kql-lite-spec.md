# Technical Specification: Zero Trust Command-Line Interface (ZT-CLI)

## 1. Overview

The ZT-CLI is a lightweight, high-performance command-line tool built in Go. Its primary purpose is to provide secure, authenticated access to internal services and infrastructure by strictly enforcing Zero Trust architecture principles. Every command executed through the CLI requires identity verification, device posture validation, and real-time policy evaluation before routing requests to target resources.

## 2. Core Technologies

- Language: Go (Golang)
- CLI Framework: cobra (for robust command routing and flag parsing)
- Configuration Management: viper (for managing local settings and environment variables)
- Identity Provider (IdP): Generic OIDC-compliant provider (for example, Keycloak, Entra ID, or local PKI) - infrastructure-agnostic, requiring no specific cloud vendor dependencies.
- Policy Engine: Embedded Open Policy Agent (OPA) or custom Go-based rules engine using JSON or YAML policies.

## 3. System Architecture

### 3.1 Authentication Flow

The authentication flow assumes no implicit trust, even for users operating from internal networks.

1. Initialization: The user invokes `zt-cli login`.
2. Identity Verification: The CLI initiates a PKCE (Proof Key for Code Exchange) OAuth2/OIDC flow, launching a local browser or prompting for device code authentication.
3. Device Posture Check: The CLI gathers local telemetry (OS version, active security agents, certificate presence) and signs this payload with a local hardware-backed key or TPM.
4. Token Issuance: The IdP issues a short-lived JSON Web Token (JWT) containing user claims, wrapped with the device posture assertions.
5. Session Storage: The short-lived JWT is stored securely in the local OS credential manager (Keychain or Credential Manager).

### 3.2 Policy Enforcement Engine

The Policy Enforcement Engine acts as the local Policy Enforcement Point (PEP). It intercepts all resource-bound commands before they are transmitted over the network.

- Context Gathering: For every command (for example, `zt-cli connect db-prod`), the engine bundles the user's JWT, the target resource identifier, the requested action, and the current timestamp.
- Rule Evaluation: The embedded Go rules engine evaluates this context against a locally synced, cryptographically signed policy file (for example, `policies.json`).
- Decision Matrix:
	- Allow: The conditions are met. The CLI establishes a Mutual TLS (mTLS) connection to the target resource, passing the JWT in the header for downstream validation.
	- Deny: The request is blocked locally, saving network overhead and preventing unauthorized probing.
	- Step-up: The engine detects elevated risk (for example, a highly privileged command) and triggers an MFA challenge before proceeding.

## 4. Command Structure

Below is the proposed standard command hierarchy:

```text
zt-cli
|- login                  # Initiates auth flow and posture check
|- logout                 # Purges local tokens securely
|- status                 # Displays current identity, token expiry, and posture state
|- access
|  |- request <resource>  # Requests temporary elevation or access to a resource
|  \- list               # Lists currently accessible services based on active policies
|- connect <resource>     # Establishes an mTLS tunnel or authenticated session to a target
\- policy
	 |- update              # Fetches the latest signed policy definitions from the control plane
	 \- verify             # Locally tests a command against current policies (dry run)
```

## 5. Security Considerations

- Zero Hardcoded Secrets: No static keys or long-lived credentials are stored in the Go binary or local config.
- Ephemeral Access: All tokens are short-lived (for example, 15-60 minutes).
- Binary Integrity: The CLI binary must be compiled with strict compiler flags and signed to prevent tampering.
- Local Data Protection: Sensitive configuration and tokens must only be written to OS-level secure enclaves, not plain text files.
