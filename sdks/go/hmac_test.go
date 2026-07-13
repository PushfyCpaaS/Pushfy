package pushfy

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
)

// TestSignMatchesCanonicalRecipe verifies the signature equals
// HMAC-SHA256(ts + "\n" + METHOD + "\n" + route + "\n" + sha256hex(body)).
func TestSignMatchesCanonicalRecipe(t *testing.T) {
	const (
		ts     = int64(1752345600)
		body   = `{"user_ext_id":"user-42"}`
		secret = "pas_test"
		route  = "/v1/conversations"
	)

	gotTS, gotSig := Sign("post", route, body, secret, ts)
	if gotTS != "1752345600" {
		t.Fatalf("timestamp = %q, want 1752345600", gotTS)
	}

	bodyHash := sha256.Sum256([]byte(body))
	base := fmt.Sprintf("%d\nPOST\n%s\n%s", ts, route, hex.EncodeToString(bodyHash[:]))
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(base))
	want := hex.EncodeToString(mac.Sum(nil))

	if gotSig != want {
		t.Fatalf("signature = %q, want %q", gotSig, want)
	}
}

// TestSignUppercasesMethod ensures the method is upper-cased in the base string.
func TestSignUppercasesMethod(t *testing.T) {
	_, lower := Sign("get", "/v1/conversations/1", "", "s", 42)
	_, upper := Sign("GET", "/v1/conversations/1", "", "s", 42)
	if lower != upper {
		t.Fatalf("method casing changed the signature: %q vs %q", lower, upper)
	}
}

// TestSignEmptyBodyHash checks the empty-body hash is used for GET requests.
func TestSignEmptyBodyHash(t *testing.T) {
	const ts = int64(100)
	_, got := Sign("GET", "/v1/push/campaigns", "", "sec", ts)

	emptyHash := sha256.Sum256([]byte(""))
	base := fmt.Sprintf("%d\nGET\n/v1/push/campaigns\n%s", ts, hex.EncodeToString(emptyHash[:]))
	mac := hmac.New(sha256.New, []byte("sec"))
	mac.Write([]byte(base))
	want := hex.EncodeToString(mac.Sum(nil))

	if got != want {
		t.Fatalf("signature = %q, want %q", got, want)
	}
}

// TestSignDefaultTimestamp ensures a non-positive timestamp is replaced by now.
func TestSignDefaultTimestamp(t *testing.T) {
	ts, _ := Sign("POST", "/v1/events", "{}", "sec", 0)
	if ts == "" || ts == "0" {
		t.Fatalf("expected a generated timestamp, got %q", ts)
	}
}
