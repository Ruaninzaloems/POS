-- ============================================================
-- PHASE 1 (v2) — Section 129: Database Change Script
-- ============================================================
-- Target:    Platinum Inzalo EMS Database (George UAT)
-- Module:    BillingDebt — Section 129 Letter of Demand
-- Author:    POS Development Team
-- Date:      2026-03-11
-- Version:   2.0 (replaces Phase 1 v1)
-- ============================================================
-- IMPORTANT: All statements are idempotent (safe to re-run).
-- Run in a single transaction for atomicity.
-- ============================================================

BEGIN TRANSACTION;
BEGIN TRY

-- ============================================================
-- 1. ALTER TABLE — Billing_Section129LetterOFDemand
-- ============================================================

-- 1a. IncludePensioners flag
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
      AND name = 'IncludePensioners'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        ADD [IncludePensioners] [bit] NULL
            CONSTRAINT [DF_Section129_IncludePensioners] DEFAULT (0);
    PRINT 'Added column [IncludePensioners]';
END
ELSE PRINT 'Column [IncludePensioners] already exists';

-- 1b. WhatsApp distribution flag
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
      AND name = 'WhatsApp'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        ADD [WhatsApp] [bit] NULL
            CONSTRAINT [DF_Section129_WhatsApp] DEFAULT (0);
    PRINT 'Added column [WhatsApp]';
END
ELSE PRINT 'Column [WhatsApp] already exists';

-- 1c. StatusID for unified status tracking
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
      AND name = 'StatusID'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand]
        ADD [StatusID] [int] NULL
            CONSTRAINT [DF_Section129_StatusID] DEFAULT (0);
    PRINT 'Added column [StatusID]';
    -- Backfill existing rows to DRAFT (0)
    UPDATE [dbo].[Billing_Section129LetterOFDemand]
        SET [StatusID] = 0
        WHERE [StatusID] IS NULL;
END
ELSE PRINT 'Column [StatusID] already exists';


-- ============================================================
-- 2. ALTER TABLE — Billing_Section129LetterOFDemandDetails
-- ============================================================

-- 2a. Selected flag for reviewer account selection
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemandDetails]')
      AND name = 'Selected'
)
BEGIN
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemandDetails]
        ADD [Selected] [bit] NULL
            CONSTRAINT [DF_Section129Details_Selected] DEFAULT (1);
    PRINT 'Added column [Selected] to Details table';
    -- Backfill existing rows to selected (1)
    UPDATE [dbo].[Billing_Section129LetterOFDemandDetails]
        SET [Selected] = 1
        WHERE [Selected] IS NULL;
END
ELSE PRINT 'Column [Selected] already exists on Details table';


-- ============================================================
-- 3. CREATE TABLE — Billing_Section129RunFiles
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

    ALTER TABLE [dbo].[Billing_Section129RunFiles]
        ADD CONSTRAINT [FK_Section129RunFiles_LetterOFDemand]
            FOREIGN KEY ([LetterOfDemandID])
            REFERENCES [dbo].[Billing_Section129LetterOFDemand]([LetterOfDemand_ID]);

    PRINT 'Created table [Billing_Section129RunFiles] with FK';
END
ELSE PRINT 'Table [Billing_Section129RunFiles] already exists';


-- ============================================================
-- 4. CREATE TABLE — Billing_Section129Config
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129Config]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [dbo].[Billing_Section129Config](
        [Config_ID]             [int] IDENTITY(1,1) NOT NULL,
        [FinancialYear]         [nvarchar](20) NOT NULL,
        [Section129TemplateId]  [int] NULL,
        [SMSTemplateId]         [int] NULL,
        [LapseDays]             [int] NOT NULL
            CONSTRAINT [DF_Section129Config_LapseDays] DEFAULT (14),
        [NoticesPerFile]        [int] NOT NULL
            CONSTRAINT [DF_Section129Config_NoticesPerFile] DEFAULT (500),
        [ActivateRotation]      [bit] NOT NULL
            CONSTRAINT [DF_Section129Config_ActivateRotation] DEFAULT (0),
        [Enabled]               [bit] NOT NULL
            CONSTRAINT [DF_Section129Config_Enabled] DEFAULT (1),
        [DateCaptured]          [datetime] NULL,
        [CapturerID]            [int] NULL,
        [DateModified]          [datetime] NULL,
        [ModifierID]            [int] NULL,

        CONSTRAINT [PK_Billing_Section129Config]
            PRIMARY KEY CLUSTERED ([Config_ID] ASC)
            WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF,
                  IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON,
                  ALLOW_PAGE_LOCKS = ON, FILLFACTOR = 93,
                  OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
            ON [PRIMARY]
    ) ON [PRIMARY];

    PRINT 'Created table [Billing_Section129Config]';
END
ELSE PRINT 'Table [Billing_Section129Config] already exists';


-- ============================================================
-- 5. CREATE TABLE — Billing_Section129ConfigCostItems
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129ConfigCostItems]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [dbo].[Billing_Section129ConfigCostItems](
        [CostItem_ID]               [int] IDENTITY(1,1) NOT NULL,
        [ConfigID]                  [int] NOT NULL,
        [AdditionalBillingTypeID]   [int] NOT NULL,
        [Amount]                    [decimal](18,2) NOT NULL
            CONSTRAINT [DF_Section129CostItems_Amount] DEFAULT (0),
        [SortOrder]                 [int] NOT NULL
            CONSTRAINT [DF_Section129CostItems_SortOrder] DEFAULT (0),

        CONSTRAINT [PK_Billing_Section129ConfigCostItems]
            PRIMARY KEY CLUSTERED ([CostItem_ID] ASC)
            WITH (FILLFACTOR = 93) ON [PRIMARY],

        CONSTRAINT [FK_Section129ConfigCostItems_Config]
            FOREIGN KEY ([ConfigID])
            REFERENCES [dbo].[Billing_Section129Config]([Config_ID])
            ON DELETE CASCADE
    ) ON [PRIMARY];

    PRINT 'Created table [Billing_Section129ConfigCostItems]';
END
ELSE PRINT 'Table [Billing_Section129ConfigCostItems] already exists';


-- ============================================================
-- 6. CREATE TABLE — Billing_Section129ConfigAttorneyRotation
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129ConfigAttorneyRotation]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [dbo].[Billing_Section129ConfigAttorneyRotation](
        [Rotation_ID]               [int] IDENTITY(1,1) NOT NULL,
        [ConfigID]                  [int] NOT NULL,
        [AttorneyID]                [int] NOT NULL,
        [PercentDebtorCount]        [decimal](5,2) NOT NULL
            CONSTRAINT [DF_Section129Rotation_PercentDebtor] DEFAULT (0),
        [PercentHandoverAmount]     [decimal](5,2) NOT NULL
            CONSTRAINT [DF_Section129Rotation_PercentHandover] DEFAULT (0),
        [SortOrder]                 [int] NOT NULL
            CONSTRAINT [DF_Section129Rotation_SortOrder] DEFAULT (0),

        CONSTRAINT [PK_Billing_Section129ConfigAttorneyRotation]
            PRIMARY KEY CLUSTERED ([Rotation_ID] ASC)
            WITH (FILLFACTOR = 93) ON [PRIMARY],

        CONSTRAINT [FK_Section129ConfigRotation_Config]
            FOREIGN KEY ([ConfigID])
            REFERENCES [dbo].[Billing_Section129Config]([Config_ID])
            ON DELETE CASCADE,

        CONSTRAINT [FK_Section129ConfigRotation_Attorney]
            FOREIGN KEY ([AttorneyID])
            REFERENCES [dbo].[Const_Attorney]([Attorney_ID])
    ) ON [PRIMARY];

    PRINT 'Created table [Billing_Section129ConfigAttorneyRotation]';
END
ELSE PRINT 'Table [Billing_Section129ConfigAttorneyRotation] already exists';


-- ============================================================
-- 7. INDEXES
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129RunFiles]')
      AND name = 'IX_Section129RunFiles_LetterOfDemandID'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Section129RunFiles_LetterOfDemandID]
        ON [dbo].[Billing_Section129RunFiles] ([LetterOfDemandID] ASC)
        INCLUDE ([FileName], [FileType], [FileSize], [DateCreated])
        WITH (FILLFACTOR = 93) ON [PRIMARY];
    PRINT 'Created index [IX_Section129RunFiles_LetterOfDemandID]';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
      AND name = 'IX_Section129LetterOFDemand_FinancialYear'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Section129LetterOFDemand_FinancialYear]
        ON [dbo].[Billing_Section129LetterOFDemand] ([FinancialYear] ASC)
        INCLUDE ([LetterOfDemand_ID], [RunType], [StatusID],
                 [DateCaptured], [BillingCycleID])
        WITH (FILLFACTOR = 93) ON [PRIMARY];
    PRINT 'Created index [IX_Section129LetterOFDemand_FinancialYear]';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemandDetails]')
      AND name = 'IX_Section129Details_LetterOfDemandID'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Section129Details_LetterOfDemandID]
        ON [dbo].[Billing_Section129LetterOFDemandDetails] ([LetterOfDemandID] ASC)
        INCLUDE ([AccountId], [OutStandingAmount], [TotalBalance],
                 [BalanceDue], [Selected])
        WITH (FILLFACTOR = 93) ON [PRIMARY];
    PRINT 'Created index [IX_Section129Details_LetterOfDemandID]';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129Config]')
      AND name = 'IX_Section129Config_FinancialYear'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Section129Config_FinancialYear]
        ON [dbo].[Billing_Section129Config] ([FinancialYear] ASC, [Enabled] ASC)
        WITH (FILLFACTOR = 93) ON [PRIMARY];
    PRINT 'Created index [IX_Section129Config_FinancialYear]';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129ConfigCostItems]')
      AND name = 'IX_Section129ConfigCostItems_ConfigID'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Section129ConfigCostItems_ConfigID]
        ON [dbo].[Billing_Section129ConfigCostItems] ([ConfigID] ASC)
        INCLUDE ([AdditionalBillingTypeID], [Amount])
        WITH (FILLFACTOR = 93) ON [PRIMARY];
    PRINT 'Created index [IX_Section129ConfigCostItems_ConfigID]';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129ConfigAttorneyRotation]')
      AND name = 'IX_Section129ConfigRotation_ConfigID'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Section129ConfigRotation_ConfigID]
        ON [dbo].[Billing_Section129ConfigAttorneyRotation] ([ConfigID] ASC)
        INCLUDE ([AttorneyID], [PercentDebtorCount], [PercentHandoverAmount])
        WITH (FILLFACTOR = 93) ON [PRIMARY];
    PRINT 'Created index [IX_Section129ConfigRotation_ConfigID]';
END


COMMIT TRANSACTION;
PRINT '';
PRINT '=== Phase 1 v2 DB Changes Applied Successfully ===';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    PRINT 'All changes rolled back.';
END CATCH
GO


-- ============================================================
-- 8. VERIFICATION
-- ============================================================

PRINT '';
PRINT '=== Verification ===';
PRINT '';

SELECT 'New Columns on Billing_Section129LetterOFDemand' AS [Check],
    c.name AS [Column], t.name AS [Type]
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]')
  AND c.name IN ('IncludePensioners', 'WhatsApp', 'StatusID')
ORDER BY c.name;

SELECT 'New Column on Details' AS [Check],
    c.name AS [Column], t.name AS [Type]
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemandDetails]')
  AND c.name = 'Selected';

SELECT 'New Tables' AS [Check], name AS [Table]
FROM sys.objects
WHERE type = 'U' AND name IN (
    'Billing_Section129RunFiles',
    'Billing_Section129Config',
    'Billing_Section129ConfigCostItems',
    'Billing_Section129ConfigAttorneyRotation'
);

SELECT 'Indexes' AS [Check], i.name AS [Index], OBJECT_NAME(i.object_id) AS [Table]
FROM sys.indexes i
WHERE i.name LIKE 'IX_Section129%'
ORDER BY i.name;

PRINT '';
PRINT '=== Phase 1 v2 Verification Complete ===';
GO


-- ============================================================
-- 9. ROLLBACK SCRIPT (Run ONLY to undo changes)
-- ============================================================
-- WARNING: This drops tables and columns. Data will be lost.
-- ============================================================

/*

-- Drop indexes first
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Section129ConfigRotation_ConfigID')
    DROP INDEX [IX_Section129ConfigRotation_ConfigID] ON [dbo].[Billing_Section129ConfigAttorneyRotation];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Section129ConfigCostItems_ConfigID')
    DROP INDEX [IX_Section129ConfigCostItems_ConfigID] ON [dbo].[Billing_Section129ConfigCostItems];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Section129Config_FinancialYear')
    DROP INDEX [IX_Section129Config_FinancialYear] ON [dbo].[Billing_Section129Config];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Section129RunFiles_LetterOfDemandID')
    DROP INDEX [IX_Section129RunFiles_LetterOfDemandID] ON [dbo].[Billing_Section129RunFiles];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Section129LetterOFDemand_FinancialYear')
    DROP INDEX [IX_Section129LetterOFDemand_FinancialYear] ON [dbo].[Billing_Section129LetterOFDemand];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Section129Details_LetterOfDemandID')
    DROP INDEX [IX_Section129Details_LetterOfDemandID] ON [dbo].[Billing_Section129LetterOFDemandDetails];

-- Drop new tables (child tables first)
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129ConfigAttorneyRotation]') AND type = 'U')
    DROP TABLE [dbo].[Billing_Section129ConfigAttorneyRotation];
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129ConfigCostItems]') AND type = 'U')
    DROP TABLE [dbo].[Billing_Section129ConfigCostItems];
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129Config]') AND type = 'U')
    DROP TABLE [dbo].[Billing_Section129Config];

-- Drop FK before table
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Section129RunFiles_LetterOFDemand')
    ALTER TABLE [dbo].[Billing_Section129RunFiles] DROP CONSTRAINT [FK_Section129RunFiles_LetterOFDemand];
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129RunFiles]') AND type = 'U')
    DROP TABLE [dbo].[Billing_Section129RunFiles];

-- Drop new columns
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Section129_StatusID')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand] DROP CONSTRAINT [DF_Section129_StatusID];
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]') AND name = 'StatusID')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand] DROP COLUMN [StatusID];

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Section129_WhatsApp')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand] DROP CONSTRAINT [DF_Section129_WhatsApp];
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]') AND name = 'WhatsApp')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand] DROP COLUMN [WhatsApp];

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Section129_IncludePensioners')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand] DROP CONSTRAINT [DF_Section129_IncludePensioners];
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemand]') AND name = 'IncludePensioners')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemand] DROP COLUMN [IncludePensioners];

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Section129Details_Selected')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemandDetails] DROP CONSTRAINT [DF_Section129Details_Selected];
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Billing_Section129LetterOFDemandDetails]') AND name = 'Selected')
    ALTER TABLE [dbo].[Billing_Section129LetterOFDemandDetails] DROP COLUMN [Selected];

PRINT 'Phase 1 v2 rollback complete';

*/
