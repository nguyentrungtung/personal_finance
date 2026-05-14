<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/001-courtify-wealth-dashboard/plan.md
<!-- SPECKIT END -->

## Design References

Before implementing any frontend component or backend API handler, read the corresponding design screenshot in `design/` to understand the UI layout and the exact data fields the screen needs.

| Screen | Design image |
|--------|-------------|
| Executive Dashboard | `design/courtify_executive_dashboard/screen.png` |
| Investment Ledger | `design/investment_ledger_journal/screen.png` |
| Portfolio Analytics | `design/portfolio_analytics_trends/screen.png` |
| Savings & Debt | `design/savings_debt_management/screen.png` |
| Loan Management | `design/loan_debt_management/screen.png` |
| Settings | `design/application_settings/screen.png` |
| Settings — Bank Config | `design/settings_bank_configuration/screen.png` |
| Calendar | `design/investment_events_calendar/screen.png` |
| Modal — Gold/Silver | `design/gold_silver_entry_modal/screen.png` |
| Modal — Stocks/Crypto | `design/crypto_stock_entry_modal/screen.png` |
| Modal — Savings (1) | `design/add_savings_entry_modal_1/screen.png` |
| Modal — Savings (2) | `design/add_savings_entry_modal_2/screen.png` |
| Modal — Loan | `design/record_new_loan_modal/screen.png` |
| Modal — Calendar Event | `design/add_calendar_event_modal/screen.png` |

### Mapping check before coding

For every task that touches a UI screen or its backing API:

1. Read the relevant `screen.png` with the Read tool to understand field labels, layout, and interactions.
2. Cross-check against the API contract in `specs/001-courtify-wealth-dashboard/contracts/` — every field visible in the design must be present in the API response (or vice-versa, flag it as a gap).
3. If a mismatch is found between design and contract, **stop and flag it** before writing any code.
