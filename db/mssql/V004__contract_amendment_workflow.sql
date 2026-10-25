/* الحاقیهٔ پیمان: ستون‌های افزایشی، بدون حذف یا بازنویسی سوابق.
   پیش‌نیاز: جدول dbo.ContractAmendment از اسکیما persistence.ts موجود باشد.
   رکوردهای قدیمی مصوب بدون تغییر باقی می‌مانند؛ پیش‌نویس قدیمی پیش از ارسال
   باید مرجع سند معتبر بگیرد. هیچ FK بین‌ماژولی ایجاد نمی‌شود. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.ContractAmendment', N'U') IS NULL
BEGIN
    RAISERROR(N'ContractAmendment must exist before applying V004.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;
IF COL_LENGTH(N'dbo.ContractAmendment', N'DocumentRef') IS NULL
    ALTER TABLE dbo.ContractAmendment ADD DocumentRef NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.ContractAmendment', N'SubmittedBy') IS NULL
    ALTER TABLE dbo.ContractAmendment ADD SubmittedBy NVARCHAR(60) NULL;
IF COL_LENGTH(N'dbo.ContractAmendment', N'SubmittedAt') IS NULL
    ALTER TABLE dbo.ContractAmendment ADD SubmittedAt DATETIME2 NULL;
IF COL_LENGTH(N'dbo.ContractAmendment', N'DecidedBy') IS NULL
    ALTER TABLE dbo.ContractAmendment ADD DecidedBy NVARCHAR(60) NULL;
IF COL_LENGTH(N'dbo.ContractAmendment', N'DecidedAt') IS NULL
    ALTER TABLE dbo.ContractAmendment ADD DecidedAt DATETIME2 NULL;
IF COL_LENGTH(N'dbo.ContractAmendment', N'DecisionNote') IS NULL
    ALTER TABLE dbo.ContractAmendment ADD DecisionNote NVARCHAR(2000) NULL;
COMMIT TRANSACTION;
GO
