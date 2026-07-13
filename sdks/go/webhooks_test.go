package pushfy

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func sig(secret, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

// TestVerifyRawVsPrefixed covers the two header schemes (raw X-PA vs sha256=).
func TestVerifyRawVsPrefixed(t *testing.T) {
	const (
		secret  = "WEBHOOK_SECRET"
		payload = `{"eid":"evt_1","event":"handoff.requested"}`
	)
	hexSig := sig(secret, payload)
	body := []byte(payload)

	// Conversational AI (raw hex) accepts the bare signature.
	if !VerifyConversations(body, hexSig, secret) {
		t.Error("VerifyConversations should accept raw hex signature")
	}
	// Push / Messaging accept the sha256= prefixed signature.
	if !VerifyPush(body, "sha256="+hexSig, secret) {
		t.Error("VerifyPush should accept sha256= prefixed signature")
	}
	if !VerifyMessaging(body, "sha256="+hexSig, secret) {
		t.Error("VerifyMessaging should accept sha256= prefixed signature")
	}
	// A prefixed scheme must reject a bare hex signature.
	if VerifyPush(body, hexSig, secret) {
		t.Error("VerifyPush must reject a bare hex signature (needs sha256= prefix)")
	}
	// And raw must reject a prefixed signature.
	if VerifyConversations(body, "sha256="+hexSig, secret) {
		t.Error("VerifyConversations must reject a sha256= prefixed signature")
	}
	// Wrong signature is rejected.
	if VerifyConversations(body, "deadbeef", secret) {
		t.Error("VerifyConversations must reject a wrong signature")
	}
	// Empty signature / secret are rejected.
	if Verify(body, "", secret, SchemeRaw) || Verify(body, hexSig, "", SchemeRaw) {
		t.Error("empty signature or secret must be rejected")
	}
}

// TestVerifyTamperedPayload ensures a modified body fails verification.
func TestVerifyTamperedPayload(t *testing.T) {
	const secret = "s3cr3t"
	hexSig := sig(secret, `{"a":1}`)
	if VerifyConversations([]byte(`{"a":2}`), hexSig, secret) {
		t.Error("tampered payload must not verify")
	}
}

// TestParseBalance covers the "1.500" -> 1500 normalization.
func TestParseBalance(t *testing.T) {
	cases := map[string]int64{
		"1.500":     1500,
		"1500":      1500,
		"1.234.567": 1234567,
		"0":         0,
		"":          0,
		"R$ 2.000":  2000,
	}
	for in, want := range cases {
		if got := parseBalance(in); got != want {
			t.Errorf("parseBalance(%q) = %d, want %d", in, got, want)
		}
	}
}
