package pushfy

import (
	"errors"
	"testing"
)

// TestErrorFromResponseMapping checks status -> typed error mapping and that
// both errors.Is (sentinels) and errors.As (typed) work.
func TestErrorFromResponseMapping(t *testing.T) {
	body := map[string]any{"error": "unauthorized"}

	auth := errorFromResponse(401, body)
	if !errors.Is(auth, ErrAuthentication) {
		t.Error("401 should match ErrAuthentication via errors.Is")
	}
	var ae *AuthenticationError
	if !errors.As(auth, &ae) || ae.Status != 401 || ae.Code != "unauthorized" {
		t.Errorf("401 should be *AuthenticationError with status/code, got %v", auth)
	}

	rl := errorFromResponse(429, map[string]any{})
	if !errors.Is(rl, ErrRateLimit) {
		t.Error("429 should match ErrRateLimit")
	}

	inv := errorFromResponse(400, map[string]any{"code": "bad_request"})
	if !errors.Is(inv, ErrInvalidRequest) {
		t.Error("400 should match ErrInvalidRequest")
	}

	api := errorFromResponse(503, nil)
	if !errors.Is(api, ErrAPI) {
		t.Error("503 should match ErrAPI")
	}

	// The embedded *PushfyError is reachable via errors.As too.
	var pe *PushfyError
	if !errors.As(auth, &pe) || pe.Status != 401 {
		t.Errorf("base *PushfyError should be reachable, got %v", pe)
	}
}
