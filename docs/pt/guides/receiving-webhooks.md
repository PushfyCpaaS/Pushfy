# Recebendo webhooks

Um webhook é um `POST` HTTP que **o Pushfy envia para uma URL sua** no momento em que algo
acontece — uma mensagem é entregue, um push é clicado, uma conversa é transferida. Em vez de
ficar consultando, você recebe os eventos assim que ocorrem.

Este guia percorre a construção de um receptor confiável: suba um endpoint HTTPS público,
**valide a assinatura** (as três variantes), responda `2xx` rápido, **deduplique pelo `eid`** e
processe de forma assíncrona.

Para a mecânica de entrega, retries e formatos de payload, veja a
[visão geral de webhooks](../webhooks/README.md).

---

## Passo 1 — Suba um endpoint HTTPS público

Requisitos que o Pushfy exige:

- **HTTPS público.** HTTP puro, faixas privadas e endereços de loopback são rejeitados ao salvar
  a configuração (anti-SSRF). `https://your-app.com/webhook` serve; `http://localhost` não.
- **Respostas rápidas.** O timeout é de cerca de **12 segundos**. Estoure e a entrega sofre retry.

Configure a URL e um **secret** de assinatura no painel em **Configurações → Webhooks**. Guarde
o secret no servidor; nunca o coloque em código de front-end.

---

## Passo 2 — Conheça sua variante de assinatura

Todo webhook é assinado com **HMAC-SHA256 sobre o corpo bruto** da requisição usando o seu
secret. Há três famílias, e **o cabeçalho e o formato diferem** — é aqui que muita gente
tropeça:

| Webhook | Cabeçalho | Formato |
|---|---|---|
| [Status de mensageria](../webhooks/messaging-status.md) | `X-Pushfy-Signature` | `sha256=<hex>` (com prefixo) |
| [Push](../webhooks/push.md) | `X-Push-Signature` | `sha256=<hex>` (com prefixo) |
| [Conversas](../webhooks/conversations.md) (PushAgent) | `X-PA-Signature` | `<hex>` — **hex puro, sem prefixo** |

> **⚠️ Cuidado com o prefixo.** Mensageria e Push enviam `sha256=<hex>`. Conversas envia
> **apenas o hex puro**. Se você reaproveitar um validador entre produtos, ajuste a comparação.

A receita é a mesma nos dois casos:

```
expected = hmac_sha256_hex(corpo_bruto, secret)
# Mensageria / Push  ->  compare o cabeçalho com  "sha256=" + expected
# Conversas          ->  compare o cabeçalho com  expected      (hex puro)
```

Duas regras que importam:

- Use o **corpo bruto exatamente como recebido** — **não** faça parse e re-serialize o JSON
  antes, ou os bytes (e a assinatura) mudam.
- Compare em **tempo constante** (`hmac.compare_digest`, `crypto.timingSafeEqual`).

---

## Passo 3 — Responda `2xx` rápido, processe assíncrono

Confirme dentro do timeout e depois faça o trabalho pesado. Uma resposta fora de `2xx` (ou
timeout) dispara até **6 retries** com backoff `[imediato, 1m, 5m, 15m, 1h, 3h]`. Então:
valide, enfileire, retorne `200` — e processe fora do caminho da requisição.

---

## Passo 4 — Deduplique pelo `eid`

Retries e raras duplicatas de rede fazem o **mesmo evento chegar mais de uma vez**. Os webhooks
de Push e Conversas carregam um **`eid`** único no corpo JSON e num cabeçalho de entrega
(`X-Push-Delivery` / `X-PA-Delivery`). Guarde os `eid` já vistos e ignore duplicatas, para uma
reentrega ser processada só uma vez.

(O webhook de status de mensageria envia um array de recibos, não um evento envelopado —
deduplique/correlacione esses pelo `ext_id` de cada linha. Veja
[Webhook de status de mensageria](../webhooks/messaging-status.md).)

---

## Handler mínimo — Node / Express

Trata as três variantes: escolha o cabeçalho/prefixo pelo tipo de webhook. Note o
`express.raw` para assinarmos os **bytes exatos**.

```js
const express = require("express");
const crypto = require("crypto");

const app = express();
const SECRET = process.env.WEBHOOK_SECRET;   // de Configurações → Webhooks
const seen = new Set();                       // use Redis/DB em produção

// verify(raw, header, prefixed) -> bool, tempo constante
function verify(raw, header, prefixed) {
  let expected = crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
  if (prefixed) expected = "sha256=" + expected;
  const a = Buffer.from(expected);
  const b = Buffer.from(header || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// corpo bruto — não deixe um parser JSON tocar nos bytes antes de validarmos
app.post("/webhook", express.raw({ type: "*/*" }), (req, res) => {
  const raw = req.body;                        // Buffer

  // Escolha a variante pelo cabeçalho presente:
  let header, prefixed;
  if (req.get("X-Pushfy-Signature")) { header = req.get("X-Pushfy-Signature"); prefixed = true;  }  // mensageria
  else if (req.get("X-Push-Signature")) { header = req.get("X-Push-Signature"); prefixed = true;  }  // push
  else if (req.get("X-PA-Signature"))   { header = req.get("X-PA-Signature");   prefixed = false; }  // conversas
  else return res.sendStatus(401);

  if (!verify(raw, header, prefixed)) return res.sendStatus(401);

  const payload = JSON.parse(raw.toString("utf8"));

  // Dedupe: Push/Conversas carregam um eid; mensageria é um array de recibos.
  const eid = req.get("X-Push-Delivery") || req.get("X-PA-Delivery") || payload.eid;
  if (eid) {
    if (seen.has(eid)) return res.sendStatus(200);  // já tratado
    seen.add(eid);
  }

  res.sendStatus(200);                          // confirme RÁPIDO
  setImmediate(() => process(payload));         // depois trabalhe assíncrono
});

app.listen(3000);
```

---

## Handler mínimo — PHP

```php
<?php
$secret = getenv('WEBHOOK_SECRET');            // de Configurações → Webhooks
$raw    = file_get_contents('php://input');    // bytes exatos — assine estes

// Escolha a variante pelo cabeçalho:
$h = getallheaders();
if (isset($h['X-Pushfy-Signature'])) { $header = $h['X-Pushfy-Signature']; $prefixed = true;  } // mensageria
elseif (isset($h['X-Push-Signature'])) { $header = $h['X-Push-Signature']; $prefixed = true;  } // push
elseif (isset($h['X-PA-Signature']))   { $header = $h['X-PA-Signature'];   $prefixed = false; } // conversas
else { http_response_code(401); exit; }

$expected = hash_hmac('sha256', $raw, $secret);
if ($prefixed) $expected = 'sha256=' . $expected;

if (!hash_equals($expected, $header)) {         // tempo constante
    http_response_code(401); exit;
}

$payload = json_decode($raw, true);

// Dedupe pelo eid (Push/Conversas); mensageria é um array de recibos.
$eid = $h['X-Push-Delivery'] ?? $h['X-PA-Delivery'] ?? ($payload['eid'] ?? null);
if ($eid && already_seen($eid)) { http_response_code(200); exit; }
if ($eid) mark_seen($eid);

http_response_code(200);                        // confirme RÁPIDO
// depois enfileire $payload para processamento assíncrono
```

---

## Checklist

- [ ] Endpoint é **HTTPS público** (sem HTTP/loopback).
- [ ] Valide a assinatura sobre o **corpo bruto**, em **tempo constante**.
- [ ] Use o cabeçalho + prefixo certos para cada família de webhook.
- [ ] Devolva `401` em assinatura inválida; **`2xx` rápido** em uma válida.
- [ ] **Deduplique pelo `eid`** (ou `ext_id` para recibos de mensageria).
- [ ] Processe de forma **assíncrona**, depois de confirmar.
- [ ] Deixe os handlers **idempotentes** — presuma que qualquer evento pode ser reentregue.

---

## Próximos passos

- [Visão geral de webhooks](../webhooks/README.md) — ciclo de entrega e boas práticas.
- [Webhook de status de mensageria](../webhooks/messaging-status.md) ·
  [Webhook de Push](../webhooks/push.md) ·
  [Webhook de Conversas](../webhooks/conversations.md).
- [Autenticação](../reference/authentication.md).
