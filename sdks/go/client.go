// Package pushfy is the official Go client for the Pushfy API — SMS, RCS, Voice,
// Push Notifications and Conversational AI (PushAgent).
//
// It depends only on the standard library.
//
//	c := pushfy.New(pushfy.WithAPIToken("YOUR_API_TOKEN"))
//	res, err := c.SMS.Send(ctx, pushfy.SMSMessage{To: "5511999999999", Text: "Hello"})
package pushfy

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultBaseURL = "https://portal.pushfy.com"
	defaultV2Path  = "/v2/api.php"
	defaultTimeout = 30 * time.Second
)

// Config holds the client credentials and transport settings. Every field is
// optional — supply only the credentials for the products you use. Prefer the
// functional Options with New, or build a Config and pass it to NewWithConfig.
type Config struct {
	APIToken   string // Messaging Bearer token (SMS/RCS/Voice, status, balance).
	PAKey      string // Conversational AI HMAC key (pak_...).
	PASecret   string // Conversational AI HMAC secret (pas_...).
	PushKey    string // Push server HMAC key (pushk_...).
	PushSecret string // Push server HMAC secret (pss_...).
	AppID      string // Public Push app id (pushapp_...).
	BaseURL    string // Defaults to https://portal.pushfy.com.
	V2Path     string // Defaults to /v2/api.php.
	Timeout    time.Duration
	HTTPClient *http.Client // Custom client (e.g. for tests). Defaults to a new one.
}

// Option configures a Config passed to New.
type Option func(*Config)

// WithAPIToken sets the Messaging Bearer token.
func WithAPIToken(token string) Option { return func(c *Config) { c.APIToken = token } }

// WithPACredentials sets the Conversational AI HMAC key/secret.
func WithPACredentials(key, secret string) Option {
	return func(c *Config) { c.PAKey, c.PASecret = key, secret }
}

// WithPushCredentials sets the Push server HMAC key/secret.
func WithPushCredentials(key, secret string) Option {
	return func(c *Config) { c.PushKey, c.PushSecret = key, secret }
}

// WithAppID sets the public Push app id used by subscribe/track.
func WithAppID(appID string) Option { return func(c *Config) { c.AppID = appID } }

// WithBaseURL overrides the API base URL.
func WithBaseURL(baseURL string) Option { return func(c *Config) { c.BaseURL = baseURL } }

// WithTimeout sets the per-request timeout.
func WithTimeout(d time.Duration) Option { return func(c *Config) { c.Timeout = d } }

// WithHTTPClient injects a custom *http.Client.
func WithHTTPClient(hc *http.Client) Option { return func(c *Config) { c.HTTPClient = hc } }

// Client is the Pushfy API client. Create it with New and reuse it; it is safe
// for concurrent use.
type Client struct {
	cfg  Config
	http *http.Client

	SMS           *SMSResource
	RCS           *RCSResource
	Voice         *VoiceResource
	Messages      *MessagesResource
	Balance       *BalanceResource
	Push          *PushResource
	Conversations *ConversationsResource
	Events        *EventsResource
	Tasks         *TasksResource
}

// New builds a Client from functional options.
func New(opts ...Option) *Client {
	var cfg Config
	for _, o := range opts {
		o(&cfg)
	}
	return NewWithConfig(cfg)
}

// NewWithConfig builds a Client from an explicit Config.
func NewWithConfig(cfg Config) *Client {
	if cfg.BaseURL == "" {
		cfg.BaseURL = defaultBaseURL
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	if cfg.V2Path == "" {
		cfg.V2Path = defaultV2Path
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = defaultTimeout
	}
	hc := cfg.HTTPClient
	if hc == nil {
		hc = &http.Client{Timeout: cfg.Timeout}
	}
	c := &Client{cfg: cfg, http: hc}
	c.SMS = &SMSResource{c: c}
	c.RCS = &RCSResource{c: c}
	c.Voice = &VoiceResource{c: c}
	c.Messages = &MessagesResource{c: c}
	c.Balance = &BalanceResource{c: c}
	c.Push = newPushResource(c)
	c.Conversations = &ConversationsResource{c: c}
	c.Events = &EventsResource{c: c}
	c.Tasks = &TasksResource{c: c}
	return c
}

// ---- low-level transport ---------------------------------------------------

// auth selects which credential set signs a V2 request.
type auth int

const (
	authNone auth = iota
	authPA
	authPush
	authPublic
)

// do executes the request and returns the raw response body on 2xx, or a typed
// error otherwise.
func (c *Client) do(ctx context.Context, method, rawURL string, headers map[string]string, body []byte) (json.RawMessage, error) {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, rawURL, reader)
	if err != nil {
		return nil, &InvalidRequestError{&PushfyError{Message: "invalid request: " + err.Error()}}
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, &APIError{&PushfyError{Message: "Network error: " + err.Error(), Status: 0}}
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var parsed any
		if len(respBytes) > 0 {
			if json.Unmarshal(respBytes, &parsed) != nil {
				parsed = map[string]any{"raw": string(respBytes)}
			}
		}
		return nil, errorFromResponse(resp.StatusCode, parsed)
	}
	return json.RawMessage(respBytes), nil
}

// classicOpts are the options for a Messaging (classic) request.
type classicOpts struct {
	json  any               // JSON body.
	form  *multipartForm    // multipart/form-data body (mutually exclusive with json).
	query map[string]string // query params; empty values are skipped.
}

// classic performs a Messaging request against https://portal.pushfy.com/<path>.
func (c *Client) classic(ctx context.Context, method, path string, opt classicOpts, out any) error {
	u := c.cfg.BaseURL + path
	if len(opt.query) > 0 {
		vals := url.Values{}
		for k, v := range opt.query {
			if v != "" {
				vals.Set(k, v)
			}
		}
		if enc := vals.Encode(); enc != "" {
			if strings.Contains(path, "?") {
				u += "&" + enc
			} else {
				u += "?" + enc
			}
		}
	}

	headers := map[string]string{}
	if c.cfg.APIToken != "" {
		headers["Authorization"] = "Bearer " + c.cfg.APIToken
	}

	var body []byte
	switch {
	case opt.form != nil:
		headers["Content-Type"] = opt.form.contentType
		body = opt.form.body
	case opt.json != nil:
		b, err := json.Marshal(opt.json)
		if err != nil {
			return &InvalidRequestError{&PushfyError{Message: "encode body: " + err.Error()}}
		}
		headers["Content-Type"] = "application/json"
		body = b
	}

	raw, err := c.do(ctx, method, u, headers, body)
	if err != nil {
		return err
	}
	return decodeInto(raw, out)
}

// v2Opts are the options for a V2 (Push / Conversational AI) request.
type v2Opts struct {
	body  any
	query map[string]string
	auth  auth
}

// v2 performs a V2 request via ?r=<route> with the appropriate HMAC/app_id auth.
func (c *Client) v2(ctx context.Context, method, route string, opt v2Opts, out any) error {
	vals := url.Values{}
	vals.Set("r", route)
	for k, v := range opt.query {
		if v != "" {
			vals.Set(k, v)
		}
	}
	u := c.cfg.BaseURL + c.cfg.V2Path + "?" + vals.Encode()

	var bodyStr string
	if opt.body != nil && method != http.MethodGet {
		b, err := json.Marshal(opt.body)
		if err != nil {
			return &InvalidRequestError{&PushfyError{Message: "encode body: " + err.Error()}}
		}
		bodyStr = string(b)
	}

	headers := map[string]string{}
	if bodyStr != "" {
		headers["Content-Type"] = "application/json"
	}

	switch opt.auth {
	case authPA:
		if c.cfg.PAKey == "" || c.cfg.PASecret == "" {
			return &AuthenticationError{&PushfyError{Message: "paKey/paSecret required for Conversational AI"}}
		}
		ts, sig := Sign(method, route, bodyStr, c.cfg.PASecret, 0)
		headers["X-PA-Key"] = c.cfg.PAKey
		headers["X-PA-Timestamp"] = ts
		headers["X-PA-Signature"] = sig
	case authPush:
		if c.cfg.PushKey == "" || c.cfg.PushSecret == "" {
			return &AuthenticationError{&PushfyError{Message: "pushKey/pushSecret required for Push server API"}}
		}
		ts, sig := Sign(method, route, bodyStr, c.cfg.PushSecret, 0)
		headers["X-PUSH-Key"] = c.cfg.PushKey
		headers["X-PUSH-Timestamp"] = ts
		headers["X-PUSH-Signature"] = sig
	}

	var body []byte
	if bodyStr != "" {
		body = []byte(bodyStr)
	}
	raw, err := c.do(ctx, method, u, headers, body)
	if err != nil {
		return err
	}
	return decodeInto(raw, out)
}

// decodeInto unmarshals raw into out unless out is nil or the body is empty.
func decodeInto(raw json.RawMessage, out any) error {
	if out == nil || len(raw) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return &APIError{&PushfyError{Message: "decode response: " + err.Error()}}
	}
	return nil
}
