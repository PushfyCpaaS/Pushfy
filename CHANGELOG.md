# Changelog

All notable changes to the Pushfy docs, spec and SDKs are recorded here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Initial repository scaffold: README (EN/PT), structure, license, contributing guide.
- Verified endpoint index (`docs/en/reference/endpoints.md`) generated from the live API.

### Notes / corrections vs. previous public docs
- `POST /apitvoz` and `GET /balancetvoz` documented previously are **not implemented** — removed.
- `POST /webapi` returns an array `[{id,phone,date,ext_id}]`, not `{accepted,queued}`.
- `GET /balance` returns `{"saldo":"1.500"}` (formatted string), not `{status,balance}`.
- `GET /getstatus` returns an array and also accepts `uid`.
- Voice is sent via `/webapi` using the `audio` field, not a dedicated endpoint.
