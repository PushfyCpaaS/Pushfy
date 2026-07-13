package pushfy

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

// Scheme selects how the incoming signature header is formatted.
type Scheme int

const (
	// SchemePrefixed expects "sha256=<hex>" (Messaging status/DLR and Push
	// Notifications: X-Pushfy-Signature / X-Push-Signature).
	SchemePrefixed Scheme = iota
	// SchemeRaw expects a bare "<hex>" (Conversational AI: X-PA-Signature).
	SchemeRaw
)

// Verify checks the authenticity of an incoming Pushfy webhook.
//
// Always pass the RAW request body (the exact bytes received), not a
// re-serialized object — re-serialization changes the signature. The comparison
// is constant-time (crypto/hmac.Equal).
func Verify(payload []byte, signature, secret string, scheme Scheme) bool {
	if signature == "" || secret == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	sum := hex.EncodeToString(mac.Sum(nil))

	expected := sum
	if scheme == SchemePrefixed {
		expected = "sha256=" + sum
	}
	return hmac.Equal([]byte(expected), []byte(signature))
}

// VerifyMessaging verifies a Messaging status/DLR webhook (X-Pushfy-Signature,
// "sha256=" prefixed).
func VerifyMessaging(payload []byte, signature, secret string) bool {
	return Verify(payload, signature, secret, SchemePrefixed)
}

// VerifyPush verifies a Push Notifications webhook (X-Push-Signature, "sha256="
// prefixed).
func VerifyPush(payload []byte, signature, secret string) bool {
	return Verify(payload, signature, secret, SchemePrefixed)
}

// VerifyConversations verifies a Conversational AI / PushAgent webhook
// (X-PA-Signature, raw hex).
func VerifyConversations(payload []byte, signature, secret string) bool {
	return Verify(payload, signature, secret, SchemeRaw)
}
