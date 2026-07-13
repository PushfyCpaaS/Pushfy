# Envie sua primeira mensagem

Este guia leva você do zero a um SMS entregue em quatro passos: pegar o token, enviar uma
mensagem, ler a resposta e consultar o status de entrega. Todo comando é um `curl` real que
você pode copiar — basta trocar os placeholders.

No fim você terá entendido as duas coisas que mais importam na API de Mensageria do Pushfy:
**a resposta de envio é um array** e **o `ext_id` é como você correlaciona a mensagem
depois**.

---

## Antes de começar

Você precisa de:

- Uma conta Pushfy com Mensageria habilitada.
- Um terminal com `curl`.
- Um número de teste que você controla, em **só dígitos, com DDI primeiro** — ex.:
  `5511999999999`.

---

## Passo 1 — Pegue seu token de API

Seu token fica no painel em **Configurações → Tokens de API**. Copie e guarde-o
**no servidor** — nunca coloque um token de mensageria em um navegador ou app mobile.

Toda requisição de Mensageria leva o token como header Bearer:

```
Authorization: Bearer SEU_TOKEN
```

Duas alternativas são aceitas, se preferir — `X-API-TOKEN: SEU_TOKEN`, ou HTTP Basic com o
login e a senha da sua conta. Veja [Autenticação](../reference/authentication.md) para os
detalhes.

Uma forma rápida de confirmar que o token funciona é ler seu saldo:

```bash
curl 'https://portal.pushfy.com/balance' \
  -H 'Authorization: Bearer SEU_TOKEN'
```

```json
{ "saldo": "1.500" }
```

`saldo` é o seu saldo de SMS como **string formatada** (`"1.500"` = mil e quinhentos). Se
receber `unauthorized`, o token está errado; se receber `ip_not_allowed`, sua conta tem uma
lista de IPs permitidos — veja [Saldo](../reference/balance.md) e
[Autenticação](../reference/authentication.md).

---

## Passo 2 — Envie um SMS

Envie SMS com `POST /webapi`. Ele **enfileira** a mensagem e responde na hora, que é o que
você quer para qualquer coisa além de um envio pontual.

Repare em duas coisas no corpo abaixo:

- `ext_id` — **seu** id de referência. Defina você mesmo para conseguir consultar a
  mensagem depois. Se omitir, um é gerado para você e devolvido na resposta.
- `destinations` é uma lista, mas **apenas o primeiro item é usado**. Um destinatário por
  mensagem; adicione mais objetos em `messages` para mais destinatários.

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "ola-001",
        "destinations": [{ "to": "5511999999999" }],
        "text": "Olá do Pushfy 👋"
      }
    ]
  }'
```

`Content-Type: application/json` é obrigatório. Veja [Enviar SMS](../reference/sms.md) para
a referência completa dos campos.

---

## Passo 3 — Leia a resposta

Um envio bem-sucedido retorna **`200 OK` com um array JSON** — um objeto por mensagem, na
mesma ordem em que você enviou:

```json
[
  {
    "id": "ola-001",
    "phone": "5511999999999",
    "date": "2026-07-12 14:33:21",
    "ext_id": "ola-001"
  }
]
```

> **A resposta é sempre um array — mesmo para uma única mensagem.** Itere sobre ela; não
> leia `response.id` como se fosse um objeto. Esse é o erro de primeira viagem mais comum, e
> a documentação antiga descrevia um formato diferente.

Guarde o `ext_id` de cada linha junto dos seus registros. Essa é a sua chave para o Passo 4.

Um `200` aqui significa que o Pushfy **aceitou e enfileirou** a mensagem — não que ela
chegou ao aparelho ainda. A entrega é confirmada à parte.

---

## Passo 4 — Consulte o status de entrega pelo `ext_id`

Consulte a mensagem com `GET /getstatus` usando o `ext_id` com que a enviou:

```bash
curl 'https://portal.pushfy.com/getstatus?ext_id=ola-001' \
  -H 'Authorization: Bearer SEU_TOKEN'
```

A resposta **também é um array**, um objeto por mensagem encontrada:

```json
[
  {
    "phone": "5511999999999",
    "status": "Delivered",
    "date": "2026-07-12 14:33:21",
    "channel": "SMS",
    "statustvoz": null
  }
]
```

O `status` percorre o ciclo de vida da mensagem — pode aparecer como `Waiting` ou `Sent` por
um instante antes de o recibo `Delivered` (DLR) chegar da operadora. Se for o caso, consulte
de novo um pouco depois. A lista completa de valores está no
[glossário de status](../reference/status.md#glossário-de-status).

> Sob carga alta, o `/getstatus` pode responder `503`. É temporário — repita com um pequeno
> backoff.

---

## O que você acabou de aprender

- Pegue o token em **Configurações → Tokens de API** e guarde-o no servidor.
- `POST /webapi` enfileira um SMS e retorna um **array JSON**.
- Defina seu próprio **`ext_id`** para correlacionar a mensagem depois.
- `GET /getstatus?ext_id=...` retorna o status de entrega — também um array.

---

## Próximos passos

- Em vez de consultar mensagem a mensagem, receba os recibos de entrega via
  [webhook de status de mensageria](../webhooks/messaging-status.md).
- Envie em escala — veja [Envie milhares de mensagens](./bulk-sending.md).
- Repita com segurança sem cobrar em dobro — veja [Tratando erros](./error-handling.md).
- Adicione cards RCS ricos ou ligações de voz — veja [Enviar RCS](../reference/rcs.md) e
  [Enviar Voz](../reference/voice.md).
