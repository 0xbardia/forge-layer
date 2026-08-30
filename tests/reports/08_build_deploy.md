# 08 Build Deploy Report

Status: **PASS**

Ran at: 2026-08-29 14:08:57 UTC

## Cases

- [PASS] production build artifact: frontend/out/index.html
- [PASS] PM2 start via scripts/start-qa.sh
- [PASS] /health JSON after start
- [PASS] /config rehearsal (contract_configured=false)
- [PASS] static pages: /, /registry/, /submit/, /protocol/, /disputes/1/
- [PASS] Chromium smoke against QA URL

## Live QA address

`172.16.0.2:54179`

Process name `forge-layer`, interpreter python3, `HOST=0.0.0.0`.

## Notes

Frontend is the existing `next build` export under `frontend/out`. Health check greened before the script printed IP:PORT.
