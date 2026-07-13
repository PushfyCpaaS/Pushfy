# Crie uma campanha

Campanhas enviam uma mensagem para muitas pessoas a partir do seu servidor. Este guia foca
em **campanhas de Push Notifications** — criadas, disparadas e medidas pela API de servidor
assinada com HMAC — e depois mostra, rapidamente, como rodar uma **campanha de RCS** no lado
da Mensageria.

Você vai criar uma campanha, dispará-la, ler as métricas e aprender a **agendar** um envio e
segmentar com **segmentos**.

---

## Antes de começar

Para campanhas de Push você precisa de:

- Push Notifications habilitado na sua conta.
- Um par de chaves de **servidor** em **Configurações → Chaves de API**: um id de chave
  `pushk_` e seu secret `pss_`. O secret é exibido **só uma vez** — guarde com segurança.
- Dispositivos já registrados no seu `app_id` (seu SDK de front-end faz isso). Veja
  [Push Notifications](../reference/push.md).

Chamadas de servidor do Push são assinadas com **HMAC-SHA256**. Toda requisição leva três
cabeçalhos — `X-PUSH-Key`, `X-PUSH-Timestamp`, `X-PUSH-Signature` — e a assinatura cobre o
timestamp, o método, o path e um hash do corpo. A receita completa está em
[Autenticação → receita da assinatura](../reference/authentication.md#receita-da-assinatura).

> Os exemplos abaixo montam a assinatura inline com `openssl`, para cada passo ser um comando
> autocontido e executável. Em produção, assine no código da sua aplicação.

---

## Passo 1 — Crie a campanha

`POST /v1/push/campaigns`. Só `name` é obrigatório; o resto molda a notificação e o público.

Campos úteis:

| Campo | Para quê |
|---|---|
| `name` | Nome interno da campanha (obrigatório) |
| `title` / `body` | Título e texto da notificação |
| `url` | URL de clique |
| `image` / `icon` | Imagem de destaque / ícone |
| `audience` | Segmentação — um id de segmento, `tags` ou um filtro |
| `schedule_at` | Horário ISO para enviar depois; omita para enviar sob demanda |

```bash
BODY='{"name":"Promo de fim de semana","title":"50% off hoje","body":"Toque para pegar seu bônus","url":"https://example.com/promo","audience":{"tags":["vip"]}}'
TS=$(date +%s)
BH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | awk '{print $2}')
BASE=$(printf '%s\n%s\n%s\n%s' "$TS" "POST" "/v1/push/campaigns" "$BH")
SIG=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac 'pss_SEU_SECRET' -hex | awk '{print $2}')

curl -X POST 'https://portal.pushfy.com/v2/api.php?r=/v1/push/campaigns' \
  -H "X-PUSH-Key: pushk_SUA_CHAVE" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

Resposta — a campanha é criada como **rascunho** (draft):

```json
{ "ok": true, "campaign_id": 987, "status": "draft" }
```

Guarde o `campaign_id`; você assina as próximas duas chamadas com ele no path.

---

## Passo 2 — Dispare

`POST /v1/push/campaigns/{id}/send`. **Assine o path incluindo o id** — aqui
`/v1/push/campaigns/987/send`, não a rota base. Adicione um `Idempotency-Key` para que um
reenvio não dispare duas vezes.

```bash
BODY='{}'
PATH_R='/v1/push/campaigns/987/send'
TS=$(date +%s)
BH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | awk '{print $2}')
BASE=$(printf '%s\n%s\n%s\n%s' "$TS" "POST" "$PATH_R" "$BH")
SIG=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac 'pss_SEU_SECRET' -hex | awk '{print $2}')

curl -X POST "https://portal.pushfy.com/v2/api.php?r=$PATH_R" \
  -H "X-PUSH-Key: pushk_SUA_CHAVE" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG" \
  -H 'Idempotency-Key: send-987-once' \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

```json
{ "ok": true, "campaign_id": 987, "status": "sending" }
```

O mesmo formato conduz as ações de ciclo de vida `.../pause`, `.../resume`, `.../cancel` e
`.../duplicate`.

---

## Passo 3 — Leia as métricas

`GET /v1/push/campaigns/{id}/metrics`. É um GET, então o hash do corpo é o hash da
**string vazia**.

```bash
PATH_R='/v1/push/campaigns/987/metrics'
TS=$(date +%s)
BH=$(printf '%s' '' | openssl dgst -sha256 -hex | awk '{print $2}')
BASE=$(printf '%s\n%s\n%s\n%s' "$TS" "GET" "$PATH_R" "$BH")
SIG=$(printf '%s' "$BASE" | openssl dgst -sha256 -hmac 'pss_SEU_SECRET' -hex | awk '{print $2}')

curl "https://portal.pushfy.com/v2/api.php?r=$PATH_R" \
  -H "X-PUSH-Key: pushk_SUA_CHAVE" \
  -H "X-PUSH-Timestamp: $TS" \
  -H "X-PUSH-Signature: $SIG"
```

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

Para resultados evento a evento em tempo real, assine o
[webhook de Push](../webhooks/push.md) em vez de consultar as métricas.

---

## Agendamento e segmentos

**Agendar um envio** — defina `schedule_at` com um horário ISO ao criar a campanha, e o
Pushfy envia naquele momento. Omita `schedule_at` para mantê-la como rascunho que você
dispara manualmente com `/send`:

```json
{ "name": "Resumo de segunda", "title": "Destaques da semana", "schedule_at": "2026-07-20T13:00:00Z" }
```

**Segmentar** — aponte `audience` para um segmento salvo ou um conjunto de tags/filtros. Crie
segmentos com `POST /v1/push/segments` (`name` obrigatório, `filter` opcional) e referencie o
id devolvido:

```json
{ "name": "Reengajamento VIP", "audience": { "segment_id": 42 } }
```

Você também pode segmentar inline com `audience.tags` (como no Passo 1) ou um `audience.filter`
ad-hoc. Veja [Push Notifications](../reference/push.md) para a lista completa de rotas.

---

## Também: uma campanha de RCS (Mensageria)

Se a sua "campanha" é na verdade um lote de cards RCS ricos pela API de Mensageria, a mecânica
é diferente — token Bearer, não HMAC — e você anexa mensagens a uma campanha por id.

Envie para uma campanha existente com `POST /rcscampaign?cid=<ID>`. O `cid` é obrigatório e
validado contra a sua conta:

```bash
curl -X POST 'https://portal.pushfy.com/rcscampaign?cid=12345' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "promo-1042",
        "destinations": [{ "to": "5511999999999" }],
        "text": "O pedido #1042 está a caminho 🚚"
      }
    ]
  }'
```

A resposta ecoa o `cid` ao qual as mensagens foram adicionadas. Se preferir que a campanha
seja criada para você, use `POST /rcs`; se ela já estiver provisionada como campanha
"API RCS", use `POST /apircsnativo.php`. As três estão em [Enviar RCS](../reference/rcs.md).

---

## Próximos passos

- Conecte os eventos de entrega/clique com o [webhook de Push](../webhooks/push.md) — veja o
  [guia de recebimento de webhooks](./receiving-webhooks.md).
- Assine as requisições corretamente — [Autenticação](../reference/authentication.md).
- Trate falhas e retries com segurança — [Tratando erros](./error-handling.md).
