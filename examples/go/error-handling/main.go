// Command error-handling shows how to branch on Pushfy's typed errors using
// errors.Is (sentinels) and errors.As (typed, for fields).
//
// Run:
//
//	PUSHFY_API_TOKEN=... go run ./error-handling
//
// Use errors.Is for coarse control flow and errors.As when you need fields such
// as Status, Code, Response or RateLimitError.RetryAfter.
package main

import (
	"context"
	"errors"
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

	res, err := client.SMS.Send(ctx, pushfy.SMSMessage{
		To:    "5511999999999",
		Text:  "Hello from Pushfy",
		ExtID: "err-demo-001",
	})
	if err != nil {
		handle(err)
		os.Exit(1)
	}

	fmt.Printf("accepted %d message(s)\n", len(res))
}

// handle classifies a Pushfy error and reacts accordingly.
func handle(err error) {
	// 1. Coarse branching with the sentinels via errors.Is.
	switch {
	case errors.Is(err, pushfy.ErrAuthentication):
		log.Println("auth error — check PUSHFY_API_TOKEN")
	case errors.Is(err, pushfy.ErrRateLimit):
		log.Println("rate limited — back off and retry")
	case errors.Is(err, pushfy.ErrInvalidRequest):
		log.Println("invalid request — fix the payload; retrying won't help")
	case errors.Is(err, pushfy.ErrAPI):
		log.Println("api/network error — safe to retry idempotently (reuse ExtID)")
	default:
		log.Println("unexpected error:", err)
	}

	// 2. Pull structured fields with errors.As.

	// RateLimitError exposes RetryAfter (seconds).
	var rl *pushfy.RateLimitError
	if errors.As(err, &rl) {
		log.Printf("retry after %d second(s)", rl.RetryAfter)
	}

	// Every typed error embeds *PushfyError, so this target unwraps any of them.
	var pe *pushfy.PushfyError
	if errors.As(err, &pe) {
		log.Printf("details: status=%d code=%q response=%v", pe.Status, pe.Code, pe.Response)
	}
}
