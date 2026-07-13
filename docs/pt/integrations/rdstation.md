# Integração RD Station

Envie uma mensagem de SMS, RCS, Voz ou Push pela Pushfy sempre que algo acontecer no
RD Station — por exemplo quando um lead converte, muda de estágio ou chega a um ponto de um
fluxo de automação.

- **Direção:** RD Station → Pushfy (o RD Station chama uma URL de webhook da Pushfy).
- **Slug do provedor:** `rdstation`
- **Melhor gatilho:** um **Webhook** do RD Station Marketing (Integrações → Webhook, ou uma ação
  *"enviar para webhook"* em um fluxo de automação).

---

## Passo 1 — Crie a integração na Pushfy

1. Painel → **Configurações → Integrações CRM → Nova integração**.
2. **Plataforma:** RD Station.
3. **Canal:** ex.: `SMS`.
4. **Mensagem:** `Olá {{name}}, obrigado pelo interesse!`
5. *(Opcional)* **Segredo de assinatura:** defina um segredo para que a Pushfy possa verificar
   cada requisição — seja por um campo **`token`** no payload, seja pelo header
   `X-Gateway-Signature`.
6. **Salve** e **copie a URL do webhook**.

## Passo 2 — Configure o webhook no RD Station

1. No **RD Station Marketing**, vá em **Integrações → Webhook** (ou adicione uma ação
   *"enviar para webhook"* dentro de um fluxo de automação).
2. **Gatilho:** escolha o evento (ex.: conversão / mudança de estágio).
3. **URL:** cole a URL da Pushfy do Passo 1.
4. Inclua os campos do lead que você precisa (garanta que um campo de **telefone** esteja
   presente) e **salve**.

## Autenticação

O RD Station envia JSON. Se você definir um **segredo de assinatura** na integração, a Pushfy
aceita a requisição quando o **`token`** do payload bate com o seu `signing_secret`, **ou**
quando o header **`X-Gateway-Signature`** (HMAC do corpo) bate. Se deixar em branco, a
integração ainda funciona (autenticada apenas pelo token secreto na URL).

## Mapeamento de campos

O RD Station pode enviar um único lead diretamente, ou envolver os leads como
`{ "leads": [ {...} ] }` — a Pushfy trata os dois casos (**um envio por lead**).

A Pushfy lê o telefone do destinatário tentando nesta ordem: **`mobile_phone`**, depois
**`personal_phone`**.

As variáveis do template vêm do registro do lead — ex.: `{{name}}`, `{{email}}`. Campos
personalizados são acessíveis por dot-path: `{{custom_fields.plan}}`. Os números de telefone
são normalizados automaticamente (apenas dígitos, código do país primeiro). Leads sem telefone
são ignorados. O **`ext_id`** usado para deduplicação é o `uuid` do lead (recorrendo a `id`,
depois `email`).

## Exemplo

O RD Station envia algo como:

```json
{
  "leads": [
    {
      "uuid": "e2b1-...-9f",
      "name": "Ana",
      "email": "ana@example.com",
      "mobile_phone": "+55 (11) 99999-8888",
      "custom_fields": { "plan": "Pro" }
    }
  ]
}
```

Com o canal `SMS` e a mensagem `Olá {{name}}, obrigado pelo interesse!`, a Pushfy envia
**um SMS** para `5511999998888`: *"Olá Ana, obrigado pelo interesse!"*.

## Notas

- **Idempotência:** reenvios são deduplicados (por `uuid` / `id` / `email` do lead, ou hash do corpo).
- **Saldo:** o SMS é debitado do seu saldo normal; sem saldo → não é enviado.
- **Teste antes:** valide o mapeamento em **dry-run** (pré-visualização sem envio) antes de
  ativar o webhook para leads reais.
- **Outros canais:** troque o canal da integração para RCS/Voz/Push para enviar por esses canais —
  o lado do RD Station permanece igual.

Veja também: [Visão geral de CRM & Integrações](./README.md) · [Webhooks](../webhooks/README.md).
