# Repository structure

Scalable layout, ready for future API versions and new products.

```
Pushfy/
├── README.md                     # Landing page (EN + PT), quick start
├── LICENSE                       # MIT
├── CONTRIBUTING.md
├── CHANGELOG.md
├── .gitignore
├── assets/                       # Logo, diagrams
│
├── docs/
│   ├── en/
│   │   ├── reference/            # One file per endpoint group
│   │   │   ├── endpoints.md      # Full endpoint index (source of truth)
│   │   │   ├── authentication.md
│   │   │   ├── sms.md
│   │   │   ├── rcs.md
│   │   │   ├── voice.md
│   │   │   ├── push.md
│   │   │   ├── conversations.md
│   │   │   ├── status.md         # Delivery status / reports
│   │   │   ├── balance.md
│   │   │   └── errors.md         # Error codes & rate limits
│   │   ├── webhooks/
│   │   │   ├── README.md
│   │   │   ├── messaging-status.md
│   │   │   ├── push.md
│   │   │   └── conversations.md
│   │   ├── integrations/         # CRM & Integrations — one page per platform
│   │   │   ├── README.md         # group index (generic, n8n, hubspot, salesforce,
│   │   │   ├── generic.md        #  activecampaign, pipedrive, rdstation, bitrix24,
│   │   │   └── ...               #  zoho, monday)
│   │   ├── guides/
│   │   │   ├── first-message.md
│   │   │   ├── campaigns.md
│   │   │   ├── bulk-sending.md
│   │   │   ├── error-handling.md
│   │   │   ├── receiving-webhooks.md
│   │   │   └── migrating-v1-to-v2.md
│   │   └── faq.md
│   └── pt/                        # Mirror of en/ in Portuguese
│
├── openapi/
│   ├── pushfy.yaml               # OpenAPI 3.1 (source)
│   ├── pushfy.json               # Swagger JSON
│   └── README.md                 # How to generate SDKs from it
│
├── postman/
│   ├── Pushfy.postman_collection.json
│   ├── Pushfy.postman_environment.json
│   └── README.md
│
├── sdks/
│   ├── php/
│   ├── node/          (JavaScript)
│   ├── typescript/
│   ├── python/
│   ├── java/
│   ├── dotnet/        (C#)
│   ├── go/
│   └── ruby/          # each: README, install, examples, error handling, publish config
│
└── examples/
    ├── php/  node/  typescript/  python/  java/  dotnet/  go/  ruby/
    │   ├── send-sms
    │   ├── send-bulk-sms
    │   ├── send-rcs
    │   ├── send-push
    │   ├── send-voice
    │   ├── receive-webhook
    │   ├── error-handling
    │   ├── retry
    │   └── batch-send
    └── README.md
```

## Versioning policy

- Docs describe the **live** production API. Breaking changes get a dated entry in `CHANGELOG.md`.
- New API versions live under a version segment (e.g. a future `/v2/messaging/*`) with its own
  reference page; old pages stay until the version is retired.
- SDKs follow SemVer and are published per-language (Packagist, npm, PyPI, Maven Central, NuGet, Go modules, RubyGems).
