# Status de entrega

Verifique se suas mensagens foram entregues. Há três formas de consultar — por mensagem,
por dia ou por período — além de um auxiliar para listar números bloqueados.

- **URL base** — `https://portal.pushfy.com`
- **Método** — `GET`
- **Auth** — Token Bearer ou Basic ([Autenticação](./authentication.md))

Não existe consulta "por campanha". Para puxar um envio inteiro, consulte por dia ou por período.

## Headers

```
Authorization: Bearer SEU_TOKEN
```

Auth Basic (`login:senha`) também é aceita.

## 1. Por mensagem — `/getstatus`

Consulte uma mensagem pelo `ext_id` com que ela foi enviada (ou pelo `uid` interno).

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `ext_id` | ✅ | Seu id de referência, como enviado na mensagem |
| `uid` | — | Id interno da mensagem (alternativa ao `ext_id`) |

### Requisição

```bash
curl 'https://portal.pushfy.com/getstatus?ext_id=SEU_EXT_ID' \
  -H 'Authorization: Bearer SEU_TOKEN'
```

### Resposta

`200 OK` — um **array** com um objeto por mensagem encontrada:

```json
[
  {
    "phone": "5511999999999",
    "status": "Delivered",
    "date": "2026-07-12 14:33:21",
    "channel": "SMS",
    "statustvoz": "Answered"
  }
]
```

- `status` — veja o [glossário de status](#glossario-de-status) abaixo.
- `channel` — `SMS`, `RCS` ou `TVOZ` (voz).
- `statustvoz` — resultado da ligação; só faz sentido quando `channel` é `TVOZ`.

### Erros

| HTTP | Corpo | Causa |
|---|---|---|
| 400 | `id parameter is missing` | Nem `ext_id` nem `uid` foram informados |
| 401 | `Unauthorized` | Credenciais ausentes/inválidas |
| 404 | `Messages not found` | Nenhuma mensagem corresponde ao id |
| 503 | — | Sob carga, temporariamente limitado — repita com backoff |

Os corpos de erro são texto puro.

## 2. Por dia — `/getdate`

Retorna o status de todas as mensagens de uma data.

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `date` | ✅ | Dia a consultar, `YYYY-MM-DD` |

### Requisição

```bash
curl 'https://portal.pushfy.com/getdate?date=2026-07-12' \
  -H 'Authorization: Bearer SEU_TOKEN'
```

### Resposta

`200 OK` — um **array**, um objeto por mensagem:

```json
[
  {
    "phone": "5511999999999",
    "status": "Delivered",
    "date": "2026-07-12 14:33:21",
    "date_dlr": "2026-07-12 14:33:40",
    "ext_id": "pedido-1042",
    "channel": "SMS",
    "brand": "SUA_MARCA"
  }
]
```

`date_dlr` é quando o recibo de entrega da operadora (DLR) chegou.

### Erros

| HTTP | Corpo | Causa |
|---|---|---|
| 400 | `date parameter is missing` | `date` não informado |
| 400 | `invalid date format (YYYY-MM-DD required)` | Formato errado |
| 400 | `invalid date value` | Formato ok, mas não é uma data real |
| 404 | `Messages not found` | Nenhuma mensagem naquele dia |

## 3. Por período — `/reportbydate`

Relatório paginado sobre um dia ou um intervalo de datetime, com filtros opcionais.

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `date` | — | Um único dia, `YYYY-MM-DD` |
| `start` | — | Início do intervalo, datetime — **tem precedência** sobre `date` |
| `end` | — | Fim do intervalo, datetime — **tem precedência** sobre `date` |
| `date_dlr` | — | Filtra pela data do recibo de entrega |
| `event` | — | Filtra por status (nome em inglês, veja o glossário) |
| `limit` | — | Máx. de linhas, até `5000` (padrão `1000`) |
| `offset` | — | Linhas a pular, para paginação |

Passe `date` ou `start`+`end`. Quando ambos estão presentes, `start`+`end` prevalecem.

### Requisição

```bash
curl 'https://portal.pushfy.com/reportbydate?start=2026-07-12+00:00:00&end=2026-07-12+23:59:59&event=Delivered&limit=1000' \
  -H 'Authorization: Bearer SEU_TOKEN'
```

### Resposta

`200 OK` — um **array**, um objeto por mensagem:

```json
[
  {
    "id": "123456",
    "timestamp": "2026-07-12 14:33:21",
    "date_dlr": "2026-07-12 14:33:40",
    "event": "Delivered",
    "recipient": "5511999999999",
    "label": "pedido-1042",
    "message": "Seu pedido #1042 foi enviado",
    "channel": "SMS",
    "status_code": "0",
    "cost": "0.06"
  }
]
```

Aqui `channel` é `SMS`, `VOICE`, `RCS` ou `WHATSAPP`. Pagine com `limit`/`offset`.

## Glossário de status

Valores possíveis de `status` / `event`:

| Valor | Significado |
|---|---|
| `Waiting` | Na fila, ainda não despachada |
| `Sent` | Entregue à operadora |
| `Releasing` | A caminho da operadora |
| `Delivered` | Entrega confirmada no aparelho |
| `Clicked` | Destinatário clicou em um link rastreado |
| `Undelivered` | Operadora reportou não-entrega |
| `Expired` | Janela de validade expirou antes da entrega |
| `Rejected` | Rejeitada pela operadora |
| `Invalid` | Número inválido |
| `Blocked` | Número está na sua lista de bloqueio |
| `Duplicate` | Filtrada como duplicada |
| `Characters Exceeded` | Corpo acima do tamanho permitido |
| `Strike` | Suprimida pela proteção strike (não-entrega repetida) |
| `No credits` | Saldo insuficiente |

### Status de voz (`statustvoz`)

Somente para ligações:

| Valor | Significado |
|---|---|
| `Waiting` | Na fila |
| `Called` | Ligação realizada |
| `Answered` | Ligação atendida |
| `Not Answered` | Ligação não atendida |
| `Invalid audio` | Áudio não pôde ser reproduzido |
| `Fail` | Falha na ligação |

## Números bloqueados — `/strikeapi`

Lista os números atualmente bloqueados pela proteção strike.

```bash
curl 'https://portal.pushfy.com/strikeapi' \
  -H 'Authorization: Bearer SEU_TOKEN'
```

`200 OK` — um **array**:

```json
[
  {
    "phone_number": "5511999999999",
    "block_reason": "repeated_undelivered",
    "undelivered_total": 5,
    "blocked_at": "2026-07-01 09:15:00"
  }
]
```

## Observações

- **Guarde seu `ext_id`.** Armazenar o id de referência no envio torna o `/getstatus` a
  consulta mais rápida. Veja [Enviar SMS](./sms.md).
- **Status são eventuais.** Uma mensagem pode ficar em `Waiting`/`Sent` até chegar o DLR de
  `Delivered`; consulte de novo ou use [webhooks de status](../webhooks/messaging-status.md)
  para receber as atualizações em vez de ficar consultando.
- **Sob carga, o `/getstatus` pode retornar `503`.** Repita com backoff exponencial.
- **Paginação.** O `/reportbydate` limita a `5000` linhas por página; pagine com `limit`/`offset`.

Veja [Erros e limites](./errors.md).
