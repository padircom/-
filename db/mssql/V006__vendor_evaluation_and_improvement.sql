/* ارزیابی دوره‌ای و اقدامات بهبود؛ بدون FK فیزیکی بین‌ماژولی. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.VendorEvaluation', N'U') IS NULL
BEGIN
IF OBJECT_ID('dbo.VendorEvaluation', 'U') IS NULL
CREATE TABLE [dbo].[VendorEvaluation] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SourceKind] NVARCHAR(20) NOT NULL,
  [SourceId] NVARCHAR(60) NOT NULL,
  [PartyName] NVARCHAR(200) NOT NULL,
  [SourceCode] NVARCHAR(60) NOT NULL,
  [PeriodDate] DATE NOT NULL,
  [Scores] NVARCHAR(MAX) NOT NULL,
  [Weighted] INT NOT NULL,
  [Grade] NVARCHAR(1) NOT NULL,
  [Weakest] NVARCHAR(20) NOT NULL,
  [DocumentRef] NVARCHAR(200) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [DecidedBy] NVARCHAR(60) NULL,
  [DecidedAt] DATETIME2 NULL,
  [DecisionNote] NVARCHAR(2000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_VendorEvaluation] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_VendorEvaluation_Period] ON [dbo].[VendorEvaluation] ([ProjectId], [SourceKind], [SourceId], [PeriodDate]);
END;
IF OBJECT_ID(N'dbo.VendorImprovement', N'U') IS NULL
BEGIN
IF OBJECT_ID('dbo.VendorImprovement', 'U') IS NULL
CREATE TABLE [dbo].[VendorImprovement] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [EvaluationId] NVARCHAR(60) NOT NULL,
  [Axis] NVARCHAR(20) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [OwnerId] NVARCHAR(60) NOT NULL,
  [DueDate] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [Evidence] NVARCHAR(2000) NULL,
  [CompletedBy] NVARCHAR(60) NULL,
  [VerifiedBy] NVARCHAR(60) NULL,
  [VerifiedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_VendorImprovement] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_VendorImprovement_Project] ON [dbo].[VendorImprovement] ([ProjectId], [EvaluationId]);
END;
COMMIT TRANSACTION;
GO
