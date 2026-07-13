// Command receive-webhook serves a Pushfy status/DLR webhook endpoint and
// verifies the HMAC signature before trusting the payload.
//
// Run:
//
//	PUSHFY_WEBHOOK_SECRET=... go run ./receive-webhook
//
// Then point your Pushfy status webhook at http://your-host:8080/webhooks/pushfy
//
// Rules:
//   - Verify against the RAW request body (the exact bytes received). Never
//     re-serialize before verifying — it changes the signature.
//   - Respond fast (2xx) and process asynchronously.
package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/PushfyCpaaS/pushfy-go"
)

func main() {
	secret := os.Getenv("PUSHFY_WEBHOOK_SECRET")
	if secret == "" {
		log.Fatal("set PUSHFY_WEBHOOK_SECRET")
	}

	http.HandleFunc("/webhooks/pushfy", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// Read the raw bytes — do not decode-then-re-encode before verifying.
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// Constant-time signature check for the Messaging status/DLR webhook.
		if !pushfy.VerifyMessaging(body, r.Header.Get("X-Pushfy-Signature"), secret) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		// Acknowledge immediately; hand the payload off to a worker.
		w.WriteHeader(http.StatusOK)
		go process(body)
	})

	addr := ":8080"
	log.Println("listening on", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

// process handles a verified webhook payload out of the request path.
func process(body []byte) {
	var event map[string]any
	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("invalid webhook json: %v", err)
		return
	}
	log.Printf("verified webhook: %v", event)
}
