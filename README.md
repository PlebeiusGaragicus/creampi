# creampi

Web-based agent platform built on [pi-mono](https://github.com/badlogic/pi-mono), with NIP-98 Nostr authentication, LM Studio as the primary inference backend, and support for any OpenAI-compatible provider via settings.

## Documentation

Full documentation lives in the parent repo at `docs/creampi/`:

- [Overview](../../docs/creampi/overview.md) -- architecture, auth, streaming, feature set
- [Agent Types](../../docs/creampi/agent-types.md) -- chat (implemented) vs computer/ambient (roadmap)
- [WebUI Vision](../../docs/creampi/webui-vision.md) -- unified app design
- [Homelab Integrations](../../docs/creampi/homelab-integrations.md) -- Gitea, strfry, ntfy
- [API](../../docs/creampi/api.md) -- SvelteKit API endpoint contract
- [Runtime & Sandbox](../../docs/creampi/runtime-sandbox.md) -- nspawn isolation (roadmap)
- [LM Studio Defaults](../../docs/creampi/lm-studio-defaults.md) -- model configuration

## Quick Start (Development)

```bash
cd MAC_MINI/creampi
cp .env.example .env
npm install
npm run dev
```

## Structure

```
creampi/
├── src/               Unified SvelteKit app (UI + API routes)
├── data/              Runtime data (SQLite, uploads) -- gitignored
├── package.json
└── .env.example
```
