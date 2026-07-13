package pushfy

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Sign builds the canonical string and HMAC-SHA256 signature used by the Pushfy
// V2 API (Push server + Conversational AI). It must match the server exactly:
//
//	base      = timestamp + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)
//	signature = hex( HMAC-SHA256(base, secret) )
//
// path is the route only (e.g. "/v1/conversations"), without the query string.
// If timestamp <= 0 the current Unix time (seconds) is used. It returns the
// timestamp string that was signed and the hex signature.
func Sign(method, path, body, secret string, timestamp int64) (ts, signature string) {
	if timestamp <= 0 {
		timestamp = time.Now().Unix()
	}
	ts = strconv.FormatInt(timestamp, 10)

	bodyHash := sha256.Sum256([]byte(body))
	base := fmt.Sprintf("%s\n%s\n%s\n%s", ts, strings.ToUpper(method), path, hex.EncodeToString(bodyHash[:]))

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(base))
	return ts, hex.EncodeToString(mac.Sum(nil))
}
