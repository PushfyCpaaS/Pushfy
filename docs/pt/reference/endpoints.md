# Índice de endpoints

A lista oficial dos endpoints da API Pushfy, por produto. Cada item foi verificado contra a
implementação real. Onde o comportamento diverge de documentações antigas, **este documento vale**.

> **Base URLs**
> - Mensageria e relatórios: `https://portal.pushfy.com`
> - Push e IA Conversacional: `https://portal.pushfy.com/v2/api.php?r=<rota>`

## Mensageria (API Clássica)

Autenticação: `Authorization: Bearer SEU_TOKEN` (também `X-API-TOKEN: SEU_TOKEN`, ou Basic com login/senha da conta). Content-Type: `application/json`.

| Método | Caminho | Objetivo | Notas |
|---|---|---|---|
| POST | `/webapi` | **Enviar SMS** (recomendado, assíncrono) | Body `messages[]`; resposta é um array `[{id,phone,date,ext_id}]` |
| POST | `/api` | Enviar SMS (síncrono) | Mesmo body; retorna ids reais do auto-increment |
| POST | `/apircsnativo.php` | **Enviar RCS** (recomendado) | Exige uma campanha `API RCS` na conta; suporta campos de card ricos |
| POST | `/rcs` | Enviar RCS (cria campanha automaticamente) | Card simples; resposta `{status,campaign_id,inserted}` |
| POST | `/rcscampaign?cid=<id>` | Enviar RCS para uma campanha específica | `cid` obrigatório e validado como seu |
| POST | `/webapi` (campo `audio`) | **Enviar Voz** | Voz = mensagem com um id de `audio`; crie o áudio antes via `/audio` |
| POST | `/audio` | Enviar um áudio de voz (só `.mp3`) | `multipart/form-data` (`nome`, `audio`) |
| GET | `/getstatus?ext_id=<id>` | Status de entrega de uma mensagem | Retorna um **array**; também aceita `uid` (id interno) |
| GET | `/getdate?date=YYYY-MM-DD` | Status de todas as mensagens de um dia | |
| GET | `/reportbydate` | Relatório por período (`start`,`end`,`event`,`limit`,`offset`) | Inclui canal, status_code, custo |
| GET | `/strikeapi` | Lista de números bloqueados da conta | |
| GET | `/balance` | Saldo de SMS da conta | Retorna `{"saldo":"1.500"}` (string formatada) |

> **Descontinuados / removidos:** os endpoints antes listados como `POST /apitvoz` (Enviar Voz) e
> `GET /balancetvoz` (Saldo de voz) **não existem** — não os use. Voz é enviada pelo `/webapi` com o
> campo `audio` (ver [Voz](./voice.md)).

## Push Notifications (`/v1/push/*`)

Dois modos de auth no mesmo prefixo:

- **Grupo público** (`config`, `subscribe`, `unsubscribe`, `track`) — auth por `app_id` público (+ allow-list de `Origin` no `subscribe`). Seguro para SDKs de navegador/dispositivo.
- **Grupo de servidor** (o resto) — HMAC com `X-PUSH-Key` / `X-PUSH-Timestamp` / `X-PUSH-Signature`. `Idempotency-Key` opcional.

| Método | Rota (`?r=`) | Auth | Objetivo |
|---|---|---|---|
| GET | `/v1/push/config` | público | Config pública para o SDK (chave VAPID, opt-in) |
| POST | `/v1/push/subscribe` | público | Registrar/atualizar um dispositivo |
| POST | `/v1/push/unsubscribe` | público | Descadastrar (opt-out) um dispositivo |
| POST | `/v1/push/track` | público | Registrar evento do dispositivo (`delivered/open/click/close/conversion`) |
| GET/POST | `/v1/push/devices` | HMAC | Listar / registrar dispositivos |
| DELETE | `/v1/push/devices/{id}` | HMAC | Descadastrar um dispositivo |
| GET/POST | `/v1/push/campaigns` | HMAC | Listar / criar campanhas |
| GET/PATCH | `/v1/push/campaigns/{id}` | HMAC | Obter / atualizar uma campanha |
| POST | `/v1/push/campaigns/{id}/send` | HMAC | Disparar uma campanha |
| POST | `/v1/push/campaigns/{id}/{pause\|resume\|cancel\|duplicate}` | HMAC | Ações da campanha |
| GET | `/v1/push/campaigns/{id}/metrics` | HMAC | Métricas de entrega/abertura/clique/conversão |
| GET/POST | `/v1/push/segments` | HMAC | Listar / criar segmentos |
| POST | `/v1/push/events` · `/v1/push/conversions` | HMAC | Eventos / conversões server-side |
| GET | `/v1/push/reports` | HMAC | Dados analíticos |
| GET/POST/DELETE | `/v1/push/webhooks` | HMAC | Gerenciar webhooks de push |
| POST | `/v1/push/test` | HMAC | Enviar um push de teste |

## IA Conversacional — PushAgent (`/v1/*`)

Auth: HMAC com `X-PA-Key` / `X-PA-Timestamp` / `X-PA-Signature`. Ver [Autenticação](./authentication.md).

| Método | Rota (`?r=`) | Objetivo |
|---|---|---|
| POST | `/v1/conversations` | Abrir uma conversa (`user_ext_id`, opcional `name`, `channel`) |
| GET | `/v1/conversations/{id}` | Obter conversa + mensagens |
| POST | `/v1/conversations/{id}/messages` | Enviar mensagem do usuário (a IA responde de forma assíncrona) |
| POST | `/v1/conversations/{id}/handoff` | Transferir para um atendente humano |
| POST | `/v1/conversations/{id}/close` | Encerrar a conversa |
| POST | `/v1/events` | Enviar um evento de negócio (contexto/proatividade) |
| POST | `/v1/tasks` | Agendar um follow-up (`conversation_id`, `run_at`, `text`) |

## Limites de taxa (rate limits)

| Escopo | Limite |
|---|---|
| PushAgent API — por IP (pré-auth) | 300 req / 60 s |
| PushAgent API — por conta | 300 req / 60 s |
| Push API — por IP do SDK | 600 req / 60 s |
| Push API — por app público | 1200 req / 60 s |
| Push API — por conta (HMAC) | 600 req / 60 s |

Exceder um limite retorna `429` com `{"ok": false, "error": "rate_limited"}`.

Veja [errors.md](./errors.md) para o catálogo completo de erros.
