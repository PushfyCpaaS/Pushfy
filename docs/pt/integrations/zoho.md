# Integração Zoho CRM

Envie uma mensagem SMS, RCS, Voz ou Push pela Pushfy sempre que algo acontecer no Zoho CRM —
por exemplo quando um lead é criado, um negócio muda de etapa ou um registro é atualizado.

- **Direção:** Zoho CRM → Pushfy (o Zoho chama uma URL de webhook da Pushfy).
- **Slug do provedor:** `zoho`
- **Melhor gatilho:** uma **Workflow Rule** do Zoho com *Instant Action → Webhook*.

---

## Passo 1 — Crie a integração na Pushfy

1. Painel → **Configurações → Integrações CRM → Nova integração**.
2. **Plataforma:** Zoho CRM.
3. **Canal:** ex.: `SMS`.
4. **Mensagem:** `Olá {{Full_Name}}, bem-vindo à nossa loja!`
5. *(Opcional)* **Signing secret:** defina um segredo para a Pushfy verificar cada requisição
   pelo header `X-Gateway-Signature` ou por um `token` no payload (veja *Autenticação*).
6. **Salve** e **copie a URL do webhook**.

## Passo 2 — Configure o webhook no Zoho CRM

1. No Zoho CRM vá em **Setup → Automation → Workflow Rules** e crie ou edite uma regra.
2. Adicione uma **Instant Action → Webhook** (ou uma **Function** se precisar de mais controle).
3. **Método:** `POST` · **URL to notify:** cole a URL da Pushfy do Passo 1.
4. **Corpo:** mapeie os campos do registro que precisar — ex.: `Phone`, `Mobile`, `Full_Name`.
   Você pode enviá-los planos ou encapsulados como `{ "data": [ { ... } ] }`.
5. Salve e associe a ação à regra.

## Autenticação

A autenticação é opcional e pode ser feita de duas formas:

- **`X-Gateway-Signature`** — um HMAC do corpo bruto calculado com o seu **signing_secret**.
- **`token`** no payload — um valor simples comparado ao seu **signing_secret**.

Se você definir um **signing secret** na integração, a Pushfy verifica uma das opções acima e
rejeita o que não coincidir. Se deixar vazio, a integração continua funcionando (autenticada
apenas pelo token secreto na URL).

## Mapeamento de campos

A Pushfy lê o telefone do destinatário no registro, tentando nesta ordem:

- `Mobile`, `Phone`
- `data.0.Mobile`, `data.0.Phone`

Se `data` for uma **lista**, a Pushfy envia **uma mensagem por registro** contido nela. As
variáveis do template vêm do registro — ex.: `{{Full_Name}}`, `{{Phone}}`. Os números são
normalizados automaticamente (apenas dígitos, código do país primeiro). O `ext_id` é `id` (ou
`data.0.id`). Eventos sem telefone são ignorados.

## Exemplo

O Zoho envia algo como:

```json
{
  "data": [
    {
      "id": "554023000000123001",
      "Full_Name": "Ana",
      "Mobile": "+55 (11) 99999-8888"
    }
  ]
}
```

Com o canal `SMS` e a mensagem `Olá {{Full_Name}}, bem-vindo à nossa loja!`, a Pushfy envia
**um SMS** para `5511999998888`: *"Olá Ana, bem-vindo à nossa loja!"*.

## Observações

- **Registros em lote:** um array `data` com vários registros gera um envio por registro.
- **Idempotência:** retentativas do Zoho são de-duplicadas (por id do registro ou hash do corpo).
- **Saldo:** o SMS é cobrado do seu saldo normal; sem saldo → não é enviado.
- **Teste antes:** valide o mapeamento em **dry-run** (prévia sem enviar) antes de ativar a
  workflow rule para registros reais.
- **Outros canais:** troque o canal da integração para RCS/Voz/Push para enviar por eles — o
  lado do Zoho permanece igual.

Veja também: [Visão geral de CRM & Integrações](./README.md) · [Webhooks](../webhooks/README.md).
