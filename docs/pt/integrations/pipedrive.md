# Integração Pipedrive

Envie uma mensagem de SMS, RCS, Voz ou Push pela Pushfy sempre que algo acontecer no
Pipedrive — por exemplo quando uma pessoa é adicionada, um negócio muda de etapa ou um contato
é atualizado.

- **Direção:** Pipedrive → Pushfy (o Pipedrive chama uma URL de webhook da Pushfy).
- **Slug do provedor:** `pipedrive`
- **Melhor gatilho:** um **Webhook** do Pipedrive (Company Settings → Webhooks, ou Tools → Webhooks).

---

## Passo 1 — Crie a integração na Pushfy

1. Painel → **Configurações → Integrações CRM → Nova integração**.
2. **Plataforma:** Pipedrive.
3. **Canal:** ex.: `SMS`.
4. **Mensagem:** `Olá {{name}}, obrigado pelo contato!`
5. **Autenticação:** preencha **`basic_user`** e **`basic_pass`** com o usuário/senha que você
   vai definir no webhook do Pipedrive (veja o Passo 2). *(Como alternativa, defina um **segredo
   de assinatura** e a Pushfy verificará o `X-Gateway-Signature`.)*
6. **Salve** e **copie a URL do webhook**.

## Passo 2 — Configure o webhook no Pipedrive

1. No Pipedrive, vá em **Company Settings → Webhooks** (ou **Tools → Webhooks**).
2. **Crie um novo webhook**.
3. **Endpoint URL:** cole a URL da Pushfy do Passo 1.
4. Defina **usuário/senha HTTP Auth** — use os **mesmos** valores informados em `basic_user` /
   `basic_pass` no Passo 1.
5. Escolha o **evento** (objeto + ação, ex.: *person → updated*) e **salve**.

## Autenticação

O Pipedrive suporta **HTTP Basic Auth** no webhook: ele envia um header
`Authorization: Basic ...` montado a partir do usuário/senha que você definiu. Na integração
Pushfy você informa **`basic_user`** / **`basic_pass`** correspondentes, e a Pushfy valida o
header — o que não bater é rejeitado. Como alternativa, você pode definir um **segredo de
assinatura** e a Pushfy verificará o **`X-Gateway-Signature`** (HMAC do corpo).

## Mapeamento de campos

O Pipedrive envia JSON no formato `{ event, meta: { id, action, object }, current: {...},
previous: {...} }`.

A Pushfy lê o telefone do destinatário de **`current.phone`**, que é uma **lista** de objetos
`[{ value, primary, label }]`. Ela usa a entrada marcada como **`primary: true`**, ou a
primeira se nenhuma for primária.

As variáveis do template vêm de **`current`** — ex.: `{{name}}`, `{{email}}`. Os números de
telefone são normalizados automaticamente (apenas dígitos, código do país primeiro). Eventos
sem telefone são ignorados. O **`ext_id`** usado para deduplicação é `meta.id` (recorrendo a
`current.id`).

## Exemplo

O Pipedrive envia algo como:

```json
{
  "event": "updated.person",
  "meta": { "id": 5540, "action": "updated", "object": "person" },
  "current": {
    "id": 1024,
    "name": "Ana",
    "phone": [
      { "value": "+55 (11) 99999-8888", "primary": true, "label": "mobile" }
    ]
  }
}
```

Com o canal `SMS` e a mensagem `Olá {{name}}, obrigado pelo contato!`, a Pushfy envia
**um SMS** para `5511999998888`: *"Olá Ana, obrigado pelo contato!"*.

## Notas

- **Idempotência:** reenvios são deduplicados (por `meta.id` / `current.id`, ou hash do corpo).
- **Saldo:** o SMS é debitado do seu saldo normal; sem saldo → não é enviado.
- **Teste antes:** valide o mapeamento em **dry-run** (pré-visualização sem envio) antes de
  ativar o webhook para registros reais.
- **Outros canais:** troque o canal da integração para RCS/Voz/Push para enviar por esses canais —
  o lado do Pipedrive permanece igual.

Veja também: [Visão geral de CRM & Integrações](./README.md) · [Webhooks](../webhooks/README.md).
