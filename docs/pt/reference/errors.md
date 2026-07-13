# Erros e limites

Como a API Pushfy sinaliza falhas, os códigos que você pode esperar e como repetir requisições com segurança.

## Dois formatos de erro

A Pushfy abrange duas gerações de API, que reportam erros de formas diferentes. Verifique qual delas você está chamando.

**Mensageria (API clássica)** — a maioria dos endpoints responde com um objeto JSON:

```json
{ "error": "unauthorized" }
```

Alguns **endpoints de status respondem em TEXTO puro** em vez de JSON (ex.: `Unauthorized`,
`Messages not found`, `id parameter is missing`). Não presuma que toda resposta da mensageria é
JSON — verifique o `Content-Type` ou recorra ao corpo bruto quando o status não for `200`.

**API V2 (Push / PushAgent)** — sempre um objeto JSON com um campo `ok`:

```json
{ "ok": false, "error": "rate_limited" }
```

No sucesso a V2 retorna `"ok": true`; na falha, `"ok": false` mais uma string `error`.

## Códigos HTTP

| HTTP | Significado |
|---|---|
| `200` | OK |
| `204` | Sem conteúdo (preflight CORS) |
| `400` | Requisição inválida |
| `401` | Não autorizado |
| `403` | Proibido (`ip_not_allowed` / `produto_inativo` / origem não autorizada) |
| `404` | Não encontrado |
| `405` | Método não permitido |
| `413` | Payload grande demais |
| `415` | Content-type inválido |
| `429` | Limite de taxa excedido |
| `500` | Erro interno |
| `503` | Sobrecarregado — temporário, tente novamente depois |

## Strings de erro — Mensageria

| String | HTTP | Significado | O que fazer |
|---|---|---|---|
| `unauthorized` | 401 | Token ausente ou inválido | Confira seu token Bearer ([Autenticação](./authentication.md)) |
| `ip_not_allowed` | 403 | IP de origem fora da allow-list | Adicione o IP ou chame de um host permitido |
| `method_not_allowed` | 405 | Método HTTP errado | Use `POST` |
| `invalid_content_type` | 415 | Content-type ausente/errado | Envie `Content-Type: application/json` |
| `payload_too_large` | 413 | Corpo excede o limite de tamanho | Divida em lotes menores |
| `invalid_json` | 400 | Corpo não é JSON válido | Corrija o JSON |
| `invalid_payload` / `empty` | 400 | `messages` ausente ou vazio | Inclua ao menos uma mensagem |
| `max_100000` | 400 | Mais de 100.000 mensagens numa requisição | Reduza o lote abaixo do limite |
| `rcs_campaign_not_found` | 400 | Campanha RCS referenciada não existe | Confira o id da campanha |
| `cid_required` | 400 | Id da campanha ausente | Informe o `cid` |
| `invalid_campaign` | 403 | Campanha não pertence a esta conta | Use uma campanha sua |
| `db_error` / `insert_error` | 500 | Erro temporário do servidor | Seguro repetir com backoff |

### Endpoints de status (texto puro)

| Corpo | HTTP | Significado | O que fazer |
|---|---|---|---|
| `Unauthorized` | 401 | Token ausente ou inválido | Confira seu token |
| `id parameter is missing` | 400 | `id` obrigatório não enviado | Passe o `id`/`ext_id` da mensagem |
| `date parameter is missing` | 400 | `date` obrigatório não enviado | Passe o `date` |
| `Messages not found` | 404 | Nenhuma mensagem corresponde à consulta | Verifique o id/data |

## Strings de erro — V2 (Push / PushAgent)

| String | HTTP | Significado | O que fazer |
|---|---|---|---|
| `unauthorized` | 401 | Header ausente, assinatura inválida ou timestamp fora da janela | Reassine a requisição ([Autenticação](./authentication.md)) |
| `produto_inativo` | 403 | Produto não habilitado na conta | Ative-o no painel |
| `rate_limited` | 429 | Requisições em excesso | Aplique backoff e tente de novo (veja abaixo) |
| `rota` / `rota_desconhecida` / `nao_encontrada` | 404 | Rota desconhecida | Confira o caminho em `r` |
| `metodo` | 405 | Método HTTP errado | Use o método documentado |
| `internal` | 500 | Erro do servidor | Repita com backoff |

A V2 também retorna `400` com o **nome do campo** como string de erro quando um campo obrigatório
está ausente ou inválido — por exemplo `app_id`, `token`, `user_ext_id`, `content`, `type`,
`run_at`, `name`.

## Limites de taxa (rate limits)

| API | Escopo | Limite |
|---|---|---|
| **PushAgent API** | Por IP (pré-auth) | 300 / 60s |
| | Por conta | 300 / 60s |
| **Push API** | Por IP do SDK | 600 / 60s |
| | Por app público | 1200 / 60s |
| | Por conta (HMAC) | 600 / 60s |

Ao exceder um limite, a API responde:

```
HTTP 429
{ "ok": false, "error": "rate_limited" }
```

Use **backoff exponencial** — espere e repita com um atraso crescente (ex.: 1s, 2s, 4s, 8s…) mais
um pouco de jitter aleatório. Não repita em loop apertado.

## Boas práticas

- **Repita `5xx` e timeouts** com uma repetição **idempotente**. Reutilize o mesmo `ext_id`
  (mensageria) ou `Idempotency-Key` (Push server API) para que uma chamada repetida não crie
  duplicata.
- **Respeite o `429`.** Pare, aplique backoff exponencial e só então retome.
- **Nunca reenvie cegamente após um timeout de envio** — a requisição pode ter tido sucesso no
  servidor, então um reenvio cego arrisca **cobrança duplicada**. Em vez disso,
  [consulte o status](./status.md) pelo `ext_id` e só reenvie se realmente não tiver saído.

Veja o [guia de repetição e tratamento de erros](../guides/error-handling.md) para exemplos práticos.

## Glossário de status de entrega (mensageria)

Estes são desfechos reportados pelos [endpoints de status](./status.md) e pelos
[webhooks de status](../webhooks/messaging-status.md), não erros de requisição:

| Status | Significado |
|---|---|
| `Sent` | Repassada à operadora |
| `Delivered` | Entrega confirmada no dispositivo |
| `Undelivered` | Operadora não conseguiu entregar |
| `Expired` | Janela de validade expirou antes da entrega |
| `Invalid` | Número de destino inválido |
| `Blocked` | Destinatário/número bloqueado |
| `No credits` | Conta sem saldo para esta mensagem |
| `Rejected` | Rejeitada pela operadora ou plataforma |
| `Duplicate` | Detectada como duplicata |
| `Characters Exceeded` | Corpo acima do tamanho permitido |
| `Strike` | Suprimida pela otimização Strike |
| `Clicked` | Destinatário clicou num link rastreado |
| `Releasing` | Em liberação para a operadora |
| `Waiting` | Na fila, aguardando disparo |

### Status exclusivos de voz

| Status | Significado |
|---|---|
| `Called` | Ligação realizada |
| `Answered` | Ligação atendida |
| `Not Answered` | Não atendida |
| `Invalid audio` | Id de áudio inválido ou inutilizável |
| `Fail` | Ligação falhou |

## Próximos passos

- [Autenticação](./authentication.md)
- [Consultar status de entrega](./status.md)
- [Webhooks](../webhooks/README.md)
