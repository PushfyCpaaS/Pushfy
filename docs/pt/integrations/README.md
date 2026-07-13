# CRM & Integrações

Conecte seu CRM ou ferramenta de automação à Pushfy e transforme os eventos dele em
**SMS, RCS, Voz ou Push** — sem código. Quando algo acontece no seu CRM (novo lead, mudança
de etapa de negócio, envio de formulário), o CRM chama uma **URL de webhook** da Pushfy e a
Pushfy envia a mensagem no canal que você escolheu.

O **Gateway Universal de Integrações** é agnóstico de plataforma: cada uma tem seu próprio
adapter que entende o webhook dela, então você só aponta para a Pushfy e mapeia alguns campos.

## Plataformas suportadas

| Plataforma | Guia |
|---|---|
| Genérico / Webhook | [generic.md](./generic.md) |
| n8n | [n8n.md](./n8n.md) |
| HubSpot | [hubspot.md](./hubspot.md) |
| Salesforce | [salesforce.md](./salesforce.md) |
| ActiveCampaign | [activecampaign.md](./activecampaign.md) |
| Pipedrive | [pipedrive.md](./pipedrive.md) |
| RD Station | [rdstation.md](./rdstation.md) |
| Bitrix24 | [bitrix24.md](./bitrix24.md) |
| Zoho CRM | [zoho.md](./zoho.md) |
| Monday.com | [monday.md](./monday.md) |

> Não achou sua ferramenta? Use a integração **[Genérico / Webhook](./generic.md)** — qualquer
> coisa que faça um HTTP POST (incluindo n8n, Make, Zapier ou seu próprio backend) funciona.

## Como funciona

```
Seu CRM  ──evento──▶  URL de webhook Pushfy  ──▶  autentica + deduplica
                                             ──▶  mapeia campos (adapter)
                                             ──▶  envia SMS / RCS / Voz / Push
                                             ──▶  (debita do seu saldo)
```

## Passo 1 — Crie a integração na Pushfy (igual para toda plataforma)

1. No painel → **Configurações → Integrações CRM** → **Nova integração**.
2. Escolha a **plataforma** (HubSpot, Pipedrive, …).
3. Escolha o **canal** de saída: `SMS`, `RCS`, `RCS Basic`, `Voz` ou `Push`.
4. Defina a **mensagem** — um template com `{{campo}}` preenchido a partir do registro do CRM,
   ex.: `Olá {{nome}}, seu pedido está a caminho!`. (Para RCS adicione título/imagem/url/botão;
   para Voz informe o nome do áudio; para Push informe o projeto.)
5. *(Opcional)* Defina um **segredo de assinatura** para a Pushfy verificar que cada webhook
   veio mesmo do seu CRM.
6. **Salve** e **copie a URL do webhook** — algo como:
   ```
   https://portal.pushfy.com/v2/gw.php?r=/v1/hook/gw_xxxxxxxxxxxxxxxx
   ```
   Essa URL contém o **seu token único**. Ela identifica e autentica sua integração —
   mantenha em sigilo e nunca compartilhe.

## Passo 2 — Aponte seu CRM para a URL

Cada plataforma tem sua própria tela de webhook/automação — veja o guia da plataforma para o
passo exato. Em todas você cola a URL da Pushfy e escolhe qual evento dispara a mensagem.

## O que toda integração garante

- **Autenticação por integração.** Cada integração tem seu **próprio token** (na URL) e seu
  **próprio segredo de assinatura** (opcional), guardados cifrados. Uma conta nunca vê os dados
  de outra.
- **Idempotência.** Se o CRM reenviar o mesmo evento, a Pushfy detecta o duplicado e não envia
  duas vezes.
- **Respeita o saldo.** Os envios consomem seu saldo/crédito normal, igual a qualquer envio. Sem
  saldo → não envia (como no resto da plataforma).
- **Modo de teste (dry-run).** Enquanto a integração é validada, a Pushfy recebe, valida e mostra
  a **prévia** da mensagem sem enviar — para você conferir o mapeamento com segurança primeiro.

## Templates de mensagem

Em qualquer mensagem você pode usar `{{campo}}` para puxar valores do registro recebido do CRM.
Campos aninhados usam ponto: `{{properties.firstname}}`, `{{contact.first_name}}`. Se um campo
não existir, fica em branco. Defina um **texto padrão** como fallback.

## Canais

Toda integração pode enviar por qualquer canal habilitado na sua conta:

| Canal | Você também define |
|---|---|
| SMS | texto da mensagem |
| RCS / RCS Basic | título, imagem, url, botão (CTA) |
| Voz | o **nome do áudio** enviado (ver [Enviar Voz](../reference/voice.md)) |
| Push | o projeto de push + título/corpo |

Veja a API completa em [Referência](../reference/) e os retornos de entrega em [Webhooks](../webhooks/README.md).
