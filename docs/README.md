# BigBike Documentation Index

This directory contains the canonical documentation for the BigBike monorepo.

## Governance

- `docs/business/` is the source of truth for business scope, workflows, and rules.
- `docs/engineering/` is the source of truth for architecture, API, data, permission, testing, and integration guidance.
- `docs/DECISIONS.md` records active technical/governance decisions.
- Historical audits and phase reports are useful evidence, but they are not canonical.
- When canonical docs conflict with historical audits or reports, canonical docs win and the historical file must be revalidated against current code.
- When docs conflict with current code, validate the controller/service/config/test first, then repair docs and code together in the same change set.

## Canonical Documents

| Path | Domain | Role | Notes |
|---|---|---|---|
| `docs/DECISIONS.md` | governance | canonical | Active decision log. |
| `docs/business/PROJECT_OVERVIEW.md` | business | canonical | Scope, apps, current platform status. |
| `docs/business/MODULE_CATALOG.md` | business | canonical | Current module inventory across web/admin/backend/mobile. |
| `docs/business/USER_ROLES.md` | business | canonical | Role definitions. Validate sensitive changes against code. |
| `docs/business/BUSINESS_PROCESS.md` | business | canonical | High-level operational processes. |
| `docs/business/BUSINESS_RULES.md` | business | canonical | Enforced rules that matter to behavior and release risk. |
| `docs/business/WORKFLOW_OVERVIEW.md` | business | canonical | End-to-end flows across modules. |
| `docs/business/STATE_MACHINES.md` | business | canonical | State/transition reference. Validate against enums and services before changing code. |
| `docs/business/ACCEPTANCE_CRITERIA.md` | business | canonical | Verifiable acceptance criteria by module. |
| `docs/business/GLOSSARY.md` | business | canonical | Shared terminology. |
| `docs/engineering/ARCHITECTURE.md` | engineering | canonical | Repo boundaries, runtimes, integrations. |
| `docs/engineering/API_CONTRACT.md` | engineering | canonical | Human-readable API contract companion to OpenAPI. |
| `docs/engineering/DATA_CONTRACT.md` | engineering | canonical | Data shape, snapshots, drift, storage caveats. |
| `docs/engineering/API_FLOW_MAP.md` | engineering | canonical | UI/client to API to service/data mapping. |
| `docs/engineering/PERMISSION_MATRIX.md` | engineering | canonical | Roles, permissions, guarded routes/endpoints. |
| `docs/engineering/TESTING_GUIDE.md` | engineering | canonical | Test commands, CI truth, verified suites. |
| `docs/engineering/DEPLOYMENT_GUIDE.md` | engineering | canonical | Deployment/runtime guidance. Revalidate with config before infra changes. |
| `docs/engineering/INTEGRATION_GUIDE.md` | engineering | canonical | External and internal integration status. |
| `docs/engineering/TRACEABILITY_MATRIX.md` | engineering | canonical | Business-to-code-to-test traceability. |

## Audits And Reports

These files are evidence, not source of truth:

| Location | Role | Rule |
|---|---|---|
| `docs/audits/` | module audit history | Treat as point-in-time findings. Validate against current code and canonical docs. |
| `docs/BIGBIKE_DOC_CODE_REPORT.md` | historical docs/code audit | Historical only. |
| `docs/DOCS_VERIFICATION_REPORT.md` | verification report | Read as audit evidence; if a finding is stale, canonical docs and current code win. |
| `bigbike-backend/docs/` | backend phase reports | Implementation history, not active contract. |

Historical files should carry this banner:

```text
HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.
```

## Generated Or Vendor Documentation

Do not treat generated/vendor docs as project governance inputs:

- Flutter plugin symlink docs under `bigbike_mobile/**/.plugin_symlinks/**`
- Third-party package docs pulled in via dependency managers
- Rendered previews or exports that do not define behavior

## Maintenance Rules

1. Update canonical docs in the same change set as any change to behavior, API shape, data shape, permission, workflow, or deployment contract.
2. Regenerate or update `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json` when live controller coverage changes.
3. Move new implementation reports into `docs/reports/` when they are not intended to be canonical.
4. If a rule cannot be confirmed from code, config, migration, or test, write `NEEDS_VERIFICATION` instead of guessing.
