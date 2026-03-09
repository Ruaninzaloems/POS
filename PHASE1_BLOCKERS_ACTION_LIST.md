# Phase 1 — Blockers Action List

> 3 open items remain. G-01 has been resolved (frontend side). API team still needs to build the Platinum endpoint.

---

## G-01: Delete Run API Does Not Exist — ✅ FRONTEND RESOLVED

| Field | Detail |
|-------|--------|
| **Blocker ID** | G-01 |
| **Status** | **Frontend resolved** — trash button wired with confirmation dialog, proxy route added (`POST /api/platinum/billing-debt/section129-delete-run`), API function created (`deleteSection129Run`). Non-deletable statuses (Approved, Authorized, Final Running, Final Complete) are enforced client-side. |
| **Remaining** | API Team must build `POST /api/BillingDebt/section129-delete-run` on Platinum. Accepts `{ runId }`. Validates run exists and status is deletable. Hard-deletes from `Billing_Section129LetterOFDemand` and `Billing_Section129LetterOFDemandDetails`. Returns `{ success: true, message: '...' }`. |
| **Decision** | Recommend hard delete — unprocessed trial runs have no audit value. |

---

## G-02: `IncludePensioners` Column Missing from EMS

| Field | Detail |
|-------|--------|
| **Blocker ID** | G-02 |
| **Description** | The frontend sends `includePensioners: boolean` with every trial run submission. The EMS table `Billing_Section129LetterOFDemand` has `IncludeIndigent` but no `IncludePensioners` column. The value is silently lost. |
| **Why It Blocks Phase 1** | The worker cannot honour the pensioner exclusion rule (BR-20) if the flag is not persisted. Runs that should exclude pensioners will include them, producing incorrect notice batches. |
| **DB Change Needed** | `ALTER TABLE [dbo].[Billing_Section129LetterOFDemand] ADD [IncludePensioners] [bit] NULL DEFAULT 0;` |
| **API Impact** | `POST section129-trial-run` must map `includePensioners` → `IncludePensioners` column. Worker must read it during account qualification and exclude pensioner-flagged accounts when `IncludePensioners = 0`. |
| **Frontend Impact** | None — frontend already sends the field correctly. |
| **Owner** | DBA (column) + API Team (mapping + worker logic) |
| **Decision Needed** | Confirm the pensioner flag source: is there an existing `IsPensioner` column on the consumer account table that the worker can check against? If not, how are pensioner accounts identified in EMS? |

---

## G-03: `WhatsApp` Column Missing from EMS

| Field | Detail |
|-------|--------|
| **Blocker ID** | G-03 |
| **Description** | The frontend offers WhatsApp as a distribution channel (`distributionType = 'whatsapp'`). The EMS table has `Email BIT`, `SMS BIT`, `PrintLetter BIT` but no `WhatsApp BIT`. When a user selects WhatsApp or All, the distribution preference cannot be stored. |
| **Why It Blocks Phase 1** | The final run worker reads the distribution flags to decide how to dispatch notices. Without a `WhatsApp` column, WhatsApp-selected runs will not dispatch via WhatsApp — or worse, the API will error on an unknown column. |
| **DB Change Needed** | `ALTER TABLE [dbo].[Billing_Section129LetterOFDemand] ADD [WhatsApp] [bit] NULL DEFAULT 0;` |
| **API Impact** | `POST section129-trial-run` must map `distributionType` to the individual bit flags: `Email`, `SMS`, `WhatsApp`, `PrintLetter`. When `distributionType = 'all'`, all four bits set to 1. When `distributionType = 'whatsapp'`, only `WhatsApp = 1`. Worker must read the `WhatsApp` flag and dispatch accordingly. |
| **Frontend Impact** | None — frontend already sends the field correctly. |
| **Owner** | DBA (column) + API Team (mapping + worker dispatch) |
| **Decision Needed** | Is WhatsApp delivery infrastructure available? If the municipality does not yet have a WhatsApp Business API integration, should this option be hidden on the frontend until ready, or should the column be added now and the worker skip dispatch with a "WhatsApp not configured" log? |

---

## G-06: Run Files Table Does Not Exist

| Field | Detail |
|-------|--------|
| **Blocker ID** | G-06 |
| **Description** | The frontend expects `GET section129-run-files?runId=X` to return an array of `{ fileId, fileName, fileType, fileSize, dateCreated }`. The EMS table only stores three path strings on the run header: `PDFPath`, `ExcelPath`, `ZIPFilePath`. There is no file table to query. |
| **Why It Blocks Phase 1** | The file download modal cannot populate. When a user clicks the Download icon on a run row, the modal opens but the API has no structured data to return. Large runs generate multiple PDF batch files (e.g., 6 files of 500 notices each) — the three path columns cannot represent multiple files. |
| **DB Change Needed** | Create new table: |

```sql
CREATE TABLE [dbo].[Billing_Section129RunFiles](
  [File_ID]           INT IDENTITY(1,1) NOT NULL,
  [LetterOfDemandID]  INT NOT NULL,
  [FileName]          NVARCHAR(500) NOT NULL,
  [FileType]          NVARCHAR(10) NOT NULL,
  [FileSize]          BIGINT NULL,
  [FilePath]          NVARCHAR(500) NOT NULL,
  [DateCreated]       DATETIME NOT NULL DEFAULT GETDATE(),
  CONSTRAINT [PK_Billing_Section129RunFiles] PRIMARY KEY CLUSTERED ([File_ID]),
  CONSTRAINT [FK_Section129RunFiles_LetterOFDemand]
    FOREIGN KEY ([LetterOfDemandID])
    REFERENCES [dbo].[Billing_Section129LetterOFDemand]([LetterOfDemand_ID])
);
```

| Field | Detail |
|-------|--------|
| **API Impact** | `GET section129-run-files`: SELECT from new table filtered by `LetterOfDemandID`. `GET section129-download-file`: Look up `FilePath` by `File_ID`, stream binary. Final run worker: INSERT rows into this table after generating each file. |
| **Frontend Impact** | None — frontend already expects the correct response shape. |
| **Owner** | DBA (table) + API Team (read endpoints + worker writes) |
| **Decision Needed** | Option A: Create the new `Billing_Section129RunFiles` table (recommended — supports multiple files per run). Option B: API constructs a synthetic file array from the three path columns on the header (quick workaround but breaks for multi-batch runs). Which approach? |
