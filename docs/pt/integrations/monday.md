# Integração Monday.com

Envie uma mensagem SMS, RCS, Voz ou Push pela Pushfy sempre que algo acontecer em um board do
Monday.com — por exemplo quando um item é criado, muda de grupo ou uma coluna de status muda.

- **Direção:** Monday.com → Pushfy (o Monday chama uma URL de webhook da Pushfy).
- **Slug do provedor:** `monday`
- **Melhor gatilho:** a integração **Webhooks** do Monday no seu board.

---

## Passo 1 — Crie a integração na Pushfy

1. Painel → **Configurações → Integrações CRM → Nova integração**.
2. **Plataforma:** Monday.com.
3. **Canal:** ex.: `SMS`.
4. **Mensagem:** `Olá, o item {{event.pulseName}} foi atualizado!`
5. **Coluna de telefone (`phone_column`):** cole o **id da coluna de telefone** do seu board —
   a Pushfy lê o telefone dela (veja *Mapeamento de campos*).
6. **Signing secret:** cole o **signing secret** do seu app Monday para a Pushfy verificar o JWT
   de cada requisição (veja *Autenticação*).
7. **Salve** e **copie a URL do webhook**.

## Passo 2 — Configure o webhook no Monday.com

1. No seu board, abra **Integrations** e adicione a integração **Webhooks**.
2. Escolha a receita **"When [evento], send a webhook"** (ex.: quando um item é criado, quando
   uma coluna muda).
3. **Webhook URL:** cole a URL da Pushfy do Passo 1.
4. Salve a integração.

O Monday envia JSON como `{ "event": { "pulseId", "boardId", "columnValues"/"value", ... } }`
e o assina com um JWT no header `Authorization`.

## Autenticação

O Monday assina cada webhook com um **JWT (HS256)** no header `Authorization`, usando o
**signing secret** do seu app Monday. Preencha esse **signing_secret** na integração para a
Pushfy verificar e rejeitar o que não coincidir.

O **handshake inicial de `challenge`** (o Monday envia um valor `challenge` quando você salva o
webhook) é respondido **automaticamente pela Pushfy** — você não precisa fazer nada.

## Mapeamento de campos

A Pushfy lê o telefone do destinatário na coluna definida em **`phone_column`**, tentando nesta
ordem:

- `event.columnValues[phone_column].phone`
- `event.columnValues[phone_column].value`
- `event.columnValues[phone_column].text`

As variáveis do template vêm de `event` — ex.: `{{event.pulseName}}`, `{{event.boardId}}`. Os
números são normalizados automaticamente (apenas dígitos, código do país primeiro). O `ext_id`
é o `pulseId` (id do item). Eventos sem telefone são ignorados.

## Exemplo

O Monday envia algo como:

```json
{
  "event": {
    "pulseId": 1234567890,
    "pulseName": "Ana",
    "boardId": 987654321,
    "columnValues": {
      "phone": { "phone": "+55 (11) 99999-8888", "countryShortName": "BR" }
    }
  }
}
```

Com `phone_column` = `phone`, canal `SMS` e a mensagem `Olá, o item {{event.pulseName}} foi
atualizado!`, a Pushfy envia **um SMS** para `5511999998888`: *"Olá, o item Ana foi atualizado!"*.

## Observações

- **Id da coluna, não o título:** `phone_column` precisa ser o **id** da coluna (ex.: `phone`,
  `phone1`), não o nome exibido.
- **Handshake:** a requisição de `challenge` é respondida automaticamente; sem configuração.
- **Idempotência:** retentativas do Monday são de-duplicadas (por `pulseId`/id do item ou hash
  do corpo).
- **Saldo:** o SMS é cobrado do seu saldo normal; sem saldo → não é enviado.
- **Teste antes:** valide o mapeamento em **dry-run** (prévia sem enviar) antes de ativar a
  integração para itens reais.
- **Outros canais:** troque o canal da integração para RCS/Voz/Push para enviar por eles — o
  lado do Monday permanece igual.

Veja também: [Visão geral de CRM & Integrações](./README.md) · [Webhooks](../webhooks/README.md).
