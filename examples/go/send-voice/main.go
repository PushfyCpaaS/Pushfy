// Command send-voice uploads an audio file and places a voice call.
//
// Run:
//
//	PUSHFY_API_TOKEN=... AUDIO_FILE=./welcome.mp3 go run ./send-voice
//
// The flow is two steps: upload the .mp3 once under a name, then place calls
// that reference it by that same name. The upload does NOT return an audio id.
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
	audioPath := os.Getenv("AUDIO_FILE")
	if audioPath == "" {
		log.Fatal("set AUDIO_FILE to a path to an .mp3 file")
	}

	// The name identifies the audio on both steps. Keep upload and call in sync.
	audioName := os.Getenv("AUDIO_NAME")
	if audioName == "" {
		audioName = "Welcome message"
	}

	data, err := os.ReadFile(audioPath)
	if err != nil {
		log.Fatalf("read audio: %v", err)
	}

	client := pushfy.New(pushfy.WithAPIToken(token))

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// 1. Upload the audio under audioName.
	if _, err := client.Voice.UploadAudio(ctx, pushfy.VoiceUpload{
		Name: audioName,
		Data: data,
	}); err != nil {
		log.Fatalf("upload audio failed: %v", err)
	}
	fmt.Println("uploaded audio:", audioName)

	// 2. Place the call referencing the audio by the same name.
	res, err := client.Voice.Send(ctx, pushfy.VoiceCall{
		To:        "5511999999999",
		AudioName: audioName,
		ExtID:     "call-001",
	})
	if err != nil {
		log.Fatalf("voice call failed: %v", err)
	}

	for _, m := range res {
		fmt.Printf("call queued id=%s phone=%s ext_id=%s\n", m.ID, m.Phone, m.ExtID)
	}
}
