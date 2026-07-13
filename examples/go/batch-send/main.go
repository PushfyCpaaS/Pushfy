// Command batch-send delivers a large list of SMS by splitting it into chunks
// and calling SendBulk once per chunk.
//
// Run:
//
//	PUSHFY_API_TOKEN=... go run ./batch-send
//
// SendBulk takes many messages per request, but a single call should stay within
// a sane size. Chunking keeps each request bounded and lets you pace / recover
// per chunk. Each message keeps its own stable ExtID so a failed chunk can be
// safely resent without duplicating the chunks that already went through.
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/PushfyCpaaS/pushfy-go"
)

const chunkSize = 100

func main() {
	token := os.Getenv("PUSHFY_API_TOKEN")
	if token == "" {
		log.Fatal("set PUSHFY_API_TOKEN")
	}

	client := pushfy.New(pushfy.WithAPIToken(token))

	// Build a demo list. In practice this comes from your database / CSV.
	all := make([]pushfy.SMSMessage, 0, 250)
	for i := 0; i < 250; i++ {
		all = append(all, pushfy.SMSMessage{
			To:    "5511999999999",
			Text:  "Hello from Pushfy",
			ExtID: fmt.Sprintf("campaign-42-%04d", i), // stable, unique per row
		})
	}

	var accepted int
	for i, chunk := range chunks(all, chunkSize) {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		res, err := client.SMS.SendBulk(ctx, chunk)
		cancel()
		if err != nil {
			// This chunk failed. Because ExtIDs are stable you can safely retry
			// just this chunk later without duplicating earlier ones.
			log.Fatalf("chunk %d (%d msgs) failed: %v", i, len(chunk), err)
		}
		accepted += len(res)
		log.Printf("chunk %d: accepted %d/%d", i, len(res), len(chunk))
	}

	fmt.Printf("done: %d/%d messages accepted\n", accepted, len(all))
}

// chunks splits s into consecutive slices of at most size elements. The returned
// slices share s's backing array (no copy).
func chunks[T any](s []T, size int) [][]T {
	if size <= 0 {
		return [][]T{s}
	}
	var out [][]T
	for i := 0; i < len(s); i += size {
		end := i + size
		if end > len(s) {
			end = len(s)
		}
		out = append(out, s[i:end])
	}
	return out
}
