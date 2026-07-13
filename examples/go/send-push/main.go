// Command send-push creates and dispatches a Push Notification campaign.
//
// Run:
//
//	PUSHFY_PUSH_KEY=... PUSHFY_PUSH_SECRET=... go run ./send-push
//
// The Push server API is HMAC-signed (pushKey/pushSecret) — the SDK signs each
// request for you. Server endpoints return raw JSON; unmarshal what you need.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/PushfyCpaaS/pushfy-go"
)

func main() {
	key := os.Getenv("PUSHFY_PUSH_KEY")
	secret := os.Getenv("PUSHFY_PUSH_SECRET")
	if key == "" || secret == "" {
		log.Fatal("set PUSHFY_PUSH_KEY and PUSHFY_PUSH_SECRET")
	}

	client := pushfy.New(pushfy.WithPushCredentials(key, secret))

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 1. Create the campaign. Server endpoints return json.RawMessage.
	raw, err := client.Push.Campaigns.Create(ctx, map[string]any{
		"name":  "Promo July",
		"title": "Flash sale",
		"body":  "50% off — today only",
		"url":   "https://example.com/promo",
	})
	if err != nil {
		log.Fatalf("create campaign failed: %v", err)
	}

	var campaign struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &campaign); err != nil {
		log.Fatalf("parse campaign: %v", err)
	}
	fmt.Println("created campaign:", campaign.ID)

	// 2. Dispatch it to the subscribed devices.
	if _, err := client.Push.Campaigns.Send(ctx, campaign.ID); err != nil {
		log.Fatalf("send campaign failed: %v", err)
	}
	fmt.Println("campaign sent")

	// 3. (Optional) read delivery/engagement metrics.
	metrics, err := client.Push.Campaigns.Metrics(ctx, campaign.ID)
	if err != nil {
		log.Fatalf("metrics failed: %v", err)
	}
	fmt.Println("metrics:", string(metrics))
}
