package pushfy

import (
	"context"
	"encoding/json"
	"net/http"
)

// ConversationsResource is the Conversational AI (PushAgent) API. All calls are
// HMAC-signed with the PA credentials (X-PA-* headers).
type ConversationsResource struct{ c *Client }

// OpenConversation opens a conversation for a user.
type OpenConversation struct {
	UserExtID string
	Name      string
	Channel   string
}

type openBody struct {
	UserExtID string `json:"user_ext_id,omitempty"`
	Name      string `json:"name,omitempty"`
	Channel   string `json:"channel,omitempty"`
}

// Open opens a conversation and returns the raw API result (includes
// conversation_id).
func (r *ConversationsResource) Open(ctx context.Context, o OpenConversation) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.v2(ctx, http.MethodPost, "/v1/conversations", v2Opts{
		body: openBody{UserExtID: o.UserExtID, Name: o.Name, Channel: o.Channel},
		auth: authPA,
	}, &out)
	return out, err
}

// Get returns the current state of a conversation.
func (r *ConversationsResource) Get(ctx context.Context, id string) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.v2(ctx, http.MethodGet, "/v1/conversations/"+id, v2Opts{auth: authPA}, &out)
	return out, err
}

// Message sends a user message; the bot replies asynchronously.
func (r *ConversationsResource) Message(ctx context.Context, id, content string) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.v2(ctx, http.MethodPost, "/v1/conversations/"+id+"/messages", v2Opts{
		body: map[string]any{"content": content},
		auth: authPA,
	}, &out)
	return out, err
}

// Handoff escalates the conversation to a human agent.
func (r *ConversationsResource) Handoff(ctx context.Context, id string) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.v2(ctx, http.MethodPost, "/v1/conversations/"+id+"/handoff", v2Opts{body: map[string]any{}, auth: authPA}, &out)
	return out, err
}

// Close closes the conversation.
func (r *ConversationsResource) Close(ctx context.Context, id string) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.v2(ctx, http.MethodPost, "/v1/conversations/"+id+"/close", v2Opts{body: map[string]any{}, auth: authPA}, &out)
	return out, err
}

// EventsResource sends business events to Conversational AI (HMAC-signed).
type EventsResource struct{ c *Client }

// Event is a business event.
type Event struct {
	Type      string
	UserExtID string
	Data      any
}

type eventBody struct {
	Type      string `json:"type"`
	UserExtID string `json:"user_ext_id,omitempty"`
	Data      any    `json:"data,omitempty"`
}

// Send sends a business event.
func (r *EventsResource) Send(ctx context.Context, e Event) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.v2(ctx, http.MethodPost, "/v1/events", v2Opts{
		body: eventBody{Type: e.Type, UserExtID: e.UserExtID, Data: e.Data},
		auth: authPA,
	}, &out)
	return out, err
}

// TasksResource schedules follow-up tasks (HMAC-signed).
type TasksResource struct{ c *Client }

// ScheduleTask schedules a follow-up message. RunAt is an ISO/RFC3339 timestamp.
type ScheduleTask struct {
	ConversationID string
	RunAt          string
	Text           string
}

type taskBody struct {
	ConversationID string `json:"conversation_id,omitempty"`
	RunAt          string `json:"run_at,omitempty"`
	Text           string `json:"text,omitempty"`
}

// Schedule schedules a follow-up.
func (r *TasksResource) Schedule(ctx context.Context, t ScheduleTask) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.v2(ctx, http.MethodPost, "/v1/tasks", v2Opts{
		body: taskBody{ConversationID: t.ConversationID, RunAt: t.RunAt, Text: t.Text},
		auth: authPA,
	}, &out)
	return out, err
}
