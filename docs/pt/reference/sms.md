# Enviar SMS

Envie uma ou várias mensagens de texto em uma única requisição.

- **URL** — `https://portal.pushfy.com/webapi`
- **Método** — `POST`
- **Auth** — Token Bearer ([Autenticação](./authentication.md))
- **Content-Type** — `application/json` (obrigatório)

O `/webapi` enfileira as mensagens e responde na hora (recomendado para volume). Existe a variante
síncrona `POST /api`, com o mesmo formato de requisição/resposta, que grava as mensagens inline.

## Headers

```
Authorization: Bearer SEU_TOKEN
Content-Type: application/json
```

## Corpo (Body)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `messages` | array | ✅ | Uma ou mais mensagens (até 100.000 por requisição) |
| `messages[].destinations` | array | ✅ | Lista de destinatários — **apenas o primeiro é usado** |
| `messages[].destinations[].to` | string | ✅ | Telefone, só dígitos, com DDI primeiro (ex.: `5511999999999`). Mín. 8 dígitos |
| `messages[].text` | string | ✅ | Texto da mensagem (até 10.000 chars; excedente é truncado) |
| `messages[].ext_id` | string | — | Seu id de referência, devolvido na resposta e usado na consulta de status. Gerado automaticamente se omitido |
| `messages[].audio` | string | — | Id de áudio — transforma a mensagem em **ligação de voz** ([Enviar Voz](./voice.md)) |

## Requisição

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "pedido-1042",
        "destinations": [{ "to": "5511999999999" }],
        "text": "Seu pedido #1042 foi enviado 🚚"
      }
    ]
  }'
```

## Resposta

`200 OK` — um **array** com um objeto por mensagem:

```json
[
  {
    "id": "pedido-1042",
    "phone": "5511999999999",
    "date": "2026-07-12 14:33:21",
    "ext_id": "pedido-1042"
  }
]
```

Guarde o `ext_id` para [consultar o status](./status.md) depois.

## Envio em massa

Passe vários objetos em `messages`. Cada um é independente e retorna sua própria linha.

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "ext_id": "b1", "destinations": [{ "to": "5511999990001" }], "text": "Oi Ana" },
      { "ext_id": "b2", "destinations": [{ "to": "5511999990002" }], "text": "Oi Bruno" }
    ]
  }'
```

Veja o [guia de envio em massa](../guides/bulk-sending.md) para lotes de dezenas de milhares.

## Erros

| HTTP | Corpo | Causa |
|---|---|---|
| 400 | `invalid_json` | Corpo não é JSON válido |
| 400 | `invalid_payload` / `empty` | `messages` ausente ou vazio |
| 400 | `max_100000` | Mais de 100.000 mensagens em uma requisição |
| 401 | `unauthorized` | Token ausente/inválido |
| 403 | `ip_not_allowed` | IP de origem fora da lista permitida da conta |
| 405 | `method_not_allowed` | Use `POST` |
| 413 | `payload_too_large` | Corpo excede o limite de tamanho |
| 415 | `invalid_content_type` | Falta `Content-Type: application/json` |
| 500 | `db_error` / `insert_error` | Erro temporário — pode repetir |

Veja [Erros e limites](./errors.md) e o [guia de retry](../guides/error-handling.md).

## Observações

- **Assíncrono por natureza.** O `/webapi` aceita e enfileira; a entrega ocorre logo em seguida.
  Acompanhe o resultado pelos [endpoints de status](./status.md) ou por
  [webhooks de status](../webhooks/messaging-status.md).
- **Formato do telefone.** Só dígitos, DDI primeiro. Não-dígitos são removidos automaticamente.
- **Um destinatário por mensagem.** Só `destinations[0].to` é usado; para mais destinatários,
  adicione mais objetos em `messages`.
- **Mensagens longas.** Acima de 160 caracteres, o SMS é enviado em múltiplos segmentos e tarifado
  por segmento (1 segmento a cada ~157 chars).
- **Remetente.** O remetente/marca é fixo por conta; um campo `from` é ignorado.
