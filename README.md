# BigBike

BigBike is a motorcycle gear commerce monorepo with four main surfaces:

- `bigbike-web`: public SEO commerce site built with Next.js 16.2.4
- `bigbike-admin`: internal operations dashboard built with Vite + React
- `bigbike-backend`: Spring Boot backend on Java 17
- `bigbike_mobile`: Flutter companion app

## Start Here

- Repository operating rules: [`AGENTS.md`](AGENTS.md)
- Documentation index and governance: [`docs/README.md`](docs/README.md)
- Active decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md)

## Repo Layout

```text
bigbike/
├── AGENTS.md
├── README.md
├── docker-compose.yaml
├── .env.example
├── docs/
│   ├── README.md
│   ├── DECISIONS.md
│   ├── business/
│   ├── engineering/
│   ├── audits/
│   └── reports/
├── bigbike-web/
├── bigbike-admin/
├── bigbike-backend/
├── bigbike_mobile/
└── Bigbike Design System/
```

## Documentation Rule

Canonical docs live under `docs/business/` and `docs/engineering/`.

Historical audits, implementation reports, and phase reports are evidence only. If they conflict with canonical docs, canonical docs win and current code must be revalidated.
