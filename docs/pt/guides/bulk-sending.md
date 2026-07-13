# Envie milhares de mensagens

A API de Mensageria foi feita para volume. Um único `POST /webapi` aceita até
**100.000 mensagens**, cada uma com seu destinatário e seu id de referência. Este guia mostra
como enviar em escala sem perder o controle de nada: dividir em lotes sensatos, marcar toda
mensagem com um `ext_id`, ler a resposta em array, respeitar os limites de taxa e confirmar a
entrega por **webhook** em vez de consultar mensagem a mensagem.

---

## O array `messages[]`

O `/webapi` recebe um array de mensagens independentes. Cada objeto é enfileirado por conta
própria e retorna sua própria linha. Mesmo token, mesmo endpoint, uma requisição:

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "ext_id": "u-1001", "destinations": [{ "to": "5511999990001" }], "text": "Oi Ana" },
      { "ext_id": "u-1002", "destinations": [{ "to": "5511999990002" }], "text": "Oi Bruno" },
      { "ext_id": "u-1003", "destinations": [{ "to": "5511999990003" }], "text": "Oi Carla" }
    ]
  }'
```

O limite rígido é de **100.000 mensagens por requisição**; ultrapasse e você recebe
`400 max_100000`. Há também um limite de bytes no corpo (`413 payload_too_large`). Veja
[Enviar SMS](../reference/sms.md).

---

## Passo 1 — Divida em lotes (chunks)

Mesmo que uma requisição comporte 100.000 mensagens, **não** envie sua lista inteira em uma
única chamada gigante. Lotes menores são mais rápidos de montar, mais fáceis de repetir e mais
gentis com o limite de tamanho do corpo. Um bom padrão é de **1.000–5.000 mensagens por
requisição**.

Fatie sua lista de destinatários em lotes e envie um após o outro:

```python
import requests

URL = "https://portal.pushfy.com/webapi"
HEADERS = {
    "Authorization": "Bearer SEU_TOKEN",
    "Content-Type": "application/json",
}
CHUNK = 2000  # 1.000–5.000 é uma boa faixa

def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]

# recipients: lista de (user_id, phone, text)
for batch in chunks(recipients, CHUNK):
    messages = [
        {
            "ext_id": f"camp42-{uid}",          # Passo 2: sempre defina o ext_id
            "destinations": [{"to": phone}],
            "text": text,
        }
        for (uid, phone, text) in batch
    ]
    r = requests.post(URL, headers=HEADERS, json={"messages": messages})
    r.raise_for_status()
    for row in r.json():                        # Passo 3: a resposta é um array
        record_accepted(row["ext_id"], row["phone"], row["date"])
```

---

## Passo 2 — Sempre defina um `ext_id` por mensagem

Em escala, o `ext_id` não é opcional na prática — é como você amarra cada mensagem aceita,
cada recibo de entrega e cada resposta a uma linha do seu banco.

- Faça-o **único e determinístico**, ex.: `campanha42-user1001`.
- Derive-o dos seus próprios ids para conseguir reconstruí-lo depois sem tabela de lookup.
- Se você omitir, o Pushfy gera um e o devolve — mas aí você tem que guardar o valor gerado,
  algo fácil de perder sob carga.

O mesmo `ext_id` também torna os retries seguros: reutilizá-lo permite consultar o status em
vez de reenviar às cegas. Veja [Tratando erros](./error-handling.md).

---

## Passo 3 — Leia a resposta em array

Cada chamada ao `/webapi` retorna **`200 OK` com um array**, um objeto por mensagem, na ordem
de envio:

```json
[
  { "id": "camp42-1001", "phone": "5511999990001", "date": "2026-07-12 14:33:21", "ext_id": "camp42-1001" },
  { "id": "camp42-1002", "phone": "5511999990002", "date": "2026-07-12 14:33:21", "ext_id": "camp42-1002" }
]
```

Itere o array e marque cada `ext_id` como **aceito** (enfileirado). Lembre: aceitação não é
entrega — isso é confirmado depois, no Passo 5.

---

## Passo 4 — Respeite os limites de taxa

Envie os lotes **sequencialmente**, ou com uma concorrência pequena e limitada — não uma
enxurrada sem limites. Se você forçar demais, verá respostas `429`; quando isso acontecer,
pare, faça **backoff exponencial** (ex.: 1s, 2s, 4s… com jitter) e retome. Repita `5xx` e
timeouts do mesmo jeito, mas só com os **mesmos `ext_id`s** para um retry não duplicar.

Os detalhes e o padrão completo de backoff estão em
[Erros e limites](../reference/errors.md) e no [guia de tratamento de erros](./error-handling.md).

> O envio é **assíncrono por natureza.** O `/webapi` aceita e enfileira; a entrega ocorre logo
> em seguida. Um `200` rápido significa "enfileirado", não "entregue".

---

## Passo 5 — Confirme a entrega por webhook, não por polling item a item

Depois de enfileirar dezenas de milhares de mensagens, **não** fique iterando cada `ext_id`
chamando `/getstatus`. Isso é lento, desperdiça recursos e pode disparar `503` sob carga.

Em vez disso, registre o
**[webhook de status de mensageria](../webhooks/messaging-status.md)**. O Pushfy envia um
recibo de entrega (DLR) para cada mensagem conforme o resultado é conhecido — como um array
JSON que você correlaciona pelo `ext_id`:

```json
[
  { "ext_id": "camp42-1001", "phone": "5511999990001", "status": "Delivered", "channel": "SMS", "cost": "0.06" }
]
```

Se ainda assim precisar puxar resultados em massa pela API, consulte **por dia ou por período**
com [`/getdate` ou `/reportbydate`](../reference/status.md) (paginado em até 5.000 linhas), em
vez de uma consulta por mensagem.

---

## Checklist

- [ ] Divida em **1.000–5.000** mensagens por requisição (nunca despeje as 100.000 de uma vez).
- [ ] Defina um **`ext_id` único** em toda mensagem.
- [ ] Itere a resposta em **array**; marque cada `ext_id` como aceito.
- [ ] Envie os lotes em sequência; faça **backoff** em `429`/`5xx`, repetindo com os mesmos `ext_id`s.
- [ ] Confirme a entrega pelo **webhook de status** (ou `/reportbydate`), não por polling item a item.

---

## Próximos passos

- [Webhook de status de mensageria](../webhooks/messaging-status.md) e o
  [guia de recebimento de webhooks](./receiving-webhooks.md).
- [Tratando erros](./error-handling.md) — retry e idempotência sem cobrar em dobro.
- [Status de entrega](../reference/status.md) — por mensagem, por dia, por período.
