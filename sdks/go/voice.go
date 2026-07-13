package pushfy

import (
	"context"
	"encoding/json"
)

// VoiceResource uploads audio and places voice calls.
type VoiceResource struct{ c *Client }

// VoiceUpload is a voice audio (.mp3) to upload. Filename defaults to
// "audio.mp3" when empty.
type VoiceUpload struct {
	Name     string
	Data     []byte
	Filename string
}

// UploadAudio uploads an audio file and returns the raw API result (which
// includes the audio id you pass to Send).
func (r *VoiceResource) UploadAudio(ctx context.Context, u VoiceUpload) (json.RawMessage, error) {
	filename := u.Filename
	if filename == "" {
		filename = "audio.mp3"
	}
	name := u.Name
	if name == "" {
		name = filename
	}
	form, err := buildMultipart(
		map[string]string{"nome": name},
		"audio", filename, "audio/mpeg", u.Data,
	)
	if err != nil {
		return nil, &InvalidRequestError{&PushfyError{Message: "build multipart: " + err.Error()}}
	}
	var out json.RawMessage
	err = r.c.classic(ctx, "POST", "/audio", classicOpts{form: form}, &out)
	return out, err
}

// VoiceCall places a call referencing a previously uploaded audio id.
type VoiceCall struct {
	To      string
	AudioID string
	ExtID   string
}

// Send places a voice call and returns the accepted messages.
func (r *VoiceResource) Send(ctx context.Context, call VoiceCall) ([]MessageResult, error) {
	msg := apiMessage{
		Destinations: []apiDest{{To: onlyDigits(call.To)}},
		Text:         "",
		ExtID:        call.ExtID,
		Audio:        call.AudioID,
	}
	var out []MessageResult
	err := r.c.classic(ctx, "POST", "/webapi", classicOpts{json: messagesEnvelope{Messages: []apiMessage{msg}}}, &out)
	return out, err
}
