-- ============================================================
-- PHASE 1 — Section 129 Notices: Database Change Script
-- ============================================================
-- Target:    Platinum Inzalo EMS database
-- Module:    BillingDebt — Section 129 Letter of Demand
-- Author:    POS Development Team
-- Date:      2026-03-09
-- Depends:   Existing table [dbo].[Billing_Section129LetterOFDemand]
-- ============================================================


-- ============================================================
-- 1. ALTER TABLE — Add missing columns
-- ============================================================

-- 1a. IncludePensioners flag
-- Reason: Frontend sends includePensioners boolean with every
--         trial run submission. Worker needs this flag to
--         exclude pensioner-flagged accounts when set to 0.
--         Matches existing IncludeIndigent column pattern.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
      AND name = 'IncludePensioners'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        ADD [IncludePensioners] [bit] NULL
            CONSTRAINT [DF_Section129_IncludePensioners] DEFAULT (0);

    PRINT 'Added column [IncludePensioners] to [Billing_Section129LetterOFDemand]';
END
ELSE
    PRINT 'Column [IncludePensioners] already exists — skipped';
GO


-- 1b. WhatsApp distribution flag
-- Reason: Frontend offers WhatsApp as a distribution channel.
--         Existing table has Email, SMS, PrintLetter bit flags
--         but no WhatsApp. Without this column, WhatsApp-selected
--         runs cannot persist the distribution preference.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
      AND name = 'WhatsApp'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        ADD [WhatsApp] [bit] NULL
            CONSTRAINT [DF_Section129_WhatsApp] DEFAULT (0);

    PRINT 'Added column [WhatsApp] to [Billing_Section129LetterOFDemand]';
END
ELSE
    PRINT 'Column [WhatsApp] already exists — skipped';
GO


-- ============================================================
-- 2. CREATE TABLE — Run file tracking
-- ============================================================

-- Reason: Existing table stores file paths as three string
--         columns (PDFPath, ExcelPath, ZIPFilePath) on the
--         run header. This does not support multiple file
--         batches (e.g. 3000 accounts split into 6 PDF files
--         of 500 each). The run-files API endpoint needs to
--         return a structured array of file metadata.
--
-- Written by: Section129FinalRunWorker (INSERT after generation)
-- Read by:    GET section129-run-files (SELECT by LetterOfDemandID)
--             GET section129-download-file (SELECT by File_ID)

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
        [FileType]          [nvarchar](10) NOT NULL,
        [FileSize]          [bigint] NULL,
        [FilePath]          [nvarchar](500) NOT NULL,
        [DateCreated]       [datetime] NOT NULL
            CONSTRAINT [DF_Section129RunFiles_DateCreated] DEFAULT (GETDATE()),

        CONSTRAINT [PK_Billing_Section129RunFiles]
            PRIMARY KEY CLUSTERED ([File_ID] ASC)
            WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF,
                  IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON,
                  ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 93,
                  OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
            ON [PRIMARY]
    ) ON [PRIMARY];

    PRINT 'Created table [Billing_Section129RunFiles]';
END
ELSE
    PRINT 'Table [Billing_Section129RunFiles] already exists — skipped';
GO


-- ============================================================
-- 3. FOREIGN KEY — Link files to run header
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_Section129RunFiles_LetterOFDemand'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129RunFiles]
        ADD CONSTRAINT [FK_Section129RunFiles_LetterOFDemand]
            FOREIGN KEY ([LetterOfDemandID])
            REFERENCES [dbo].[Billing_Section129LetterOFDemand]([LetterOfDemand_ID]);

    PRINT 'Added FK [FK_Section129RunFiles_LetterOFDemand]';
END
ELSE
    PRINT 'FK [FK_Section129RunFiles_LetterOFDemand] already exists — skipped';
GO


-- ============================================================
-- 4. INDEXES — Performance
-- ============================================================

-- 4a. Index on RunFiles.LetterOfDemandID for file lookups by run
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129RunFiles]')
      AND name = 'IX_Section129RunFiles_LetterOfDemandID'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Section129RunFiles_LetterOfDemandID]
        ON [dbo].[Billing_Section129RunFiles] ([LetterOfDemandID] ASC)
        INCLUDE ([FileName], [FileType], [FileSize], [DateCreated])
        WITH (FILLFACTOR = 93)
        ON [PRIMARY];

    PRINT 'Created index [IX_Section129RunFiles_LetterOfDemandID]';
END
ELSE
    PRINT 'Index [IX_Section129RunFiles_LetterOfDemandID] already exists — skipped';
GO

-- 4b. Index on main table FinancialYear for filtered run queries
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
      AND name = 'IX_Section129LetterOFDemand_FinancialYear'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Section129LetterOFDemand_FinancialYear]
        ON [dbo].[Billing_Section129LetterOFDemand] ([FinancialYear] ASC)
        INCLUDE ([LetterOfDemand_ID], [RunType], [TrialRunReviewStatusID],
                 [FinalRunReviewStatusID], [DateCaptured], [BillingCycleID])
        WITH (FILLFACTOR = 93)
        ON [PRIMARY];

    PRINT 'Created index [IX_Section129LetterOFDemand_FinancialYear]';
END
ELSE
    PRINT 'Index [IX_Section129LetterOFDemand_FinancialYear] already exists — skipped';
GO

-- 4c. Index on details table LetterOfDemandID for account lookups
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemandDetails]')
      AND name = 'IX_Section129Details_LetterOfDemandID'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Section129Details_LetterOfDemandID]
        ON [dbo].[Billing_Section129LetterOFDemandDetails] ([LetterOfDemandID] ASC)
        INCLUDE ([AccountId], [OutStandingAmount], [TotalBalance], [BalanceDue])
        WITH (FILLFACTOR = 93)
        ON [PRIMARY];

    PRINT 'Created index [IX_Section129Details_LetterOfDemandID]';
END
ELSE
    PRINT 'Index [IX_Section129Details_LetterOfDemandID] already exists — skipped';
GO


-- ============================================================
-- 5. VERIFICATION — Confirm all changes applied
-- ============================================================

PRINT '';
PRINT '=== Phase 1 DB Change Verification ===';
PRINT '';

-- Check new columns
SELECT
    'Billing_Section129LetterOFDemand' AS [Table],
    c.name AS [Column],
    t.name AS [Type],
    CASE WHEN dc.definition IS NOT NULL THEN dc.definition ELSE '—' END AS [Default]
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
  AND c.name IN ('IncludePensioners', 'WhatsApp')
ORDER BY c.name;

-- Check new table
SELECT
    'Billing_Section129RunFiles' AS [Table],
    c.name AS [Column],
    t.name AS [Type],
    c.max_length AS [MaxLen],
    c.is_nullable AS [Nullable],
    c.is_identity AS [Identity]
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID(N'[dbo].[Billing_Section129RunFiles]')
ORDER BY c.column_id;

-- Check indexes
SELECT
    OBJECT_NAME(i.object_id) AS [Table],
    i.name AS [Index],
    i.type_desc AS [Type]
FROM sys.indexes i
WHERE i.name IN (
    'IX_Section129RunFiles_LetterOfDemandID',
    'IX_Section129LetterOFDemand_FinancialYear',
    'IX_Section129Details_LetterOfDemandID'
)
ORDER BY i.name;

PRINT '';
PRINT '=== Phase 1 DB Changes Complete ===';
GO


-- ============================================================
-- 6. ROLLBACK SCRIPT
-- ============================================================
-- Run ONLY if you need to undo Phase 1 DB changes.
-- WARNING: This will drop the new table and columns.
--          Any data in Billing_Section129RunFiles will be lost.
-- ============================================================

/*

-- 6a. Drop indexes first
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Section129RunFiles_LetterOfDemandID')
    DROP INDEX [IX_Section129RunFiles_LetterOfDemandID] ON [dbo].[Billing_Section129RunFiles];

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Section129LetterOFDemand_FinancialYear')
    DROP INDEX [IX_Section129LetterOFDemand_FinancialYear] ON [dbo].[Billing_Section129LetterOFDemand];

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Section129Details_LetterOfDemandID')
    DROP INDEX [IX_Section129Details_LetterOfDemandID] ON [dbo].[Billing_Section129LetterOFDemandDetails];

-- 6b. Drop foreign key
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Section129RunFiles_LetterOFDemand')
    ALTER TABLE [dbo].[Billing_Section129RunFiles]
        DROP CONSTRAINT [FK_Section129RunFiles_LetterOFDemand];

-- 6c. Drop new table
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129RunFiles]') AND type = 'U')
    DROP TABLE [dbo].[Billing_Section129RunFiles];

-- 6d. Drop new columns (with their default constraints)
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Section129_WhatsApp')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        DROP CONSTRAINT [DF_Section129_WhatsApp];

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]') AND name = 'WhatsApp')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        DROP COLUMN [WhatsApp];

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Section129_IncludePensioners')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        DROP CONSTRAINT [DF_Section129_IncludePensioners];

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]') AND name = 'IncludePensioners')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        DROP COLUMN [IncludePensioners];

PRINT 'Phase 1 rollback complete';

*/
