# Enviar Voz

Envie uma ligação de voz (torpedo de voz) tocando um áudio pré-gravado para o destinatário.

A voz é enviada em **dois passos**:

1. **Criar o áudio** — envie um `.mp3` e escolha um `nome` para ele.
2. **Disparar a ligação** — envie uma mensagem no `/webapi` com esse **nome** no campo `audio`.

> **Atenção:** o endpoint `/apitvoz` citado em documentações antigas **não existe** e retorna
> `404`. Use os dois passos abaixo.

---

## Passo 1 — Criar o áudio

- **URL** — `https://portal.pushfy.com/audio`
- **Método** — `POST`
- **Auth** — Token Bearer ([Autenticação](./authentication.md))
- **Content-Type** — `multipart/form-data`

Apenas arquivos `.mp3` são aceitos.

### Headers

```
Authorization: Bearer SEU_TOKEN
Content-Type: multipart/form-data
```

### Campos do formulário

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nome` | string | ✅ | Um nome para o áudio. **Você passará este mesmo nome no Passo 2 para fazer a ligação** — guarde-o. |
| `audio` | arquivo | ✅ | O arquivo de áudio a enviar — **somente `.mp3`** |

### Requisição

```bash
curl -X POST 'https://portal.pushfy.com/audio' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -F 'nome=Welcome message' \
  -F 'audio=@boas-vindas.mp3'
```

### Resposta

`200 OK`:

```json
{
  "message": "Audio saved successfully",
  "user_id": 123
}
```

O áudio fica salvo sob o **nome** que você enviou em `nome`. Esse nome é o que você passa no
Passo 2 — a resposta acima **não** retorna um id de áudio separado, então lembre-se do `nome` que escolheu.

### Erros

| HTTP | Corpo | Causa |
|---|---|---|
| 400 | `{"error":"Only MP3"}` | O arquivo enviado não é `.mp3` |
| 400 | `{"error":"No file"}` | Nenhum arquivo `audio` na requisição |
| 401 | `{"error":"Unauthorized"}` | Token ausente/inválido |
| 500 | `{"error":"Upload error"}` | Erro temporário — pode repetir |

---

## Passo 2 — Disparar a ligação

A ligação é disparada no **mesmo endpoint do SMS**, `POST /webapi`
([Enviar SMS](./sms.md)). Coloque o **nome** do áudio do Passo 1 no campo `audio`. Quando `audio`
está preenchido, a mensagem é tratada como **ligação de voz** em vez de mensagem de texto.

- **URL** — `https://portal.pushfy.com/webapi`
- **Método** — `POST`
- **Auth** — Token Bearer ([Autenticação](./authentication.md))
- **Content-Type** — `application/json` (obrigatório)

### Corpo (Body)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `messages` | array | ✅ | Uma ou mais ligações (até 100.000 por requisição) |
| `messages[].destinations` | array | ✅ | Lista de destinatários — **apenas o primeiro é usado** |
| `messages[].destinations[].to` | string | ✅ | Telefone, só dígitos, com DDI primeiro (ex.: `5511999999999`). Mín. 8 dígitos |
| `messages[].audio` | string | ✅ | O **nome** do áudio do Passo 1 (o mesmo `nome` que você definiu) — marca a mensagem como **ligação de voz** |
| `messages[].ext_id` | string | — | Seu id de referência, devolvido na resposta e usado na consulta de status. Gerado automaticamente se omitido |

### Requisição

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      {
        "ext_id": "call-1",
        "destinations": [{ "to": "5511999999999" }],
        "audio": "Welcome message"
      }
    ]
  }'
```

### Resposta

`200 OK` — um **array** com um objeto por ligação (mesmo formato do SMS):

```json
[
  {
    "id": "call-1",
    "phone": "5511999999999",
    "date": "2026-07-12 14:33:21",
    "ext_id": "call-1"
  }
]
```

Guarde o `ext_id` para [consultar o status da ligação](./status.md) depois.

---

## Consultando o status

No [`/getstatus`](./status.md) o canal aparece como `TVOZ`, e o resultado da ligação está no
campo `statustvoz`:

| `statustvoz` | Significado |
|---|---|
| `Waiting` | Na fila, ainda não discada |
| `Called` | A ligação foi feita |
| `Answered` | O destinatário atendeu |
| `Not Answered` | O destinatário não atendeu |
| `Invalid audio` | O áudio não pôde ser tocado |
| `Fail` | A ligação falhou |

## Observações

- **Dois passos, um áudio.** Crie o áudio uma vez com um `nome` e reutilize esse **nome** em
  quantas ligações quiser. O valor de `audio` no Passo 2 precisa casar exatamente com esse `nome`.
- **Tarifação.** A voz é tarifada por ligação realizada; ligações não atendidas (ocupado, falha,
  cancelada, indisponível) são estornadas em uma reconciliação diária.
- **Somente `.mp3`.** Outros formatos são recusados com `{"error":"Only MP3"}`.
- **Voz = SMS com `audio`.** Não existe endpoint separado de voz; uma mensagem no `/webapi` que
  carrega um `nome` de `audio` é discada como ligação de voz.
- **Um destinatário por mensagem.** Só `destinations[0].to` é usado; para mais destinatários,
  adicione mais objetos em `messages`.
- **Formato do telefone.** Só dígitos, DDI primeiro. Não-dígitos são removidos automaticamente.
