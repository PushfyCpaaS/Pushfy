// Command send-rcs sends an RCS rich card.
//
// Run:
//
//	PUSHFY_API_TOKEN=... go run ./send-rcs
//
// Optional fields (Image, URL, CTA) are omitted from the wire payload when empty.
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

	res, err := client.RCS.Send(ctx, pushfy.RCSMessage{
		To:    "5511999999999",
		Title: "Order shipped",
		Text:  "Your order #1042 is on the way",
		Image: "https://cdn.example.com/box.jpg",
		URL:   "https://example.com/track/1042",
		CTA:   "Track order",
		ExtID: "rcs-1042",
	})
	if err != nil {
		log.Fatalf("rcs send failed: %v", err)
	}

	for _, m := range res {
		fmt.Printf("accepted id=%s phone=%s ext_id=%s\n", m.ID, m.Phone, m.ExtID)
	}
}
