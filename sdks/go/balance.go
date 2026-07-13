package pushfy

import (
	"context"
	"encoding/json"
	"strconv"
)

// BalanceResource reads the account balance.
type BalanceResource struct{ c *Client }

// Balance is the parsed SMS balance. Raw is the server string (e.g. "1.500")
// and Amount is the integer value (1500).
type Balance struct {
	Raw    string
	Amount int64
}

type balanceResponse struct {
	Saldo json.Number `json:"saldo"`
}

// Get returns the SMS balance, parsing the formatted string ("1.500" -> 1500).
func (r *BalanceResource) Get(ctx context.Context) (*Balance, error) {
	var res balanceResponse
	if err := r.c.classic(ctx, "GET", "/balance", classicOpts{}, &res); err != nil {
		return nil, err
	}
	raw := res.Saldo.String()
	if raw == "" {
		return &Balance{Raw: "", Amount: 0}, nil
	}
	return &Balance{Raw: raw, Amount: parseBalance(raw)}, nil
}

// parseBalance strips every non-digit and parses the remainder ("1.500" -> 1500).
func parseBalance(raw string) int64 {
	digits := onlyDigits(raw)
	if digits == "" {
		return 0
	}
	n, err := strconv.ParseInt(digits, 10, 64)
	if err != nil {
		return 0
	}
	return n
}
