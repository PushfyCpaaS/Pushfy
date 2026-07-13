<p align="center">
  <img src="assets/pushfy-logo.svg" alt="Pushfy" width="180">
</p>

<h1 align="center">Pushfy — Official API, SDKs & Docs</h1>

<p align="center">
  <strong>SMS · RCS · Voice · Push Notifications · Conversational AI</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="./docs/en/">Docs (EN)</a> ·
  <a href="./docs/pt/">Docs (PT)</a> ·
  <a href="./openapi/">OpenAPI</a> ·
  <a href="./postman/">Postman</a> ·
  <a href="./sdks/">SDKs</a>
</p>

---

> 🇺🇸 English below · 🇧🇷 [Versão em português](#-português)

## 🇺🇸 English

**Pushfy** is a communications platform (CPaaS) that lets you reach your customers over
**SMS, RCS, Voice, Web/Native Push Notifications** and **AI-powered conversations** — all
from a single account.

This repository is the **official source of truth** for the Pushfy API: reference
documentation, OpenAPI spec, Postman collection, official SDKs and runnable examples.

### Platform at a glance

| Product | What it does | API family |
|---|---|---|
| **Messaging** | Send SMS, RCS and Voice; query delivery status; check balance | Classic API (`https://portal.pushfy.com`) |
| **Push Notifications** | Web & native push, devices, campaigns, segments, metrics | `/v2/api.php` → `/v1/push/*` |
| **Conversational AI (PushAgent)** | Programmatic AI conversations, events and follow-ups | `/v2/api.php` → `/v1/conversations` |

> **Base URLs**
> - Messaging: `https://portal.pushfy.com`
> - Push & Conversational AI: `https://portal.pushfy.com/v2/api.php?r=/v1/...`

### Quick Start

Send your first SMS in under 2 minutes.

**1. Get your API token** — sign in at `https://portal.pushfy.com`, open **Settings → API Tokens**, and copy your token.

**2. Send an SMS**

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer YOUR_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "ext_id": "welcome-001",
        "destinations": [{ "to": "5511999999999" }],
        "text": "Hello from Pushfy 👋" }
    ]
  }'
```

**3. Read the response**

```json
[
  { "id": "welcome-001", "phone": "5511999999999", "date": "2026-07-12 14:33:21", "ext_id": "welcome-001" }
]
```

That's it. Next steps:

- 📖 [Authentication](./docs/en/reference/authentication.md)
- 📖 [Send SMS](./docs/en/reference/sms.md) · [Send RCS](./docs/en/reference/rcs.md) · [Send Voice](./docs/en/reference/voice.md)
- 📖 [Push Notifications](./docs/en/reference/push.md) · [Conversational AI](./docs/en/reference/conversations.md)
- 🔔 [Webhooks](./docs/en/webhooks/README.md)
- 🔌 [CRM & Integrations](./docs/en/integrations/README.md)
- 🚀 [Guides](./docs/en/guides/) · ❓ [FAQ](./docs/en/faq.md)

### Official SDKs

| Language | Package | Status |
|---|---|---|
| PHP | `pushfy/pushfy-php` | planned |
| Node.js (JavaScript) | `@pushfy/pushfy` | planned |
| TypeScript | `@pushfy/pushfy` (typed) | planned |
| Python | `pushfy` | planned |
| Java | `com.pushfy:pushfy` | planned |
| C# / .NET | `Pushfy` | planned |
| Go | `github.com/PushfyCpaaS/pushfy-go` | planned |
| Ruby | `pushfy` | planned |

See [`sdks/`](./sdks/) for source and per-language READMEs.

### Tools

- **OpenAPI 3.1** — [`openapi/pushfy.yaml`](./openapi/) (also JSON). Suitable for code generation.
- **Postman** — [`postman/`](./postman/): collection + environment + tests.
- **Examples** — [`examples/`](./examples/): Send SMS, Bulk SMS, RCS, Push, Voice, Receive Webhook, Retry, Batch, Error Handling — in every language.

### Contributing & License

Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).
Released under the [MIT License](./LICENSE).

---

## 🇧🇷 Português

**Pushfy** é uma plataforma de comunicação (CPaaS) para alcançar seus clientes por
**SMS, RCS, Voz, Push Notifications (web e nativo)** e **conversas com IA** — tudo a
partir de uma única conta.

Este repositório é a **fonte oficial da verdade** da API Pushfy: documentação de
referência, especificação OpenAPI, coleção Postman, SDKs oficiais e exemplos prontos.

### Visão geral da plataforma

| Produto | O que faz | Família de API |
|---|---|---|
| **Mensageria** | Enviar SMS, RCS e Voz; consultar status; consultar saldo | API Clássica (`https://portal.pushfy.com`) |
| **Push Notifications** | Push web e nativo, dispositivos, campanhas, segmentos, métricas | `/v2/api.php` → `/v1/push/*` |
| **IA Conversacional (PushAgent)** | Conversas de IA, eventos e follow-ups via API | `/v2/api.php` → `/v1/conversations` |

### Início rápido

Envie seu primeiro SMS em menos de 2 minutos.

**1. Pegue seu token** — entre em `https://portal.pushfy.com`, abra **Configurações → Tokens de API** e copie o token.

**2. Envie um SMS**

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "ext_id": "boas-vindas-001",
        "destinations": [{ "to": "5511999999999" }],
        "text": "Olá, da Pushfy 👋" }
    ]
  }'
```

**3. Leia a resposta**

```json
[
  { "id": "boas-vindas-001", "phone": "5511999999999", "date": "2026-07-12 14:33:21", "ext_id": "boas-vindas-001" }
]
```

Pronto. Próximos passos:

- 📖 [Autenticação](./docs/pt/reference/authentication.md)
- 📖 [Enviar SMS](./docs/pt/reference/sms.md) · [Enviar RCS](./docs/pt/reference/rcs.md) · [Enviar Voz](./docs/pt/reference/voice.md)
- 📖 [Push Notifications](./docs/pt/reference/push.md) · [IA Conversacional](./docs/pt/reference/conversations.md)
- 🔔 [Webhooks](./docs/pt/webhooks/README.md)
- 🔌 [CRM & Integrações](./docs/pt/integrations/README.md)
- 🚀 [Guias](./docs/pt/guides/) · ❓ [FAQ](./docs/pt/faq.md)

### Licença

Publicado sob a [Licença MIT](./LICENSE). Contribua via [CONTRIBUTING.md](./CONTRIBUTING.md).
