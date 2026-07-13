# Tratando erros

Redes falham, servidores engasgam e requisições dão timeout. Este guia mostra como repetir
chamadas ao Pushfy **com segurança** — sem nunca cobrar um cliente duas vezes. A regra central:

> **Nunca reenvie às cegas após um timeout de envio.** A requisição pode ter tido sucesso no
> servidor, então um reenvio cego arrisca uma **cobrança duplicada**. Consulte o status pelo
> `ext_id` primeiro e só reenvie se de fato não tiver saído.

---

## Passo 1 — Saiba qual formato de erro você está lendo

O Pushfy abrange duas gerações de API, e elas reportam erros de formas diferentes. Detecte o
formato antes de ramificar com base nele.

**Mensageria (API clássica)** — um objeto JSON com uma string `error`:

```json
{ "error": "unauthorized" }
```

Alguns **endpoints de status respondem em texto puro** em vez de JSON (`Unauthorized`,
`Messages not found`, `id parameter is missing`). Não presuma que toda resposta de mensageria
é JSON — confira o `Content-Type` ou caia para o corpo bruto em respostas fora do `200`.

**API V2 (Push / PushAgent)** — sempre um objeto JSON com uma flag `ok`:

```json
{ "ok": false, "error": "rate_limited" }
```

No sucesso, a V2 retorna `"ok": true`. Veja [Erros e limites](../reference/errors.md) para o
catálogo completo de strings.

---

## Passo 2 — Repita só o que é repetível

Repetir um erro de cliente (um `4xx` que você causou) apenas repete a mesma falha. Repita só as
classes transitórias:

| Situação | Repetir? | Como |
|---|---|---|
| **`5xx`** (`500`, `503`, `db_error`, `insert_error`, `internal`) | ✅ | Backoff exponencial |
| **Timeout / conexão resetada** | ✅ (com cuidado) | Backoff — **mas veja o Passo 4 para envios** |
| **`429` `rate_limited`** | ✅ | Faça backoff e retome — não martele |
| **`400`** (`invalid_json`, `max_100000`, campo faltando…) | ❌ | Corrija a requisição |
| **`401` `unauthorized`** | ❌ | Corrija o token / reassine |
| **`403`** (`ip_not_allowed`, `produto_inativo`) | ❌ | Corrija a config / habilite o produto |
| **`404`, `405`, `413`, `415`** | ❌ | Corrija a requisição |

**Backoff exponencial** significa esperar um atraso crescente entre tentativas — ex.: 1s, 2s,
4s, 8s — mais um pequeno **jitter** aleatório para que muitos clientes não repitam em sincronia.
Nunca repita em um loop apertado.

---

## Passo 3 — Torne os retries idempotentes

Um retry só é seguro se repeti-lo não puder criar uma segunda mensagem ou uma segunda cobrança.
O Pushfy oferece duas ferramentas de idempotência:

- **Mensageria — reutilize o mesmo `ext_id`.** É o seu id de referência no `/webapi`.
  Mantê-lo estável entre tentativas permite reconciliar uma repetição com o que você já enviou
  (veja o Passo 4).
- **API de servidor do Push — envie um header `Idempotency-Key`** (≤120 chars) nas chamadas de
  escrita. Repetir a mesma chave retorna a resposta **original** em vez de agir duas vezes:

  ```
  Idempotency-Key: send-987-once
  ```

Gere a chave/`ext_id` **antes** da primeira tentativa e reutilize-a em todo retry daquela mesma
operação lógica.

---

## Passo 4 — A regra de ouro: após timeout de envio, consulte o status — não reenvie

O timeout é o caso perigoso. Sua requisição deu timeout, mas a mensagem pode já estar
**enfileirada e cobrada** no servidor. Se você simplesmente disparar de novo, enviou — e pagou
por — duas mensagens.

Faça assim:

1. **Consulte o status pelo `ext_id`** com
   [`GET /getstatus?ext_id=...`](../reference/status.md).
2. Se retornar uma linha (qualquer status — `Waiting`, `Sent`, `Delivered`…), a mensagem
   **saiu**. **Não** reenvie.
3. Só se o `/getstatus` retornar `404 Messages not found` é que o envio realmente falhou — agora
   é seguro reenviar, reutilizando o mesmo `ext_id`.

```bash
# após um timeout do /webapi para o ext_id "camp42-1001":
curl 'https://portal.pushfy.com/getstatus?ext_id=camp42-1001' \
  -H 'Authorization: Bearer SEU_TOKEN'
# 200 + uma linha  -> existe, NÃO reenvie
# 404              -> nunca saiu, seguro reenviar com o mesmo ext_id
```

Na API de servidor do Push, a rede de segurança equivalente é o `Idempotency-Key`: repita a
mesma chamada com a mesma chave e você recebe o resultado original, não um segundo envio.

---

## Passo 5 — Um wrapper de retry (pseudocódigo)

Este wrapper faz backoff nas falhas transitórias, respeita a regra de ouro nos timeouts e nunca
reenvia uma mensagem que já existe.

```python
import time, random

RETRYABLE_HTTP = {429, 500, 503}

def send_with_retry(ext_id, payload, max_attempts=5):
    for attempt in range(max_attempts):
        try:
            resp = http_post("/webapi", json={"messages": [payload]})  # payload carrega o ext_id
        except (Timeout, ConnectionError):
            # REGRA DE OURO: o envio pode ter tido sucesso. Verifique antes de reenviar.
            if message_exists(ext_id):
                return "already_sent"        # NÃO reenvie — evita cobrança duplicada
            backoff(attempt); continue       # falhou de verdade -> seguro repetir mesmo ext_id

        if resp.status == 200:
            return resp.json()               # array, uma linha por mensagem
        if resp.status in RETRYABLE_HTTP:
            backoff(attempt); continue       # 5xx / 429 -> repita com backoff
        raise ApiError(resp)                 # 4xx que você causou -> corrija, não repita

    raise ApiError("retries esgotados")

def message_exists(ext_id):
    r = http_get(f"/getstatus?ext_id={ext_id}")
    return r.status == 200                    # 404 = nunca saiu

def backoff(attempt):
    delay = (2 ** attempt) + random.uniform(0, 0.5)   # 1s, 2s, 4s… + jitter
    time.sleep(delay)
```

O mesmo esqueleto serve para a API de servidor do Push — troque `message_exists` por um
`Idempotency-Key` na chamada de escrita, e ramifique com base em `{"ok": false, "error": ...}`
em vez do clássico `{"error": ...}`.

---

## Limites de taxa em resumo

| API | Escopo | Limite |
|---|---|---|
| PushAgent | por IP / por conta | 300 / 60s |
| Push | por IP do SDK | 600 / 60s |
| Push | por app público | 1200 / 60s |
| Push | por conta (HMAC) | 600 / 60s |

Ultrapassar um limite retorna `429` com `{ "ok": false, "error": "rate_limited" }`. Veja
[Erros e limites](../reference/errors.md).

---

## Próximos passos

- [Erros e limites](../reference/errors.md) — o catálogo completo de erros.
- [Status de entrega](../reference/status.md) — a consulta `/getstatus` usada no Passo 4.
- [Recebendo webhooks](./receiving-webhooks.md) — receba resultados em vez de fazer polling.
