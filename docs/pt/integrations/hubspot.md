# Integração HubSpot

Envie um SMS, RCS, Voz ou Push pela Pushfy sempre que algo acontecer no HubSpot — por exemplo
quando um contato entra num workflow, envia um formulário ou muda de etapa do ciclo de vida.

- **Direção:** HubSpot → Pushfy (o HubSpot chama uma URL de webhook da Pushfy).
- **Slug do provider:** `hubspot`
- **Melhor gatilho:** um **Workflow** do HubSpot com a ação *"Send a webhook"* (enviar webhook).

---

## Passo 1 — Crie a integração na Pushfy

1. Painel → **Configurações → Integrações CRM → Nova integração**.
2. **Plataforma:** HubSpot.
3. **Canal:** ex. `SMS`.
4. **Mensagem:** `Olá {{properties.firstname}}, boas-vindas à {{properties.company}}!`
5. *(Opcional)* **Segredo de assinatura:** cole o **Client Secret** do seu app HubSpot para a
   Pushfy verificar o `X-HubSpot-Signature` de cada requisição.
6. **Salve** e **copie a URL do webhook**.

## Passo 2 — Configure o webhook no HubSpot

1. No HubSpot, crie ou edite um **Workflow** (Automação → Workflows).
2. Adicione a ação **"Send a webhook"**.
3. **Método:** `POST` · **URL do webhook:** cole a URL da Pushfy do Passo 1.
4. Escolha as propriedades do contato a incluir (garanta que uma propriedade de **telefone** vá junto).
5. Ative o workflow.

> Você também pode usar uma **assinatura de webhook de Private App**; o adapter trata tanto o
> payload de workflow quanto o formato de array da subscription.

## Autenticação

O HubSpot assina os webhooks com **`X-HubSpot-Signature` (v1)** = `sha256(clientSecret + corpo)`.
Se você definir um **segredo de assinatura** (o client secret do app) na integração, a Pushfy
verifica e rejeita o que não bater. Se deixar vazio, a integração ainda funciona (autenticada
apenas pelo token secreto na URL).

## Mapeamento de campos

A Pushfy lê o telefone do contato tentando, nesta ordem:

- `properties.phone`, `properties.mobilephone`, `properties.hs_whatsapp_phone_number`
- de topo `phone`, `phoneNumber`, `mobilephone`

As variáveis do template vêm do registro do contato — ex.: `{{properties.firstname}}`,
`{{properties.lastname}}`. O telefone é normalizado automaticamente (só dígitos, DDI primeiro).
Eventos sem telefone são ignorados.

## Exemplo

O HubSpot envia algo como:

```json
{
  "objectId": 1024,
  "properties": {
    "firstname": "Ana",
    "phone": "+55 (11) 99999-8888",
    "company": "Pushfy"
  }
}
```

Com canal `SMS` e mensagem `Olá {{properties.firstname}}, boas-vindas à {{properties.company}}!`,
a Pushfy envia **um SMS** para `5511999998888`: *"Olá Ana, boas-vindas à Pushfy!"*.

## Observações

- **Idempotência:** reenvios do HubSpot são deduplicados (por id do evento/objeto ou hash do corpo).
- **Saldo:** o SMS é debitado do seu saldo normal; sem saldo → não envia.
- **Teste antes:** valide o mapeamento em **dry-run** (prévia sem enviar) antes de ativar o
  workflow para contatos reais.
- **Outros canais:** troque o canal da integração para RCS/Voz/Push para enviar por eles — o lado
  do HubSpot continua igual.

Veja também: [Visão geral CRM & Integrações](./README.md) · [Webhooks](../webhooks/README.md).
