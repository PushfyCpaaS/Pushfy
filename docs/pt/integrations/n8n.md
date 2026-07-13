# Integração n8n

Envie uma mensagem de SMS, RCS, Voz ou Push pela Pushfy sempre que um workflow do **n8n**
executar — por exemplo quando um webhook dispara, um agendamento roda ou um registro muda em um
nó anterior. O n8n usa o mesmo payload canônico da integração Genérica, montado dentro de um nó
**HTTP Request**.

- **Direção:** n8n → Pushfy (um nó HTTP Request do n8n chama uma URL de webhook da Pushfy).
- **Slug do provedor:** `n8n`
- **Melhor gatilho:** qualquer **Workflow** do n8n (webhook, agendamento, gatilho de app, …).

---

## Passo 1 — Crie a integração na Pushfy

1. Painel → **Configurações → Integrações CRM → Nova integração**.
2. **Plataforma:** n8n.
3. **Canal:** ex. `SMS`. *(Também pode ser definido por requisição no campo `canal`.)*
4. **Mensagem:** *(opcional)* um template de fallback. Como o payload do n8n já carrega o
   conteúdo, o template `{{campo}}` é **opcional** aqui.
5. *(Opcional)* **Segredo de assinatura:** defina um segredo para a Pushfy verificar a assinatura
   de cada requisição.
6. **Salve** e **copie a URL do webhook**.

## Passo 2 — Configure o webhook no n8n

1. No seu workflow, adicione um nó **HTTP Request**.
2. **Método:** `POST` · **URL:** cole a URL da Pushfy do Passo 1.
3. **Body Content Type:** `JSON`.
4. **Corpo:** o payload canônico (mesmos campos da integração Genérica). Você pode montá-lo a
   partir de nós anteriores com expressões, ex. `{{ $json.phone }}` e `{{ $json.name }}`.
5. Adicione um **Cabeçalho** `Content-Type: application/json`.
6. Salve e ative o workflow.

> O n8n usa o mesmo adapter genérico, então qualquer campo canônico ou alias funciona exatamente
> como no guia [Genérico / Webhook](./generic.md).

## Autenticação

O token na URL identifica e autentica sua integração. **Opcionalmente**, se você definir um
**segredo de assinatura**, adicione o cabeçalho:

```
X-Gateway-Signature: sha256=<hex>
```

onde `<hex>` é o **HMAC-SHA256** do **corpo cru** da requisição com a chave `signing_secret`
(o prefixo `sha256=` ou o hex puro são aceitos). No n8n você pode calcular isso com um nó
**Crypto** ou **Function** antes do nó HTTP Request. Se deixar o segredo em branco, a integração
continua funcionando (autenticada pelo token na URL).

## Mapeamento de campos

Você monta o payload canônico da Pushfy no corpo do nó HTTP Request:

| Campo | Significado |
|---|---|
| `canal` | canal: `sms`, `rcs`, `rcs_basic`, `voz` ou `push` |
| `destinos` | lista de números de destino |
| `texto` | texto da mensagem |
| `titulo` / `imagem` / `url` / `cta` | título / imagem / link / botão (RCS) |
| `audio` | nome do áudio (Voz) |
| `push` | objeto `{ titulo, corpo, url }` (Push) |
| `ext_id` | seu id externo (usado para idempotência) |

**Aliases:** `to`/`phone` → `destinos`, `text`/`message` → `texto`, `title` → `titulo`,
`image` → `imagem`. Você pode postar um objeto ou uma lista. Os números são normalizados
automaticamente (só dígitos, código do país primeiro); registros sem telefone são ignorados.

## Exemplo

Corpo do nó HTTP Request, montado a partir de um nó anterior:

```json
{
  "canal": "sms",
  "destinos": ["{{ $json.phone }}"],
  "texto": "Olá {{ $json.name }}, seu pedido foi enviado!",
  "ext_id": "n8n-{{ $json.orderId }}"
}
```

Numa execução em que `$json.phone` é `+55 (11) 99999-8888` e `$json.name` é `Ana`, a Pushfy envia
**um SMS** para `5511999998888`: *"Olá Ana, seu pedido foi enviado!"*.

## Observações

- **Idempotência:** execuções repetidas com o mesmo `ext_id` (ou o mesmo hash do corpo) são
  deduplicadas e não são enviadas duas vezes.
- **Saldo:** cada envio é debitado do seu saldo normal; sem saldo → não envia.
- **Teste antes:** use o **Execute Node** do n8n e o **dry-run** da Pushfy para confirmar o
  mapeamento antes de ativar.
- **Qualquer canal:** defina `canal` no corpo, ou fixe o canal na integração e omita.

Veja também: [Visão geral de CRM & Integrações](./README.md) · [Genérico / Webhook](./generic.md) ·
[Webhooks](../webhooks/README.md) · [Enviar Voz](../reference/voice.md).
