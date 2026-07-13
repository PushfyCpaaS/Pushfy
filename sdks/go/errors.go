package pushfy

import (
	"errors"
	"fmt"
)

// Sentinel errors so callers can branch with errors.Is(err, pushfy.ErrRateLimit).
// The typed errors below also work with errors.As.
var (
	// ErrAuthentication is matched by *AuthenticationError (HTTP 401/403).
	ErrAuthentication = errors.New("pushfy: authentication error")
	// ErrInvalidRequest is matched by *InvalidRequestError (HTTP 4xx).
	ErrInvalidRequest = errors.New("pushfy: invalid request")
	// ErrRateLimit is matched by *RateLimitError (HTTP 429).
	ErrRateLimit = errors.New("pushfy: rate limited")
	// ErrAPI is matched by *APIError (5xx / network / timeout).
	ErrAPI = errors.New("pushfy: api error")
)

// PushfyError is the base error surfaced by every SDK call.
//
//	Status   is the HTTP status (0 for network/timeout).
//	Code     is the API error string (e.g. "unauthorized", "rate_limited"), if any.
//	Response is the parsed response body (map, slice or {"raw": string}).
//
// Every typed error below embeds *PushfyError, so errors.As(err, &pe) with a
// *PushfyError target unwraps any of them.
type PushfyError struct {
	Message  string
	Status   int
	Code     string
	Response any
}

func (e *PushfyError) Error() string { return e.Message }

// AuthenticationError is returned for HTTP 401/403 (missing/invalid token or bad
// HMAC signature).
type AuthenticationError struct{ *PushfyError }

func (e *AuthenticationError) Unwrap() error        { return e.PushfyError }
func (e *AuthenticationError) Is(target error) bool { return target == ErrAuthentication }

// InvalidRequestError is returned for a malformed 4xx request (400/413/415, ...).
type InvalidRequestError struct{ *PushfyError }

func (e *InvalidRequestError) Unwrap() error        { return e.PushfyError }
func (e *InvalidRequestError) Is(target error) bool { return target == ErrInvalidRequest }

// RateLimitError is returned for HTTP 429. RetryAfter is seconds when known.
type RateLimitError struct {
	*PushfyError
	RetryAfter int
}

func (e *RateLimitError) Unwrap() error        { return e.PushfyError }
func (e *RateLimitError) Is(target error) bool { return target == ErrRateLimit }

// APIError is returned for 5xx responses, network failures and timeouts. Such
// calls are safe to retry idempotently (reuse the same ExtID).
type APIError struct{ *PushfyError }

func (e *APIError) Unwrap() error        { return e.PushfyError }
func (e *APIError) Is(target error) bool { return target == ErrAPI }

// errorFromResponse maps an HTTP status + parsed body to the right typed error.
func errorFromResponse(status int, body any) error {
	code := extractCode(body)
	msg := fmt.Sprintf("Pushfy API error (HTTP %d)", status)
	if code != "" {
		msg = "Pushfy API error: " + code
	}
	base := &PushfyError{Message: msg, Status: status, Code: code, Response: body}
	switch {
	case status == 401 || status == 403:
		return &AuthenticationError{base}
	case status == 429:
		base.Message = "Rate limited"
		return &RateLimitError{PushfyError: base}
	case status >= 400 && status < 500:
		return &InvalidRequestError{base}
	default:
		return &APIError{base}
	}
}

// extractCode pulls the "error" (or "code") field out of a decoded JSON object.
func extractCode(body any) string {
	m, ok := body.(map[string]any)
	if !ok {
		return ""
	}
	for _, k := range []string{"error", "code"} {
		if v, ok := m[k]; ok {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
		}
	}
	return ""
}
