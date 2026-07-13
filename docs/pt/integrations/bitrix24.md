# Integração Bitrix24

Envie uma mensagem SMS, RCS, Voz ou Push pela Pushfy sempre que algo acontecer no Bitrix24 —
por exemplo quando um negócio é criado, um lead é adicionado ou um contato muda de etapa.

- **Direção:** Bitrix24 → Pushfy (o Bitrix24 chama uma URL de webhook da Pushfy).
- **Slug do provedor:** `bitrix24`
- **Melhor gatilho:** um **Outbound webhook** do Bitrix24 (ou um passo "webhook" de Business Process).

---

## Passo 1 — Crie a integração na Pushfy

1. Painel → **Configurações → Integrações CRM → Nova integração**.
2. **Plataforma:** Bitrix24.
3. **Canal:** ex.: `SMS`.
4. **Mensagem:** `Olá {{data.FIELDS.NAME}}, recebemos sua solicitação!`
5. **Application token:** cole o **application_token** do seu outbound webhook do Bitrix24 para a
   Pushfy verificar cada requisição (veja *Autenticação*).
6. *(Opcional)* **Campo de telefone (`campo_telefone`):** o campo dentro de `data.FIELDS` que
   traz o telefone, caso não seja o padrão `PHONE`/`MOBILE`.
7. **Salve** e **copie a URL do webhook**.

## Passo 2 — Configure o webhook no Bitrix24

1. No Bitrix24, abra **Developer resources** e crie um **Outbound webhook** (ou adicione um
   passo *"webhook"* a um Business Process).
2. **URL do handler:** cole a URL da Pushfy do Passo 1.
3. **Evento:** escolha o gatilho, ex.: `ONCRMDEALADD`, `ONCRMLEADADD`.
4. **Inclua os campos:** o Bitrix costuma enviar só o **ID** do registro — configure o webhook
   para incluir os campos do registro, de forma que o **telefone** chegue à Pushfy (veja
   *Mapeamento de campos*).
5. Salve e ative o webhook.

O Bitrix24 envia como `application/x-www-form-urlencoded` com `event` (ex.: `ONCRMDEALADD`),
`data[FIELDS][ID]`, `auth[application_token]` e `auth[domain]`.

## Autenticação

Na integração preencha o **application_token**. A Pushfy compara com o `auth.application_token`
recebido e rejeita o que não coincidir. O token da URL já autentica a integração por si só; o
application token é uma verificação extra do Bitrix24.

## Mapeamento de campos

A Pushfy lê o telefone do destinatário nos campos do registro, tentando nesta ordem:

- `data.FIELDS.PHONE` — uma lista como `[{ "VALUE": "...", "VALUE_TYPE": "WORK" }]`; o `VALUE`
  é usado.
- `data.FIELDS.MOBILE`
- um campo configurável `campo_telefone` dentro de `data.FIELDS`.

As variáveis do template vêm do registro — ex.: `{{data.FIELDS.NAME}}`, `{{event}}`. Os
números são normalizados automaticamente (apenas dígitos, código do país primeiro). O `ext_id`
é `event:ID`. **Eventos sem telefone são ignorados.**

## Exemplo

O Bitrix24 envia algo como:

```
event=ONCRMDEALADD
data[FIELDS][ID]=42
data[FIELDS][NAME]=Ana
data[FIELDS][PHONE][0][VALUE]=+55 (11) 99999-8888
data[FIELDS][PHONE][0][VALUE_TYPE]=WORK
auth[application_token]=abc123
auth[domain]=sua.bitrix24.com
```

Com o canal `SMS` e a mensagem `Olá {{data.FIELDS.NAME}}, recebemos sua solicitação!`, a Pushfy
envia **um SMS** para `5511999998888`: *"Olá Ana, recebemos sua solicitação!"*.

## Observações

- **Inclua o telefone:** se o webhook envia só o ID, nenhum telefone chega e o evento é
  **ignorado**. Adicione os campos ao webhook para `PHONE`/`MOBILE` chegarem à Pushfy. Buscar o
  registro de volta pela API REST do Bitrix é uma **fase futura** — por enquanto o telefone
  precisa vir no payload do webhook.
- **Idempotência:** retentativas do Bitrix são de-duplicadas (por `event:ID` ou hash do corpo).
- **Saldo:** o SMS é cobrado do seu saldo normal; sem saldo → não é enviado.
- **Teste antes:** valide o mapeamento em **dry-run** (prévia sem enviar) antes de ativar o
  webhook para registros reais.
- **Outros canais:** troque o canal da integração para RCS/Voz/Push para enviar por eles — o
  lado do Bitrix24 permanece igual.

Veja também: [Visão geral de CRM & Integrações](./README.md) · [Webhooks](../webhooks/README.md).
