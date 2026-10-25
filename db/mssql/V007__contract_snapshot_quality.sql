/* افزایشی؛ بدون بازنویسی تاریخچه یا FK بین‌ماژولی. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.ContractMetricsSnapshot', 'ExpiringGuaranteeCount') IS NULL
  ALTER TABLE [dbo].[ContractMetricsSnapshot] ADD [ExpiringGuaranteeCount] INT NULL;
IF COL_LENGTH('dbo.ContractMetricsSnapshot', 'IsGapReliable') IS NULL
  ALTER TABLE [dbo].[ContractMetricsSnapshot] ADD [IsGapReliable] BIT NULL;
COMMIT TRANSACTION;
GO
