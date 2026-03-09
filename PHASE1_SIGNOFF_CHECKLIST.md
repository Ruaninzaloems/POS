# Phase 1 — Section 129 Notices: Signoff Checklist

> **Rule**: No work begins on Phase 2 (Section 129 Configuration) until every item below is signed off.

| # | Category | Item | Owner | Status | Sign-off | Date |
|---|----------|------|-------|--------|----------|------|
| **FRONTEND** | | | | | | |
| 1 | Frontend | Top bar fields confirmed: Financial Year, Month, Run Type, Handover Option | Frontend Lead | ☐ | | |
| 2 | Frontend | Config card fields confirmed: Demand Letter Template, SMS Template, Admin Fees, Lapse Days, Interest Rate, Minimum Amount (all read-only) | Frontend Lead | ☐ | | |
| 3 | Frontend | Filter fields confirmed: Billing Cycle (required), Town, Suburb, Property Category, Account Type, Type of Person, Service Group Code, Ageing, Amount Greater Than | Frontend Lead | ☐ | | |
| 4 | Frontend | Switches confirmed: Include Indigents, Include Pensioners, Exclude Deposit Balances | Frontend Lead | ☐ | | |
| 5 | Frontend | Contact fields confirmed: Contact Person, Phone, Email | Frontend Lead | ☐ | | |
| 6 | Frontend | Distribution options confirmed: Email, SMS, WhatsApp, Print, All (radio group) + conditional "Must email accounts be printed?" switch | Frontend Lead | ☐ | | |
| 7 | Frontend | Grid columns confirmed: Run ID, Status, Distribution, Actioned By, Date Created, Authorized By, Billing Cycle, Parameters, Actions | Frontend Lead | ☐ | | |
| 8 | Frontend | Row actions confirmed: Review (Eye), Execute Final Run (Play), Download Files, Remove (Trash) | Frontend Lead | ☐ | | |
| 9 | Frontend | File modal confirmed: file list with name, type, size, date, download button per file | Frontend Lead | ☐ | | |
| 10 | Frontend | Action buttons confirmed: Submit, Clear, Cancel | Frontend Lead | ☐ | | |
| **API CONTRACT** | | | | | | |
| 11 | API | GET section129-config — request/response schema agreed | API Lead | ☐ | | |
| 12 | API | GET section129-runs — request/response schema agreed, finYear/finMonth filter support confirmed | API Lead | ☐ | | |
| 13 | API | POST section129-trial-run — request payload agreed, response schema agreed, all field mappings confirmed | API Lead | ☐ | | |
| 14 | API | POST section129-final-run — request payload agreed, validation rules agreed | API Lead | ☐ | | |
| 15 | API | GET section129-run-files — response schema agreed (file array vs path fields decision made) | API Lead | ☐ | | |
| 16 | API | GET section129-download-file — binary streaming confirmed, content headers agreed | API Lead | ☐ | | |
| 17 | API | DELETE section129-delete-run — endpoint agreed, validation rules agreed (blocker G-01) | API Lead | ☐ | | |
| 18 | API | Lookup APIs (billing-cycles, towns, property-categories, account-types, person-types, ageing-ranges) — response shape `{id, name}[]` confirmed | API Lead | ☐ | | |
| 19 | API | Error response format agreed: `{ message, errors?, code? }` | API Lead | ☐ | | |
| 20 | API | Permission checks confirmed: PROCESS_SECTION129 for writes, token-only for reads | API Lead | ☐ | | |
| **DB CHANGES** | | | | | | |
| 21 | DB | ALTER TABLE: `IncludePensioners BIT` column approved (blocker G-02) | DBA | ☐ | | |
| 22 | DB | ALTER TABLE: `WhatsApp BIT` column approved (blocker G-03) | DBA | ☐ | | |
| 23 | DB | CREATE TABLE: `Billing_Section129RunFiles` approved (blocker G-06) | DBA | ☐ | | |
| 24 | DB | Foreign key `FK_Section129RunFiles_LetterOFDemand` approved | DBA | ☐ | | |
| 25 | DB | Indexes approved (3 new indexes on RunFiles, LetterOFDemand, Details) | DBA | ☐ | | |
| 26 | DB | Rollback script reviewed | DBA | ☐ | | |
| 27 | DB | Script executed on DEV environment | DBA | ☐ | | |
| **SWAGGER** | | | | | | |
| 28 | Swagger | Section129Config response schema registered | API Lead | ☐ | | |
| 29 | Swagger | Section129Run response schema registered | API Lead | ☐ | | |
| 30 | Swagger | TrialRun request schema registered | API Lead | ☐ | | |
| 31 | Swagger | FinalRun request schema registered | API Lead | ☐ | | |
| 32 | Swagger | Section129RunFile response schema registered | API Lead | ☐ | | |
| 33 | Swagger | DeleteRun request/response schema registered | API Lead | ☐ | | |
| 34 | Swagger | Lookup response schema registered | API Lead | ☐ | | |
| 35 | Swagger | Error response schemas registered (400, 401, 403, 404, 409, 502) | API Lead | ☐ | | |
| **SERVICE BUS** | | | | | | |
| 36 | Service Bus | Queue `section129-trial-run` created in Azure | Infrastructure | ☐ | | |
| 37 | Service Bus | Queue `section129-final-run` created in Azure | Infrastructure | ☐ | | |
| 38 | Service Bus | Message payload for `Section129TrialRunProcess` agreed | API Lead | ☐ | | |
| 39 | Service Bus | Message payload for `Section129FinalRunProcess` agreed | API Lead | ☐ | | |
| 40 | Service Bus | Dead-letter queue monitoring configured | Infrastructure | ☐ | | |
| 41 | Service Bus | Retry policy agreed: max 3 attempts, exponential backoff | API Lead | ☐ | | |
| **WORKER LOGIC** | | | | | | |
| 42 | Worker | `Section129TrialRunWorker` qualification steps agreed (12 steps) | API Lead | ☐ | | |
| 43 | Worker | Account exclusion rules confirmed: handover, clearance, RPP, indigent, pensioner, deposit, minimum amount | API Lead | ☐ | | |
| 44 | Worker | `Section129FinalRunWorker` generation steps agreed (13 steps) | API Lead | ☐ | | |
| 45 | Worker | PDF batch size confirmed (noticesPerFile from config) | API Lead | ☐ | | |
| 46 | Worker | Dispatch channels confirmed: Email, SMS, WhatsApp, Print | API Lead | ☐ | | |
| 47 | Worker | Admin fee journal posting logic confirmed | API Lead | ☐ | | |
| 48 | Worker | Success status transitions agreed (NULL→1 for trial, 1→2 for final) | API Lead | ☐ | | |
| 49 | Worker | Failure handling agreed (dead-letter, recommended "Failed" status values) | API Lead | ☐ | | |
| 50 | Worker | Idempotency rules agreed (delete-before-insert for trial, skip-existing for final) | API Lead | ☐ | | |
| **BLOCKERS** | | | | | | |
| 51 | Blocker | G-01: Delete Run API — hard delete or soft delete decision made | Project Lead | ☐ | | |
| 52 | Blocker | G-02: Pensioner flag source table confirmed (how are pensioners identified in EMS?) | Project Lead | ☐ | | |
| 53 | Blocker | G-03: WhatsApp infrastructure availability confirmed (available now, or hide option?) | Project Lead | ☐ | | |
| 54 | Blocker | G-06: Run Files approach confirmed (new table or synthetic array from path fields?) | Project Lead | ☐ | | |

---

**Signoff Summary**

| Category | Items | Signed Off | Remaining |
|----------|-------|-----------|-----------|
| Frontend | 10 | | |
| API Contract | 10 | | |
| DB Changes | 7 | | |
| Swagger | 8 | | |
| Service Bus | 6 | | |
| Worker Logic | 9 | | |
| Blockers | 4 | | |
| **Total** | **54** | | |

**Approved to proceed to Phase 2**: ☐ Yes / ☐ No

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Project Lead | | | |
| API Lead | | | |
| DBA | | | |
| Frontend Lead | | | |
| Infrastructure | | | |
