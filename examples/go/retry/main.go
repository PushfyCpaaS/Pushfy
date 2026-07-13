// Command retry sends an SMS with idempotent exponential backoff.
//
// Run:
//
//	PUSHFY_API_TOKEN=... go run ./retry
//
// Only retry errors that are safe to retry: transient API/network failures
// (ErrAPI) and rate limits (ErrRateLimit). Reuse the SAME ExtID on every attempt
// so a message that actually went through is not duplicated (and not
// double-charged). Never retry ErrInvalidRequest/ErrAuthentication — they will
// never succeed on retry.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	"github.com/PushfyCpaaS/pushfy-go"
)

const (
	maxAttempts = 5
	baseDelay   = 500 * time.Millisecond
	maxDelay    = 10 * time.Second
)

func main() {
	token := os.Getenv("PUSHFY_API_TOKEN")
	if token == "" {
		log.Fatal("set PUSHFY_API_TOKEN")
	}

	client := pushfy.New(pushfy.WithAPIToken(token))

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	// The ExtID is fixed across every attempt — that is what makes the retry
	// idempotent.
	msg := pushfy.SMSMessage{
		To:    "5511999999999",
		Text:  "Hello from Pushfy (with retry)",
		ExtID: "retry-idem-001",
	}

	res, err := sendWithRetry(ctx, client, msg)
	if err != nil {
		log.Fatalf("giving up: %v", err)
	}
	fmt.Printf("accepted %d message(s)\n", len(res))
}

func sendWithRetry(ctx context.Context, client *pushfy.Client, msg pushfy.SMSMessage) ([]pushfy.MessageResult, error) {
	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		res, err := client.SMS.Send(ctx, msg)
		if err == nil {
			return res, nil
		}
		lastErr = err

		if !retryable(err) {
			return nil, err // permanent — do not resend
		}
		if attempt == maxAttempts {
			break
		}

		delay := backoff(attempt, err)
		log.Printf("attempt %d failed (%v); retrying in %s", attempt, err, delay)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}
	}
	return nil, fmt.Errorf("exhausted %d attempts: %w", maxAttempts, lastErr)
}

// retryable reports whether the error is safe to retry idempotently.
func retryable(err error) bool {
	return errors.Is(err, pushfy.ErrAPI) || errors.Is(err, pushfy.ErrRateLimit)
}

// backoff returns the delay before the next attempt: it honours a server-sent
// Retry-After when present, otherwise exponential backoff with jitter, capped.
func backoff(attempt int, err error) time.Duration {
	var rl *pushfy.RateLimitError
	if errors.As(err, &rl) && rl.RetryAfter > 0 {
		return time.Duration(rl.RetryAfter) * time.Second
	}

	// baseDelay * 2^(attempt-1), capped at maxDelay, plus up to 250ms jitter.
	d := baseDelay << (attempt - 1)
	if d > maxDelay {
		d = maxDelay
	}
	return d + time.Duration(rand.Intn(250))*time.Millisecond
}
