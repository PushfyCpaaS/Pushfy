// Command send-sms sends a single SMS with the Pushfy Go SDK.
//
// Run:
//
//	PUSHFY_API_TOKEN=... go run ./send-sms
//
// Credentials come from the environment — never hardcode secrets.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/PushfyCpaaS/pushfy-go"
)

func main() {
	token := os.Getenv("PUSHFY_API_TOKEN")
	if token == "" {
		log.Fatal("set PUSHFY_API_TOKEN")
	}

	client := pushfy.New(pushfy.WithAPIToken(token))

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// ExtID is YOUR reference for the message. Keep it stable and unique so you
	// can query the delivery status later and dedupe safely on retries.
	res, err := client.SMS.Send(ctx, pushfy.SMSMessage{
		To:    "5511999999999", // E.164 digits, no "+"
		Text:  "Hello from Pushfy",
		ExtID: "welcome-001",
	})
	if err != nil {
		log.Fatalf("send failed: %v", err)
	}

	// The API returns a slice: []MessageResult{{ID, Phone, Date, ExtID}}
	for _, m := range res {
		fmt.Printf("accepted id=%s phone=%s ext_id=%s\n", m.ID, m.Phone, m.ExtID)
	}
}
