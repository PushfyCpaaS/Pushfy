# Examples

Runnable examples for every official Pushfy SDK. Each language folder contains the same nine
scenarios plus its own README with setup and run instructions.

| Language | Folder |
|---|---|
| Node.js | [`node/`](./node/) |
| TypeScript | [`typescript/`](./typescript/) |
| PHP | [`php/`](./php/) |
| Python | [`python/`](./python/) |
| Java | [`java/`](./java/) |
| C# / .NET | [`dotnet/`](./dotnet/) |
| Go | [`go/`](./go/) |
| Ruby | [`ruby/`](./ruby/) |

## Scenarios

| Scenario | What it shows |
|---|---|
| **Send SMS** | Send a single text message |
| **Send Bulk SMS** | Many messages in one request |
| **Send RCS** | A rich RCS card (title, image, buttons) |
| **Send Push** | Create → send → read metrics for a push campaign |
| **Send Voice** | Upload an audio and place a voice call |
| **Receive Webhook** | Verify a webhook signature and respond `2xx` fast |
| **Error Handling** | Branch on typed errors (auth, rate limit, invalid, api) |
| **Retry** | Exponential backoff, idempotent (reuses `ext_id`) |
| **Batch Send** | Split a large audience into chunks |

## Credentials

Every example reads credentials from environment variables — never hard-code them:

```bash
export PUSHFY_API_TOKEN="YOUR_API_TOKEN"     # Messaging
export PUSHFY_PUSH_KEY="pushk_..."           # Push server (HMAC)
export PUSHFY_PUSH_SECRET="pss_..."
export PUSHFY_PA_KEY="pak_..."               # Conversational AI (HMAC)
export PUSHFY_PA_SECRET="pas_..."
export WEBHOOK_SECRET="YOUR_WEBHOOK_SECRET"  # Webhook verification
```

See each SDK under [`../sdks/`](../sdks/) and the full reference in [`../docs/`](../docs/).
