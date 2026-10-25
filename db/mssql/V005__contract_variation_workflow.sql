/* تغییر مقدار و کار جدید: ستون‌های افزایشی، بدون تغییر سوابق موجود.
   پیش‌نیاز: BOQ_QuantityChange و ExtraWorkItem از اسکیما عمومی نصب باشند.
   هیچ FK فیزیکی بین‌ماژولی اضافه نمی‌شود. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.BOQ_QuantityChange', N'U') IS NULL OR OBJECT_ID(N'dbo.ExtraWorkItem', N'U') IS NULL
BEGIN
    RAISERROR(N'Install the general contract schema before applying V005.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;
IF COL_LENGTH(N'dbo.BOQ_QuantityChange', N'BaseRowVersion') IS NULL
    ALTER TABLE dbo.BOQ_QuantityChange ADD BaseRowVersion INT NULL;
IF COL_LENGTH(N'dbo.BOQ_QuantityChange', N'UnitRateSnapshot') IS NULL
    ALTER TABLE dbo.BOQ_QuantityChange ADD UnitRateSnapshot DECIMAL(18,2) NULL;
IF COL_LENGTH(N'dbo.BOQ_QuantityChange', N'DocumentRef') IS NULL
    ALTER TABLE dbo.BOQ_QuantityChange ADD DocumentRef NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.BOQ_QuantityChange', N'SubmittedBy') IS NULL
    ALTER TABLE dbo.BOQ_QuantityChange ADD SubmittedBy NVARCHAR(60) NULL;
IF COL_LENGTH(N'dbo.BOQ_QuantityChange', N'SubmittedAt') IS NULL
    ALTER TABLE dbo.BOQ_QuantityChange ADD SubmittedAt DATETIME2 NULL;
IF COL_LENGTH(N'dbo.BOQ_QuantityChange', N'DecidedBy') IS NULL
    ALTER TABLE dbo.BOQ_QuantityChange ADD DecidedBy NVARCHAR(60) NULL;
IF COL_LENGTH(N'dbo.BOQ_QuantityChange', N'DecidedAt') IS NULL
    ALTER TABLE dbo.BOQ_QuantityChange ADD DecidedAt DATETIME2 NULL;
IF COL_LENGTH(N'dbo.BOQ_QuantityChange', N'DecisionNote') IS NULL
    ALTER TABLE dbo.BOQ_QuantityChange ADD DecisionNote NVARCHAR(2000) NULL;
IF COL_LENGTH(N'dbo.ExtraWorkItem', N'ReasonFa') IS NULL
    ALTER TABLE dbo.ExtraWorkItem ADD ReasonFa NVARCHAR(1000) NULL;
IF COL_LENGTH(N'dbo.ExtraWorkItem', N'DocumentRef') IS NULL
    ALTER TABLE dbo.ExtraWorkItem ADD DocumentRef NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.ExtraWorkItem', N'SubmittedBy') IS NULL
    ALTER TABLE dbo.ExtraWorkItem ADD SubmittedBy NVARCHAR(60) NULL;
IF COL_LENGTH(N'dbo.ExtraWorkItem', N'SubmittedAt') IS NULL
    ALTER TABLE dbo.ExtraWorkItem ADD SubmittedAt DATETIME2 NULL;
IF COL_LENGTH(N'dbo.ExtraWorkItem', N'DecidedBy') IS NULL
    ALTER TABLE dbo.ExtraWorkItem ADD DecidedBy NVARCHAR(60) NULL;
IF COL_LENGTH(N'dbo.ExtraWorkItem', N'DecidedAt') IS NULL
    ALTER TABLE dbo.ExtraWorkItem ADD DecidedAt DATETIME2 NULL;
IF COL_LENGTH(N'dbo.ExtraWorkItem', N'DecisionNote') IS NULL
    ALTER TABLE dbo.ExtraWorkItem ADD DecisionNote NVARCHAR(2000) NULL;
COMMIT TRANSACTION;
GO
