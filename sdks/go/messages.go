package pushfy

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"strconv"
	"strings"
)

// MessageResult is one accepted message returned by the Messaging endpoints.
type MessageResult struct {
	ID    string `json:"id"`
	Phone string `json:"phone"`
	Date  string `json:"date"`
	ExtID string `json:"ext_id"`
}

// apiMessage is the wire format for a single Messaging message.
type apiMessage struct {
	Destinations []apiDest `json:"destinations"`
	Text         string    `json:"text"`
	ExtID        string    `json:"ext_id,omitempty"`
	Audio        string    `json:"audio,omitempty"`
	Title        string    `json:"title,omitempty"`
	Image        string    `json:"image,omitempty"`
	URL          string    `json:"url,omitempty"`
	CTA          string    `json:"cta,omitempty"`
}

type apiDest struct {
	To string `json:"to"`
}

type messagesEnvelope struct {
	Messages []apiMessage `json:"messages"`
}

// onlyDigits strips every non-digit rune (phone normalization).
func onlyDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// multipartForm carries an encoded multipart/form-data body.
type multipartForm struct {
	body        []byte
	contentType string
}

// MessagesResource exposes delivery status and reporting endpoints.
type MessagesResource struct{ c *Client }

// StatusQuery identifies a message by your ExtID (or the internal UID).
type StatusQuery struct {
	ExtID string
	UID   string
}

// Status returns the delivery status of one message. The response shape is
// endpoint-defined; unmarshal the raw JSON as you need.
func (r *MessagesResource) Status(ctx context.Context, q StatusQuery) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.classic(ctx, "GET", "/getstatus", classicOpts{
		query: map[string]string{"ext_id": q.ExtID, "uid": q.UID},
	}, &out)
	return out, err
}

// ByDate returns the status of every message on a given day (YYYY-MM-DD).
func (r *MessagesResource) ByDate(ctx context.Context, date string) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.classic(ctx, "GET", "/getdate", classicOpts{
		query: map[string]string{"date": date},
	}, &out)
	return out, err
}

// ReportQuery filters a report by date range. Limit/Offset are omitted when 0.
type ReportQuery struct {
	Date    string
	Start   string
	End     string
	Event   string
	Limit   int
	Offset  int
	DateDlr string
}

// Report returns a report by date range.
func (r *MessagesResource) Report(ctx context.Context, q ReportQuery) (json.RawMessage, error) {
	query := map[string]string{
		"date":     q.Date,
		"start":    q.Start,
		"end":      q.End,
		"event":    q.Event,
		"date_dlr": q.DateDlr,
	}
	if q.Limit > 0 {
		query["limit"] = strconv.Itoa(q.Limit)
	}
	if q.Offset > 0 {
		query["offset"] = strconv.Itoa(q.Offset)
	}
	var out json.RawMessage
	err := r.c.classic(ctx, "GET", "/reportbydate", classicOpts{query: query}, &out)
	return out, err
}

// buildMultipart encodes a single-file multipart form with the given fields.
func buildMultipart(fields map[string]string, fileField, filename, contentType string, data []byte) (*multipartForm, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for k, v := range fields {
		if err := w.WriteField(k, v); err != nil {
			return nil, err
		}
	}
	h := make(map[string][]string)
	h["Content-Disposition"] = []string{`form-data; name="` + fileField + `"; filename="` + filename + `"`}
	h["Content-Type"] = []string{contentType}
	part, err := w.CreatePart(h)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(data); err != nil {
		return nil, err
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return &multipartForm{body: buf.Bytes(), contentType: w.FormDataContentType()}, nil
}
