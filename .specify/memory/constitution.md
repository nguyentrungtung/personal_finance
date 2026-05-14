<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Modified principles: N/A
Added sections:
  - V. Input Validation & Schema Contracts
  - VI. Error Handling & Resilience
  - VII. Financial Data Integrity
Added quality gates:
  - Schema validation gate (Zod, 0 unvalidated endpoints)
  - Financial integrity gate (append-only audit log, no monetary float)
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ Constitution Check table extended with V/VI/VII rows
  - .specify/templates/spec-template.md ✅ Requirements and Edge Cases sections align with validation/error-handling principles
  - .specify/templates/tasks-template.md ✅ Phase 2 (Foundational) tasks should include Zod schema setup and global error handler
Follow-up TODOs: None — all principles concrete and testable.
-->

# PersonalFinance Constitution

## Core Principles

### I. Code Quality

All code MUST be clean, self-documenting, and reviewable by any team member without prior context.

- Every module, function, and component MUST have a single, clearly defined responsibility.
- Code MUST pass linting and static analysis gates with zero errors before merge.
- Cyclomatic complexity per function MUST NOT exceed 10; extract helpers when this limit is approached.
- Magic numbers and strings MUST be replaced with named constants or configuration values.
- Dead code, commented-out blocks, and TODO-only files MUST NOT be merged to main.
- All PRs MUST pass peer review by at least one other contributor before merge.

**Rationale**: Unreadable or inconsistent code is a liability that compounds over time. In a
personal-finance domain, correctness and auditability of logic are non-negotiable.

### II. Testing Standards

Tests are first-class citizens and MUST be written before implementation (Test-Driven Development).

- The Red-Green-Refactor cycle is MANDATORY: write a failing test → implement → refactor.
- Unit test coverage MUST be ≥ 80% for all business-logic modules.
- Every public API contract (function signature, HTTP endpoint, event schema) MUST have at least
  one contract test.
- Integration tests MUST cover every critical user journey end-to-end.
- Tests MUST be deterministic: no flaky tests are permitted in the test suite.
- Test data MUST use fixtures or factories; production data MUST NOT appear in tests.
- A failing test suite MUST block merge — CI gates are not optional.

**Rationale**: Financial calculations have zero tolerance for regressions. Test-first discipline
ensures correctness is verified continuously, not just at release time.

### III. User Experience Consistency

Every user-facing surface MUST follow a unified design language and interaction model.

- All UI components MUST reference the shared design system (tokens, spacing scale, typography).
- Interactive elements (buttons, forms, navigation) MUST behave identically across equivalent
  screens — same affordances, same feedback patterns.
- Error messages MUST be human-readable, actionable, and consistent in tone and placement.
- Accessibility: all screens MUST meet WCAG 2.1 AA standards (contrast ratios, focus management,
  ARIA labels).
- Loading, empty, and error states MUST be designed and implemented for every data-driven view.
- User flows MUST be validated against acceptance scenarios in the feature spec before shipping.

**Rationale**: A personal-finance app handles money and trust. Inconsistent UX erodes confidence
and increases costly user errors.

### IV. Performance Requirements

The application MUST meet defined performance budgets; degradation is treated as a bug.

- Initial page/screen load MUST complete in ≤ 2 seconds on a mid-range device with a 4G connection.
- API responses for read operations MUST return in ≤ 200 ms at p95 under normal load.
- API responses for write/mutation operations MUST return in ≤ 500 ms at p95.
- The app MUST remain responsive (no UI jank) during background data fetches; perceived performance
  optimizations (skeleton screens, optimistic updates) are required for operations > 300 ms.
- Memory usage MUST NOT grow unboundedly; long-lived sessions MUST be tested for memory leaks.
- Performance budgets MUST be measured in CI using automated tooling (e.g., Lighthouse, k6, or
  platform equivalents) and regressions MUST block merge.

**Rationale**: Users check their finances frequently and on mobile networks. Slow or janky
experiences break trust and reduce retention.

### V. Input Validation & Schema Contracts

All data entering or leaving the system MUST be validated against an explicit schema. No data
reaches business logic or the database without passing a validation gate.

- Every API route handler MUST validate its request body, query parameters, and path params using
  a Zod schema **before** any service or database call. A route that skips validation is a bug.
- Zod schemas MUST be the single source of truth for data shape — no ad-hoc `if (typeof x ===
  'string')` checks scattered in service code. If a check is needed repeatedly, it belongs in
  the schema.
- All monetary input fields (frontend forms) MUST reject non-numeric characters on keypress and
  re-validate on blur before submission. A VND value that cannot be parsed as a positive decimal
  MUST NOT reach the API.
- Enum-like fields (asset class, instrument type, loan type, transaction type, lot status, etc.)
  MUST be validated as one of the exact allowed values; unknown values MUST return `400
  VALIDATION_ERROR`.
- API responses MUST also be schema-validated at the service boundary (output validation) to
  prevent accidental leakage of internal fields (e.g., `password_hash`, `totp_secret`).
- Frontend form state MUST use React Hook Form + Zod resolver; form submission MUST be blocked
  while any field is in an invalid state — no silent discard of user input.

**Rationale**: In a financial application, malformed data can corrupt balances, miscalculate P&L,
or expose sensitive user information. Validation at every boundary is the first line of defence.

### VI. Error Handling & Resilience

Every failure path MUST be explicitly handled. Unhandled exceptions and silent failures are bugs.

- All Express route handlers MUST be wrapped with an async error-catching wrapper (e.g.,
  `asyncHandler`) or use a try/catch block that forwards errors to the Express global error
  middleware via `next(err)`. Unhandled promise rejections MUST NOT crash the server.
- The global error middleware MUST distinguish error categories and map them to HTTP status codes:
  - `ZodError` (validation failure) → `400 VALIDATION_ERROR`
  - `BusinessRuleError` (domain violation) → `422 BUSINESS_RULE`
  - `NotFoundError` → `404 NOT_FOUND`
  - `AuthError` → `401 UNAUTHORIZED` or `403 FORBIDDEN`
  - All other unhandled errors → `500 INTERNAL_ERROR`
- Error responses MUST NEVER expose stack traces, SQL queries, file paths, or internal identifiers
  to the client. Internal details MUST be logged server-side only.
- SQLite transactions that modify financial data (SELL with FIFO matching, loan payment recording,
  net worth snapshot upsert) MUST be wrapped in `db.transaction(() => { ... })`. If any step
  fails, the entire transaction MUST roll back — partial writes are not permitted.
- Financial calculations (P&L, accrued interest, average cost, net worth) MUST guard against
  divide-by-zero and `NaN`/`Infinity` results. If an intermediate value is invalid, the
  calculation MUST throw a `BusinessRuleError` with a descriptive message rather than silently
  producing a corrupt value.
- Frontend components that fetch data MUST implement an error boundary or local error state.
  Network failures MUST display a user-readable message; the UI MUST NOT freeze or show a blank
  screen on API error.
- Optimistic UI updates (e.g., inline price edit) MUST roll back to the previous value on API
  failure and display an error notification.

**Rationale**: Silent failures in a financial system can lead to incorrect balances, invisible
data loss, or security exposure. Explicit, structured error handling ensures failures are
surfaced, logged, and recoverable.

### VII. Financial Data Integrity

Financial records are the authoritative source of truth and MUST be treated as immutable audit
trails. Correctness and traceability take precedence over convenience.

- All monetary values MUST be stored as `TEXT` (decimal string, 4 decimal places, e.g.
  `"2450000.0000"`) in SQLite. Storing monetary values as `REAL` or `INTEGER` (without explicit
  decimal semantics) is prohibited. JavaScript `Number` is acceptable for in-memory arithmetic
  at service layer only; results MUST be rounded to 4 decimal places and converted back to TEXT
  before any DB write.
- `asset_transactions` records are append-only and MUST NEVER be updated or deleted. Corrections
  to recorded trades MUST be made via compensating entries (a new opposing transaction), not by
  modifying existing rows. Any code path that issues `UPDATE` or `DELETE` on `asset_transactions`
  is a critical bug.
- `ledger_entries` deletions MUST use soft-delete (`deleted_at` timestamp). Hard deletes on
  ledger records are prohibited. Soft-deleted entries MUST be excluded from all calculations and
  views but retained in the database for audit purposes.
- A `net_worth_snapshots` upsert MUST be triggered after every mutation that affects total net
  worth: BUY/SELL on asset lots, price update on any lot or metals holding, savings instrument
  create/update/withdraw, loan payment recorded. Missing this step after a mutation is a bug.
- Loan payment `paid_amount` MUST NOT exceed the loan's remaining balance. This rule MUST be
  enforced in the service layer **before** any database write, not only as a DB constraint.
- FIFO lot matching for a SELL operation MUST be executed within a single SQLite transaction
  covering: `remaining_volume` decrements on all consumed lots, `status` updates on affected
  lots, and insertion of all resulting `asset_transactions` rows. If any part fails, the entire
  sell is rolled back.
- Accrued interest for savings instruments MUST be computed at query time using
  `principal × (rate/100) × (days_elapsed/365.0)` — never stored as a pre-computed column that
  can go stale. The formula result MUST be rounded to 4 decimal places before display.

**Rationale**: Trust in a personal-finance app is built on the guarantee that numbers never
silently change, disappear, or become inconsistent. Immutability of audit records and strict
monetary precision are non-negotiable properties of the system.

## Development Workflow

- Feature work MUST begin with a specification in `/specs/[###-feature-name]/spec.md`.
- An implementation plan (`plan.md`) MUST be reviewed and approved before coding starts.
- Tasks MUST be broken into independently testable increments following the tasks template.
- Every task that touches business logic MUST include or update tests.
- Every task that introduces a new API endpoint MUST include a Zod schema definition (Principle V)
  and a corresponding contract test (Principle II).
- Every task that performs a multi-step financial mutation MUST wrap it in a SQLite transaction
  (Principle VI) and trigger a net worth snapshot upsert (Principle VII).
- Commits MUST be atomic: one logical change per commit, with a descriptive message.
- Feature branches MUST be short-lived (≤ 5 business days); long-running branches require
  a documented justification.

## Quality Gates

The following checks are MANDATORY before any branch merges to `main`:

| Gate | Tool / Method | Threshold |
|------|---------------|-----------|
| Linting & static analysis | Project linter (ESLint + tsc --noEmit) | 0 errors |
| Unit test coverage | Vitest coverage | ≥ 80% on changed business-logic modules |
| All tests pass | CI suite (unit + integration + e2e) | 100% green |
| Constitution Check | Manual / PR checklist | No violations |
| Performance budget | Lighthouse / Supertest benchmarks | Within defined budgets |
| Accessibility | Automated scan + manual | WCAG 2.1 AA |
| Schema validation coverage | Manual audit | 0 endpoints without Zod schema (Principle V) |
| Financial integrity | Code review + integration tests | No REAL/float monetary storage; no raw UPDATE/DELETE on asset_transactions (Principle VII) |
| Peer code review | PR approval | ≥ 1 approval |

## Governance

This constitution supersedes all informal conventions and undocumented practices. All contributors
MUST comply with its principles from the date of ratification.

**Amendment procedure**:
1. Open a proposal describing the change, motivation, and migration plan.
2. Obtain approval from the project lead and at least one other contributor.
3. Update this file with a version bump per the versioning policy below.
4. Propagate changes to all dependent templates (plan, spec, tasks) in the same PR.

**Versioning policy**:
- MAJOR: Backward-incompatible changes — principle removal, redefinition, or scope reduction.
- MINOR: New principle or section added; material expansion of guidance.
- PATCH: Clarification, wording improvement, typo fix, non-semantic refinement.

**Compliance review**: Constitution Check MUST be performed at the start of every plan (`plan.md`)
and re-verified after Phase 1 design. All PRs MUST include a brief constitution compliance note.

For runtime development guidance, refer to `CLAUDE.md` at the repository root.

**Version**: 1.1.0 | **Ratified**: 2026-05-13 | **Last Amended**: 2026-05-14
