//go:build !windows

package posture

func newSystemTPMSigner() hardwareSigner {
	return nil
}
