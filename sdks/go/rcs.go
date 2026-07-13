package pushfy

import "context"

// RCSResource sends RCS rich cards via the API RCS campaign.
type RCSResource struct{ c *Client }

// RCSMessage is a single RCS rich card. Optional fields are omitted when empty.
type RCSMessage struct {
	To    string
	Title string
	Text  string
	URL   string
	CTA   string
	Image string
	ExtID string
}

// Send sends one RCS rich card and returns the accepted messages.
func (r *RCSResource) Send(ctx context.Context, m RCSMessage) ([]MessageResult, error) {
	msg := apiMessage{
		Destinations: []apiDest{{To: onlyDigits(m.To)}},
		Text:         m.Text,
		Title:        m.Title,
		Image:        m.Image,
		URL:          m.URL,
		CTA:          m.CTA,
		ExtID:        m.ExtID,
	}
	var out []MessageResult
	err := r.c.classic(ctx, "POST", "/apircsnativo.php", classicOpts{json: messagesEnvelope{Messages: []apiMessage{msg}}}, &out)
	return out, err
}
