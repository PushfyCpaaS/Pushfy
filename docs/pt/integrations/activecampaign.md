# Integração ActiveCampaign

Envie uma mensagem de SMS, RCS, Voz ou Push pela Pushfy sempre que algo acontecer no
ActiveCampaign — por exemplo quando um contato se inscreve, é atualizado ou entra em uma
automação.

- **Direção:** ActiveCampaign → Pushfy (o ActiveCampaign chama uma URL de webhook da Pushfy).
- **Slug do provedor:** `activecampaign`
- **Melhor gatilho:** um **Webhook** do ActiveCampaign (ou uma ação *"Webhook"* dentro de uma Automação).

---

## Passo 1 — Crie a integração na Pushfy

1. Painel → **Configurações → Integrações CRM → Nova integração**.
2. **Plataforma:** ActiveCampaign.
3. **Canal:** ex.: `SMS`.
4. **Mensagem:** `Olá {{first_name}}, seja bem-vindo!`
5. *(Opcional)* **Segredo de assinatura:** defina um segredo para que a Pushfy possa verificar
   o `X-Gateway-Signature` (HMAC do corpo da requisição) em cada requisição.
6. **Salve** e **copie a URL do webhook**.

## Passo 2 — Configure o webhook no ActiveCampaign

1. No ActiveCampaign, vá em **Settings → Developer → Webhooks**.
2. **Adicione** um webhook: cole a URL da Pushfy do Passo 1.
3. Escolha os eventos a enviar (ex.: **subscribe**, **contact_update**).
4. **Salve**.

> Você também pode adicionar uma **ação "Webhook"** dentro de uma **Automação** e apontá-la
> para a mesma URL da Pushfy — o adaptador trata os dois casos.

## Autenticação

O ActiveCampaign envia dados `application/x-www-form-urlencoded`. Se você definir um
**segredo de assinatura** na integração, a Pushfy verifica o header **`X-Gateway-Signature`**
(um HMAC do corpo bruto calculado com o seu `signing_secret`) e rejeita o que não bater. Se
deixar em branco, a integração ainda funciona (autenticada apenas pelo token secreto na URL).

## Mapeamento de campos

A Pushfy lê o telefone do destinatário de **`contact.phone`**.

As variáveis do template vêm do registro do contato — ex.: `{{first_name}}`, `{{email}}`,
`{{id}}`. Os números de telefone são normalizados automaticamente (apenas dígitos, código do
país primeiro). Eventos sem telefone são ignorados. O **`ext_id`** usado para deduplicação é
o `id` do contato combinado com o `type` do evento (ex.: `subscribe`, `contact_update`).

## Exemplo

O ActiveCampaign envia campos de formulário como:

```
type=subscribe
contact[id]=1024
contact[email]=ana@example.com
contact[phone]=+55 (11) 99999-8888
contact[first_name]=Ana
```

Com o canal `SMS` e a mensagem `Olá {{first_name}}, seja bem-vindo!`, a Pushfy envia
**um SMS** para `5511999998888`: *"Olá Ana, seja bem-vindo!"*.

## Notas

- **Idempotência:** envios repetidos são deduplicados (por `id` do contato + `type`, ou hash do corpo).
- **Saldo:** o SMS é debitado do seu saldo normal; sem saldo → não é enviado.
- **Teste antes:** valide o mapeamento em **dry-run** (pré-visualização sem envio) antes de
  ativar o webhook para contatos reais.
- **Outros canais:** troque o canal da integração para RCS/Voz/Push para enviar por esses canais —
  o lado do ActiveCampaign permanece igual.

Veja também: [Visão geral de CRM & Integrações](./README.md) · [Webhooks](../webhooks/README.md).
