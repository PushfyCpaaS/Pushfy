# Integração Salesforce

Envie uma mensagem de SMS, RCS, Voz ou Push pela Pushfy sempre que algo acontecer no
**Salesforce** — por exemplo quando um Lead é criado, uma Opportunity muda de estágio ou um Case
é atualizado. Um **Flow** do Salesforce posta os campos do registro para uma URL de webhook da
Pushfy.

- **Direção:** Salesforce → Pushfy (um Flow do Salesforce chama uma URL de webhook da Pushfy).
- **Slug do provedor:** `salesforce`
- **Melhor gatilho:** um **Flow** disparado por registro com uma ação **HTTP Callout**.

---

## Passo 1 — Crie a integração na Pushfy

1. Painel → **Configurações → Integrações CRM → Nova integração**.
2. **Plataforma:** Salesforce.
3. **Canal:** ex. `SMS`.
4. **Mensagem:** `Olá {{FirstName}}, seja bem-vindo!` — o template puxa dos campos do registro.
5. *(Opcional)* **Segredo de assinatura:** defina um segredo para a Pushfy verificar a assinatura
   de cada requisição.
6. **Salve** e **copie a URL do webhook**.

## Passo 2 — Configure o webhook no Salesforce

1. Em **Setup → Flows**, crie um **Flow disparado por registro** (ex. na criação/atualização de
   Contact/Lead).
2. Adicione uma ação **HTTP Callout** (ou use **External Services / Named Credential** apontando
   para a URL da Pushfy).
3. **Método:** `POST` · **URL:** cole a URL da Pushfy do Passo 1.
4. **Cabeçalho:** `Content-Type: application/json`.
5. **Corpo:** um objeto JSON com os campos do registro a enviar (inclua um campo de telefone —
   veja abaixo).
6. Ative o Flow.

> Um Named Credential é a forma mais limpa de guardar o endpoint e (opcionalmente) o cabeçalho de
> assinatura, mas um HTTP Callout direto no Flow também funciona.

## Autenticação

O token na URL identifica e autentica sua integração. **Opcionalmente**, se você definir um
**segredo de assinatura**, envie o cabeçalho:

```
X-Gateway-Signature: sha256=<hex>
```

onde `<hex>` é o **HMAC-SHA256** do **corpo cru** da requisição com a chave `signing_secret`
(o prefixo `sha256=` ou o hex puro são aceitos). Se você definir um segredo, a Pushfy verifica e
rejeita requisições que não batem. Se deixar em branco, a integração continua funcionando
(autenticada pelo token na URL).

## Mapeamento de campos

A Pushfy lê o telefone do destinatário no registro, tentando nesta ordem:

- `MobilePhone`, `Phone`, `mobilePhone`, `phone`
- as mesmas chaves aninhadas sob `contact.*`, `record.*` ou `data.*`

As variáveis do template vêm dos campos do registro — ex. `{{FirstName}}`, `{{LastName}}`,
`{{Company}}`. Os números são normalizados automaticamente (só dígitos, código do país primeiro).
Registros sem telefone são ignorados.

## Exemplo

Seu Flow posta algo como:

```json
{
  "FirstName": "Ana",
  "LastName": "Silva",
  "MobilePhone": "+55 (11) 99999-8888",
  "Company": "Acme"
}
```

Com canal `SMS` e mensagem `Olá {{FirstName}}, seja bem-vindo!`, a Pushfy envia **um SMS** para
`5511999998888`: *"Olá Ana, seja bem-vindo!"*.

## Observações

- **Idempotência:** retentativas do mesmo evento são deduplicadas (pelo id do registro ou hash do
  corpo) e não são enviadas duas vezes.
- **Saldo:** o envio é debitado do seu saldo normal; sem saldo → não envia.
- **Teste antes:** valide o mapeamento em **dry-run** (prévia sem enviar) antes de ativar o Flow
  em registros reais.
- **Outros canais:** troque o canal da integração para RCS/Voz/Push — o lado do Salesforce
  permanece igual.

Veja também: [Visão geral de CRM & Integrações](./README.md) · [Webhooks](../webhooks/README.md) ·
[Enviar Voz](../reference/voice.md).
