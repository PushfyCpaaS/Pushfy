# Migrando da documentação antiga para a API unificada

Sejamos honestos logo de cara: **suas integrações de SMS, RCS e Voz continuam funcionando.**
Os endpoints clássicos de Mensageria não mudaram. O que mudou foi a **documentação** — os
docs públicos antigos continham vários **erros factuais**, e esta referência unificada os
corrige. Se o seu código foi escrito contra os docs antigos, ele pode estar tratando respostas
que nunca tiveram o formato que os docs afirmavam.

Este guia tem duas partes:

1. **Correções** — onde os docs antigos estavam errados, para você ajustar o parsing.
2. **Adotando os novos produtos** — Push e PushAgent via gateway V2, e a troca de postbacks
   legados por webhooks self-service assinados.

---

## Parte 1 — Correções aos docs antigos

Os endpoints são os mesmos; o **comportamento documentado** é que estava errado. Audite seu
código contra esta tabela.

| Tópico | Docs antigos afirmavam | Comportamento real (esta referência) |
|---|---|---|
| Resposta de `POST /webapi` | Um objeto como `{ "accepted": N, "queued": N }` | Um **array JSON**, um objeto por mensagem: `[{id, phone, date, ext_id}]` |
| Resposta de `GET /balance` | Um saldo numérico | `{ "saldo": "1.500" }` — uma **string formatada** com separador de milhar; converta antes de fazer conta |
| Resposta de `GET /getstatus` | Um único objeto de status | Um **array JSON**, um objeto por mensagem encontrada |
| Chave de consulta do `GET /getstatus` | Só `ext_id` | Aceita **`ext_id` ou `uid`** (id interno da mensagem) |
| `POST /apitvoz` (enviar voz) | Um endpoint de voz dedicado | **Não existe** — retorna `404`. Voz é `/webapi` com o campo `audio` |
| `GET /balancetvoz` (saldo de voz) | Um endpoint de saldo de voz | **Não existe** — retorna `404`. Não há endpoint público de saldo de voz |
| Resultados de `/getstatus` / `/reportbydate` / `/getdate` | Objetos únicos | **Arrays** — sempre itere, mesmo para um item |

### O que mudar no seu código

- **Faça parse dos envios como arrays.** Após `POST /webapi`, itere o array e leia o `ext_id` de
  cada linha — não leia `response.accepted`. Veja [Enviar SMS](../reference/sms.md).
- **Faça parse do `saldo` como string.** Remova o separador de milhar antes da aritmética:
  `"1.500"` significa 1500, não 1,5. Veja [Saldo](../reference/balance.md).
- **Trate toda resposta de status como array.** `/getstatus`, `/getdate` e `/reportbydate` todas
  retornam arrays. Veja [Status de entrega](../reference/status.md).
- **Remova as chamadas a `/apitvoz` e `/balancetvoz`.** Para voz, suba um `.mp3` no `/audio` e
  depois envie no `/webapi` com o id devolvido no campo `audio`. Não há saldo de voz público.
  Veja [Enviar Voz](../reference/voice.md).
- **Lembre que o status pode vir em texto puro.** Alguns endpoints de status retornam erros em
  texto puro (`Unauthorized`, `Messages not found`), não JSON — não presuma JSON fora do `200`.
  Veja [Erros e limites](../reference/errors.md).

> Nenhuma dessas exige reintegração. São **correções de parsing** para o seu código bater com o
> que os endpoints sempre de fato retornaram.

---

## Parte 2 — Adotando os novos produtos

Os novos produtos — **Push Notifications** e **PushAgent** (IA Conversacional) — vivem atrás de
um único gateway V2:

```
https://portal.pushfy.com/v2/api.php?r=<rota>
```

Eles autenticam com **HMAC-SHA256**, não com token Bearer. Cada requisição leva uma chave, um
timestamp e uma assinatura sobre `timestamp + método + path + sha256(corpo)`:

| Produto | Cabeçalho da chave | Timestamp | Assinatura | Chave / secret |
|---|---|---|---|---|
| Push (servidor) | `X-PUSH-Key` | `X-PUSH-Timestamp` | `X-PUSH-Signature` | `pushk_` / `pss_` |
| PushAgent | `X-PA-Key` | `X-PA-Timestamp` | `X-PA-Signature` | `pak_` / `pas_` |

Pegue as credenciais em **Configurações → Chaves de API** (o secret é exibido **uma vez**). A
receita completa de assinatura está em
[Autenticação](../reference/authentication.md#receita-da-assinatura), e os erros da V2 usam
`{ "ok": false, "error": "..." }` — veja [Erros e limites](../reference/errors.md).

Para criar e disparar uma campanha de Push de ponta a ponta, siga o
[guia Crie uma campanha](./campaigns.md).

### De postbacks legados para webhooks assinados

Se você consumia **postbacks legados** para recibos de entrega, migre para os **webhooks
self-service assinados**. Eles são configurados por conta em **Configurações → Webhooks** e
assinados com HMAC-SHA256, para você verificar a autenticidade:

| Eventos | Webhook | Cabeçalho da assinatura |
|---|---|---|
| DLR de SMS/RCS/Voz + respostas recebidas | [Status de mensageria](../webhooks/messaging-status.md) | `X-Pushfy-Signature: sha256=<hex>` |
| Eventos de campanha/dispositivo do Push | [Push](../webhooks/push.md) | `X-Push-Signature: sha256=<hex>` |
| Eventos de conversa do PushAgent | [Conversas](../webhooks/conversations.md) | `X-PA-Signature: <hex>` (puro) |

Valide a assinatura sobre o **corpo bruto**, responda `2xx` rápido e deduplique — o
[guia de recebimento de webhooks](./receiving-webhooks.md) tem handlers prontos.

> **Nota de honestidade.** O webhook de status de mensageria ainda está em rollout self-service.
> Se ele não estiver ativo na sua conta ainda, peça ao seu **gerente de conta** para habilitar.

---

## Checklist de migração

- [ ] Respostas de `/webapi` tratadas como **array** (não `{accepted, queued}`).
- [ ] `saldo` tratado como **string formatada** (remova o separador de milhar).
- [ ] `/getstatus`, `/getdate`, `/reportbydate` todas tratadas como **arrays**.
- [ ] `/getstatus` opcionalmente consultado por **`uid`** onde for útil, não só por `ext_id`.
- [ ] Todas as chamadas a **`/apitvoz`** removidas → voz via `/audio` + campo `audio` do `/webapi`.
- [ ] Todas as chamadas a **`/balancetvoz`** removidas → não há endpoint público de saldo de voz.
- [ ] Respostas de status fora do `200` tratadas como possivelmente **texto puro**.
- [ ] Novos produtos (Push / PushAgent) integrados via **`/v2/api.php` + HMAC**.
- [ ] Postbacks legados substituídos por **webhooks self-service assinados** (com validação de
      assinatura e dedupe por `eid`/`ext_id`).

---

## Próximos passos

- [Índice de endpoints](../reference/endpoints.md) — a lista autoritativa e verificada.
- [Envie sua primeira mensagem](./first-message.md) · [Crie uma campanha](./campaigns.md).
- [Recebendo webhooks](./receiving-webhooks.md) · [Tratando erros](./error-handling.md).
