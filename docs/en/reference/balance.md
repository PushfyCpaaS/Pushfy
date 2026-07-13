# Balance

Read your current SMS balance.

- **URL** — `https://portal.pushfy.com/balance`
- **Method** — `GET`
- **Auth** — Bearer (main account token) **or** Basic (login + password) ([Authentication](./authentication.md))

## Headers

```
Authorization: Bearer YOUR_API_TOKEN
```

Basic auth (`login:password`) is also accepted.

## Request

```bash
curl 'https://portal.pushfy.com/balance' \
  -H 'Authorization: Bearer YOUR_API_TOKEN'
```

## Response

`200 OK`:

```json
{
  "saldo": "1.500"
}
```

- `saldo` — the **SMS balance**, as a formatted string with a thousands separator
  (`"1.500"` means one thousand five hundred). Parse it accordingly before doing math.

## Notes

- **Main token or Basic only.** `/balance` accepts **only** your account's main Bearer token
  or Basic (login + password). Secondary multi-tokens are **not** accepted here — use the main
  credential to read balance. See [Authentication](./authentication.md).
- **SMS only.** `saldo` is the SMS balance. There is **no public voice-balance endpoint**;
  the legacy `/balancetvoz` returns `404`.
- **Formatted string.** The value is a display string, not a raw number — strip the thousands
  separator before parsing.

See [Errors & rate limits](./errors.md).
