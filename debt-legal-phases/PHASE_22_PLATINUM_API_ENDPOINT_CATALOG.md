# Phase 22 — Platinum Inzalo EMS API Endpoint Catalog

**Document Version**: 1.0
**Date**: 11 March 2026
**Scope**: Complete reverse-index of every Platinum API path called from the POS system, organized by Platinum controller
**Prerequisite Phases**: Phase 14 (Core Routes), Phase 15 (Extended Routes), Phase 21 (Server Infrastructure)

---

## 1. Overview

This document catalogs every external Platinum Inzalo EMS API endpoint invoked by the Municipal POS system. Unlike Phases 14–15 (organized by Express route file), this document is organized by **Platinum controller** — the target API surface. This serves as a reference for the Platinum API team, integration testing, and dependency tracking.

**Methodology**: Every `platinumGet`, `platinumPost`, `platinumPut`, `platinumDelete` call and direct `fetch()` call across all 13 route files and `platinum-auth.ts` was extracted and deduplicated.

| Metric | Count |
|---|---|
| Unique Platinum API paths (static) | 284 |
| Parameterized paths (template literals) | 28 |
| Loop-generated BillingEnquiry sub-paths | 74 |
| Total effective Platinum API surface | ~358 |
| Platinum controllers referenced | 32 |
| Express route files making calls | 13 |
| Additional callers (platinum-auth.ts) | 1 |

---

## 2. Authentication (No `/api/` Prefix)

These endpoints sit outside the `/api/` namespace on the Platinum server.

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 1 | POST | `auth/createToken` | `platinum-auth.ts` | Primary login — username/password/dbName → JWT token + userData |
| 2 | POST | `auth/createTokenAzure` | `platinum-auth.ts` | Azure AD fallback login — used when `createToken` fails (lockout, Azure-only accounts) |

**Notes**: Token TTL is 7 hours. Lockout backoff is 10 minutes. `createToken` is tried first; `createTokenAzure` is the fallback with `PLATINUM_API_PASSWORD` from env.

---

## 3. User & UserPermission Controllers

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 3 | GET | `/api/User` | `platinum-auth.ts`, `pos.routes.ts` | Full user list (streamed response, max 5MB). Used for user lookup by ID after login, and debug endpoint. |
| 3a | GET | `/api/User/search?name={name}` | `platinum-auth.ts` | Search users by name. Part of 4-endpoint Azure user resolution chain. |
| 3b | GET | `/api/User?$filter=contains(userName,'{name}')` | `platinum-auth.ts` | OData-style user search by userName. Azure resolution fallback. |
| 3c | GET | `/api/User/by-name?userName={name}` | `platinum-auth.ts` | User lookup by userName. Azure resolution fallback. |
| 3d | GET | `/api/User?$filter=contains(firstName,'{name}')` | `platinum-auth.ts` | OData-style user search by firstName. Azure resolution fallback. |
| 3e | GET | `/api/User/{id}` | `pos.routes.ts` | Single user by ID. |
| 3f | PUT | `/api/User/{id}` | `pos.routes.ts` | Update user record. **Only PUT in entire system**. |
| 4 | GET | `/api/UserPermission/ActiveFinYear` | `pos.routes.ts` | Returns the active financial year string (e.g., `"2025/2026"`). Used to auto-fill finYear in cashier setup and cash office queries. |

---

## 4. ReceiptPrepaid Controller (POS Cashier & Prepaid)

15 GET endpoints, 4 POST endpoints.

### 4.1 GET Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 5 | GET | `/api/ReceiptPrepaid/validate-cashier` | `auth.routes.ts`, `pos.routes.ts` | Primary cashier validation — returns `cashier`, `cashOffice`, `receiptRange`, `cashierReconcile`, `reconcileStatusCode`. Core of session detection. |
| 6 | GET | `/api/ReceiptPrepaid/cons-accounts` | `pos.routes.ts` | Consumer account search by various criteria. Returns account list for POS basket. |
| 7 | GET | `/api/ReceiptPrepaid/cons-account-details` | `pos.routes.ts` | Detailed account information for a single consumer account. Used after search selection. No-cache response. |
| 8 | GET | `/api/ReceiptPrepaid/prepaid-account-details` | `pos.routes.ts` | Prepaid meter account details. Returns meter info, token history, balance. |
| 9 | GET | `/api/ReceiptPrepaid/cashier-detailsById` | `auth.routes.ts` (×4), `pos.routes.ts` | Cashier details by ID. Used in ensure-cashier flow and fallback lookups. Called with `cashierId` query param. |
| 10 | GET | `/api/ReceiptPrepaid/active-cashier-details` | `pos.routes.ts` | Active cashier details by query params. Alternative to `cashier-detailsById`. |
| 11 | GET | `/api/ReceiptPrepaid/active-cashOffice-details` | `pos.routes.ts` | Cash office details by `cashierId`. Also used in office probe (IDs 1–20). |
| 12 | GET | `/api/ReceiptPrepaid/cashier-list` | `auth.routes.ts` | Full list of all POS cashiers. Used as last-resort fallback in cashier detection when `validate-cashier` returns null. |
| 13 | GET | `/api/ReceiptPrepaid/cash-offices` | `auth.routes.ts`, `pos.routes.ts` | Cash offices available for a user. Params: `finYear`, `userId`. Merged with day-end office list for vote data enrichment. |
| 14 | GET | `/api/ReceiptPrepaid/cheque-amendList` | `pos.routes.ts` | Cheque amend list for a cashier. |
| 15 | GET | `/api/ReceiptPrepaid/is-billing` | `pos.routes.ts` | Boolean check — is the billing module active? No params. |
| 16 | GET | `/api/ReceiptPrepaid/search-property-rates-payment` | `pos.routes.ts` | Property rates payment search. |
| 17 | GET | `/api/ReceiptPrepaid/ValidateCashierDayEndRecon` | `pos.routes.ts` | Validates whether cashier can proceed with day-end reconciliation. |
| 18 | GET | `/api/ReceiptPrepaid/GetBillingRuns` | `pos.routes.ts` | Returns list of billing runs. No params. |
| 19 | GET | `/api/ReceiptPrepaid/ServiceTypeWisePrepaidList` | `pos.routes.ts` | Prepaid service types available for vending. |

### 4.2 POST Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 20 | POST | `/api/ReceiptPrepaid/submit-cashier-setup` | `pos.routes.ts` | Create/update/close cashier session. Payload: `{id, user_Id, cashFloat, stpPort, plesseyPort, officeId, isVirtual}`. Set `isActive: false` to close. |
| 21 | POST | `/api/ReceiptPrepaid/UtiliPayBreakdownRequest` | `pos.routes.ts` | Prepaid vending — request token breakdown before purchase. |
| 22 | POST | `/api/ReceiptPrepaid/UtiliPayTokenRequest` | `pos.routes.ts` | Prepaid vending — request actual utility token. |
| 23 | POST | `/api/ReceiptPrepaid/SubmitPrepaidPayment` | `pos.routes.ts` | Submit prepaid payment after token generation. |

---

## 5. billing-payment Controller (Consumer Payments)

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 24 | GET | `/api/billing-payment/payment-options` | `pos.routes.ts` | Payment options for a cashier at an office. Used for receipt range validation. Params: `userId`, `cashofficeId`, `cashierId`. |
| 25 | GET | `/api/billing-payment/payment-types` | `clearance.routes.ts` | Available payment types (Cash, Card, Cheque, etc.). |
| 26 | GET | `/api/billing-payment/get-multiple-account-payment` | `billing.routes.ts` | Retrieve saved multi-account payment batch. |
| 27 | GET | `/api/billing-payment/pos-multi-receipt-print` | `receipts.routes.ts` | Print multiple receipts from POS. |
| 28 | POST | `/api/billing-payment/submit-consumer-payment/{userId}` | `billing.routes.ts`, `pos.routes.ts` | Submit single consumer account payment. Dedup-protected (15s window). |
| 29 | POST | `/api/billing-payment/submit-multiple-payment/{userId}` | `billing.routes.ts` | Submit multi-account payment. Dedup-protected. Dynamic timeout: max(60s, accounts×8s). |
| 30 | POST | `/api/billing-payment/save-multiple-account-payment` | `billing.routes.ts` | Save multi-account payment batch (pre-submission). |
| 31 | POST | `/api/billing-payment/search-accounts` | `billing.routes.ts` | Search accounts by criteria. 55s timeout. |
| 32 | POST | `/api/billing-payment/print-receipt` | `billing.routes.ts` | Generate receipt PDF. Payload: `{Ids[], ReceiptNos[], IsReprint}`. Returns PDF binary. Cropped to 58% height for receipt format. |
| 33 | POST | `/api/billing-payment/send-receipt` | `billing.routes.ts` | Send receipt via email/SMS/WhatsApp. Payload: `{receiptNo, deliveryMethod, emailAddress, phoneNumber, userId}`. |

---

## 6. billing-payment-clearance Controller (Clearance)

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 34 | GET | `/api/billing-payment-clearance/get-brances-by-bank` | `clearance.routes.ts` | Bank branches by bank ID. **Note**: Platinum typo `brances` (not `branches`). |
| 35 | GET | `/api/billing-payment-clearance/get-clearanceids` | `clearance.routes.ts` | Available clearance IDs. |
| 36 | GET | `/api/billing-payment-clearance/pos-payment-type` | `pos.routes.ts`, `clearance.routes.ts` | POS payment types for clearance. |
| 37 | POST | `/api/billing-payment-clearance/get-accounts-for-clearance` | `clearance.routes.ts` | Accounts eligible for clearance by criteria. |
| 38 | POST | `/api/billing-payment-clearance/get-clearance-data` | `clearance.routes.ts` | Full clearance data for an account (Section 118(1) & 118(3) breakdowns). |

---

## 7. billing-payment-miscellaneous Controller (Miscellaneous/Direct Income)

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 39 | GET | `/api/billing-payment-miscellaneous/get-groups` | `clearance.routes.ts` | Miscellaneous payment groups (SCOA categories). |
| 40 | GET | `/api/billing-payment-miscellaneous/get-scoa-items` | `clearance.routes.ts` | SCOA line items within a group. First item auto-populates in basket. |
| 41 | GET | `/api/billing-payment-miscellaneous/get-vat-rate` | `clearance.routes.ts` | Current VAT rate. |
| 42 | POST | `/api/billing-payment-miscellaneous/submit` | `clearance.routes.ts` | Submit miscellaneous payment. |

---

## 8. billing-payment-day-end-reconcile Controller (POS Cashier Day-End)

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 43 | GET | `/api/billing-payment-day-end-reconcile/get-cashier-details` | `dayend.routes.ts` | Cashier details for day-end (current session). |
| 44 | GET | `/api/billing-payment-day-end-reconcile/get-cashier-list` | `dayend.routes.ts` | All cashiers (for supervisor view). |
| 45 | GET | `/api/billing-payment-day-end-reconcile/get-cashier-receipt-reconcile-list` | `dayend.routes.ts` | Reconciliation receipt list for a cashier. |
| 46 | POST | `/api/billing-payment-day-end-reconcile/get-cashier-receipt-card-list` | `dayend.routes.ts` | Card receipt list for day-end. |
| 47 | POST | `/api/billing-payment-day-end-reconcile/get-cashier-receipt-cheque-list` | `dayend.routes.ts` | Cheque receipt list for day-end. |
| 48 | POST | `/api/billing-payment-day-end-reconcile/get-cashier-receipt-drop-box-list` | `dayend.routes.ts` | Drop-box receipt list for day-end. |

---

## 9. billing/auth-day-end-reconcile Controller (Supervisor Day-End)

8 GET endpoints, 18 POST endpoints.

### 9.1 GET Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 49 | GET | `/api/billing/auth-day-end-reconcile/active-cashierid-by-userid` | `auth.routes.ts` | Returns the active cashier ID for a user. Returns 0 if no active session. |
| 50 | GET | `/api/billing/auth-day-end-reconcile/cashbook-list` | `dayend.routes.ts` | Cashbook entries for reconciliation. |
| 51 | GET | `/api/billing/auth-day-end-reconcile/cashier-details` | `dayend.routes.ts` | Supervisor-view cashier details. |
| 52 | GET | `/api/billing/auth-day-end-reconcile/cashier-list` | `billing.routes.ts`, `dayend.routes.ts` | Full cashier list for supervisor. Also used for receipt view cashier dropdown. |
| 53 | GET | `/api/billing/auth-day-end-reconcile/cashier-reconcile-by-cashierid` | `auth.routes.ts` | Reconciliation record for a cashier. Secondary check when `validate-cashier` returns null `cashierReconcile`. |
| 54 | GET | `/api/billing/auth-day-end-reconcile/cash-office-list` | `pos.routes.ts`, `dayend.routes.ts` | Cash office list (enriched with vote data). Merged with `ReceiptPrepaid/cash-offices`. |
| 55 | GET | `/api/billing/auth-day-end-reconcile/pending-cancel-requests` | `dayend.routes.ts` | Pending receipt cancellation requests for supervisor. |
| 56 | GET | `/api/billing/auth-day-end-reconcile/pos-cashier` | `platinum-auth.ts` | POS cashier record by `cashierId` query param. Direct fetch (not via platinumGet). |

### 9.2 POST Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 57 | POST | `/api/billing/auth-day-end-reconcile/approve-cancel-receipt` | `dayend.routes.ts` | Supervisor approves receipt cancellation. |
| 58 | POST | `/api/billing/auth-day-end-reconcile/cancel-day-auth-reconcile-receipt` | `dayend.routes.ts` | Cancel a day-end auth reconcile receipt. |
| 59 | POST | `/api/billing/auth-day-end-reconcile/cashier-receipt-card-list` | `dayend.routes.ts` | Card receipts for supervisor reconciliation. |
| 60 | POST | `/api/billing/auth-day-end-reconcile/cashier-receipt-cash-list` | `dayend.routes.ts` | Cash receipts for supervisor reconciliation. |
| 61 | POST | `/api/billing/auth-day-end-reconcile/cashier-receipt-cheque-list` | `dayend.routes.ts` | Cheque receipts for supervisor reconciliation. |
| 62 | POST | `/api/billing/auth-day-end-reconcile/cashier-receipt-drop-box-list` | `dayend.routes.ts` | Drop-box receipts for supervisor reconciliation. |
| 63 | POST | `/api/billing/auth-day-end-reconcile/cashier-receipt-offline-data-list` | `dayend.routes.ts` | Offline payment data for reconciliation. |
| 64 | POST | `/api/billing/auth-day-end-reconcile/cashier-receipt-postal-order-list` | `dayend.routes.ts` | Postal order receipts for reconciliation. |
| 65 | POST | `/api/billing/auth-day-end-reconcile/decline-cancel-receipt` | `dayend.routes.ts` | Supervisor declines cancellation request. |
| 66 | POST | `/api/billing/auth-day-end-reconcile/finish-day-end-reconcile` | `dayend.routes.ts` | Complete/finalize day-end reconciliation. |
| 67 | POST | `/api/billing/auth-day-end-reconcile/print-cash-report` | `dayend.routes.ts` | Generate cash report PDF. Returns binary PDF. |
| 68 | POST | `/api/billing/auth-day-end-reconcile/print-deposit-slip` | `dayend.routes.ts` | Generate deposit slip PDF. Returns binary PDF. |
| 69 | POST | `/api/billing/auth-day-end-reconcile/print-receipt` | `dayend.routes.ts` | Print receipt from supervisor view. Returns binary PDF. |
| 70 | POST | `/api/billing/auth-day-end-reconcile/request-cancel-receipt` | `dayend.routes.ts` | Cashier requests receipt cancellation (pending supervisor approval). |
| 71 | POST | `/api/billing/auth-day-end-reconcile/return-day-end-reconcile` | `dayend.routes.ts` | Supervisor returns day-end for re-submission. |
| 72 | POST | `/api/billing/auth-day-end-reconcile/submit-day-auth-reconcile` | `dayend.routes.ts` | Cashier submits day-end reconciliation. |
| 73 | POST | `/api/billing/auth-day-end-reconcile/system-vs-cashier-data-list` | `dayend.routes.ts` | Compare system totals vs cashier-entered denominations. |
| 74 | POST | `/api/billing/auth-day-end-reconcile/validate-cashbook` | `dayend.routes.ts` | Validate cashbook before day-end finalization. |

---

## 10. billing/auth-day-end-reconcile-per-office Controller (Per-Office Day-End)

4 GET endpoints, 10 POST endpoints.

### 10.1 GET Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 75 | GET | `/api/billing/auth-day-end-reconcile-per-office/cashier-reconcile-status` | `dayend.routes.ts` | Reconciliation status per office. |
| 76 | GET | `/api/billing/auth-day-end-reconcile-per-office/cashier-summary-by-office` | `dayend.routes.ts` | Cashier summaries grouped by office. |
| 77 | GET | `/api/billing/auth-day-end-reconcile-per-office/cash-office-list` | `dayend.routes.ts` | Per-office cash office list. |
| 78 | GET | `/api/billing/auth-day-end-reconcile-per-office/cash-office-selection` | `dayend.routes.ts` | Office selection for per-office reconciliation. |

### 10.2 POST Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 79 | POST | `/api/billing/auth-day-end-reconcile-per-office/add-stage` | `dayend.routes.ts` | Add a reconciliation stage. |
| 80 | POST | `/api/billing/auth-day-end-reconcile-per-office/cancel-day-auth-reconcile-receipt` | `dayend.routes.ts` | Cancel receipt per-office. |
| 81 | POST | `/api/billing/auth-day-end-reconcile-per-office/finish-stage` | `dayend.routes.ts` | Complete a reconciliation stage. |
| 82 | POST | `/api/billing/auth-day-end-reconcile-per-office/print-cash-report` | `dayend.routes.ts` | Cash report PDF per-office. |
| 83 | POST | `/api/billing/auth-day-end-reconcile-per-office/print-deposit-slip` | `dayend.routes.ts` | Deposit slip PDF per-office. |
| 84 | POST | `/api/billing/auth-day-end-reconcile-per-office/print-receipt` | `dayend.routes.ts` | Receipt PDF per-office. |
| 85 | POST | `/api/billing/auth-day-end-reconcile-per-office/process-staging-payments` | `dayend.routes.ts` | Process staged payments. Query string appended dynamically. |
| 86 | POST | `/api/billing/auth-day-end-reconcile-per-office/return-day-end-reconcile` | `dayend.routes.ts` | Return day-end for re-submission per-office. |
| 87 | POST | `/api/billing/auth-day-end-reconcile-per-office/submit-reconcile-per-office` | `dayend.routes.ts` | Submit per-office reconciliation. |
| 88 | POST | `/api/billing/auth-day-end-reconcile-per-office/verify-cashier-reconcile` | `dayend.routes.ts` | Verify cashier reconciliation per-office. |

---

## 11. BillingEnquiry Controller (Enquiries — 90+ Sub-Endpoints)

The largest Platinum controller surface. Includes 14 explicitly-called paths plus 74 loop-generated paths from `supervisor.routes.ts`.

### 11.1 Explicitly Called Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 89 | GET | `/api/BillingEnquiry/Autocomplete` | `enquiries.routes.ts`, `supervisor.routes.ts` | Account autocomplete search. |
| 90 | GET | `/api/BillingEnquiry/ConsUnitByAccountId` | `enquiries.routes.ts` | Consumer unit by account. |
| 91 | GET | `/api/BillingEnquiry/DepositAmount` | `enquiries.routes.ts` | Deposit amount for account. |
| 92 | GET | `/api/BillingEnquiry/DepositsByAccountId` | `enquiries.routes.ts` | Deposit history by account. |
| 93 | GET | `/api/BillingEnquiry/GetAAAA_ConfigSetting` | `enquiries.routes.ts` | Application config settings. |
| 94 | GET | `/api/BillingEnquiry/GetAppSetting` | `enquiries.routes.ts` | Application settings. |
| 95 | GET | `/api/BillingEnquiry/getRebuildAccountSSCheck` | `enquiries.routes.ts` | Rebuild account service check. |
| 96 | GET | `/api/BillingEnquiry/getReceiptTransactionDetail` | `enquiries.routes.ts`, `supervisor.routes.ts` | Receipt transaction details. |
| 97 | GET | `/api/BillingEnquiry/HandoverByAccountId` | `enquiries.routes.ts` | Handover status by account. |
| 98 | GET | `/api/BillingEnquiry/NameInfoByAccountId` | `enquiries.routes.ts` | Account holder name info. |
| 99 | GET | `/api/BillingEnquiry/PaymentAmountByAccountIds` | `enquiries.routes.ts` | Payment amounts for multiple accounts. |
| 100 | GET | `/api/BillingEnquiry/PaymentIncentiveByAccountId` | `enquiries.routes.ts` | Payment incentives for account. |
| 101 | GET | `/api/BillingEnquiry/PropertyDetailsByAccountId` | `enquiries.routes.ts` | Property details linked to account. |
| 102 | GET | `/api/BillingEnquiry/rebuildFullAccount` | `enquiries.routes.ts` | Trigger full account rebuild. |
| 103 | GET | `/api/billing-enquiry-search` | `receipts.routes.ts` | Billing enquiry search (separate controller path). |
| 104 | GET | `/api/BillingEnquiry/ServiceTypeBalanceDetails` | `enquiries.routes.ts` | Service-type balance breakdown. |
| 105 | GET | `/api/BillingEnquiry/TotalBalanceDebtInquiry` | `enquiries.routes.ts` | Total balance and debt inquiry for account. |
| 106 | POST | `/api/BillingEnquiry/AddOccupier` | `supervisor.routes.ts` | Add occupier to property. |
| 107 | DELETE | `/api/BillingEnquiry/AddOccupier` | `supervisor.routes.ts` | Remove occupier from property. |
| 108 | POST | `/api/BillingEnquiry/EmailBillingStatement` | `supervisor.routes.ts` | Email billing statement to account holder. |
| 109 | POST | `/api/BillingEnquiry/EnquiryResults` | `enquiries.routes.ts` | Advanced enquiry search results. |
| 110 | POST | `/api/BillingEnquiry/search` | `supervisor.routes.ts` | Enquiry search (POST variant). |
| 111 | POST | `/api/BillingEnquiry/SmsBillingStatement` | `supervisor.routes.ts` | SMS billing statement to account holder. |
| 112 | POST | `/api/BillingEnquiry/reconcile/{receiptId}` | `supervisor.routes.ts` | Reconcile a specific receipt. |
| 112a | GET | `/api/BillingEnquiry/DownloadCostSchedule` | `supervisor.routes.ts` | Download clearance cost schedule PDF. |
| 112b | GET | `/api/BillingEnquiry/DownloadClearanceCertificate` | `supervisor.routes.ts` | Download clearance certificate PDF. |
| 112c | POST | `/api/BillingEnquiry/EmailBillingNotification` | `enquiries.routes.ts` | Email billing notification to account. |
| 112d | POST | `/api/BillingEnquiry/SmsBillingNotification` | `enquiries.routes.ts` | SMS billing notification to account. |
| 112e | GET | `/api/BillingEnquiry/getNotificationTemplates` | `enquiries.routes.ts` | Notification templates list. |
| 112f | GET | `/api/BillingEnquiry/getMessageTemplates` | `enquiries.routes.ts` | Message templates list. |

### 11.2 Loop-Generated Endpoints (74 from supervisor.routes.ts)

All called via GET `/api/BillingEnquiry/{PlatinumPath}` with `accountId` query param. Each maps a local kebab-case name to a PascalCase Platinum path.

| Local Path | Platinum Path | Purpose |
|---|---|---|
| `basic-account-details` | `BasicAccountDetails` | Core account information |
| `partition-details` | `PartitionDetails` | Partition/stand details |
| `unit-partition-owner` | `UnitPartitionOwner` | Unit partition ownership |
| `property` | `Property` | Property record |
| `cons-unit-search` | `ConsUnitSearch` | Consumer unit search |
| `debit-order-deduction-by-account` | `debitorderdeductionbyaccountid` | Debit order deductions |
| `account-notifications` | `AccountNotifications` | Account notifications |
| `repayment-plan-status` | `RepaymentPlanStatus` | Repayment plan status |
| `allotment-description-by-id` | `AllotmentDescriptionById` | Allotment descriptions |
| `sectional-title-scheme` | `SectionalTitleScheme` | Sectional title schemes |
| `account-info-result` | `AccountInfoResult` | Account info result set |
| `account-service-meter-per-property` | `AccountServiceMeterPerProperty` | Meters per property |
| `account-delivery-address-detail` | `AccountDeliveryAddressDetail` | Delivery address |
| `additional-billing-search-results` | `AdditionalBillingSearchResults` | Additional billing search |
| `services-search-results` | `ServicesSearchResults` | Services search results |
| `bank-guarantee-history` | `GetBankGuaranteetHistory` | Bank guarantee history (**typo**: `Guaranteet`) |
| `payment-extension-search-results` | `PaymentExtensionSearchResults` | Payment extensions |
| `detailed-transaction-results` | `DetailedTransactionResults` | Detailed transactions |
| `get-billing-period-transactions` | `getBillingPeriodTransactions` | Billing period transactions |
| `all-services` | `AllServices` | All services on account |
| `payment-plan-remaining-capital` | `PaymentPlanRemainingCapitalAmount` | Payment plan remaining capital |
| `payment-amount-by-account-ids` | `PaymentAmountByAccountIds` | Payment amounts (also explicit) |
| `cheque-final-search-list` | `ChequeFinalSearchList` | Final cheque search |
| `cheque-write-back-detail` | `ChequeWriteBackDetail` | Cheque write-back detail |
| `payment-plans-by-account-id` | `PaymentPlansByAccountId` | Payment plans |
| `payment-incentive-journals` | `PaymentIncentiveJournals` | Payment incentive journals |
| `metered-services-on-account` | `MeteredServicesOnAccount` | Metered services |
| `valuation-by-id` | `ValuationById` | Property valuation by ID |
| `valuation-by-unit` | `ValuationByUnit` | Property valuation by unit |
| `valuation-import-by-id` | `ValuationImportById` | Imported valuation |
| `supplementary-valuations` | `SupplementaryValuations` | Supplementary valuations |
| `rates-run-history` | `RatesRunHistory` | Rates run history |
| `account-rates-details` | `GetAccountRatesDetails` | Account rates details |
| `unit-linked-meters` | `UnitLinkedMeters` | Unit-linked meters |
| `transfer-ownership` | `TransferOwnerShip` | Transfer of ownership |
| `clearance-inquiries` | `ClearanceInquiries` | Clearance inquiries |
| `prepaid-meter-services-for-account` | `PrepaidMeterServicesForAccount` | Prepaid meter services |
| `periods` | `Periods` | Billing periods |
| `attp-application-history` | `AttpApplicationHistory` | ATTP application history |
| `debtor-note-lists` | `DebtorNoteLists` | Debtor notes |
| `account-inquiries` | `AccountInquiries` | Account inquiries |
| `add-occupiers` | `AddOccupiers` | List occupiers |
| `autocomplete` | `Autocomplete` | Account autocomplete (also explicit) |
| `meter-reading-history` | `meter-reading-history` | Meter reading history |
| `meter-reading-history-barchart` | `meter-reading-history-barchart` | Meter reading bar chart data |
| `get-status` | `get-status` | Account status |
| `departmental-accounts-by-id` | `get-departmental-accounts-by-id` | Departmental accounts |
| `generated-statements-by-id` | `get-generated-statements-by-id` | Generated statements |
| `billing-template` | `getBillingTemplate` | Billing template |
| `detail-billing-template` | `getDetailBillingTemplate` | Detail billing template |
| `contact-details-history-by-id` | `get-contactdetails-history-by-id` | Contact details history |
| `delivery-address-history-by-id` | `get-delivery-address-history-by-id` | Delivery address history |
| `delivery-account-details-by-id` | `get-delivery-account-details-by-id` | Delivery account details |
| `property-notification` | `getPropertyNotification` | Property notifications |
| `billing-processing-month` | `getBillingProcessingMonth` | Billing processing month |
| `levy-transaction-detail` | `getLevyTransactionDetail` | Levy transaction detail |
| `open-balance-detail` | `getOpenBalanceDetail` | Open balance detail |
| `close-balance-detail` | `getCloseBalanceDetail` | Close balance detail |
| `journal-transaction-details` | `getJournalTransactionDetails` | Journal transaction details |
| `rebate-transaction-detail` | `getRebateTransactionDetail` | Rebate transaction detail |
| `interest-cons-payment-detail` | `getInterestConsPaymentTransactionDetail` | Interest on consumer payments |
| `interest-late-payment-detail` | `getInterestLatePaymentTransactionDetail` | Interest on late payments |
| `prepaid-recharge-details-for-meter` | `getPrepaidRechargeDetailsForMeter` | Prepaid recharge history |
| `section129-account-enquiry` | `GetSection129AccountEnquiry` | Section 129 status for account |
| `get-debit-order-deduction` | `getDebitOrderDeduction` | Debit order deductions |
| `handover-account-enquiry` | `getHandoverAccountEnquiry` | Handover status for account |
| `billed-vs-paid-amounts` | `BilledVsPaidAmounts` | Billed vs paid comparison (**skipped** in loop; has explicit handler) |
| `cons-handover-transaction-detail` | `getConsHandoverTransactionDetail` | Consumer handover transaction detail |
| `meter-info-by-id` | `getMeterInfoById` | Meter info by ID |
| `payments-received` | `PaymentsReceived` | Payments received |
| `lookups` | `lookups` | General lookups |
| `billing-calculation-popup-data` | `getBillingalculationPopupDataDetails` | Billing calculation popup (**typo**: `alculationPopupData`) |
| `check-file-exists` | `CheckFileExists` | Check if statement file exists |
| `search-by-bank-statement-note` | `SearchByBankStatementNote` | Search by bank statement note |
| `get-eft-bank-statement-notes` | `GetEftBankStatementNotes` | EFT bank statement notes |

**Known Platinum Typos in Paths**: `GetBankGuaranteetHistory` (extra `t`), `getBillingalculationPopupDataDetails` (missing `C` in `Calculation`).

---

## 12. billing/account-management Controller

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 113 | GET | `/api/billing/account-management/account-details` | `deposits.routes.ts` | Account details for deposit allocation. |
| 114 | GET | `/api/billing/account-management/account-information` | `deposits.routes.ts` | Account information summary. |
| 115 | GET | `/api/billing/account-management/get-account-grouping` | `deposits.routes.ts` | Account grouping data. |
| 116 | GET | `/api/billing/account-management/get-additional-emails` | `deposits.routes.ts` | Additional email addresses for account. |
| 117 | GET | `/api/billing/account-management/get-contact-details` | `deposits.routes.ts` | Contact details for account. |
| 118 | GET | `/api/billing/account-management/get-payment-group-list` | `deposits.routes.ts` | Payment group list. |
| 119 | GET | `/api/billing/account-management/get-property-details` | `deposits.routes.ts` | Property details for deposit matching. |
| 120 | GET | `/api/billing/account-management/get-sub-account-grouping` | `deposits.routes.ts` | Sub-account grouping. |
| 121 | POST | `/api/billing/account-management/search-accounts` | `deposits.routes.ts` | Account search for deposit allocation. |

---

## 13. billing-direct-deposit-allocation Controller

14 GET endpoints, 9 POST endpoints.

### 13.1 GET Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 122 | GET | `/api/billing-direct-deposit-allocation/check-selected-item-processed` | `deposits.routes.ts` | Check if deposit item is already processed. |
| 123 | GET | `/api/billing-direct-deposit-allocation/get-account-autocomplete` | `deposits.routes.ts` | Account autocomplete for deposits. |
| 124 | GET | `/api/billing-direct-deposit-allocation/get-clearence-autocomplete` | `deposits.routes.ts` | Clearance autocomplete (**typo**: `clearence`). |
| 125 | GET | `/api/billing-direct-deposit-allocation/get-group-payment-details` | `deposits.routes.ts` | Group payment details. |
| 126 | GET | `/api/billing-direct-deposit-allocation/get-misc-payment-group` | `deposits.routes.ts` | Miscellaneous payment groups for deposits. |
| 127 | GET | `/api/billing-direct-deposit-allocation/get-misc-receipt-data` | `deposits.routes.ts` | Miscellaneous receipt data. |
| 128 | GET | `/api/billing-direct-deposit-allocation/get-misc-vote-id-by-group` | `deposits.routes.ts` | Vote ID by miscellaneous group. |
| 129 | GET | `/api/billing-direct-deposit-allocation/get-old-account-autocomplete` | `deposits.routes.ts` | Old account code autocomplete. |
| 130 | GET | `/api/billing-direct-deposit-allocation/get-pos-item-details` | `deposits.routes.ts` | POS item details for deposit. |
| 131 | GET | `/api/billing-direct-deposit-allocation/get-vat-rate` | `deposits.routes.ts` | VAT rate for deposit allocation. |
| 132 | GET | `/api/billing-direct-deposit-allocation/vote-details` | `deposits.routes.ts` | Vote details by ID. |
| 133 | GET | `/api/billing-direct-deposit-allocation/generic-import-status/{jobId}` | `deposits.routes.ts` | CSV import job status. |
| 134 | GET | `/api/billing-direct-deposit-allocation/generic-import-results/{jobId}` | `deposits.routes.ts` | CSV import job results. |
| 135 | GET | `/api/billing-direct-deposit-allocation/generic-import-errors/{jobId}` | `deposits.routes.ts` | CSV import job errors. |

### 13.2 POST Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 136 | POST | `/api/billing-direct-deposit-allocation/get-bank-recon-positem-list` | `deposits.routes.ts` | Bank recon POS items. |
| 137 | POST | `/api/billing-direct-deposit-allocation/get-clearance-details-info` | `deposits.routes.ts` | Clearance details for deposit allocation. |
| 138 | POST | `/api/billing-direct-deposit-allocation/get-consumer-details-data` | `deposits.routes.ts` | Consumer details for deposit. |
| 139 | POST | `/api/billing-direct-deposit-allocation/load-confirm-payment-details` | `deposits.routes.ts` | Confirm payment details before allocation. |
| 140 | POST | `/api/billing-direct-deposit-allocation/load-details-clearance` | `deposits.routes.ts` | Load clearance details. |
| 141 | POST | `/api/billing-direct-deposit-allocation/load-details-consumer-services` | `deposits.routes.ts` | Load consumer services for allocation. |
| 142 | POST | `/api/billing-direct-deposit-allocation/load-details-payment-grouping` | `billing.routes.ts`, `deposits.routes.ts` | Load payment grouping details (institution drill-down). |
| 143 | POST | `/api/billing-direct-deposit-allocation/load-details-payment-grouping-institution-data` | `billing.routes.ts`, `deposits.routes.ts` | Search institutions/groups for allocation. |
| 144 | POST | `/api/billing-direct-deposit-allocation/submit-generic-import` | `deposits.routes.ts` | Submit CSV file for bulk import. |

---

## 14. billing/direct-deposit-bulk-allocation Controller

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 145 | POST | `/api/billing/direct-deposit-bulk-allocation/get-processed-deposits` | `deposits.routes.ts` | List processed deposits with filters. |
| 146 | POST | `/api/billing/direct-deposit-bulk-allocation/get-unprocessed-direct-deposits` | `deposits.routes.ts` | List unprocessed deposits (main grid). |
| 147 | POST | `/api/billing/direct-deposit-bulk-allocation/print-processed-deposits` | `deposits.routes.ts` | Print processed deposits report. |
| 148 | POST | `/api/billing/direct-deposit-bulk-allocation/reconcile-processed-data` | `deposits.routes.ts` | Reconcile processed deposit data. |

---

## 15. billing/pos/third-party-payments Controller

5 GET endpoints, 5 POST endpoints.

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 149 | GET | `/api/billing/pos/third-party-payments/account-search` | `deposits.routes.ts` | Search accounts for third-party payment. |
| 150 | GET | `/api/billing/pos/third-party-payments/cashier-details` | `deposits.routes.ts` | Cashier details for third-party. |
| 151 | GET | `/api/billing/pos/third-party-payments/is-cashier-active` | `deposits.routes.ts` | Check if cashier is active for third-party. |
| 152 | GET | `/api/billing/pos/third-party-payments/types` | `deposits.routes.ts` | Third-party payment types. |
| 153 | GET | `/api/billing/pos/third-party-payments/{importId}/transactions` | `deposits.routes.ts` | Transactions for an import batch. |
| 154 | POST | `/api/billing/pos/third-party-payments/import` | `deposits.routes.ts` | Import third-party payment file. |
| 155 | POST | `/api/billing/pos/third-party-payments/validate-account` | `deposits.routes.ts` | Validate account for third-party payment. |
| 156 | POST | `/api/billing/pos/third-party-payments/{importId}/reconcile` | `deposits.routes.ts` | Reconcile import batch. |
| 157 | POST | `/api/billing/pos/third-party-payments/{importId}/commit` | `deposits.routes.ts` | Commit reconciled import. |
| 158 | POST | `/api/billing/pos/third-party-payments/{importId}/validate-for-reconcile` | `deposits.routes.ts` | Pre-reconcile validation. |

---

## 16. billing/cashbook-transaction-trace Controller

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 159 | GET | `/api/billing/cashbook-transaction-trace/search` | `deposits.routes.ts` | Search cashbook transaction trace by reference. |

---

## 17. Staging Controllers (billing-stage-*)

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 160 | GET | `/api/billing-stage-cashier-receipt-details/reference` | `receipts.routes.ts` | Staged cashier receipt details by reference. |
| 161 | GET | `/api/billing-stage-prepaid-recharge/` | `receipts.routes.ts` | Staged prepaid recharge records. |
| 162 | GET | `/api/billing-stage-prepaid-recovery/` | `receipts.routes.ts` | Staged prepaid recovery records. |
| 163 | GET | `/api/billing-stage-prepaid-recovery/reference` | `receipts.routes.ts` | Staged prepaid recovery by reference. |

---

## 17a. const-institutions Controller

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 163a | GET | `/api/const-institutions` | `receipts.routes.ts` | Institution list (primary source). Tried first in dual-endpoint fallback. |
| 163b | GET | `/api/BillingEnquiry/GetConstInstitutions` | `receipts.routes.ts` | Institution list (fallback source). Tried if `const-institutions` returns empty. |

---

## 18. Consumer Data Controllers (cons-*)

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 164 | GET | `/api/cons-accounts/` | `receipts.routes.ts` | Consumer accounts list. |
| 165 | GET | `/api/cons-accounts/search` | `receipts.routes.ts` | Consumer accounts search. |
| 166 | GET | `/api/cons-names/` | `receipts.routes.ts` | Consumer names list. |
| 167 | GET | `/api/cons-units/` | `receipts.routes.ts` | Consumer units list. |

---

## 19. receipting-account-group Controller

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 168 | GET | `/api/receipting-account-group/get-account-groups` | `receipts.routes.ts` | Account groups for receipting. |
| 169 | GET | `/api/receipting-account-group/get-account-sub-groups` | `receipts.routes.ts` | Account sub-groups. |
| 170 | GET | `/api/receipting-account-group/search` | `receipts.routes.ts` | Search account groups. |
| 171 | GET | `/api/receipting-account-group-payment/search-accounts-by-group` | `receipts.routes.ts` | Search accounts within a group. |

---

## 20. pos-multiple-account-payments Controller

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 172 | POST | `/api/pos-multiple-account-payments/{capturerId}/{accountId}/receipt/{receiptId}` | `receipts.routes.ts` | Generate receipt for multi-account payment. Parameterized path with 3 segments. |

---

## 21. ViewReceipt Controller

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 173 | GET | `/api/ViewReceipt/get-cashiers` | `billing.routes.ts` | Cashier list for receipt view filter. Fallback when `cashier-list` returns empty. |
| 174 | GET | `/api/ViewReceipt/get-receipt-list` | `receipts.routes.ts` | Receipt list with filters. |
| 175 | GET | `/api/ViewReceipt/search-account-numbers` | `receipts.routes.ts` | Search account numbers for receipt filter. |
| 176 | GET | `/api/ViewReceipt/search-recept-numbers` | `receipts.routes.ts` | Search receipt numbers (**typo**: `recept`). |

---

## 22. BillingDashboard Controller (Analytics)

30 GET endpoints, 4 POST endpoints.

### 22.1 GET Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 177 | GET | `/api/BillingDashboard/account-count` | `analytics.routes.ts` | Total account count. |
| 178 | GET | `/api/BillingDashboard/aging-analysis` | `analytics.routes.ts` | Debt aging analysis. |
| 179 | GET | `/api/BillingDashboard/assets-count` | `analytics.routes.ts` | Asset count. |
| 180 | GET | `/api/BillingDashboard/attorney-performance` | `analytics.routes.ts` | Attorney performance metrics. |
| 181 | GET | `/api/BillingDashboard/billing-count` | `analytics.routes.ts` | Billing count. |
| 182 | GET | `/api/BillingDashboard/consumption-count` | `analytics.routes.ts` | Consumption count. |
| 183 | GET | `/api/BillingDashboard/debt-count` | `analytics.routes.ts` | Debt count. |
| 184 | GET | `/api/BillingDashboard/debt-overview` | `analytics.routes.ts` | Debt overview statistics. |
| 185 | GET | `/api/BillingDashboard/geographic-distribution` | `analytics.routes.ts` | Geographic debt distribution. |
| 186 | GET | `/api/BillingDashboard/get-alert-counts` | `supervisor.routes.ts` | Alert counts for dashboard. |
| 187 | GET | `/api/BillingDashboard/get-billing-dashboard-billing-cycles` | `supervisor.routes.ts` | Billing cycles for dashboard. |
| 188 | GET | `/api/BillingDashboard/get-billing-payment-by-type-of-use` | `supervisor.routes.ts` | Payments by type of use. |
| 189 | GET | `/api/BillingDashboard/get-billing-tab-item-asset-count` | `supervisor.routes.ts` | Billing tab asset count. |
| 190 | GET | `/api/BillingDashboard/get-billing-tab-item-details-count` | `supervisor.routes.ts` | Billing tab details count. |
| 191 | GET | `/api/BillingDashboard/get-debt-arrangement-summary-chart` | `supervisor.routes.ts` | Debt arrangement chart data. |
| 192 | GET | `/api/BillingDashboard/get-meterreading-progress-chart` | `supervisor.routes.ts` | Meter reading progress chart. |
| 193 | GET | `/api/BillingDashboard/get-notification-account-item-counts` | `supervisor.routes.ts` | Notification account counts. |
| 194 | GET | `/api/BillingDashboard/get-notification-consumption-item-counts` | `supervisor.routes.ts` | Notification consumption counts. |
| 195 | GET | `/api/BillingDashboard/get-notification-counts` | `supervisor.routes.ts` | Total notification counts. |
| 196 | GET | `/api/BillingDashboard/get-notification-debt-item-counts` | `supervisor.routes.ts` | Notification debt counts. |
| 197 | GET | `/api/BillingDashboard/get-pos-tab-item-details-count` | `supervisor.routes.ts` | POS tab detail counts. |
| 198 | GET | `/api/BillingDashboard/get-property-tab-item-details-count` | `supervisor.routes.ts` | Property tab detail counts. |
| 199 | GET | `/api/BillingDashboard/get-rebate-tab-item-details-count` | `supervisor.routes.ts` | Rebate tab detail counts. |
| 200 | GET | `/api/BillingDashboard/get-subsidy-item-counts` | `supervisor.routes.ts` | Subsidy item counts. |
| 201 | GET | `/api/BillingDashboard/indigentsubsidy-count` | `analytics.routes.ts` | Indigent subsidy count. |
| 202 | GET | `/api/BillingDashboard/journal-count` | `analytics.routes.ts` | Journal count. |
| 203 | GET | `/api/BillingDashboard/legal-pipeline` | `analytics.routes.ts` | Legal pipeline status. |
| 204 | GET | `/api/BillingDashboard/pos-count` | `analytics.routes.ts` | POS transaction count. |
| 205 | GET | `/api/BillingDashboard/predictive-forecasting` | `analytics.routes.ts` | Predictive revenue/debt forecasting. |
| 206 | GET | `/api/BillingDashboard/property-count` | `analytics.routes.ts` | Property count. |
| 207 | GET | `/api/BillingDashboard/rebate-count` | `analytics.routes.ts` | Rebate count. |
| 208 | GET | `/api/BillingDashboard/recovery-stats` | `analytics.routes.ts` | Recovery statistics. |
| 209 | GET | `/api/BillingDashboard/risk-distribution` | `analytics.routes.ts` | Risk score distribution. |

### 22.2 POST Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 210 | POST | `/api/BillingDashboard/get-deposit-table-data` | `supervisor.routes.ts` | Deposit table data with filters. |
| 211 | POST | `/api/BillingDashboard/get-direct-deposits-allocation-table-data` | `supervisor.routes.ts` | Direct deposit allocation table. |
| 212 | POST | `/api/BillingDashboard/get-post-dated-cheque-search-table-data` | `supervisor.routes.ts` | Post-dated cheque search. |
| 213 | POST | `/api/BillingDashboard/get-third-party-payment-pending-table-data` | `supervisor.routes.ts` | Third-party payment pending table. |

---

## 23. BillingDebt Controller (Debt Management)

The second-largest controller. 40+ GET endpoints, 30+ POST endpoints.

### 23.1 GET Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 214 | GET | `/api/BillingDebt/account-types` | `debt.routes.ts` | Account types for debt configuration. |
| 215 | GET | `/api/BillingDebt/additional-billing-types` | `debt.routes.ts` | Additional billing types. |
| 216 | GET | `/api/BillingDebt/ageing-ranges` | `debt.routes.ts` | Aging ranges for debt analysis. |
| 217 | GET | `/api/BillingDebt/attorney-list` | `debt.routes.ts` | List of attorneys for handover. |
| 218 | GET | `/api/BillingDebt/batch-jobs` | `communications.routes.ts` | Batch job list. |
| 219 | GET | `/api/BillingDebt/batch-schedules` | `communications.routes.ts` | Batch schedules. |
| 220 | GET | `/api/BillingDebt/billing-cycles` | `debt.routes.ts` | Billing cycles. |
| 221 | GET | `/api/BillingDebt/communication-log` | `communications.routes.ts` | Communication log entries. |
| 222 | GET | `/api/BillingDebt/communication-scheduled` | `communications.routes.ts` | Scheduled communications. |
| 223 | GET | `/api/BillingDebt/communication-stats` | `communications.routes.ts` | Communication statistics. |
| 224 | GET | `/api/BillingDebt/communication-timelines` | `communications.routes.ts` | Communication timelines list. |
| 225 | GET | `/api/BillingDebt/compliance-log` | `legal.routes.ts` | Legal compliance log. |
| 226 | GET | `/api/BillingDebt/digital-signatures` | `analytics.routes.ts` | Digital signature requests. |
| 227 | GET | `/api/BillingDebt/digital-signatures/audit-log` | `analytics.routes.ts` | Digital signature audit log. |
| 228 | GET | `/api/BillingDebt/digital-signatures/{requestId}` | `analytics.routes.ts` | Single signature request detail. |
| 229 | GET | `/api/BillingDebt/document-templates` | `analytics.routes.ts` | Document template list. |
| 230 | GET | `/api/BillingDebt/document-templates/{templateId}/versions` | `analytics.routes.ts` | Template version history. |
| 231 | GET | `/api/BillingDebt/document-templates/{templateId}/download` | `analytics.routes.ts` | Download template file. |
| 232 | GET | `/api/BillingDebt/evidence-bundle` | `legal.routes.ts` | Single evidence bundle. |
| 233 | GET | `/api/BillingDebt/evidence-bundles` | `legal.routes.ts` | Evidence bundle list. |
| 234 | GET | `/api/BillingDebt/handover-list` | `debt.routes.ts` | Handover account list with filters. |
| 235 | GET | `/api/BillingDebt/handover-report` | `debt.routes.ts` | Handover report data. |
| 236 | GET | `/api/BillingDebt/legal-rules` | `legal.routes.ts` | Legal compliance rules. |
| 237 | GET | `/api/BillingDebt/person-types` | `debt.routes.ts` | Person types for debt. |
| 238 | GET | `/api/BillingDebt/process-active-runs` | `analytics.routes.ts` | Active process runs. |
| 239 | GET | `/api/BillingDebt/process-failed-runs` | `analytics.routes.ts` | Failed process runs. |
| 240 | GET | `/api/BillingDebt/process-handover-queues` | `analytics.routes.ts` | Process handover queues. |
| 241 | GET | `/api/BillingDebt/process-monitoring-overview` | `analytics.routes.ts` | Process monitoring dashboard. |
| 242 | GET | `/api/BillingDebt/process-pending-approvals` | `analytics.routes.ts` | Pending approval queue. |
| 243 | GET | `/api/BillingDebt/process-termination-queues` | `analytics.routes.ts` | Termination queue. |
| 244 | GET | `/api/BillingDebt/process-workflows` | `analytics.routes.ts` | Workflow definitions list. |
| 245 | GET | `/api/BillingDebt/process-workflows/{workflowId}` | `analytics.routes.ts` | Single workflow detail. |
| 246 | GET | `/api/BillingDebt/process-workflows/{workflowId}/stages` | `analytics.routes.ts` | Workflow stages. |
| 247 | GET | `/api/BillingDebt/property-categories` | `debt.routes.ts` | Property categories for debt config. |
| 248 | GET | `/api/BillingDebt/qualification-rules` | `debt.routes.ts` | Qualification rules for handover. |
| 249 | GET | `/api/BillingDebt/risk-scores` | `debt.routes.ts` | Risk scores for accounts. |
| 250 | GET | `/api/BillingDebt/scoring-weights` | `debt.routes.ts` | Risk scoring weight configuration. |
| 251 | GET | `/api/BillingDebt/section129-config` | `debt.routes.ts` | Section 129 configuration. |
| 252 | GET | `/api/BillingDebt/section129-config-list` | `debt.routes.ts` | Section 129 config list. |
| 253 | GET | `/api/BillingDebt/section129-report` | `debt.routes.ts` | Section 129 report data. |
| 254 | GET | `/api/BillingDebt/section129-run-accounts` | `debt.routes.ts` | Accounts in a Section 129 run. |
| 255 | GET | `/api/BillingDebt/section129-run-files` | `debt.routes.ts` | Files generated by a Section 129 run. |
| 256 | GET | `/api/BillingDebt/section129-runs` | `debt.routes.ts` | Section 129 run history. |
| 257 | GET | `/api/BillingDebt/section129-run-status` | `debt.routes.ts` | Section 129 run status. |
| 258 | GET | `/api/BillingDebt/section129-sms-templates` | `debt.routes.ts` | SMS templates for Section 129. |
| 259 | GET | `/api/BillingDebt/section129-templates` | `debt.routes.ts` | Letter templates for Section 129. |
| 260 | GET | `/api/BillingDebt/sms-log-report` | `debt.routes.ts` | SMS delivery log/report. |
| 261 | GET | `/api/BillingDebt/towns` | `debt.routes.ts` | Towns list for debt filters. |

### 23.2 POST Endpoints

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 262 | POST | `/api/BillingDebt/batch-cancel` | `communications.routes.ts` | Cancel a batch job. |
| 263 | POST | `/api/BillingDebt/batch-trigger` | `communications.routes.ts` | Trigger batch processing. |
| 264 | POST | `/api/BillingDebt/communication-dispatch` | `communications.routes.ts` | Dispatch single communication. |
| 265 | POST | `/api/BillingDebt/communication-dispatch-bulk` | `communications.routes.ts` | Dispatch bulk communications. |
| 266 | POST | `/api/BillingDebt/communication-enroll` | `communications.routes.ts` | Enroll account in communication timeline. |
| 267 | POST | `/api/BillingDebt/communication-process-scheduled` | `communications.routes.ts` | Process scheduled communications. |
| 268 | POST | `/api/BillingDebt/communication-timelines` | `communications.routes.ts` | Create communication timeline. |
| 269 | POST | `/api/BillingDebt/communication-timelines-delete` | `communications.routes.ts` | Delete communication timeline. |
| 270 | POST | `/api/BillingDebt/communication-timeline-steps` | `communications.routes.ts` | Create timeline steps. |
| 271 | POST | `/api/BillingDebt/communication-timelines-update` | `communications.routes.ts` | Update communication timeline. |
| 272 | POST | `/api/BillingDebt/digital-signatures` | `analytics.routes.ts` | Create digital signature request. |
| 273 | POST | `/api/BillingDebt/document-templates` | `analytics.routes.ts` | Create document template. |
| 274 | POST | `/api/BillingDebt/document-templates/{templateId}` | `analytics.routes.ts` | Update document template. |
| 275 | POST | `/api/BillingDebt/document-templates/{templateId}/upload` | `analytics.routes.ts` | Upload template file. |
| 276 | POST | `/api/BillingDebt/evidence-bundle` | `legal.routes.ts` | Create evidence bundle. |
| 277 | POST | `/api/BillingDebt/handover-submit` | `debt.routes.ts` | Submit accounts for handover. |
| 278 | POST | `/api/BillingDebt/handover-terminate` | `debt.routes.ts` | Terminate handover. |
| 279 | POST | `/api/BillingDebt/legal-rules` | `legal.routes.ts` | Create legal rule. |
| 280 | POST | `/api/BillingDebt/legal-rules-deactivate` | `legal.routes.ts` | Deactivate legal rule. |
| 281 | POST | `/api/BillingDebt/legal-rules-update` | `legal.routes.ts` | Update legal rule. |
| 282 | POST | `/api/BillingDebt/process-workflows` | `analytics.routes.ts` | Create workflow. |
| 283 | POST | `/api/BillingDebt/process-workflows/{workflowId}` | `analytics.routes.ts` | Update workflow. |
| 284 | POST | `/api/BillingDebt/process-workflows/{workflowId}/delete` | `analytics.routes.ts` | Delete workflow. |
| 285 | POST | `/api/BillingDebt/process-workflows/{workflowId}/stages` | `analytics.routes.ts` | Create workflow stage. |
| 286 | POST | `/api/BillingDebt/process-workflows/{workflowId}/stages/{stageId}` | `analytics.routes.ts` | Update workflow stage. |
| 287 | POST | `/api/BillingDebt/process-workflows/{workflowId}/stages/{stageId}/delete` | `analytics.routes.ts` | Delete workflow stage. |
| 288 | POST | `/api/BillingDebt/process-workflows/{workflowId}/stages/reorder` | `analytics.routes.ts` | Reorder workflow stages. |
| 289 | POST | `/api/BillingDebt/qualification-rules` | `debt.routes.ts` | Create qualification rule. |
| 290 | POST | `/api/BillingDebt/qualification-rules-delete` | `debt.routes.ts` | Delete qualification rule. |
| 291 | POST | `/api/BillingDebt/qualification-rules-run` | `debt.routes.ts` | Run qualification against accounts. |
| 292 | POST | `/api/BillingDebt/qualification-rules-update` | `debt.routes.ts` | Update qualification rule. |
| 293 | POST | `/api/BillingDebt/score-account` | `debt.routes.ts` | Score single account risk. |
| 294 | POST | `/api/BillingDebt/score-bulk` | `debt.routes.ts` | Bulk risk scoring. |
| 295 | POST | `/api/BillingDebt/scoring-weights` | `debt.routes.ts` | Save scoring weight configuration. |
| 296 | POST | `/api/BillingDebt/section129-authorize` | `debt.routes.ts` | Authorize Section 129 run. |
| 297 | POST | `/api/BillingDebt/section129-config-save` | `debt.routes.ts` | Save Section 129 configuration. |
| 298 | POST | `/api/BillingDebt/section129-delete-run` | `debt.routes.ts` | Delete a Section 129 run. |
| 299 | POST | `/api/BillingDebt/section129-final-run` | `debt.routes.ts` | Execute final Section 129 run. |
| 300 | POST | `/api/BillingDebt/section129-trial-review-submit` | `debt.routes.ts` | Submit trial review decision. |
| 301 | POST | `/api/BillingDebt/section129-trial-run` | `debt.routes.ts` | Execute trial Section 129 run. |
| 302 | POST | `/api/BillingDebt/validate-legal-action` | `legal.routes.ts` | Validate legal action compliance. |

---

## 24. BulkProgress Controller

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 303 | GET | `/api/BulkProgress/get-financial-years` | `deposits.routes.ts` | Financial years for bulk progress. |
| 304 | GET | `/api/BulkProgress/get-month-list` | `deposits.routes.ts` | Month list for bulk progress. |
| 305 | GET | `/api/BulkProgress/get-process-list` | `deposits.routes.ts` | Bulk process list. |
| 306 | GET | `/api/BulkProgress/job-account-details/{jobId}` | `deposits.routes.ts` | Job account details. |
| 307 | GET | `/api/BulkProgress/direct-deposit/{jobId}` | `deposits.routes.ts` | Direct deposit job details. |
| 308 | POST | `/api/BulkProgress/get-bulk-allocation-list` | `deposits.routes.ts` | Bulk allocation list with filters. |

---

## 25. DirectDepositErrors Controller

| # | Method | Platinum Path | Called From | Purpose |
|---|---|---|---|---|
| 309 | GET | `/api/DirectDepositErrors/failed-jobs` | `deposits.routes.ts` | Failed deposit job list. |
| 310 | GET | `/api/DirectDepositErrors/job-details/{jobId}` | `deposits.routes.ts` | Error details for a job. |
| 311 | GET | `/api/DirectDepositErrors/account-details/{jobId}` | `deposits.routes.ts` | Account details for a failed job. |
| 312 | POST | `/api/DirectDepositErrors/retry/{jobId}/{userId}` | `deposits.routes.ts` | Retry failed deposit job. |

---

## 26. Summary by Controller

| Controller | GET | POST | PUT | DELETE | Total | Primary Route File(s) |
|---|---|---|---|---|---|---|
| `auth` (no `/api/`) | 0 | 2 | 0 | 0 | 2 | platinum-auth.ts |
| `User` | 6 | 0 | 1 | 0 | 7 | platinum-auth.ts, pos.routes.ts |
| `UserPermission` | 1 | 0 | 0 | 0 | 1 | pos.routes.ts |
| `ReceiptPrepaid` | 15 | 4 | 0 | 0 | 19 | pos.routes.ts, auth.routes.ts |
| `billing-payment` | 4 | 6 | 0 | 0 | 10 | billing.routes.ts, pos.routes.ts |
| `billing-payment-clearance` | 3 | 2 | 0 | 0 | 5 | clearance.routes.ts, pos.routes.ts |
| `billing-payment-miscellaneous` | 3 | 1 | 0 | 0 | 4 | clearance.routes.ts |
| `billing-payment-day-end-reconcile` | 3 | 3 | 0 | 0 | 6 | dayend.routes.ts |
| `billing/auth-day-end-reconcile` | 8 | 18 | 0 | 0 | 26 | dayend.routes.ts, auth.routes.ts |
| `billing/auth-day-end-reconcile-per-office` | 4 | 10 | 0 | 0 | 14 | dayend.routes.ts |
| `BillingEnquiry` | 20+74 | 10 | 0 | 1 | 105 | supervisor.routes.ts, enquiries.routes.ts |
| `billing-enquiry-search` | 1 | 0 | 0 | 0 | 1 | receipts.routes.ts |
| `const-institutions` | 1 | 0 | 0 | 0 | 1 | receipts.routes.ts |
| `billing/account-management` | 8 | 1 | 0 | 0 | 9 | deposits.routes.ts |
| `billing-direct-deposit-allocation` | 14 | 9 | 0 | 0 | 23 | deposits.routes.ts, billing.routes.ts |
| `billing/direct-deposit-bulk-allocation` | 0 | 4 | 0 | 0 | 4 | deposits.routes.ts |
| `billing/pos/third-party-payments` | 5 | 5 | 0 | 0 | 10 | deposits.routes.ts |
| `billing/cashbook-transaction-trace` | 1 | 0 | 0 | 0 | 1 | deposits.routes.ts |
| `billing-stage-*` (3 controllers) | 4 | 0 | 0 | 0 | 4 | receipts.routes.ts |
| `cons-*` (3 controllers) | 4 | 0 | 0 | 0 | 4 | receipts.routes.ts |
| `receipting-account-group(-payment)` | 4 | 0 | 0 | 0 | 4 | receipts.routes.ts |
| `pos-multiple-account-payments` | 0 | 1 | 0 | 0 | 1 | receipts.routes.ts |
| `ViewReceipt` | 4 | 0 | 0 | 0 | 4 | receipts.routes.ts, billing.routes.ts |
| `BillingDashboard` | 30 | 4 | 0 | 0 | 34 | analytics.routes.ts, supervisor.routes.ts |
| `BillingDebt` | 48 | 41 | 0 | 0 | 89 | debt/legal/comms/analytics.routes.ts |
| `BulkProgress` | 5 | 1 | 0 | 0 | 6 | deposits.routes.ts |
| `DirectDepositErrors` | 3 | 1 | 0 | 0 | 4 | deposits.routes.ts |
| **Totals** | **~275** | **~123** | **1** | **1** | **~400** | |

---

## 27. Known Platinum API Typos (Preserved)

The following Platinum paths contain known typos that must be preserved exactly in API calls:

| Path | Typo | Expected |
|---|---|---|
| `/api/billing-payment-clearance/get-brances-by-bank` | `brances` | `branches` |
| `/api/ViewReceipt/search-recept-numbers` | `recept` | `receipt` |
| `/api/billing-direct-deposit-allocation/get-clearence-autocomplete` | `clearence` | `clearance` |
| `/api/BillingEnquiry/GetBankGuaranteetHistory` | `Guaranteet` | `Guarantee` |
| `/api/BillingEnquiry/getBillingalculationPopupDataDetails` | `alculationPopupData` | `CalculationPopupData` |

---

## 28. API Patterns & Conventions

### 28.1 Response Handling
- All responses pass through `handlePlatinumResult(res, data)` middleware which checks for `data._error` and returns appropriate HTTP status.
- Direct `fetch()` calls (PDF endpoints, `auth/createToken`) handle responses manually.
- PDF endpoints return binary `application/pdf` or `application/octet-stream`.

### 28.2 Authentication
- All API calls include `Authorization: Bearer {token}` header.
- Token is refreshed via `refreshSessionToken(session)` before each call.
- Two auth flows: `createToken` (primary, with user password) → `createTokenAzure` (fallback, with env password).

### 28.3 Multi-Site Support
- API base URL is resolved per session via `getPlatinumApiUrl(session)`.
- Database name resolved via `getPlatinumDbName(session)`.
- Two configured sites: George Municipality (primary), Inzalo EMS Site02.

### 28.4 Deduplication
- Consumer payment endpoints use 15-second dedup window.
- Key: plain string concatenation `${userId}|${accountKey}|${totalAmount}|${paymentType}` (not a hash). `accountKey` = `single:{account_ID}` or `multi:{sorted IDs}`.
- Cached response returned for duplicate submissions.

### 28.5 Timeouts
- Default: inherits from fetch defaults.
- `search-accounts`: 55s.
- `submit-multiple-payment`: max(60s, accounts × 8s).
- `send-receipt`: 30s.

---

*End of Phase 22 — Platinum API Endpoint Catalog*
