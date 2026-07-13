# Integração Genérica / Webhook

Envie uma mensagem de SMS, RCS, Voz ou Push pela Pushfy sempre que **qualquer** sistema puder
fazer um HTTP POST — Make, Zapier, seu próprio backend, um cron, uma função serverless, o que
for. Este é o ponto de entrada universal: você mesmo monta o corpo da requisição no **formato
canônico** da Pushfy e a Pushfy envia.

- **Direção:** Seu sistema → Pushfy (você faz POST para uma URL de webhook da Pushfy).
- **Slug do provedor:** `generic`
- **Melhor gatilho:** qualquer evento em qualquer ferramenta que consiga enviar uma requisição HTTP.

---

## Passo 1 — Crie a integração na Pushfy

1. Painel → **Configurações → Integrações CRM → Nova integração**.
2. **Plataforma:** Genérica / Webhook.
3. **Canal:** ex. `SMS`. *(O canal também pode ser definido por requisição no payload — veja abaixo.)*
4. **Mensagem:** *(opcional)* um template de fallback como `Olá {{name}}!`. Como o payload
   genérico já pode trazer o conteúdo completo, o template `{{campo}}` é **opcional** aqui.
5. *(Opcional)* **Segredo de assinatura:** defina um segredo para a Pushfy verificar a assinatura
   de cada requisição.
6. **Salve** e **copie a URL do webhook**.

## Passo 2 — Configure o webhook no seu sistema

1. Na ferramenta que envia o evento, adicione uma ação **HTTP Request / Webhook**.
2. **Método:** `POST` · **URL:** cole a URL da Pushfy do Passo 1.
3. **Cabeçalho:** `Content-Type: application/json`.
4. **Corpo:** um objeto JSON no formato canônico da Pushfy (veja **Mapeamento de campos**).
5. Dispare a requisição sempre que quiser que uma mensagem seja enviada.

> O payload já chega no formato canônico da Pushfy, então você o monta diretamente — não é
> necessário nenhum parsing de adapter específico de plataforma.

## Autenticação

O token na URL identifica e autentica sua integração. **Opcionalmente**, se você definir um
**segredo de assinatura**, envie o cabeçalho:

```
X-Gateway-Signature: sha256=<hex>
```

onde `<hex>` é o **HMAC-SHA256** do **corpo cru** da requisição com a chave `signing_secret`.
O prefixo `sha256=` é aceito, e o hex puro também. Se você definir um segredo, a Pushfy verifica
e rejeita requisições que não batem. Se deixar em branco, a integração continua funcionando
(autenticada pelo token na URL).

## Mapeamento de campos

Você envia o payload canônico da Pushfy diretamente. Campos:

| Campo | Significado |
|---|---|
| `canal` | canal: `sms`, `rcs`, `rcs_basic`, `voz` ou `push` |
| `destinos` | lista de números de destino, ex. `["5511999998888"]` |
| `texto` | texto da mensagem |
| `titulo` | título (RCS) |
| `imagem` | URL da imagem (RCS) |
| `url` | link (RCS) |
| `cta` | botão / call-to-action (RCS) |
| `audio` | nome do áudio (Voz) |
| `push` | objeto `{ titulo, corpo, url }` (Push) |
| `ext_id` | seu id externo (usado para idempotência) |

**Aliases** são aceitos para você postar nomes mais naturais:

- `to` / `phone` → `destinos`
- `text` / `message` → `texto`
- `title` → `titulo`
- `image` → `imagem`

Você pode postar **um objeto** ou uma **lista de objetos** (lote). Os números são normalizados
automaticamente (só dígitos, código do país primeiro). Registros sem telefone são ignorados.

## Exemplo

Postar um único SMS:

```json
{
  "canal": "sms",
  "destinos": ["+55 (11) 99999-8888"],
  "texto": "Olá Ana, bem-vinda ao clube!",
  "ext_id": "welcome-1024"
}
```

A Pushfy envia **um SMS** para `5511999998888`: *"Olá Ana, bem-vinda ao clube!"*.

Usando aliases e um lote:

```json
[
  { "to": "5511999998888", "text": "Primeira mensagem" },
  { "phone": "5511988887777", "message": "Segunda mensagem" }
]
```

## Observações

- **Idempotência:** requisições repetidas com o mesmo `ext_id` (ou o mesmo hash do corpo) são
  deduplicadas e não são enviadas duas vezes.
- **Saldo:** cada envio é debitado do seu saldo normal; sem saldo → não envia.
- **Teste antes:** valide em **dry-run** (prévia sem enviar) antes de ir ao ar.
- **Qualquer canal:** defina `canal` por requisição, ou fixe o canal na integração e omita.

Veja também: [Visão geral de CRM & Integrações](./README.md) · [Webhooks](../webhooks/README.md) ·
[Enviar Voz](../reference/voice.md).
