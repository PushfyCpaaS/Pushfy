// Command send-voice uploads an audio file and places a voice call.
//
// Run:
//
//	PUSHFY_API_TOKEN=... AUDIO_FILE=./welcome.mp3 go run ./send-voice
//
// The flow is two steps: upload the .mp3 once to get an audio id, then place
// calls that reference it.
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
	token := os.Getenv("PUSHFY_API_TOKEN")
	if token == "" {
		log.Fatal("set PUSHFY_API_TOKEN")
	}
	audioPath := os.Getenv("AUDIO_FILE")
	if audioPath == "" {
		log.Fatal("set AUDIO_FILE to a path to an .mp3 file")
	}

	data, err := os.ReadFile(audioPath)
	if err != nil {
		log.Fatalf("read audio: %v", err)
	}

	client := pushfy.New(pushfy.WithAPIToken(token))

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// 1. Upload the audio. The raw result contains the audio id.
	raw, err := client.Voice.UploadAudio(ctx, pushfy.VoiceUpload{
		Name: "welcome",
		Data: data,
	})
	if err != nil {
		log.Fatalf("upload audio failed: %v", err)
	}

	var uploaded struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(raw, &uploaded); err != nil {
		log.Fatalf("parse upload result: %v", err)
	}
	fmt.Println("uploaded audio id:", uploaded.ID)

	// 2. Place the call referencing the uploaded audio id.
	res, err := client.Voice.Send(ctx, pushfy.VoiceCall{
		To:      "5511999999999",
		AudioID: uploaded.ID,
		ExtID:   "call-001",
	})
	if err != nil {
		log.Fatalf("voice call failed: %v", err)
	}

	for _, m := range res {
		fmt.Printf("call queued id=%s phone=%s ext_id=%s\n", m.ID, m.Phone, m.ExtID)
	}
}
