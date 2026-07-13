# FAQ da API

Respostas curtas e diretas para as dúvidas mais comuns, agrupadas por tema. Para o detalhe
completo, siga os links para a referência, os webhooks e os guias.

---

## Primeiros passos

### Como pego minha API key / token?

No painel: **Configurações → Tokens de API**. Copie o token e envie como token Bearer em toda
requisição de mensageria. Para os produtos HMAC (API de servidor do Push, PushAgent) crie uma
chave em **Configurações → Chaves de API** — o secret é mostrado **só uma vez**, então guarde-o na
hora. Veja [Autenticação](./reference/authentication.md).

### Preciso de cartão para testar?

As condições de teste dependem do seu plano. Fale com seu gerente de conta para combinar um teste
ou créditos de avaliação — ele libera o acesso.

### Qual é a base URL?

Duas, conforme o produto:

- **Mensageria** (SMS/RCS/Voz, status, saldo) — `https://portal.pushfy.com` (ex.: `/webapi`,
  `/getstatus`, `/balance`).
- **Push e IA Conversacional (V2)** — `https://portal.pushfy.com/v2/api.php?r=<path>`, ex.:
  `.../v2/api.php?r=/v1/conversations`.

Guarde as credenciais no servidor. A única credencial destinada ao navegador é o `app_id` público
do Push.

---

## Autenticação

### Quais formas de autenticação existem?

Depende do produto:

- **Mensageria** — token Bearer (`Authorization: Bearer …`). Duas alternativas são aceitas:
  `X-API-TOKEN: …` ou `Authorization: Basic base64(login:senha)`.
- **Push (navegador/dispositivo)** — `app_id` público no corpo ou na query.
- **Push (servidor) e PushAgent** — HMAC-SHA256 com headers `X-PUSH-*` / `X-PA-*`.

Veja [Autenticação](./reference/authentication.md).

### Como assino uma requisição HMAC?

Monte `timestamp + "\n" + METODO + "\n" + path + "\n" + sha256_hex(body)` e aplique HMAC-SHA256
com seu secret. `METODO` em maiúsculas, `path` é a rota **sem** a query string, e `body` é o corpo
bruto exato. Receita completa e exemplo em [Autenticação](./reference/authentication.md).

### Recebi 401 — o que devo verificar?

- O token/chave e a assinatura estão corretos.
- O `timestamp` está dentro de **±300 segundos** de agora (janela de replay do HMAC).
- O `path` assinado está **sem query string**.
- O `body` assinado é o **corpo bruto exato** que você envia — não faça parse e re-serialize antes.

Veja [Autenticação](./reference/authentication.md) e [Erros e limites](./reference/errors.md).

### Existe restrição por IP?

Sim — opcional. Sua conta pode ter uma lista de IPs permitidos; requisições de outros IPs são
rejeitadas com `403 ip_not_allowed`. Gerencie a lista com seu gerente de conta.

---

## SMS

### Qual é o formato do telefone?

Só dígitos, DDI (código do país) primeiro — ex.: `5511999999999`. Não-dígitos são removidos
automaticamente. Mínimo de 8 dígitos. Veja [Enviar SMS](./reference/sms.md).

### Como envio em massa?

Passe vários objetos em `messages` no `POST /webapi` — **até 100.000 por requisição**. Cada um é
independente e retorna sua própria linha. Veja [Enviar SMS](./reference/sms.md) e o
[guia de envio em massa](./guides/bulk-sending.md).

### Qual é o formato da resposta?

Um **array**, um objeto por mensagem: `[{ "id", "phone", "date", "ext_id" }]`. **Não** é um objeto
`{accepted, queued}` — não programe contra esse formato. Guarde o `ext_id` para consultar status.
Veja [Enviar SMS](./reference/sms.md).

### Mensagens longas contam como quantas?

Mensagens acima de 160 caracteres são enviadas em vários **segmentos** e tarifadas por segmento —
cerca de **1 segmento a cada ~157 caracteres**. Veja [Enviar SMS](./reference/sms.md).

### O campo `from` funciona?

Não. O remetente/marca é **fixo por conta**; um campo `from` é ignorado.

---

## RCS

### Preciso de campanha?

Depende do endpoint:

- `POST /apircsnativo.php` — exige uma campanha **"API RCS"** já provisionada; sem ela retorna
  `400 rcs_campaign_not_found`.
- `POST /rcs` — **cria a campanha sozinho**, sem provisionamento.
- `POST /rcscampaign?cid=<ID>` — anexa a uma campanha específica sua.

Veja [Enviar RCS](./reference/rcs.md).

---

## Voz

### Como envio uma ligação de voz?

Em dois passos: primeiro crie o áudio com `POST /audio` (envie um `.mp3` e receba um id de áudio),
depois dispare a ligação com `POST /webapi` colocando esse id no campo `audio`. Uma mensagem em
`/webapi` que carrega um id de `audio` é discada como voz. Veja [Enviar Voz](./reference/voice.md).

### Existe um endpoint `/apitvoz`?

Não. `/apitvoz` **não existe** e retorna `404`. Use o fluxo de dois passos acima.

---

## Status e saldo

### Como sei se a mensagem foi entregue?

De duas formas: consulte `GET /getstatus?ext_id=…` (por mensagem), `/getdate` (por dia) ou
`/reportbydate` (por período); ou receba [webhooks de status](./webhooks/messaging-status.md) para
ter as atualizações empurradas até você, sem polling. Veja
[Status de entrega](./reference/status.md).

### O que significam os status?

`Delivered`, `Sent`, `Undelivered`, `Rejected`, `Blocked`, `No credits`, `Clicked` e outros — mais
os desfechos exclusivos de voz (`Answered`, `Not Answered`, …). Glossário completo em
[Status de entrega](./reference/status.md) e [Erros e limites](./reference/errors.md).

### Como vejo o saldo?

`GET /balance` retorna `{"saldo":"1.500"}` — o saldo de SMS como **string formatada** com separador
de milhar (`"1.500"` = mil e quinhentos), então remova o separador antes de fazer contas. **Não há
endpoint público de saldo de voz.** Veja [Saldo](./reference/balance.md).

---

## Webhooks

### Como recebo status na minha URL?

Configure um webhook no painel (**Configurações → Webhooks**) com sua URL HTTPS pública e um secret
de assinatura. A Pushfy então faz POST dos recibos de entrega (e das respostas recebidas) para
você. Veja [Webhook de status de mensageria](./webhooks/messaging-status.md) e a
[visão geral de Webhooks](./webhooks/README.md).

### Por que a assinatura do PushAgent não tem `sha256=`?

Porque o PushAgent (Conversations) envia a assinatura como **hex puro, sem prefixo**. Mensageria
(`X-Pushfy-Signature`) e Push (`X-Push-Signature`) enviam **com prefixo**: `sha256=<hex>`. Se você
copiar um validador entre produtos, ajuste a comparação. Veja a
[visão geral de Webhooks](./webhooks/README.md).

### Como valido um webhook?

Calcule o HMAC-SHA256 sobre o **corpo bruto** com seu secret e compare em **tempo constante**
(`hmac.compare_digest` / `crypto.timingSafeEqual`). Assine os bytes exatos recebidos — nunca faça
parse e re-serialize o JSON antes. Veja a [visão geral de Webhooks](./webhooks/README.md).

### Vocês reenviam entregas que falham?

Sim. Uma resposta não-`2xx` ou timeout dispara até **6 tentativas** com backoff
(`[imediato, 1 min, 5 min, 15 min, 1 h, 3 h]`). Responda `2xx` rápido e processe de forma
assíncrona. Veja a [visão geral de Webhooks](./webhooks/README.md).

### Como evito processar um evento duas vezes?

Deduplique por **`eid`** — toda entrega de Push/Conversations traz um `eid` único (no corpo e no
header `X-*-Delivery`). Registre os `eid`s já vistos para tratar uma reentrega uma única vez. Veja
a [visão geral de Webhooks](./webhooks/README.md).

---

## Limites e erros

### Quais são os rate limits?

Variam por API (ex.: PushAgent 300/60s, Push 600–1200/60s conforme o escopo). Tabela completa em
[Erros e limites](./reference/errors.md).

### O que faço no 429?

Aplique **backoff exponencial** (1s, 2s, 4s, 8s… mais jitter) e retome — não repita em loop
apertado. Veja [Erros e limites](./reference/errors.md).

### Recebi timeout no envio — devo reenviar?

**Não cegamente.** A requisição pode ter tido sucesso no servidor, então um reenvio cego arrisca
**cobrança duplicada**. Consulte o status pelo `ext_id` primeiro e só reenvie se realmente não
tiver saído. Veja [Status de entrega](./reference/status.md) e o
[guia de repetição e tratamento de erros](./guides/error-handling.md).

---

## Idempotência

### Como garanto que não duplico?

- **Mensageria** — defina seu próprio `ext_id` em cada mensagem e reutilize-o nas repetições;
  depois consulte por `ext_id` antes de reenviar após um timeout.
- **API de servidor do Push** — envie o header `Idempotency-Key` (≤120 chars) nas chamadas de
  escrita; repetir a mesma chave devolve a resposta original em vez de agir duas vezes.

Veja [Autenticação](./reference/authentication.md) e [Erros e limites](./reference/errors.md).

---

## SDKs e ferramentas

### Vocês têm SDK?

Sim. Há SDKs cliente disponíveis — veja a seção de SDKs no portal do desenvolvedor (`/sdks`).

### Tem OpenAPI ou coleção Postman?

Sim para os dois: uma especificação OpenAPI (`/openapi`) e uma coleção Postman (`/postman`) estão
disponíveis no portal do desenvolvedor.

---

## Próximos passos

- [Autenticação](./reference/authentication.md)
- [Enviar SMS](./reference/sms.md)
- [Status de entrega](./reference/status.md)
- [Erros e limites](./reference/errors.md)
- [Webhooks](./webhooks/README.md)
