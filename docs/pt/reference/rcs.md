# Enviar RCS

Envie um ou vários cards RCS (título, imagem, texto, botão com link) em uma única requisição.

- **URL** — `https://portal.pushfy.com/apircsnativo.php`
- **Método** — `POST`
- **Auth** — Token Bearer ([Autenticação](./authentication.md))
- **Content-Type** — `application/json` (obrigatório)

O `/apircsnativo.php` enfileira os cards RCS em uma campanha **"API RCS"** já existente na conta
(recomendado). Se a conta ainda não tiver essa campanha provisionada, a chamada retorna
`400 {"error":"rcs_campaign_not_found"}` — veja [Variações](#variacoes) para endpoints que criam a
campanha para você.

## Headers

```
Authorization: Bearer SEU_TOKEN
Content-Type: application/json
```

## Corpo (Body)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `messages` | array | ✅ | Um ou mais cards RCS |
| `messages[].destinations` | array | ✅ | Lista de destinatários — **apenas o primeiro é usado** |
| `messages[].destinations[].to` | string | ✅ | Telefone, só dígitos, com DDI primeiro (ex.: `5511999999999`) |
| `messages[].text` | string | ✅ | Texto (corpo) do card |
| `messages[].title` | string | — | Título do card (cabeçalho) |
| `messages[].image` | string | — | URL da imagem exibida no topo do card |
| `messages[].url` | string | — | Link de destino aberto pelo botão |
| `messages[].cta` | string | — | Texto do botão (call to action) |
| `messages[].ext_id` | string | — | Seu id de referência, devolvido na resposta e usado na consulta de status. Gerado automaticamente se omitido |

## Requisição

```bash
curl -X POST 'https://portal.pushfy.com/apircsnativo.php' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "pedido-1042",
        "destinations": [{ "to": "5511999999999" }],
        "title": "Seu pedido foi enviado",
        "image": "https://cdn.example.com/caixa.png",
        "text": "O pedido #1042 está a caminho 🚚",
        "url": "https://loja.example.com/pedidos/1042",
        "cta": "Acompanhar pedido"
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

## Variações

### Criar a campanha automaticamente — `POST /rcs`

A opção mais simples: **cria a campanha automaticamente**, sem necessidade de provisionamento. Aqui
o `to` vai direto em cada mensagem (não dentro de `destinations`).

```bash
curl -X POST 'https://portal.pushfy.com/rcs' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "to": "5511999999999",
        "title": "Seu pedido foi enviado",
        "text": "O pedido #1042 está a caminho 🚚",
        "url": "https://loja.example.com/pedidos/1042",
        "cta": "Acompanhar pedido",
        "image": "https://cdn.example.com/caixa.png"
      }
    ]
  }'
```

Resposta:

```json
{ "status": "ok", "campaign_id": 12345, "inserted": 8 }
```

### Enviar para uma campanha existente — `POST /rcscampaign?cid=<ID>`

Direciona para uma campanha que você já possui. O `cid` é obrigatório e validado como pertencente à
sua conta. As mensagens usam `destinations[].to` mais `text` e um `ext_id` opcional.

```bash
curl -X POST 'https://portal.pushfy.com/rcscampaign?cid=12345' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "pedido-1042",
        "destinations": [{ "to": "5511999999999" }],
        "text": "O pedido #1042 está a caminho 🚚"
      }
    ]
  }'
```

A resposta inclui o `cid` da campanha em que as mensagens foram inseridas.

## Erros

| HTTP | Corpo | Causa |
|---|---|---|
| 400 | `rcs_campaign_not_found` | `apircsnativo.php` — sem campanha **"API RCS"** provisionada na conta |
| 400 | `cid_required` | `rcscampaign` — parâmetro `cid` ausente na query |
| 401 | `unauthorized` | Token ausente/inválido |
| 403 | `ip_not_allowed` | IP de origem fora da lista permitida da conta |
| 403 | `invalid_campaign` | `rcscampaign` — `cid` não pertence à sua conta |

Veja [Erros e limites](./errors.md) e o [guia de retry](../guides/error-handling.md).

## Observações

- **Aliases dos campos (português).** O servidor também aceita estes aliases para os campos do card:
  `titulo` (title); `texto` / `body` / `mensagem` (text); `imagem` / `image_url` / `img` (image);
  `link` / `destino` (url); `botao` / `button` / `label` (cta). Prefira os campos separados acima
  para maior clareza.
- **Um destinatário por mensagem.** Só `destinations[0].to` é usado (ou o `to` no nível da mensagem
  no `/rcs`); para mais destinatários, adicione mais objetos em `messages`.
- **Ressalvas do `/rcs`.** Os campos `image_data` e `id` são ignorados, e **não há deduplicação** —
  enviar o mesmo destinatário duas vezes insere dois cards.
- **Formato do telefone.** Só dígitos, DDI primeiro.
- **Qual endpoint usar.** Use `apircsnativo.php` quando sua campanha "API RCS" já estiver
  provisionada; use `/rcs` para que ela seja criada automaticamente; use `/rcscampaign?cid=` para
  anexar a uma campanha específica.
