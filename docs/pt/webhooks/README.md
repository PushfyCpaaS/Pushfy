# Webhooks

Um webhook é um `POST` HTTP que **o Pushfy envia para uma URL sua** sempre que algo
acontece — uma mensagem é entregue, um push é clicado, uma conversa é transferida para um humano.
Em vez de ficar consultando a nossa API, você recebe os eventos no momento em que ocorrem.

- **A URL é sua.** Precisa ser um endpoint **HTTPS público**. HTTP puro, faixas privadas e
  endereços de loopback são rejeitados (anti-SSRF).
- **O Pushfy assina cada requisição**, para você conferir que ela realmente veio de nós.
- **Você responde `2xx` rápido.** Qualquer outra resposta é tratada como falha e sofre retry.

Existem três famílias de webhook. Elas compartilham a mesma mecânica de entrega, mas diferem no
cabeçalho da assinatura — leia a tabela abaixo com atenção.

---

## Os três tipos de webhook

| Tipo | O que reporta | Cabeçalho da assinatura | Formato da assinatura |
|---|---|---|---|
| [Status de mensageria](./messaging-status.md) | Recibos de entrega (DLR) de SMS/RCS/Voz e respostas recebidas | `X-Pushfy-Signature` | `sha256=<hex>` |
| [Push](./push.md) | Eventos de campanha e dispositivo do Push Notifications | `X-Push-Signature` | `sha256=<hex>` |
| [Conversas](./conversations.md) | Eventos do PushAgent (IA Conversacional) | `X-PA-Signature` | `<hex>` — **hex puro** |

> **⚠️ Cuidado com o formato da assinatura.** Mensageria e Push enviam a assinatura **com prefixo**:
> `sha256=<hex>`. Conversas (PushAgent) envia **apenas o hex puro**, **sem o prefixo `sha256=`**.
> Se você reaproveitar um validador entre produtos, ajuste a comparação.

---

## Regras comuns (Push & Conversas)

Os webhooks maduros — **Push** e **Conversas** — seguem um único contrato compartilhado:

- **Corpo em JSON.** Leia o corpo bruto; não presuma nada além de `application/json`.
- **Cada entrega tem um `eid` único.** Ele aparece no corpo JSON e no cabeçalho de entrega
  (`X-Push-Delivery` / `X-PA-Delivery`). Use-o para **idempotência** — deduplique pelo `eid` para
  que uma reentrega seja processada só uma vez.
- **Responda `2xx` rápido.** Confirme primeiro, processe de forma assíncrona. Faça o trabalho
  pesado depois de responder.
- **Retry.** Uma resposta diferente de `2xx` (ou timeout) dispara até **6 tentativas** com backoff:
  `[imediato, 1 min, 5 min, 15 min, 1 h, 3 h]`.
- **Timeout.** Cerca de **12 segundos**. Se você não responder a tempo, a entrega sofre retry.
- **Só HTTPS.** O endpoint precisa ser HTTPS público; URLs privadas/loopback são recusadas ao
  salvar a configuração (anti-SSRF).

O webhook de status de mensageria compartilha a mesma ideia de assinatura (HMAC-SHA256), mas seu
corpo é um array simples de recibos, não um evento envelopado — veja os detalhes na página dele.

---

## Configurando um webhook

No painel: **Configurações → Webhooks**. Para cada tipo de webhook você define:

1. **URL de entrega** — seu endpoint HTTPS público, ex.: `https://your-app.com/webhook`.
2. **Secret** — a chave de assinatura que o Pushfy usa para calcular a assinatura
   (ex.: `WEBHOOK_SECRET`). Guarde no servidor; nunca exponha em código de front-end.

---

## Ciclo de entrega

```
  ┌────────────┐
  │  evento     │  uma mensagem é entregue / um push é clicado / …
  │  ocorre      │
  └─────┬──────┘
        │
        ▼
  ┌──────────────────────────┐
  │  Pushfy assina o corpo    │  assinatura = HMAC-SHA256(corpo_bruto, secret)
  │  bruto e faz o POST       │  cabeçalhos: X-*-Signature, X-*-Delivery (eid)
  └─────┬────────────────────┘
        │
        ▼
  ┌──────────────────────────┐
  │  seu servidor valida a    │  recalcula a assinatura, compara em tempo constante
  │  assinatura               │  deduplica pelo eid
  └─────┬────────────────────┘
        │
        ▼
  ┌──────────────────────────┐        diferente de 2xx / timeout
  │  responde 2xx (ack)       │ ───────────────────────────┐
  └─────┬────────────────────┘                             │
        │                                                    ▼
        ▼                                       ┌──────────────────────────┐
  processa de forma assíncrona                   │  retry com backoff        │
                                                 │  [agora,1m,5m,15m,1h,3h]  │
                                                 └──────────────────────────┘
```

---

## Validando a autenticidade

Todo webhook é assinado com **HMAC-SHA256** sobre o **corpo bruto** da requisição usando o seu
secret. Recalcule e compare em **tempo constante**.

```
expected = hmac_sha256_hex(corpo_bruto, secret)

# Status de mensageria  →  compare o cabeçalho com  "sha256=" + expected
# Push                  →  compare o cabeçalho com  "sha256=" + expected
# Conversas             →  compare o cabeçalho com  expected      (hex puro, sem prefixo)
```

Pseudocódigo genérico:

```python
import hashlib, hmac

def valido(corpo_bruto: bytes, header: str, secret: str, com_prefixo: bool) -> bool:
    expected = hmac.new(secret.encode(), corpo_bruto, hashlib.sha256).hexdigest()
    if com_prefixo:
        expected = "sha256=" + expected
    return hmac.compare_digest(expected, header or "")
```

- Use o `corpo_bruto` **exatamente como recebido** — não faça parse e re-serialize o JSON antes,
  ou os bytes (e a assinatura) mudam.
- Compare com uma função de **tempo constante** (`hmac.compare_digest`, `crypto.timingSafeEqual`…).

---

## Boas práticas

- **Valide antes de confiar.** Rejeite qualquer requisição cuja assinatura não bata — devolva `401`.
- **Use o corpo bruto.** Nunca re-serialize o JSON antes de assinar; assine os bytes exatos
  recebidos.
- **Deduplique pelo `eid`.** Retries e raras duplicatas de rede fazem o mesmo evento chegar mais de
  uma vez. Guarde os `eid` já vistos.
- **Responda rápido, processe assíncrono.** Confirme dentro do timeout e depois faça o trabalho.
- **Monitore falhas.** Observe respostas repetidas fora de `2xx` para um endpoint quebrado não
  descartar eventos em silêncio.
- **Trate reentrega.** Presuma que qualquer evento pode ser entregue de novo; deixe seus handlers
  idempotentes.

---

## Próximos passos

- [Webhook de status de mensageria](./messaging-status.md)
- [Webhook de Push](./push.md)
- [Webhook de Conversas](./conversations.md)
- [Autenticação](../reference/authentication.md)
