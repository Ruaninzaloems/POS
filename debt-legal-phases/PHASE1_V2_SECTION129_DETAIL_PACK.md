# Phase 1 (v2) — Section 129: API Developer Handover & Implementation Pack

> **Revision**: v2 — Aligned to Angular 19 frontend
> **Date**: 2026-03-11
> **Scope**: Pages 1-4 (Section 129 Config, Notices, Trial Review, Authorization)
> **Platinum Controller**: `BillingDebt` (new C# controller to be created)
> **EMS Tables**: `Billing_Section129LetterOFDemand`, `Billing_Section129LetterOFDemandDetails`, + 4 new tables
> **Angular Components**: `section129-config`, `section129-notices`, `section129-trial-review`, `section129-authorization`
> **Express Routes**: `server/routes/debt.routes.ts` (already built, proxies to Platinum)

---

## 1. Deliverable Summary

This pack contains everything the API team needs to build the `BillingDebt` controller endpoints for Section 129. It covers:

1. **Database changes** — ALTER existing tables + CREATE 4 new tables
2. **20 API endpoints** — Swagger-ready request/response contracts
3. **Business rules** — validation, status transitions, permissions
4. **Angular integration** — how the frontend calls each endpoint
5. **Service Bus** — worker specification for async operations

---

## 2. Database Changes

### 2.1 ALTER TABLE — Add Columns to Existing Tables

```sql
-- ============================================================
-- 2.1a Billing_Section129LetterOFDemand — Add missing columns
-- ============================================================

-- IncludePensioners flag (matches existing IncludeIndigent pattern)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
      AND name = 'IncludePensioners'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        ADD [IncludePensioners] [bit] NULL
            CONSTRAINT [DF_Section129_IncludePensioners] DEFAULT (0);
END
GO

-- WhatsApp distribution flag (matches Email, SMS, PrintLetter pattern)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
      AND name = 'WhatsApp'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        ADD [WhatsApp] [bit] NULL
            CONSTRAINT [DF_Section129_WhatsApp] DEFAULT (0);
END
GO

-- StatusID for unified status tracking
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
      AND name = 'StatusID'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        ADD [StatusID] [int] NULL
            CONSTRAINT [DF_Section129_StatusID] DEFAULT (0);
END
GO

-- ============================================================
-- 2.1b Billing_Section129LetterOFDemandDetails — Add Selected flag
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemandDetails]')
      AND name = 'Selected'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemandDetails]
        ADD [Selected] [bit] NULL
            CONSTRAINT [DF_Section129Details_Selected] DEFAULT (1);
END
GO
```

### 2.2 CREATE TABLE — New Tables

```sql
-- ============================================================
-- 2.2a Billing_Section129RunFiles — Multi-file tracking per run
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129RunFiles]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [dbo].[Billing_Section129RunFiles](
        [File_ID]           [int] IDENTITY(1,1) NOT NULL,
        [LetterOfDemandID]  [int] NOT NULL,
        [FileName]          [nvarchar](500) NOT NULL,
        [FileType]          [nvarchar](10) NOT NULL,   -- 'PDF', 'XLSX', 'ZIP'
        [FileSize]          [bigint] NULL,
        [FilePath]          [nvarchar](500) NOT NULL,
        [DateCreated]       [datetime] NOT NULL
            CONSTRAINT [DF_Section129RunFiles_DateCreated] DEFAULT (GETDATE()),
        CONSTRAINT [PK_Billing_Section129RunFiles]
            PRIMARY KEY CLUSTERED ([File_ID] ASC)
            WITH (FILLFACTOR = 93) ON [PRIMARY],
        CONSTRAINT [FK_Section129RunFiles_LetterOFDemand]
            FOREIGN KEY ([LetterOfDemandID])
            REFERENCES [dbo].[Billing_Section129LetterOFDemand]([LetterOfDemand_ID])
    ) ON [PRIMARY];
END
GO

-- ============================================================
-- 2.2b Billing_Section129Config — Per-FY configuration
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129Config]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [dbo].[Billing_Section129Config](
        [Config_ID]             [int] IDENTITY(1,1) NOT NULL,
        [FinancialYear]         [nvarchar](20) NOT NULL,       -- '2025/2026'
        [Section129TemplateId]  [int] NULL,                     -- FK to Billing_LetterTemplates
        [SMSTemplateId]         [int] NULL,
        [LapseDays]             [int] NOT NULL DEFAULT (14),
        [NoticesPerFile]        [int] NOT NULL DEFAULT (500),
        [ActivateRotation]      [bit] NOT NULL DEFAULT (0),
        [Enabled]               [bit] NOT NULL DEFAULT (1),
        [DateCaptured]          [datetime] NULL,
        [CapturerID]            [int] NULL,
        [DateModified]          [datetime] NULL,
        [ModifierID]            [int] NULL,
        CONSTRAINT [PK_Billing_Section129Config]
            PRIMARY KEY CLUSTERED ([Config_ID] ASC)
            WITH (FILLFACTOR = 93) ON [PRIMARY]
    ) ON [PRIMARY];
END
GO

-- ============================================================
-- 2.2c Billing_Section129ConfigCostItems — Fee line items
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129ConfigCostItems]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [dbo].[Billing_Section129ConfigCostItems](
        [CostItem_ID]               [int] IDENTITY(1,1) NOT NULL,
        [ConfigID]                  [int] NOT NULL,             -- FK to Billing_Section129Config
        [AdditionalBillingTypeID]   [int] NOT NULL,
        [Amount]                    [decimal](18,2) NOT NULL DEFAULT (0),
        [SortOrder]                 [int] NOT NULL DEFAULT (0),
        CONSTRAINT [PK_Billing_Section129ConfigCostItems]
            PRIMARY KEY CLUSTERED ([CostItem_ID] ASC)
            WITH (FILLFACTOR = 93) ON [PRIMARY],
        CONSTRAINT [FK_Section129ConfigCostItems_Config]
            FOREIGN KEY ([ConfigID])
            REFERENCES [dbo].[Billing_Section129Config]([Config_ID])
    ) ON [PRIMARY];
END
GO

-- ============================================================
-- 2.2d Billing_Section129ConfigAttorneyRotation — Attorney %
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129ConfigAttorneyRotation]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [dbo].[Billing_Section129ConfigAttorneyRotation](
        [Rotation_ID]               [int] IDENTITY(1,1) NOT NULL,
        [ConfigID]                  [int] NOT NULL,             -- FK to Billing_Section129Config
        [AttorneyID]                [int] NOT NULL,             -- FK to Const_Attorney
        [PercentDebtorCount]        [decimal](5,2) NOT NULL DEFAULT (0),
        [PercentHandoverAmount]     [decimal](5,2) NOT NULL DEFAULT (0),
        [SortOrder]                 [int] NOT NULL DEFAULT (0),
        CONSTRAINT [PK_Billing_Section129ConfigAttorneyRotation]
            PRIMARY KEY CLUSTERED ([Rotation_ID] ASC)
            WITH (FILLFACTOR = 93) ON [PRIMARY],
        CONSTRAINT [FK_Section129ConfigRotation_Config]
            FOREIGN KEY ([ConfigID])
            REFERENCES [dbo].[Billing_Section129Config]([Config_ID]),
        CONSTRAINT [FK_Section129ConfigRotation_Attorney]
            FOREIGN KEY ([AttorneyID])
            REFERENCES [dbo].[Const_Attorney]([Attorney_ID])
    ) ON [PRIMARY];
END
GO
```

### 2.3 Indexes

```sql
CREATE NONCLUSTERED INDEX [IX_Section129RunFiles_LetterOfDemandID]
    ON [dbo].[Billing_Section129RunFiles] ([LetterOfDemandID] ASC)
    INCLUDE ([FileName], [FileType], [FileSize], [DateCreated])
    WITH (FILLFACTOR = 93) ON [PRIMARY];

CREATE NONCLUSTERED INDEX [IX_Section129LetterOFDemand_FinancialYear]
    ON [dbo].[Billing_Section129LetterOFDemand] ([FinancialYear] ASC)
    INCLUDE ([LetterOfDemand_ID], [RunType], [StatusID], [DateCaptured], [BillingCycleID])
    WITH (FILLFACTOR = 93) ON [PRIMARY];

CREATE NONCLUSTERED INDEX [IX_Section129Details_LetterOfDemandID]
    ON [dbo].[Billing_Section129LetterOFDemandDetails] ([LetterOfDemandID] ASC)
    INCLUDE ([AccountId], [OutStandingAmount], [TotalBalance], [BalanceDue], [Selected])
    WITH (FILLFACTOR = 93) ON [PRIMARY];

CREATE NONCLUSTERED INDEX [IX_Section129Config_FinancialYear]
    ON [dbo].[Billing_Section129Config] ([FinancialYear] ASC, [Enabled] ASC)
    WITH (FILLFACTOR = 93) ON [PRIMARY];
GO
```

---

## 3. API Endpoint Specifications (Swagger-Ready)

### 3.1 Configuration Endpoints

#### API C1 — GET section129-config

Returns the active (enabled) configuration for a given financial year.

```
GET /api/BillingDebt/section129-config?finYear=2025/2026
Authorization: Bearer {token}
```

**Response 200:**
```json
{
  "configId": 5,
  "finYear": "2025/2026",
  "demandLetterTemplate": "Section 129 Standard Letter",
  "demandLetterTemplateId": 12,
  "smsTemplate": "S129 SMS Notification v2",
  "smsTemplateId": 8,
  "lapseDays": 14,
  "noticesPerFile": 500,
  "activateRotation": false,
  "enabled": true,
  "adminFees": 150.00,
  "costItems": [
    { "nr": 1, "additionalBillingTypeId": "3", "additionalBillingTypeName": "Admin Fee", "amount": 100.00 },
    { "nr": 2, "additionalBillingTypeId": "7", "additionalBillingTypeName": "Postage", "amount": 50.00 }
  ],
  "attorneyRotation": [
    { "nr": 1, "attorneyId": 1, "attorneyName": "Smith & Associates", "percentDebtorCount": 60.00, "percentHandoverAmount": 55.00 },
    { "nr": 2, "attorneyId": 2, "attorneyName": "Van Zyl Attorneys", "percentDebtorCount": 40.00, "percentHandoverAmount": 45.00 }
  ]
}
```

**Response 404:** `{ "message": "No Section 129 configuration found for financial year 2025/2026" }`

**SQL Logic:**
```sql
SELECT TOP 1 c.*, 
  (SELECT SUM(ci.Amount) FROM Billing_Section129ConfigCostItems ci WHERE ci.ConfigID = c.Config_ID) AS AdminFees
FROM Billing_Section129Config c
WHERE c.FinancialYear = @finYear AND c.Enabled = 1
ORDER BY c.Config_ID DESC
```

---

#### API C2 — GET section129-config-list

```
GET /api/BillingDebt/section129-config-list?finYear=2025/2026
Authorization: Bearer {token}
```

**Response 200:**
```json
[
  {
    "id": 5,
    "finYear": "2025/2026",
    "section129Template": "Section 129 Standard Letter",
    "smsTemplate": "S129 SMS v2",
    "totalFees": 150.00,
    "noticesPerFile": 500,
    "lapseDays": 14,
    "activateRotation": false,
    "enabled": true
  }
]
```

---

#### API C3 — POST section129-config-save

Creates or updates a Section 129 configuration entry. Includes nested cost items and attorney rotation.

```
POST /api/BillingDebt/section129-config-save
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "id": null,
  "finYear": "2025/2026",
  "section129TemplateId": 12,
  "smsTemplateId": 8,
  "lapseDays": 14,
  "noticesPerFile": 500,
  "activateRotation": true,
  "enabled": true,
  "costItems": [
    { "additionalBillingTypeId": 3, "amount": 100.00 },
    { "additionalBillingTypeId": 7, "amount": 50.00 }
  ],
  "attorneyRotation": [
    { "attorneyId": 1, "percentDebtorCount": 60.00, "percentHandoverAmount": 55.00 },
    { "attorneyId": 2, "percentDebtorCount": 40.00, "percentHandoverAmount": 45.00 }
  ],
  "capturerID": 209,
  "dateCaptured": "2026-03-11T10:00:00Z",
  "modifierID": 209,
  "dateModified": "2026-03-11T10:00:00Z"
}
```

**Validation Rules:**
- `finYear` required, format `YYYY/YYYY`
- `lapseDays` required, integer >= 1
- `noticesPerFile` required, integer >= 1
- If `activateRotation = true`, attorney rotation `percentDebtorCount` must sum to 100
- If `activateRotation = true`, attorney rotation `percentHandoverAmount` must sum to 100
- **BR-01**: Only one enabled config per financial year. If `id` is null (create) and an enabled config exists for this FY, return 409.

**Response 200:** `{ "success": true, "id": 5, "message": "Configuration saved successfully" }`
**Response 400:** `{ "message": "Validation failed", "errors": [...] }`
**Response 409:** `{ "message": "An enabled configuration already exists for financial year 2025/2026" }`

**SQL Logic:**
```
IF @id IS NULL:
  INSERT INTO Billing_Section129Config (...) VALUES (...)
  SET @configId = SCOPE_IDENTITY()
ELSE:
  UPDATE Billing_Section129Config SET ... WHERE Config_ID = @id

-- Delete and re-insert cost items
DELETE FROM Billing_Section129ConfigCostItems WHERE ConfigID = @configId
INSERT INTO Billing_Section129ConfigCostItems (ConfigID, AdditionalBillingTypeID, Amount, SortOrder) VALUES ...

-- Delete and re-insert attorney rotation
DELETE FROM Billing_Section129ConfigAttorneyRotation WHERE ConfigID = @configId
INSERT INTO Billing_Section129ConfigAttorneyRotation (ConfigID, AttorneyID, PercentDebtorCount, PercentHandoverAmount, SortOrder) VALUES ...
```

---

#### API C4 — GET section129-templates

```
GET /api/BillingDebt/section129-templates
Authorization: Bearer {token}
```

**Response 200:**
```json
[
  { "id": 12, "name": "Section 129 Standard Letter" },
  { "id": 14, "name": "Section 129 Final Demand" }
]
```

**SQL:** `SELECT Template_Id AS id, TemplateName AS name FROM Billing_LetterTemplates WHERE NoticeTypeID = (SELECT NoticeType_Id FROM Billing_LetterTypes WHERE NoticeTypeDescription = 'Section 129')`

---

#### API C5 — GET section129-sms-templates

Same shape as C4 but filtered to SMS templates.

---

#### API C6 — GET additional-billing-types

```json
[
  { "id": "3", "name": "Admin Fee" },
  { "id": "7", "name": "Postage" },
  { "id": "12", "name": "Legal Fee" }
]
```

---

#### API C7 — GET attorney-list

```json
[
  {
    "attorneyId": 1,
    "attorneyName": "Smith & Associates",
    "firmName": "Smith & Associates",
    "contactNumber": "044 874 1234",
    "email": "info@smithlaw.co.za",
    "commission": 10.00,
    "isActive": true
  }
]
```

**SQL:** `SELECT Attorney_ID AS attorneyId, AttorneyDesc AS attorneyName, ... FROM Const_Attorney WHERE Enabled = 1`

---

### 3.2 Lookup Endpoints (L1-L6)

All return `{ id: string|number, name: string }[]`

| Endpoint | SQL Source |
|----------|----------|
| `GET billing-cycles` | `SELECT DISTINCT BillingCycle_ID AS id, BillingCycleDesc AS name FROM Billing_BillingCycles WHERE Active = 1` |
| `GET towns` | `SELECT Town_ID AS id, TownDesc AS name FROM Const_Town WHERE Active = 1` |
| `GET property-categories` | `SELECT PropertyCategory_ID AS id, PropertyCategoryDesc AS name FROM Const_PropertyCategory` |
| `GET account-types` | `SELECT AccountType_ID AS id, AccountTypeDesc AS name FROM Const_AccountType` |
| `GET person-types` | `SELECT TypeOfPerson_ID AS id, TypeOfPersonDesc AS name FROM Const_TypeOfPerson` |
| `GET ageing-ranges` | Static list or `SELECT DISTINCT OutstandingPeriod_ID AS id, OutstandingDaysDescription AS name FROM Const_OutstandingPeriod` |

---

### 3.3 Section 129 Run Endpoints (N1-N10)

#### API N1 — GET section129-runs

```
GET /api/BillingDebt/section129-runs?finYear=2025/2026&finMonth=3
Authorization: Bearer {token}
```

**Response 200:**
```json
[
  {
    "runId": 1042,
    "status": "Trial Review",
    "statusId": 2,
    "distributionType": "Email",
    "actionedBy": "Jeandre Pretorius",
    "dateCreated": "2026-03-09T14:30:00.000Z",
    "authorizedBy": null,
    "billingCycle": "Monthly - March 2026",
    "runParameters": "Town: George, Ageing: 90+ days, Amount > R500",
    "runType": "trial-review",
    "handoverOption": "rotation",
    "totalAccounts": 1247,
    "totalAmount": 2845620.50
  }
]
```

**SQL:**
```sql
SELECT
  l.LetterOfDemand_ID AS runId,
  CASE l.StatusID
    WHEN 0 THEN 'Draft'
    WHEN 1 THEN 'Processing'
    WHEN 2 THEN 'Trial Complete'
    WHEN 3 THEN 'Under Review'
    WHEN 4 THEN 'Approved'
    WHEN 5 THEN 'Declined'
    WHEN 6 THEN 'Generating Notices'
    WHEN 7 THEN 'Complete'
    WHEN 8 THEN 'Lapsing'
    WHEN 9 THEN 'Lapsed'
    ELSE 'Unknown'
  END AS [status],
  l.StatusID AS statusId,
  ...
FROM Billing_Section129LetterOFDemand l
WHERE (@finYear IS NULL OR l.FinancialYear = @finYear)
  AND (@finMonth IS NULL OR l.PeriodId = @finMonth)
ORDER BY l.DateCaptured DESC
```

---

#### API N2 — POST section129-trial-run

Creates a new run header and queues the trial processing.

```
POST /api/BillingDebt/section129-trial-run
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "finYear": "2025/2026",
  "finMonth": 3,
  "runType": "trial-review",
  "billingCycleId": 5,
  "handoverOption": "rotation",
  "distributionType": "email",
  "townId": 1,
  "suburb": null,
  "propertyCategoryId": null,
  "accountTypeId": null,
  "typeOfPersonId": null,
  "serviceGroupCode": null,
  "ageing": "90",
  "amountGreaterThan": 500.00,
  "includeIndigents": false,
  "includePensioners": false,
  "excludeDepositBalances": true,
  "contactPerson": "J. Smith",
  "phone": "044 801 9111",
  "email": "debt@george.gov.za",
  "mustEmailBePrinted": true,
  "capturerID": 209,
  "dateCaptured": "2026-03-11T10:00:00Z",
  "modifierID": 209,
  "dateModified": "2026-03-11T10:00:00Z"
}
```

**Validation:**
- `billingCycleId` required
- `finYear` required
- `finMonth` required, 1-12
- `runType` must be `trial-review` or `trial-run`
- `handoverOption` must be `account`, `bulk`, or `rotation`
- `distributionType` must be `email`, `sms`, `whatsapp`, `print`, or `all`
- Config must exist for `finYear` (check `Billing_Section129Config.Enabled = 1`)

**Business Rules:**
- **BR-02**: Load the active config for this FY. If none exists, return 409.
- **BR-03**: INSERT into `Billing_Section129LetterOFDemand` with `StatusID = 0` (DRAFT)
- **BR-04**: If `runType = trial-review`, set `StatusID = 1` (TRIAL_RUNNING) and queue worker
- **BR-05**: If `runType = trial-run`, process synchronously (smaller dataset expected)

**Response 200:**
```json
{
  "runId": 1043,
  "status": "Processing",
  "statusId": 1,
  "message": "Trial run submitted successfully"
}
```

---

#### API N3 — GET section129-run-accounts

```
GET /api/BillingDebt/section129-run-accounts?runId=1042
Authorization: Bearer {token}
```

**Response 200:**
```json
[
  {
    "detailId": 5001,
    "accountId": 12345,
    "accountNo": "000000012345",
    "address": "15 Main Street, George",
    "indigentStatus": "No",
    "rebateStatus": "No",
    "sgNumber": "C09100000000012300000",
    "outstandingDays": 120,
    "qualifyingAmount": 4520.50,
    "noticeFees": 150.00,
    "totalBalance": 8200.00,
    "currentBalance": 1200.00,
    "balanceDue": 7000.00,
    "selected": true
  }
]
```

---

#### API N4 — POST section129-trial-review-submit

```json
{
  "runId": 1042,
  "selectedAccountIds": [12345, 12346, 12350],
  "deselectedAccountIds": [12347, 12348],
  "isFinalReviewComplete": true,
  "reviewerID": 209,
  "reviewDate": "2026-03-11T10:00:00Z",
  "modifierID": 209,
  "dateModified": "2026-03-11T10:00:00Z"
}
```

**SQL Logic:**
```sql
UPDATE Billing_Section129LetterOFDemandDetails
  SET Selected = 1 WHERE LetterOfDemandID = @runId AND AccountId IN (@selectedAccountIds)

UPDATE Billing_Section129LetterOFDemandDetails
  SET Selected = 0 WHERE LetterOfDemandID = @runId AND AccountId IN (@deselectedAccountIds)

UPDATE Billing_Section129LetterOFDemand
  SET StatusID = CASE WHEN @isFinalReviewComplete = 1 THEN 3 ELSE 2 END,
      TrialRunReviewerID = @reviewerID,
      TrialRunReviewDate = @reviewDate,
      IsFinalReviewComplete = @isFinalReviewComplete,
      ModifierID = @modifierID,
      DateModified = @dateModified
  WHERE LetterOfDemand_ID = @runId
```

---

#### API N5 — POST section129-authorize

```json
{
  "runId": 1042,
  "decision": "Approve",
  "notes": "Reviewed and approved for final processing",
  "reviewerID": 209,
  "reviewDate": "2026-03-11T12:00:00Z",
  "modifierID": 209,
  "dateModified": "2026-03-11T12:00:00Z"
}
```

**Validation:**
- `decision` must be `Approve` or `Decline`
- Run must be in status `UNDER_REVIEW` (3)

**SQL Logic:**
```sql
UPDATE Billing_Section129LetterOFDemand
  SET StatusID = CASE WHEN @decision = 'Approve' THEN 4 ELSE 5 END,
      FinalRunReviewerID = @reviewerID,
      FinalRunReviewDate = @reviewDate,
      FinalRunReviewerNotes = @notes,
      ModifierID = @modifierID,
      DateModified = @dateModified
  WHERE LetterOfDemand_ID = @runId AND StatusID = 3
```

---

#### API N6 — POST section129-final-run

```json
{
  "runId": 1042,
  "capturerID": 209,
  "dateCaptured": "2026-03-11T14:00:00Z",
  "modifierID": 209,
  "dateModified": "2026-03-11T14:00:00Z"
}
```

**Validation:**
- Run must be in status `APPROVED` (4)
- Run must have selected accounts

**Response 200:** `{ "success": true, "message": "Final run queued for processing" }`

**SQL:** UPDATE StatusID to 6 (FINAL_RUNNING), queue to Service Bus

---

#### API N7 — GET section129-run-files

```
GET /api/BillingDebt/section129-run-files?runId=1042
```

**Response 200:**
```json
[
  {
    "fileId": 101,
    "fileName": "Section129_Run1042_Batch1.pdf",
    "fileType": "PDF",
    "fileSize": 2456789,
    "dateCreated": "2026-03-11T14:30:00Z"
  },
  {
    "fileId": 102,
    "fileName": "Section129_Run1042_Accounts.xlsx",
    "fileType": "XLSX",
    "fileSize": 156000,
    "dateCreated": "2026-03-11T14:30:00Z"
  }
]
```

---

#### API N8 — GET section129-download-file

```
GET /api/BillingDebt/section129-download-file?fileId=101
```

Returns binary file stream with `Content-Disposition: attachment; filename="..."` header.

---

#### API N9 — POST section129-delete-run

```json
{ "runId": 1042, "modifierID": 209, "dateModified": "2026-03-11T15:00:00Z" }
```

**Validation:**
- Run must be in status `DRAFT` (0) or `DECLINED` (5) — cannot delete active/approved runs

---

#### API N10 — GET section129-run-status

```
GET /api/BillingDebt/section129-run-status?runId=1042
```

**Response 200:**
```json
{
  "runId": 1042,
  "statusId": 2,
  "status": "Trial Complete",
  "totalAccounts": 1247,
  "processedAccounts": 1247,
  "totalAmount": 2845620.50,
  "lastUpdated": "2026-03-11T14:35:00Z"
}
```

Used by Angular to poll for async run completion (trial run worker / final run worker).

---

## 4. Angular Frontend Integration

### 4.1 Component → API Mapping

| Angular Component | File | APIs Called |
|-------------------|------|-----------|
| `Section129ConfigComponent` | `features/debt/section129/section129-config.component.ts` | C1, C2, C3, C4, C5, C6, C7 |
| `Section129NoticesComponent` | `features/debt/section129/section129-notices.component.ts` | C1, N1, N2, N7, N8, N9, N10, L1-L6 |
| `Section129TrialReviewComponent` | `features/debt/section129/section129-trial-review.component.ts` | N3, N4 |
| `Section129AuthorizationComponent` | `features/debt/section129/section129-authorization.component.ts` | N1, N5 |

### 4.2 Express Proxy Route Pattern

All endpoints follow this pattern in `server/routes/debt.routes.ts`:

```typescript
app.get("/api/platinum/billing-debt/section129-config", async (req, res) => {
  try {
    const session = requireAuth(req, res); if (!session) return;
    const data = await platinumGet(session, "/api/BillingDebt/section129-config", req.query as Record<string, string>);
    handlePlatinumResult(res, data);
  } catch (e: any) {
    res.status(502).json({ message: "Platinum API unreachable", detail: e.message });
  }
});
```

**Angular calls**: `/api/platinum/billing-debt/section129-config`
**Express proxies to**: `{PLATINUM_API_URL}/api/BillingDebt/section129-config`

### 4.3 Angular API URL Fix Required

The Section 129 Notices component currently calls wrong paths. Must update to:

| Current Call (404) | Correct Call |
|-------------------|-------------|
| `/api/section129/config` | `/api/platinum/billing-debt/section129-config` |
| `/api/section129/runs` | `/api/platinum/billing-debt/section129-runs` |
| `/api/billing-cycles` | `/api/platinum/billing-debt/billing-cycles` |
| `/api/towns` | `/api/platinum/billing-debt/towns` |
| `/api/property-categories` | `/api/platinum/billing-debt/property-categories` |
| `/api/account-types` | `/api/platinum/billing-debt/account-types` |
| `/api/person-types` | `/api/platinum/billing-debt/person-types` |
| `/api/ageing-ranges` | `/api/platinum/billing-debt/ageing-ranges` |

---

## 5. Business Rules Summary

| Rule | Description | Enforced By |
|------|-------------|-------------|
| BR-01 | Only one enabled Section 129 config per financial year | API C3 (409 if duplicate) |
| BR-02 | Trial run requires an active config for the FY | API N2 (409 if no config) |
| BR-03 | New runs start in DRAFT status (0) | API N2 |
| BR-04 | Trial-review runs queue for async worker processing | API N2 → Service Bus |
| BR-05 | Trial-run processes smaller datasets synchronously | API N2 |
| BR-06 | Only UNDER_REVIEW (3) runs can be authorized | API N5 (400 if wrong status) |
| BR-07 | Only APPROVED (4) runs can trigger final run | API N6 (400 if wrong status) |
| BR-08 | Only DRAFT (0) or DECLINED (5) runs can be deleted | API N9 (400 if wrong status) |
| BR-09 | Lapse days counted in business days (Mon-Fri, excl public holidays) | Worker process |
| BR-10 | Exclude accounts with active clearances from trial run | Worker process |
| BR-11 | Rotation handover distributes accounts by attorney % config | Worker process |
| BR-12 | All writes must include audit fields (capturerID, dateCaptured, modifierID, dateModified) | Express middleware |

---

## 6. Service Bus Worker Specification

### 6.1 Trial Run Worker

**Queue**: `section129-trial-run`
**Trigger**: API N2 publishes message after creating run header
**Message**:
```json
{
  "runId": 1043,
  "finYear": "2025/2026",
  "billingCycleId": 5,
  "filters": {
    "townId": 1,
    "ageing": "90",
    "amountGreaterThan": 500,
    "includeIndigents": false,
    "includePensioners": false,
    "excludeDepositBalances": true
  }
}
```

**Worker Logic:**
1. UPDATE run StatusID to 1 (TRIAL_RUNNING)
2. Query consumer accounts matching filters
3. For each qualifying account:
   - Check outstanding amount > config minimum
   - Check ageing period matches
   - Check not indigent (if excludeIndigents)
   - Check not pensioner (if excludePensioners)
   - Check no active clearance certificate
   - Calculate qualifying amount, notice fees
4. INSERT qualifying accounts into `Billing_Section129LetterOFDemandDetails`
5. UPDATE run StatusID to 2 (TRIAL_COMPLETE), set totalAccounts, totalAmount

### 6.2 Final Run Worker

**Queue**: `section129-final-run`
**Worker Logic:**
1. UPDATE run StatusID to 6 (FINAL_RUNNING)
2. Get all selected accounts (`Selected = 1`)
3. Generate PDF notices (batched by `NoticesPerFile`)
4. Generate Excel summary
5. Generate ZIP of all files
6. INSERT file records into `Billing_Section129RunFiles`
7. Send notifications (Email/SMS/WhatsApp per distribution type)
8. UPDATE run StatusID to 7 (FINAL_COMPLETE)
9. Begin lapse period monitoring (StatusID = 8)

---

## 7. Permissions Matrix

| Permission | Endpoints | Angular Guard |
|-----------|----------|--------------|
| `PROCESS_SECTION129` | N2, N4, N6, N9, C3 | `requireDebtPermission(session, 'PROCESS_SECTION129')` |
| `AUTHORISE_SECTION129` | N5 | `requireDebtPermission(session, 'AUTHORISE_SECTION129')` |
| (read-only) | C1, C2, C4-C7, N1, N3, N7, N8, N10, L1-L6 | `requireAuth` only |

---

## 8. Sign-off Checklist

Before moving to Phase 2, the following must be verified:

- [ ] **DB**: All ALTER TABLE and CREATE TABLE scripts executed successfully
- [ ] **DB**: Indexes created, FK constraints valid
- [ ] **API**: All 20 endpoints return correct response shapes
- [ ] **API**: Swagger documentation published for BillingDebt controller
- [ ] **API**: Audit fields (capturerID, dateCaptured, modifierID, dateModified) persisted on all writes
- [ ] **API**: Status transitions enforced (cannot authorize a DRAFT run, etc.)
- [ ] **API**: Validation errors return 400 with field-level error messages
- [ ] **API**: Permission checks return 403 for unauthorized users
- [ ] **Frontend**: Angular components call correct `/api/platinum/billing-debt/...` paths
- [ ] **Frontend**: All screens show loading, error, and empty states
- [ ] **Frontend**: Date format is `dd/mm/yyyy` everywhere
- [ ] **Service Bus**: Trial run worker processes accounts correctly
- [ ] **Service Bus**: Final run worker generates files and sends notifications
- [ ] **Service Bus**: Run status polling endpoint works for async monitoring
- [ ] **Integration**: End-to-end test: Create config → Submit trial → Review → Authorize → Final run → Download files
