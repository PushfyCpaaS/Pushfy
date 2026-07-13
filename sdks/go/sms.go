package pushfy

import "context"

// SMSResource sends SMS messages via the Messaging API.
type SMSResource struct{ c *Client }

// SMSMessage is a single SMS to send. To is normalized to digits only.
type SMSMessage struct {
	To    string
	Text  string
	ExtID string
}

func (m SMSMessage) toAPI() apiMessage {
	return apiMessage{
		Destinations: []apiDest{{To: onlyDigits(m.To)}},
		Text:         m.Text,
		ExtID:        m.ExtID,
	}
}

// Send sends a single SMS and returns the accepted messages.
func (r *SMSResource) Send(ctx context.Context, m SMSMessage) ([]MessageResult, error) {
	return r.SendBulk(ctx, []SMSMessage{m})
}

// SendBulk sends many SMS in one request.
func (r *SMSResource) SendBulk(ctx context.Context, list []SMSMessage) ([]MessageResult, error) {
	msgs := make([]apiMessage, len(list))
	for i, m := range list {
		msgs[i] = m.toAPI()
	}
	var out []MessageResult
	err := r.c.classic(ctx, "POST", "/webapi", classicOpts{json: messagesEnvelope{Messages: msgs}}, &out)
	return out, err
}
