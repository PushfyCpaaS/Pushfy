# Contributing to Pushfy

Thanks for helping improve the official Pushfy API docs and SDKs! 🎉

## Ground rules

- **Never commit secrets.** No API tokens, passwords, private keys, internal hostnames or
  customer data. Use placeholders like `YOUR_API_TOKEN` and `https://your-app.com/webhook`.
- **Docs describe the live API.** If code and docs disagree, fix the docs to match reality and
  note the change in `CHANGELOG.md`.
- Keep **EN and PT** docs in sync — a change to `docs/en/...` should update `docs/pt/...`.

## How to contribute

1. Fork and create a branch: `git checkout -b fix/sms-example`.
2. Make your change (docs, example, SDK, spec).
3. For SDKs/examples, make sure code runs and errors are handled.
4. Open a Pull Request with a clear description.

## Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
docs(sms): correct /webapi response shape
feat(sdk-node): add sendRcs()
fix(openapi): mark apitvoz as removed
chore(postman): add environment variables
```

## Reporting issues

Open a GitHub issue with: what you expected, what happened, the request (with secrets redacted),
and the response. Security issues: please email the Pushfy team privately instead of opening a
public issue.
