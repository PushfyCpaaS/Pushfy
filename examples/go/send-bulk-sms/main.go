// Command send-bulk-sms sends several SMS in a single request.
//
// Run:
//
//	PUSHFY_API_TOKEN=... go run ./send-bulk-sms
//
// SendBulk accepts up to a few hundred messages per call. For very large lists
// split into chunks first — see ../batch-send.
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

	// Each message carries its own ExtID so you can reconcile results per row.
	messages := []pushfy.SMSMessage{
		{To: "5511999999999", Text: "Hi Ana", ExtID: "bulk-0001"},
		{To: "5511999999999", Text: "Hi Bruno", ExtID: "bulk-0002"},
		{To: "5511999999999", Text: "Hi Carla", ExtID: "bulk-0003"},
	}

	res, err := client.SMS.SendBulk(ctx, messages)
	if err != nil {
		log.Fatalf("bulk send failed: %v", err)
	}

	fmt.Printf("accepted %d message(s):\n", len(res))
	for _, m := range res {
		fmt.Printf("  id=%s phone=%s ext_id=%s\n", m.ID, m.Phone, m.ExtID)
	}
}
