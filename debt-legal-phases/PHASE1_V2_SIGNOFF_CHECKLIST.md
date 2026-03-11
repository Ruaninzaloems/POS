# Phase 1 (v2) — Section 129: Sign-off Checklist

> **Date**: 2026-03-11
> **Scope**: Pages 1-4 (Section 129 Config, Notices, Trial Review, Authorization)
> **Sign-off required before**: Phase 2 (Reports + Handover) can begin

---

## Database Changes

| # | Item | Owner | Status |
|---|------|-------|--------|
| DB-01 | `IncludePensioners` column added to `Billing_Section129LetterOFDemand` | DBA | ☐ |
| DB-02 | `WhatsApp` column added to `Billing_Section129LetterOFDemand` | DBA | ☐ |
| DB-03 | `StatusID` column added to `Billing_Section129LetterOFDemand` | DBA | ☐ |
| DB-04 | `Selected` column added to `Billing_Section129LetterOFDemandDetails` | DBA | ☐ |
| DB-05 | `Billing_Section129RunFiles` table created with FK | DBA | ☐ |
| DB-06 | `Billing_Section129Config` table created | DBA | ☐ |
| DB-07 | `Billing_Section129ConfigCostItems` table created with FK | DBA | ☐ |
| DB-08 | `Billing_Section129ConfigAttorneyRotation` table created with FKs | DBA | ☐ |
| DB-09 | All 6 indexes created | DBA | ☐ |
| DB-10 | Verification queries return expected results | DBA | ☐ |

**DBA Sign-off**: _________________________ Date: _____________

---

## API Endpoints (Platinum BillingDebt Controller)

### Configuration Endpoints
| # | Endpoint | Method | Tested | Returns Correct Shape |
|---|----------|--------|--------|----------------------|
| API-01 | `/api/BillingDebt/section129-config` | GET | ☐ | ☐ |
| API-02 | `/api/BillingDebt/section129-config-list` | GET | ☐ | ☐ |
| API-03 | `/api/BillingDebt/section129-config-save` | POST | ☐ | ☐ |
| API-04 | `/api/BillingDebt/section129-templates` | GET | ☐ | ☐ |
| API-05 | `/api/BillingDebt/section129-sms-templates` | GET | ☐ | ☐ |
| API-06 | `/api/BillingDebt/additional-billing-types` | GET | ☐ | ☐ |
| API-07 | `/api/BillingDebt/attorney-list` | GET | ☐ | ☐ |

### Lookup Endpoints
| # | Endpoint | Method | Tested | Returns `{id, name}[]` |
|---|----------|--------|--------|------------------------|
| API-08 | `/api/BillingDebt/billing-cycles` | GET | ☐ | ☐ |
| API-09 | `/api/BillingDebt/towns` | GET | ☐ | ☐ |
| API-10 | `/api/BillingDebt/property-categories` | GET | ☐ | ☐ |
| API-11 | `/api/BillingDebt/account-types` | GET | ☐ | ☐ |
| API-12 | `/api/BillingDebt/person-types` | GET | ☐ | ☐ |
| API-13 | `/api/BillingDebt/ageing-ranges` | GET | ☐ | ☐ |

### Run Process Endpoints
| # | Endpoint | Method | Tested | Validates | Status Transition |
|---|----------|--------|--------|-----------|-------------------|
| API-14 | `/api/BillingDebt/section129-runs` | GET | ☐ | ☐ | N/A |
| API-15 | `/api/BillingDebt/section129-trial-run` | POST | ☐ | ☐ | → DRAFT/TRIAL_RUNNING |
| API-16 | `/api/BillingDebt/section129-run-accounts` | GET | ☐ | ☐ | N/A |
| API-17 | `/api/BillingDebt/section129-trial-review-submit` | POST | ☐ | ☐ | → UNDER_REVIEW |
| API-18 | `/api/BillingDebt/section129-authorize` | POST | ☐ | ☐ | → APPROVED/DECLINED |
| API-19 | `/api/BillingDebt/section129-final-run` | POST | ☐ | ☐ | → FINAL_RUNNING |
| API-20 | `/api/BillingDebt/section129-run-status` | GET | ☐ | ☐ | N/A |

### File Endpoints
| # | Endpoint | Method | Tested | Binary Stream |
|---|----------|--------|--------|--------------|
| API-21 | `/api/BillingDebt/section129-run-files` | GET | ☐ | N/A |
| API-22 | `/api/BillingDebt/section129-download-file` | GET | ☐ | ☐ |
| API-23 | `/api/BillingDebt/section129-delete-run` | POST | ☐ | N/A |

### Swagger Documentation
| # | Item | Status |
|---|------|--------|
| SW-01 | Swagger UI accessible at `/swagger` | ☐ |
| SW-02 | All BillingDebt endpoints documented | ☐ |
| SW-03 | Request/response schemas match Phase 1 v2 spec | ☐ |
| SW-04 | Authentication (Bearer token) documented | ☐ |

**API Team Sign-off**: _________________________ Date: _____________

---

## Validation & Business Rules

| # | Rule | Verified |
|---|------|---------|
| BR-01 | Only one enabled config per financial year (409 on duplicate) | ☐ |
| BR-02 | Trial run requires active config for FY (409 if none) | ☐ |
| BR-03 | New runs start in DRAFT status (0) | ☐ |
| BR-06 | Only UNDER_REVIEW runs can be authorized (400 otherwise) | ☐ |
| BR-07 | Only APPROVED runs can trigger final run (400 otherwise) | ☐ |
| BR-08 | Only DRAFT/DECLINED runs can be deleted (400 otherwise) | ☐ |
| BR-12 | All writes include audit fields (capturerID, dateCaptured, modifierID, dateModified) | ☐ |

---

## Service Bus & Workers

| # | Item | Status |
|---|------|--------|
| SB-01 | Queue `section129-trial-run` created | ☐ |
| SB-02 | Queue `section129-final-run` created | ☐ |
| SB-03 | Trial run worker processes accounts correctly | ☐ |
| SB-04 | Final run worker generates PDFs/Excel/ZIP | ☐ |
| SB-05 | Final run worker sends notifications (email/SMS) | ☐ |
| SB-06 | Worker updates StatusID correctly on completion | ☐ |
| SB-07 | Dead letter queue configured for failed messages | ☐ |

**Azure Infra Sign-off**: _________________________ Date: _____________

---

## Frontend (Angular)

| # | Item | Status |
|---|------|--------|
| FE-01 | Section 129 Config page loads config from `/api/platinum/billing-debt/section129-config` | ☐ |
| FE-02 | Section 129 Notices page loads runs from `/api/platinum/billing-debt/section129-runs` | ☐ |
| FE-03 | All filter dropdowns load from `/api/platinum/billing-debt/...` paths | ☐ |
| FE-04 | Trial run submission sends correct request body | ☐ |
| FE-05 | Trial review loads accounts and submits selections | ☐ |
| FE-06 | Authorization page shows pending runs, submits approve/decline | ☐ |
| FE-07 | Loading, error, and empty states display correctly | ☐ |
| FE-08 | Date format is dd/mm/yyyy everywhere | ☐ |
| FE-09 | Theme matches Platinum design system (navy primary, gold accent) | ☐ |

**Frontend Sign-off**: _________________________ Date: _____________

---

## Integration Testing

| # | End-to-End Flow | Status |
|---|----------------|--------|
| E2E-01 | Create new Section 129 config → verify in config list | ☐ |
| E2E-02 | Submit trial run → poll status → see TRIAL_COMPLETE | ☐ |
| E2E-03 | Review trial accounts → select/deselect → submit review | ☐ |
| E2E-04 | Authorize approved run → verify status = APPROVED | ☐ |
| E2E-05 | Decline run → verify status = DECLINED, can delete | ☐ |
| E2E-06 | Submit final run → poll status → see FINAL_COMPLETE | ☐ |
| E2E-07 | List run files → download PDF → verify file content | ☐ |
| E2E-08 | Delete draft run → verify removed from list | ☐ |

---

## Final Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Project Lead | | | |
| API Team Lead | | | |
| DBA | | | |
| Frontend Lead | | | |
| QA Lead | | | |

**Phase 1 v2 is APPROVED to proceed to Phase 2**: ☐ YES  ☐ NO

**Notes**: _______________________________________________
