package pushfy

import (
	"context"
	"encoding/json"
	"net/http"
)

// PushResource is the Push Notifications API (server + public endpoints).
type PushResource struct {
	c *Client

	Devices   *PushDevices
	Campaigns *PushCampaigns
	Segments  *PushSegments
}

func newPushResource(c *Client) *PushResource {
	return &PushResource{
		c:         c,
		Devices:   &PushDevices{c: c},
		Campaigns: &PushCampaigns{c: c},
		Segments:  &PushSegments{c: c},
	}
}

// Test sends a test push (server, HMAC-signed).
func (r *PushResource) Test(ctx context.Context, body any) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.v2(ctx, http.MethodPost, "/v1/push/test", v2Opts{body: body, auth: authPush}, &out)
	return out, err
}

// Subscribe registers a device from a browser/app (public). The configured
// AppID is injected automatically.
func (r *PushResource) Subscribe(ctx context.Context, body map[string]any) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.v2(ctx, http.MethodPost, "/v1/push/subscribe", v2Opts{body: withAppID(r.c.cfg.AppID, body), auth: authPublic}, &out)
	return out, err
}

// Track reports a public device event. The configured AppID is injected.
func (r *PushResource) Track(ctx context.Context, body map[string]any) (json.RawMessage, error) {
	var out json.RawMessage
	err := r.c.v2(ctx, http.MethodPost, "/v1/push/track", v2Opts{body: withAppID(r.c.cfg.AppID, body), auth: authPublic}, &out)
	return out, err
}

func withAppID(appID string, body map[string]any) map[string]any {
	out := map[string]any{"app_id": appID}
	for k, v := range body {
		out[k] = v
	}
	return out
}

// PushDevices manages registered devices (server, HMAC-signed).
type PushDevices struct{ c *Client }

func (d *PushDevices) List(ctx context.Context, query map[string]string) (json.RawMessage, error) {
	var out json.RawMessage
	err := d.c.v2(ctx, http.MethodGet, "/v1/push/devices", v2Opts{query: query, auth: authPush}, &out)
	return out, err
}

func (d *PushDevices) Register(ctx context.Context, body any) (json.RawMessage, error) {
	var out json.RawMessage
	err := d.c.v2(ctx, http.MethodPost, "/v1/push/devices", v2Opts{body: body, auth: authPush}, &out)
	return out, err
}

func (d *PushDevices) Remove(ctx context.Context, id string) (json.RawMessage, error) {
	var out json.RawMessage
	err := d.c.v2(ctx, http.MethodDelete, "/v1/push/devices/"+id, v2Opts{auth: authPush}, &out)
	return out, err
}

// PushCampaigns manages push campaigns (server, HMAC-signed).
type PushCampaigns struct{ c *Client }

func (p *PushCampaigns) List(ctx context.Context, query map[string]string) (json.RawMessage, error) {
	var out json.RawMessage
	err := p.c.v2(ctx, http.MethodGet, "/v1/push/campaigns", v2Opts{query: query, auth: authPush}, &out)
	return out, err
}

func (p *PushCampaigns) Create(ctx context.Context, body any) (json.RawMessage, error) {
	var out json.RawMessage
	err := p.c.v2(ctx, http.MethodPost, "/v1/push/campaigns", v2Opts{body: body, auth: authPush}, &out)
	return out, err
}

func (p *PushCampaigns) Get(ctx context.Context, id string) (json.RawMessage, error) {
	var out json.RawMessage
	err := p.c.v2(ctx, http.MethodGet, "/v1/push/campaigns/"+id, v2Opts{auth: authPush}, &out)
	return out, err
}

func (p *PushCampaigns) Update(ctx context.Context, id string, body any) (json.RawMessage, error) {
	var out json.RawMessage
	err := p.c.v2(ctx, http.MethodPatch, "/v1/push/campaigns/"+id, v2Opts{body: body, auth: authPush}, &out)
	return out, err
}

func (p *PushCampaigns) Send(ctx context.Context, id string) (json.RawMessage, error) {
	var out json.RawMessage
	err := p.c.v2(ctx, http.MethodPost, "/v1/push/campaigns/"+id+"/send", v2Opts{body: map[string]any{}, auth: authPush}, &out)
	return out, err
}

func (p *PushCampaigns) Metrics(ctx context.Context, id string) (json.RawMessage, error) {
	var out json.RawMessage
	err := p.c.v2(ctx, http.MethodGet, "/v1/push/campaigns/"+id+"/metrics", v2Opts{auth: authPush}, &out)
	return out, err
}

// PushSegments manages push audience segments (server, HMAC-signed).
type PushSegments struct{ c *Client }

func (s *PushSegments) List(ctx context.Context, query map[string]string) (json.RawMessage, error) {
	var out json.RawMessage
	err := s.c.v2(ctx, http.MethodGet, "/v1/push/segments", v2Opts{query: query, auth: authPush}, &out)
	return out, err
}

func (s *PushSegments) Create(ctx context.Context, body any) (json.RawMessage, error) {
	var out json.RawMessage
	err := s.c.v2(ctx, http.MethodPost, "/v1/push/segments", v2Opts{body: body, auth: authPush}, &out)
	return out, err
}
