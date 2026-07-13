# Push Notifications

Push web e nativo: registre dispositivos no navegador/app e, em seguida, crie e envie
campanhas a partir do seu servidor.

Todas as rotas de Push compartilham o prefixo `/v1/push` e são acessadas pelo gateway da API:

```
https://portal.pushfy.com/v2/api.php?r=<rota>
```

## Dois grupos de autenticação

A API de Push tem dois grupos que convivem no mesmo prefixo, mas autenticam de formas diferentes.

| Grupo | Quem chama | Auth | CORS |
|---|---|---|---|
| **Público (SDK do dispositivo)** | Navegador / app | `app_id` público (corpo ou `?app_id=`) | Liberado |
| **Servidor** | Seu backend | HMAC (headers `X-PUSH-*`) | n/a (servidor-a-servidor) |

- **Grupo público** — `config`, `subscribe`, `unsubscribe`, `track`. Seguro para embarcar no
  front-end: a única credencial é seu `app_id` **público**. Sem assinatura. Veja
  [Autenticação → `app_id` público](./authentication.md).
- **Grupo de servidor** — todo o resto (dispositivos, campanhas, segmentos, eventos, relatórios,
  webhooks, teste). Assinado com HMAC-SHA256 usando uma chave `pushk_` + segredo `pss_`. Veja
  [Autenticação → HMAC](./authentication.md).

> Nunca exponha um segredo HMAC no navegador ou no app. O `app_id` público é a única credencial
> destinada aos dispositivos do cliente.

---

## Fluxo típico

**Front-end (SDK do dispositivo)**

1. `GET /v1/push/config` — busca a chave pública VAPID e as configurações de opt-in do seu `app_id`.
2. `POST /v1/push/subscribe` — registra a inscrição de push do dispositivo (ou token nativo).
3. `POST /v1/push/track` — reporta eventos `delivered` / `open` / `click` / `conversion`.

**Back-end (API de servidor)**

1. `POST /v1/push/campaigns` — cria uma campanha.
2. `POST /v1/push/campaigns/{id}/send` — envia.
3. `GET /v1/push/campaigns/{id}/metrics` — lê entregas, aberturas, cliques e conversões.

---

## Rotas

### Público — SDK do dispositivo (`app_id`)

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/v1/push/config` | Chave pública VAPID + config de opt-in |
| `POST` | `/v1/push/subscribe` | Registra um dispositivo |
| `POST` | `/v1/push/unsubscribe` | Faz opt-out de um dispositivo |
| `POST` | `/v1/push/track` | Reporta evento do dispositivo |

### Servidor — HMAC (`X-PUSH-*`)

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/v1/push/devices` | Lista dispositivos (filtros `status`, `platform`, `limit`) |
| `POST` | `/v1/push/devices` | Registra dispositivo pelo servidor |
| `DELETE` | `/v1/push/devices/{id}` | Remove um dispositivo |
| `GET` | `/v1/push/campaigns` | Lista campanhas |
| `POST` | `/v1/push/campaigns` | Cria uma campanha |
| `GET` | `/v1/push/campaigns/{id}` | Obtém uma campanha |
| `PATCH` | `/v1/push/campaigns/{id}` | Atualiza campanha em rascunho |
| `POST` | `/v1/push/campaigns/{id}/send` | Envia uma campanha |
| `POST` | `/v1/push/campaigns/{id}/pause` | Pausa |
| `POST` | `/v1/push/campaigns/{id}/resume` | Retoma |
| `POST` | `/v1/push/campaigns/{id}/cancel` | Cancela |
| `POST` | `/v1/push/campaigns/{id}/duplicate` | Duplica |
| `GET` | `/v1/push/campaigns/{id}/metrics` | Enviados / entregues / aberturas / cliques / conversões |
| `GET` | `/v1/push/segments` | Lista segmentos |
| `POST` | `/v1/push/segments` | Cria um segmento |
| `POST` | `/v1/push/events` | Ingere eventos pelo servidor |
| `POST` | `/v1/push/conversions` | Ingere conversões pelo servidor |
| `GET` | `/v1/push/reports` | Relatórios agregados (`range`/`de`/`ate`) |
| `GET` | `/v1/push/webhooks` | Lista webhooks |
| `POST` | `/v1/push/webhooks` | Cria um webhook |
| `DELETE` | `/v1/push/webhooks/{id}` | Remove um webhook |
| `POST` | `/v1/push/test` | Envia um push de teste |

---

## Grupo público — SDK do dispositivo

Autentique com seu `app_id` **público**. O CORS é liberado, então essas rotas rodam no front-end.

### `GET /v1/push/config`

Retorna os dados de que o SDK do navegador precisa para se inscrever.

**Requisição**

```bash
curl 'https://portal.pushfy.com/v2/api.php?r=/v1/push/config&app_id=pushapp_xxxxxxxxxxxx'
```

**Resposta** — `200 OK`

```json
{
  "ok": true,
  "app_id": "pushapp_xxxxxxxxxxxx",
  "vapid_public": "BExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "optin": {
    "prompt": "soft",
    "delay": 5
  }
}
```

**Erros** — `400 app_id` (ausente/desconhecido), `403 produto_inativo`, `404 rota`.

### `POST /v1/push/subscribe`

Registra um dispositivo. Para push web, envie o `subscription` do navegador; para nativo, um `token`.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `app_id` | string | ✅ | Seu id de aplicação público |
| `provider` | string | — | `webpush` (padrão) · `fcm` · `apns` |
| `platform` | string | — | `web` (padrão) · `android` · `ios` · `safari` |
| `subscription` | objeto | ✅ se `webpush` | `{ endpoint, keys:{ p256dh, auth } }` |
| `token` | string | ✅ se `fcm`/`apns` | Token de push nativo |
| `user_ext_id` | string | — | Seu id de usuário para vincular o dispositivo |
| `tags` | array | — | Tags livres para segmentação |
| `attrs` | objeto | — | Atributos personalizados |
| `context` | objeto | — | `{ ua, lang, tz, country, pwa }` |

**Requisição** (push web)

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/subscribe' \
  -H 'Content-Type: application/json' \
  -d '{
    "app_id": "pushapp_xxxxxxxxxxxx",
    "provider": "webpush",
    "platform": "web",
    "subscription": {
      "endpoint": "https://push-endpoint.example.com/s/xxxxxxxx",
      "keys": {
        "p256dh": "BExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "auth": "xxxxxxxxxxxxxxxxxxxxxx"
      }
    },
    "user_ext_id": "user-42",
    "tags": ["vip", "pt-br"],
    "context": { "lang": "pt-BR", "tz": "America/Sao_Paulo", "pwa": false }
  }'
```

**Resposta** — `200 OK`

```json
{ "ok": true, "device_id": 123 }
```

**Erros** — `400 app_id` / `400 token` (subscription ou token ausente), `403 produto_inativo`,
`403 origem_nao_autorizada` (o `Origin` do navegador não está na allow-list do projeto — uma
lista **vazia** libera qualquer origem), `429 rate_limited`.

### `POST /v1/push/unsubscribe`

Faz opt-out de um dispositivo. Identifique-o por `token` ou por `subscription.endpoint`.

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/unsubscribe' \
  -H 'Content-Type: application/json' \
  -d '{
    "app_id": "pushapp_xxxxxxxxxxxx",
    "subscription": { "endpoint": "https://push-endpoint.example.com/s/xxxxxxxx" }
  }'
```

**Resposta** — `200 OK`

```json
{ "ok": true }
```

**Erros** — `400 app_id`, `400 token` (nem `token` nem `subscription.endpoint` informados).

### `POST /v1/push/track`

Reporta um evento do dispositivo.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `app_id` | string | ✅ | Seu id de aplicação público |
| `event` | string | ✅ | `delivered` · `open` · `click` · `close` · `conversion` |
| `campaign_id` | número | — | Campanha à qual o evento pertence |
| `delivery_id` | string | — | Id da entrega vindo do payload do push |
| `value` | número | — | Valor monetário/outro (para `conversion`) |
| `token` | string | — | Token/endpoint do dispositivo para atribuir o evento |
| `meta` | objeto | — | Metadados livres |

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/track' \
  -H 'Content-Type: application/json' \
  -d '{
    "app_id": "pushapp_xxxxxxxxxxxx",
    "event": "click",
    "campaign_id": 987,
    "delivery_id": "d-xxxxxxxx"
  }'
```

**Resposta** — `200 OK`

```json
{ "ok": true }
```

**Erros** — `400 app_id`, `400 type` (`event` ausente/inválido), `429 rate_limited`.

---

## Grupo de servidor — HMAC

Assine cada requisição com sua chave `pushk_` e segredo `pss_` usando a
[receita de assinatura](./authentication.md#signing-recipe) — idêntica ao restante da API HMAC,
com os headers `X-PUSH-*`. Chamadas de escrita aceitam o header opcional `Idempotency-Key`.

### `POST /v1/push/campaigns`

Cria uma campanha.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | string | ✅ | Nome interno da campanha |
| `title` | string | — | Título da notificação |
| `body` | string | — | Corpo da notificação |
| `url` | string | — | URL de clique |
| `icon` | string | — | URL do ícone |
| `image` | string | — | URL da imagem de destaque |
| `ttl` | número | — | Tempo de vida em segundos |
| `priority` | string | — | Prioridade de entrega |
| `audience` | objeto | — | Segmentação (id de segmento, tags, filtro) |
| `schedule_at` | string | — | Horário ISO de envio; omita para enviar sob demanda |

**Requisição**

```bash
BODY='{"name":"Promo fim de semana","title":"50% hoje","body":"Toque para resgatar seu bônus","url":"https://example.com/promo","audience":{"tags":["vip"]}}'
TS=$(date +%s)
BH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | awk '{print $2}')
BASE=$(printf '%s\n%s\n%s\n%s' "$TS" "POST" "/v1/push/campaigns" "$BH")
SIG=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac 'pss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' -hex | awk '{print $2}')

curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/campaigns' \
  -H "X-PUSH-Key: pushk_xxxxxxxxxxxxxxxxxxxx" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

**Resposta** — `200 OK`

```json
{ "ok": true, "campaign_id": 987, "status": "draft" }
```

**Erros** — `400 name` (ausente), `401 unauthorized`, `403 produto_inativo`, `429 rate_limited`.

### `POST /v1/push/campaigns/{id}/send`

Envia uma campanha. Assine o path **incluindo** o id, ex.: `/v1/push/campaigns/987/send`.

```bash
curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/campaigns/987/send' \
  -H "X-PUSH-Key: pushk_xxxxxxxxxxxxxxxxxxxx" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG" \
  -H 'Idempotency-Key: send-987-once' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Resposta** — `200 OK`

```json
{ "ok": true, "campaign_id": 987, "status": "sending" }
```

As ações de ciclo de vida têm o mesmo formato: `POST /v1/push/campaigns/{id}/pause` ·
`.../resume` · `.../cancel` · `.../duplicate`.

**Erros** — `401 unauthorized`, `404 rota` (campanha/ação desconhecida), `405 metodo`,
`429 rate_limited`.

### `GET /v1/push/campaigns/{id}/metrics`

```bash
curl 'https://portal.pushfy.com/v2/api.php?r=/v1/push/campaigns/987/metrics' \
  -H "X-PUSH-Key: pushk_xxxxxxxxxxxxxxxxxxxx" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG"
```

**Resposta** — `200 OK`

```json
{
  "ok": true,
  "campaign_id": 987,
  "metrics": {
    "sent": 10000,
    "delivered": 9640,
    "opens": 3120,
    "clicks": 870,
    "conversions": 145
  }
}
```

### Dispositivos

- `GET /v1/push/devices` — filtros `status`, `platform`, `limit` (máx. **500**).
- `POST /v1/push/devices` — registra pelo servidor. Exige `project_id` **ou** `app_id`, e `token`.
- `DELETE /v1/push/devices/{id}` — remove um dispositivo.

```bash
curl 'https://portal.pushfy.com/v2/api.php?r=/v1/push/devices&status=active&platform=web&limit=100' \
  -H "X-PUSH-Key: pushk_xxxxxxxxxxxxxxxxxxxx" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG"
```

**Erros** — `400 projeto` (nem `project_id` nem `app_id`), `400 token` (ausente no `POST`).

### Segmentos

- `GET /v1/push/segments` — lista segmentos.
- `POST /v1/push/segments` — cria; `name` obrigatório, `filter` opcional.

**Erros** — `400 name` (ausente).

### Eventos e conversões

- `POST /v1/push/events` — ingere eventos pelo servidor.
- `POST /v1/push/conversions` — ingere conversões pelo servidor.

### Relatórios

- `GET /v1/push/reports` — estatísticas agregadas. Consulte por `range`, ou `de` + `ate` (datas).

### Webhooks

- `GET /v1/push/webhooks` — lista.
- `POST /v1/push/webhooks` — cria.
- `DELETE /v1/push/webhooks/{id}` — remove.

Veja [Webhooks de Push](../webhooks/push.md) para payloads de evento e verificação de assinatura.

### Push de teste

- `POST /v1/push/test` — envia um teste rápido. Campos: `project_id`, `title`, `body`, `url`, `limit`.

---

## Erros

Comuns às rotas de Push:

| HTTP | Corpo | Causa |
|---|---|---|
| 400 | `app_id` / `token` / `name` / `type` / `projeto` | Campo obrigatório ausente ou inválido |
| 401 | `unauthorized` | Header ausente, assinatura HMAC inválida ou timestamp fora da janela de ±300s |
| 403 | `produto_inativo` | Push não está habilitado na sua conta |
| 403 | `origem_nao_autorizada` | `Origin` do navegador fora da allow-list do projeto (subscribe) |
| 404 | `rota` | Rota/recurso desconhecido |
| 405 | `metodo` | Método HTTP incorreto para a rota |
| 429 | `rate_limited` | Limite de taxa excedido — veja abaixo |

**Limites de taxa**

| Escopo | Limite |
|---|---|
| Por IP do SDK (grupo público) | 600 / 60s |
| Por app público (grupo público) | 1200 / 60s |
| Por conta (HMAC / grupo de servidor) | 600 / 60s |

Veja [Erros e limites de taxa](./errors.md).

---

## Próximos passos

- [Autenticação](./authentication.md)
- [Webhooks de Push](../webhooks/push.md)
- [Erros e limites de taxa](./errors.md)
