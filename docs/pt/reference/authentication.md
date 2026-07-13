# Autenticação

Toda requisição à API Pushfy precisa ser autenticada. O esquema depende do produto.

| Produto | Esquema | Onde |
|---|---|---|
| **Mensageria** (SMS/RCS/Voz, status, saldo) | **Token Bearer** | header `Authorization` |
| **Push Notifications** — chamadas do navegador/dispositivo | **app_id público** | `app_id` no corpo/query |
| **Push Notifications** — chamadas do servidor | **HMAC** | headers `X-PUSH-*` |
| **IA Conversacional** (PushAgent) | **HMAC** | headers `X-PA-*` |

Guarde as credenciais **no servidor**. Nunca coloque um token de mensageria ou secret HMAC em
app web/mobile (o `app_id` público é a única credencial destinada a dispositivos).

---

## 1. Mensageria — Token Bearer

Pegue seu token no painel: **Configurações → Tokens de API**.

Envie em toda requisição de mensageria:

```
Authorization: Bearer SEU_TOKEN
```

Duas alternativas são aceitas por conveniência:

```
X-API-TOKEN: SEU_TOKEN
```
```
Authorization: Basic base64(login:senha)   # login + senha da sua conta Pushfy
```

**Exemplo**

```bash
curl -X POST 'https://portal.pushfy.com/webapi' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"destinations":[{"to":"5511999999999"}],"text":"Oi"}]}'
```

**Erros**

| HTTP | Corpo | Significado |
|---|---|---|
| 401 | `unauthorized` | Token ausente ou inválido |
| 403 | `ip_not_allowed` | Sua conta tem lista de IPs permitidos e o IP de origem não está nela |

> **Lista de IPs (opcional).** Se sua conta restringe o acesso por IP, requisições de outros IPs
> são rejeitadas com `403`. Gerencie a lista com seu gerente de conta.

---

## 2. Push Notifications — `app_id` público

Chamadas do SDK no navegador/dispositivo (`/v1/push/config`, `subscribe`, `unsubscribe`, `track`)
autenticam com o id **público** do aplicativo — seguro para expor no front-end.

```bash
curl 'https://portal.pushfy.com/v2/api.php?r=/v1/push/config&app_id=pushapp_xxxxxxxxxxxx'
```

No `subscribe`, se o projeto define uma lista de origens permitidas, o `Origin` do navegador
precisa casar com ela (lista vazia = qualquer origem).

---

## 3. HMAC (API de servidor do Push e IA Conversacional)

Chamadas servidor-a-servidor são assinadas com HMAC-SHA256, para o secret nunca trafegar.

**Credenciais** (painel → **Configurações → Chaves de API**):

| Produto | Header da chave | Header do timestamp | Header da assinatura | Formato da chave | Formato do secret |
|---|---|---|---|---|---|
| PushAgent | `X-PA-Key` | `X-PA-Timestamp` | `X-PA-Signature` | `pak_` + 20 hex | `pas_` + 48 hex |
| Push (servidor) | `X-PUSH-Key` | `X-PUSH-Timestamp` | `X-PUSH-Signature` | `pushk_` + 20 hex | `pss_` + 48 hex |

O **secret é mostrado só uma vez**, na criação da chave. Guarde-o com segurança.

### Receita da assinatura

Monte uma string canônica e aplique HMAC-SHA256 com seu secret:

```
timestamp = tempo Unix atual em segundos
body_hash = sha256_hex(corpo_bruto_da_requisicao)   # GET/corpo vazio => sha256_hex("")
base      = timestamp + "\n" + METODO + "\n" + path + "\n" + body_hash
signature = hmac_sha256_hex(base, secret)
```

- `METODO` em maiúsculas (`GET`, `POST`, …).
- `path` é só a rota — ex.: `/v1/conversations` — **sem** a query string.
- `body` é o corpo bruto exato.
- O servidor aceita uma janela de **±300 segundos** no timestamp (protege contra replay).

### Exemplo (PushAgent, Python)

```python
import hashlib, hmac, time, requests

KEY_ID = "pak_xxxxxxxxxxxxxxxxxxxx"
SECRET = "pas_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
metodo, path = "POST", "/v1/conversations"
body = '{"user_ext_id":"user-42","name":"Ana"}'

ts   = str(int(time.time()))
bh   = hashlib.sha256(body.encode()).hexdigest()
base = f"{ts}\n{metodo}\n{path}\n{bh}"
sig  = hmac.new(SECRET.encode(), base.encode(), hashlib.sha256).hexdigest()

r = requests.post("https://portal.pushfy.com/v2/api.php", params={"r": path}, data=body,
    headers={"X-PA-Key": KEY_ID, "X-PA-Timestamp": ts, "X-PA-Signature": sig,
             "Content-Type": "application/json"})
print(r.json())   # {"ok": true, "conversation_id": 123, "status": "bot"}
```

Para a API de servidor do Push, use a mesma receita com os headers `X-PUSH-*` e suas credenciais `pushk_`/`pss_`.

**Erros**

| HTTP | Corpo | Significado |
|---|---|---|
| 401 | `unauthorized` | Header ausente, assinatura inválida ou timestamp fora da janela de 300s |
| 403 | `produto_inativo` | O produto não está habilitado na sua conta |
| 429 | `rate_limited` | Requisições demais — ver [Erros e limites](./errors.md) |

> **Idempotência (API de servidor do Push).** Envie o header `Idempotency-Key` (≤120 chars) nas
> chamadas de escrita; repetir a mesma chave devolve a resposta original em vez de agir duas vezes.

---

## Próximos passos

- [Envie seu primeiro SMS](./sms.md)
- [Erros e limites](./errors.md)
- [Webhooks](../webhooks/README.md)
