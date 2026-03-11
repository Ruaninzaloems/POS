# Phase 1 (v2) — Section 129: Blockers & Action List

> **Date**: 2026-03-11
> **Scope**: Section 129 Config + Notices + Trial Review + Authorization (Pages 1-4)

---

## Critical Blockers

| # | Blocker | Owner | Impact | Resolution | Priority |
|---|---------|-------|--------|-----------|----------|
| B1 | **No `BillingDebt` controller on Platinum API** | API Team | All 20 Section 129 endpoints return 404/502 | Build C# controller with Swagger docs, deploy to Azure UAT | CRITICAL |
| B2 | **DB schema changes not applied** | DBA | Config, cost items, attorney rotation cannot persist; IncludePensioners/WhatsApp flags lost | Run `PHASE1_V2_DB_CHANGE_SCRIPT.sql` on EMS database | CRITICAL |
| B3 | **Angular components call wrong API paths** | Frontend (Replit) | Section 129 page gets 404 on all data loads | Update component to use `/api/platinum/billing-debt/...` paths | HIGH |
| B4 | **No Service Bus queue for trial/final runs** | Azure Infra | Async processing won't work | Create queues: `section129-trial-run`, `section129-final-run` | HIGH |
| B5 | **No worker process built** | API Team | Trial runs can't qualify accounts, final runs can't generate files | Build .NET worker service for Section 129 processing | HIGH |

---

## Actions Required

### Action 1: DBA — Execute DB Change Script
- **Script**: `PHASE1_V2_DB_CHANGE_SCRIPT.sql`
- **Environment**: Platinum EMS UAT Database (George)
- **Changes**:
  - ALTER `Billing_Section129LetterOFDemand`: Add `IncludePensioners`, `WhatsApp`, `StatusID` columns
  - ALTER `Billing_Section129LetterOFDemandDetails`: Add `Selected` column
  - CREATE `Billing_Section129RunFiles` table
  - CREATE `Billing_Section129Config` table
  - CREATE `Billing_Section129ConfigCostItems` table
  - CREATE `Billing_Section129ConfigAttorneyRotation` table
  - CREATE 6 indexes
- **Estimated time**: 15 minutes
- **Rollback**: Included in script (commented section)

### Action 2: API Team — Build BillingDebt Controller
- **Spec**: `PHASE1_V2_SECTION129_DETAIL_PACK.md` (Section 3)
- **Controller**: `BillingDebtController.cs`
- **Endpoints**: 20 (7 config + 6 lookups + 7 runs/process)
- **Swagger**: Must generate OpenAPI docs
- **Deployment**: Azure App Service (UAT: georgeplatinumuatapi.azurewebsites.net)
- **Dependencies**: DB changes (Action 1) must be complete first
- **Estimated time**: 3-5 days

### Action 3: API Team — Build Worker Process
- **Spec**: `PHASE1_V2_SECTION129_DETAIL_PACK.md` (Section 6)
- **Workers**: 2 (Trial Run, Final Run)
- **Queues**: `section129-trial-run`, `section129-final-run`
- **Dependencies**: Controller (Action 2) and Service Bus (Action 4)
- **Estimated time**: 3-5 days (parallel with Action 2)

### Action 4: Azure Infra — Create Service Bus Queues
- **Queues**:
  - `section129-trial-run` (max delivery count: 3, lock duration: 5 min)
  - `section129-final-run` (max delivery count: 3, lock duration: 10 min)
- **Estimated time**: 30 minutes

### Action 5: Frontend (Replit) — Fix Angular API Paths
- **Components**: `section129-notices.component.ts`, `section129-config.component.ts`
- **Change**: Update all API calls from `/api/section129/...` and `/api/billing-cycles` etc. to `/api/platinum/billing-debt/...`
- **Can be done immediately** — no dependency on API team
- **Estimated time**: 1-2 hours

---

## Decisions Required

| # | Decision | Options | Impact | Who Decides |
|---|----------|---------|--------|------------|
| D1 | Lapse days: calendar days or business days? | Business days (excl weekends + public holidays) recommended | Affects worker logic complexity | Business/Legal |
| D2 | Public holidays list: hardcoded or from DB? | Recommend DB table `Const_PublicHolidays` | Affects lapse calculation accuracy | DBA + Business |
| D3 | SMS gateway integration for notifications? | Clickatell / BulkSMS / other | Affects final run worker | IT Management |
| D4 | WhatsApp integration method? | WhatsApp Business API / third-party | New channel, no existing integration | IT Management |
| D5 | File storage location for generated PDFs? | Azure Blob Storage recommended | Affects file download endpoint | Azure Infra |
| D6 | Maximum accounts per trial run? | Recommend 50,000 cap | Affects timeout/memory for worker | Business + API Team |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Platinum UAT API downtime during development | Medium | Medium | Use response caching in Express proxy; test with Postman independently |
| EMS schema changes break existing functionality | Low | High | Script is idempotent with IF NOT EXISTS guards; rollback script included |
| Service Bus message loss | Low | High | Use peek-lock mode, dead-letter queue, max delivery count = 3 |
| Worker timeout on large trial runs (50k+ accounts) | Medium | Medium | Batch processing in chunks of 1000; implement progress tracking |
| Token expiry during long-running worker process | Medium | Medium | Worker should request fresh token before processing |
