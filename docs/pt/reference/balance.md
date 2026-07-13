# Saldo

Consulte seu saldo de SMS atual.

- **URL** — `https://portal.pushfy.com/balance`
- **Método** — `GET`
- **Auth** — Bearer (token principal da conta) **ou** Basic (login + senha) ([Autenticação](./authentication.md))

## Headers

```
Authorization: Bearer SEU_TOKEN
```

Auth Basic (`login:senha`) também é aceita.

## Requisição

```bash
curl 'https://portal.pushfy.com/balance' \
  -H 'Authorization: Bearer SEU_TOKEN'
```

## Resposta

`200 OK`:

```json
{
  "saldo": "1.500"
}
```

- `saldo` — o **saldo de SMS**, como string formatada com separador de milhar
  (`"1.500"` significa mil e quinhentos). Trate a string antes de fazer contas.

## Observações

- **Só token principal ou Basic.** O `/balance` aceita **apenas** o token Bearer principal da
  conta ou Basic (login + senha). Multi-tokens secundários **não** são aceitos aqui — use a
  credencial principal para ler o saldo. Veja [Autenticação](./authentication.md).
- **Somente SMS.** `saldo` é o saldo de SMS. **Não existe endpoint público de saldo de voz**;
  o antigo `/balancetvoz` retorna `404`.
- **String formatada.** O valor é uma string de exibição, não um número cru — remova o separador
  de milhar antes de converter.

Veja [Erros e limites](./errors.md).
