// Send an SMS with the Pushfy Go SDK.
//
//	PUSHFY_API_TOKEN=... go run ./examples/send_sms
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/PushfyCpaaS/pushfy-go"
)

func main() {
	client := pushfy.New(pushfy.WithAPIToken(os.Getenv("PUSHFY_API_TOKEN")))

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	res, err := client.SMS.Send(ctx, pushfy.SMSMessage{
		To:    "5511999999999",
		Text:  "Hello from the Pushfy Go SDK",
		ExtID: fmt.Sprintf("demo-%d", time.Now().Unix()),
	})
	if err != nil {
		var rl *pushfy.RateLimitError
		switch {
		case errors.As(err, &rl):
			fmt.Fprintln(os.Stderr, "Rate limited — back off and retry.")
		case errors.Is(err, pushfy.ErrAuthentication):
			fmt.Fprintln(os.Stderr, "Check your API token.")
		default:
			fmt.Fprintln(os.Stderr, "Failed:", err)
		}
		os.Exit(1)
	}

	fmt.Printf("Accepted: %+v\n", res)
}
