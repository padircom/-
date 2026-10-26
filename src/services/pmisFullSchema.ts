// GENERATED from persistence.ts by npm run db:schema. Fresh installs only.
export const PMIS_FULL_SCHEMA_SCRIPT = `-- Arena Platform · sql-v1 · dialect=mssql
-- تولیدشده از src/services/persistence.ts — ویرایش دستی نکنید.

-- StrategyPlan · d20 · برنامهٔ استراتژیک
IF OBJECT_ID('dbo.StrategyPlan', 'U') IS NULL
CREATE TABLE [dbo].[StrategyPlan] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [DataDate] DATE NOT NULL,
  [ModelVersion] NVARCHAR(40) NOT NULL,
  [Objectives] NVARCHAR(MAX) NOT NULL,
  [Initiatives] NVARCHAR(MAX) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_StrategyPlan] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_StrategyPlan_Code] ON [dbo].[StrategyPlan] ([ProjectId], [Code]);
GO

-- ExcellenceAssessment · d19 · خودارزیابی داخلی تعالی
IF OBJECT_ID('dbo.ExcellenceAssessment', 'U') IS NULL
CREATE TABLE [dbo].[ExcellenceAssessment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [DataDate] DATE NOT NULL,
  [ModelVersion] NVARCHAR(40) NOT NULL,
  [Scores] NVARCHAR(MAX) NOT NULL,
  [Notes] NVARCHAR(6000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ExcellenceAssessment] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ExcellenceAssessment_Code] ON [dbo].[ExcellenceAssessment] ([ProjectId], [Code]);
GO

-- SchemaMigration · core · تاریخچه مهاجرت اسکیما
IF OBJECT_ID('dbo.SchemaMigration', 'U') IS NULL
CREATE TABLE [dbo].[SchemaMigration] (
  [Version] NVARCHAR(20) NOT NULL,
  [Name] NVARCHAR(200) NOT NULL,
  [Checksum] NVARCHAR(40) NOT NULL,
  [AppliedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [DurationMs] INT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SchemaMigration] PRIMARY KEY ([Version])
);
GO

-- Industry · core · خوشه صنعتی
IF OBJECT_ID('dbo.Industry', 'U') IS NULL
CREATE TABLE [dbo].[Industry] (
  [Id] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(20) NOT NULL,
  [TitleFa] NVARCHAR(200) NOT NULL,
  [TitleEn] NVARCHAR(200) NULL,
  [Color] NVARCHAR(20) NULL,
  [Icon] NVARCHAR(20) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Industry] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_Industry_Code] ON [dbo].[Industry] ([Code]);
GO

-- Project · core · پروژه
IF OBJECT_ID('dbo.Project', 'U') IS NULL
CREATE TABLE [dbo].[Project] (
  [Id] NVARCHAR(60) NOT NULL,
  [IndustryId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(50) NOT NULL,
  [NameFa] NVARCHAR(400) NOT NULL,
  [NameEn] NVARCHAR(400) NULL,
  [ClientFa] NVARCHAR(200) NULL,
  [ConsultantFa] NVARCHAR(200) NULL,
  [ContractorFa] NVARCHAR(200) NULL,
  [LocationFa] NVARCHAR(250) NULL,
  [ContractNo] NVARCHAR(60) NULL,
  [Budget] DECIMAL(18,2) NULL,
  [StartDate] DATE NULL,
  [FinishDate] DATE NULL,
  [Status] NVARCHAR(30) NOT NULL DEFAULT 'active',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Project] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_Project_IndustryId] FOREIGN KEY ([IndustryId]) REFERENCES [dbo].[Industry] ([Id]) ON DELETE NO ACTION
);
CREATE UNIQUE INDEX [UX_Project_Code] ON [dbo].[Project] ([Code]);
CREATE INDEX [IX_Project_Industry] ON [dbo].[Project] ([IndustryId]);
GO

-- ProcessTree · core · درخت فرایند پروژه
IF OBJECT_ID('dbo.ProcessTree', 'U') IS NULL
CREATE TABLE [dbo].[ProcessTree] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DomainId] NVARCHAR(20) NOT NULL,
  [Payload] NVARCHAR(MAX) NOT NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ProcessTree] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ProcessTree_ProjectDomain] ON [dbo].[ProcessTree] ([ProjectId], [DomainId]);
GO

-- AppUser · d7 · کاربر
IF OBJECT_ID('dbo.AppUser', 'U') IS NULL
CREATE TABLE [dbo].[AppUser] (
  [Id] NVARCHAR(60) NOT NULL,
  [Username] NVARCHAR(60) NOT NULL,
  [DisplayName] NVARCHAR(160) NOT NULL,
  [Email] NVARCHAR(160) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [Clearance] NVARCHAR(20) NULL,
  [Party] NVARCHAR(20) NULL,
  [PasswordChangedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_AppUser] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_AppUser_Username] ON [dbo].[AppUser] ([Username]);
GO

-- UserRole · d7 · انتساب نقش
IF OBJECT_ID('dbo.UserRole', 'U') IS NULL
CREATE TABLE [dbo].[UserRole] (
  [Id] NVARCHAR(60) NOT NULL,
  [UserId] NVARCHAR(60) NOT NULL,
  [RoleCode] NVARCHAR(40) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_UserRole] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_UserRole_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AppUser] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_UserRole] ON [dbo].[UserRole] ([UserId], [RoleCode]);
GO

-- UserProjectScope · d7 · دامنه پروژه کاربر
IF OBJECT_ID('dbo.UserProjectScope', 'U') IS NULL
CREATE TABLE [dbo].[UserProjectScope] (
  [Id] NVARCHAR(60) NOT NULL,
  [UserId] NVARCHAR(60) NOT NULL,
  [ProjectCode] NVARCHAR(50) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_UserProjectScope] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_UserProjectScope_UserId] FOREIGN KEY ([UserId]) REFERENCES [dbo].[AppUser] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_UserProjectScope] ON [dbo].[UserProjectScope] ([UserId], [ProjectCode]);
GO

-- Delegation · d7 · تفویض اختیار
IF OBJECT_ID('dbo.Delegation', 'U') IS NULL
CREATE TABLE [dbo].[Delegation] (
  [Id] NVARCHAR(60) NOT NULL,
  [FromUserId] NVARCHAR(60) NOT NULL,
  [ToUserId] NVARCHAR(60) NOT NULL,
  [Permissions] NVARCHAR(MAX) NOT NULL,
  [ValidFrom] DATE NOT NULL,
  [ValidTo] DATE NOT NULL,
  [Reason] NVARCHAR(400) NOT NULL,
  [Revoked] BIT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Delegation] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_Delegation_To] ON [dbo].[Delegation] ([ToUserId], [ValidTo]);
GO

-- AuditLog · d7 · لاگ ممیزی
IF OBJECT_ID('dbo.AuditLog', 'U') IS NULL
CREATE TABLE [dbo].[AuditLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [At] DATETIME2 NOT NULL,
  [SubjectId] NVARCHAR(60) NOT NULL,
  [Action] NVARCHAR(80) NOT NULL,
  [Permission] NVARCHAR(60) NULL,
  [Decision] NVARCHAR(40) NULL,
  [ProjectCode] NVARCHAR(50) NULL,
  [EntityName] NVARCHAR(60) NULL,
  [EntityId] NVARCHAR(60) NULL,
  [Severity] NVARCHAR(20) NOT NULL DEFAULT 'info',
  [Details] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_AuditLog] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_AuditLog_At] ON [dbo].[AuditLog] ([At]);
CREATE INDEX [IX_AuditLog_Subject] ON [dbo].[AuditLog] ([SubjectId], [At]);
GO

-- Document · d1 · مدرک
IF OBJECT_ID('dbo.Document', 'U') IS NULL
CREATE TABLE [dbo].[Document] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocNo] NVARCHAR(80) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [TitleEn] NVARCHAR(400) NULL,
  [Revision] NVARCHAR(10) NOT NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [Discipline] NVARCHAR(40) NULL,
  [Classification] NVARCHAR(20) NULL,
  [FilePath] NVARCHAR(400) NULL,
  [IssuedAt] DATE NULL,
  [ReviewCode] NVARCHAR(10) NULL,
  [SlaHours] INT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Document] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_Document_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Project] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_Document_DocNoRev] ON [dbo].[Document] ([ProjectId], [DocNo], [Revision]);
GO

-- Transmittal · d1 · ترانسمیتال
IF OBJECT_ID('dbo.Transmittal', 'U') IS NULL
CREATE TABLE [dbo].[Transmittal] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [TrnNo] NVARCHAR(80) NOT NULL,
  [Direction] NVARCHAR(20) NOT NULL,
  [IssuedAt] DATE NOT NULL,
  [DueAt] DATE NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [Items] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Transmittal] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_Transmittal_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Project] ([Id]) ON DELETE CASCADE
);
GO

-- WbsNode · d2 · گره WBS
IF OBJECT_ID('dbo.WbsNode', 'U') IS NULL
CREATE TABLE [dbo].[WbsNode] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [ParentId] NVARCHAR(60) NULL,
  [Level] INT NOT NULL,
  [Weight] DECIMAL(9,4) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_WbsNode] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_WbsNode_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Project] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_WbsNode_Code] ON [dbo].[WbsNode] ([ProjectId], [Code]);
GO

-- Activity · d2 · فعالیت
IF OBJECT_ID('dbo.Activity', 'U') IS NULL
CREATE TABLE [dbo].[Activity] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [WbsId] NVARCHAR(60) NULL,
  [Code] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(400) NOT NULL,
  [Discipline] NVARCHAR(40) NULL,
  [PlannedStart] DATE NOT NULL,
  [PlannedFinish] DATE NOT NULL,
  [ActualStart] DATE NULL,
  [ActualFinish] DATE NULL,
  [DurationDays] INT NULL,
  [TotalFloat] INT NULL,
  [FreeFloat] INT NULL,
  [PhysicalPct] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [BudgetCost] DECIMAL(18,2) NULL,
  [BudgetMh] DECIMAL(14,2) NULL,
  [RocCode] NVARCHAR(40) NULL,
  [IsCritical] BIT NOT NULL DEFAULT 0,
  [BlockedByEquipmentId] NVARCHAR(60) NULL,
  [BlockedByDocumentId] NVARCHAR(60) NULL,
  [IsStopWorkOrder] BIT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Activity] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_Activity_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Project] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_Activity_Code] ON [dbo].[Activity] ([ProjectId], [Code]);
CREATE INDEX [IX_Activity_Float] ON [dbo].[Activity] ([ProjectId], [TotalFloat]);
GO

-- ActivityRelation · d2 · رابطه فعالیت
IF OBJECT_ID('dbo.ActivityRelation', 'U') IS NULL
CREATE TABLE [dbo].[ActivityRelation] (
  [Id] NVARCHAR(60) NOT NULL,
  [PredecessorId] NVARCHAR(60) NOT NULL,
  [SuccessorId] NVARCHAR(60) NOT NULL,
  [RelType] NVARCHAR(4) NOT NULL DEFAULT 'FS',
  [LagDays] INT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ActivityRelation] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ActivityRelation] ON [dbo].[ActivityRelation] ([PredecessorId], [SuccessorId], [RelType]);
GO

-- Baseline · d2 · برنامه مبنا
IF OBJECT_ID('dbo.Baseline', 'U') IS NULL
CREATE TABLE [dbo].[Baseline] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Name] NVARCHAR(120) NOT NULL,
  [SetAt] DATETIME2 NOT NULL,
  [SetBy] NVARCHAR(60) NOT NULL,
  [IsCurrent] BIT NOT NULL DEFAULT 0,
  [Snapshot] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Baseline] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_Baseline_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Project] ([Id]) ON DELETE CASCADE
);
GO

-- Period · d2 · دوره گزارشی
IF OBJECT_ID('dbo.Period', 'U') IS NULL
CREATE TABLE [dbo].[Period] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(20) NOT NULL,
  [StartDate] DATE NOT NULL,
  [EndDate] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'open',
  [ClosedAt] DATETIME2 NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Period] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_Period_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Project] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_Period_Code] ON [dbo].[Period] ([ProjectId], [Code]);
GO

-- ProgressEntry · d2 · ثبت پیشرفت
IF OBJECT_ID('dbo.ProgressEntry', 'U') IS NULL
CREATE TABLE [dbo].[ProgressEntry] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ActivityId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [EntryDate] DATE NOT NULL,
  [PhysicalPct] DECIMAL(5,2) NOT NULL,
  [Steps] NVARCHAR(MAX) NULL,
  [BlockedSteps] NVARCHAR(MAX) NULL,
  [AcceptedIntoEv] BIT NOT NULL DEFAULT 0,
  [Note] NVARCHAR(500) NULL,
  [EnteredBy] NVARCHAR(60) NOT NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ProgressEntry] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ProgressEntry_Activity] ON [dbo].[ProgressEntry] ([ActivityId], [EntryDate]);
CREATE INDEX [IX_ProgressEntry_Period] ON [dbo].[ProgressEntry] ([ProjectId], [PeriodCode]);
GO

-- EvmSnapshot · d3 · عکس ارزش کسب‌شده
IF OBJECT_ID('dbo.EvmSnapshot', 'U') IS NULL
CREATE TABLE [dbo].[EvmSnapshot] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DataDate] DATE NOT NULL,
  [Pv] DECIMAL(18,2) NOT NULL,
  [Ev] DECIMAL(18,2) NOT NULL,
  [Ac] DECIMAL(18,2) NOT NULL,
  [Bac] DECIMAL(18,2) NULL,
  [Eac] DECIMAL(18,2) NULL,
  [Spi] DECIMAL(8,4) NULL,
  [Cpi] DECIMAL(8,4) NULL,
  [FormulaVersion] NVARCHAR(20) NULL,
  [Hash] NVARCHAR(40) NULL,
  [Inputs] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EvmSnapshot] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EvmSnapshot] ON [dbo].[EvmSnapshot] ([ProjectId], [DataDate]);
GO

-- KpiSnapshot · d3 · عکس شاخص
IF OBJECT_ID('dbo.KpiSnapshot', 'U') IS NULL
CREATE TABLE [dbo].[KpiSnapshot] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [KpiCode] NVARCHAR(40) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [Value] DECIMAL(18,4) NOT NULL,
  [Target] DECIMAL(18,4) NULL,
  [Status] NVARCHAR(20) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_KpiSnapshot] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_KpiSnapshot] ON [dbo].[KpiSnapshot] ([ProjectId], [KpiCode], [PeriodCode]);
GO

-- Risk · d4 · ریسک
IF OBJECT_ID('dbo.Risk', 'U') IS NULL
CREATE TABLE [dbo].[Risk] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Category] NVARCHAR(40) NOT NULL,
  [Probability] INT NOT NULL,
  [Impact] INT NOT NULL,
  [Score] INT NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [Owner] NVARCHAR(120) NULL,
  [Response] NVARCHAR(1000) NULL,
  [Cause] NVARCHAR(1000) NULL,
  [Event] NVARCHAR(1000) NULL,
  [Effect] NVARCHAR(1000) NULL,
  [SourceRef] NVARCHAR(200) NULL,
  [WbsCode] NVARCHAR(60) NULL,
  [ActivityCode] NVARCHAR(60) NULL,
  [BaselineId] NVARCHAR(60) NULL,
  [ReserveAmount] DECIMAL(18,2) NULL,
  [ReserveUsedAmount] DECIMAL(18,2) NULL,
  [ReserveStatus] NVARCHAR(30) NULL,
  [NextReviewDate] DATE NULL,
  [LastReviewedAt] DATETIME2 NULL,
  [LastReviewedBy] NVARCHAR(60) NULL,
  [MonitoringNote] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Risk] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_Risk_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Project] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_Risk_Code] ON [dbo].[Risk] ([ProjectId], [Code]);
GO

-- ChangeRequest · d4 · درخواست تغییر
IF OBJECT_ID('dbo.ChangeRequest', 'U') IS NULL
CREATE TABLE [dbo].[ChangeRequest] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [RaisedBy] NVARCHAR(60) NOT NULL,
  [RaisedAt] DATE NOT NULL,
  [CostImpact] DECIMAL(18,2) NULL,
  [TimeImpactDays] INT NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [Reason] NVARCHAR(1000) NULL,
  [Assessment] NVARCHAR(MAX) NULL,
  [DecisionReason] NVARCHAR(1000) NULL,
  [WbsCode] NVARCHAR(60) NULL,
  [ActivityCode] NVARCHAR(60) NULL,
  [BaselineId] NVARCHAR(60) NULL,
  [ApplicationStatus] NVARCHAR(30) NULL,
  [AppliedBaselineId] NVARCHAR(60) NULL,
  [ApplicationNote] NVARCHAR(1000) NULL,
  [AppliedBy] NVARCHAR(60) NULL,
  [AppliedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ChangeRequest] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ChangeRequest_Code] ON [dbo].[ChangeRequest] ([ProjectId], [Code]);
GO

-- Claim · d4 · ادعا
IF OBJECT_ID('dbo.Claim', 'U') IS NULL
CREATE TABLE [dbo].[Claim] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [NoticeDate] DATE NOT NULL,
  [SubmittedAt] DATE NULL,
  [Amount] DECIMAL(18,2) NULL,
  [ProposedAmount] DECIMAL(18,2) NULL,
  [ExtensionDays] INT NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [TimeBarred] BIT NOT NULL DEFAULT 0,
  [EventDate] DATE NULL,
  [NoticeDays] INT NULL,
  [NoticeDeliveredAt] DATETIME2 NULL,
  [NoticeRef] NVARCHAR(200) NULL,
  [Clause] NVARCHAR(200) NULL,
  [EvidenceRef] NVARCHAR(1000) NULL,
  [Entitlement] NVARCHAR(1000) NULL,
  [Causation] NVARCHAR(1000) NULL,
  [QuantumNote] NVARCHAR(1000) NULL,
  [BaselineId] NVARCHAR(60) NULL,
  [DataDate] DATE NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [ReviewNote] NVARCHAR(1000) NULL,
  [ReviewBy] NVARCHAR(60) NULL,
  [ReviewAt] DATETIME2 NULL,
  [NegotiationNote] NVARCHAR(1000) NULL,
  [NegotiationBy] NVARCHAR(60) NULL,
  [NegotiationAt] DATETIME2 NULL,
  [DeterminedAmount] DECIMAL(18,2) NULL,
  [DeterminedDays] INT NULL,
  [DeterminationNote] NVARCHAR(1000) NULL,
  [DeterminedBy] NVARCHAR(60) NULL,
  [DeterminedAt] DATETIME2 NULL,
  [RejectionNote] NVARCHAR(1000) NULL,
  [RejectedBy] NVARCHAR(60) NULL,
  [RejectedAt] DATETIME2 NULL,
  [SettlementAmount] DECIMAL(18,2) NULL,
  [SettlementDays] INT NULL,
  [SettlementNote] NVARCHAR(1000) NULL,
  [SettledBy] NVARCHAR(60) NULL,
  [SettledAt] DATETIME2 NULL,
  [DisputeNote] NVARCHAR(1000) NULL,
  [DisputedBy] NVARCHAR(60) NULL,
  [DisputedAt] DATETIME2 NULL,
  [WithdrawalNote] NVARCHAR(1000) NULL,
  [WithdrawnBy] NVARCHAR(60) NULL,
  [WithdrawnAt] DATETIME2 NULL,
  [ClosureNote] NVARCHAR(1000) NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [ClosedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Claim] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_Claim_Code] ON [dbo].[Claim] ([ProjectId], [Code]);
GO

-- RccIssue · d4 · مسئله و هشدار زودهنگام
IF OBJECT_ID('dbo.RccIssue', 'U') IS NULL
CREATE TABLE [dbo].[RccIssue] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Description] NVARCHAR(1000) NULL,
  [Severity] NVARCHAR(20) NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [Owner] NVARCHAR(120) NULL,
  [DueDate] DATE NULL,
  [RiskCode] NVARCHAR(40) NULL,
  [WbsCode] NVARCHAR(60) NULL,
  [ActivityCode] NVARCHAR(60) NULL,
  [SourceRef] NVARCHAR(200) NULL,
  [EscalationLevel] INT NULL,
  [EscalationNote] NVARCHAR(1000) NULL,
  [EscalatedBy] NVARCHAR(60) NULL,
  [EscalatedAt] DATETIME2 NULL,
  [ResolutionNote] NVARCHAR(1000) NULL,
  [ResolvedBy] NVARCHAR(60) NULL,
  [ResolvedAt] DATETIME2 NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [ClosedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_RccIssue] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_RccIssue_ProjectId] FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Project] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_RccIssue_Code] ON [dbo].[RccIssue] ([ProjectId], [Code]);
GO

-- DelayEvent · d4 · رویداد تأخیر و Extension of Time
IF OBJECT_ID('dbo.DelayEvent', 'U') IS NULL
CREATE TABLE [dbo].[DelayEvent] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Category] NVARCHAR(40) NOT NULL,
  [SourceParty] NVARCHAR(40) NOT NULL,
  [StartDate] DATE NOT NULL,
  [FinishDate] DATE NOT NULL,
  [NoticedDate] DATE NULL,
  [Status] NVARCHAR(30) NULL,
  [ContractCode] NVARCHAR(60) NULL,
  [ClaimCode] NVARCHAR(40) NULL,
  [RiskCode] NVARCHAR(40) NULL,
  [IssueCode] NVARCHAR(40) NULL,
  [WbsCode] NVARCHAR(60) NULL,
  [ActivityCode] NVARCHAR(60) NULL,
  [BaselineId] NVARCHAR(60) NULL,
  [IpcId] NVARCHAR(60) NULL,
  [ClauseRef] NVARCHAR(200) NULL,
  [EvidenceRef] NVARCHAR(1000) NULL,
  [EvidenceRefs] NVARCHAR(MAX) NULL,
  [EstimatedDelayDays] INT NULL,
  [CompletionImpactDays] INT NULL,
  [IsCritical] BIT NULL DEFAULT 0,
  [RootCauseFa] NVARCHAR(1000) NULL,
  [ReviewNote] NVARCHAR(1000) NULL,
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_DelayEvent] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_DelayEvent_Code] ON [dbo].[DelayEvent] ([ProjectId], [Code]);
CREATE INDEX [IX_DelayEvent_Claim] ON [dbo].[DelayEvent] ([ProjectId], [ClaimCode]);
GO

-- DelayCalculation · d4 · محاسبهٔ تأخیر و تمدید مدت
IF OBJECT_ID('dbo.DelayCalculation', 'U') IS NULL
CREATE TABLE [dbo].[DelayCalculation] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DelayEventId] NVARCHAR(60) NOT NULL,
  [Engine] NVARCHAR(40) NOT NULL,
  [RuleVersion] NVARCHAR(80) NOT NULL,
  [Method] NVARCHAR(40) NULL,
  [Inputs] NVARCHAR(MAX) NOT NULL,
  [Result] NVARCHAR(MAX) NOT NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [RawValueDays] DECIMAL(18,6) NULL,
  [FinalValueDays] DECIMAL(18,6) NULL,
  [CalculatedBy] NVARCHAR(60) NULL,
  [CalculatedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ApprovalNote] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_DelayCalculation] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_DelayCalculation_Event] ON [dbo].[DelayCalculation] ([ProjectId], [DelayEventId], [Engine]);
GO

-- ClaimCostItem · d4 · آیتم هزینهٔ ادعای مالی (Prolongation)
IF OBJECT_ID('dbo.ClaimCostItem', 'U') IS NULL
CREATE TABLE [dbo].[ClaimCostItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DelayEventId] NVARCHAR(60) NOT NULL,
  [ClaimCode] NVARCHAR(40) NULL,
  [CostType] NVARCHAR(30) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [Currency] NVARCHAR(10) NULL,
  [Basis] NVARCHAR(1000) NULL,
  [PeriodFrom] DATE NULL,
  [PeriodTo] DATE NULL,
  [DocumentRefs] NVARCHAR(MAX) NULL,
  [Status] NVARCHAR(20) NULL DEFAULT 'draft',
  [LossCategory] NVARCHAR(40) NULL,
  [CostNature] NVARCHAR(10) NULL,
  [Quantity] DECIMAL(18,4) NULL,
  [Rate] DECIMAL(18,4) NULL,
  [UnitFa] NVARCHAR(60) NULL,
  [DocumentedAmount] DECIMAL(18,2) NULL,
  [ApprovedAmount] DECIMAL(18,2) NULL,
  [RuleCode] NVARCHAR(60) NULL,
  [ResourceKind] NVARCHAR(20) NULL,
  [ResourceNameFa] NVARCHAR(300) NULL,
  [WorkedUnits] DECIMAL(18,2) NULL,
  [IdleUnits] DECIMAL(18,2) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ClaimCostItem] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ClaimCostItem_Event] ON [dbo].[ClaimCostItem] ([ProjectId], [DelayEventId]);
GO

-- ClaimCalculationRule · d4 · قاعدهٔ محاسبهٔ خسارت
IF OBJECT_ID('dbo.ClaimCalculationRule', 'U') IS NULL
CREATE TABLE [dbo].[ClaimCalculationRule] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [Category] NVARCHAR(40) NOT NULL,
  [Kind] NVARCHAR(30) NOT NULL,
  [FormulaFa] NVARCHAR(1000) NULL,
  [SourceFa] NVARCHAR(1000) NULL,
  [Version] NVARCHAR(20) NULL DEFAULT '1.0',
  [Status] NVARCHAR(20) NOT NULL,
  [EffectiveFrom] DATE NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ClaimCalculationRule] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ClaimCalculationRule_Code] ON [dbo].[ClaimCalculationRule] ([ProjectId], [Code], [Version]) WHERE [Version] IS NOT NULL;
GO

-- ClaimCalculationRun · d4 · اجرای محاسبهٔ خسارت (append-only)
IF OBJECT_ID('dbo.ClaimCalculationRun', 'U') IS NULL
CREATE TABLE [dbo].[ClaimCalculationRun] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ClaimCostItemId] NVARCHAR(60) NOT NULL,
  [RuleId] NVARCHAR(60) NULL,
  [RuleCode] NVARCHAR(60) NULL,
  [RuleVersion] NVARCHAR(20) NULL,
  [Engine] NVARCHAR(40) NOT NULL DEFAULT 'claim-loss-v1',
  [Inputs] NVARCHAR(MAX) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [RawAmount] DECIMAL(18,2) NULL,
  [FinalAmount] DECIMAL(18,2) NULL,
  [ManualAdjustment] DECIMAL(18,2) NULL DEFAULT 0,
  [ManualReason] NVARCHAR(1000) NULL,
  [Issues] NVARCHAR(MAX) NULL,
  [CalculatedBy] NVARCHAR(60) NULL,
  [CalculatedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ClaimCalculationRun] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ClaimCalculationRun_Item] ON [dbo].[ClaimCalculationRun] ([ProjectId], [ClaimCostItemId]);
GO

-- ClaimCostAllocation · d4 · تخصیص هزینه میان رویدادها
IF OBJECT_ID('dbo.ClaimCostAllocation', 'U') IS NULL
CREATE TABLE [dbo].[ClaimCostAllocation] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ClaimCostItemId] NVARCHAR(60) NOT NULL,
  [DelayEventId] NVARCHAR(60) NOT NULL,
  [AllocationPct] DECIMAL(7,2) NOT NULL,
  [Basis] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ClaimCostAllocation] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ClaimCostAllocation_Item] ON [dbo].[ClaimCostAllocation] ([ProjectId], [ClaimCostItemId]);
GO

-- ClaimDocumentVersion · d4 · نسخهٔ لایحهٔ ضرر و زیان
IF OBJECT_ID('dbo.ClaimDocumentVersion', 'U') IS NULL
CREATE TABLE [dbo].[ClaimDocumentVersion] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ClaimId] NVARCHAR(60) NOT NULL,
  [ClaimCode] NVARCHAR(40) NULL,
  [Version] INT NOT NULL,
  [Format] NVARCHAR(10) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [Totals] NVARCHAR(MAX) NULL,
  [GeneratedBy] NVARCHAR(60) NULL,
  [GeneratedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ClaimDocumentVersion] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ClaimDocumentVersion_Claim] ON [dbo].[ClaimDocumentVersion] ([ProjectId], [ClaimId], [Version]);
GO

-- ContractRiskRegister · d14 · دفتر ثبت ریسک قراردادی
IF OBJECT_ID('dbo.ContractRiskRegister', 'U') IS NULL
CREATE TABLE [dbo].[ContractRiskRegister] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [DescriptionFa] NVARCHAR(2000) NULL,
  [ContractCode] NVARCHAR(60) NULL,
  [ClauseRef] NVARCHAR(200) NULL,
  [DocumentId] NVARCHAR(60) NULL,
  [Category] NVARCHAR(40) NOT NULL,
  [CauseFa] NVARCHAR(1000) NULL,
  [EventFa] NVARCHAR(1000) NULL,
  [ConsequenceFa] NVARCHAR(1000) NULL,
  [Owner] NVARCHAR(60) NULL,
  [IdentifiedAt] DATE NULL,
  [Probability] INT NULL,
  [ImpactTime] INT NULL,
  [ImpactFinancial] INT NULL,
  [ImpactLegal] INT NULL,
  [ImpactOperational] INT NULL,
  [ImpactQuality] INT NULL,
  [ExistingControlsFa] NVARCHAR(2000) NULL,
  [ControlEffectiveness] NVARCHAR(20) NULL,
  [ControlEvidenceRefs] NVARCHAR(MAX) NULL,
  [InherentScore] DECIMAL(7,2) NULL,
  [InherentBand] NVARCHAR(20) NULL,
  [ResidualScore] DECIMAL(7,2) NULL,
  [ResidualBand] NVARCHAR(20) NULL,
  [ScoringVersion] NVARCHAR(40) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'identified',
  [NextReviewDate] DATE NULL,
  [DelayEventCode] NVARCHAR(40) NULL,
  [ClaimCode] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractRiskRegister] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractRiskRegister_Code] ON [dbo].[ContractRiskRegister] ([ProjectId], [Code]);
CREATE INDEX [IX_ContractRiskRegister_Contract] ON [dbo].[ContractRiskRegister] ([ProjectId], [ContractCode]);
GO

-- ContractRiskAssessment · d14 · سابقهٔ ارزیابی ریسک قراردادی (append-only)
IF OBJECT_ID('dbo.ContractRiskAssessment', 'U') IS NULL
CREATE TABLE [dbo].[ContractRiskAssessment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RiskCode] NVARCHAR(40) NOT NULL,
  [Inputs] NVARCHAR(MAX) NOT NULL,
  [InherentScore] DECIMAL(7,2) NULL,
  [InherentBand] NVARCHAR(20) NULL,
  [ResidualScore] DECIMAL(7,2) NULL,
  [ResidualBand] NVARCHAR(20) NULL,
  [ScoringVersion] NVARCHAR(40) NULL,
  [AssessedBy] NVARCHAR(60) NULL,
  [AssessedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractRiskAssessment] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ContractRiskAssessment_Risk] ON [dbo].[ContractRiskAssessment] ([ProjectId], [RiskCode], [AssessedAt]);
GO

-- ContractRiskScoringRule · d14 · قاعده و نسخهٔ امتیازدهی ریسک قراردادی
IF OBJECT_ID('dbo.ContractRiskScoringRule', 'U') IS NULL
CREATE TABLE [dbo].[ContractRiskScoringRule] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [Version] NVARCHAR(20) NULL DEFAULT '1.0',
  [Config] NVARCHAR(MAX) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractRiskScoringRule] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractRiskScoringRule_Code] ON [dbo].[ContractRiskScoringRule] ([ProjectId], [Code], [Version]) WHERE [Version] IS NOT NULL;
GO

-- ContractClauseFinding · d14 · یافتهٔ تحلیل بند قرارداد
IF OBJECT_ID('dbo.ContractClauseFinding', 'U') IS NULL
CREATE TABLE [dbo].[ContractClauseFinding] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NULL,
  [ContractCode] NVARCHAR(60) NULL,
  [ClauseNo] NVARCHAR(60) NULL,
  [ClauseText] NVARCHAR(4000) NULL,
  [Kind] NVARCHAR(40) NOT NULL,
  [FindingFa] NVARCHAR(1000) NULL,
  [ReasonFa] NVARCHAR(1000) NULL,
  [Confidence] DECIMAL(5,2) NULL,
  [SourceRef] NVARCHAR(300) NULL,
  [SuggestedCategory] NVARCHAR(40) NULL,
  [ReviewStatus] NVARCHAR(20) NOT NULL DEFAULT 'pending',
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractClauseFinding] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ContractClauseFinding_Doc] ON [dbo].[ContractClauseFinding] ([ProjectId], [DocumentId]);
GO

-- ContractObligation · d14 · تعهد و مهلت قراردادی
IF OBJECT_ID('dbo.ContractObligation', 'U') IS NULL
CREATE TABLE [dbo].[ContractObligation] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [ContractCode] NVARCHAR(60) NULL,
  [ClauseRef] NVARCHAR(200) NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [ResponsibleParty] NVARCHAR(30) NULL,
  [BeneficiaryParty] NVARCHAR(30) NULL,
  [StartDate] DATE NULL,
  [DueDate] DATE NULL,
  [PreconditionFa] NVARCHAR(1000) NULL,
  [EvidenceDocumentId] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'pending',
  [NoteFa] NVARCHAR(1000) NULL,
  [RiskCode] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractObligation] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractObligation_Code] ON [dbo].[ContractObligation] ([ProjectId], [Code]);
CREATE INDEX [IX_ContractObligation_Due] ON [dbo].[ContractObligation] ([ProjectId], [DueDate]);
GO

-- ContractImprovement · d14 · پیشنهاد اصلاح و بهبود بند قرارداد
IF OBJECT_ID('dbo.ContractImprovement', 'U') IS NULL
CREATE TABLE [dbo].[ContractImprovement] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [ContractCode] NVARCHAR(60) NULL,
  [ClauseRef] NVARCHAR(200) NULL,
  [CurrentText] NVARCHAR(4000) NULL,
  [ProblemFa] NVARCHAR(2000) NULL,
  [RiskFa] NVARCHAR(2000) NULL,
  [ConsequenceFa] NVARCHAR(2000) NULL,
  [ProposedText] NVARCHAR(4000) NULL,
  [ReasonFa] NVARCHAR(2000) NULL,
  [EffectEmployerFa] NVARCHAR(1000) NULL,
  [EffectContractorFa] NVARCHAR(1000) NULL,
  [EffectCostTimeFa] NVARCHAR(1000) NULL,
  [BasisFa] NVARCHAR(2000) NULL,
  [Confidence] DECIMAL(5,2) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [ReviewerBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATETIME2 NULL,
  [RiskCode] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractImprovement] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractImprovement_Code] ON [dbo].[ContractImprovement] ([ProjectId], [Code]);
GO

-- ContractRiskAction · d14 · اقدام پاسخ به ریسک قراردادی
IF OBJECT_ID('dbo.ContractRiskAction', 'U') IS NULL
CREATE TABLE [dbo].[ContractRiskAction] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [RiskCode] NVARCHAR(40) NOT NULL,
  [Strategy] NVARCHAR(20) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Owner] NVARCHAR(60) NULL,
  [StartDate] DATE NULL,
  [DueDate] DATE NULL,
  [Cost] DECIMAL(18,2) NULL,
  [ProgressPct] DECIMAL(5,2) NULL DEFAULT 0,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'defined',
  [EffectivenessMetricFa] NVARCHAR(1000) NULL,
  [EvidenceDocumentId] NVARCHAR(60) NULL,
  [EffectivenessNoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractRiskAction] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractRiskAction_Code] ON [dbo].[ContractRiskAction] ([ProjectId], [Code]);
CREATE INDEX [IX_ContractRiskAction_Risk] ON [dbo].[ContractRiskAction] ([ProjectId], [RiskCode]);
GO

-- PmisSchedReconMissions · d4 · مأموریت کارشناسی بازسازی زمان‌بندی ادعا
IF OBJECT_ID('dbo.PmisSchedReconMissions', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconMissions] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [PurposeFa] NVARCHAR(2000) NULL,
  [PeriodFrom] DATE NOT NULL,
  [PeriodTo] DATE NOT NULL,
  [AnalysisStandard] NVARCHAR(20) NULL DEFAULT 'BOTH',
  [ClaimCode] NVARCHAR(40) NULL,
  [DelayEventCode] NVARCHAR(40) NULL,
  [ContractCode] NVARCHAR(60) NULL,
  [ScheduleFileRefs] NVARCHAR(MAX) NULL,
  [CurrentStep] INT NULL DEFAULT 1,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [StartedAt] DATETIME2 NULL,
  [CompletedAt] DATETIME2 NULL,
  [ExpertNoteFa] NVARCHAR(2000) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconMissions] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconMissions_Code] ON [dbo].[PmisSchedReconMissions] ([ProjectId], [Code]);
GO

-- PmisSchedReconExtractions · d4 · مستندات استخراج‌شده از واقعیت میدانی
IF OBJECT_ID('dbo.PmisSchedReconExtractions', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconExtractions] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [DocType] NVARCHAR(30) NOT NULL,
  [DocumentId] NVARCHAR(60) NULL,
  [SourceRef] NVARCHAR(300) NULL,
  [EventDate] DATE NOT NULL,
  [PeriodFrom] DATE NULL,
  [PeriodTo] DATE NULL,
  [SummaryFa] NVARCHAR(2000) NULL,
  [FactsJson] NVARCHAR(MAX) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'collected',
  [VerifiedBy] NVARCHAR(60) NULL,
  [VerifiedAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconExtractions] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconExtractions_Code] ON [dbo].[PmisSchedReconExtractions] ([ProjectId], [Code]);
CREATE INDEX [IX_PmisSchedReconExtractions_Mission] ON [dbo].[PmisSchedReconExtractions] ([ProjectId], [MissionCode]);
GO

-- PmisSchedReconEvaluations · d4 · ارزیابی آسیب‌دیدگی فایل زمان‌بندی و تصمیم Repair/Reconstruction
IF OBJECT_ID('dbo.PmisSchedReconEvaluations', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconEvaluations] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [FileKind] NVARCHAR(10) NOT NULL,
  [DocumentId] NVARCHAR(60) NULL,
  [BaselineDate] DATE NULL,
  [DataDate] DATE NULL,
  [ActivityCount] INT NULL,
  [RelationshipCount] INT NULL,
  [OpenEndsCount] INT NULL,
  [NegativeFloatCount] INT NULL,
  [LoopCount] INT NULL,
  [OutOfSequenceCount] INT NULL,
  [MissingCalendarCount] INT NULL,
  [DamageClass] NVARCHAR(30) NULL,
  [Decision] NVARCHAR(20) NULL DEFAULT 'pending',
  [DecisionReasonFa] NVARCHAR(2000) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'pending_review',
  [EvaluatedBy] NVARCHAR(60) NULL,
  [EvaluatedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconEvaluations] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconEvaluations_Code] ON [dbo].[PmisSchedReconEvaluations] ([ProjectId], [Code]);
CREATE INDEX [IX_PmisSchedReconEvaluations_Mission] ON [dbo].[PmisSchedReconEvaluations] ([ProjectId], [MissionCode]);
GO

-- PmisSchedReconWbsMaps · d4 · نقشه تطبیق و همسان‌سازی WBS مصوب با واقعیت
IF OBJECT_ID('dbo.PmisSchedReconWbsMaps', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconWbsMaps] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [BaselineWbsCode] NVARCHAR(80) NOT NULL,
  [BaselineWbsTitleFa] NVARCHAR(300) NULL,
  [ActualWbsCode] NVARCHAR(80) NULL,
  [ActualWbsTitleFa] NVARCHAR(300) NULL,
  [MapKind] NVARCHAR(20) NOT NULL,
  [Confidence] DECIMAL(5,2) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconWbsMaps] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconWbsMaps_Code] ON [dbo].[PmisSchedReconWbsMaps] ([ProjectId], [MissionCode], [Code]);
GO

-- PmisSchedReconActivities · d4 · دیکشنری فعالیت‌های بازسازی‌شده
IF OBJECT_ID('dbo.PmisSchedReconActivities', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconActivities] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [ActivityId] NVARCHAR(80) NOT NULL,
  [WbsMapCode] NVARCHAR(40) NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [ActivityType] NVARCHAR(20) NULL DEFAULT 'task',
  [PlannedStart] DATE NULL,
  [PlannedFinish] DATE NULL,
  [ActualStart] DATE NULL,
  [ActualFinish] DATE NULL,
  [OriginalDuration] DECIMAL(10,2) NULL,
  [ActualDuration] DECIMAL(10,2) NULL,
  [PctComplete] DECIMAL(5,2) NULL,
  [StatusFlag] NVARCHAR(20) NOT NULL DEFAULT 'not_started',
  [SourceRef] NVARCHAR(300) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconActivities] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconActivities_Code] ON [dbo].[PmisSchedReconActivities] ([ProjectId], [MissionCode], [Code]);
CREATE INDEX [IX_PmisSchedReconActivities_Activity] ON [dbo].[PmisSchedReconActivities] ([ProjectId], [MissionCode], [ActivityId]);
GO

-- PmisSchedReconCalendars · d4 · تقویم‌های کاری بازسازی‌شده، شیفت‌ها و تعلیق‌های جوی
IF OBJECT_ID('dbo.PmisSchedReconCalendars', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconCalendars] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [BaseKind] NVARCHAR(30) NOT NULL,
  [DaysPerWeek] INT NULL,
  [HoursPerDay] DECIMAL(5,2) NULL,
  [ShiftDefJson] NVARCHAR(MAX) NULL,
  [ExceptionsJson] NVARCHAR(MAX) NULL,
  [ValidFrom] DATE NULL,
  [ValidTo] DATE NULL,
  [SourceRef] NVARCHAR(300) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconCalendars] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconCalendars_Code] ON [dbo].[PmisSchedReconCalendars] ([ProjectId], [MissionCode], [Code]);
GO

-- PmisSchedReconDurations · d4 · مدت‌های واقعی بازسازی‌شده در برابر برنامه‌ای
IF OBJECT_ID('dbo.PmisSchedReconDurations', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconDurations] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [ActivityCode] NVARCHAR(40) NOT NULL,
  [PlannedDuration] DECIMAL(10,2) NULL,
  [ObservedDuration] DECIMAL(10,2) NULL,
  [Deviation] DECIMAL(10,2) NULL,
  [Method] NVARCHAR(20) NOT NULL,
  [EvidenceRefs] NVARCHAR(MAX) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'estimated',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconDurations] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconDurations_Activity] ON [dbo].[PmisSchedReconDurations] ([ProjectId], [MissionCode], [ActivityCode]);
GO

-- PmisSchedReconLogic · d4 · منطق شبکهٔ بازسازی‌شده؛ روابط FS/SS/FF/SF و Lag/Lead
IF OBJECT_ID('dbo.PmisSchedReconLogic', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconLogic] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [PredecessorCode] NVARCHAR(40) NOT NULL,
  [SuccessorCode] NVARCHAR(40) NOT NULL,
  [RelType] NVARCHAR(4) NOT NULL,
  [Lag] DECIMAL(10,2) NULL DEFAULT 0,
  [LagUnit] NVARCHAR(5) NULL DEFAULT 'd',
  [ReconstructionBasis] NVARCHAR(30) NOT NULL,
  [EvidenceRef] NVARCHAR(300) NULL,
  [Confidence] DECIMAL(5,2) NULL,
  [Flag] NVARCHAR(10) NOT NULL DEFAULT 'normal',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconLogic] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconLogic_Code] ON [dbo].[PmisSchedReconLogic] ([ProjectId], [MissionCode], [Code]);
CREATE INDEX [IX_PmisSchedReconLogic_Pred] ON [dbo].[PmisSchedReconLogic] ([ProjectId], [MissionCode], [PredecessorCode]);
GO

-- PmisSchedReconCriticalPaths · d4 · ردیابی تغییرات مسیر بحرانی در مقاطع زمانی
IF OBJECT_ID('dbo.PmisSchedReconCriticalPaths', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconCriticalPaths] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [SnapshotCode] NVARCHAR(40) NOT NULL,
  [PathRank] INT NULL DEFAULT 1,
  [ActivityCodes] NVARCHAR(MAX) NULL,
  [TotalDuration] DECIMAL(10,2) NULL,
  [DrivingLogic] NVARCHAR(MAX) NULL,
  [ChangeKind] NVARCHAR(20) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconCriticalPaths] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconCriticalPaths_Code] ON [dbo].[PmisSchedReconCriticalPaths] ([ProjectId], [MissionCode], [Code]);
CREATE INDEX [IX_PmisSchedReconCriticalPaths_Snapshot] ON [dbo].[PmisSchedReconCriticalPaths] ([ProjectId], [MissionCode], [SnapshotCode]);
GO

-- PmisSchedReconSnapshots · d4 · مقاطع زمانی و قطع‌های دوره‌ای (Cut-Off Dates)
IF OBJECT_ID('dbo.PmisSchedReconSnapshots', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconSnapshots] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [LabelFa] NVARCHAR(300) NOT NULL,
  [CutoffDate] DATE NOT NULL,
  [DataKind] NVARCHAR(20) NULL,
  [SourceRefs] NVARCHAR(MAX) NULL,
  [MetricsJson] NVARCHAR(MAX) NULL,
  [Status] NVARCHAR(10) NOT NULL DEFAULT 'open',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconSnapshots] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconSnapshots_Code] ON [dbo].[PmisSchedReconSnapshots] ([ProjectId], [MissionCode], [Code]);
GO

-- PmisSchedReconValidations · d4 · یافته‌های اعتبارسنجی مدل زمان‌بندی
IF OBJECT_ID('dbo.PmisSchedReconValidations', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconValidations] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [SnapshotCode] NVARCHAR(40) NULL,
  [CheckKind] NVARCHAR(30) NOT NULL,
  [Severity] NVARCHAR(10) NOT NULL,
  [ActivityCode] NVARCHAR(40) NULL,
  [DetailFa] NVARCHAR(2000) NULL,
  [AutoDetected] BIT NULL,
  [Resolution] NVARCHAR(20) NOT NULL DEFAULT 'open',
  [ResolvedBy] NVARCHAR(60) NULL,
  [ResolvedAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconValidations] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconValidations_Code] ON [dbo].[PmisSchedReconValidations] ([ProjectId], [MissionCode], [Code]);
CREATE INDEX [IX_PmisSchedReconValidations_Kind] ON [dbo].[PmisSchedReconValidations] ([ProjectId], [MissionCode], [CheckKind]);
GO

-- PmisSchedReconMipMappings · d4 · تطبیق دادهٔ بازسازی با پروتکل‌های AACE 29R-03 (MIP 3.1..3.9)
IF OBJECT_ID('dbo.PmisSchedReconMipMappings', 'U') IS NULL
CREATE TABLE [dbo].[PmisSchedReconMipMappings] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [MipCode] NVARCHAR(5) NOT NULL,
  [Family] NVARCHAR(20) NULL,
  [Feasibility] NVARCHAR(20) NULL,
  [FeasibilityReasonFa] NVARCHAR(2000) NULL,
  [RequiredDataJson] NVARCHAR(MAX) NULL,
  [ProvidedDataJson] NVARCHAR(MAX) NULL,
  [SelectedFlag] BIT NULL,
  [SelectedBy] NVARCHAR(60) NULL,
  [SelectedAt] DATETIME2 NULL,
  [OutputTableRefs] NVARCHAR(MAX) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisSchedReconMipMappings] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisSchedReconMipMappings_Mip] ON [dbo].[PmisSchedReconMipMappings] ([ProjectId], [MissionCode], [MipCode]);
GO

-- PmisDisputeCases · d4 · پرونده اختلاف
IF OBJECT_ID('dbo.PmisDisputeCases', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeCases] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [SubjectCode] NVARCHAR(30) NOT NULL,
  [DescriptionFa] NVARCHAR(2000) NULL,
  [EmployerFa] NVARCHAR(300) NULL,
  [ContractorFa] NVARCHAR(300) NULL,
  [ConsultantFa] NVARCHAR(300) NULL,
  [CourtRefFa] NVARCHAR(300) NULL,
  [ExpertScopeFa] NVARCHAR(2000) NULL,
  [ClaimDescriptionFa] NVARCHAR(2000) NULL,
  [ClaimedAmount] DECIMAL(20,2) NULL,
  [Currency] NVARCHAR(10) NULL DEFAULT 'IRR',
  [ClaimedDelayDays] INT NULL,
  [ContractCode] NVARCHAR(60) NULL,
  [ClaimCode] NVARCHAR(40) NULL,
  [DelayEventCode] NVARCHAR(40) NULL,
  [DelayCaseId] NVARCHAR(60) NULL,
  [LossCaseId] NVARCHAR(60) NULL,
  [ContractRiskId] NVARCHAR(60) NULL,
  [IncidentDate] DATE NULL,
  [RegistrationDate] DATE NULL,
  [ResponseDeadline] DATE NULL,
  [DeliveryDeadline] DATE NULL,
  [Priority] NVARCHAR(10) NULL DEFAULT 'normal',
  [InternalOwnerFa] NVARCHAR(200) NULL,
  [Status] NVARCHAR(25) NOT NULL DEFAULT 'draft',
  [StatusChangedBy] NVARCHAR(60) NULL,
  [StatusChangedAt] DATETIME2 NULL,
  [StatusNoteFa] NVARCHAR(1000) NULL,
  [ExpertNoteFa] NVARCHAR(2000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeCases] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeCases_Code] ON [dbo].[PmisDisputeCases] ([ProjectId], [Code]);
CREATE INDEX [IX_PmisDisputeCases_Status] ON [dbo].[PmisDisputeCases] ([ProjectId], [Status]);
CREATE INDEX [IX_PmisDisputeCases_Contract] ON [dbo].[PmisDisputeCases] ([ProjectId], [ContractCode]);
GO

-- PmisDisputeParties · d4 · طرفین و نمایندگان پرونده
IF OBJECT_ID('dbo.PmisDisputeParties', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeParties] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [Role] NVARCHAR(20) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [OrgInfoFa] NVARCHAR(1000) NULL,
  [RepresentativeFa] NVARCHAR(300) NULL,
  [ContactInfo] NVARCHAR(500) NULL,
  [ClaimLinkNoteFa] NVARCHAR(500) NULL,
  [Status] NVARCHAR(20) NULL DEFAULT 'active',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeParties] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeParties_Code] ON [dbo].[PmisDisputeParties] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeParties_Case] ON [dbo].[PmisDisputeParties] ([ProjectId], [CaseCode]);
GO

-- PmisDisputeClaims · d4 · ادعای پرونده
IF OBJECT_ID('dbo.PmisDisputeClaims', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeClaims] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [DemandFa] NVARCHAR(1000) NULL,
  [ClaimantPartyCode] NVARCHAR(40) NOT NULL,
  [BasisKind] NVARCHAR(15) NOT NULL,
  [ClaimedAmount] DECIMAL(20,2) NULL,
  [Currency] NVARCHAR(10) NULL DEFAULT 'IRR',
  [ClaimedDelayDays] INT NULL,
  [ContractClauseRef] NVARCHAR(200) NULL,
  [EventRefs] NVARCHAR(MAX) NULL,
  [EvidenceRefs] NVARCHAR(MAX) NULL,
  [ResponseFa] NVARCHAR(2000) NULL,
  [AgreementsFa] NVARCHAR(1000) NULL,
  [DisagreementsFa] NVARCHAR(1000) NULL,
  [EvidenceSufficiency] NVARCHAR(15) NULL DEFAULT 'unchecked',
  [ContradictionsFa] NVARCHAR(1000) NULL,
  [QuestionsJson] NVARCHAR(MAX) NULL,
  [ReviewedAmount] DECIMAL(20,2) NULL,
  [ReviewBasisFa] NVARCHAR(1000) NULL,
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATETIME2 NULL,
  [ApprovedAmount] DECIMAL(20,2) NULL,
  [ApprovedBasisFa] NVARCHAR(1000) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ReviewResultFa] NVARCHAR(1000) NULL,
  [ReviewStatus] NVARCHAR(20) NULL DEFAULT 'open',
  [ExpertNoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeClaims] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeClaims_Code] ON [dbo].[PmisDisputeClaims] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeClaims_Case] ON [dbo].[PmisDisputeClaims] ([ProjectId], [CaseCode]);
GO

-- PmisDisputeResponses · d4 · پاسخ و دفاعیه طرف مقابل
IF OBJECT_ID('dbo.PmisDisputeResponses', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeResponses] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [ClaimCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [ResponderPartyCode] NVARCHAR(40) NOT NULL,
  [BodyFa] NVARCHAR(2000) NOT NULL,
  [EvidenceRefs] NVARCHAR(MAX) NULL,
  [ReceivedAt] DATE NULL,
  [DocumentId] NVARCHAR(60) NULL,
  [AssessmentFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NULL DEFAULT 'received',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeResponses] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeResponses_Code] ON [dbo].[PmisDisputeResponses] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeResponses_Claim] ON [dbo].[PmisDisputeResponses] ([ProjectId], [CaseCode], [ClaimCode]);
GO

-- PmisDisputeEvidence · d4 · مدرک/سند پرونده
IF OBJECT_ID('dbo.PmisDisputeEvidence', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeEvidence] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [DocType] NVARCHAR(20) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [DocumentId] NVARCHAR(60) NULL,
  [DocNo] NVARCHAR(100) NULL,
  [Revision] NVARCHAR(20) NULL,
  [IssuedAt] DATE NULL,
  [ReceivedAt] DATE NULL,
  [SenderFa] NVARCHAR(200) NULL,
  [ReceiverFa] NVARCHAR(200) NULL,
  [ContractClauseRef] NVARCHAR(200) NULL,
  [ClaimRefs] NVARCHAR(MAX) NULL,
  [EventRefs] NVARCHAR(MAX) NULL,
  [CalculationRefs] NVARCHAR(MAX) NULL,
  [ExpertNoteFa] NVARCHAR(1000) NULL,
  [ReviewStatus] NVARCHAR(20) NULL DEFAULT 'pending',
  [AuthenticityStatus] NVARCHAR(15) NULL DEFAULT 'pending',
  [SufficiencyStatus] NVARCHAR(15) NULL DEFAULT 'unchecked',
  [DeficiencyNoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeEvidence] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeEvidence_Code] ON [dbo].[PmisDisputeEvidence] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeEvidence_Case] ON [dbo].[PmisDisputeEvidence] ([ProjectId], [CaseCode]);
GO

-- PmisDisputeAnalyses · d4 · تحلیل کارشناسی
IF OBJECT_ID('dbo.PmisDisputeAnalyses', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeAnalyses] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TopicFa] NVARCHAR(400) NOT NULL,
  [QuestionFa] NVARCHAR(1000) NOT NULL,
  [InputDataJson] NVARCHAR(MAX) NULL,
  [EvidenceRefs] NVARCHAR(MAX) NULL,
  [MethodFa] NVARCHAR(1000) NOT NULL,
  [AssumptionsFa] NVARCHAR(1000) NULL,
  [CalculationsFa] NVARCHAR(2000) NULL,
  [ResultsFa] NVARCHAR(2000) NULL,
  [UncertaintiesFa] NVARCHAR(1000) NULL,
  [InfoGapsFa] NVARCHAR(1000) NULL,
  [MethodLimitsFa] NVARCHAR(1000) NULL,
  [SuggestedConclusionFa] NVARCHAR(2000) NULL,
  [AnalyzedBy] NVARCHAR(60) NULL,
  [AnalyzedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ApprovalStatus] NVARCHAR(20) NULL DEFAULT 'draft',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeAnalyses] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeAnalyses_Code] ON [dbo].[PmisDisputeAnalyses] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeAnalyses_Case] ON [dbo].[PmisDisputeAnalyses] ([ProjectId], [CaseCode]);
GO

-- PmisDisputeCalculations · d4 · محاسبه مستقل کارشناسی برای مقایسه
IF OBJECT_ID('dbo.PmisDisputeCalculations', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeCalculations] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [PurposeFa] NVARCHAR(1000) NULL,
  [MethodFa] NVARCHAR(1000) NOT NULL,
  [InputsJson] NVARCHAR(MAX) NULL,
  [ResultAmount] DECIMAL(20,2) NULL,
  [Currency] NVARCHAR(10) NULL,
  [ResultBaseDate] DATE NULL,
  [DataSourceFa] NVARCHAR(1000) NULL,
  [ComparedWithClaimCode] NVARCHAR(40) NULL,
  [VarianceNoteFa] NVARCHAR(1000) NULL,
  [CalculatedBy] NVARCHAR(60) NULL,
  [CalculatedAt] DATETIME2 NULL,
  [ReviewedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NULL DEFAULT 'draft',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeCalculations] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeCalculations_Code] ON [dbo].[PmisDisputeCalculations] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeCalculations_Case] ON [dbo].[PmisDisputeCalculations] ([ProjectId], [CaseCode]);
GO

-- PmisDisputeHearings · d4 · جلسه و صورت‌جلسه
IF OBJECT_ID('dbo.PmisDisputeHearings', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeHearings] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [MeetingDate] DATE NOT NULL,
  [LocationFa] NVARCHAR(200) NULL,
  [AttendeesJson] NVARCHAR(MAX) NULL,
  [TopicsJson] NVARCHAR(MAX) NULL,
  [QuestionsJson] NVARCHAR(MAX) NULL,
  [ResponsesJson] NVARCHAR(MAX) NULL,
  [DocsShownJson] NVARCHAR(MAX) NULL,
  [QuestionDeadline] DATE NULL,
  [MinutesBodyFa] NVARCHAR(4000) NULL,
  [MinutesDocumentId] NVARCHAR(60) NULL,
  [MinutesStatus] NVARCHAR(20) NULL DEFAULT 'draft',
  [SignedAt] DATE NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeHearings] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeHearings_Code] ON [dbo].[PmisDisputeHearings] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeHearings_Case] ON [dbo].[PmisDisputeHearings] ([ProjectId], [CaseCode]);
GO

-- PmisDisputeOpinions · d4 · نظریه کارشناسی
IF OBJECT_ID('dbo.PmisDisputeOpinions', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeOpinions] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [BodyFa] NVARCHAR(4000) NOT NULL,
  [SourcesJson] NVARCHAR(MAX) NULL,
  [Version] INT NOT NULL DEFAULT 1,
  [PreviousVersionCode] NVARCHAR(40) NULL,
  [SupplementaryNoteFa] NVARCHAR(2000) NULL,
  [AuthoredBy] NVARCHAR(60) NULL,
  [AuthoredAt] DATETIME2 NULL,
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewStatus] NVARCHAR(20) NULL DEFAULT 'draft',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeOpinions] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeOpinions_Code] ON [dbo].[PmisDisputeOpinions] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeOpinions_Case] ON [dbo].[PmisDisputeOpinions] ([ProjectId], [CaseCode]);
GO

-- PmisDisputeReports · d4 · نسخهٔ گزارش کارشناسی
IF OBJECT_ID('dbo.PmisDisputeReports', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeReports] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Version] INT NOT NULL DEFAULT 1,
  [PreviousVersionCode] NVARCHAR(40) NULL,
  [EnabledSectionsJson] NVARCHAR(MAX) NULL,
  [GeneratedAt] DATETIME2 NULL,
  [GeneratedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(15) NOT NULL DEFAULT 'draft',
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [IssuedAt] DATETIME2 NULL,
  [IssuedBy] NVARCHAR(60) NULL,
  [DataVersionNoteFa] NVARCHAR(500) NULL,
  [WordFileRef] NVARCHAR(300) NULL,
  [PdfFileRef] NVARCHAR(300) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeReports] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeReports_Code] ON [dbo].[PmisDisputeReports] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeReports_Case] ON [dbo].[PmisDisputeReports] ([ProjectId], [CaseCode], [Status]);
GO

-- PmisDisputeDeadlines · d4 · ارجاع و مهلت
IF OBJECT_ID('dbo.PmisDisputeDeadlines', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeDeadlines] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Kind] NVARCHAR(25) NOT NULL,
  [DueDate] DATE NOT NULL,
  [OwnerPartyCode] NVARCHAR(40) NULL,
  [RelatedCode] NVARCHAR(40) NULL,
  [Status] NVARCHAR(15) NULL DEFAULT 'open',
  [MetAt] DATE NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeDeadlines] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeDeadlines_Code] ON [dbo].[PmisDisputeDeadlines] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeDeadlines_Due] ON [dbo].[PmisDisputeDeadlines] ([ProjectId], [Status], [DueDate]);
GO

-- PmisDisputeModuleLinks · d4 · پیوند نرم به ماژول/پرونده بیرونی
IF OBJECT_ID('dbo.PmisDisputeModuleLinks', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeModuleLinks] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [LinkKind] NVARCHAR(25) NOT NULL,
  [TargetCode] NVARCHAR(80) NOT NULL,
  [TargetTitleFa] NVARCHAR(400) NOT NULL,
  [TargetId] NVARCHAR(60) NULL,
  [ConsistencyCheckFa] NVARCHAR(1000) NULL,
  [QuestionSentFa] NVARCHAR(1000) NULL,
  [CorrectionRequestFa] NVARCHAR(1000) NULL,
  [EstablishedBy] NVARCHAR(60) NULL,
  [EstablishedAt] DATETIME2 NULL,
  [Status] NVARCHAR(20) NULL DEFAULT 'active',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeModuleLinks] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisDisputeModuleLinks_Code] ON [dbo].[PmisDisputeModuleLinks] ([ProjectId], [CaseCode], [Code]);
CREATE INDEX [IX_PmisDisputeModuleLinks_Case] ON [dbo].[PmisDisputeModuleLinks] ([ProjectId], [CaseCode]);
GO

-- PmisDisputeAuditTrail · d4 · رویداد تاریخچهٔ پرونده
IF OBJECT_ID('dbo.PmisDisputeAuditTrail', 'U') IS NULL
CREATE TABLE [dbo].[PmisDisputeAuditTrail] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CaseCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [Action] NVARCHAR(40) NOT NULL,
  [Actor] NVARCHAR(60) NOT NULL,
  [DetailFa] NVARCHAR(1000) NULL,
  [FromValue] NVARCHAR(200) NULL,
  [ToValue] NVARCHAR(200) NULL,
  [OccurredAt] DATETIME2 NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisDisputeAuditTrail] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_PmisDisputeAuditTrail_Case] ON [dbo].[PmisDisputeAuditTrail] ([ProjectId], [CaseCode], [OccurredAt]);
GO

-- PmisChangeRequests · d4 · درخواست تغییر (چرخهٔ کامل)
IF OBJECT_ID('dbo.PmisChangeRequests', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeRequests] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [ContractCode] NVARCHAR(60) NULL,
  [DescriptionFa] NVARCHAR(4000) NULL,
  [RequestedBy] NVARCHAR(60) NOT NULL,
  [RequestedByRoleCode] NVARCHAR(30) NULL,
  [RequestDate] DATE NULL,
  [ChangeType] NVARCHAR(30) NULL,
  [ReasonFa] NVARCHAR(2000) NULL,
  [NecessityFa] NVARCHAR(2000) NULL,
  [AffectedScopeFa] NVARCHAR(2000) NULL,
  [WbsRefs] NVARCHAR(MAX) NULL,
  [ActivityRefs] NVARCHAR(MAX) NULL,
  [SupportDocRefs] NVARCHAR(MAX) NULL,
  [ClauseRefs] NVARCHAR(MAX) NULL,
  [OptionsJson] NVARCHAR(MAX) NULL,
  [InitialCostEstimate] DECIMAL(20,2) NULL,
  [Currency] NVARCHAR(10) NULL DEFAULT 'IRR',
  [InitialTimeImpactDays] INT NULL,
  [InitialRisksJson] NVARCHAR(MAX) NULL,
  [Priority] NVARCHAR(10) NULL DEFAULT 'normal',
  [ReviewOwnerFa] NVARCHAR(200) NULL,
  [ReviewDueDate] DATE NULL,
  [Status] NVARCHAR(30) NOT NULL DEFAULT 'draft',
  [StatusChangedBy] NVARCHAR(60) NULL,
  [StatusChangedAt] DATETIME2 NULL,
  [StatusNoteFa] NVARCHAR(1000) NULL,
  [DecisionFa] NVARCHAR(2000) NULL,
  [RejectionReasonFa] NVARCHAR(2000) NULL,
  [DecidedBy] NVARCHAR(60) NULL,
  [DecidedAt] DATETIME2 NULL,
  [ClosedAt] DATETIME2 NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeRequests] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeRequests_Code] ON [dbo].[PmisChangeRequests] ([ProjectId], [Code]);
CREATE INDEX [IX_PmisChangeRequests_Status] ON [dbo].[PmisChangeRequests] ([ProjectId], [Status]);
CREATE INDEX [IX_PmisChangeRequests_Contract] ON [dbo].[PmisChangeRequests] ([ProjectId], [ContractCode]);
GO

-- PmisChangeImpacts · d4 · بررسی فنی/مهندسی اثر تغییر
IF OBJECT_ID('dbo.PmisChangeImpacts', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeImpacts] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ChangeCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TopicFa] NVARCHAR(400) NOT NULL,
  [Aspect] NVARCHAR(20) NULL,
  [AffectedItemsJson] NVARCHAR(MAX) NULL,
  [ConclusionFa] NVARCHAR(2000) NOT NULL,
  [AssumptionsFa] NVARCHAR(2000) NULL,
  [LimitationsFa] NVARCHAR(2000) NULL,
  [AnalyzedBy] NVARCHAR(60) NULL,
  [AnalyzedAt] DATETIME2 NULL,
  [ReviewStatus] NVARCHAR(15) NULL DEFAULT 'draft',
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATETIME2 NULL,
  [ReviewNoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeImpacts] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeImpacts_Code] ON [dbo].[PmisChangeImpacts] ([ProjectId], [ChangeCode], [Code]);
GO

-- PmisChangeCostEstimates · d4 · برآورد هزینهٔ لایه‌ای تغییر
IF OBJECT_ID('dbo.PmisChangeCostEstimates', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeCostEstimates] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ChangeCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [Layer] NVARCHAR(15) NOT NULL,
  [Amount] DECIMAL(20,2) NOT NULL,
  [Currency] NVARCHAR(10) NULL DEFAULT 'IRR',
  [FormulaFa] NVARCHAR(1000) NOT NULL,
  [UnitFa] NVARCHAR(60) NULL,
  [InputDataJson] NVARCHAR(MAX) NULL,
  [SourceFa] NVARCHAR(400) NOT NULL,
  [BasisDate] DATE NOT NULL,
  [DirectAmount] DECIMAL(20,2) NULL,
  [IndirectAmount] DECIMAL(20,2) NULL,
  [TimeRelatedAmount] DECIMAL(20,2) NULL,
  [ScopeNoteFa] NVARCHAR(1000) NULL,
  [PreparedBy] NVARCHAR(60) NULL,
  [PreparedAt] DATETIME2 NULL,
  [ReviewStatus] NVARCHAR(15) NULL DEFAULT 'draft',
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATETIME2 NULL,
  [ReviewNoteFa] NVARCHAR(1000) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeCostEstimates] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeCostEstimates_Code] ON [dbo].[PmisChangeCostEstimates] ([ProjectId], [ChangeCode], [Code]);
CREATE INDEX [IX_PmisChangeCostEstimates_Layer] ON [dbo].[PmisChangeCostEstimates] ([ProjectId], [Layer]);
GO

-- PmisChangeScheduleImpacts · d4 · تحلیل اثر تغییر بر زمان‌بندی
IF OBJECT_ID('dbo.PmisChangeScheduleImpacts', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeScheduleImpacts] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ChangeCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [BaselineVersionRef] NVARCHAR(80) NULL,
  [MethodFa] NVARCHAR(400) NOT NULL,
  [AffectedActivitiesJson] NVARCHAR(MAX) NULL,
  [CriticalPathEffect] NVARCHAR(20) NULL,
  [FloatEffectDays] INT NULL,
  [EstimatedDurationDeltaDays] INT NULL,
  [CompletionEffectDays] INT NULL,
  [ApprovedEotDays] INT NULL,
  [EotEntitlementFa] NVARCHAR(2000) NULL,
  [AssumptionsFa] NVARCHAR(2000) NOT NULL,
  [LimitationsFa] NVARCHAR(2000) NULL,
  [DataVersionNoteFa] NVARCHAR(400) NULL,
  [PreparedBy] NVARCHAR(60) NULL,
  [PreparedAt] DATETIME2 NULL,
  [ReviewStatus] NVARCHAR(15) NULL DEFAULT 'draft',
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATETIME2 NULL,
  [ReviewNoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeScheduleImpacts] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeScheduleImpacts_Code] ON [dbo].[PmisChangeScheduleImpacts] ([ProjectId], [ChangeCode], [Code]);
GO

-- PmisChangeApprovals · d4 · گام تصویب گردش‌کار
IF OBJECT_ID('dbo.PmisChangeApprovals', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeApprovals] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ChangeCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [StepCode] NVARCHAR(40) NOT NULL,
  [Stage] NVARCHAR(20) NULL,
  [Decision] NVARCHAR(25) NULL DEFAULT 'pending',
  [DecidedBy] NVARCHAR(60) NULL,
  [DecidedAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [ConditionsFa] NVARCHAR(2000) NULL,
  [Sequence] INT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeApprovals] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeApprovals_Code] ON [dbo].[PmisChangeApprovals] ([ProjectId], [ChangeCode], [Code]);
GO

-- PmisChangeRiskLinks · d4 · پیوند ریسکِ ناشی از تغییر
IF OBJECT_ID('dbo.PmisChangeRiskLinks', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeRiskLinks] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ChangeCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [LinkType] NVARCHAR(15) NOT NULL,
  [DescriptionFa] NVARCHAR(2000) NOT NULL,
  [RiskRegisterRef] NVARCHAR(60) NULL,
  [Probability] INT NULL,
  [Severity] INT NULL,
  [Score] INT NULL,
  [MethodFa] NVARCHAR(400) NULL,
  [OwnerFa] NVARCHAR(200) NULL,
  [ControlActionsJson] NVARCHAR(MAX) NULL,
  [ActionDueDate] DATE NULL,
  [ResidualNoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeRiskLinks] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeRiskLinks_Code] ON [dbo].[PmisChangeRiskLinks] ([ProjectId], [ChangeCode], [Code]);
GO

-- PmisChangeClaimLinks · d4 · ادعا/اختلاف مرتبط با تغییر
IF OBJECT_ID('dbo.PmisChangeClaimLinks', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeClaimLinks] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ChangeCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [LinkType] NVARCHAR(30) NOT NULL,
  [DescriptionFa] NVARCHAR(2000) NOT NULL,
  [ClaimRefCode] NVARCHAR(40) NULL,
  [ExpertCaseRef] NVARCHAR(40) NULL,
  [CorrespondenceJson] NVARCHAR(MAX) NULL,
  [SupportingDocRefsJson] NVARCHAR(MAX) NULL,
  [Status] NVARCHAR(20) NULL DEFAULT 'open',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeClaimLinks] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeClaimLinks_Code] ON [dbo].[PmisChangeClaimLinks] ([ProjectId], [ChangeCode], [Code]);
GO

-- PmisChangeDocuments · d4 · سند پشتیبان تغییر
IF OBJECT_ID('dbo.PmisChangeDocuments', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeDocuments] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ChangeCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Kind] NVARCHAR(20) NOT NULL,
  [DocNo] NVARCHAR(60) NULL,
  [DocRef] NVARCHAR(80) NULL,
  [VersionFa] NVARCHAR(60) NULL,
  [DocDate] DATE NULL,
  [FileRef] NVARCHAR(200) NULL,
  [FileNameFa] NVARCHAR(300) NULL,
  [MimeType] NVARCHAR(100) NULL,
  [SizeBytes] INT NULL,
  [Sha256] NVARCHAR(64) NULL,
  [UploadedBy] NVARCHAR(60) NULL,
  [UploadedAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeDocuments] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeDocuments_Code] ON [dbo].[PmisChangeDocuments] ([ProjectId], [ChangeCode], [Code]);
GO

-- PmisChangeImplementation · d4 · کنترل اجرای تغییر مصوب
IF OBJECT_ID('dbo.PmisChangeImplementation', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeImplementation] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ChangeCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [Step] NVARCHAR(30) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [BaselineUpdateRef] NVARCHAR(80) NULL,
  [ExecutionResultFa] NVARCHAR(2000) NULL,
  [VerifiedBy] NVARCHAR(60) NULL,
  [VerifiedAt] DATETIME2 NULL,
  [VerifiedNoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeImplementation] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeImplementation_Code] ON [dbo].[PmisChangeImplementation] ([ProjectId], [ChangeCode], [Code]);
GO

-- PmisChangeAuditTrail · d4 · رویداد تاریخچهٔ تغییر
IF OBJECT_ID('dbo.PmisChangeAuditTrail', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeAuditTrail] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ChangeCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [Action] NVARCHAR(40) NOT NULL,
  [Actor] NVARCHAR(60) NOT NULL,
  [DetailFa] NVARCHAR(1000) NULL,
  [FromValue] NVARCHAR(200) NULL,
  [ToValue] NVARCHAR(200) NULL,
  [OccurredAt] DATETIME2 NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeAuditTrail] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_PmisChangeAuditTrail_Change] ON [dbo].[PmisChangeAuditTrail] ([ProjectId], [ChangeCode], [OccurredAt]);
GO

-- PmisChangeModuleLinks · d4 · پیوند نرم تغییر به ماژول‌ها
IF OBJECT_ID('dbo.PmisChangeModuleLinks', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeModuleLinks] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ChangeCode] NVARCHAR(40) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [LinkKind] NVARCHAR(30) NOT NULL,
  [TargetCode] NVARCHAR(80) NOT NULL,
  [TargetTitleFa] NVARCHAR(400) NOT NULL,
  [TargetId] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [EstablishedBy] NVARCHAR(60) NULL,
  [EstablishedAt] DATETIME2 NULL,
  [Status] NVARCHAR(20) NULL DEFAULT 'active',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeModuleLinks] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeModuleLinks_Code] ON [dbo].[PmisChangeModuleLinks] ([ProjectId], [ChangeCode], [Code]);
GO

-- PmisChangeSettings · d4 · تنظیمات گردش‌کار تغییر
IF OBJECT_ID('dbo.PmisChangeSettings', 'U') IS NULL
CREATE TABLE [dbo].[PmisChangeSettings] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SettingKey] NVARCHAR(60) NOT NULL,
  [SettingValueJson] NVARCHAR(MAX) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmisChangeSettings] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmisChangeSettings_Key] ON [dbo].[PmisChangeSettings] ([ProjectId], [SettingKey]);
GO

-- CostAccount · d5 · حساب هزینه
IF OBJECT_ID('dbo.CostAccount', 'U') IS NULL
CREATE TABLE [dbo].[CostAccount] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [Budget] DECIMAL(18,2) NOT NULL,
  [Committed] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [Actual] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [Currency] NVARCHAR(10) NULL DEFAULT 'IRR',
  [ParentCode] NVARCHAR(40) NULL,
  [Kind] NVARCHAR(20) NULL,
  [Category] NVARCHAR(20) NULL,
  [ProgressPct] DECIMAL(5,2) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CostAccount] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CostAccount_Code] ON [dbo].[CostAccount] ([ProjectId], [Code]);
GO

-- PaymentCertificate · d5 · صورت‌وضعیت
IF OBJECT_ID('dbo.PaymentCertificate', 'U') IS NULL
CREATE TABLE [dbo].[PaymentCertificate] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SerialNo] INT NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [GrossAmount] DECIMAL(18,2) NOT NULL,
  [Deductions] DECIMAL(18,2) NULL DEFAULT 0,
  [NetAmount] DECIMAL(18,2) NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [PreparedBy] NVARCHAR(60) NOT NULL,
  [PreparedAt] DATETIME2 NOT NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PaymentCertificate] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PaymentCertificate] ON [dbo].[PaymentCertificate] ([ProjectId], [SerialNo]);
GO

-- PurchaseRequisition · d5 · درخواست خرید
IF OBJECT_ID('dbo.PurchaseRequisition', 'U') IS NULL
CREATE TABLE [dbo].[PurchaseRequisition] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [MrCode] NVARCHAR(40) NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Discipline] NVARCHAR(40) NULL,
  [RequestedBy] NVARCHAR(60) NOT NULL,
  [RequestedAt] DATE NOT NULL,
  [NeedByDate] DATE NULL,
  [EstimatedAmount] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(10) NULL,
  [CostAccountCode] NVARCHAR(40) NULL,
  [BudgetStatus] NVARCHAR(30) NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [RemarksFa] NVARCHAR(1000) NULL,
  [Quantity] DECIMAL(18,3) NULL,
  [Unit] NVARCHAR(20) NULL,
  [IsUrgent] BIT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PurchaseRequisition] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PurchaseRequisition] ON [dbo].[PurchaseRequisition] ([ProjectId], [Code]);
CREATE INDEX [IX_PurchaseRequisition_Mr] ON [dbo].[PurchaseRequisition] ([ProjectId], [MrCode]);
GO

-- PurchaseOrder · d5 · سفارش خرید
IF OBJECT_ID('dbo.PurchaseOrder', 'U') IS NULL
CREATE TABLE [dbo].[PurchaseOrder] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PoNo] NVARCHAR(40) NOT NULL,
  [PrCode] NVARCHAR(40) NULL,
  [VendorName] NVARCHAR(200) NOT NULL,
  [VendorCode] NVARCHAR(40) NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Discipline] NVARCHAR(40) NULL,
  [IssuedAt] DATE NOT NULL,
  [PromisedDate] DATE NULL,
  [Amount] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(10) NULL,
  [CostAccountCode] NVARCHAR(40) NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [ClosedAt] DATETIME2 NULL,
  [RemarksFa] NVARCHAR(1000) NULL,
  [Quantity] DECIMAL(18,3) NULL,
  [Unit] NVARCHAR(20) NULL,
  [UnitPrice] DECIMAL(18,2) NULL,
  [ReceivedQty] DECIMAL(18,3) NULL,
  [InvoicedQty] DECIMAL(18,3) NULL,
  [InvoiceUnitPrice] DECIMAL(18,2) NULL,
  [PaidAmount] DECIMAL(18,2) NULL,
  [DeliveredDate] DATE NULL,
  [KpiOnTimePct] INT NULL,
  [KpiQualityPct] INT NULL,
  [KpiPricePct] INT NULL,
  [KpiResponsePct] INT NULL,
  [KpiHsePct] INT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PurchaseOrder] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PurchaseOrder] ON [dbo].[PurchaseOrder] ([ProjectId], [PoNo]);
CREATE INDEX [IX_PurchaseOrder_Pr] ON [dbo].[PurchaseOrder] ([ProjectId], [PrCode]);
GO

-- FinSetting · d5 · تنظیمات مالی پروژه
IF OBJECT_ID('dbo.FinSetting', 'U') IS NULL
CREATE TABLE [dbo].[FinSetting] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DataDate] DATE NOT NULL,
  [CurrentPeriod] INT NOT NULL,
  [PeriodCount] INT NOT NULL,
  [Curve] NVARCHAR(20) NULL,
  [Rates] NVARCHAR(MAX) NULL,
  [BillingMarkupPct] DECIMAL(6,2) NULL,
  [CollectionLagPeriods] INT NULL,
  [RetentionPct] DECIMAL(6,2) NULL,
  [AdvanceRecoveryPct] DECIMAL(6,2) NULL,
  [LegalDeductionPct] DECIMAL(6,2) NULL,
  [MrpHorizonDays] INT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_FinSetting] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_FinSetting] ON [dbo].[FinSetting] ([ProjectId]);
GO

-- CostTransaction · d5 · هزینهٔ واقعی
IF OBJECT_ID('dbo.CostTransaction', 'U') IS NULL
CREATE TABLE [dbo].[CostTransaction] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [CostAccountCode] NVARCHAR(40) NOT NULL,
  [DescriptionFa] NVARCHAR(400) NOT NULL,
  [Amount] DECIMAL(18,2) NOT NULL,
  [Currency] NVARCHAR(10) NOT NULL,
  [BaseAmount] DECIMAL(18,2) NOT NULL,
  [PeriodNo] INT NOT NULL,
  [TxnDate] DATE NULL,
  [SourceType] NVARCHAR(20) NOT NULL,
  [SourceRef] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CostTransaction] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CostTransaction] ON [dbo].[CostTransaction] ([ProjectId], [Code]);
CREATE INDEX [IX_CostTransaction_Account] ON [dbo].[CostTransaction] ([ProjectId], [CostAccountCode]);
GO

-- StockItem · d5 · کالای انبار
IF OBJECT_ID('dbo.StockItem', 'U') IS NULL
CREATE TABLE [dbo].[StockItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [Unit] NVARCHAR(20) NULL,
  [OnHand] DECIMAL(18,3) NOT NULL,
  [AvgDailyUse] DECIMAL(18,3) NOT NULL,
  [MaxDailyUse] DECIMAL(18,3) NOT NULL,
  [LeadTimeDays] INT NOT NULL,
  [UnitCost] DECIMAL(18,2) NOT NULL,
  [OnOrder] DECIMAL(18,3) NULL,
  [BatchNo] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_StockItem] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_StockItem] ON [dbo].[StockItem] ([ProjectId], [Code]);
GO

-- Receivable · d5 · مطالبه
IF OBJECT_ID('dbo.Receivable', 'U') IS NULL
CREATE TABLE [dbo].[Receivable] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [PartyFa] NVARCHAR(300) NOT NULL,
  [Amount] DECIMAL(18,2) NOT NULL,
  [Currency] NVARCHAR(10) NULL,
  [DueDate] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CollectedAt] DATE NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Receivable] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_Receivable] ON [dbo].[Receivable] ([ProjectId], [Code]);
GO

-- BudgetTransfer · d5 · جابه‌جایی بودجه
IF OBJECT_ID('dbo.BudgetTransfer', 'U') IS NULL
CREATE TABLE [dbo].[BudgetTransfer] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [FromCode] NVARCHAR(40) NOT NULL,
  [ToCode] NVARCHAR(40) NOT NULL,
  [Amount] DECIMAL(18,2) NOT NULL,
  [Authority] NVARCHAR(30) NOT NULL,
  [ReasonFa] NVARCHAR(1000) NULL,
  [ApprovedBy] NVARCHAR(60) NOT NULL,
  [ApprovedAt] DATETIME2 NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_BudgetTransfer] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_BudgetTransfer] ON [dbo].[BudgetTransfer] ([ProjectId], [Code]);
GO

-- Ncr · d8 · عدم انطباق
IF OBJECT_ID('dbo.Ncr', 'U') IS NULL
CREATE TABLE [dbo].[Ncr] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Severity] NVARCHAR(20) NOT NULL,
  [Discipline] NVARCHAR(40) NOT NULL,
  [RaisedBy] NVARCHAR(60) NOT NULL,
  [RaisedAt] DATE NOT NULL,
  [DueAt] DATE NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [ClosedAt] DATETIME2 NULL,
  [Disposition] NVARCHAR(40) NULL,
  [ActivityId] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Ncr] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_Ncr_Code] ON [dbo].[Ncr] ([ProjectId], [Code]);
CREATE INDEX [IX_Ncr_Open] ON [dbo].[Ncr] ([ProjectId], [Status], [Severity]);
CREATE INDEX [IX_Ncr_Activity] ON [dbo].[Ncr] ([ProjectId], [ActivityId], [Status]);
GO

-- InspectionRecord · d8 · گزارش بازرسی
IF OBJECT_ID('dbo.InspectionRecord', 'U') IS NULL
CREATE TABLE [dbo].[InspectionRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [ItpPointCode] NVARCHAR(40) NOT NULL,
  [ActivityId] NVARCHAR(60) NOT NULL,
  [InspectedAt] DATE NOT NULL,
  [Outcome] NVARCHAR(20) NOT NULL,
  [InspectedBy] NVARCHAR(60) NOT NULL,
  [WitnessedBy] NVARCHAR(60) NULL,
  [Remarks] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_InspectionRecord] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_InspectionRecord_Code] ON [dbo].[InspectionRecord] ([ProjectId], [Code]);
GO

-- WorkforceMember · d10 · نیروی کار
IF OBJECT_ID('dbo.WorkforceMember', 'U') IS NULL
CREATE TABLE [dbo].[WorkforceMember] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PersonnelNo] NVARCHAR(30) NOT NULL,
  [FullName] NVARCHAR(160) NOT NULL,
  [TradeCode] NVARCHAR(30) NOT NULL,
  [Discipline] NVARCHAR(40) NULL,
  [NationalId] NVARCHAR(20) NULL,
  [Mobile] NVARCHAR(20) NULL,
  [DailyRate] DECIMAL(18,2) NULL,
  [IsSubcontracted] BIT NOT NULL DEFAULT 0,
  [Active] BIT NOT NULL DEFAULT 1,
  [LicenseType] NVARCHAR(40) NULL,
  [LicenseExpiry] DATE NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_WorkforceMember] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_WorkforceMember] ON [dbo].[WorkforceMember] ([ProjectId], [PersonnelNo]);
GO

-- Timesheet · d10 · تایم‌شیت
IF OBJECT_ID('dbo.Timesheet', 'U') IS NULL
CREATE TABLE [dbo].[Timesheet] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MemberId] NVARCHAR(60) NOT NULL,
  [WorkDate] DATE NOT NULL,
  [NormalHours] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [OvertimeHours] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [HolidayHours] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [ActivityId] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [EnteredBy] NVARCHAR(60) NOT NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Timesheet] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_Timesheet] ON [dbo].[Timesheet] ([MemberId], [WorkDate]);
GO

-- HrmTimesheetHeader · d10 · برگهٔ روزانهٔ کارکرد
IF OBJECT_ID('dbo.HrmTimesheetHeader', 'U') IS NULL
CREATE TABLE [dbo].[HrmTimesheetHeader] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CrewId] NVARCHAR(60) NOT NULL,
  [ObsNodeId] NVARCHAR(60) NULL,
  [WorkDate] DATE NOT NULL,
  [Shift] NVARCHAR(10) NOT NULL DEFAULT 'day',
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [Source] NVARCHAR(10) NOT NULL DEFAULT 'web',
  [Weather] NVARCHAR(40) NULL,
  [SiteCondition] NVARCHAR(80) NULL,
  [GpsLat] DECIMAL(9,6) NULL,
  [GpsLng] DECIMAL(9,6) NULL,
  [GpsAccuracyM] DECIMAL(8,2) NULL,
  [PhotoRefs] NVARCHAR(1000) NULL,
  [ForemanSignatureRef] NVARCHAR(200) NULL,
  [ClientSignatureRef] NVARCHAR(200) NULL,
  [DeviceId] NVARCHAR(80) NULL,
  [AppVersion] NVARCHAR(30) NULL,
  [CapturedAt] DATETIME2 NULL,
  [SyncState] NVARCHAR(12) NOT NULL DEFAULT 'synced',
  [Revision] INT NOT NULL DEFAULT 1,
  [LockedAt] DATETIME2 NULL,
  [LockedBy] NVARCHAR(60) NULL,
  [TotalHoursRaw] DECIMAL(9,2) NOT NULL DEFAULT 0,
  [TotalHoursNormal] DECIMAL(9,2) NOT NULL DEFAULT 0,
  [TotalHoursOt] DECIMAL(9,2) NOT NULL DEFAULT 0,
  [TotalHoursNight] DECIMAL(9,2) NOT NULL DEFAULT 0,
  [TotalHoursHoliday] DECIMAL(9,2) NOT NULL DEFAULT 0,
  [EnteredBy] NVARCHAR(60) NOT NULL,
  [SubmittedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [RejectReason] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmTimesheetHeader] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmTsHeader] ON [dbo].[HrmTimesheetHeader] ([ProjectId], [CrewId], [WorkDate], [Shift]);
CREATE INDEX [IX_HrmTsHeader_Status] ON [dbo].[HrmTimesheetHeader] ([ProjectId], [WorkDate], [Status]);
GO

-- HrmTimesheetEntry · d10 · ردیف شارژ کارکرد
IF OBJECT_ID('dbo.HrmTimesheetEntry', 'U') IS NULL
CREATE TABLE [dbo].[HrmTimesheetEntry] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [HeaderId] NVARCHAR(60) NOT NULL,
  [PersonId] NVARCHAR(60) NOT NULL,
  [WorkDate] DATE NOT NULL,
  [TradeCode] NVARCHAR(30) NOT NULL,
  [Grade] NVARCHAR(20) NULL,
  [ActivityId] NVARCHAR(60) NOT NULL,
  [WbsId] NVARCHAR(60) NULL,
  [CbsId] NVARCHAR(60) NOT NULL,
  [HoursRaw] DECIMAL(5,2) NOT NULL,
  [HoursNormal] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [HoursOt] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [HoursNight] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [HoursHoliday] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [AttendanceCode] NVARCHAR(20) NOT NULL DEFAULT 'present',
  [IsProductive] BIT NOT NULL DEFAULT 1,
  [QtyDone] DECIMAL(14,3) NULL,
  [QtyUom] NVARCHAR(20) NULL,
  [RateLineId] NVARCHAR(60) NULL,
  [RcaReasonId] NVARCHAR(60) NULL,
  [Note] NVARCHAR(600) NULL,
  [VoidedAt] DATETIME2 NULL,
  [VoidedBy] NVARCHAR(60) NULL,
  [VoidReason] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmTimesheetEntry] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_HrmTsEntry_Header] ON [dbo].[HrmTimesheetEntry] ([HeaderId]);
CREATE INDEX [IX_HrmTsEntry_Person] ON [dbo].[HrmTimesheetEntry] ([PersonId], [WorkDate]);
CREATE INDEX [IX_HrmTsEntry_Act] ON [dbo].[HrmTimesheetEntry] ([ProjectId], [WorkDate], [ActivityId]);
CREATE INDEX [IX_HrmTsEntry_Cbs] ON [dbo].[HrmTimesheetEntry] ([CbsId], [WorkDate]);
GO

-- HrmPeriodLock · d10 · قفل دورهٔ کارکرد
IF OBJECT_ID('dbo.HrmPeriodLock', 'U') IS NULL
CREATE TABLE [dbo].[HrmPeriodLock] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [LockedBy] NVARCHAR(60) NOT NULL,
  [LockedAt] DATETIME2 NOT NULL,
  [ReasonFa] NVARCHAR(400) NULL,
  [UnlockedBy] NVARCHAR(60) NULL,
  [UnlockedAt] DATETIME2 NULL,
  [UnlockReasonFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmPeriodLock] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmPeriodLock] ON [dbo].[HrmPeriodLock] ([ProjectId], [PeriodCode]);
GO

-- HrmSyncConflict · d10 · تعارض همگام‌سازی آفلاین
IF OBJECT_ID('dbo.HrmSyncConflict', 'U') IS NULL
CREATE TABLE [dbo].[HrmSyncConflict] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [EntityType] NVARCHAR(40) NOT NULL,
  [EntityId] NVARCHAR(60) NOT NULL,
  [DeviceId] NVARCHAR(80) NULL,
  [LocalRevision] INT NOT NULL DEFAULT 0,
  [ServerRevision] INT NOT NULL DEFAULT 0,
  [LocalPayload] NVARCHAR(4000) NULL,
  [ServerPayload] NVARCHAR(4000) NULL,
  [DetectedAt] DATETIME2 NOT NULL,
  [Resolution] NVARCHAR(20) NOT NULL DEFAULT 'manual',
  [ResolvedBy] NVARCHAR(60) NULL,
  [ResolvedAt] DATETIME2 NULL,
  [DiffSummaryFa] NVARCHAR(1000) NULL,
  [RequiresAdjustment] BIT NOT NULL DEFAULT 0,
  [BlockReasonFa] NVARCHAR(300) NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'open',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmSyncConflict] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_HrmSyncConflict] ON [dbo].[HrmSyncConflict] ([ProjectId], [Status], [DetectedAt]);
CREATE INDEX [IX_HrmSyncConflict_Entity] ON [dbo].[HrmSyncConflict] ([EntityType], [EntityId]);
GO

-- HrmAdjustment · d10 · سند اصلاحی کارکرد
IF OBJECT_ID('dbo.HrmAdjustment', 'U') IS NULL
CREATE TABLE [dbo].[HrmAdjustment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [OriginalEntryId] NVARCHAR(60) NOT NULL,
  [AdjustmentType] NVARCHAR(20) NOT NULL,
  [DeltaHours] DECIMAL(6,2) NOT NULL DEFAULT 0,
  [NewActivityId] NVARCHAR(60) NULL,
  [NewCbsId] NVARCHAR(60) NULL,
  [ReasonCode] NVARCHAR(40) NULL,
  [ReasonTextFa] NVARCHAR(600) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'draft',
  [PostedToFin] BIT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmAdjustment] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_HrmAdjustment_Entry] ON [dbo].[HrmAdjustment] ([OriginalEntryId]);
CREATE INDEX [IX_HrmAdjustment_Period] ON [dbo].[HrmAdjustment] ([ProjectId], [PeriodCode], [Status]);
GO

-- HrmProductivityLog · d10 · سیاههٔ بهره‌وری
IF OBJECT_ID('dbo.HrmProductivityLog', 'U') IS NULL
CREATE TABLE [dbo].[HrmProductivityLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ActivityId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [TradeCode] NVARCHAR(30) NULL,
  [CbsId] NVARCHAR(60) NULL,
  [BudgetMh] DECIMAL(14,2) NOT NULL DEFAULT 0,
  [EarnedMh] DECIMAL(14,2) NOT NULL DEFAULT 0,
  [ActualMh] DECIMAL(14,2) NOT NULL DEFAULT 0,
  [ApprovedProgressPct] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [Pi] DECIMAL(8,3) NOT NULL DEFAULT 0,
  [Pf] DECIMAL(8,3) NOT NULL DEFAULT 0,
  [QtyDone] DECIMAL(14,3) NULL,
  [QtyUom] NVARCHAR(20) NULL,
  [UnitRate] DECIMAL(14,4) NULL,
  [StdRate] DECIMAL(14,4) NULL,
  [VariancePct] DECIMAL(8,2) NULL,
  [Trend] NVARCHAR(12) NOT NULL DEFAULT 'stable',
  [Status] NVARCHAR(12) NOT NULL DEFAULT 'green',
  [LostMh] DECIMAL(14,2) NOT NULL DEFAULT 0,
  [IsCalibrated] BIT NOT NULL DEFAULT 0,
  [ComputedAt] DATETIME2 NOT NULL,
  [InputHash] NVARCHAR(64) NOT NULL,
  [IsFinal] BIT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmProductivityLog] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmProdLog] ON [dbo].[HrmProductivityLog] ([ProjectId], [ActivityId], [PeriodCode]);
CREATE INDEX [IX_HrmProdLog_Period] ON [dbo].[HrmProductivityLog] ([ProjectId], [PeriodCode], [Status]);
CREATE INDEX [IX_HrmProdLog_Trade] ON [dbo].[HrmProductivityLog] ([ProjectId], [TradeCode], [PeriodCode]);
GO

-- HrmRcaReason · d10 · علت افت بهره‌وری
IF OBJECT_ID('dbo.HrmRcaReason', 'U') IS NULL
CREATE TABLE [dbo].[HrmRcaReason] (
  [Id] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [NameFa] NVARCHAR(200) NOT NULL,
  [NameEn] NVARCHAR(200) NOT NULL,
  [Category] NVARCHAR(30) NOT NULL,
  [IsClaimable] BIT NOT NULL DEFAULT 0,
  [DefaultOwnerDomain] NVARCHAR(10) NOT NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmRcaReason] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmRcaReason_Code] ON [dbo].[HrmRcaReason] ([Code]);
GO

-- HrmRcaEntry · d10 · ثبت علت افت
IF OBJECT_ID('dbo.HrmRcaEntry', 'U') IS NULL
CREATE TABLE [dbo].[HrmRcaEntry] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ActivityId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [ReasonCode] NVARCHAR(40) NOT NULL,
  [SharePct] DECIMAL(5,2) NOT NULL DEFAULT 100,
  [LostMh] DECIMAL(14,2) NOT NULL DEFAULT 0,
  [EstimatedCost] DECIMAL(18,2) NULL,
  [NoteFa] NVARCHAR(800) NOT NULL,
  [RaisedBy] NVARCHAR(60) NOT NULL,
  [RaisedAt] DATETIME2 NOT NULL,
  [ClaimRef] NVARCHAR(60) NULL,
  [ClaimedAt] DATETIME2 NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'open',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmRcaEntry] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_HrmRcaEntry_Act] ON [dbo].[HrmRcaEntry] ([ProjectId], [ActivityId], [PeriodCode]);
CREATE INDEX [IX_HrmRcaEntry_Reason] ON [dbo].[HrmRcaEntry] ([ProjectId], [ReasonCode], [Status]);
GO

-- HrmMetricSnapshot · d10 · عکس متریک بهره‌وری
IF OBJECT_ID('dbo.HrmMetricSnapshot', 'U') IS NULL
CREATE TABLE [dbo].[HrmMetricSnapshot] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [MetricCode] NVARCHAR(20) NOT NULL,
  [Dimension] NVARCHAR(16) NOT NULL DEFAULT 'project',
  [DimensionId] NVARCHAR(60) NULL,
  [Value] DECIMAL(14,3) NOT NULL DEFAULT 0,
  [Target] DECIMAL(14,3) NULL,
  [Status] NVARCHAR(10) NOT NULL DEFAULT 'green',
  [ComputedAt] DATETIME2 NOT NULL,
  [InputHash] NVARCHAR(64) NOT NULL,
  [IsFinal] BIT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmMetricSnapshot] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmMetricSnap] ON [dbo].[HrmMetricSnapshot] ([ProjectId], [PeriodCode], [MetricCode], [Dimension], [DimensionId]) WHERE [DimensionId] IS NOT NULL;
CREATE INDEX [IX_HrmMetricSnap_Period] ON [dbo].[HrmMetricSnapshot] ([ProjectId], [PeriodCode], [Status]);
GO

-- HrmCrew · d10 · اکیپ کاری
IF OBJECT_ID('dbo.HrmCrew', 'U') IS NULL
CREATE TABLE [dbo].[HrmCrew] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [NameFa] NVARCHAR(200) NOT NULL,
  [ObsNodeId] NVARCHAR(60) NULL,
  [ForemanPersonId] NVARCHAR(60) NULL,
  [PrimaryTradeCode] NVARCHAR(30) NOT NULL,
  [TargetMix] NVARCHAR(MAX) NULL,
  [TargetSize] INT NOT NULL DEFAULT 0,
  [DefaultCbsId] NVARCHAR(60) NULL,
  [ShiftCode] NVARCHAR(10) NULL DEFAULT 'day',
  [IsSubcontracted] BIT NOT NULL DEFAULT 0,
  [SubContractId] NVARCHAR(60) NULL,
  [Status] NVARCHAR(12) NOT NULL DEFAULT 'forming',
  [DisbandedAt] DATETIME2 NULL,
  [DisbandReasonFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmCrew] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmCrew_Code] ON [dbo].[HrmCrew] ([ProjectId], [Code]);
CREATE INDEX [IX_HrmCrew_Status] ON [dbo].[HrmCrew] ([ProjectId], [Status], [PrimaryTradeCode]);
GO

-- HrmCrewMember · d10 · عضویت در اکیپ
IF OBJECT_ID('dbo.HrmCrewMember', 'U') IS NULL
CREATE TABLE [dbo].[HrmCrewMember] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CrewId] NVARCHAR(60) NOT NULL,
  [PersonId] NVARCHAR(60) NOT NULL,
  [RoleInCrew] NVARCHAR(16) NOT NULL DEFAULT 'skilled',
  [TradeCode] NVARCHAR(30) NOT NULL,
  [Grade] NVARCHAR(20) NULL,
  [FromDate] DATE NOT NULL,
  [ToDate] DATE NULL,
  [AllocationPct] DECIMAL(5,2) NOT NULL DEFAULT 100,
  [ExitReasonFa] NVARCHAR(400) NULL,
  [Status] NVARCHAR(12) NOT NULL DEFAULT 'active',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmCrewMember] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_HrmCrewMember_Crew] ON [dbo].[HrmCrewMember] ([CrewId], [Status]);
CREATE INDEX [IX_HrmCrewMember_Person] ON [dbo].[HrmCrewMember] ([ProjectId], [PersonId], [FromDate]);
GO

-- HrmSubContract · d10 · قرارداد نیروی پیمانکاری
IF OBJECT_ID('dbo.HrmSubContract', 'U') IS NULL
CREATE TABLE [dbo].[HrmSubContract] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractNo] NVARCHAR(80) NOT NULL,
  [ContractorName] NVARCHAR(200) NOT NULL,
  [ScopeTrades] NVARCHAR(MAX) NULL,
  [PricingModel] NVARCHAR(16) NOT NULL DEFAULT 'hourly',
  [AgreedRates] NVARCHAR(MAX) NULL,
  [Currency] NVARCHAR(10) NOT NULL DEFAULT 'IRR',
  [StartDate] DATE NOT NULL,
  [EndDate] DATE NOT NULL,
  [RetentionPct] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [PenaltyTermsFa] NVARCHAR(1000) NULL,
  [FinVendorId] NVARCHAR(60) NULL,
  [CntContractId] NVARCHAR(60) NULL,
  [Status] NVARCHAR(12) NOT NULL DEFAULT 'draft',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmSubContract] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmSubContract_No] ON [dbo].[HrmSubContract] ([ProjectId], [ContractNo]);
CREATE INDEX [IX_HrmSubContract_Status] ON [dbo].[HrmSubContract] ([ProjectId], [Status], [EndDate]);
GO

-- HrmSubAttendance · d10 · حضور نیروی پیمانکاری
IF OBJECT_ID('dbo.HrmSubAttendance', 'U') IS NULL
CREATE TABLE [dbo].[HrmSubAttendance] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SubContractId] NVARCHAR(60) NOT NULL,
  [WorkDate] DATE NOT NULL,
  [TradeCode] NVARCHAR(30) NOT NULL,
  [Headcount] INT NOT NULL DEFAULT 0,
  [HoursPerPerson] DECIMAL(5,2) NOT NULL DEFAULT 0,
  [TotalHours] DECIMAL(9,2) NOT NULL DEFAULT 0,
  [ActivityId] NVARCHAR(60) NOT NULL,
  [CbsId] NVARCHAR(60) NOT NULL,
  [CrewId] NVARCHAR(60) NULL,
  [GatePassRef] NVARCHAR(100) NULL,
  [VerifiedBy] NVARCHAR(60) NULL,
  [VerifiedAt] DATETIME2 NULL,
  [InvoicePeriod] NVARCHAR(20) NULL,
  [SubIpcId] NVARCHAR(60) NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'draft',
  [RejectReasonFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmSubAttendance] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmSubAtt] ON [dbo].[HrmSubAttendance] ([SubContractId], [WorkDate], [TradeCode], [ActivityId]);
CREATE INDEX [IX_HrmSubAtt_Period] ON [dbo].[HrmSubAttendance] ([ProjectId], [InvoicePeriod], [Status]);
GO

-- HrmSubIpc · d10 · صورت‌کارکرد نیروی پیمانکاری
IF OBJECT_ID('dbo.HrmSubIpc', 'U') IS NULL
CREATE TABLE [dbo].[HrmSubIpc] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SubContractId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [SerialNo] INT NOT NULL DEFAULT 1,
  [TotalHours] DECIMAL(12,2) NOT NULL DEFAULT 0,
  [GrossAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [RetentionAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [DeductionAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [NetAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [UnpricedHours] DECIMAL(12,2) NOT NULL DEFAULT 0,
  [DeductionNoteFa] NVARCHAR(800) NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'draft',
  [PreparedBy] NVARCHAR(60) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [FinPostingRef] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmSubIpc] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmSubIpc] ON [dbo].[HrmSubIpc] ([SubContractId], [PeriodCode]);
CREATE INDEX [IX_HrmSubIpc_Status] ON [dbo].[HrmSubIpc] ([ProjectId], [Status], [PeriodCode]);
GO

-- HrmPerson · d10 · پروندهٔ پرسنلی
IF OBJECT_ID('dbo.HrmPerson', 'U') IS NULL
CREATE TABLE [dbo].[HrmPerson] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [FullNameFa] NVARCHAR(200) NOT NULL,
  [NameEn] NVARCHAR(200) NULL,
  [NationalId] NVARCHAR(20) NULL,
  [Mobile] NVARCHAR(20) NULL,
  [EmergencyContact] NVARCHAR(200) NULL,
  [EmploymentType] NVARCHAR(20) NOT NULL DEFAULT 'permanent',
  [EmployerSubContractId] NVARCHAR(60) NULL,
  [PrimaryTradeCode] NVARCHAR(30) NOT NULL,
  [Grade] NVARCHAR(20) NULL,
  [HireDate] DATE NULL,
  [TerminationDate] DATE NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'candidate',
  [HseClearance] NVARCHAR(12) NOT NULL DEFAULT 'none',
  [HseCheckedAt] DATETIME2 NULL,
  [GatePassRef] NVARCHAR(60) NULL,
  [PhotoRef] NVARCHAR(200) NULL,
  [SignatureRef] NVARCHAR(200) NULL,
  [ActivatedAt] DATETIME2 NULL,
  [DemobilizedAt] DATETIME2 NULL,
  [ExitReasonFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmPerson] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmPerson_No] ON [dbo].[HrmPerson] ([ProjectId], [PersonnelNo]);
CREATE INDEX [IX_HrmPerson_Status] ON [dbo].[HrmPerson] ([ProjectId], [Status], [PrimaryTradeCode]);
GO

-- HrmPersonDoc · d10 · مدرک پرسنلی
IF OBJECT_ID('dbo.HrmPersonDoc', 'U') IS NULL
CREATE TABLE [dbo].[HrmPersonDoc] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PersonId] NVARCHAR(60) NOT NULL,
  [DocType] NVARCHAR(20) NOT NULL,
  [DocNo] NVARCHAR(60) NULL,
  [IssuedAt] DATE NULL,
  [ExpiresAt] DATE NULL,
  [FileRef] NVARCHAR(200) NULL,
  [IsBlocking] BIT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(12) NOT NULL DEFAULT 'valid',
  [VerifiedBy] NVARCHAR(60) NULL,
  [VerifiedAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmPersonDoc] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmPersonDoc] ON [dbo].[HrmPersonDoc] ([PersonId], [DocType], [DocNo]) WHERE [DocNo] IS NOT NULL;
CREATE INDEX [IX_HrmPersonDoc_Exp] ON [dbo].[HrmPersonDoc] ([ProjectId], [ExpiresAt], [IsBlocking]);
GO

-- HrmSkill · d10 · مهارت و صلاحیت
IF OBJECT_ID('dbo.HrmSkill', 'U') IS NULL
CREATE TABLE [dbo].[HrmSkill] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PersonId] NVARCHAR(60) NOT NULL,
  [SkillCode] NVARCHAR(30) NOT NULL,
  [SkillNameFa] NVARCHAR(200) NULL,
  [Level] INT NOT NULL DEFAULT 0,
  [CertifiedAt] DATE NULL,
  [ExpiresAt] DATE NULL,
  [EvidenceRef] NVARCHAR(200) NULL,
  [VerifiedBy] NVARCHAR(60) NULL,
  [IsBlocking] BIT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(12) NOT NULL DEFAULT 'valid',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmSkill] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmSkill] ON [dbo].[HrmSkill] ([PersonId], [SkillCode]);
CREATE INDEX [IX_HrmSkill_Exp] ON [dbo].[HrmSkill] ([ProjectId], [ExpiresAt], [IsBlocking]);
GO

-- HrmMobRequest · d10 · درخواست تجهیز نیرو
IF OBJECT_ID('dbo.HrmMobRequest', 'U') IS NULL
CREATE TABLE [dbo].[HrmMobRequest] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RequestNo] NVARCHAR(40) NOT NULL,
  [RequestType] NVARCHAR(16) NOT NULL DEFAULT 'mobilize',
  [TradeCode] NVARCHAR(30) NOT NULL,
  [Qty] INT NOT NULL DEFAULT 1,
  [NeedByDate] DATE NOT NULL,
  [ObsNodeId] NVARCHAR(60) NULL,
  [CrewId] NVARCHAR(60) NULL,
  [PlanLineRef] NVARCHAR(60) NULL,
  [JustificationFa] NVARCHAR(800) NOT NULL,
  [FulfilledQty] INT NOT NULL DEFAULT 0,
  [FulfilledAt] DATETIME2 NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [SubmittedBy] NVARCHAR(60) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [RejectReasonFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmMobRequest] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmMobReq_No] ON [dbo].[HrmMobRequest] ([ProjectId], [RequestNo]);
CREATE INDEX [IX_HrmMobReq_Status] ON [dbo].[HrmMobRequest] ([ProjectId], [Status], [NeedByDate]);
GO

-- HrmDemobCheck · d10 · چک‌لیست تخلیهٔ نیرو
IF OBJECT_ID('dbo.HrmDemobCheck', 'U') IS NULL
CREATE TABLE [dbo].[HrmDemobCheck] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PersonId] NVARCHAR(60) NOT NULL,
  [ItemCode] NVARCHAR(30) NOT NULL,
  [IsDone] BIT NOT NULL DEFAULT 0,
  [DoneBy] NVARCHAR(60) NULL,
  [DoneAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(400) NULL,
  [IsMandatory] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmDemobCheck] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmDemobCheck] ON [dbo].[HrmDemobCheck] ([PersonId], [ItemCode]);
GO

-- HrmManpowerPlan · d10 · برنامهٔ مبنای نیرو
IF OBJECT_ID('dbo.HrmManpowerPlan', 'U') IS NULL
CREATE TABLE [dbo].[HrmManpowerPlan] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(10) NOT NULL,
  [Revision] NVARCHAR(20) NOT NULL DEFAULT 'baseline',
  [TradeCode] NVARCHAR(30) NULL,
  [ObsNodeId] NVARCHAR(60) NULL,
  [PlannedMh] DECIMAL(14,2) NOT NULL DEFAULT 0,
  [PlannedHeadcount] INT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmManpowerPlan] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmManpowerPlan] ON [dbo].[HrmManpowerPlan] ([ProjectId], [PeriodCode], [Revision], [TradeCode]) WHERE [TradeCode] IS NOT NULL;
CREATE INDEX [IX_HrmManpowerPlan_Period] ON [dbo].[HrmManpowerPlan] ([ProjectId], [PeriodCode]);
GO

-- HrmSyncBatch · d10 · دستهٔ همگام‌سازی میدانی
IF OBJECT_ID('dbo.HrmSyncBatch', 'U') IS NULL
CREATE TABLE [dbo].[HrmSyncBatch] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DeviceId] NVARCHAR(80) NOT NULL,
  [Fingerprint] NVARCHAR(40) NOT NULL,
  [ItemCount] INT NOT NULL DEFAULT 0,
  [ReceivedAt] DATETIME2 NOT NULL,
  [ReceivedBy] NVARCHAR(60) NOT NULL,
  [AppVersion] NVARCHAR(30) NULL,
  [ResultJson] NVARCHAR(8000) NULL,
  [AppliedCount] INT NOT NULL DEFAULT 0,
  [ConflictCount] INT NOT NULL DEFAULT 0,
  [ReplayCount] INT NOT NULL DEFAULT 0,
  [LastReplayAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmSyncBatch] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmSyncBatch] ON [dbo].[HrmSyncBatch] ([ProjectId], [DeviceId], [Fingerprint]);
CREATE INDEX [IX_HrmSyncBatch_Device] ON [dbo].[HrmSyncBatch] ([ProjectId], [DeviceId], [ReceivedAt]);
GO

-- HrmRateCard · d10 · کارت نرخ ساعتی رسته
IF OBJECT_ID('dbo.HrmRateCard', 'U') IS NULL
CREATE TABLE [dbo].[HrmRateCard] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [TradeCode] NVARCHAR(40) NOT NULL,
  [Grade] NVARCHAR(20) NULL,
  [HourlyRate] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [EffectiveFrom] NVARCHAR(10) NOT NULL,
  [EffectiveTo] NVARCHAR(10) NULL,
  [SourceFa] NVARCHAR(200) NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'active',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmRateCard] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_HrmRateCard] ON [dbo].[HrmRateCard] ([ProjectId], [TradeCode], [EffectiveFrom]);
CREATE UNIQUE INDEX [UX_HrmRateCard] ON [dbo].[HrmRateCard] ([ProjectId], [TradeCode], [Grade], [EffectiveFrom]) WHERE [Grade] IS NOT NULL;
GO

-- HrmCostPosting · d10 · ارسال هزینهٔ نیرو به مالی
IF OBJECT_ID('dbo.HrmCostPosting', 'U') IS NULL
CREATE TABLE [dbo].[HrmCostPosting] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CostAccountId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [EquivalentHours] DECIMAL(14,2) NOT NULL DEFAULT 0,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [UnpricedHours] DECIMAL(14,2) NOT NULL DEFAULT 0,
  [MemoFa] NVARCHAR(400) NULL,
  [PostedAt] DATETIME2 NOT NULL,
  [PostedBy] NVARCHAR(60) NOT NULL,
  [EventKey] NVARCHAR(120) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmCostPosting] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmCostPosting] ON [dbo].[HrmCostPosting] ([ProjectId], [CostAccountId], [PeriodCode]);
CREATE INDEX [IX_HrmCostPosting_Period] ON [dbo].[HrmCostPosting] ([ProjectId], [PeriodCode], [PostedAt]);
GO

-- IntegrationEvent · core · رویداد یکپارچه‌سازی
IF OBJECT_ID('dbo.IntegrationEvent', 'U') IS NULL
CREATE TABLE [dbo].[IntegrationEvent] (
  [Id] NVARCHAR(60) NOT NULL,
  [EventKey] NVARCHAR(160) NOT NULL,
  [EventType] NVARCHAR(60) NOT NULL,
  [SchemaVersion] NVARCHAR(10) NOT NULL DEFAULT '1.0',
  [SourceModule] NVARCHAR(10) NOT NULL,
  [TargetModule] NVARCHAR(10) NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [EntityName] NVARCHAR(60) NULL,
  [EntityId] NVARCHAR(120) NULL,
  [PayloadJson] NVARCHAR(8000) NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'pending',
  [OccurredAt] DATETIME2 NOT NULL,
  [DeliveredAt] DATETIME2 NULL,
  [AttemptCount] INT NOT NULL DEFAULT 0,
  [LastErrorFa] NVARCHAR(400) NULL,
  [AckRef] NVARCHAR(120) NULL,
  [EmittedBy] NVARCHAR(60) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IntegrationEvent] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_IntegrationEvent] ON [dbo].[IntegrationEvent] ([EventKey]);
CREATE INDEX [IX_IntegrationEvent_Queue] ON [dbo].[IntegrationEvent] ([Status], [OccurredAt]);
CREATE INDEX [IX_IntegrationEvent_Project] ON [dbo].[IntegrationEvent] ([ProjectId], [EventType], [OccurredAt]);
GO

-- Correspondence · d11 · مکاتبه
IF OBJECT_ID('dbo.Correspondence', 'U') IS NULL
CREATE TABLE [dbo].[Correspondence] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [LetterNo] NVARCHAR(80) NOT NULL,
  [Direction] NVARCHAR(20) NOT NULL,
  [Kind] NVARCHAR(30) NOT NULL,
  [SubjectFa] NVARCHAR(500) NOT NULL,
  [IssuedAt] DATE NOT NULL,
  [DueAt] DATE NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [Classification] NVARCHAR(20) NULL,
  [RefLetterNo] NVARCHAR(80) NULL,
  [TimeBarred] BIT NOT NULL DEFAULT 0,
  [FromParty] NVARCHAR(200) NULL,
  [ToParty] NVARCHAR(200) NULL,
  [ReceivedAt] DATE NULL,
  [ResponseDays] INT NULL,
  [RespondedAt] DATE NULL,
  [ResponseRef] NVARCHAR(80) NULL,
  [Links] NVARCHAR(MAX) NULL,
  [OwnerRole] NVARCHAR(80) NULL,
  [Attachments] INT NULL,
  [DraftedBy] NVARCHAR(60) NULL,
  [SignedBy] NVARCHAR(60) NULL,
  [SignedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Correspondence] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_Correspondence_LetterNo] ON [dbo].[Correspondence] ([ProjectId], [LetterNo]);
CREATE INDEX [IX_Correspondence_Due] ON [dbo].[Correspondence] ([ProjectId], [DueAt], [Status]);
GO

-- MeetingMinute · d11 · صورت‌جلسه
IF OBJECT_ID('dbo.MeetingMinute', 'U') IS NULL
CREATE TABLE [dbo].[MeetingMinute] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [HeldAt] DATE NOT NULL,
  [Attendees] NVARCHAR(MAX) NULL,
  [Decisions] NVARCHAR(MAX) NULL,
  [Actions] NVARCHAR(MAX) NULL,
  [MeetingType] NVARCHAR(20) NULL,
  [Chair] NVARCHAR(120) NULL,
  [Invited] NVARCHAR(MAX) NULL,
  [MinutesApproved] BIT NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [DistributedAt] DATE NULL,
  [DistributedTo] NVARCHAR(MAX) NULL,
  [RecordedBy] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MeetingMinute] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_MeetingMinute_Code] ON [dbo].[MeetingMinute] ([ProjectId], [Code]);
GO

-- LessonLearned · d11 · درس آموخته
IF OBJECT_ID('dbo.LessonLearned', 'U') IS NULL
CREATE TABLE [dbo].[LessonLearned] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Category] NVARCHAR(40) NOT NULL,
  [Impact] NVARCHAR(20) NOT NULL,
  [Validated] BIT NOT NULL DEFAULT 0,
  [ReuseCount] INT NOT NULL DEFAULT 0,
  [Value] INT NULL,
  [SourceRef] NVARCHAR(80) NULL,
  [SituationFa] NVARCHAR(2000) NULL,
  [RecommendationFa] NVARCHAR(2000) NULL,
  [CapturedAt] DATE NULL,
  [CapturedBy] NVARCHAR(60) NULL,
  [Tags] NVARCHAR(MAX) NULL,
  [ValidatedBy] NVARCHAR(60) NULL,
  [ValidatedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_LessonLearned] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_LessonLearned_Code] ON [dbo].[LessonLearned] ([ProjectId], [Code]);
GO

-- MeetingAction · d11 · مصوبهٔ جلسه
IF OBJECT_ID('dbo.MeetingAction', 'U') IS NULL
CREATE TABLE [dbo].[MeetingAction] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [MeetingCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(500) NOT NULL,
  [OwnerRole] NVARCHAR(80) NOT NULL,
  [DueDate] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [ClosedAt] DATE NULL,
  [Links] NVARCHAR(MAX) NULL,
  [CancelReasonFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MeetingAction] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_MeetingAction_Code] ON [dbo].[MeetingAction] ([ProjectId], [Code]);
CREATE INDEX [IX_MeetingAction_Meeting] ON [dbo].[MeetingAction] ([ProjectId], [MeetingCode]);
CREATE INDEX [IX_MeetingAction_Due] ON [dbo].[MeetingAction] ([ProjectId], [DueDate], [Status]);
GO

-- Stakeholder · d11 · ذی‌نفع
IF OBJECT_ID('dbo.Stakeholder', 'U') IS NULL
CREATE TABLE [dbo].[Stakeholder] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [Org] NVARCHAR(120) NULL,
  [RoleFa] NVARCHAR(120) NULL,
  [Power] INT NOT NULL,
  [Interest] INT NOT NULL,
  [CurrentLevel] NVARCHAR(20) NOT NULL,
  [DesiredLevel] NVARCHAR(20) NOT NULL,
  [Channels] NVARCHAR(MAX) NULL,
  [Frequency] NVARCHAR(20) NULL,
  [OwnerRole] NVARCHAR(80) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Stakeholder] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_Stakeholder_Code] ON [dbo].[Stakeholder] ([ProjectId], [Code]);
GO

-- LessonReuse · d11 · استفادهٔ مجدد از درس‌آموخته
IF OBJECT_ID('dbo.LessonReuse', 'U') IS NULL
CREATE TABLE [dbo].[LessonReuse] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [LessonCode] NVARCHAR(40) NOT NULL,
  [UsedBy] NVARCHAR(60) NOT NULL,
  [UsedAt] DATE NOT NULL,
  [NoteFa] NVARCHAR(600) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_LessonReuse] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_LessonReuse] ON [dbo].[LessonReuse] ([ProjectId], [LessonCode], [UsedBy]);
GO

-- NotificationRule · d11 · قاعدهٔ اطلاع‌رسانی و تشدید
IF OBJECT_ID('dbo.NotificationRule', 'U') IS NULL
CREATE TABLE [dbo].[NotificationRule] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [EventCode] NVARCHAR(40) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [Channels] NVARCHAR(MAX) NULL,
  [AudienceRoles] NVARCHAR(MAX) NULL,
  [EscalateAfterHours] INT NOT NULL,
  [EscalateToRole] NVARCHAR(80) NULL,
  [Active] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_NotificationRule] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_NotificationRule_Code] ON [dbo].[NotificationRule] ([ProjectId], [Code]);
GO

-- Equipment · d9 · ماشین‌آلات و تجهیزات
IF OBJECT_ID('dbo.Equipment', 'U') IS NULL
CREATE TABLE [dbo].[Equipment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [NameFa] NVARCHAR(200) NOT NULL,
  [Category] NVARCHAR(30) NOT NULL,
  [Ownership] NVARCHAR(20) NOT NULL,
  [BrandFa] NVARCHAR(120) NULL,
  [Model] NVARCHAR(80) NULL,
  [Year] INT NULL,
  [Capacity] DECIMAL(18,2) NULL,
  [CapacityUom] NVARCHAR(20) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [CommissionedAt] DATE NULL,
  [LocationFa] NVARCHAR(200) NULL,
  [PurchaseValue] DECIMAL(18,2) NULL,
  [SalvageValue] DECIMAL(18,2) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_Equipment] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_Equipment_Code] ON [dbo].[Equipment] ([ProjectId], [Code]);
CREATE INDEX [IX_Equipment_Status] ON [dbo].[Equipment] ([ProjectId], [Status], [Category]);
GO

-- EquipmentMeter · d9 · ساعت کارکرد
IF OBJECT_ID('dbo.EquipmentMeter', 'U') IS NULL
CREATE TABLE [dbo].[EquipmentMeter] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [EquipmentId] NVARCHAR(60) NOT NULL,
  [ReadAt] DATE NOT NULL,
  [HourMeter] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [WorkHours] DECIMAL(10,2) NOT NULL DEFAULT 0,
  [Source] NVARCHAR(20) NOT NULL DEFAULT 'manual',
  [EnteredBy] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EquipmentMeter] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EquipmentMeter] ON [dbo].[EquipmentMeter] ([EquipmentId], [ReadAt]);
CREATE INDEX [IX_EquipmentMeter_Equip] ON [dbo].[EquipmentMeter] ([EquipmentId]);
GO

-- EquipmentRental · d9 · اجاره ماشین‌آلات
IF OBJECT_ID('dbo.EquipmentRental', 'U') IS NULL
CREATE TABLE [dbo].[EquipmentRental] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [EquipmentId] NVARCHAR(60) NOT NULL,
  [Supplier] NVARCHAR(200) NULL,
  [ContractNo] NVARCHAR(60) NULL,
  [RateType] NVARCHAR(20) NOT NULL,
  [Rate] DECIMAL(18,2) NOT NULL,
  [Currency] NVARCHAR(10) NULL DEFAULT 'IRR',
  [StartDate] DATE NOT NULL,
  [EndDate] DATE NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EquipmentRental] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EquipmentRental_Contract] ON [dbo].[EquipmentRental] ([ProjectId], [ContractNo]) WHERE [ContractNo] IS NOT NULL;
CREATE INDEX [IX_EquipmentRental_Equip] ON [dbo].[EquipmentRental] ([EquipmentId], [Status]);
GO

-- MaintenanceOrder · d9 · دستورکار تعمیرات
IF OBJECT_ID('dbo.MaintenanceOrder', 'U') IS NULL
CREATE TABLE [dbo].[MaintenanceOrder] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [EquipmentId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [Kind] NVARCHAR(30) NOT NULL,
  [Priority] NVARCHAR(20) NOT NULL,
  [ReportedAt] DATE NOT NULL,
  [DownFrom] DATETIME2 NULL,
  [DownTo] DATETIME2 NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'open',
  [Cost] DECIMAL(18,2) NULL DEFAULT 0,
  [DescriptionFa] NVARCHAR(1000) NULL,
  [AssignedTo] NVARCHAR(60) NULL,
  [RootCause] NVARCHAR(30) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MaintenanceOrder] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_MaintenanceOrder_Code] ON [dbo].[MaintenanceOrder] ([ProjectId], [Code]);
CREATE INDEX [IX_MaintenanceOrder_Open] ON [dbo].[MaintenanceOrder] ([ProjectId], [Status], [Priority]);
GO

-- EquipmentDispatch · d9 · دیسپچ روزانه ماشین‌آلات
IF OBJECT_ID('dbo.EquipmentDispatch', 'U') IS NULL
CREATE TABLE [dbo].[EquipmentDispatch] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [EquipmentId] NVARCHAR(60) NOT NULL,
  [DispatchDate] DATE NOT NULL,
  [Shift] NVARCHAR(10) NOT NULL DEFAULT 'day',
  [OperatorId] NVARCHAR(60) NULL,
  [ActivityId] NVARCHAR(60) NULL,
  [CostAccountId] NVARCHAR(60) NULL,
  [SiteFa] NVARCHAR(200) NULL,
  [PlannedHours] DECIMAL(6,2) NOT NULL DEFAULT 8,
  [PlannedQty] DECIMAL(18,2) NULL,
  [QtyUom] NVARCHAR(20) NULL,
  [SafetyCheck] BIT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [ApprovedBy] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EquipmentDispatch] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EquipmentDispatch] ON [dbo].[EquipmentDispatch] ([EquipmentId], [DispatchDate], [Shift]);
CREATE INDEX [IX_EquipmentDispatch_Day] ON [dbo].[EquipmentDispatch] ([ProjectId], [DispatchDate], [Status]);
GO

-- EquipmentFuelLog · d9 · مصرف سوخت و مواد مصرفی
IF OBJECT_ID('dbo.EquipmentFuelLog', 'U') IS NULL
CREATE TABLE [dbo].[EquipmentFuelLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [EquipmentId] NVARCHAR(60) NOT NULL,
  [LogDate] DATE NOT NULL,
  [Kind] NVARCHAR(20) NOT NULL DEFAULT 'diesel',
  [Quantity] DECIMAL(14,2) NOT NULL,
  [Uom] NVARCHAR(20) NULL,
  [UnitCost] DECIMAL(18,2) NULL,
  [HourMeter] DECIMAL(18,2) NULL,
  [IssuedBy] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EquipmentFuelLog] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_EquipmentFuelLog_Equip] ON [dbo].[EquipmentFuelLog] ([EquipmentId], [LogDate]);
CREATE INDEX [IX_EquipmentFuelLog_Kind] ON [dbo].[EquipmentFuelLog] ([ProjectId], [Kind], [LogDate]);
GO

-- PmSchedule · d9 · برنامه نگهداری پیشگیرانه
IF OBJECT_ID('dbo.PmSchedule', 'U') IS NULL
CREATE TABLE [dbo].[PmSchedule] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [EquipmentId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [Basis] NVARCHAR(20) NOT NULL DEFAULT 'run_hours',
  [IntervalValue] DECIMAL(14,2) NOT NULL,
  [LastDoneAt] DATE NULL,
  [LastDoneReading] DECIMAL(18,2) NULL,
  [ChecklistFa] NVARCHAR(2000) NULL,
  [Active] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmSchedule] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmSchedule_Code] ON [dbo].[PmSchedule] ([ProjectId], [Code]);
CREATE INDEX [IX_PmSchedule_Equip] ON [dbo].[PmSchedule] ([EquipmentId], [Active]);
GO

-- SparePart · d9 · قطعات یدکی
IF OBJECT_ID('dbo.SparePart', 'U') IS NULL
CREATE TABLE [dbo].[SparePart] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PartNo] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [Uom] NVARCHAR(20) NULL,
  [OnHand] DECIMAL(14,2) NOT NULL DEFAULT 0,
  [MinLevel] DECIMAL(14,2) NOT NULL DEFAULT 0,
  [LeadTimeDays] INT NULL,
  [AvgDailyUsage] DECIMAL(14,4) NULL,
  [UnitCost] DECIMAL(18,2) NULL,
  [Critical] BIT NOT NULL DEFAULT 0,
  [EquipmentCategory] NVARCHAR(30) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SparePart] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_SparePart_No] ON [dbo].[SparePart] ([ProjectId], [PartNo]);
CREATE INDEX [IX_SparePart_Critical] ON [dbo].[SparePart] ([ProjectId], [Critical]);
GO

-- EquipmentCostPosting · d9 · ثبت هزینه ماشین‌آلات
IF OBJECT_ID('dbo.EquipmentCostPosting', 'U') IS NULL
CREATE TABLE [dbo].[EquipmentCostPosting] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CostAccountId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [RentalCost] DECIMAL(18,2) NULL DEFAULT 0,
  [MaintenanceCost] DECIMAL(18,2) NULL DEFAULT 0,
  [FuelCost] DECIMAL(18,2) NULL DEFAULT 0,
  [WorkHours] DECIMAL(12,2) NULL DEFAULT 0,
  [MemoFa] NVARCHAR(600) NULL,
  [PostedAt] DATETIME2 NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EquipmentCostPosting] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EquipmentCostPosting] ON [dbo].[EquipmentCostPosting] ([CostAccountId], [PeriodCode]);
GO

-- PartTransaction · d9 · تراکنش قطعات یدکی
IF OBJECT_ID('dbo.PartTransaction', 'U') IS NULL
CREATE TABLE [dbo].[PartTransaction] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [TxnDate] DATE NOT NULL,
  [Direction] NVARCHAR(10) NOT NULL DEFAULT 'issue',
  [Quantity] DECIMAL(14,2) NOT NULL,
  [WorkOrderId] NVARCHAR(60) NULL,
  [EquipmentId] NVARCHAR(60) NULL,
  [UnitCost] DECIMAL(18,2) NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PartTransaction] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_PartTransaction_Part] ON [dbo].[PartTransaction] ([PartId], [TxnDate]);
CREATE INDEX [IX_PartTransaction_Wo] ON [dbo].[PartTransaction] ([WorkOrderId]);
GO

-- ReportIssue · core · صدور گزارش
IF OBJECT_ID('dbo.ReportIssue', 'U') IS NULL
CREATE TABLE [dbo].[ReportIssue] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ReportCode] NVARCHAR(20) NOT NULL,
  [DocNo] NVARCHAR(80) NOT NULL,
  [Revision] NVARCHAR(10) NOT NULL,
  [Audience] NVARCHAR(20) NOT NULL,
  [IssuedAt] DATETIME2 NOT NULL,
  [IssuedBy] NVARCHAR(60) NOT NULL,
  [Distribution] NVARCHAR(MAX) NULL,
  [Format] NVARCHAR(10) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ReportIssue] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ReportIssue] ON [dbo].[ReportIssue] ([DocNo], [Revision]);
GO

-- MdrDeliverable · d12 · قلم فهرست مدارک مهندسی
IF OBJECT_ID('dbo.MdrDeliverable', 'U') IS NULL
CREATE TABLE [dbo].[MdrDeliverable] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocNo] NVARCHAR(80) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [TitleEn] NVARCHAR(400) NULL,
  [Discipline] NVARCHAR(40) NOT NULL,
  [DocType] NVARCHAR(40) NOT NULL,
  [PlannedWeight] DECIMAL(9,4) NOT NULL,
  [EstimatedManhours] DECIMAL(12,2) NULL,
  [WbsId] NVARCHAR(60) NULL,
  [DocumentId] NVARCHAR(60) NULL,
  [TargetIfaDate] DATE NULL,
  [TargetIfcDate] DATE NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [CriticalityLevel] NVARCHAR(20) NULL,
  [ContractReviewDays] INT NULL,
  [RemarksFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MdrDeliverable] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_MdrDeliverable] ON [dbo].[MdrDeliverable] ([ProjectId], [DocNo]);
CREATE INDEX [IX_MdrDeliverable_Discipline] ON [dbo].[MdrDeliverable] ([ProjectId], [Discipline]);
CREATE INDEX [IX_MdrDeliverable_Status] ON [dbo].[MdrDeliverable] ([ProjectId], [Status]);
GO

-- EngineeringRevision · d12 · ریویژن مدرک مهندسی
IF OBJECT_ID('dbo.EngineeringRevision', 'U') IS NULL
CREATE TABLE [dbo].[EngineeringRevision] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DeliverableId] NVARCHAR(60) NOT NULL,
  [RevCode] NVARCHAR(10) NOT NULL,
  [Purpose] NVARCHAR(20) NOT NULL,
  [IssuedAt] DATE NOT NULL,
  [IssuedBy] NVARCHAR(60) NULL,
  [TransmittalId] NVARCHAR(60) NULL,
  [ReviewDueAt] DATE NULL,
  [ReviewCode] NVARCHAR(10) NULL,
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATE NULL,
  [ReviewAgingDays] INT NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [IdcCompletedAt] DATE NULL,
  [DocumentId] NVARCHAR(60) NULL,
  [RemarksFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EngineeringRevision] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_EngineeringRevision_DeliverableId] FOREIGN KEY ([DeliverableId]) REFERENCES [dbo].[MdrDeliverable] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_EngineeringRevision] ON [dbo].[EngineeringRevision] ([DeliverableId], [RevCode]);
CREATE INDEX [IX_EngineeringRevision_Project] ON [dbo].[EngineeringRevision] ([ProjectId], [Status]);
CREATE INDEX [IX_EngineeringRevision_Due] ON [dbo].[EngineeringRevision] ([ProjectId], [ReviewDueAt]);
GO

-- CrsComment · d12 · نظر و پاسخ شیت بررسی
IF OBJECT_ID('dbo.CrsComment', 'U') IS NULL
CREATE TABLE [dbo].[CrsComment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RevisionId] NVARCHAR(60) NOT NULL,
  [CommentNo] INT NOT NULL,
  [RaisedBy] NVARCHAR(60) NOT NULL,
  [RaisedAt] DATE NOT NULL,
  [Discipline] NVARCHAR(40) NULL,
  [SheetRef] NVARCHAR(80) NULL,
  [Severity] NVARCHAR(20) NOT NULL,
  [CommentText] NVARCHAR(2000) NOT NULL,
  [ResponseText] NVARCHAR(2000) NULL,
  [RespondedBy] NVARCHAR(60) NULL,
  [RespondedAt] DATE NULL,
  [ResponseStatus] NVARCHAR(20) NOT NULL,
  [VerifiedBy] NVARCHAR(60) NULL,
  [VerifiedAt] DATE NULL,
  [ClosedInRevCode] NVARCHAR(10) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CrsComment] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CrsComment_RevisionId] FOREIGN KEY ([RevisionId]) REFERENCES [dbo].[EngineeringRevision] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_CrsComment] ON [dbo].[CrsComment] ([RevisionId], [CommentNo]);
CREATE INDEX [IX_CrsComment_Status] ON [dbo].[CrsComment] ([ProjectId], [ResponseStatus]);
GO

-- SquadCheck · d12 · بررسی بین‌دیسیپلینی
IF OBJECT_ID('dbo.SquadCheck', 'U') IS NULL
CREATE TABLE [dbo].[SquadCheck] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RevisionId] NVARCHAR(60) NOT NULL,
  [Discipline] NVARCHAR(40) NOT NULL,
  [ReviewerId] NVARCHAR(60) NOT NULL,
  [RequestedAt] DATE NOT NULL,
  [DueAt] DATE NULL,
  [CompletedAt] DATE NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [FindingsCount] INT NULL,
  [RemarksFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SquadCheck] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_SquadCheck_RevisionId] FOREIGN KEY ([RevisionId]) REFERENCES [dbo].[EngineeringRevision] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_SquadCheck] ON [dbo].[SquadCheck] ([RevisionId], [Discipline]);
CREATE INDEX [IX_SquadCheck_Status] ON [dbo].[SquadCheck] ([ProjectId], [Status]);
GO

-- InterfaceClashLog · d12 · لاگ تداخل مدل سه‌بعدی
IF OBJECT_ID('dbo.InterfaceClashLog', 'U') IS NULL
CREATE TABLE [dbo].[InterfaceClashLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ClashNo] NVARCHAR(40) NOT NULL,
  [DetectedAt] DATE NOT NULL,
  [SourceTool] NVARCHAR(40) NOT NULL,
  [DisciplineA] NVARCHAR(40) NOT NULL,
  [DisciplineB] NVARCHAR(40) NOT NULL,
  [ElementA] NVARCHAR(200) NULL,
  [ElementB] NVARCHAR(200) NULL,
  [Zone] NVARCHAR(80) NULL,
  [Severity] NVARCHAR(20) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [OwnerDiscipline] NVARCHAR(40) NULL,
  [ResolvedAt] DATE NULL,
  [ResolutionFa] NVARCHAR(1000) NULL,
  [ModelReviewStage] NVARCHAR(20) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_InterfaceClashLog] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_InterfaceClashLog] ON [dbo].[InterfaceClashLog] ([ProjectId], [ClashNo]);
CREATE INDEX [IX_InterfaceClashLog_Status] ON [dbo].[InterfaceClashLog] ([ProjectId], [Status]);
GO

-- TechnicalQuery · d12 · استعلام و تغییر فنی کارگاهی
IF OBJECT_ID('dbo.TechnicalQuery', 'U') IS NULL
CREATE TABLE [dbo].[TechnicalQuery] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [Kind] NVARCHAR(10) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Discipline] NVARCHAR(40) NOT NULL,
  [RaisedBy] NVARCHAR(60) NOT NULL,
  [RaisedAt] DATE NOT NULL,
  [DeliverableId] NVARCHAR(60) NULL,
  [DueAt] DATE NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [AnsweredBy] NVARCHAR(60) NULL,
  [AnsweredAt] DATE NULL,
  [AnswerText] NVARCHAR(2000) NULL,
  [CostImpact] DECIMAL(18,2) NULL,
  [TimeImpactDays] INT NULL,
  [LinkedCrCode] NVARCHAR(40) NULL,
  [RedlineDocumentId] NVARCHAR(60) NULL,
  [AsBuiltStatus] NVARCHAR(20) NULL,
  [ParentTqId] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_TechnicalQuery] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_TechnicalQuery] ON [dbo].[TechnicalQuery] ([ProjectId], [Code]);
CREATE INDEX [IX_TechnicalQuery_Status] ON [dbo].[TechnicalQuery] ([ProjectId], [Status]);
CREATE INDEX [IX_TechnicalQuery_Kind] ON [dbo].[TechnicalQuery] ([ProjectId], [Kind]);
GO

-- VendorPrintReview · d12 · بررسی مدرک فنی سازنده
IF OBJECT_ID('dbo.VendorPrintReview', 'U') IS NULL
CREATE TABLE [dbo].[VendorPrintReview] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [VendorDocNo] NVARCHAR(80) NOT NULL,
  [VendorName] NVARCHAR(200) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [PoNo] NVARCHAR(60) NULL,
  [TagNo] NVARCHAR(80) NULL,
  [Discipline] NVARCHAR(40) NOT NULL,
  [RevCode] NVARCHAR(10) NOT NULL,
  [ReceivedAt] DATE NOT NULL,
  [DueAt] DATE NULL,
  [ReviewCode] NVARCHAR(10) NULL,
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATE NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [DocumentId] NVARCHAR(60) NULL,
  [RemarksFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_VendorPrintReview] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_VendorPrintReview] ON [dbo].[VendorPrintReview] ([ProjectId], [VendorDocNo], [RevCode]);
CREATE INDEX [IX_VendorPrintReview_Po] ON [dbo].[VendorPrintReview] ([ProjectId], [PoNo]);
CREATE INDEX [IX_VendorPrintReview_Status] ON [dbo].[VendorPrintReview] ([ProjectId], [Status]);
GO

-- MaterialRequest · d12 · درخواست کالای مهندسی
IF OBJECT_ID('dbo.MaterialRequest', 'U') IS NULL
CREATE TABLE [dbo].[MaterialRequest] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Discipline] NVARCHAR(40) NOT NULL,
  [DeliverableId] NVARCHAR(60) NULL,
  [DocNo] NVARCHAR(80) NULL,
  [ItemCode] NVARCHAR(60) NULL,
  [Quantity] DECIMAL(18,3) NULL,
  [Unit] NVARCHAR(20) NULL,
  [LeadTimeDays] INT NULL,
  [NeedByDate] DATE NULL,
  [ReleaseByDate] DATE NULL,
  [RaisedBy] NVARCHAR(60) NOT NULL,
  [RaisedAt] DATE NOT NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [LinkedPrCode] NVARCHAR(40) NULL,
  [RemarksFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MaterialRequest] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_MaterialRequest] ON [dbo].[MaterialRequest] ([ProjectId], [Code]);
CREATE INDEX [IX_MaterialRequest_Deliverable] ON [dbo].[MaterialRequest] ([ProjectId], [DeliverableId]);
GO

-- EngineeringProgressSnapshot · d12 · عکس دوره‌ای پیشرفت مهندسی
IF OBJECT_ID('dbo.EngineeringProgressSnapshot', 'U') IS NULL
CREATE TABLE [dbo].[EngineeringProgressSnapshot] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [Discipline] NVARCHAR(40) NULL,
  [PlannedPct] DECIMAL(7,4) NOT NULL,
  [ActualPct] DECIMAL(7,4) NOT NULL,
  [EarnedWeight] DECIMAL(12,4) NULL,
  [SpiEng] DECIMAL(7,4) NULL,
  [DeliverableCount] INT NULL,
  [IfcIssuedCount] INT NULL,
  [OpenCommentCount] INT NULL,
  [SnapshotAt] DATETIME2 NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EngineeringProgressSnapshot] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EngineeringProgressSnapshot] ON [dbo].[EngineeringProgressSnapshot] ([ProjectId], [PeriodCode], [Discipline]) WHERE [Discipline] IS NOT NULL;
GO

-- ContractMaster · d14 · شناسنامه پیمان
IF OBJECT_ID('dbo.ContractMaster', 'U') IS NULL
CREATE TABLE [dbo].[ContractMaster] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [ContractType] NVARCHAR(30) NOT NULL,
  [Party] NVARCHAR(20) NOT NULL,
  [EmployerName] NVARCHAR(200) NOT NULL,
  [ConsultantName] NVARCHAR(200) NULL,
  [ContractorName] NVARCHAR(200) NOT NULL,
  [SignDate] DATE NOT NULL,
  [StartDate] DATE NOT NULL,
  [DurationDays] INT NOT NULL,
  [InitialAmount] DECIMAL(18,2) NOT NULL,
  [CurrentAmount] DECIMAL(18,2) NOT NULL,
  [Currency] NVARCHAR(10) NOT NULL DEFAULT 'IRR',
  [CeilingPct] DECIMAL(9,4) NOT NULL DEFAULT 25,
  [AdvancePct] DECIMAL(9,4) NULL,
  [AdvanceRecoveryPct] DECIMAL(9,4) NULL,
  [RetainagePct] DECIMAL(9,4) NOT NULL DEFAULT 10,
  [InsuranceRatePct] DECIMAL(9,4) NULL,
  [WithholdingTaxPct] DECIMAL(9,4) NULL,
  [VatPct] DECIMAL(9,4) NULL,
  [AdjustmentEnabled] BIT NOT NULL DEFAULT 0,
  [BaseIndexPeriod] NVARCHAR(20) NULL,
  [ReviewDaysConsultant] INT NULL,
  [ReviewDaysEmployer] INT NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [CostAccountCode] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractMaster] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractMaster] ON [dbo].[ContractMaster] ([ProjectId], [Code]);
CREATE INDEX [IX_ContractMaster_Status] ON [dbo].[ContractMaster] ([ProjectId], [Status]);
GO

-- VendorEvaluation · d14 · ارزیابی دوره‌ای طرف قرارداد
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
GO

-- VendorImprovement · d14 · اقدام بهبود طرف قرارداد
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
GO

-- ContractAmendment · d14 · الحاقیه پیمان
IF OBJECT_ID('dbo.ContractAmendment', 'U') IS NULL
CREATE TABLE [dbo].[ContractAmendment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [AmendmentType] NVARCHAR(20) NOT NULL,
  [EffectiveDate] DATE NOT NULL,
  [AmountDelta] DECIMAL(18,2) NULL,
  [DurationDeltaDays] INT NULL,
  [LinkedCrCode] NVARCHAR(40) NULL,
  [DocumentRef] NVARCHAR(200) NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [SubmittedAt] DATETIME2 NULL,
  [DecidedBy] NVARCHAR(60) NULL,
  [DecidedAt] DATETIME2 NULL,
  [DecisionNote] NVARCHAR(2000) NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractAmendment] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractAmendment] ON [dbo].[ContractAmendment] ([ProjectId], [Code]);
CREATE INDEX [IX_ContractAmendment_Contract] ON [dbo].[ContractAmendment] ([ContractId], [EffectiveDate]);
GO

-- ApprovalAuthority · d14 · سطح اختیار تأیید
IF OBJECT_ID('dbo.ApprovalAuthority', 'U') IS NULL
CREATE TABLE [dbo].[ApprovalAuthority] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [Level] INT NOT NULL,
  [RoleCode] NVARCHAR(40) NOT NULL,
  [MaxAmount] DECIMAL(18,2) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ApprovalAuthority] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ApprovalAuthority] ON [dbo].[ApprovalAuthority] ([ContractId], [Level], [RoleCode]);
GO

-- ContractBOQ_Item · d14 · ردیف فهرست بها
IF OBJECT_ID('dbo.ContractBOQ_Item', 'U') IS NULL
CREATE TABLE [dbo].[ContractBOQ_Item] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [ItemNo] NVARCHAR(40) NOT NULL,
  [ParentItemNo] NVARCHAR(40) NULL,
  [ChapterCode] NVARCHAR(20) NULL,
  [TitleFa] NVARCHAR(600) NOT NULL,
  [PricingBasis] NVARCHAR(20) NOT NULL,
  [Unit] NVARCHAR(20) NULL,
  [ContractQty] DECIMAL(18,3) NULL,
  [UnitRate] DECIMAL(18,2) NULL,
  [LumpSumAmount] DECIMAL(18,2) NULL,
  [LineAmount] DECIMAL(18,2) NOT NULL,
  [WbsId] NVARCHAR(60) NULL,
  [CostAccountCode] NVARCHAR(40) NULL,
  [IsStarred] BIT NOT NULL DEFAULT 0,
  [RateStatus] NVARCHAR(20) NOT NULL,
  [Status] NVARCHAR(30) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractBOQ_Item] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractBOQ_Item] ON [dbo].[ContractBOQ_Item] ([ContractId], [ItemNo]);
CREATE INDEX [IX_BOQ_Chapter] ON [dbo].[ContractBOQ_Item] ([ContractId], [ChapterCode]);
CREATE INDEX [IX_BOQ_Wbs] ON [dbo].[ContractBOQ_Item] ([ProjectId], [WbsId]);
GO

-- LumpSumMilestone · d14 · مرحله پیمان مقطوع
IF OBJECT_ID('dbo.LumpSumMilestone', 'U') IS NULL
CREATE TABLE [dbo].[LumpSumMilestone] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [BoqItemId] NVARCHAR(60) NOT NULL,
  [MilestoneNo] INT NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [WeightPct] DECIMAL(9,4) NOT NULL,
  [PlannedDate] DATE NULL,
  [AcceptanceCriteriaFa] NVARCHAR(1000) NULL,
  [AchievedDate] DATE NULL,
  [AchievedPct] DECIMAL(9,4) NULL,
  [EvidenceDocNo] NVARCHAR(80) NULL,
  [VerifiedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_LumpSumMilestone] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_LumpSumMilestone] ON [dbo].[LumpSumMilestone] ([BoqItemId], [MilestoneNo]);
CREATE INDEX [IX_LumpSumMilestone_Contract] ON [dbo].[LumpSumMilestone] ([ContractId], [Status]);
GO

-- BOQ_QuantityChange · d14 · تغییر مقادیر
IF OBJECT_ID('dbo.BOQ_QuantityChange', 'U') IS NULL
CREATE TABLE [dbo].[BOQ_QuantityChange] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [BoqItemId] NVARCHAR(60) NOT NULL,
  [ChangeNo] INT NOT NULL,
  [BaseRowVersion] INT NULL,
  [UnitRateSnapshot] DECIMAL(18,2) NULL,
  [PreviousQty] DECIMAL(18,3) NULL,
  [NewQty] DECIMAL(18,3) NULL,
  [DeltaAmount] DECIMAL(18,2) NULL,
  [ReasonFa] NVARCHAR(1000) NULL,
  [LinkedCrCode] NVARCHAR(40) NULL,
  [RequestedAt] DATE NOT NULL,
  [DocumentRef] NVARCHAR(200) NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [SubmittedAt] DATETIME2 NULL,
  [DecidedBy] NVARCHAR(60) NULL,
  [DecidedAt] DATETIME2 NULL,
  [DecisionNote] NVARCHAR(2000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_BOQ_QuantityChange] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_BOQ_QuantityChange] ON [dbo].[BOQ_QuantityChange] ([BoqItemId], [ChangeNo]);
GO

-- ExtraWorkItem · d14 · کار جدید
IF OBJECT_ID('dbo.ExtraWorkItem', 'U') IS NULL
CREATE TABLE [dbo].[ExtraWorkItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(600) NOT NULL,
  [Unit] NVARCHAR(20) NULL,
  [Quantity] DECIMAL(18,3) NULL,
  [ProposedRate] DECIMAL(18,2) NULL,
  [AgreedRate] DECIMAL(18,2) NULL,
  [ReasonFa] NVARCHAR(1000) NULL,
  [AnalysisMethod] NVARCHAR(30) NULL,
  [LinkedCrCode] NVARCHAR(40) NULL,
  [BoqItemId] NVARCHAR(60) NULL,
  [DocumentRef] NVARCHAR(200) NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [SubmittedAt] DATETIME2 NULL,
  [DecidedBy] NVARCHAR(60) NULL,
  [DecidedAt] DATETIME2 NULL,
  [DecisionNote] NVARCHAR(2000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ExtraWorkItem] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ExtraWorkItem] ON [dbo].[ExtraWorkItem] ([ContractId], [Code]);
GO

-- MeasurementSheet · d14 · برگه ریزمتره
IF OBJECT_ID('dbo.MeasurementSheet', 'U') IS NULL
CREATE TABLE [dbo].[MeasurementSheet] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [IpcId] NVARCHAR(60) NULL,
  [BoqItemId] NVARCHAR(60) NOT NULL,
  [SheetNo] INT NOT NULL,
  [LocationFa] NVARCHAR(400) NULL,
  [DrawingNo] NVARCHAR(80) NULL,
  [Count] DECIMAL(18,3) NULL,
  [Length] DECIMAL(18,3) NULL,
  [Width] DECIMAL(18,3) NULL,
  [Height] DECIMAL(18,3) NULL,
  [Factor] DECIMAL(18,4) NULL,
  [Quantity] DECIMAL(18,3) NOT NULL,
  [SourceDprId] NVARCHAR(60) NULL,
  [InspectionRecordCode] NVARCHAR(40) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MeasurementSheet] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_MeasurementSheet] ON [dbo].[MeasurementSheet] ([BoqItemId], [SheetNo]);
CREATE INDEX [IX_MeasurementSheet_Ipc] ON [dbo].[MeasurementSheet] ([ContractId], [IpcId]);
GO

-- InterimPaymentCertificate · d14 · صورت‌وضعیت موقت
IF OBJECT_ID('dbo.InterimPaymentCertificate', 'U') IS NULL
CREATE TABLE [dbo].[InterimPaymentCertificate] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [SerialNo] INT NOT NULL,
  [IpcType] NVARCHAR(20) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [PeriodFrom] DATE NOT NULL,
  [PeriodTo] DATE NOT NULL,
  [GrossCurrent] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [GrossCumulative] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [AdjustmentAmount] DECIMAL(18,2) NULL,
  [MaterialDiffAmount] DECIMAL(18,2) NULL,
  [SubtotalAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [TotalDeductions] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [VatAmount] DECIMAL(18,2) NULL,
  [NetPayable] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [WorkflowState] NVARCHAR(30) NOT NULL,
  [SubmittedAt] DATE NULL,
  [ConsultantApprovedAt] DATE NULL,
  [EmployerApprovedAt] DATE NULL,
  [PaidAt] DATE NULL,
  [PostedToFin] BIT NOT NULL DEFAULT 0,
  [LegacyRef] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_InterimPaymentCertificate] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_InterimPaymentCertificate] ON [dbo].[InterimPaymentCertificate] ([ContractId], [SerialNo]);
CREATE INDEX [IX_IPC_Period] ON [dbo].[InterimPaymentCertificate] ([ProjectId], [PeriodCode]);
CREATE INDEX [IX_IPC_Workflow] ON [dbo].[InterimPaymentCertificate] ([ProjectId], [WorkflowState]);
GO

-- IPC_LineItem · d14 · ردیف صورت‌وضعیت
IF OBJECT_ID('dbo.IPC_LineItem', 'U') IS NULL
CREATE TABLE [dbo].[IPC_LineItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [IpcId] NVARCHAR(60) NOT NULL,
  [BoqItemId] NVARCHAR(60) NOT NULL,
  [PricingBasis] NVARCHAR(20) NOT NULL,
  [PrevQty] DECIMAL(18,3) NULL,
  [CumQty] DECIMAL(18,3) NULL,
  [CurrentQty] DECIMAL(18,3) NULL,
  [PrevPct] DECIMAL(9,4) NULL,
  [CumPct] DECIMAL(9,4) NULL,
  [MilestoneId] NVARCHAR(60) NULL,
  [UnitRate] DECIMAL(18,2) NULL,
  [EarnedCurrent] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [EarnedCumulative] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [ClaimedQty] DECIMAL(18,3) NULL,
  [VerifiedQty] DECIMAL(18,3) NULL,
  [ApprovedQty] DECIMAL(18,3) NULL,
  [QualityGateStatus] NVARCHAR(20) NOT NULL,
  [OverrideBy] NVARCHAR(60) NULL,
  [OverrideReasonFa] NVARCHAR(600) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IPC_LineItem] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_IPC_LineItem] ON [dbo].[IPC_LineItem] ([IpcId], [BoqItemId]);
CREATE INDEX [IX_IPC_LineItem_Boq] ON [dbo].[IPC_LineItem] ([ProjectId], [BoqItemId]);
GO

-- IPC_WorkflowStep · d14 · گام گردش صورت‌وضعیت
IF OBJECT_ID('dbo.IPC_WorkflowStep', 'U') IS NULL
CREATE TABLE [dbo].[IPC_WorkflowStep] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [IpcId] NVARCHAR(60) NOT NULL,
  [StepNo] INT NOT NULL,
  [Actor] NVARCHAR(20) NOT NULL,
  [ActorUserId] NVARCHAR(60) NULL,
  [Action] NVARCHAR(30) NOT NULL,
  [ActedAt] DATETIME2 NOT NULL,
  [DueAt] DATE NULL,
  [OverdueDays] INT NULL,
  [CommentFa] NVARCHAR(1000) NULL,
  [SnapshotSha256] NVARCHAR(64) NULL,
  [DocumentSha256] NVARCHAR(64) NULL,
  [PrevHash] NVARCHAR(64) NULL,
  [SignatureMethod] NVARCHAR(24) NULL,
  [SignatureVersion] NVARCHAR(24) NULL,
  [AttestationFa] NVARCHAR(600) NULL,
  [GuaranteeCheckJson] NVARCHAR(MAX) NULL,
  [PkiSignature] NVARCHAR(MAX) NULL,
  [PkiCertPem] NVARCHAR(MAX) NULL,
  [PkiCertSha256] NVARCHAR(64) NULL,
  [PkiKeyId] NVARCHAR(120) NULL,
  [PkiAlgorithm] NVARCHAR(40) NULL,
  [PkiSignedAt] DATETIME2 NULL,
  [PkiTrustLevel] NVARCHAR(24) NULL,
  [PkiCertInfoJson] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IPC_WorkflowStep] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_IPC_WorkflowStep] ON [dbo].[IPC_WorkflowStep] ([IpcId], [StepNo]);
GO

-- IPC_Deduction · d14 · کسور صورت‌وضعیت
IF OBJECT_ID('dbo.IPC_Deduction', 'U') IS NULL
CREATE TABLE [dbo].[IPC_Deduction] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [IpcId] NVARCHAR(60) NOT NULL,
  [DeductionType] NVARCHAR(30) NOT NULL,
  [BaseAmount] DECIMAL(18,2) NULL,
  [RatePct] DECIMAL(9,4) NULL,
  [Amount] DECIMAL(18,2) NOT NULL,
  [IsStatutory] BIT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IPC_Deduction] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_IPC_Deduction] ON [dbo].[IPC_Deduction] ([IpcId], [DeductionType]);
GO

-- AdjustmentIndexCatalog · d14 · کاتالوگ شاخص تعدیل
IF OBJECT_ID('dbo.AdjustmentIndexCatalog', 'U') IS NULL
CREATE TABLE [dbo].[AdjustmentIndexCatalog] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [IndexPeriod] NVARCHAR(20) NOT NULL,
  [ChapterCode] NVARCHAR(20) NOT NULL,
  [IndexValue] DECIMAL(18,4) NOT NULL,
  [SourceFa] NVARCHAR(200) NULL,
  [PublishedAt] DATE NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_AdjustmentIndexCatalog] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_AdjustmentIndexCatalog] ON [dbo].[AdjustmentIndexCatalog] ([ProjectId], [IndexPeriod], [ChapterCode]);
GO

-- PriceAdjustmentCalculation · d14 · محاسبه تعدیل
IF OBJECT_ID('dbo.PriceAdjustmentCalculation', 'U') IS NULL
CREATE TABLE [dbo].[PriceAdjustmentCalculation] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [IpcId] NVARCHAR(60) NOT NULL,
  [ChapterCode] NVARCHAR(20) NOT NULL,
  [WorkAmount] DECIMAL(18,2) NOT NULL,
  [BaseIndex] DECIMAL(18,4) NOT NULL,
  [PeriodIndex] DECIMAL(18,4) NOT NULL,
  [AdjustmentFactor] DECIMAL(18,6) NOT NULL,
  [AdjustmentAmount] DECIMAL(18,2) NOT NULL,
  [AppliedRatePct] DECIMAL(9,4) NULL,
  [CalcNoteFa] NVARCHAR(600) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PriceAdjustmentCalculation] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PriceAdjustmentCalculation] ON [dbo].[PriceAdjustmentCalculation] ([IpcId], [ChapterCode]);
GO

-- MaterialDiffCalc · d14 · مابه‌التفاوت مصالح
IF OBJECT_ID('dbo.MaterialDiffCalc', 'U') IS NULL
CREATE TABLE [dbo].[MaterialDiffCalc] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [IpcId] NVARCHAR(60) NOT NULL,
  [MaterialCode] NVARCHAR(30) NOT NULL,
  [MaterialNameFa] NVARCHAR(200) NOT NULL,
  [Quantity] DECIMAL(18,3) NULL,
  [Unit] NVARCHAR(20) NULL,
  [BaseRate] DECIMAL(18,2) NULL,
  [PeriodRate] DECIMAL(18,2) NULL,
  [DiffAmount] DECIMAL(18,2) NOT NULL,
  [EvidenceDocNo] NVARCHAR(80) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MaterialDiffCalc] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_MaterialDiffCalc] ON [dbo].[MaterialDiffCalc] ([IpcId], [MaterialCode]);
GO

-- ContractGuarantee · d14 · ضمانت‌نامه
IF OBJECT_ID('dbo.ContractGuarantee', 'U') IS NULL
CREATE TABLE [dbo].[ContractGuarantee] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [GuaranteeType] NVARCHAR(20) NOT NULL,
  [BankName] NVARCHAR(200) NOT NULL,
  [GuaranteeNo] NVARCHAR(60) NOT NULL,
  [Amount] DECIMAL(18,2) NOT NULL,
  [Currency] NVARCHAR(10) NULL DEFAULT 'IRR',
  [IssueDate] DATE NOT NULL,
  [ExpiryDate] DATE NOT NULL,
  [ExtendedToDate] DATE NULL,
  [ReleaseDate] DATE NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [AlertLevel] NVARCHAR(20) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractGuarantee] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractGuarantee] ON [dbo].[ContractGuarantee] ([ProjectId], [Code]);
CREATE INDEX [IX_Guarantee_Expiry] ON [dbo].[ContractGuarantee] ([ProjectId], [ExpiryDate], [Status]);
GO

-- AdvancePaymentSchedule · d14 · برنامه پیش‌پرداخت
IF OBJECT_ID('dbo.AdvancePaymentSchedule', 'U') IS NULL
CREATE TABLE [dbo].[AdvancePaymentSchedule] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [InstallmentNo] INT NOT NULL,
  [PaidAmount] DECIMAL(18,2) NULL,
  [PaidAt] DATE NULL,
  [RecoveryPct] DECIMAL(9,4) NULL,
  [RecoveredToDate] DECIMAL(18,2) NULL DEFAULT 0,
  [OutstandingAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_AdvancePaymentSchedule] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_AdvancePaymentSchedule] ON [dbo].[AdvancePaymentSchedule] ([ContractId], [InstallmentNo]);
GO

-- RetainageLedger · d14 · دفتر سپرده حسن انجام کار
IF OBJECT_ID('dbo.RetainageLedger', 'U') IS NULL
CREATE TABLE [dbo].[RetainageLedger] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [IpcId] NVARCHAR(60) NULL,
  [EntryType] NVARCHAR(20) NOT NULL,
  [Amount] DECIMAL(18,2) NOT NULL,
  [BalanceAfter] DECIMAL(18,2) NOT NULL,
  [TriggerEvent] NVARCHAR(60) NULL,
  [TriggerDocNo] NVARCHAR(80) NULL,
  [EntryDate] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_RetainageLedger] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_RetainageLedger_Contract] ON [dbo].[RetainageLedger] ([ContractId], [EntryDate]);
GO

-- SubcontractorIPC · d14 · صورت‌وضعیت پیمانکار جزء
IF OBJECT_ID('dbo.SubcontractorIPC', 'U') IS NULL
CREATE TABLE [dbo].[SubcontractorIPC] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [MainContractId] NVARCHAR(60) NULL,
  [MainIpcId] NVARCHAR(60) NULL,
  [SerialNo] INT NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [GrossCurrent] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [TotalDeductions] DECIMAL(18,2) NULL,
  [NetPayable] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [WorkflowState] NVARCHAR(30) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SubcontractorIPC] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_SubcontractorIPC] ON [dbo].[SubcontractorIPC] ([ContractId], [SerialNo]);
GO

-- SubcontractorIPC_LineItem · d14 · ردیف صورت‌وضعیت جزء
IF OBJECT_ID('dbo.SubcontractorIPC_LineItem', 'U') IS NULL
CREATE TABLE [dbo].[SubcontractorIPC_LineItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SubIpcId] NVARCHAR(60) NOT NULL,
  [BoqItemId] NVARCHAR(60) NULL,
  [DescriptionFa] NVARCHAR(600) NOT NULL,
  [Unit] NVARCHAR(20) NULL,
  [Quantity] DECIMAL(18,3) NULL,
  [UnitRate] DECIMAL(18,2) NULL,
  [Amount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [MainApprovedQty] DECIMAL(18,3) NULL,
  [VarianceFlag] NVARCHAR(20) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SubcontractorIPC_LineItem] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_SubIpcLine_Sub] ON [dbo].[SubcontractorIPC_LineItem] ([SubIpcId], [BoqItemId]);
GO

-- BackToBackDeduction · d14 · کسور متقابل
IF OBJECT_ID('dbo.BackToBackDeduction', 'U') IS NULL
CREATE TABLE [dbo].[BackToBackDeduction] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SubIpcId] NVARCHAR(60) NOT NULL,
  [SourceModule] NVARCHAR(30) NOT NULL,
  [SourceRefCode] NVARCHAR(60) NULL,
  [DescriptionFa] NVARCHAR(600) NOT NULL,
  [Amount] DECIMAL(18,2) NOT NULL,
  [EvidenceDocNo] NVARCHAR(80) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_BackToBackDeduction] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_BackToBack_Sub] ON [dbo].[BackToBackDeduction] ([SubIpcId], [SourceModule]);
GO

-- ContractMetricsSnapshot · d14 · عکس شاخص پیمان
IF OBJECT_ID('dbo.ContractMetricsSnapshot', 'U') IS NULL
CREATE TABLE [dbo].[ContractMetricsSnapshot] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [PhysicalPct] DECIMAL(9,4) NULL,
  [FinancialPct] DECIMAL(9,4) NULL,
  [VariancePct] DECIMAL(9,4) NULL,
  [CeilingUsedPct] DECIMAL(9,4) NULL,
  [AdvanceRecoveredPct] DECIMAL(9,4) NULL,
  [ExtraWorkRatioPct] DECIMAL(9,4) NULL,
  [AvgIpcCycleDays] DECIMAL(9,2) NULL,
  [OpenGuaranteeCount] INT NULL,
  [ExpiringGuaranteeCount] INT NULL,
  [IsGapReliable] BIT NULL,
  [RetainageBalance] DECIMAL(18,2) NULL,
  [SnapshotAt] DATETIME2 NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractMetricsSnapshot] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractMetricsSnapshot] ON [dbo].[ContractMetricsSnapshot] ([ContractId], [PeriodCode]);
GO

-- ContractAlertRule · d14 · قاعده هشدار پیمان
IF OBJECT_ID('dbo.ContractAlertRule', 'U') IS NULL
CREATE TABLE [dbo].[ContractAlertRule] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RuleCode] NVARCHAR(30) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Severity] NVARCHAR(20) NOT NULL,
  [ThresholdValue] DECIMAL(18,4) NULL,
  [IsEnabled] BIT NOT NULL DEFAULT 1,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractAlertRule] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractAlertRule] ON [dbo].[ContractAlertRule] ([ProjectId], [RuleCode]);
GO

-- ContractFinPosting · d14 · ثبت صورت‌وضعیت در مالی
IF OBJECT_ID('dbo.ContractFinPosting', 'U') IS NULL
CREATE TABLE [dbo].[ContractFinPosting] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NOT NULL,
  [IpcId] NVARCHAR(60) NOT NULL,
  [SerialNo] INT NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [CostAccountId] NVARCHAR(60) NOT NULL,
  [GrossAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [NetAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [DeductionAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [VatAmount] DECIMAL(18,2) NULL DEFAULT 0,
  [PreviousActual] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [NextActual] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [MemoFa] NVARCHAR(600) NULL,
  [PostedBy] NVARCHAR(60) NOT NULL,
  [PostedAt] DATETIME2 NOT NULL,
  [ReversedBy] NVARCHAR(60) NULL,
  [ReversedAt] DATETIME2 NULL,
  [ReversalReasonFa] NVARCHAR(600) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ContractFinPosting] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ContractFinPosting_Ipc] ON [dbo].[ContractFinPosting] ([IpcId]);
CREATE INDEX [IX_ContractFinPosting_Account] ON [dbo].[ContractFinPosting] ([CostAccountId], [PeriodCode]);
GO

-- CompletionCertificate · d15 · گواهی تحویل
IF OBJECT_ID('dbo.CompletionCertificate', 'U') IS NULL
CREATE TABLE [dbo].[CompletionCertificate] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NULL,
  [CertificateType] NVARCHAR(10) NOT NULL,
  [CertificateNo] NVARCHAR(80) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [HandoverDate] DATE NOT NULL,
  [IssueDate] DATE NULL,
  [WarrantyMonths] INT NULL,
  [WarrantyEndDate] DATE NULL,
  [PredecessorId] NVARCHAR(60) NULL,
  [OpenPunchCount] INT NULL,
  [SystemId] NVARCHAR(60) NULL,
  [ReadyForGateAt] DATE NULL,
  [CommitteeFa] NVARCHAR(600) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CompletionCertificate] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CompletionCertificate] ON [dbo].[CompletionCertificate] ([ProjectId], [CertificateNo]);
CREATE INDEX [IX_CompletionCertificate_Type] ON [dbo].[CompletionCertificate] ([ProjectId], [CertificateType], [Status]);
CREATE INDEX [IX_CompletionCertificate_Contract] ON [dbo].[CompletionCertificate] ([ContractId], [CertificateType]);
GO

-- PunchListItem · d15 · نقص فهرست تحویل
IF OBJECT_ID('dbo.PunchListItem', 'U') IS NULL
CREATE TABLE [dbo].[PunchListItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CertificateId] NVARCHAR(60) NULL,
  [ContractId] NVARCHAR(60) NULL,
  [ItemNo] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(600) NOT NULL,
  [Category] NVARCHAR(20) NOT NULL,
  [SystemId] NVARCHAR(60) NULL,
  [DisciplineCode] NVARCHAR(20) NULL,
  [LocationFa] NVARCHAR(200) NULL,
  [RaisedBy] NVARCHAR(60) NULL,
  [RaisedAt] DATE NOT NULL,
  [DueDate] DATE NULL,
  [ClosedAt] DATE NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [EvidenceDocNo] NVARCHAR(80) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PunchListItem] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PunchListItem] ON [dbo].[PunchListItem] ([ProjectId], [ItemNo]);
CREATE INDEX [IX_PunchListItem_Cert] ON [dbo].[PunchListItem] ([CertificateId], [Status]);
CREATE INDEX [IX_PunchListItem_Category] ON [dbo].[PunchListItem] ([ProjectId], [Category], [Status]);
CREATE INDEX [IX_PunchListItem_Gate] ON [dbo].[PunchListItem] ([ProjectId], [SystemId], [Category], [Status]);
GO

-- SystemSubsystem · d15 · سیستم و زیرسیستم
IF OBJECT_ID('dbo.SystemSubsystem', 'U') IS NULL
CREATE TABLE [dbo].[SystemSubsystem] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ParentId] NVARCHAR(60) NULL,
  [SystemCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [TitleEn] NVARCHAR(400) NULL,
  [SystemType] NVARCHAR(20) NOT NULL,
  [DisciplineCode] NVARCHAR(20) NULL,
  [CommissioningPriority] INT NULL,
  [CriticalityFa] NVARCHAR(10) NULL,
  [OwnerUserId] NVARCHAR(60) NULL,
  [SortOrder] INT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SystemSubsystem] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_SystemSubsystem_Code] ON [dbo].[SystemSubsystem] ([ProjectId], [SystemCode]);
CREATE INDEX [IX_SystemSubsystem_Parent] ON [dbo].[SystemSubsystem] ([ParentId]);
CREATE INDEX [IX_SystemSubsystem_Status] ON [dbo].[SystemSubsystem] ([ProjectId], [Status]);
GO

-- SystemBoundaryMapping · d15 · مرزبندی سیستم
IF OBJECT_ID('dbo.SystemBoundaryMapping', 'U') IS NULL
CREATE TABLE [dbo].[SystemBoundaryMapping] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SystemId] NVARCHAR(60) NOT NULL,
  [TargetKind] NVARCHAR(20) NOT NULL,
  [TargetRef] NVARCHAR(120) NOT NULL,
  [BoundaryNoteFa] NVARCHAR(600) NULL,
  [IsPrimary] BIT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SystemBoundaryMapping] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_SystemBoundary] ON [dbo].[SystemBoundaryMapping] ([SystemId], [TargetKind], [TargetRef]);
CREATE INDEX [IX_SystemBoundary_Target] ON [dbo].[SystemBoundaryMapping] ([ProjectId], [TargetKind], [TargetRef]);
GO

-- SystemMilestoneTarget · d15 · تاریخ هدف دروازه
IF OBJECT_ID('dbo.SystemMilestoneTarget', 'U') IS NULL
CREATE TABLE [dbo].[SystemMilestoneTarget] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SystemId] NVARCHAR(60) NOT NULL,
  [GateType] NVARCHAR(10) NOT NULL,
  [TargetDate] DATE NOT NULL,
  [ForecastDate] DATE NULL,
  [ActualDate] DATE NULL,
  [SlipDays] INT NULL,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SystemMilestoneTarget] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_SystemMilestone] ON [dbo].[SystemMilestoneTarget] ([SystemId], [GateType]);
CREATE INDEX [IX_SystemMilestone_Gate] ON [dbo].[SystemMilestoneTarget] ([ProjectId], [GateType], [TargetDate]);
GO

-- CheckRecordPack · d15 · بستهٔ آزمون
IF OBJECT_ID('dbo.CheckRecordPack', 'U') IS NULL
CREATE TABLE [dbo].[CheckRecordPack] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SystemId] NVARCHAR(60) NOT NULL,
  [PackNo] NVARCHAR(60) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [PackType] NVARCHAR(10) NOT NULL,
  [DisciplineCode] NVARCHAR(20) NULL,
  [TotalSheets] INT NULL,
  [ClearedSheets] INT NULL,
  [ClearedAt] DATE NULL,
  [ClearedBy] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CheckRecordPack] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CheckRecordPack] ON [dbo].[CheckRecordPack] ([ProjectId], [PackNo]);
CREATE INDEX [IX_CheckRecordPack_System] ON [dbo].[CheckRecordPack] ([SystemId], [PackType], [Status]);
GO

-- CheckSheet · d15 · برگهٔ آزمون
IF OBJECT_ID('dbo.CheckSheet', 'U') IS NULL
CREATE TABLE [dbo].[CheckSheet] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PackId] NVARCHAR(60) NOT NULL,
  [SheetNo] NVARCHAR(60) NOT NULL,
  [SheetType] NVARCHAR(10) NOT NULL,
  [TestKind] NVARCHAR(30) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [TestDate] DATE NULL,
  [TestedBy] NVARCHAR(60) NULL,
  [WitnessedBy] NVARCHAR(60) NULL,
  [ResultFa] NVARCHAR(20) NULL,
  [NcrRef] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CheckSheet] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CheckSheet] ON [dbo].[CheckSheet] ([ProjectId], [SheetNo]);
CREATE INDEX [IX_CheckSheet_Pack] ON [dbo].[CheckSheet] ([PackId], [Status]);
CREATE INDEX [IX_CheckSheet_Kind] ON [dbo].[CheckSheet] ([ProjectId], [SheetType], [TestKind]);
GO

-- CheckSheetLine · d15 · ردیف برگهٔ آزمون
IF OBJECT_ID('dbo.CheckSheetLine', 'U') IS NULL
CREATE TABLE [dbo].[CheckSheetLine] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SheetId] NVARCHAR(60) NOT NULL,
  [LineNo] INT NOT NULL,
  [ParameterFa] NVARCHAR(300) NOT NULL,
  [ExpectedValue] NVARCHAR(120) NULL,
  [ActualValue] NVARCHAR(120) NULL,
  [UnitFa] NVARCHAR(40) NULL,
  [IsMandatory] BIT NOT NULL DEFAULT 1,
  [Passed] BIT NULL,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CheckSheetLine] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CheckSheetLine] ON [dbo].[CheckSheetLine] ([SheetId], [LineNo]);
CREATE INDEX [IX_CheckSheetLine_Sheet] ON [dbo].[CheckSheetLine] ([SheetId], [IsMandatory]);
GO

-- CommissioningTag · d15 · بانک تگ راه‌اندازی
IF OBJECT_ID('dbo.CommissioningTag', 'U') IS NULL
CREATE TABLE [dbo].[CommissioningTag] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SystemId] NVARCHAR(60) NULL,
  [TagNo] NVARCHAR(80) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [TitleEn] NVARCHAR(400) NULL,
  [TagType] NVARCHAR(20) NOT NULL,
  [DisciplineCode] NVARCHAR(20) NULL,
  [LocationFa] NVARCHAR(300) NULL,
  [LoopNo] NVARCHAR(60) NULL,
  [ManufacturerFa] NVARCHAR(200) NULL,
  [ModelFa] NVARCHAR(200) NULL,
  [SerialNo] NVARCHAR(120) NULL,
  [CriticalityFa] NVARCHAR(10) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CommissioningTag] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CommissioningTag_No] ON [dbo].[CommissioningTag] ([ProjectId], [TagNo]);
CREATE INDEX [IX_CommissioningTag_System] ON [dbo].[CommissioningTag] ([SystemId], [TagType], [Status]);
CREATE INDEX [IX_CommissioningTag_Type] ON [dbo].[CommissioningTag] ([ProjectId], [TagType], [Status]);
GO

-- DocumentAttachment · d1 · پیوست مدرک
IF OBJECT_ID('dbo.DocumentAttachment', 'U') IS NULL
CREATE TABLE [dbo].[DocumentAttachment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NOT NULL,
  [DocNo] NVARCHAR(80) NOT NULL,
  [Revision] NVARCHAR(10) NOT NULL,
  [FileName] NVARCHAR(300) NOT NULL,
  [MimeType] NVARCHAR(120) NOT NULL,
  [SizeBytes] INT NOT NULL,
  [StorageKey] NVARCHAR(400) NOT NULL,
  [ChecksumSha256] NVARCHAR(80) NULL,
  [UploadedBy] NVARCHAR(60) NOT NULL,
  [UploadedAt] DATETIME2 NOT NULL,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_DocumentAttachment] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_DocAttach_Doc] ON [dbo].[DocumentAttachment] ([DocumentId]);
CREATE INDEX [IX_DocAttach_DocNoRev] ON [dbo].[DocumentAttachment] ([ProjectId], [DocNo], [Revision]);
CREATE INDEX [IX_DocAttach_Project] ON [dbo].[DocumentAttachment] ([ProjectId], [UploadedAt]);
GO

-- DocumentHold · d1 · هولد مدرک
IF OBJECT_ID('dbo.DocumentHold', 'U') IS NULL
CREATE TABLE [dbo].[DocumentHold] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NOT NULL,
  [DocNo] NVARCHAR(80) NOT NULL,
  [Revision] NVARCHAR(10) NOT NULL,
  [HoldNo] NVARCHAR(60) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [HoldType] NVARCHAR(20) NOT NULL,
  [RaisedBy] NVARCHAR(60) NOT NULL,
  [RaisedAt] DATETIME2 NOT NULL,
  [DueAt] DATE NULL,
  [ReleasedBy] NVARCHAR(60) NULL,
  [ReleasedAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_DocumentHold] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_DocHold_No] ON [dbo].[DocumentHold] ([ProjectId], [HoldNo]);
CREATE INDEX [IX_DocHold_Doc] ON [dbo].[DocumentHold] ([DocumentId], [Status]);
CREATE INDEX [IX_DocHold_Status] ON [dbo].[DocumentHold] ([ProjectId], [Status], [DueAt]);
GO

-- DocumentDependency · d1 · پیش‌نیاز مدرک
IF OBJECT_ID('dbo.DocumentDependency', 'U') IS NULL
CREATE TABLE [dbo].[DocumentDependency] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NOT NULL,
  [DependsOnDocumentId] NVARCHAR(60) NOT NULL,
  [DependencyType] NVARCHAR(20) NOT NULL,
  [IsMandatory] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_DocumentDependency] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_DocDep] ON [dbo].[DocumentDependency] ([DocumentId], [DependsOnDocumentId]);
CREATE INDEX [IX_DocDep_Prereq] ON [dbo].[DocumentDependency] ([DependsOnDocumentId]);
CREATE INDEX [IX_DocDep_Project] ON [dbo].[DocumentDependency] ([ProjectId], [DocumentId]);
GO

-- DocumentComment · d1 · نظر و جمع‌بندی مدرک
IF OBJECT_ID('dbo.DocumentComment', 'U') IS NULL
CREATE TABLE [dbo].[DocumentComment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NOT NULL,
  [DocNo] NVARCHAR(80) NOT NULL,
  [Revision] NVARCHAR(10) NOT NULL,
  [CommentNo] INT NOT NULL,
  [CommentText] NVARCHAR(2000) NOT NULL,
  [CommentedBy] NVARCHAR(60) NOT NULL,
  [CommentedAt] DATETIME2 NOT NULL,
  [ReplyText] NVARCHAR(2000) NULL,
  [RepliedBy] NVARCHAR(60) NULL,
  [RepliedAt] DATETIME2 NULL,
  [ConclusionText] NVARCHAR(2000) NULL,
  [ConcludedBy] NVARCHAR(60) NULL,
  [ConcludedAt] DATETIME2 NULL,
  [ReviewCode] NVARCHAR(10) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_DocumentComment] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_DocComment_No] ON [dbo].[DocumentComment] ([DocumentId], [CommentNo]);
CREATE INDEX [IX_DocComment_Status] ON [dbo].[DocumentComment] ([ProjectId], [Status]);
CREATE INDEX [IX_DocComment_Doc] ON [dbo].[DocumentComment] ([DocumentId], [Status]);
GO

-- DocumentDistribution · d1 · توزیع مدرک
IF OBJECT_ID('dbo.DocumentDistribution', 'U') IS NULL
CREATE TABLE [dbo].[DocumentDistribution] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NOT NULL,
  [DocNo] NVARCHAR(80) NOT NULL,
  [Revision] NVARCHAR(10) NOT NULL,
  [Party] NVARCHAR(30) NOT NULL,
  [TransmittalNo] NVARCHAR(80) NULL,
  [DistributedAt] DATETIME2 NOT NULL,
  [DistributedBy] NVARCHAR(60) NOT NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_DocumentDistribution] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_DocDist_Id] ON [dbo].[DocumentDistribution] ([Id]);
CREATE INDEX [IX_DocDist_Doc] ON [dbo].[DocumentDistribution] ([ProjectId], [DocumentId]);
CREATE INDEX [IX_DocDist_Party] ON [dbo].[DocumentDistribution] ([ProjectId], [Party]);
GO

-- DocumentTemplate · d1 · قالب مدرک/ترنسمیتال
IF OBJECT_ID('dbo.DocumentTemplate', 'U') IS NULL
CREATE TABLE [dbo].[DocumentTemplate] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [TemplateType] NVARCHAR(30) NOT NULL,
  [NameFa] NVARCHAR(120) NOT NULL,
  [Code] NVARCHAR(40) NULL,
  [ContentJson] NVARCHAR(5000) NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_DocumentTemplate] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_DocTpl_Id] ON [dbo].[DocumentTemplate] ([Id]);
CREATE INDEX [IX_DocTpl_ProjectType] ON [dbo].[DocumentTemplate] ([ProjectId], [TemplateType]);
GO

-- EdmsNotification · d1 · اعلان EDMS
IF OBJECT_ID('dbo.EdmsNotification', 'U') IS NULL
CREATE TABLE [dbo].[EdmsNotification] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NOT NULL,
  [DocNo] NVARCHAR(80) NOT NULL,
  [EventType] NVARCHAR(40) NOT NULL,
  [RecipientParty] NVARCHAR(30) NOT NULL,
  [RecipientEmail] NVARCHAR(200) NULL,
  [SubjectFa] NVARCHAR(200) NOT NULL,
  [BodyFa] NVARCHAR(2000) NULL,
  [Channel] NVARCHAR(20) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [SentAt] DATETIME2 NULL,
  [ErrorText] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EdmsNotification] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EdmsNotif_Id] ON [dbo].[EdmsNotification] ([Id]);
CREATE INDEX [IX_EdmsNotif_Project] ON [dbo].[EdmsNotification] ([ProjectId], [Status]);
CREATE INDEX [IX_EdmsNotif_Doc] ON [dbo].[EdmsNotification] ([DocumentId], [EventType]);
GO

-- DocumentEffort · d1 · نفرساعت مدرک
IF OBJECT_ID('dbo.DocumentEffort', 'U') IS NULL
CREATE TABLE [dbo].[DocumentEffort] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NOT NULL,
  [DocNo] NVARCHAR(80) NOT NULL,
  [Revision] NVARCHAR(10) NOT NULL,
  [PersonId] NVARCHAR(60) NULL,
  [PersonName] NVARCHAR(120) NULL,
  [WorkDate] NVARCHAR(20) NOT NULL,
  [Hours] DECIMAL(18,2) NOT NULL,
  [Cost] DECIMAL(18,2) NULL,
  [Activity] NVARCHAR(40) NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_DocumentEffort] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_DocEffort_Id] ON [dbo].[DocumentEffort] ([Id]);
CREATE INDEX [IX_DocEffort_Doc] ON [dbo].[DocumentEffort] ([ProjectId], [DocumentId]);
CREATE INDEX [IX_DocEffort_Date] ON [dbo].[DocumentEffort] ([ProjectId], [WorkDate]);
GO

-- DocumentSubReview · d1 · شفاف‌سازی فنی پیمانکار فرعی
IF OBJECT_ID('dbo.DocumentSubReview', 'U') IS NULL
CREATE TABLE [dbo].[DocumentSubReview] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NOT NULL,
  [DocNo] NVARCHAR(80) NOT NULL,
  [Revision] NVARCHAR(10) NOT NULL,
  [SubcontractorParty] NVARCHAR(40) NOT NULL,
  [QuestionFa] NVARCHAR(2000) NOT NULL,
  [AnswerFa] NVARCHAR(2000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [AskedBy] NVARCHAR(60) NOT NULL,
  [AskedAt] DATETIME2 NOT NULL,
  [AnsweredBy] NVARCHAR(60) NULL,
  [AnsweredAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_DocumentSubReview] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_DocSub_Id] ON [dbo].[DocumentSubReview] ([Id]);
CREATE INDEX [IX_DocSub_Doc] ON [dbo].[DocumentSubReview] ([ProjectId], [DocumentId]);
CREATE INDEX [IX_DocSub_Status] ON [dbo].[DocumentSubReview] ([ProjectId], [Status]);
GO

-- CkmInboxItem · d11 · کارتابل کاربر
IF OBJECT_ID('dbo.CkmInboxItem', 'U') IS NULL
CREATE TABLE [dbo].[CkmInboxItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RecipientUserId] NVARCHAR(60) NOT NULL,
  [Type] NVARCHAR(30) NOT NULL,
  [ReferenceId] NVARCHAR(80) NOT NULL,
  [TitleFa] NVARCHAR(500) NOT NULL,
  [DueAt] NVARCHAR(20) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [ReadAt] DATETIME2 NULL,
  [DoneAt] DATETIME2 NULL,
  [Priority] NVARCHAR(20) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CkmInboxItem] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CkmInbox_Id] ON [dbo].[CkmInboxItem] ([Id]);
CREATE INDEX [IX_CkmInbox_Recipient] ON [dbo].[CkmInboxItem] ([ProjectId], [RecipientUserId], [Status]);
CREATE INDEX [IX_CkmInbox_Type] ON [dbo].[CkmInboxItem] ([ProjectId], [Type]);
GO

-- CkmReferral · d11 · ارجاع مکاتبه
IF OBJECT_ID('dbo.CkmReferral', 'U') IS NULL
CREATE TABLE [dbo].[CkmReferral] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [LetterNo] NVARCHAR(80) NOT NULL,
  [FromUserId] NVARCHAR(60) NOT NULL,
  [ToUserId] NVARCHAR(60) NOT NULL,
  [InstructionFa] NVARCHAR(1000) NOT NULL,
  [Deadline] NVARCHAR(20) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [DoneAt] DATETIME2 NULL,
  [DoneNoteFa] NVARCHAR(1000) NULL,
  [HistoryJson] NVARCHAR(5000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CkmReferral] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CkmReferral_Id] ON [dbo].[CkmReferral] ([Id]);
CREATE INDEX [IX_CkmReferral_Letter] ON [dbo].[CkmReferral] ([ProjectId], [LetterNo]);
CREATE INDEX [IX_CkmReferral_To] ON [dbo].[CkmReferral] ([ProjectId], [ToUserId], [Status]);
GO

-- CkmLetterSequence · d11 · شماره‌گذاری نامه
IF OBJECT_ID('dbo.CkmLetterSequence', 'U') IS NULL
CREATE TABLE [dbo].[CkmLetterSequence] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Prefix] NVARCHAR(20) NOT NULL,
  [LastNumber] INT NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CkmLetterSequence] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CkmSeq_Id] ON [dbo].[CkmLetterSequence] ([Id]);
CREATE UNIQUE INDEX [UX_CkmSeq_ProjectPrefix] ON [dbo].[CkmLetterSequence] ([ProjectId], [Prefix]);
GO

-- CkmSignature · d11 · امضای الکترونیکی نامه
IF OBJECT_ID('dbo.CkmSignature', 'U') IS NULL
CREATE TABLE [dbo].[CkmSignature] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [LetterNo] NVARCHAR(80) NOT NULL,
  [SignedBy] NVARCHAR(60) NOT NULL,
  [SignedAt] DATETIME2 NOT NULL,
  [SignatureHash] NVARCHAR(200) NULL,
  [Method] NVARCHAR(30) NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CkmSignature] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CkmSig_Id] ON [dbo].[CkmSignature] ([Id]);
CREATE INDEX [IX_CkmSig_Letter] ON [dbo].[CkmSignature] ([ProjectId], [LetterNo]);
GO

-- CkmLetterLink · d11 · پیوند نامه به مدرک/Tag/بسته خرید
IF OBJECT_ID('dbo.CkmLetterLink', 'U') IS NULL
CREATE TABLE [dbo].[CkmLetterLink] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [LetterNo] NVARCHAR(80) NOT NULL,
  [LinkType] NVARCHAR(20) NOT NULL,
  [TargetId] NVARCHAR(80) NOT NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CkmLetterLink] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CkmLink_Id] ON [dbo].[CkmLetterLink] ([Id]);
CREATE INDEX [IX_CkmLink_Letter] ON [dbo].[CkmLetterLink] ([ProjectId], [LetterNo]);
CREATE INDEX [IX_CkmLink_TypeTarget] ON [dbo].[CkmLetterLink] ([ProjectId], [LinkType], [TargetId]);
GO

-- ScmVendor · d5 · فروشنده
IF OBJECT_ID('dbo.ScmVendor', 'U') IS NULL
CREATE TABLE [dbo].[ScmVendor] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [NameEn] NVARCHAR(300) NULL,
  [ContactPerson] NVARCHAR(200) NULL,
  [Email] NVARCHAR(200) NULL,
  [Phone] NVARCHAR(60) NULL,
  [Country] NVARCHAR(60) NULL,
  [City] NVARCHAR(80) NULL,
  [Disciplines] NVARCHAR(MAX) NULL,
  [MaterialCategories] NVARCHAR(MAX) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmVendor] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmVendor_Code] ON [dbo].[ScmVendor] ([ProjectId], [Code]);
CREATE INDEX [IX_ScmVendor_Status] ON [dbo].[ScmVendor] ([ProjectId], [Status]);
GO

-- ScmAvlEntry · d5 · فهرست فروشندگان مجاز
IF OBJECT_ID('dbo.ScmAvlEntry', 'U') IS NULL
CREATE TABLE [dbo].[ScmAvlEntry] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [VendorId] NVARCHAR(60) NOT NULL,
  [Discipline] NVARCHAR(40) NOT NULL,
  [MaterialCategory] NVARCHAR(60) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ExpiryAt] DATE NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'approved',
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmAvlEntry] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmAvl_VendorDisc] ON [dbo].[ScmAvlEntry] ([ProjectId], [VendorId], [Discipline], [MaterialCategory]) WHERE [MaterialCategory] IS NOT NULL;
CREATE INDEX [IX_ScmAvl_Discipline] ON [dbo].[ScmAvlEntry] ([ProjectId], [Discipline], [Status]);
GO

-- ScmProcPackage · d5 · بسته خرید
IF OBJECT_ID('dbo.ScmProcPackage', 'U') IS NULL
CREATE TABLE [dbo].[ScmProcPackage] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [Discipline] NVARCHAR(40) NULL,
  [WbsId] NVARCHAR(60) NULL,
  [Status] NVARCHAR(30) NOT NULL DEFAULT 'draft',
  [PlannedIssueDate] DATE NULL,
  [TotalEstimatedAmount] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(10) NULL DEFAULT 'IRR',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmProcPackage] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmProcPkg_Code] ON [dbo].[ScmProcPackage] ([ProjectId], [Code]);
CREATE INDEX [IX_ScmProcPkg_Status] ON [dbo].[ScmProcPackage] ([ProjectId], [Status]);
CREATE INDEX [IX_ScmProcPkg_Disc] ON [dbo].[ScmProcPackage] ([ProjectId], [Discipline]);
GO

-- ScmPackageMrLink · d5 · پیوند بسته خرید به MR
IF OBJECT_ID('dbo.ScmPackageMrLink', 'U') IS NULL
CREATE TABLE [dbo].[ScmPackageMrLink] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PackageId] NVARCHAR(60) NOT NULL,
  [MrCode] NVARCHAR(40) NOT NULL,
  [AddedBy] NVARCHAR(60) NOT NULL,
  [AddedAt] DATETIME2 NOT NULL,
  [NoteFa] NVARCHAR(300) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmPackageMrLink] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmPkgMr] ON [dbo].[ScmPackageMrLink] ([PackageId], [MrCode]);
CREATE INDEX [IX_ScmPkgMr_Project] ON [dbo].[ScmPackageMrLink] ([ProjectId], [PackageId]);
CREATE INDEX [IX_ScmPkgMr_Mr] ON [dbo].[ScmPackageMrLink] ([ProjectId], [MrCode]);
GO

-- ScmInquiryPackage · d5 · بسته استعلام
IF OBJECT_ID('dbo.ScmInquiryPackage', 'U') IS NULL
CREATE TABLE [dbo].[ScmInquiryPackage] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PackageId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [InquiryType] NVARCHAR(20) NULL DEFAULT 'rfq',
  [IssueDate] DATE NULL,
  [DueDate] DATE NULL,
  [Status] NVARCHAR(30) NOT NULL DEFAULT 'draft',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmInquiryPackage] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmInq_Code] ON [dbo].[ScmInquiryPackage] ([ProjectId], [Code]);
CREATE INDEX [IX_ScmInq_Package] ON [dbo].[ScmInquiryPackage] ([PackageId]);
CREATE INDEX [IX_ScmInq_Status] ON [dbo].[ScmInquiryPackage] ([ProjectId], [Status]);
GO

-- ScmBidderList · d5 · فهرست مناقصه‌گران
IF OBJECT_ID('dbo.ScmBidderList', 'U') IS NULL
CREATE TABLE [dbo].[ScmBidderList] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [InquiryPackageId] NVARCHAR(60) NOT NULL,
  [VendorId] NVARCHAR(60) NOT NULL,
  [ListType] NVARCHAR(10) NOT NULL DEFAULT 'sbl',
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'invited',
  [InvitedAt] DATETIME2 NULL,
  [AcknowledgedAt] DATETIME2 NULL,
  [DeclineReasonFa] NVARCHAR(500) NULL,
  [NoteFa] NVARCHAR(300) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmBidderList] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmBidder] ON [dbo].[ScmBidderList] ([InquiryPackageId], [VendorId]);
CREATE INDEX [IX_ScmBidder_Project] ON [dbo].[ScmBidderList] ([ProjectId], [ListType], [Status]);
GO

-- ScmInvitation · d5 · دعوت‌نامه مناقصه
IF OBJECT_ID('dbo.ScmInvitation', 'U') IS NULL
CREATE TABLE [dbo].[ScmInvitation] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [InquiryPackageId] NVARCHAR(60) NOT NULL,
  [VendorId] NVARCHAR(60) NOT NULL,
  [InvitationNo] NVARCHAR(60) NOT NULL,
  [SentAt] DATETIME2 NOT NULL,
  [SentBy] NVARCHAR(60) NOT NULL,
  [ValidUntil] DATE NULL,
  [AckAt] DATETIME2 NULL,
  [AckStatus] NVARCHAR(20) NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmInvitation] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmInv_No] ON [dbo].[ScmInvitation] ([ProjectId], [InvitationNo]);
CREATE INDEX [IX_ScmInv_InqVendor] ON [dbo].[ScmInvitation] ([InquiryPackageId], [VendorId]);
GO

-- ScmMrChangeLog · d5 · لاگ تغییر MR
IF OBJECT_ID('dbo.ScmMrChangeLog', 'U') IS NULL
CREATE TABLE [dbo].[ScmMrChangeLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MrCode] NVARCHAR(40) NOT NULL,
  [ChangeType] NVARCHAR(20) NOT NULL,
  [OldValue] NVARCHAR(2000) NULL,
  [NewValue] NVARCHAR(2000) NULL,
  [ChangedBy] NVARCHAR(60) NOT NULL,
  [ChangedAt] DATETIME2 NOT NULL,
  [NotifiedAt] DATETIME2 NULL,
  [NotifyStatus] NVARCHAR(20) NOT NULL DEFAULT 'pending',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmMrChangeLog] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ScmMrChange_Mr] ON [dbo].[ScmMrChangeLog] ([ProjectId], [MrCode], [ChangedAt]);
CREATE INDEX [IX_ScmMrChange_Status] ON [dbo].[ScmMrChangeLog] ([ProjectId], [NotifyStatus]);
GO

-- ScmMrr · d5 · رسید مواد MRS/OPI
IF OBJECT_ID('dbo.ScmMrr', 'U') IS NULL
CREATE TABLE [dbo].[ScmMrr] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [PoNo] NVARCHAR(40) NOT NULL,
  [ReceivedAt] DATE NOT NULL,
  [ReceivedBy] NVARCHAR(60) NOT NULL,
  [Quantity] DECIMAL(18,3) NULL,
  [AcceptedQty] DECIMAL(18,3) NULL,
  [RejectedQty] DECIMAL(18,3) NULL,
  [OverQty] DECIMAL(18,3) NULL,
  [ShortageQty] DECIMAL(18,3) NULL,
  [DamageQty] DECIMAL(18,3) NULL,
  [OpiType] NVARCHAR(20) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [Warehouse] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmMrr] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmMrr_Code] ON [dbo].[ScmMrr] ([ProjectId], [Code]);
CREATE INDEX [IX_ScmMrr_Po] ON [dbo].[ScmMrr] ([ProjectId], [PoNo]);
CREATE INDEX [IX_ScmMrr_Status] ON [dbo].[ScmMrr] ([ProjectId], [Status]);
GO

-- ScmProposal · d5 · پیشنهاد فنی/بازرگانی
IF OBJECT_ID('dbo.ScmProposal', 'U') IS NULL
CREATE TABLE [dbo].[ScmProposal] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ProposalNo] NVARCHAR(40) NOT NULL,
  [InquiryPackageId] NVARCHAR(60) NOT NULL,
  [InquiryCode] NVARCHAR(40) NOT NULL,
  [VendorId] NVARCHAR(60) NOT NULL,
  [VendorCode] NVARCHAR(40) NOT NULL,
  [Type] NVARCHAR(20) NOT NULL,
  [Status] NVARCHAR(30) NOT NULL DEFAULT 'submitted',
  [SubmittedAt] DATE NULL,
  [Amount] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(10) NULL,
  [ValidUntil] DATE NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmProposal] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmProposal_No] ON [dbo].[ScmProposal] ([ProjectId], [ProposalNo]);
CREATE INDEX [IX_ScmProposal_Inq] ON [dbo].[ScmProposal] ([ProjectId], [InquiryCode]);
GO

-- ScmClarification · d5 · شفاف‌سازی پیشنهاد
IF OBJECT_ID('dbo.ScmClarification', 'U') IS NULL
CREATE TABLE [dbo].[ScmClarification] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ProposalId] NVARCHAR(60) NOT NULL,
  [ProposalNo] NVARCHAR(40) NOT NULL,
  [QuestionFa] NVARCHAR(1000) NOT NULL,
  [AnswerFa] NVARCHAR(1000) NULL,
  [AskedBy] NVARCHAR(60) NOT NULL,
  [AskedAt] DATETIME2 NOT NULL,
  [AnsweredAt] DATETIME2 NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'open',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmClarification] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ScmClar_Proposal] ON [dbo].[ScmClarification] ([ProjectId], [ProposalId]);
GO

-- ScmEvaluation · d5 · ارزیابی پیشنهاد TBE/TBA/CBE
IF OBJECT_ID('dbo.ScmEvaluation', 'U') IS NULL
CREATE TABLE [dbo].[ScmEvaluation] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [EvalNo] NVARCHAR(40) NOT NULL,
  [ProposalId] NVARCHAR(60) NOT NULL,
  [ProposalNo] NVARCHAR(40) NOT NULL,
  [Type] NVARCHAR(20) NOT NULL,
  [Score] DECIMAL(5,2) NULL,
  [Result] NVARCHAR(20) NOT NULL,
  [EvaluatedBy] NVARCHAR(60) NOT NULL,
  [EvaluatedAt] DATETIME2 NOT NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmEvaluation] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmEval_No] ON [dbo].[ScmEvaluation] ([ProjectId], [EvalNo]);
CREATE INDEX [IX_ScmEval_Proposal] ON [dbo].[ScmEvaluation] ([ProjectId], [ProposalNo]);
GO

-- ScmBidReport · d5 · گزارش مناقصه و صدور PO
IF OBJECT_ID('dbo.ScmBidReport', 'U') IS NULL
CREATE TABLE [dbo].[ScmBidReport] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ReportNo] NVARCHAR(40) NOT NULL,
  [InquiryPackageId] NVARCHAR(60) NOT NULL,
  [InquiryCode] NVARCHAR(40) NOT NULL,
  [WinnerVendorCode] NVARCHAR(40) NULL,
  [TotalAmount] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(10) NULL,
  [RecommendationFa] NVARCHAR(2000) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmBidReport] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmBidReport_No] ON [dbo].[ScmBidReport] ([ProjectId], [ReportNo]);
GO

-- ScmKom · d5 · KOM/PIM و Expediting
IF OBJECT_ID('dbo.ScmKom', 'U') IS NULL
CREATE TABLE [dbo].[ScmKom] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [KomNo] NVARCHAR(40) NOT NULL,
  [PoNo] NVARCHAR(40) NULL,
  [Type] NVARCHAR(20) NOT NULL,
  [MeetingDate] DATE NOT NULL,
  [LocationFa] NVARCHAR(200) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'scheduled',
  [NoteFa] NVARCHAR(2000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmKom] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmKom_No] ON [dbo].[ScmKom] ([ProjectId], [KomNo]);
GO

-- ScmInspection · d5 · بازرسی و Release Note
IF OBJECT_ID('dbo.ScmInspection', 'U') IS NULL
CREATE TABLE [dbo].[ScmInspection] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [InspectionNo] NVARCHAR(40) NOT NULL,
  [PoNo] NVARCHAR(40) NULL,
  [Type] NVARCHAR(30) NOT NULL,
  [Inspector] NVARCHAR(100) NULL,
  [InspectionDate] DATE NOT NULL,
  [Result] NVARCHAR(20) NOT NULL,
  [ReleaseNoteNo] NVARCHAR(40) NULL,
  [NoteFa] NVARCHAR(2000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmInspection] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmInspection_No] ON [dbo].[ScmInspection] ([ProjectId], [InspectionNo]);
GO

-- ScmShipment · d5 · حمل و ترخیص
IF OBJECT_ID('dbo.ScmShipment', 'U') IS NULL
CREATE TABLE [dbo].[ScmShipment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ShipmentNo] NVARCHAR(40) NOT NULL,
  [PoNo] NVARCHAR(40) NULL,
  [Mode] NVARCHAR(20) NOT NULL,
  [OriginFa] NVARCHAR(200) NULL,
  [DestinationFa] NVARCHAR(200) NULL,
  [EtaDate] DATE NULL,
  [AtaDate] DATE NULL,
  [CustomsStatus] NVARCHAR(30) NOT NULL DEFAULT 'pending',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmShipment] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmShipment_No] ON [dbo].[ScmShipment] ([ProjectId], [ShipmentNo]);
GO

-- ScmPsr · d5 · گزارش پیشرفت خرید PSR
IF OBJECT_ID('dbo.ScmPsr', 'U') IS NULL
CREATE TABLE [dbo].[ScmPsr] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PsrNo] NVARCHAR(40) NOT NULL,
  [PoNo] NVARCHAR(40) NULL,
  [PackageCode] NVARCHAR(40) NULL,
  [ProgressPct] DECIMAL(5,2) NOT NULL,
  [ReportDate] DATE NOT NULL,
  [StatusFa] NVARCHAR(1000) NULL,
  [NextActionFa] NVARCHAR(1000) NULL,
  [ReportedBy] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmPsr] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmPsr_No] ON [dbo].[ScmPsr] ([ProjectId], [PsrNo]);
GO

-- ScmWarehouse · d5 · انبار
IF OBJECT_ID('dbo.ScmWarehouse', 'U') IS NULL
CREATE TABLE [dbo].[ScmWarehouse] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [NameFa] NVARCHAR(200) NOT NULL,
  [LocationFa] NVARCHAR(200) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmWarehouse] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmWarehouse_Code] ON [dbo].[ScmWarehouse] ([ProjectId], [Code]);
GO

-- ScmMaterialCatalog · d5 · کاتالوگ کالا
IF OBJECT_ID('dbo.ScmMaterialCatalog', 'U') IS NULL
CREATE TABLE [dbo].[ScmMaterialCatalog] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [NameFa] NVARCHAR(400) NOT NULL,
  [Category] NVARCHAR(60) NULL,
  [Unit] NVARCHAR(20) NULL,
  [SpecFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmMaterialCatalog] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmMatCat_Code] ON [dbo].[ScmMaterialCatalog] ([ProjectId], [Code]);
GO

-- ScmMrc · d5 · درخواست رزرو MRC
IF OBJECT_ID('dbo.ScmMrc', 'U') IS NULL
CREATE TABLE [dbo].[ScmMrc] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MrcNo] NVARCHAR(40) NOT NULL,
  [RequestedBy] NVARCHAR(60) NOT NULL,
  [RequiredDate] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmMrc] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmMrc_No] ON [dbo].[ScmMrc] ([ProjectId], [MrcNo]);
GO

-- ScmMrcLine · d5 · ردیف درخواست رزرو
IF OBJECT_ID('dbo.ScmMrcLine', 'U') IS NULL
CREATE TABLE [dbo].[ScmMrcLine] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MrcId] NVARCHAR(60) NOT NULL,
  [MrcNo] NVARCHAR(40) NOT NULL,
  [MaterialCode] NVARCHAR(40) NOT NULL,
  [Quantity] DECIMAL(18,3) NOT NULL,
  [ReservedQty] DECIMAL(18,3) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmMrcLine] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ScmMrcLine_Mrc] ON [dbo].[ScmMrcLine] ([ProjectId], [MrcId]);
GO

-- ScmMiv · d5 · حواله خروج MIV
IF OBJECT_ID('dbo.ScmMiv', 'U') IS NULL
CREATE TABLE [dbo].[ScmMiv] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MivNo] NVARCHAR(40) NOT NULL,
  [MrcNo] NVARCHAR(40) NULL,
  [WarehouseCode] NVARCHAR(40) NOT NULL,
  [IssuedBy] NVARCHAR(60) NOT NULL,
  [IssuedAt] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'issued',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmMiv] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmMiv_No] ON [dbo].[ScmMiv] ([ProjectId], [MivNo]);
GO

-- ScmMivLine · d5 · ردیف حواله خروج
IF OBJECT_ID('dbo.ScmMivLine', 'U') IS NULL
CREATE TABLE [dbo].[ScmMivLine] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MivId] NVARCHAR(60) NOT NULL,
  [MivNo] NVARCHAR(40) NOT NULL,
  [MaterialCode] NVARCHAR(40) NOT NULL,
  [Quantity] DECIMAL(18,3) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmMivLine] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ScmMivLine_Miv] ON [dbo].[ScmMivLine] ([ProjectId], [MivId]);
GO

-- ScmMrv · d5 · رسید عودت MRV
IF OBJECT_ID('dbo.ScmMrv', 'U') IS NULL
CREATE TABLE [dbo].[ScmMrv] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MrvNo] NVARCHAR(40) NOT NULL,
  [MivNo] NVARCHAR(40) NULL,
  [WarehouseCode] NVARCHAR(40) NOT NULL,
  [ReturnedBy] NVARCHAR(60) NOT NULL,
  [ReturnedAt] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'returned',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmMrv] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmMrv_No] ON [dbo].[ScmMrv] ([ProjectId], [MrvNo]);
GO

-- ScmStockTransfer · d5 · جابه‌جایی انبار
IF OBJECT_ID('dbo.ScmStockTransfer', 'U') IS NULL
CREATE TABLE [dbo].[ScmStockTransfer] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [TransferNo] NVARCHAR(40) NOT NULL,
  [FromWarehouse] NVARCHAR(40) NOT NULL,
  [ToWarehouse] NVARCHAR(40) NOT NULL,
  [MaterialCode] NVARCHAR(40) NOT NULL,
  [Quantity] DECIMAL(18,3) NOT NULL,
  [TransferredBy] NVARCHAR(60) NOT NULL,
  [TransferredAt] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'completed',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmStockTransfer] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmTransfer_No] ON [dbo].[ScmStockTransfer] ([ProjectId], [TransferNo]);
GO

-- ScmStockBalance · d5 · موجودی به تفکیک انبار
IF OBJECT_ID('dbo.ScmStockBalance', 'U') IS NULL
CREATE TABLE [dbo].[ScmStockBalance] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [WarehouseCode] NVARCHAR(40) NOT NULL,
  [MaterialCode] NVARCHAR(40) NOT NULL,
  [OnHand] DECIMAL(18,3) NOT NULL DEFAULT 0,
  [Reserved] DECIMAL(18,3) NULL DEFAULT 0,
  [OnOrder] DECIMAL(18,3) NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ScmStockBalance] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ScmStockBal] ON [dbo].[ScmStockBalance] ([ProjectId], [WarehouseCode], [MaterialCode]);
GO

-- WorkPermit · d16 · پروانهٔ کار
IF OBJECT_ID('dbo.WorkPermit', 'U') IS NULL
CREATE TABLE [dbo].[WorkPermit] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PermitNo] NVARCHAR(40) NOT NULL,
  [PermitType] NVARCHAR(30) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [SystemId] NVARCHAR(60) NULL,
  [ActivityId] NVARCHAR(60) NULL,
  [LocationFa] NVARCHAR(300) NULL,
  [RequestedBy] NVARCHAR(60) NOT NULL,
  [ValidFrom] DATETIME2 NOT NULL,
  [ValidTo] DATETIME2 NOT NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [ClosedAt] DATETIME2 NULL,
  [SimopsRequired] BIT NOT NULL DEFAULT 0,
  [SimopsApprovedBy] NVARCHAR(60) NULL,
  [GasTestResultFa] NVARCHAR(200) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [JsaId] NVARCHAR(60) NULL,
  [QrToken] NVARCHAR(64) NULL,
  [SuspendedAt] DATETIME2 NULL,
  [SuspendedBy] NVARCHAR(60) NULL,
  [SuspendReasonFa] NVARCHAR(400) NULL,
  [ParentPermitId] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_WorkPermit] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_WorkPermit_No] ON [dbo].[WorkPermit] ([ProjectId], [PermitNo]);
CREATE INDEX [IX_WorkPermit_System] ON [dbo].[WorkPermit] ([ProjectId], [SystemId], [Status]);
CREATE INDEX [IX_WorkPermit_Validity] ON [dbo].[WorkPermit] ([ProjectId], [Status], [ValidTo]);
CREATE UNIQUE INDEX [UX_WorkPermit_Qr] ON [dbo].[WorkPermit] ([QrToken]) WHERE [QrToken] IS NOT NULL;
CREATE INDEX [IX_WorkPermit_Jsa] ON [dbo].[WorkPermit] ([JsaId]);
GO

-- SafetyIncident · d16 · رویداد ایمنی
IF OBJECT_ID('dbo.SafetyIncident', 'U') IS NULL
CREATE TABLE [dbo].[SafetyIncident] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [IncidentNo] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [IncidentType] NVARCHAR(30) NOT NULL,
  [OccurredAt] DATETIME2 NOT NULL,
  [LocationFa] NVARCHAR(300) NULL,
  [SystemId] NVARCHAR(60) NULL,
  [ActivityId] NVARCHAR(60) NULL,
  [ReportedBy] NVARCHAR(60) NOT NULL,
  [InjuredPersonFa] NVARCHAR(200) NULL,
  [LostDays] INT NULL,
  [RootCauseFa] NVARCHAR(1000) NULL,
  [CorrectiveActionFa] NVARCHAR(1000) NULL,
  [NcrRef] NVARCHAR(60) NULL,
  [ClosedAt] DATETIME2 NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [Severity] NVARCHAR(20) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [PermitId] NVARCHAR(60) NULL,
  [FlashReportAt] DATETIME2 NULL,
  [IsEmergencyActivated] BIT NULL,
  [GpsLat] DECIMAL(9,6) NULL,
  [GpsLng] DECIMAL(9,6) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SafetyIncident] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_SafetyIncident_No] ON [dbo].[SafetyIncident] ([ProjectId], [IncidentNo]);
CREATE INDEX [IX_SafetyIncident_Type] ON [dbo].[SafetyIncident] ([ProjectId], [IncidentType], [OccurredAt]);
CREATE INDEX [IX_SafetyIncident_Open] ON [dbo].[SafetyIncident] ([ProjectId], [Status], [Severity]);
CREATE INDEX [IX_SafetyIncident_Permit] ON [dbo].[SafetyIncident] ([PermitId]);
GO

-- SafetyInspection · d16 · بازرسی ایمنی
IF OBJECT_ID('dbo.SafetyInspection', 'U') IS NULL
CREATE TABLE [dbo].[SafetyInspection] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [InspectionNo] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [InspectionType] NVARCHAR(30) NOT NULL,
  [InspectedAt] DATE NOT NULL,
  [InspectedBy] NVARCHAR(60) NOT NULL,
  [AreaFa] NVARCHAR(300) NULL,
  [FindingsCount] INT NULL,
  [ClosedFindings] INT NULL,
  [ScorePct] DECIMAL(5,2) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SafetyInspection] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_SafetyInspection_No] ON [dbo].[SafetyInspection] ([ProjectId], [InspectionNo]);
CREATE INDEX [IX_SafetyInspection_Date] ON [dbo].[SafetyInspection] ([ProjectId], [InspectedAt]);
GO

-- SafetyTrainingRecord · d16 · سابقهٔ آموزش ایمنی
IF OBJECT_ID('dbo.SafetyTrainingRecord', 'U') IS NULL
CREATE TABLE [dbo].[SafetyTrainingRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PersonRef] NVARCHAR(60) NOT NULL,
  [CourseCode] NVARCHAR(40) NOT NULL,
  [CourseTitleFa] NVARCHAR(300) NOT NULL,
  [CompletedAt] DATE NOT NULL,
  [ExpiresAt] DATE NULL,
  [ScorePct] DECIMAL(5,2) NULL,
  [CertificateNo] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_SafetyTrainingRecord] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_SafetyTraining] ON [dbo].[SafetyTrainingRecord] ([ProjectId], [PersonRef], [CourseCode]);
CREATE INDEX [IX_SafetyTraining_Expiry] ON [dbo].[SafetyTrainingRecord] ([ProjectId], [ExpiresAt], [Status]);
GO

-- TrainingSession · d16 · جلسهٔ آموزش ایمنی
IF OBJECT_ID('dbo.TrainingSession', 'U') IS NULL
CREATE TABLE [dbo].[TrainingSession] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SessionNo] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [CourseCode] NVARCHAR(40) NOT NULL,
  [TrainingType] NVARCHAR(30) NOT NULL,
  [HeldAt] DATETIME2 NOT NULL,
  [DurationMinutes] INT NOT NULL,
  [InstructorFa] NVARCHAR(200) NOT NULL,
  [LocationFa] NVARCHAR(200) NULL,
  [ContractorFa] NVARCHAR(200) NULL,
  [ValidityMonths] INT NULL,
  [MaterialRef] NVARCHAR(300) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_TrainingSession] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_TrainingSession_No] ON [dbo].[TrainingSession] ([ProjectId], [SessionNo]);
CREATE INDEX [IX_TrainingSession_Date] ON [dbo].[TrainingSession] ([ProjectId], [HeldAt], [TrainingType]);
GO

-- TrainingAttendee · d16 · حاضر در جلسهٔ آموزش
IF OBJECT_ID('dbo.TrainingAttendee', 'U') IS NULL
CREATE TABLE [dbo].[TrainingAttendee] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SessionId] NVARCHAR(60) NOT NULL,
  [PersonRef] NVARCHAR(60) NOT NULL,
  [PersonNameFa] NVARCHAR(200) NOT NULL,
  [TradeCode] NVARCHAR(40) NULL,
  [ContractorFa] NVARCHAR(200) NULL,
  [Attended] BIT NOT NULL DEFAULT 0,
  [ScorePct] DECIMAL(5,2) NULL,
  [Passed] BIT NOT NULL DEFAULT 0,
  [SignatureRef] NVARCHAR(300) NULL,
  [NoteFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_TrainingAttendee] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_TrainingAttendee] ON [dbo].[TrainingAttendee] ([SessionId], [PersonRef]);
CREATE INDEX [IX_TrainingAttendee_Person] ON [dbo].[TrainingAttendee] ([ProjectId], [PersonRef]);
GO

-- PpeIssuance · d16 · تحویل تجهیزات حفاظت فردی
IF OBJECT_ID('dbo.PpeIssuance', 'U') IS NULL
CREATE TABLE [dbo].[PpeIssuance] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [IssueNo] NVARCHAR(40) NOT NULL,
  [PersonRef] NVARCHAR(60) NOT NULL,
  [PersonNameFa] NVARCHAR(200) NOT NULL,
  [PpeType] NVARCHAR(30) NOT NULL,
  [IssuedAt] DATE NOT NULL,
  [IssuedBy] NVARCHAR(60) NOT NULL,
  [Quantity] INT NOT NULL DEFAULT 1,
  [SizeFa] NVARCHAR(40) NULL,
  [SerialNo] NVARCHAR(60) NULL,
  [ReplaceDueDate] DATE NULL,
  [ReturnedAt] DATE NULL,
  [UnitCost] DECIMAL(18,2) NULL,
  [ContractorFa] NVARCHAR(200) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PpeIssuance] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PpeIssuance_No] ON [dbo].[PpeIssuance] ([ProjectId], [IssueNo]);
CREATE INDEX [IX_PpeIssuance_Person] ON [dbo].[PpeIssuance] ([ProjectId], [PersonRef], [PpeType]);
CREATE INDEX [IX_PpeIssuance_Replace] ON [dbo].[PpeIssuance] ([ProjectId], [ReplaceDueDate], [Status]);
GO

-- OccupationalHazard · d16 · عامل زیان‌آور شغلی
IF OBJECT_ID('dbo.OccupationalHazard', 'U') IS NULL
CREATE TABLE [dbo].[OccupationalHazard] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [HazardCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [HazardType] NVARCHAR(30) NOT NULL,
  [TradeCode] NVARCHAR(40) NULL,
  [ExposureLimitFa] NVARCHAR(200) NULL,
  [ExamIntervalMonths] INT NOT NULL,
  [RequiredExamsFa] NVARCHAR(400) NULL,
  [RequiredPpeFa] NVARCHAR(300) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_OccupationalHazard] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_OccupationalHazard] ON [dbo].[OccupationalHazard] ([ProjectId], [HazardCode]);
CREATE INDEX [IX_OccupationalHazard_Trade] ON [dbo].[OccupationalHazard] ([ProjectId], [TradeCode], [Status]);
GO

-- HealthExamination · d16 · معاینهٔ طب کار
IF OBJECT_ID('dbo.HealthExamination', 'U') IS NULL
CREATE TABLE [dbo].[HealthExamination] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ExamNo] NVARCHAR(40) NOT NULL,
  [PersonRef] NVARCHAR(60) NOT NULL,
  [PersonNameFa] NVARCHAR(200) NOT NULL,
  [ExamType] NVARCHAR(20) NOT NULL,
  [ExaminedAt] DATE NOT NULL,
  [Fitness] NVARCHAR(20) NOT NULL,
  [RestrictionFa] NVARCHAR(400) NULL,
  [HazardCode] NVARCHAR(40) NULL,
  [NextExamDate] DATE NULL,
  [PhysicianFa] NVARCHAR(200) NULL,
  [ClinicFa] NVARCHAR(200) NULL,
  [ReportRef] NVARCHAR(300) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HealthExamination] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HealthExam_No] ON [dbo].[HealthExamination] ([ProjectId], [ExamNo]);
CREATE INDEX [IX_HealthExam_Person] ON [dbo].[HealthExamination] ([ProjectId], [PersonRef], [ExamType]);
CREATE INDEX [IX_HealthExam_Next] ON [dbo].[HealthExamination] ([ProjectId], [NextExamDate], [Status]);
GO

-- WasteLog · d16 · سیاههٔ پسماند
IF OBJECT_ID('dbo.WasteLog', 'U') IS NULL
CREATE TABLE [dbo].[WasteLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [WasteNo] NVARCHAR(40) NOT NULL,
  [WasteType] NVARCHAR(30) NOT NULL,
  [DescriptionFa] NVARCHAR(300) NOT NULL,
  [Quantity] DECIMAL(18,3) NOT NULL,
  [Unit] NVARCHAR(20) NOT NULL,
  [GeneratedAt] DATE NOT NULL,
  [AreaFa] NVARCHAR(200) NULL,
  [DisposalMethod] NVARCHAR(30) NOT NULL,
  [ManifestNo] NVARCHAR(60) NULL,
  [CarrierFa] NVARCHAR(200) NULL,
  [DestinationFa] NVARCHAR(200) NULL,
  [DisposedAt] DATE NULL,
  [CostAmount] DECIMAL(18,2) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_WasteLog] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_WasteLog_No] ON [dbo].[WasteLog] ([ProjectId], [WasteNo]);
CREATE INDEX [IX_WasteLog_Type] ON [dbo].[WasteLog] ([ProjectId], [WasteType], [Status]);
CREATE INDEX [IX_WasteLog_Date] ON [dbo].[WasteLog] ([ProjectId], [GeneratedAt]);
GO

-- EnvironmentalMonitoring · d16 · پایش زیست‌محیطی
IF OBJECT_ID('dbo.EnvironmentalMonitoring', 'U') IS NULL
CREATE TABLE [dbo].[EnvironmentalMonitoring] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ReadingNo] NVARCHAR(40) NOT NULL,
  [Medium] NVARCHAR(20) NOT NULL,
  [ParameterFa] NVARCHAR(200) NOT NULL,
  [MeasuredAt] DATETIME2 NOT NULL,
  [MeasuredValue] DECIMAL(18,4) NOT NULL,
  [Unit] NVARCHAR(30) NOT NULL,
  [LimitValue] DECIMAL(18,4) NOT NULL,
  [LocationFa] NVARCHAR(200) NULL,
  [MethodFa] NVARCHAR(200) NULL,
  [LabFa] NVARCHAR(200) NULL,
  [CorrectiveActionFa] NVARCHAR(400) NULL,
  [ViolationId] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EnvironmentalMonitoring] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EnvMonitoring_No] ON [dbo].[EnvironmentalMonitoring] ([ProjectId], [ReadingNo]);
CREATE INDEX [IX_EnvMonitoring_Medium] ON [dbo].[EnvironmentalMonitoring] ([ProjectId], [Medium], [MeasuredAt]);
GO

-- HSE_MetricSnapshot · d16 · عکس شاخص ایمنی
IF OBJECT_ID('dbo.HSE_MetricSnapshot', 'U') IS NULL
CREATE TABLE [dbo].[HSE_MetricSnapshot] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [MetricCode] NVARCHAR(40) NOT NULL,
  [Value] DECIMAL(18,4) NOT NULL,
  [Target] DECIMAL(18,4) NULL,
  [Unit] NVARCHAR(20) NOT NULL,
  [CapturedAt] DATETIME2 NOT NULL,
  [BaseManHours] DECIMAL(18,2) NULL,
  [SampleSize] INT NULL,
  [IsEstimated] BIT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(400) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT draft,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HSE_MetricSnapshot] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HseMetric] ON [dbo].[HSE_MetricSnapshot] ([ProjectId], [PeriodCode], [MetricCode]);
CREATE INDEX [IX_HseMetric_Code] ON [dbo].[HSE_MetricSnapshot] ([ProjectId], [MetricCode], [CapturedAt]);
GO

-- HSE_AlertRule · d16 · قاعدهٔ هشدار ایمنی
IF OBJECT_ID('dbo.HSE_AlertRule', 'U') IS NULL
CREATE TABLE [dbo].[HSE_AlertRule] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RuleCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(200) NOT NULL,
  [Severity] NVARCHAR(20) NOT NULL,
  [Threshold] DECIMAL(18,4) NOT NULL,
  [Comparison] NVARCHAR(10) NOT NULL,
  [IsEnabled] BIT NOT NULL DEFAULT 1,
  [MutedUntil] DATE NULL,
  [MuteReasonFa] NVARCHAR(400) NULL,
  [OwnerRole] NVARCHAR(40) NULL,
  [ActionFa] NVARCHAR(400) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT active,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HSE_AlertRule] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HseAlertRule] ON [dbo].[HSE_AlertRule] ([ProjectId], [RuleCode]);
GO

-- HSE_RiskAssessment · d16 · ارزیابی ریسک شغلی
IF OBJECT_ID('dbo.HSE_RiskAssessment', 'U') IS NULL
CREATE TABLE [dbo].[HSE_RiskAssessment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [JsaNo] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(400) NOT NULL,
  [ActivityId] NVARCHAR(60) NULL,
  [TemplateCode] NVARCHAR(40) NULL,
  [DisciplineCode] NVARCHAR(40) NULL,
  [LocationFa] NVARCHAR(300) NULL,
  [PreparedBy] NVARCHAR(60) NOT NULL,
  [PreparedAt] DATE NOT NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATE NULL,
  [ValidUntil] DATE NULL,
  [MaxResidualRisk] INT NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HSE_RiskAssessment] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HseRiskAssessment_No] ON [dbo].[HSE_RiskAssessment] ([ProjectId], [JsaNo]);
CREATE INDEX [IX_HseRiskAssessment_Activity] ON [dbo].[HSE_RiskAssessment] ([ProjectId], [ActivityId], [Status]);
CREATE INDEX [IX_HseRiskAssessment_Valid] ON [dbo].[HSE_RiskAssessment] ([ProjectId], [Status], [ValidUntil]);
GO

-- JSA_JobStep · d16 · گام کاری ارزیابی ریسک
IF OBJECT_ID('dbo.JSA_JobStep', 'U') IS NULL
CREATE TABLE [dbo].[JSA_JobStep] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [JsaId] NVARCHAR(60) NOT NULL,
  [StepNo] INT NOT NULL,
  [DescriptionFa] NVARCHAR(600) NOT NULL,
  [ResponsibleFa] NVARCHAR(200) NULL,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_JSA_JobStep] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_JsaJobStep] ON [dbo].[JSA_JobStep] ([JsaId], [StepNo]);
CREATE INDEX [IX_JsaJobStep_Jsa] ON [dbo].[JSA_JobStep] ([JsaId]);
GO

-- JSA_Hazard · d16 · خطر گام کاری
IF OBJECT_ID('dbo.JSA_Hazard', 'U') IS NULL
CREATE TABLE [dbo].[JSA_Hazard] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [JsaId] NVARCHAR(60) NOT NULL,
  [StepId] NVARCHAR(60) NOT NULL,
  [HazardNo] INT NOT NULL,
  [HazardFa] NVARCHAR(600) NOT NULL,
  [HazardCategory] NVARCHAR(30) NULL,
  [Likelihood] INT NOT NULL,
  [Severity] INT NOT NULL,
  [InitialRisk] INT NULL,
  [ResidualLikelihood] INT NULL,
  [ResidualSeverity] INT NULL,
  [ResidualRisk] INT NULL,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_JSA_Hazard] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_JsaHazard] ON [dbo].[JSA_Hazard] ([StepId], [HazardNo]);
CREATE INDEX [IX_JsaHazard_Jsa] ON [dbo].[JSA_Hazard] ([JsaId]);
CREATE INDEX [IX_JsaHazard_Risk] ON [dbo].[JSA_Hazard] ([ProjectId], [ResidualRisk]);
GO

-- JSA_Control · d16 · کنترل خطر
IF OBJECT_ID('dbo.JSA_Control', 'U') IS NULL
CREATE TABLE [dbo].[JSA_Control] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [JsaId] NVARCHAR(60) NOT NULL,
  [HazardId] NVARCHAR(60) NOT NULL,
  [ControlNo] INT NOT NULL,
  [ControlLevel] NVARCHAR(20) NOT NULL,
  [ControlFa] NVARCHAR(600) NOT NULL,
  [ResponsibleFa] NVARCHAR(200) NULL,
  [VerifiedBy] NVARCHAR(60) NULL,
  [VerifiedAt] DATE NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_JSA_Control] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_JsaControl] ON [dbo].[JSA_Control] ([HazardId], [ControlNo]);
CREATE INDEX [IX_JsaControl_Jsa] ON [dbo].[JSA_Control] ([JsaId], [ControlLevel]);
GO

-- GasTestLog · d16 · سابقهٔ گازسنجی
IF OBJECT_ID('dbo.GasTestLog', 'U') IS NULL
CREATE TABLE [dbo].[GasTestLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PermitId] NVARCHAR(60) NOT NULL,
  [TestedAt] DATETIME2 NOT NULL,
  [LelPct] DECIMAL(5,2) NULL,
  [OxygenPct] DECIMAL(5,2) NULL,
  [H2sPpm] DECIMAL(8,2) NULL,
  [CoPpm] DECIMAL(8,2) NULL,
  [IsSafe] BIT NOT NULL DEFAULT 0,
  [BreachedFa] NVARCHAR(300) NULL,
  [TestedBy] NVARCHAR(60) NOT NULL,
  [DeviceSerial] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_GasTestLog] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_GasTestLog_Permit] ON [dbo].[GasTestLog] ([PermitId], [TestedAt]);
CREATE INDEX [IX_GasTestLog_Safe] ON [dbo].[GasTestLog] ([ProjectId], [IsSafe], [TestedAt]);
GO

-- IsolationLog · d16 · سابقهٔ ایزولاسیون
IF OBJECT_ID('dbo.IsolationLog', 'U') IS NULL
CREATE TABLE [dbo].[IsolationLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PermitId] NVARCHAR(60) NOT NULL,
  [IsolationNo] INT NOT NULL,
  [IsolationType] NVARCHAR(20) NOT NULL,
  [PointTagFa] NVARCHAR(300) NOT NULL,
  [LockNo] NVARCHAR(40) NULL,
  [TagNo] NVARCHAR(40) NULL,
  [AppliedAt] DATETIME2 NULL,
  [AppliedBy] NVARCHAR(60) NULL,
  [RemovedAt] DATETIME2 NULL,
  [RemovedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IsolationLog] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_IsolationLog] ON [dbo].[IsolationLog] ([PermitId], [IsolationNo]);
CREATE INDEX [IX_IsolationLog_Status] ON [dbo].[IsolationLog] ([ProjectId], [Status]);
GO

-- PTW_Approval · d16 · امضای پروانهٔ کار
IF OBJECT_ID('dbo.PTW_Approval', 'U') IS NULL
CREATE TABLE [dbo].[PTW_Approval] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PermitId] NVARCHAR(60) NOT NULL,
  [ApprovalLevel] NVARCHAR(20) NOT NULL,
  [ApproverRef] NVARCHAR(60) NOT NULL,
  [SignedAt] DATETIME2 NOT NULL,
  [DecisionFa] NVARCHAR(20) NOT NULL,
  [CommentFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PTW_Approval] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PtwApproval] ON [dbo].[PTW_Approval] ([PermitId], [ApprovalLevel]);
CREATE INDEX [IX_PtwApproval_Approver] ON [dbo].[PTW_Approval] ([ProjectId], [ApproverRef]);
GO

-- PTW_Precaution · d16 · اقدام احتیاطی پروانه
IF OBJECT_ID('dbo.PTW_Precaution', 'U') IS NULL
CREATE TABLE [dbo].[PTW_Precaution] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PermitId] NVARCHAR(60) NOT NULL,
  [PrecautionNo] INT NOT NULL,
  [PrecautionFa] NVARCHAR(500) NOT NULL,
  [IsMandatory] BIT NOT NULL DEFAULT 1,
  [IsConfirmed] BIT NULL,
  [ConfirmedBy] NVARCHAR(60) NULL,
  [ConfirmedAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PTW_Precaution] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PtwPrecaution] ON [dbo].[PTW_Precaution] ([PermitId], [PrecautionNo]);
CREATE INDEX [IX_PtwPrecaution_Pending] ON [dbo].[PTW_Precaution] ([ProjectId], [IsConfirmed]);
GO

-- InjuredPerson · d16 · فرد مصدوم
IF OBJECT_ID('dbo.InjuredPerson', 'U') IS NULL
CREATE TABLE [dbo].[InjuredPerson] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [IncidentId] NVARCHAR(60) NOT NULL,
  [PersonNo] INT NOT NULL,
  [PersonRef] NVARCHAR(60) NULL,
  [FullNameFa] NVARCHAR(200) NOT NULL,
  [CompanyFa] NVARCHAR(200) NULL,
  [InjuryType] NVARCHAR(30) NOT NULL,
  [BodyPart] NVARCHAR(30) NULL,
  [LostWorkDays] INT NULL,
  [RestrictedDays] INT NULL,
  [ReturnedToWork] BIT NULL,
  [ReturnedAt] DATE NULL,
  [TreatmentFa] NVARCHAR(400) NULL,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_InjuredPerson] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_InjuredPerson] ON [dbo].[InjuredPerson] ([IncidentId], [PersonNo]);
CREATE INDEX [IX_InjuredPerson_Incident] ON [dbo].[InjuredPerson] ([IncidentId]);
CREATE INDEX [IX_InjuredPerson_Person] ON [dbo].[InjuredPerson] ([ProjectId], [PersonRef]);
GO

-- HSE_Investigation · d16 · تحقیق حادثه
IF OBJECT_ID('dbo.HSE_Investigation', 'U') IS NULL
CREATE TABLE [dbo].[HSE_Investigation] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [IncidentId] NVARCHAR(60) NOT NULL,
  [LeadInvestigator] NVARCHAR(60) NOT NULL,
  [TeamFa] NVARCHAR(600) NULL,
  [StartedAt] DATE NOT NULL,
  [CompletedAt] DATE NULL,
  [MethodFa] NVARCHAR(30) NULL,
  [SummaryFa] NVARCHAR(2000) NULL,
  [DirectCost] DECIMAL(18,2) NULL,
  [IndirectCost] DECIMAL(18,2) NULL,
  [LessonsLearnedFa] NVARCHAR(2000) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATE NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HSE_Investigation] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HseInvestigation] ON [dbo].[HSE_Investigation] ([IncidentId]);
CREATE INDEX [IX_HseInvestigation_Status] ON [dbo].[HSE_Investigation] ([ProjectId], [Status]);
GO

-- RootCauseNode · d16 · گره ریشه‌یابی
IF OBJECT_ID('dbo.RootCauseNode', 'U') IS NULL
CREATE TABLE [dbo].[RootCauseNode] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [InvestigationId] NVARCHAR(60) NOT NULL,
  [NodeNo] INT NOT NULL,
  [ParentId] NVARCHAR(60) NULL,
  [Depth] INT NOT NULL,
  [StatementFa] NVARCHAR(800) NOT NULL,
  [CauseLevel] NVARCHAR(20) NOT NULL,
  [Category] NVARCHAR(20) NULL,
  [EvidenceFa] NVARCHAR(800) NULL,
  [IsVerified] BIT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_RootCauseNode] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_RootCauseNode] ON [dbo].[RootCauseNode] ([InvestigationId], [NodeNo]);
CREATE INDEX [IX_RootCauseNode_Parent] ON [dbo].[RootCauseNode] ([ParentId]);
CREATE INDEX [IX_RootCauseNode_Level] ON [dbo].[RootCauseNode] ([InvestigationId], [CauseLevel]);
GO

-- CapaAction · d16 · اقدام اصلاحی و پیشگیرانه
IF OBJECT_ID('dbo.CapaAction', 'U') IS NULL
CREATE TABLE [dbo].[CapaAction] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SourceType] NVARCHAR(20) NOT NULL,
  [SourceId] NVARCHAR(60) NOT NULL,
  [ActionNo] INT NOT NULL,
  [ActionFa] NVARCHAR(800) NOT NULL,
  [ActionType] NVARCHAR(20) NOT NULL,
  [RootCauseNodeId] NVARCHAR(60) NULL,
  [OwnerRef] NVARCHAR(60) NOT NULL,
  [DueDate] DATE NOT NULL,
  [CompletedAt] DATE NULL,
  [VerifiedBy] NVARCHAR(60) NULL,
  [VerifiedAt] DATE NULL,
  [EffectivenessFa] NVARCHAR(600) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CapaAction] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CapaAction] ON [dbo].[CapaAction] ([SourceType], [SourceId], [ActionNo]);
CREATE INDEX [IX_CapaAction_Owner] ON [dbo].[CapaAction] ([ProjectId], [OwnerRef], [Status]);
CREATE INDEX [IX_CapaAction_Due] ON [dbo].[CapaAction] ([ProjectId], [Status], [DueDate]);
GO

-- HSE_ManHourLog · d16 · سابقهٔ نفرساعت ایمنی
IF OBJECT_ID('dbo.HSE_ManHourLog', 'U') IS NULL
CREATE TABLE [dbo].[HSE_ManHourLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [LogDate] DATE NOT NULL,
  [ManHours] DECIMAL(12,2) NOT NULL,
  [HeadCount] INT NULL,
  [ContractorFa] NVARCHAR(200) NOT NULL DEFAULT 'کل پروژه',
  [SourceFa] NVARCHAR(20) NOT NULL,
  [NoteFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HSE_ManHourLog] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HseManHourLog] ON [dbo].[HSE_ManHourLog] ([ProjectId], [LogDate], [ContractorFa]);
CREATE INDEX [IX_HseManHourLog_Date] ON [dbo].[HSE_ManHourLog] ([ProjectId], [LogDate]);
GO

-- InspectionFinding · d16 · یافتهٔ بازرسی
IF OBJECT_ID('dbo.InspectionFinding', 'U') IS NULL
CREATE TABLE [dbo].[InspectionFinding] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [InspectionId] NVARCHAR(60) NOT NULL,
  [FindingNo] INT NOT NULL,
  [DescriptionFa] NVARCHAR(600) NOT NULL,
  [Category] NVARCHAR(30) NOT NULL,
  [Severity] NVARCHAR(20) NOT NULL,
  [AreaFa] NVARCHAR(200) NULL,
  [ActivityId] NVARCHAR(60) NULL,
  [PhotoRef] NVARCHAR(300) NULL,
  [OwnerRef] NVARCHAR(60) NULL,
  [DueDate] DATE NULL,
  [ClosedAt] DATE NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [ClosureNoteFa] NVARCHAR(600) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_InspectionFinding] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_InspectionFinding] ON [dbo].[InspectionFinding] ([InspectionId], [FindingNo]);
CREATE INDEX [IX_InspectionFinding_Status] ON [dbo].[InspectionFinding] ([ProjectId], [Status]);
CREATE INDEX [IX_InspectionFinding_Activity] ON [dbo].[InspectionFinding] ([ProjectId], [ActivityId]);
GO

-- HSE_Violation · d16 · تخلف ایمنی و توقف کار
IF OBJECT_ID('dbo.HSE_Violation', 'U') IS NULL
CREATE TABLE [dbo].[HSE_Violation] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ViolationNo] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [ViolationType] NVARCHAR(30) NOT NULL,
  [Severity] NVARCHAR(20) NOT NULL,
  [IssuedAt] DATETIME2 NOT NULL,
  [IssuedBy] NVARCHAR(60) NOT NULL,
  [AreaFa] NVARCHAR(200) NULL,
  [ActivityId] NVARCHAR(60) NULL,
  [SystemId] NVARCHAR(60) NULL,
  [PermitId] NVARCHAR(60) NULL,
  [InspectionId] NVARCHAR(60) NULL,
  [FindingId] NVARCHAR(60) NULL,
  [ContractorFa] NVARCHAR(200) NULL,
  [OffenderRef] NVARCHAR(60) NULL,
  [IsStopWork] BIT NOT NULL DEFAULT 0,
  [StopWorkScope] NVARCHAR(20) NULL,
  [FineAmount] DECIMAL(18,2) NULL,
  [GpsLat] DECIMAL(9,6) NULL,
  [GpsLng] DECIMAL(9,6) NULL,
  [CorrectiveRequestFa] NVARCHAR(600) NULL,
  [DueDate] DATE NULL,
  [NoteFa] NVARCHAR(600) NULL,
  [Status] NVARCHAR(20) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HSE_Violation] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HseViolation_No] ON [dbo].[HSE_Violation] ([ProjectId], [ViolationNo]);
CREATE INDEX [IX_HseViolation_Stop] ON [dbo].[HSE_Violation] ([ProjectId], [IsStopWork], [Status]);
CREATE INDEX [IX_HseViolation_Activity] ON [dbo].[HSE_Violation] ([ProjectId], [ActivityId], [Status]);
CREATE INDEX [IX_HseViolation_Inspection] ON [dbo].[HSE_Violation] ([ProjectId], [InspectionId]);
GO

-- ViolationClosure · d16 · آزادسازی تخلف
IF OBJECT_ID('dbo.ViolationClosure', 'U') IS NULL
CREATE TABLE [dbo].[ViolationClosure] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ViolationId] NVARCHAR(60) NOT NULL,
  [AttemptNo] INT NOT NULL,
  [ReInspectedAt] DATETIME2 NOT NULL,
  [ReInspectedBy] NVARCHAR(60) NOT NULL,
  [IsSatisfactory] BIT NOT NULL DEFAULT 0,
  [EvidenceFa] NVARCHAR(600) NULL,
  [PhotoRef] NVARCHAR(300) NULL,
  [ReleasedBy] NVARCHAR(60) NULL,
  [ReleasedAt] DATETIME2 NULL,
  [RejectReasonFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ViolationClosure] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_ViolationClosure] ON [dbo].[ViolationClosure] ([ViolationId], [AttemptNo]);
CREATE INDEX [IX_ViolationClosure_Violation] ON [dbo].[ViolationClosure] ([ProjectId], [ViolationId]);
GO

-- CtrDocument · d2 · سند قرارداد بارگذاری‌شده
IF OBJECT_ID('dbo.CtrDocument', 'U') IS NULL
CREATE TABLE [dbo].[CtrDocument] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractId] NVARCHAR(60) NULL,
  [FileName] NVARCHAR(260) NOT NULL,
  [MimeType] NVARCHAR(120) NOT NULL,
  [SizeBytes] INT NOT NULL DEFAULT 0,
  [ContentHash] NVARCHAR(64) NOT NULL,
  [StoredPath] NVARCHAR(400) NULL,
  [PageCount] INT NOT NULL DEFAULT 0,
  [ExtractStatus] NVARCHAR(16) NOT NULL DEFAULT 'pending',
  [ExtractedText] NVARCHAR(MAX) NULL,
  [ExtractErrorFa] NVARCHAR(400) NULL,
  [UploadedBy] NVARCHAR(60) NOT NULL,
  [UploadedAt] DATETIME2 NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CtrDocument] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_CtrDocument_Project] ON [dbo].[CtrDocument] ([ProjectId], [UploadedAt]);
CREATE UNIQUE INDEX [UX_CtrDocument_Hash] ON [dbo].[CtrDocument] ([ProjectId], [ContentHash]);
GO

-- CtrClause · d2 · بند قرارداد
IF OBJECT_ID('dbo.CtrClause', 'U') IS NULL
CREATE TABLE [dbo].[CtrClause] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NOT NULL,
  [ClauseNo] NVARCHAR(60) NOT NULL,
  [ParentClauseNo] NVARCHAR(60) NULL,
  [Depth] INT NOT NULL DEFAULT 1,
  [TitleFa] NVARCHAR(400) NULL,
  [BodyText] NVARCHAR(MAX) NOT NULL,
  [PageNo] INT NOT NULL DEFAULT 0,
  [CharStart] INT NOT NULL DEFAULT 0,
  [CharEnd] INT NOT NULL DEFAULT 0,
  [Ordinal] INT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CtrClause] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_CtrClause_Doc] ON [dbo].[CtrClause] ([ProjectId], [DocumentId], [Ordinal]);
CREATE UNIQUE INDEX [UX_CtrClause_No] ON [dbo].[CtrClause] ([DocumentId], [ClauseNo]);
GO

-- CtrBoqDraft · d2 · قلم BoQ استخراجی
IF OBJECT_ID('dbo.CtrBoqDraft', 'U') IS NULL
CREATE TABLE [dbo].[CtrBoqDraft] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NOT NULL,
  [ClauseId] NVARCHAR(60) NULL,
  [ItemNo] NVARCHAR(60) NOT NULL,
  [ParentItemNo] NVARCHAR(60) NULL,
  [ChapterCode] NVARCHAR(40) NULL,
  [TitleFa] NVARCHAR(600) NOT NULL,
  [Unit] NVARCHAR(40) NULL,
  [Qty] DECIMAL(18,4) NULL,
  [UnitRate] DECIMAL(18,2) NULL,
  [LumpSumAmount] DECIMAL(18,2) NULL,
  [PricingBasis] NVARCHAR(16) NOT NULL DEFAULT 'unit_price',
  [Currency] NVARCHAR(8) NULL,
  [ExtractedBy] NVARCHAR(12) NOT NULL DEFAULT 'rule',
  [ProviderId] NVARCHAR(20) NULL,
  [Confidence] INT NOT NULL DEFAULT 0,
  [SourceRefFa] NVARCHAR(200) NULL,
  [PageNo] INT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'draft',
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATETIME2 NULL,
  [PromotedToBoqId] NVARCHAR(60) NULL,
  [Ordinal] INT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CtrBoqDraft] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_CtrBoqDraft_Doc] ON [dbo].[CtrBoqDraft] ([ProjectId], [DocumentId], [Ordinal]);
CREATE UNIQUE INDEX [UX_CtrBoqDraft_Item] ON [dbo].[CtrBoqDraft] ([DocumentId], [ItemNo]);
CREATE INDEX [IX_CtrBoqDraft_Status] ON [dbo].[CtrBoqDraft] ([ProjectId], [Status]);
GO

-- BreakdownNode · d2 · گرهٔ ساختار شکست
IF OBJECT_ID('dbo.BreakdownNode', 'U') IS NULL
CREATE TABLE [dbo].[BreakdownNode] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocumentId] NVARCHAR(60) NULL,
  [ViewKind] NVARCHAR(8) NOT NULL DEFAULT 'wbs',
  [Code] NVARCHAR(80) NOT NULL,
  [ParentCode] NVARCHAR(80) NULL,
  [Depth] INT NOT NULL DEFAULT 1,
  [TitleFa] NVARCHAR(600) NOT NULL,
  [TitleEn] NVARCHAR(600) NULL,
  [Unit] NVARCHAR(40) NULL,
  [Qty] DECIMAL(18,4) NULL,
  [Amount] DECIMAL(18,2) NULL,
  [WeightFactor] DECIMAL(9,4) NULL,
  [WeightValue] DECIMAL(9,4) NULL,
  [CostAccountCode] NVARCHAR(60) NULL,
  [BoqDraftId] NVARCHAR(60) NULL,
  [ClauseId] NVARCHAR(60) NULL,
  [SourceRefFa] NVARCHAR(200) NULL,
  [GeneratedBy] NVARCHAR(12) NOT NULL DEFAULT 'rule',
  [ProviderId] NVARCHAR(20) NULL,
  [Confidence] INT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'draft',
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [Ordinal] INT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_BreakdownNode] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_BreakdownNode_View] ON [dbo].[BreakdownNode] ([ProjectId], [ViewKind], [Ordinal]);
CREATE UNIQUE INDEX [UX_BreakdownNode_Code] ON [dbo].[BreakdownNode] ([ProjectId], [ViewKind], [Code]);
CREATE INDEX [IX_BreakdownNode_Parent] ON [dbo].[BreakdownNode] ([ProjectId], [ViewKind], [ParentCode]);
GO

-- BreakdownColumnDef · d2 · ستون دلخواه ساختار شکست
IF OBJECT_ID('dbo.BreakdownColumnDef', 'U') IS NULL
CREATE TABLE [dbo].[BreakdownColumnDef] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ViewKind] NVARCHAR(8) NOT NULL DEFAULT 'pms',
  [ColumnKey] NVARCHAR(60) NOT NULL,
  [TitleFa] NVARCHAR(200) NOT NULL,
  [TitleEn] NVARCHAR(200) NULL,
  [DataKind] NVARCHAR(12) NOT NULL DEFAULT 'text',
  [Unit] NVARCHAR(40) NULL,
  [RollsUp] BIT NOT NULL DEFAULT 0,
  [Ordinal] INT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_BreakdownColumnDef] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_BreakdownColumnDef] ON [dbo].[BreakdownColumnDef] ([ProjectId], [ViewKind], [ColumnKey]);
CREATE INDEX [IX_BreakdownColumnDef_View] ON [dbo].[BreakdownColumnDef] ([ProjectId], [ViewKind], [Ordinal]);
GO

-- BreakdownValue · d2 · مقدار ستون دلخواه
IF OBJECT_ID('dbo.BreakdownValue', 'U') IS NULL
CREATE TABLE [dbo].[BreakdownValue] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [NodeId] NVARCHAR(60) NOT NULL,
  [ColumnKey] NVARCHAR(60) NOT NULL,
  [ValueText] NVARCHAR(600) NULL,
  [ValueNumber] DECIMAL(18,4) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_BreakdownValue] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_BreakdownValue] ON [dbo].[BreakdownValue] ([NodeId], [ColumnKey]);
CREATE INDEX [IX_BreakdownValue_Project] ON [dbo].[BreakdownValue] ([ProjectId], [ColumnKey]);
GO

-- CpmWorkArea · d2 · حوزهٔ کاری پیمانکار
IF OBJECT_ID('dbo.CpmWorkArea', 'U') IS NULL
CREATE TABLE [dbo].[CpmWorkArea] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [WbsCode] NVARCHAR(60) NOT NULL,
  [ContractorCode] NVARCHAR(60) NOT NULL,
  [Discipline] NVARCHAR(20) NOT NULL,
  [ScopeFa] NVARCHAR(1000) NOT NULL,
  [PackageNo] NVARCHAR(40) NULL,
  [StartDate] DATE NULL,
  [EndDate] DATE NULL,
  [WeightPct] DECIMAL(9,2) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'planned',
  [NoteFa] NVARCHAR(1000) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CpmWorkArea] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CpmWorkArea_Code] ON [dbo].[CpmWorkArea] ([ProjectId], [Code]);
CREATE INDEX [IX_CpmWorkArea_Wbs] ON [dbo].[CpmWorkArea] ([ProjectId], [WbsCode]);
CREATE INDEX [IX_CpmWorkArea_Contractor] ON [dbo].[CpmWorkArea] ([ProjectId], [ContractorCode]);
GO

-- CpmDprEntry · d2 · گزارش روزانهٔ پیمانکار
IF OBJECT_ID('dbo.CpmDprEntry', 'U') IS NULL
CREATE TABLE [dbo].[CpmDprEntry] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ReportNo] NVARCHAR(40) NOT NULL,
  [ReportDate] DATE NOT NULL,
  [Shift] NVARCHAR(10) NOT NULL DEFAULT 'day',
  [ContractorCode] NVARCHAR(60) NOT NULL,
  [Discipline] NVARCHAR(20) NOT NULL,
  [WorkAreaCode] NVARCHAR(40) NULL,
  [LocationFa] NVARCHAR(200) NOT NULL,
  [WeatherFa] NVARCHAR(120) NULL,
  [ManpowerCount] INT NOT NULL,
  [EquipmentCount] INT NULL,
  [WorkDoneFa] NVARCHAR(3000) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [NoteFa] NVARCHAR(1000) NULL,
  [SubmittedAt] DATETIME2 NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ReturnNoteFa] NVARCHAR(1000) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CpmDprEntry] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CpmDpr_No] ON [dbo].[CpmDprEntry] ([ProjectId], [ReportNo]);
CREATE INDEX [IX_CpmDpr_Date] ON [dbo].[CpmDprEntry] ([ProjectId], [ReportDate]);
GO

-- CpmDisciplineReport · d2 · گزارش دیسیپلینی
IF OBJECT_ID('dbo.CpmDisciplineReport', 'U') IS NULL
CREATE TABLE [dbo].[CpmDisciplineReport] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ReportNo] NVARCHAR(40) NOT NULL,
  [ReportDate] DATE NOT NULL,
  [Discipline] NVARCHAR(20) NOT NULL,
  [ContractorCode] NVARCHAR(60) NOT NULL,
  [WorkAreaCode] NVARCHAR(40) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [NoteFa] NVARCHAR(1000) NULL,
  [LineCount] INT NULL,
  [RejectedCount] INT NULL,
  [NdtPassRate] DECIMAL(9,4) NULL,
  [SubmittedAt] DATETIME2 NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ReturnNoteFa] NVARCHAR(1000) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CpmDisciplineReport] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CpmDiscReport_No] ON [dbo].[CpmDisciplineReport] ([ProjectId], [ReportNo]);
CREATE INDEX [IX_CpmDiscReport_Date] ON [dbo].[CpmDisciplineReport] ([ProjectId], [ReportDate]);
GO

-- CpmDisciplineLine · d2 · خط گزارش دیسیپلینی
IF OBJECT_ID('dbo.CpmDisciplineLine', 'U') IS NULL
CREATE TABLE [dbo].[CpmDisciplineLine] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ReportNo] NVARCHAR(40) NOT NULL,
  [ItemRef] NVARCHAR(60) NOT NULL,
  [ItemType] NVARCHAR(30) NOT NULL,
  [SizeInch] DECIMAL(9,2) NULL,
  [Quantity] DECIMAL(18,3) NOT NULL,
  [Unit] NVARCHAR(12) NOT NULL DEFAULT 'ea',
  [ResultCode] NVARCHAR(20) NOT NULL DEFAULT 'na',
  [NdtMethod] NVARCHAR(10) NULL,
  [TestDate] DATE NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CpmDisciplineLine] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CpmDiscLine_Ref] ON [dbo].[CpmDisciplineLine] ([ProjectId], [ReportNo], [ItemRef]);
CREATE INDEX [IX_CpmDiscLine_Type] ON [dbo].[CpmDisciplineLine] ([ProjectId], [ItemType]);
GO

-- CpmInspectionRequest · d8 · درخواست بازرسی و آزادسازی QC
IF OBJECT_ID('dbo.CpmInspectionRequest', 'U') IS NULL
CREATE TABLE [dbo].[CpmInspectionRequest] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RequestNo] NVARCHAR(40) NOT NULL,
  [RequestType] NVARCHAR(10) NOT NULL DEFAULT 'ir',
  [ActivityCode] NVARCHAR(60) NOT NULL,
  [WorkAreaCode] NVARCHAR(40) NULL,
  [Discipline] NVARCHAR(20) NOT NULL,
  [ContractorCode] NVARCHAR(60) NOT NULL,
  [LocationFa] NVARCHAR(200) NOT NULL,
  [ScopeFa] NVARCHAR(1500) NOT NULL,
  [RequestedAt] DATE NOT NULL,
  [TargetDate] DATE NULL,
  [WitnessRequired] BIT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [NcrRef] NVARCHAR(40) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [RequestedBy] NVARCHAR(60) NULL,
  [SubmittedAt] DATETIME2 NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [ReleasedAt] DATETIME2 NULL,
  [ReleasedBy] NVARCHAR(60) NULL,
  [RejectedAt] DATETIME2 NULL,
  [RejectedBy] NVARCHAR(60) NULL,
  [CancelledAt] DATETIME2 NULL,
  [CancelledBy] NVARCHAR(60) NULL,
  [DecisionNoteFa] NVARCHAR(1000) NULL,
  [InspectionRecordId] NVARCHAR(60) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CpmInspectionRequest] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CpmInspection_No] ON [dbo].[CpmInspectionRequest] ([ProjectId], [RequestNo]);
CREATE INDEX [IX_CpmInspection_Status] ON [dbo].[CpmInspectionRequest] ([ProjectId], [Status]);
CREATE INDEX [IX_CpmInspection_Activity] ON [dbo].[CpmInspectionRequest] ([ProjectId], [ActivityCode]);
GO

-- CpmDprAttachment · d2 · پیوست گزارش روزانه
IF OBJECT_ID('dbo.CpmDprAttachment', 'U') IS NULL
CREATE TABLE [dbo].[CpmDprAttachment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ReportNo] NVARCHAR(40) NOT NULL,
  [Kind] NVARCHAR(20) NOT NULL DEFAULT 'attachment',
  [FileName] NVARCHAR(200) NOT NULL,
  [MimeType] NVARCHAR(120) NOT NULL,
  [SizeBytes] INT NOT NULL,
  [Checksum] NVARCHAR(80) NULL,
  [StoredName] NVARCHAR(200) NOT NULL,
  [NoteFa] NVARCHAR(500) NULL,
  [UploadedBy] NVARCHAR(60) NULL,
  [UploadedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CpmDprAttachment] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CpmDprAtt_Stored] ON [dbo].[CpmDprAttachment] ([StoredName]);
CREATE INDEX [IX_CpmDprAtt_Report] ON [dbo].[CpmDprAttachment] ([ProjectId], [ReportNo]);
GO

-- PmoCharter · d6 · منشور پروژه
IF OBJECT_ID('dbo.PmoCharter', 'U') IS NULL
CREATE TABLE [dbo].[PmoCharter] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CharterNo] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [SponsorFa] NVARCHAR(200) NOT NULL,
  [ManagerFa] NVARCHAR(200) NULL,
  [ObjectivesJson] NVARCHAR(MAX) NOT NULL,
  [ScopeInFa] NVARCHAR(2000) NOT NULL,
  [ScopeOutFa] NVARCHAR(2000) NULL,
  [MilestonesJson] NVARCHAR(MAX) NOT NULL,
  [BudgetAmount] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [RisksJson] NVARCHAR(MAX) NOT NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [SubmittedAt] DATETIME2 NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ReturnedAt] DATETIME2 NULL,
  [ReturnedBy] NVARCHAR(60) NULL,
  [ReturnNoteFa] NVARCHAR(500) NULL,
  [SupersededAt] DATETIME2 NULL,
  [SupersededBy] NVARCHAR(60) NULL,
  [SupersededByCharterNo] NVARCHAR(40) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmoCharter] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmoCharter_No] ON [dbo].[PmoCharter] ([ProjectId], [CharterNo]);
CREATE INDEX [IX_PmoCharter_Status] ON [dbo].[PmoCharter] ([ProjectId], [Status]);
GO

-- PmoFormDefinition · d6 · تعریف فرم مصوب
IF OBJECT_ID('dbo.PmoFormDefinition', 'U') IS NULL
CREATE TABLE [dbo].[PmoFormDefinition] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(200) NOT NULL,
  [PurposeFa] NVARCHAR(1000) NOT NULL,
  [FieldsJson] NVARCHAR(MAX) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [Version] INT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(500) NULL,
  [PublishedAt] DATETIME2 NULL,
  [PublishedBy] NVARCHAR(60) NULL,
  [RetiredAt] DATETIME2 NULL,
  [RetiredBy] NVARCHAR(60) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmoFormDefinition] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_PmoFormDefinition_Code] ON [dbo].[PmoFormDefinition] ([ProjectId], [Code]);
CREATE INDEX [IX_PmoFormDefinition_Status] ON [dbo].[PmoFormDefinition] ([ProjectId], [Status]);
GO

-- PmoFormEntry · d6 · رکورد فرم
IF OBJECT_ID('dbo.PmoFormEntry', 'U') IS NULL
CREATE TABLE [dbo].[PmoFormEntry] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [FormCode] NVARCHAR(40) NOT NULL,
  [FormVersion] INT NOT NULL,
  [SubjectFa] NVARCHAR(300) NOT NULL,
  [DataJson] NVARCHAR(MAX) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [NoteFa] NVARCHAR(1000) NULL,
  [SubmittedAt] DATETIME2 NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ReturnedAt] DATETIME2 NULL,
  [ReturnedBy] NVARCHAR(60) NULL,
  [ReturnNoteFa] NVARCHAR(500) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmoFormEntry] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_PmoFormEntry_Form] ON [dbo].[PmoFormEntry] ([ProjectId], [FormCode], [FormVersion]);
CREATE INDEX [IX_PmoFormEntry_Status] ON [dbo].[PmoFormEntry] ([ProjectId], [Status]);
GO

-- PmoHealthAssessment · d6 · کارت سلامت پروژه
IF OBJECT_ID('dbo.PmoHealthAssessment', 'U') IS NULL
CREATE TABLE [dbo].[PmoHealthAssessment] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [AsOfDate] DATE NOT NULL,
  [PeriodNo] INT NULL,
  [CriteriaJson] NVARCHAR(MAX) NOT NULL,
  [ScoreTotal] DECIMAL(9,2) NULL,
  [Band] NVARCHAR(10) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [NoteFa] NVARCHAR(1000) NULL,
  [SubmittedAt] DATETIME2 NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedNoteFa] NVARCHAR(500) NULL,
  [ReturnedAt] DATETIME2 NULL,
  [ReturnedBy] NVARCHAR(60) NULL,
  [ReturnNoteFa] NVARCHAR(500) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_PmoHealthAssessment] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_PmoHealthAssessment_Date] ON [dbo].[PmoHealthAssessment] ([ProjectId], [AsOfDate]);
CREATE INDEX [IX_PmoHealthAssessment_Status] ON [dbo].[PmoHealthAssessment] ([ProjectId], [Status]);
GO

-- RptTemplate · d3 · قالب گزارش سفارشی
IF OBJECT_ID('dbo.RptTemplate', 'U') IS NULL
CREATE TABLE [dbo].[RptTemplate] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(200) NOT NULL,
  [DatasetKey] NVARCHAR(40) NOT NULL,
  [FieldsJson] NVARCHAR(MAX) NOT NULL,
  [FiltersJson] NVARCHAR(MAX) NULL,
  [GroupJson] NVARCHAR(MAX) NULL,
  [SortJson] NVARCHAR(MAX) NULL,
  [ChartJson] NVARCHAR(MAX) NULL,
  [LimitRows] INT NULL DEFAULT 500,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [Version] INT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(1000) NULL,
  [PublishedAt] DATETIME2 NULL,
  [PublishedBy] NVARCHAR(60) NULL,
  [RetiredAt] DATETIME2 NULL,
  [RetiredBy] NVARCHAR(60) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_RptTemplate] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_RptTemplate_Code] ON [dbo].[RptTemplate] ([ProjectId], [Code]);
CREATE INDEX [IX_RptTemplate_Status] ON [dbo].[RptTemplate] ([ProjectId], [Status], [DatasetKey]);
GO

-- ItgConnectorRun · core · اجرای اتصال‌دهندهٔ خروجی
IF OBJECT_ID('dbo.ItgConnectorRun', 'U') IS NULL
CREATE TABLE [dbo].[ItgConnectorRun] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Connector] NVARCHAR(30) NOT NULL,
  [Direction] NVARCHAR(10) NOT NULL DEFAULT 'out',
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'queued',
  [ItemCount] INT NULL,
  [PayloadBytes] INT NULL,
  [Endpoint] NVARCHAR(300) NULL,
  [DurationMs] INT NULL,
  [ErrorCode] NVARCHAR(40) NULL,
  [ErrorFa] NVARCHAR(500) NULL,
  [ActorId] NVARCHAR(60) NOT NULL,
  [StartedAt] DATETIME2 NOT NULL,
  [FinishedAt] DATETIME2 NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_ItgConnectorRun] PRIMARY KEY ([Id])
);
CREATE INDEX [IX_ItgConnectorRun_Project] ON [dbo].[ItgConnectorRun] ([ProjectId], [Connector], [StartedAt]);
CREATE INDEX [IX_ItgConnectorRun_Status] ON [dbo].[ItgConnectorRun] ([Status], [StartedAt]);
GO

-- AiInteraction · core · پرسش و پاسخ دستیار هوشمند
IF OBJECT_ID('dbo.AiInteraction', 'U') IS NULL
CREATE TABLE [dbo].[AiInteraction] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(30) NOT NULL,
  [QuestionFa] NVARCHAR(500) NOT NULL,
  [Tool] NVARCHAR(40) NOT NULL,
  [State] NVARCHAR(20) NOT NULL,
  [ParamsJson] NVARCHAR(MAX) NULL,
  [AnswerFa] NVARCHAR(4000) NOT NULL,
  [FactsJson] NVARCHAR(MAX) NULL,
  [TableJson] NVARCHAR(MAX) NULL,
  [ChartJson] NVARCHAR(MAX) NULL,
  [SourcesJson] NVARCHAR(MAX) NOT NULL,
  [RowCount] INT NOT NULL DEFAULT 0,
  [Truncated] BIT NOT NULL DEFAULT 0,
  [Provider] NVARCHAR(40) NULL,
  [NarrationFa] NVARCHAR(4000) NULL,
  [LatencyMs] INT NULL,
  [ActorId] NVARCHAR(60) NOT NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_AiInteraction] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_AiInteraction_Code] ON [dbo].[AiInteraction] ([ProjectId], [Code]);
CREATE INDEX [IX_AiInteraction_Actor] ON [dbo].[AiInteraction] ([ProjectId], [ActorId], [CreatedAt]);
CREATE INDEX [IX_AiInteraction_Tool] ON [dbo].[AiInteraction] ([ProjectId], [Tool], [CreatedAt]);
GO

-- CntIpcTemplate · d14 · قالب صورت‌وضعیت
IF OBJECT_ID('dbo.CntIpcTemplate', 'U') IS NULL
CREATE TABLE [dbo].[CntIpcTemplate] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(200) NOT NULL,
  [ContractCode] NVARCHAR(60) NULL,
  [ItemsJson] NVARCHAR(MAX) NOT NULL,
  [DeductionsJson] NVARCHAR(MAX) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [Version] INT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(1000) NULL,
  [PublishedAt] DATETIME2 NULL,
  [PublishedBy] NVARCHAR(60) NULL,
  [RetiredAt] DATETIME2 NULL,
  [RetiredBy] NVARCHAR(60) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CntIpcTemplate] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CntIpcTemplate_Code] ON [dbo].[CntIpcTemplate] ([ProjectId], [Code]);
CREATE INDEX [IX_CntIpcTemplate_Status] ON [dbo].[CntIpcTemplate] ([ProjectId], [Status]);
GO

-- CntIpcCertificate · d14 · صورت‌وضعیت دوره
IF OBJECT_ID('dbo.CntIpcCertificate', 'U') IS NULL
CREATE TABLE [dbo].[CntIpcCertificate] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [TemplateCode] NVARCHAR(40) NOT NULL,
  [TemplateVersion] INT NOT NULL DEFAULT 0,
  [ContractCode] NVARCHAR(60) NULL,
  [PeriodNo] INT NOT NULL,
  [PeriodFrom] DATE NOT NULL,
  [PeriodTo] DATE NOT NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [InputsJson] NVARCHAR(MAX) NOT NULL,
  [ComputationJson] NVARCHAR(MAX) NULL,
  [GrossAmount] DECIMAL(18,2) NULL,
  [DeductionTotal] DECIMAL(18,2) NULL,
  [NetAmount] DECIMAL(18,2) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'draft',
  [NoteFa] NVARCHAR(1000) NULL,
  [SubmittedAt] DATETIME2 NULL,
  [SubmittedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [SignedNoteFa] NVARCHAR(500) NULL,
  [ReturnedAt] DATETIME2 NULL,
  [ReturnedBy] NVARCHAR(60) NULL,
  [ReturnNoteFa] NVARCHAR(500) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CntIpcCertificate] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_CntIpcCertificate_Period] ON [dbo].[CntIpcCertificate] ([ProjectId], [TemplateCode], [PeriodNo]);
CREATE INDEX [IX_CntIpcCertificate_Status] ON [dbo].[CntIpcCertificate] ([ProjectId], [Status]);
GO

-- MfgPart · mfg · قطعه و محصول
IF OBJECT_ID('dbo.MfgPart', 'U') IS NULL
CREATE TABLE [dbo].[MfgPart] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartNo] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [PartType] NVARCHAR(20) NOT NULL,
  [BaseUom] NVARCHAR(16) NOT NULL,
  [DescriptionFa] NVARCHAR(1200) NULL,
  [StandardUnitCost] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [IsLotTracked] BIT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgPart] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_MfgPart_Type] CHECK (PartType IN ('manufactured','purchased','phantom','subcontract')),
  CONSTRAINT [CK_MfgPart_Cost] CHECK (StandardUnitCost IS NULL OR StandardUnitCost >= 0)
);
CREATE UNIQUE INDEX [UX_MfgPart_PlantNo] ON [dbo].[MfgPart] ([PlantId], [PartNo]);
CREATE INDEX [IX_MfgPart_Type] ON [dbo].[MfgPart] ([PlantId], [PartType], [IsActive]);
GO

-- MfgBomHeader · mfg · نسخهٔ BOM
IF OBJECT_ID('dbo.MfgBomHeader', 'U') IS NULL
CREATE TABLE [dbo].[MfgBomHeader] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [Revision] NVARCHAR(60) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [BaseQuantity] DECIMAL(18,4) NOT NULL DEFAULT 1,
  [BaseUom] NVARCHAR(16) NOT NULL,
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [IsDefault] BIT NOT NULL DEFAULT 0,
  [ReleasedAt] DATETIME2 NULL,
  [ReleasedBy] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgBomHeader] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgBomHeader_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgBomHeader_Status] CHECK (Status IN ('draft','released','obsolete')),
  CONSTRAINT [CK_MfgBomHeader_BaseQty] CHECK (BaseQuantity > 0),
  CONSTRAINT [CK_MfgBomHeader_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
  CONSTRAINT [CK_MfgBomHeader_Release] CHECK (Status <> 'released' OR (ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL))
);
CREATE UNIQUE INDEX [UX_MfgBomHeader_Revision] ON [dbo].[MfgBomHeader] ([PlantId], [PartId], [Revision]);
CREATE INDEX [IX_MfgBomHeader_Effective] ON [dbo].[MfgBomHeader] ([PlantId], [PartId], [Status], [EffectiveFrom]);
GO

-- MfgBomItem · mfg · ردیف BOM
IF OBJECT_ID('dbo.MfgBomItem', 'U') IS NULL
CREATE TABLE [dbo].[MfgBomItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [BomHeaderId] NVARCHAR(60) NOT NULL,
  [LineNo] INT NOT NULL,
  [ComponentPartId] NVARCHAR(60) NOT NULL,
  [QuantityPer] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [ScrapPct] DECIMAL(7,3) NOT NULL,
  [IssueAtOperationCode] NVARCHAR(40) NULL,
  [IssueMethod] NVARCHAR(16) NOT NULL DEFAULT 'manual',
  [IsPhantom] BIT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgBomItem] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgBomItem_BomHeaderId] FOREIGN KEY ([BomHeaderId]) REFERENCES [dbo].[MfgBomHeader] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgBomItem_ComponentPartId] FOREIGN KEY ([ComponentPartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgBomItem_Line] CHECK (LineNo > 0),
  CONSTRAINT [CK_MfgBomItem_Qty] CHECK (QuantityPer > 0),
  CONSTRAINT [CK_MfgBomItem_Scrap] CHECK (ScrapPct >= 0 AND ScrapPct <= 100),
  CONSTRAINT [CK_MfgBomItem_Issue] CHECK (IssueMethod IN ('manual','backflush','kit'))
);
CREATE UNIQUE INDEX [UX_MfgBomItem_Line] ON [dbo].[MfgBomItem] ([BomHeaderId], [LineNo]);
CREATE INDEX [IX_MfgBomItem_Component] ON [dbo].[MfgBomItem] ([PlantId], [ComponentPartId]);
GO

-- MfgCostCenter · mfg · مرکز هزینهٔ تولید
IF OBJECT_ID('dbo.MfgCostCenter', 'U') IS NULL
CREATE TABLE [dbo].[MfgCostCenter] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [CostElement] NVARCHAR(16) NOT NULL,
  [HourlyRate] DECIMAL(18,4) NOT NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [AllocationBasis] NVARCHAR(20) NOT NULL DEFAULT 'machine_hours',
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgCostCenter] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_MfgCostCenter_Element] CHECK (CostElement IN ('machine','labor','overhead')),
  CONSTRAINT [CK_MfgCostCenter_Rate] CHECK (HourlyRate >= 0),
  CONSTRAINT [CK_MfgCostCenter_Basis] CHECK (AllocationBasis IN ('machine_hours','labor_hours','units','percent')),
  CONSTRAINT [CK_MfgCostCenter_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX [UX_MfgCostCenter_Rate] ON [dbo].[MfgCostCenter] ([PlantId], [Code], [EffectiveFrom]);
CREATE INDEX [IX_MfgCostCenter_Element] ON [dbo].[MfgCostCenter] ([PlantId], [CostElement], [IsActive]);
GO

-- MfgWorkCenter · mfg · مرکز کاری
IF OBJECT_ID('dbo.MfgWorkCenter', 'U') IS NULL
CREATE TABLE [dbo].[MfgWorkCenter] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [Kind] NVARCHAR(20) NOT NULL,
  [NominalCapacityMinutesPerDay] INT NOT NULL DEFAULT 480,
  [EfficiencyPct] DECIMAL(7,3) NOT NULL,
  [CostCenterId] NVARCHAR(60) NULL,
  [TimeZoneId] NVARCHAR(80) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'active',
  [DescriptionFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgWorkCenter] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgWorkCenter_CostCenterId] FOREIGN KEY ([CostCenterId]) REFERENCES [dbo].[MfgCostCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgWorkCenter_Kind] CHECK (Kind IN ('machine','labor','assembly','inspection')),
  CONSTRAINT [CK_MfgWorkCenter_Capacity] CHECK (NominalCapacityMinutesPerDay > 0),
  CONSTRAINT [CK_MfgWorkCenter_Efficiency] CHECK (EfficiencyPct >= 0 AND EfficiencyPct <= 100),
  CONSTRAINT [CK_MfgWorkCenter_Status] CHECK (Status IN ('active','inactive','maintenance'))
);
CREATE UNIQUE INDEX [UX_MfgWorkCenter_Code] ON [dbo].[MfgWorkCenter] ([PlantId], [Code]);
CREATE INDEX [IX_MfgWorkCenter_Status] ON [dbo].[MfgWorkCenter] ([PlantId], [Status], [Kind]);
GO

-- MfgWorkCenterResource · mfg · منبع مرکز کاری
IF OBJECT_ID('dbo.MfgWorkCenterResource', 'U') IS NULL
CREATE TABLE [dbo].[MfgWorkCenterResource] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [ResourceCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(200) NOT NULL,
  [ResourceKind] NVARCHAR(12) NOT NULL,
  [CapacityUnits] DECIMAL(18,4) NOT NULL,
  [AvailabilityPct] DECIMAL(7,3) NOT NULL,
  [EquipmentId] NVARCHAR(60) NULL,
  [CostCenterId] NVARCHAR(60) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [EffectiveFrom] DATE NULL,
  [EffectiveTo] DATE NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgWorkCenterResource] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgWorkCenterResource_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgWorkCenterResource_CostCenterId] FOREIGN KEY ([CostCenterId]) REFERENCES [dbo].[MfgCostCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgWcResource_Kind] CHECK (ResourceKind IN ('machine','labor')),
  CONSTRAINT [CK_MfgWcResource_Capacity] CHECK (CapacityUnits > 0),
  CONSTRAINT [CK_MfgWcResource_Availability] CHECK (AvailabilityPct >= 0 AND AvailabilityPct <= 100),
  CONSTRAINT [CK_MfgWcResource_Dates] CHECK (EffectiveTo IS NULL OR EffectiveFrom IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX [UX_MfgWcResource_Code] ON [dbo].[MfgWorkCenterResource] ([WorkCenterId], [ResourceCode]);
CREATE INDEX [IX_MfgWcResource_Active] ON [dbo].[MfgWorkCenterResource] ([PlantId], [WorkCenterId], [IsActive]);
GO

-- MfgWorkCenterCalendar · mfg · تقویم و شیفت مرکز کاری
IF OBJECT_ID('dbo.MfgWorkCenterCalendar', 'U') IS NULL
CREATE TABLE [dbo].[MfgWorkCenterCalendar] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [RuleType] NVARCHAR(16) NOT NULL,
  [RuleKey] NVARCHAR(100) NOT NULL,
  [WeekdayIso] INT NULL,
  [CalendarDate] DATE NULL,
  [ShiftCode] NVARCHAR(60) NOT NULL,
  [StartMinuteOfDay] INT NULL,
  [EndMinuteOfDay] INT NULL,
  [BreakMinutes] INT NOT NULL DEFAULT 0,
  [BreakStartMinuteOfDay] INT NULL,
  [IsWorking] BIT NOT NULL DEFAULT 1,
  [AvailabilityPct] DECIMAL(7,3) NOT NULL,
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgWorkCenterCalendar] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgWorkCenterCalendar_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgWcCalendar_Type] CHECK (RuleType IN ('weekly','date-override')),
  CONSTRAINT [CK_MfgWcCalendar_KeyShape] CHECK ((RuleType = 'weekly' AND WeekdayIso IS NOT NULL AND WeekdayIso BETWEEN 1 AND 7 AND CalendarDate IS NULL) OR (RuleType = 'date-override' AND WeekdayIso IS NULL AND CalendarDate IS NOT NULL)),
  CONSTRAINT [CK_MfgWcCalendar_Shift] CHECK ((IsWorking = 1 AND StartMinuteOfDay IS NOT NULL AND EndMinuteOfDay IS NOT NULL AND StartMinuteOfDay BETWEEN 0 AND 1439 AND EndMinuteOfDay > StartMinuteOfDay AND EndMinuteOfDay <= 2879 AND BreakMinutes >= 0 AND BreakMinutes <= EndMinuteOfDay - StartMinuteOfDay) OR (IsWorking = 0 AND StartMinuteOfDay IS NULL AND EndMinuteOfDay IS NULL)),
  CONSTRAINT [CK_MfgWcCalendar_BreakStart] CHECK (BreakStartMinuteOfDay IS NULL OR (IsWorking = 1 AND BreakMinutes > 0 AND BreakStartMinuteOfDay >= StartMinuteOfDay AND BreakStartMinuteOfDay + BreakMinutes <= EndMinuteOfDay)),
  CONSTRAINT [CK_MfgWcCalendar_Break] CHECK (BreakMinutes >= 0),
  CONSTRAINT [CK_MfgWcCalendar_Availability] CHECK (AvailabilityPct >= 0 AND AvailabilityPct <= 100),
  CONSTRAINT [CK_MfgWcCalendar_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX [UX_MfgWcCalendar_Rule] ON [dbo].[MfgWorkCenterCalendar] ([WorkCenterId], [RuleKey]);
CREATE INDEX [IX_MfgWcCalendar_Date] ON [dbo].[MfgWorkCenterCalendar] ([PlantId], [WorkCenterId], [CalendarDate]);
GO

-- MfgRouting · mfg · مسیر تولید
IF OBJECT_ID('dbo.MfgRouting', 'U') IS NULL
CREATE TABLE [dbo].[MfgRouting] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [RoutingCode] NVARCHAR(60) NOT NULL,
  [Revision] NVARCHAR(60) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [BaseQuantity] DECIMAL(18,4) NOT NULL DEFAULT 1,
  [BaseUom] NVARCHAR(16) NOT NULL,
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [IsDefault] BIT NOT NULL DEFAULT 0,
  [ReleasedAt] DATETIME2 NULL,
  [ReleasedBy] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgRouting] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgRouting_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgRouting_Status] CHECK (Status IN ('draft','released','obsolete')),
  CONSTRAINT [CK_MfgRouting_BaseQty] CHECK (BaseQuantity > 0),
  CONSTRAINT [CK_MfgRouting_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
  CONSTRAINT [CK_MfgRouting_Release] CHECK (Status <> 'released' OR (ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL))
);
CREATE UNIQUE INDEX [UX_MfgRouting_Revision] ON [dbo].[MfgRouting] ([PlantId], [PartId], [RoutingCode], [Revision]);
CREATE INDEX [IX_MfgRouting_Effective] ON [dbo].[MfgRouting] ([PlantId], [PartId], [Status], [EffectiveFrom]);
GO

-- MfgRoutingOperation · mfg · عملیات مسیر تولید
IF OBJECT_ID('dbo.MfgRoutingOperation', 'U') IS NULL
CREATE TABLE [dbo].[MfgRoutingOperation] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [RoutingId] NVARCHAR(60) NOT NULL,
  [SequenceNo] INT NOT NULL,
  [OperationCode] NVARCHAR(60) NOT NULL,
  [OperationNameFa] NVARCHAR(240) NOT NULL,
  [OperationNameEn] NVARCHAR(240) NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [SetupMinutes] DECIMAL(12,3) NOT NULL,
  [RunMinutesPerUnit] DECIMAL(12,3) NOT NULL,
  [QueueMinutes] DECIMAL(12,3) NOT NULL,
  [MoveMinutes] DECIMAL(12,3) NOT NULL,
  [OverlapAllowed] BIT NOT NULL DEFAULT 0,
  [TransferBatchQty] DECIMAL(18,4) NULL,
  [SplitLotCount] INT NULL,
  [OverlapPct] DECIMAL(7,3) NULL,
  [PredecessorSequence] INT NULL,
  [InspectionRequired] BIT NOT NULL DEFAULT 0,
  [CostCenterId] NVARCHAR(60) NULL,
  [WorkInstructionRef] NVARCHAR(120) NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgRoutingOperation] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgRoutingOperation_RoutingId] FOREIGN KEY ([RoutingId]) REFERENCES [dbo].[MfgRouting] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgRoutingOperation_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgRoutingOperation_CostCenterId] FOREIGN KEY ([CostCenterId]) REFERENCES [dbo].[MfgCostCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgRoutingOp_Sequence] CHECK (SequenceNo > 0),
  CONSTRAINT [CK_MfgRoutingOp_Times] CHECK (SetupMinutes >= 0 AND RunMinutesPerUnit >= 0 AND QueueMinutes >= 0 AND MoveMinutes >= 0),
  CONSTRAINT [CK_MfgRoutingOp_Overlap] CHECK (OverlapAllowed = 0 OR (TransferBatchQty IS NOT NULL AND TransferBatchQty > 0) OR (OverlapPct IS NOT NULL AND OverlapPct > 0 AND OverlapPct < 100)),
  CONSTRAINT [CK_MfgRoutingOp_Split] CHECK (SplitLotCount IS NULL OR SplitLotCount >= 1),
  CONSTRAINT [CK_MfgRoutingOp_Predecessor] CHECK (PredecessorSequence IS NULL OR (PredecessorSequence > 0 AND PredecessorSequence < SequenceNo))
);
CREATE UNIQUE INDEX [UX_MfgRoutingOp_Seq] ON [dbo].[MfgRoutingOperation] ([RoutingId], [SequenceNo]);
CREATE INDEX [IX_MfgRoutingOp_WorkCenter] ON [dbo].[MfgRoutingOperation] ([PlantId], [WorkCenterId], [OperationCode]);
GO

-- MfgProductionOrder · mfg · سفارش تولید
IF OBJECT_ID('dbo.MfgProductionOrder', 'U') IS NULL
CREATE TABLE [dbo].[MfgProductionOrder] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [OrderNo] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [OrderQuantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [DueAt] DATETIME2 NOT NULL,
  [RequestedStartAt] DATETIME2 NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'created',
  [PriorityRule] NVARCHAR(12) NOT NULL DEFAULT 'EDD',
  [ManualRank] INT NULL,
  [DispatchWeight] DECIMAL(12,4) NOT NULL DEFAULT 1,
  [DemandSource] NVARCHAR(16) NOT NULL,
  [DemandRef] NVARCHAR(80) NULL,
  [CustomerRef] NVARCHAR(80) NULL,
  [CustomerNameSnapshot] NVARCHAR(240) NULL,
  [ContractId] NVARCHAR(60) NULL,
  [ProjectId] NVARCHAR(60) NULL,
  [BomHeaderId] NVARCHAR(60) NULL,
  [RoutingId] NVARCHAR(60) NULL,
  [BomRevisionSnapshot] NVARCHAR(40) NULL,
  [RoutingRevisionSnapshot] NVARCHAR(40) NULL,
  [ReleasedAt] DATETIME2 NULL,
  [ReleasedBy] NVARCHAR(60) NULL,
  [CompletedAt] DATETIME2 NULL,
  [ClosedAt] DATETIME2 NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [AllowOverrun] BIT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(1200) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgProductionOrder] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgProductionOrder_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionOrder_BomHeaderId] FOREIGN KEY ([BomHeaderId]) REFERENCES [dbo].[MfgBomHeader] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionOrder_RoutingId] FOREIGN KEY ([RoutingId]) REFERENCES [dbo].[MfgRouting] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgProdOrder_Qty] CHECK (OrderQuantity > 0),
  CONSTRAINT [CK_MfgProdOrder_Status] CHECK (Status IN ('created','released','in-progress','completed','closed')),
  CONSTRAINT [CK_MfgProdOrder_Priority] CHECK (PriorityRule IN ('EDD','CR','MANUAL')),
  CONSTRAINT [CK_MfgProdOrder_DispatchWeight] CHECK (DispatchWeight > 0),
  CONSTRAINT [CK_MfgProdOrder_Demand] CHECK (DemandSource IN ('sales-order','contract','forecast','manual','mrp')),
  CONSTRAINT [CK_MfgProdOrder_Rank] CHECK (ManualRank IS NULL OR ManualRank >= 0),
  CONSTRAINT [CK_MfgProdOrder_Release] CHECK (Status = 'created' OR (BomHeaderId IS NOT NULL AND RoutingId IS NOT NULL AND ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL))
);
CREATE UNIQUE INDEX [UX_MfgProdOrder_No] ON [dbo].[MfgProductionOrder] ([PlantId], [OrderNo]);
CREATE INDEX [IX_MfgProdOrder_Dispatch] ON [dbo].[MfgProductionOrder] ([PlantId], [Status], [DueAt], [PriorityRule]);
CREATE INDEX [IX_MfgProdOrder_Part] ON [dbo].[MfgProductionOrder] ([PlantId], [PartId], [Status]);
CREATE INDEX [IX_MfgProdOrder_Contract] ON [dbo].[MfgProductionOrder] ([ContractId], [Status]);
GO

-- MfgProductionOrderOperation · mfg · عملیات سفارش تولید
IF OBJECT_ID('dbo.MfgProductionOrderOperation', 'U') IS NULL
CREATE TABLE [dbo].[MfgProductionOrderOperation] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderId] NVARCHAR(60) NOT NULL,
  [RoutingOperationId] NVARCHAR(60) NULL,
  [SequenceNo] INT NOT NULL,
  [OperationCode] NVARCHAR(60) NOT NULL,
  [OperationNameFa] NVARCHAR(240) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [PredecessorOperationId] NVARCHAR(60) NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'pending',
  [PlannedQuantity] DECIMAL(18,4) NOT NULL,
  [PlannedSetupMinutes] DECIMAL(12,3) NOT NULL,
  [PlannedRunMinutesPerUnit] DECIMAL(12,3) NOT NULL,
  [PlannedQueueMinutes] DECIMAL(12,3) NOT NULL,
  [PlannedMoveMinutes] DECIMAL(12,3) NOT NULL,
  [PlannedCapacityMinutes] DECIMAL(12,3) NOT NULL,
  [OverlapAllowed] BIT NOT NULL DEFAULT 0,
  [TransferBatchQty] DECIMAL(18,4) NULL,
  [SplitLotCount] INT NULL,
  [OverlapPct] DECIMAL(7,3) NULL,
  [InspectionRequired] BIT NOT NULL DEFAULT 0,
  [BlockedReasonFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgProductionOrderOperation] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgProductionOrderOperation_ProductionOrderId] FOREIGN KEY ([ProductionOrderId]) REFERENCES [dbo].[MfgProductionOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionOrderOperation_RoutingOperationId] FOREIGN KEY ([RoutingOperationId]) REFERENCES [dbo].[MfgRoutingOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionOrderOperation_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionOrderOperation_PredecessorOperationId] FOREIGN KEY ([PredecessorOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgOrderOp_Sequence] CHECK (SequenceNo > 0),
  CONSTRAINT [CK_MfgOrderOp_Status] CHECK (Status IN ('pending','queued','ready','setup','running','blocked','completed')),
  CONSTRAINT [CK_MfgOrderOp_Qty] CHECK (PlannedQuantity > 0),
  CONSTRAINT [CK_MfgOrderOp_Times] CHECK (PlannedSetupMinutes >= 0 AND PlannedRunMinutesPerUnit >= 0 AND PlannedQueueMinutes >= 0 AND PlannedMoveMinutes >= 0 AND PlannedCapacityMinutes >= 0),
  CONSTRAINT [CK_MfgOrderOp_Overlap] CHECK (OverlapAllowed = 0 OR (TransferBatchQty IS NOT NULL AND TransferBatchQty > 0) OR (OverlapPct IS NOT NULL AND OverlapPct > 0 AND OverlapPct < 100)),
  CONSTRAINT [CK_MfgOrderOp_Split] CHECK (SplitLotCount IS NULL OR SplitLotCount >= 1)
);
CREATE UNIQUE INDEX [UX_MfgOrderOp_Sequence] ON [dbo].[MfgProductionOrderOperation] ([ProductionOrderId], [SequenceNo]);
CREATE INDEX [IX_MfgOrderOp_Queue] ON [dbo].[MfgProductionOrderOperation] ([PlantId], [WorkCenterId], [Status], [SequenceNo]);
CREATE INDEX [IX_MfgOrderOp_OrderStatus] ON [dbo].[MfgProductionOrderOperation] ([ProductionOrderId], [Status]);
GO

-- MfgOperationSchedule · mfg · قطعهٔ زمان‌بندی عملیات
IF OBJECT_ID('dbo.MfgOperationSchedule', 'U') IS NULL
CREATE TABLE [dbo].[MfgOperationSchedule] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [ScheduleVersion] INT NOT NULL,
  [SegmentNo] INT NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [ResourceId] NVARCHAR(60) NULL,
  [PlannedStartAt] DATETIME2 NOT NULL,
  [PlannedEndAt] DATETIME2 NOT NULL,
  [PlannedCapacityMinutes] DECIMAL(12,3) NOT NULL,
  [QueueMinutes] DECIMAL(12,3) NOT NULL,
  [MoveMinutes] DECIMAL(12,3) NOT NULL,
  [CapacityMode] NVARCHAR(16) NOT NULL,
  [Direction] NVARCHAR(12) NOT NULL,
  [DispatchRule] NVARCHAR(12) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'tentative',
  [CommittedAt] DATETIME2 NULL,
  [CommittedBy] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgOperationSchedule] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgOperationSchedule_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgOperationSchedule_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgOperationSchedule_ResourceId] FOREIGN KEY ([ResourceId]) REFERENCES [dbo].[MfgWorkCenterResource] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgOpSchedule_Version] CHECK (ScheduleVersion > 0 AND SegmentNo > 0),
  CONSTRAINT [CK_MfgOpSchedule_Window] CHECK (PlannedEndAt > PlannedStartAt),
  CONSTRAINT [CK_MfgOpSchedule_Times] CHECK (PlannedCapacityMinutes >= 0 AND QueueMinutes >= 0 AND MoveMinutes >= 0),
  CONSTRAINT [CK_MfgOpSchedule_Mode] CHECK (CapacityMode IN ('finite','semi-finite')),
  CONSTRAINT [CK_MfgOpSchedule_Direction] CHECK (Direction IN ('forward','backward')),
  CONSTRAINT [CK_MfgOpSchedule_Status] CHECK (Status IN ('tentative','firm','cancelled'))
);
CREATE UNIQUE INDEX [UX_MfgOpSchedule_Segment] ON [dbo].[MfgOperationSchedule] ([ProductionOrderOperationId], [ScheduleVersion], [SegmentNo]);
CREATE INDEX [IX_MfgOpSchedule_WcWindow] ON [dbo].[MfgOperationSchedule] ([PlantId], [WorkCenterId], [PlannedStartAt], [PlannedEndAt], [Status]);
GO

-- MfgCapacityPlan · mfg · برنامهٔ ظرفیت مرکز کاری
IF OBJECT_ID('dbo.MfgCapacityPlan', 'U') IS NULL
CREATE TABLE [dbo].[MfgCapacityPlan] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [ScheduleVersion] INT NOT NULL,
  [PeriodStart] DATETIME2 NOT NULL,
  [PeriodEnd] DATETIME2 NOT NULL,
  [AvailableMinutes] DECIMAL(12,3) NOT NULL,
  [PlannedLoadMinutes] DECIMAL(12,3) NOT NULL,
  [ReservedMinutes] DECIMAL(12,3) NOT NULL,
  [UtilizationPct] DECIMAL(7,3) NULL,
  [OverloadMinutes] DECIMAL(12,3) NOT NULL,
  [IsBottleneck] BIT NOT NULL DEFAULT 0,
  [CalculatedAt] DATETIME2 NOT NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgCapacityPlan] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgCapacityPlan_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgCapacityPlan_Period] CHECK (PeriodEnd > PeriodStart),
  CONSTRAINT [CK_MfgCapacityPlan_Load] CHECK (ScheduleVersion > 0 AND AvailableMinutes >= 0 AND PlannedLoadMinutes >= 0 AND ReservedMinutes >= 0 AND OverloadMinutes >= 0 AND ((AvailableMinutes = 0 AND UtilizationPct IS NULL) OR (AvailableMinutes > 0 AND UtilizationPct IS NOT NULL AND UtilizationPct >= 0)))
);
CREATE UNIQUE INDEX [UX_MfgCapacityPlan_Bucket] ON [dbo].[MfgCapacityPlan] ([PlantId], [WorkCenterId], [ScheduleVersion], [PeriodStart], [PeriodEnd]);
CREATE INDEX [IX_MfgCapacityPlan_Bottleneck] ON [dbo].[MfgCapacityPlan] ([PlantId], [IsBottleneck], [PeriodStart]);
GO

-- MfgOperationExecution · mfg · اجرای واقعی عملیات
IF OBJECT_ID('dbo.MfgOperationExecution', 'U') IS NULL
CREATE TABLE [dbo].[MfgOperationExecution] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [ExecutionNo] INT NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'running',
  [ResourceId] NVARCHAR(60) NULL,
  [OperatorId] NVARCHAR(60) NULL,
  [StartedAt] DATETIME2 NOT NULL,
  [FinishedAt] DATETIME2 NULL,
  [SetupActualMinutes] DECIMAL(12,3) NOT NULL,
  [RunActualMinutes] DECIMAL(12,3) NOT NULL,
  [InputQuantity] DECIMAL(18,4) NOT NULL,
  [GoodQuantity] DECIMAL(18,4) NOT NULL,
  [ReworkQuantity] DECIMAL(18,4) NOT NULL,
  [ScrapQuantity] DECIMAL(18,4) NOT NULL,
  [IdempotencyKey] NVARCHAR(160) NOT NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgOperationExecution] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgOperationExecution_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgOperationExecution_ResourceId] FOREIGN KEY ([ResourceId]) REFERENCES [dbo].[MfgWorkCenterResource] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgExecution_No] CHECK (ExecutionNo > 0),
  CONSTRAINT [CK_MfgExecution_Status] CHECK (Status IN ('running','completed','cancelled')),
  CONSTRAINT [CK_MfgExecution_Times] CHECK (SetupActualMinutes >= 0 AND RunActualMinutes >= 0),
  CONSTRAINT [CK_MfgExecution_Qty] CHECK (InputQuantity >= 0 AND GoodQuantity >= 0 AND ReworkQuantity >= 0 AND ScrapQuantity >= 0 AND GoodQuantity + ReworkQuantity + ScrapQuantity <= InputQuantity),
  CONSTRAINT [CK_MfgExecution_Finish] CHECK (FinishedAt IS NULL OR FinishedAt >= StartedAt),
  CONSTRAINT [CK_MfgExecution_Completed] CHECK (Status <> 'completed' OR FinishedAt IS NOT NULL)
);
CREATE UNIQUE INDEX [UX_MfgExecution_No] ON [dbo].[MfgOperationExecution] ([ProductionOrderOperationId], [ExecutionNo]);
CREATE UNIQUE INDEX [UX_MfgExecution_Idempotency] ON [dbo].[MfgOperationExecution] ([IdempotencyKey]);
CREATE INDEX [IX_MfgExecution_Started] ON [dbo].[MfgOperationExecution] ([PlantId], [StartedAt], [Status]);
GO

-- MfgDowntimeLog · mfg · ثبت توقف
IF OBJECT_ID('dbo.MfgDowntimeLog', 'U') IS NULL
CREATE TABLE [dbo].[MfgDowntimeLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NULL,
  [ExecutionId] NVARCHAR(60) NULL,
  [ResourceId] NVARCHAR(60) NULL,
  [StartedAt] DATETIME2 NOT NULL,
  [FinishedAt] DATETIME2 NULL,
  [DurationMinutes] DECIMAL(12,3) NOT NULL,
  [DowntimeType] NVARCHAR(16) NOT NULL,
  [ReasonCode] NVARCHAR(60) NOT NULL,
  [RecordedBy] NVARCHAR(60) NOT NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgDowntimeLog] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgDowntimeLog_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgDowntimeLog_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgDowntimeLog_ExecutionId] FOREIGN KEY ([ExecutionId]) REFERENCES [dbo].[MfgOperationExecution] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgDowntimeLog_ResourceId] FOREIGN KEY ([ResourceId]) REFERENCES [dbo].[MfgWorkCenterResource] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgDowntime_Type] CHECK (DowntimeType IN ('planned','unplanned')),
  CONSTRAINT [CK_MfgDowntime_Duration] CHECK (DurationMinutes IS NULL OR DurationMinutes >= 0),
  CONSTRAINT [CK_MfgDowntime_Window] CHECK (FinishedAt IS NULL OR FinishedAt >= StartedAt)
);
CREATE INDEX [IX_MfgDowntime_WcTime] ON [dbo].[MfgDowntimeLog] ([PlantId], [WorkCenterId], [StartedAt]);
CREATE INDEX [IX_MfgDowntime_Operation] ON [dbo].[MfgDowntimeLog] ([ProductionOrderOperationId], [StartedAt]);
GO

-- MfgScrapRecord · mfg · ثبت ضایعات
IF OBJECT_ID('dbo.MfgScrapRecord', 'U') IS NULL
CREATE TABLE [dbo].[MfgScrapRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [ExecutionId] NVARCHAR(60) NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [ReasonCode] NVARCHAR(60) NOT NULL,
  [Disposition] NVARCHAR(20) NOT NULL,
  [CostAmount] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [RecordedAt] DATETIME2 NOT NULL,
  [RecordedBy] NVARCHAR(60) NOT NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgScrapRecord] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgScrapRecord_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgScrapRecord_ExecutionId] FOREIGN KEY ([ExecutionId]) REFERENCES [dbo].[MfgOperationExecution] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgScrap_Qty] CHECK (Quantity > 0),
  CONSTRAINT [CK_MfgScrap_Disposition] CHECK (Disposition IN ('scrapped','returned-to-stock','use-as-is')),
  CONSTRAINT [CK_MfgScrap_Cost] CHECK (CostAmount IS NULL OR CostAmount >= 0)
);
CREATE INDEX [IX_MfgScrap_Operation] ON [dbo].[MfgScrapRecord] ([PlantId], [ProductionOrderOperationId], [RecordedAt]);
CREATE INDEX [IX_MfgScrap_Reason] ON [dbo].[MfgScrapRecord] ([PlantId], [ReasonCode], [RecordedAt]);
GO

-- MfgReworkRecord · mfg · ثبت دوباره‌کاری
IF OBJECT_ID('dbo.MfgReworkRecord', 'U') IS NULL
CREATE TABLE [dbo].[MfgReworkRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ReworkNo] NVARCHAR(60) NOT NULL,
  [SourceOperationId] NVARCHAR(60) NOT NULL,
  [ExecutionId] NVARCHAR(60) NULL,
  [TargetOperationId] NVARCHAR(60) NULL,
  [ScrapRecordId] NVARCHAR(60) NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [ReasonCode] NVARCHAR(60) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'open',
  [StartedAt] DATETIME2 NULL,
  [FinishedAt] DATETIME2 NULL,
  [Disposition] NVARCHAR(20) NULL,
  [ActualCost] DECIMAL(18,2) NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgReworkRecord] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgReworkRecord_SourceOperationId] FOREIGN KEY ([SourceOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgReworkRecord_TargetOperationId] FOREIGN KEY ([TargetOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgReworkRecord_ExecutionId] FOREIGN KEY ([ExecutionId]) REFERENCES [dbo].[MfgOperationExecution] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgReworkRecord_ScrapRecordId] FOREIGN KEY ([ScrapRecordId]) REFERENCES [dbo].[MfgScrapRecord] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgRework_Qty] CHECK (Quantity > 0),
  CONSTRAINT [CK_MfgRework_Status] CHECK (Status IN ('open','in-progress','completed','cancelled')),
  CONSTRAINT [CK_MfgRework_Window] CHECK (FinishedAt IS NULL OR (StartedAt IS NOT NULL AND FinishedAt >= StartedAt)),
  CONSTRAINT [CK_MfgRework_Cost] CHECK (ActualCost IS NULL OR ActualCost >= 0)
);
CREATE UNIQUE INDEX [UX_MfgRework_No] ON [dbo].[MfgReworkRecord] ([PlantId], [ReworkNo]);
CREATE INDEX [IX_MfgRework_Source] ON [dbo].[MfgReworkRecord] ([PlantId], [SourceOperationId], [Status]);
GO

-- MfgMaterial · mfg · مادهٔ قابل برنامه‌ریزی
IF OBJECT_ID('dbo.MfgMaterial', 'U') IS NULL
CREATE TABLE [dbo].[MfgMaterial] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [ProcurementType] NVARCHAR(8) NOT NULL,
  [LeadTimeDays] INT NOT NULL DEFAULT 0,
  [SafetyStockQty] DECIMAL(18,4) NOT NULL,
  [LotSize] DECIMAL(18,4) NOT NULL,
  [OrderMultiple] DECIMAL(18,4) NOT NULL,
  [ShelfLifeDays] INT NULL,
  [StandardUnitCost] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [DefaultWarehouseCode] NVARCHAR(40) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgMaterial] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgMaterial_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgMaterial_Type] CHECK (ProcurementType IN ('make','buy')),
  CONSTRAINT [CK_MfgMaterial_Lead] CHECK (LeadTimeDays >= 0 AND (ShelfLifeDays IS NULL OR ShelfLifeDays >= 0)),
  CONSTRAINT [CK_MfgMaterial_Quantities] CHECK (SafetyStockQty >= 0 AND LotSize > 0 AND OrderMultiple > 0),
  CONSTRAINT [CK_MfgMaterial_Cost] CHECK (StandardUnitCost IS NULL OR StandardUnitCost >= 0)
);
CREATE UNIQUE INDEX [UX_MfgMaterial_Part] ON [dbo].[MfgMaterial] ([PlantId], [PartId]);
CREATE INDEX [IX_MfgMaterial_Replenish] ON [dbo].[MfgMaterial] ([PlantId], [ProcurementType], [IsActive]);
GO

-- MfgMaterialRequirement · mfg · نیاز مواد
IF OBJECT_ID('dbo.MfgMaterialRequirement', 'U') IS NULL
CREATE TABLE [dbo].[MfgMaterialRequirement] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NULL,
  [BomItemId] NVARCHAR(60) NOT NULL,
  [MaterialId] NVARCHAR(60) NOT NULL,
  [RequirementKey] NVARCHAR(180) NOT NULL,
  [RequiredAt] DATETIME2 NOT NULL,
  [GrossQuantity] DECIMAL(18,4) NOT NULL,
  [ScrapAllowanceQty] DECIMAL(18,4) NOT NULL,
  [NetQuantity] DECIMAL(18,4) NOT NULL,
  [AvailableQuantity] DECIMAL(18,4) NOT NULL,
  [ReservedQuantity] DECIMAL(18,4) NOT NULL,
  [ShortageQuantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'planned',
  [ScheduleVersion] INT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgMaterialRequirement] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgMaterialRequirement_ProductionOrderId] FOREIGN KEY ([ProductionOrderId]) REFERENCES [dbo].[MfgProductionOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialRequirement_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialRequirement_BomItemId] FOREIGN KEY ([BomItemId]) REFERENCES [dbo].[MfgBomItem] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialRequirement_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [dbo].[MfgMaterial] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgMatReq_Status] CHECK (Status IN ('planned','shortage','reserved','issued','closed','cancelled')),
  CONSTRAINT [CK_MfgMatReq_Qty] CHECK (GrossQuantity >= 0 AND ScrapAllowanceQty >= 0 AND NetQuantity >= 0 AND AvailableQuantity >= 0 AND ReservedQuantity >= 0 AND ShortageQuantity >= 0),
  CONSTRAINT [CK_MfgMatReq_Version] CHECK (ScheduleVersion > 0)
);
CREATE UNIQUE INDEX [UX_MfgMatReq_Key] ON [dbo].[MfgMaterialRequirement] ([PlantId], [RequirementKey]);
CREATE INDEX [IX_MfgMatReq_Shortage] ON [dbo].[MfgMaterialRequirement] ([PlantId], [Status], [RequiredAt], [MaterialId]);
CREATE INDEX [IX_MfgMatReq_Order] ON [dbo].[MfgMaterialRequirement] ([ProductionOrderId], [RequiredAt]);
GO

-- MfgMaterialConsumption · mfg · مصرف واقعی مواد
IF OBJECT_ID('dbo.MfgMaterialConsumption', 'U') IS NULL
CREATE TABLE [dbo].[MfgMaterialConsumption] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [RequirementId] NVARCHAR(60) NULL,
  [ExecutionId] NVARCHAR(60) NULL,
  [MaterialId] NVARCHAR(60) NOT NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [LotNo] NVARCHAR(60) NULL,
  [UnitCost] DECIMAL(18,2) NOT NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [ConsumptionMethod] NVARCHAR(12) NOT NULL,
  [ConsumedAt] DATETIME2 NOT NULL,
  [IdempotencyKey] NVARCHAR(160) NOT NULL,
  [PostedBy] NVARCHAR(60) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgMaterialConsumption] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgMaterialConsumption_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialConsumption_RequirementId] FOREIGN KEY ([RequirementId]) REFERENCES [dbo].[MfgMaterialRequirement] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialConsumption_ExecutionId] FOREIGN KEY ([ExecutionId]) REFERENCES [dbo].[MfgOperationExecution] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialConsumption_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [dbo].[MfgMaterial] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgMatConsumption_Qty] CHECK (Quantity > 0),
  CONSTRAINT [CK_MfgMatConsumption_Cost] CHECK (UnitCost >= 0),
  CONSTRAINT [CK_MfgMatConsumption_Method] CHECK (ConsumptionMethod IN ('manual','backflush','issue'))
);
CREATE UNIQUE INDEX [UX_MfgMatConsumption_Idem] ON [dbo].[MfgMaterialConsumption] ([IdempotencyKey]);
CREATE INDEX [IX_MfgMatConsumption_Operation] ON [dbo].[MfgMaterialConsumption] ([PlantId], [ProductionOrderOperationId], [ConsumedAt]);
CREATE INDEX [IX_MfgMatConsumption_Material] ON [dbo].[MfgMaterialConsumption] ([PlantId], [MaterialId], [ConsumedAt]);
GO

-- MfgInventoryLevel · mfg · سطح موجودی مواد
IF OBJECT_ID('dbo.MfgInventoryLevel', 'U') IS NULL
CREATE TABLE [dbo].[MfgInventoryLevel] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [MaterialId] NVARCHAR(60) NOT NULL,
  [WarehouseCode] NVARCHAR(40) NOT NULL,
  [LocationCode] NVARCHAR(40) NOT NULL DEFAULT '',
  [LotNo] NVARCHAR(60) NOT NULL DEFAULT '',
  [InventoryKey] NVARCHAR(240) NOT NULL,
  [OnHandQty] DECIMAL(18,4) NOT NULL,
  [ReservedQty] DECIMAL(18,4) NOT NULL,
  [BlockedQty] DECIMAL(18,4) NOT NULL,
  [InTransitQty] DECIMAL(18,4) NOT NULL,
  [SafetyStockQty] DECIMAL(18,4) NOT NULL,
  [AsOfAt] DATETIME2 NOT NULL,
  [LastCountedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgInventoryLevel] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgInventoryLevel_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [dbo].[MfgMaterial] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgInventory_Qty] CHECK (OnHandQty >= 0 AND ReservedQty >= 0 AND BlockedQty >= 0 AND InTransitQty >= 0 AND SafetyStockQty >= 0 AND ReservedQty + BlockedQty <= OnHandQty)
);
CREATE UNIQUE INDEX [UX_MfgInventory_Key] ON [dbo].[MfgInventoryLevel] ([PlantId], [InventoryKey]);
CREATE INDEX [IX_MfgInventory_Material] ON [dbo].[MfgInventoryLevel] ([PlantId], [MaterialId], [WarehouseCode]);
GO

-- MfgOperationCost · mfg · هزینهٔ عملیات
IF OBJECT_ID('dbo.MfgOperationCost', 'U') IS NULL
CREATE TABLE [dbo].[MfgOperationCost] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [CostCenterId] NVARCHAR(60) NULL,
  [CostElement] NVARCHAR(16) NOT NULL,
  [CostVersion] INT NOT NULL,
  [StandardQuantity] DECIMAL(18,4) NOT NULL,
  [PlannedQuantity] DECIMAL(18,4) NULL,
  [ActualQuantity] DECIMAL(18,4) NOT NULL,
  [StandardRate] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [PlannedRate] DECIMAL(18,4) NULL,
  [ActualRate] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [StandardAmount] DECIMAL(18,2) NOT NULL,
  [PlannedAmount] DECIMAL(18,2) NULL,
  [ActualAmount] DECIMAL(18,2) NOT NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [CalculatedAt] DATETIME2 NOT NULL,
  [SourceRef] NVARCHAR(100) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgOperationCost] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgOperationCost_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgOperationCost_CostCenterId] FOREIGN KEY ([CostCenterId]) REFERENCES [dbo].[MfgCostCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgOperationCost_Element] CHECK (CostElement IN ('material','machine','labor','overhead','scrap')),
  CONSTRAINT [CK_MfgOperationCost_Version] CHECK (CostVersion > 0),
  CONSTRAINT [CK_MfgOperationCost_Amounts] CHECK (StandardQuantity >= 0 AND ActualQuantity >= 0 AND StandardRate >= 0 AND ActualRate >= 0 AND StandardAmount >= 0 AND ActualAmount >= 0),
  CONSTRAINT [CK_MfgOperationCost_PlannedAmounts] CHECK ((PlannedQuantity IS NULL OR PlannedQuantity >= 0) AND (PlannedRate IS NULL OR PlannedRate >= 0) AND (PlannedAmount IS NULL OR PlannedAmount >= 0))
);
CREATE UNIQUE INDEX [UX_MfgOperationCost_Element] ON [dbo].[MfgOperationCost] ([ProductionOrderOperationId], [CostElement], [CostVersion]);
CREATE INDEX [IX_MfgOperationCost_Center] ON [dbo].[MfgOperationCost] ([PlantId], [CostCenterId], [CalculatedAt]);
GO

-- MfgOrderCost · mfg · هزینهٔ تجمیعی سفارش
IF OBJECT_ID('dbo.MfgOrderCost', 'U') IS NULL
CREATE TABLE [dbo].[MfgOrderCost] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderId] NVARCHAR(60) NOT NULL,
  [CostVersion] INT NOT NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [StandardMaterialCost] DECIMAL(18,2) NOT NULL,
  [PlannedMaterialCost] DECIMAL(18,2) NULL,
  [ActualMaterialCost] DECIMAL(18,2) NOT NULL,
  [StandardMachineCost] DECIMAL(18,2) NOT NULL,
  [PlannedMachineCost] DECIMAL(18,2) NULL,
  [ActualMachineCost] DECIMAL(18,2) NOT NULL,
  [StandardLaborCost] DECIMAL(18,2) NOT NULL,
  [PlannedLaborCost] DECIMAL(18,2) NULL,
  [ActualLaborCost] DECIMAL(18,2) NOT NULL,
  [StandardOverheadCost] DECIMAL(18,2) NOT NULL,
  [PlannedOverheadCost] DECIMAL(18,2) NULL,
  [ActualOverheadCost] DECIMAL(18,2) NOT NULL,
  [StandardScrapCost] DECIMAL(18,2) NULL,
  [PlannedScrapCost] DECIMAL(18,2) NULL,
  [ActualScrapCost] DECIMAL(18,2) NULL,
  [StandardTotalCost] DECIMAL(18,2) NOT NULL,
  [PlannedTotalCost] DECIMAL(18,2) NULL,
  [ActualTotalCost] DECIMAL(18,2) NOT NULL,
  [ContractRevenue] DECIMAL(18,2) NULL,
  [GrossMargin] DECIMAL(18,2) NULL,
  [Reconciled] BIT NOT NULL DEFAULT 0,
  [ReconciledAt] DATETIME2 NULL,
  [ReconcileThrough] DATETIME2 NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgOrderCost] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgOrderCost_ProductionOrderId] FOREIGN KEY ([ProductionOrderId]) REFERENCES [dbo].[MfgProductionOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgOrderCost_Version] CHECK (CostVersion > 0),
  CONSTRAINT [CK_MfgOrderCost_Amounts] CHECK (StandardMaterialCost >= 0 AND ActualMaterialCost >= 0 AND StandardMachineCost >= 0 AND ActualMachineCost >= 0 AND StandardLaborCost >= 0 AND ActualLaborCost >= 0 AND StandardOverheadCost >= 0 AND ActualOverheadCost >= 0 AND StandardTotalCost >= 0 AND ActualTotalCost >= 0),
  CONSTRAINT [CK_MfgOrderCost_Phase4Amounts] CHECK ((PlannedMaterialCost IS NULL OR PlannedMaterialCost >= 0) AND (PlannedMachineCost IS NULL OR PlannedMachineCost >= 0) AND (PlannedLaborCost IS NULL OR PlannedLaborCost >= 0) AND (PlannedOverheadCost IS NULL OR PlannedOverheadCost >= 0) AND (StandardScrapCost IS NULL OR StandardScrapCost >= 0) AND (PlannedScrapCost IS NULL OR PlannedScrapCost >= 0) AND (ActualScrapCost IS NULL OR ActualScrapCost >= 0) AND (PlannedTotalCost IS NULL OR PlannedTotalCost >= 0)),
  CONSTRAINT [CK_MfgOrderCost_Reconciled] CHECK (Reconciled = 0 OR ReconciledAt IS NOT NULL)
);
CREATE UNIQUE INDEX [UX_MfgOrderCost_Version] ON [dbo].[MfgOrderCost] ([ProductionOrderId], [CostVersion]);
CREATE INDEX [IX_MfgOrderCost_Reconcile] ON [dbo].[MfgOrderCost] ([PlantId], [Reconciled], [ReconciledAt]);
GO

-- MfgProductionAlert · mfg · هشدار تولید
IF OBJECT_ID('dbo.MfgProductionAlert', 'U') IS NULL
CREATE TABLE [dbo].[MfgProductionAlert] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [AlertKey] NVARCHAR(60) NOT NULL,
  [AlertCode] NVARCHAR(60) NOT NULL,
  [Severity] NVARCHAR(12) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'open',
  [ProductionOrderId] NVARCHAR(60) NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NULL,
  [WorkCenterId] NVARCHAR(60) NULL,
  [TitleFa] NVARCHAR(240) NOT NULL,
  [DetailFa] NVARCHAR(1200) NULL,
  [FirstRaisedAt] DATETIME2 NOT NULL,
  [LastRaisedAt] DATETIME2 NOT NULL,
  [AcknowledgedAt] DATETIME2 NULL,
  [AcknowledgedBy] NVARCHAR(60) NULL,
  [ResolvedAt] DATETIME2 NULL,
  [ResolvedBy] NVARCHAR(60) NULL,
  [OccurrenceCount] INT NOT NULL DEFAULT 1,
  [ThresholdValue] DECIMAL(18,4) NULL,
  [ActualValue] DECIMAL(18,4) NULL,
  [SourceEventKey] NVARCHAR(160) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgProductionAlert] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgProductionAlert_ProductionOrderId] FOREIGN KEY ([ProductionOrderId]) REFERENCES [dbo].[MfgProductionOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionAlert_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionAlert_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgAlert_Severity] CHECK (Severity IN ('critical','high','medium','low')),
  CONSTRAINT [CK_MfgAlert_Status] CHECK (Status IN ('open','acknowledged','resolved','suppressed')),
  CONSTRAINT [CK_MfgAlert_Count] CHECK (OccurrenceCount > 0),
  CONSTRAINT [CK_MfgAlert_Resolved] CHECK (Status <> 'resolved' OR ResolvedAt IS NOT NULL)
);
CREATE UNIQUE INDEX [UX_MfgAlert_Dedup] ON [dbo].[MfgProductionAlert] ([PlantId], [AlertKey]);
CREATE INDEX [IX_MfgAlert_Open] ON [dbo].[MfgProductionAlert] ([PlantId], [Status], [Severity], [LastRaisedAt]);
CREATE INDEX [IX_MfgAlert_Order] ON [dbo].[MfgProductionAlert] ([ProductionOrderId], [Status]);
GO

-- MfgDispatchingRule · mfg · قاعدهٔ اعزام عملیات
IF OBJECT_ID('dbo.MfgDispatchingRule', 'U') IS NULL
CREATE TABLE [dbo].[MfgDispatchingRule] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ScopeType] NVARCHAR(12) NOT NULL,
  [RuleScopeKey] NVARCHAR(100) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NULL,
  [RuleCode] NVARCHAR(12) NOT NULL,
  [PriorityOrder] INT NOT NULL DEFAULT 1,
  [PriorityWeight] DECIMAL(12,4) NOT NULL DEFAULT 1,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [ParametersJson] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgDispatchingRule] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgDispatchingRule_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgDispatchRule_Scope] CHECK (ScopeType IN ('plant','work-center')),
  CONSTRAINT [CK_MfgDispatchRule_Rule] CHECK (RuleCode IN ('EDD','SPT','CR','WSPT','FIFO','MANUAL')),
  CONSTRAINT [CK_MfgDispatchRule_Order] CHECK (PriorityOrder > 0 AND PriorityWeight > 0),
  CONSTRAINT [CK_MfgDispatchRule_ScopeLink] CHECK ((ScopeType = 'plant' AND WorkCenterId IS NULL) OR (ScopeType = 'work-center' AND WorkCenterId IS NOT NULL)),
  CONSTRAINT [CK_MfgDispatchRule_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX [UX_MfgDispatchRule_Scope] ON [dbo].[MfgDispatchingRule] ([PlantId], [RuleScopeKey], [PriorityOrder], [EffectiveFrom]);
CREATE INDEX [IX_MfgDispatchRule_Active] ON [dbo].[MfgDispatchingRule] ([PlantId], [IsActive], [ScopeType], [RuleCode]);
GO

-- MfgScheduleRun · mfg · اجرای زمان‌بندی
IF OBJECT_ID('dbo.MfgScheduleRun', 'U') IS NULL
CREATE TABLE [dbo].[MfgScheduleRun] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ScheduleVersion] INT NOT NULL,
  [Direction] NVARCHAR(12) NOT NULL,
  [CapacityMode] NVARCHAR(16) NOT NULL,
  [DispatchRule] NVARCHAR(12) NOT NULL,
  [WindowStart] DATETIME2 NOT NULL,
  [WindowEnd] DATETIME2 NOT NULL,
  [ExpectedScheduleVersion] INT NULL,
  [ScheduledOperationCount] INT NOT NULL DEFAULT 0,
  [UnscheduledOperationCount] INT NOT NULL DEFAULT 0,
  [CalculatedAt] DATETIME2 NOT NULL,
  [ModelVersion] NVARCHAR(40) NOT NULL DEFAULT 'mfg-scheduler-v1',
  [SummaryJson] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgScheduleRun] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_MfgScheduleRun_Version] CHECK (ScheduleVersion > 0 AND (ExpectedScheduleVersion IS NULL OR ExpectedScheduleVersion >= 0)),
  CONSTRAINT [CK_MfgScheduleRun_Window] CHECK (WindowEnd > WindowStart),
  CONSTRAINT [CK_MfgScheduleRun_Mode] CHECK (CapacityMode IN ('finite','semi-finite')),
  CONSTRAINT [CK_MfgScheduleRun_Direction] CHECK (Direction IN ('forward','backward')),
  CONSTRAINT [CK_MfgScheduleRun_Rule] CHECK (DispatchRule IN ('EDD','SPT','CR','WSPT','FIFO','MANUAL')),
  CONSTRAINT [CK_MfgScheduleRun_Counts] CHECK (ScheduledOperationCount >= 0 AND UnscheduledOperationCount >= 0)
);
CREATE UNIQUE INDEX [UX_MfgScheduleRun_Version] ON [dbo].[MfgScheduleRun] ([PlantId], [ScheduleVersion]);
CREATE INDEX [IX_MfgScheduleRun_Created] ON [dbo].[MfgScheduleRun] ([PlantId], [CreatedAt]);
GO

-- MfgLotSizingPolicy · mfg · سیاست اندازه‌گذاری لات
IF OBJECT_ID('dbo.MfgLotSizingPolicy', 'U') IS NULL
CREATE TABLE [dbo].[MfgLotSizingPolicy] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [PolicyCode] NVARCHAR(60) NOT NULL,
  [RuleCode] NVARCHAR(8) NOT NULL,
  [FixedLotQty] DECIMAL(18,4) NULL,
  [OrderMultiple] DECIMAL(18,4) NULL,
  [MinOrderQty] DECIMAL(18,4) NULL,
  [MaxOrderQty] DECIMAL(18,4) NULL,
  [OrderingCost] DECIMAL(18,2) NULL,
  [HoldingCostPerUnitPerYear] DECIMAL(18,2) NULL,
  [AnnualDemandQty] DECIMAL(18,4) NULL,
  [PeriodDays] INT NULL,
  [PeriodOrderQuantity] INT NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgLotSizingPolicy] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgLotSizingPolicy_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgLotPolicy_Rule] CHECK (RuleCode IN ('L4L','FOQ','EOQ','POQ')),
  CONSTRAINT [CK_MfgLotPolicy_Qty] CHECK (FixedLotQty IS NULL OR FixedLotQty > 0),
  CONSTRAINT [CK_MfgLotPolicy_Multiple] CHECK (OrderMultiple IS NULL OR OrderMultiple >= 1),
  CONSTRAINT [CK_MfgLotPolicy_MinMax] CHECK ((MinOrderQty IS NULL OR MinOrderQty >= 0) AND (MaxOrderQty IS NULL OR MaxOrderQty > 0) AND (MinOrderQty IS NULL OR MaxOrderQty IS NULL OR MinOrderQty <= MaxOrderQty)),
  CONSTRAINT [CK_MfgLotPolicy_Eoq] CHECK ((OrderingCost IS NULL OR OrderingCost >= 0) AND (HoldingCostPerUnitPerYear IS NULL OR HoldingCostPerUnitPerYear >= 0) AND (AnnualDemandQty IS NULL OR AnnualDemandQty >= 0)),
  CONSTRAINT [CK_MfgLotPolicy_Period] CHECK ((PeriodDays IS NULL OR PeriodDays > 0) AND (PeriodOrderQuantity IS NULL OR PeriodOrderQuantity > 0)),
  CONSTRAINT [CK_MfgLotPolicy_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX [UX_MfgLotPolicy_Part] ON [dbo].[MfgLotSizingPolicy] ([PlantId], [PartId], [EffectiveFrom]);
CREATE INDEX [IX_MfgLotPolicy_Rule] ON [dbo].[MfgLotSizingPolicy] ([PlantId], [RuleCode], [IsActive]);
GO

-- MfgMasterScheduleRun · mfg · اجرای برنامهٔ اصلی تولید
IF OBJECT_ID('dbo.MfgMasterScheduleRun', 'U') IS NULL
CREATE TABLE [dbo].[MfgMasterScheduleRun] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [RunNo] INT NOT NULL,
  [TimeBucket] NVARCHAR(8) NOT NULL,
  [BucketCount] INT NOT NULL,
  [HorizonStart] DATE NOT NULL,
  [HorizonEnd] DATE NOT NULL,
  [PartId] NVARCHAR(60) NULL,
  [DemandTimeFenceBuckets] INT NOT NULL DEFAULT 0,
  [FirmPlannedTimeFenceBuckets] INT NOT NULL DEFAULT 0,
  [ConsumeForecast] BIT NOT NULL DEFAULT 1,
  [PreviewOnly] BIT NOT NULL DEFAULT 0,
  [CalculatedAt] DATETIME2 NOT NULL,
  [CalculatedBy] NVARCHAR(60) NOT NULL,
  [ModelVersion] NVARCHAR(40) NOT NULL DEFAULT 'mfg-planning-v1',
  [PartCount] INT NOT NULL DEFAULT 0,
  [LineCount] INT NOT NULL DEFAULT 0,
  [TotalPlannedOrderQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [SummaryJson] NVARCHAR(MAX) NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'draft',
  [ApprovedBy] NVARCHAR(60) NULL,
  [ApprovedAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgMasterScheduleRun] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_MfgMpsRun_RunNo] CHECK (RunNo > 0),
  CONSTRAINT [CK_MfgMpsRun_Bucket] CHECK (TimeBucket IN ('day','week','month') AND BucketCount > 0),
  CONSTRAINT [CK_MfgMpsRun_Horizon] CHECK (HorizonEnd > HorizonStart),
  CONSTRAINT [CK_MfgMpsRun_Fence] CHECK (DemandTimeFenceBuckets >= 0 AND FirmPlannedTimeFenceBuckets >= DemandTimeFenceBuckets),
  CONSTRAINT [CK_MfgMpsRun_Counts] CHECK (PartCount >= 0 AND LineCount >= 0 AND TotalPlannedOrderQty >= 0),
  CONSTRAINT [CK_MfgMpsRun_Status] CHECK (Status IN ('draft','approved')),
  CONSTRAINT [CK_MfgMpsRun_Approval] CHECK (ApprovedAt IS NULL OR ApprovedBy IS NOT NULL)
);
CREATE UNIQUE INDEX [UX_MfgMpsRun_No] ON [dbo].[MfgMasterScheduleRun] ([PlantId], [RunNo]);
CREATE INDEX [IX_MfgMpsRun_Created] ON [dbo].[MfgMasterScheduleRun] ([PlantId], [CalculatedAt]);
GO

-- MfgDemandForecast · mfg · تقاضا و پیش‌بینی فروش
IF OBJECT_ID('dbo.MfgDemandForecast', 'U') IS NULL
CREATE TABLE [dbo].[MfgDemandForecast] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [DemandType] NVARCHAR(16) NOT NULL,
  [DemandRef] NVARCHAR(60) NOT NULL,
  [CustomerRef] NVARCHAR(80) NULL,
  [CustomerNameSnapshot] NVARCHAR(240) NULL,
  [RequiredAt] DATE NOT NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [ConfidencePct] DECIMAL(7,3) NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [ConsumedQuantity] DECIMAL(18,4) NULL,
  [MpsRunId] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgDemandForecast] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgDemandForecast_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgDemandForecast_MpsRunId] FOREIGN KEY ([MpsRunId]) REFERENCES [dbo].[MfgMasterScheduleRun] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgDemand_Type] CHECK (DemandType IN ('sales-order','forecast','contract','manual')),
  CONSTRAINT [CK_MfgDemand_Qty] CHECK (Quantity > 0),
  CONSTRAINT [CK_MfgDemand_Status] CHECK (Status IN ('draft','confirmed','cancelled')),
  CONSTRAINT [CK_MfgDemand_Confidence] CHECK (ConfidencePct IS NULL OR (ConfidencePct >= 0 AND ConfidencePct <= 100)),
  CONSTRAINT [CK_MfgDemand_Consumed] CHECK (ConsumedQuantity IS NULL OR (ConsumedQuantity >= 0 AND ConsumedQuantity <= Quantity))
);
CREATE UNIQUE INDEX [UX_MfgDemand_Ref] ON [dbo].[MfgDemandForecast] ([PlantId], [DemandType], [DemandRef], [RequiredAt]);
CREATE INDEX [IX_MfgDemand_PartDate] ON [dbo].[MfgDemandForecast] ([PlantId], [PartId], [RequiredAt], [Status]);
GO

-- MfgMasterScheduleLine · mfg · ردیف برنامهٔ اصلی تولید
IF OBJECT_ID('dbo.MfgMasterScheduleLine', 'U') IS NULL
CREATE TABLE [dbo].[MfgMasterScheduleLine] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [MpsRunId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [BucketIndex] INT NOT NULL,
  [BucketStart] DATE NOT NULL,
  [BucketEnd] DATE NOT NULL,
  [ForecastQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [SalesOrderQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [ContractQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [ManualQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [ConsumedForecastQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [GrossRequirementQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [ScheduledReceiptQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [ProjectedOnHandBefore] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [NetRequirementQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [PlannedOrderReceiptQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [PlannedOrderReleaseQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [PlannedOrderReleaseAt] DATE NULL,
  [ProjectedOnHandAfter] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [LotSizingRule] NVARCHAR(8) NOT NULL,
  [LotSizingPolicyId] NVARCHAR(60) NULL,
  [InsideDemandTimeFence] BIT NOT NULL DEFAULT 0,
  [IsFirm] BIT NOT NULL DEFAULT 0,
  [AppliedConstraints] NVARCHAR(300) NULL,
  [DemandRefsJson] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgMasterScheduleLine] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgMasterScheduleLine_MpsRunId] FOREIGN KEY ([MpsRunId]) REFERENCES [dbo].[MfgMasterScheduleRun] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMasterScheduleLine_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMasterScheduleLine_LotSizingPolicyId] FOREIGN KEY ([LotSizingPolicyId]) REFERENCES [dbo].[MfgLotSizingPolicy] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgMpsLine_Bucket] CHECK (BucketIndex >= 0 AND BucketEnd > BucketStart),
  CONSTRAINT [CK_MfgMpsLine_Rule] CHECK (LotSizingRule IN ('L4L','FOQ','EOQ','POQ')),
  CONSTRAINT [CK_MfgMpsLine_Qty] CHECK (ForecastQty >= 0 AND SalesOrderQty >= 0 AND ContractQty >= 0 AND ManualQty >= 0 AND ConsumedForecastQty >= 0 AND GrossRequirementQty >= 0 AND ScheduledReceiptQty >= 0 AND NetRequirementQty >= 0 AND PlannedOrderReceiptQty >= 0 AND PlannedOrderReleaseQty >= 0)
);
CREATE UNIQUE INDEX [UX_MfgMpsLine_Bucket] ON [dbo].[MfgMasterScheduleLine] ([MpsRunId], [PartId], [BucketIndex]);
CREATE INDEX [IX_MfgMpsLine_PartDate] ON [dbo].[MfgMasterScheduleLine] ([PlantId], [PartId], [BucketStart]);
GO

-- MfgAtpCheck · mfg · بررسی قابلیت تعهد تحویل
IF OBJECT_ID('dbo.MfgAtpCheck', 'U') IS NULL
CREATE TABLE [dbo].[MfgAtpCheck] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [RequestedQty] DECIMAL(18,4) NOT NULL,
  [RequestedAt] DATE NOT NULL,
  [Mode] NVARCHAR(12) NOT NULL,
  [Result] NVARCHAR(12) NOT NULL,
  [PromisedQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [ShortageQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [PromisedAt] DATE NULL,
  [DelayBuckets] INT NOT NULL DEFAULT 0,
  [SourceBucketStart] DATE NULL,
  [OpeningAvailableQty] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [IncludeSafetyStock] BIT NOT NULL DEFAULT 1,
  [LeadTimeDays] INT NOT NULL DEFAULT 0,
  [BucketCount] INT NOT NULL,
  [CheckedAt] DATETIME2 NOT NULL,
  [CheckedBy] NVARCHAR(60) NOT NULL,
  [ModelVersion] NVARCHAR(40) NOT NULL DEFAULT 'mfg-planning-v1',
  [CustomerRef] NVARCHAR(80) NULL,
  [MessageFa] NVARCHAR(400) NULL,
  [DetailJson] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgAtpCheck] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgAtpCheck_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgAtpCheck_Qty] CHECK (RequestedQty > 0 AND PromisedQty >= 0 AND ShortageQty >= 0 AND OpeningAvailableQty >= 0),
  CONSTRAINT [CK_MfgAtpCheck_Mode] CHECK (Mode IN ('discrete','cumulative')),
  CONSTRAINT [CK_MfgAtpCheck_Result] CHECK (Result IN ('available','delayed','unavailable')),
  CONSTRAINT [CK_MfgAtpCheck_Promise] CHECK (Result <> 'available' OR PromisedAt IS NOT NULL),
  CONSTRAINT [CK_MfgAtpCheck_Delay] CHECK (DelayBuckets >= 0 AND BucketCount >= 0 AND LeadTimeDays >= 0)
);
CREATE INDEX [IX_MfgAtpCheck_Part] ON [dbo].[MfgAtpCheck] ([PlantId], [PartId], [CheckedAt]);
CREATE INDEX [IX_MfgAtpCheck_Result] ON [dbo].[MfgAtpCheck] ([PlantId], [Result], [RequestedAt]);
GO

-- MfgOperationSplitLot · mfg · لات تقسیم‌شدهٔ عملیات
IF OBJECT_ID('dbo.MfgOperationSplitLot', 'U') IS NULL
CREATE TABLE [dbo].[MfgOperationSplitLot] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [SplitNo] INT NOT NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [CumulativeQuantity] DECIMAL(18,4) NOT NULL,
  [IsTransferBatch] BIT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'planned',
  [StartedAt] DATETIME2 NULL,
  [CompletedAt] DATETIME2 NULL,
  [NoteFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgOperationSplitLot] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgOperationSplitLot_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgSplitLot_No] CHECK (SplitNo > 0),
  CONSTRAINT [CK_MfgSplitLot_Qty] CHECK (Quantity > 0 AND CumulativeQuantity >= Quantity),
  CONSTRAINT [CK_MfgSplitLot_Status] CHECK (Status IN ('planned','in-progress','completed','cancelled')),
  CONSTRAINT [CK_MfgSplitLot_Times] CHECK (CompletedAt IS NULL OR (StartedAt IS NOT NULL AND CompletedAt >= StartedAt))
);
CREATE UNIQUE INDEX [UX_MfgSplitLot_No] ON [dbo].[MfgOperationSplitLot] ([ProductionOrderOperationId], [SplitNo]);
CREATE INDEX [IX_MfgSplitLot_Status] ON [dbo].[MfgOperationSplitLot] ([PlantId], [Status], [SplitNo]);
GO

-- MfgProductionVersion · mfg · نسخهٔ تولید
IF OBJECT_ID('dbo.MfgProductionVersion', 'U') IS NULL
CREATE TABLE [dbo].[MfgProductionVersion] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [VersionCode] NVARCHAR(60) NOT NULL,
  [BomRevision] NVARCHAR(32) NOT NULL,
  [RoutingRevision] NVARCHAR(32) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NULL,
  [Priority] INT NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [IsDefault] BIT NOT NULL DEFAULT 0,
  [EffectiveFrom] DATE NULL,
  [EffectiveTo] DATE NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgProductionVersion] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgProductionVersion_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionVersion_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgProdVersion_Priority] CHECK (Priority IS NULL OR Priority >= 0),
  CONSTRAINT [CK_MfgProdVersion_Dates] CHECK (EffectiveTo IS NULL OR EffectiveFrom IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX [UX_MfgProdVersion_Code] ON [dbo].[MfgProductionVersion] ([PlantId], [PartId], [VersionCode]);
CREATE INDEX [IX_MfgProdVersion_Part] ON [dbo].[MfgProductionVersion] ([PlantId], [PartId], [IsActive], [IsDefault]);
GO

-- MfgPlannedOrder · mfg · سفارش برنامه‌ریزی‌شده
IF OBJECT_ID('dbo.MfgPlannedOrder', 'U') IS NULL
CREATE TABLE [dbo].[MfgPlannedOrder] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PlannedOrderNo] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [ProductionVersionId] NVARCHAR(60) NULL,
  [Source] NVARCHAR(8) NOT NULL,
  [MrpRunNo] INT NULL,
  [MpsRunId] NVARCHAR(60) NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [OriginalQuantity] DECIMAL(18,4) NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [LowLevelCode] INT NOT NULL DEFAULT 0,
  [CumulativeLeadTimeDays] INT NOT NULL DEFAULT 0,
  [PlannedReleaseAt] DATETIME2 NOT NULL,
  [PlannedDueAt] DATETIME2 NOT NULL,
  [BucketIndex] INT NULL,
  [LotSizingRule] NVARCHAR(8) NOT NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'proposed',
  [ReviewedBy] NVARCHAR(60) NULL,
  [ReviewedAt] DATETIME2 NULL,
  [ConvertedProductionOrderId] NVARCHAR(60) NULL,
  [ConvertedAt] DATETIME2 NULL,
  [RejectReasonFa] NVARCHAR(400) NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgPlannedOrder] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgPlannedOrder_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgPlannedOrder_ProductionVersionId] FOREIGN KEY ([ProductionVersionId]) REFERENCES [dbo].[MfgProductionVersion] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgPlannedOrder_ConvertedProductionOrderId] FOREIGN KEY ([ConvertedProductionOrderId]) REFERENCES [dbo].[MfgProductionOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgPlannedOrder_Source] CHECK (Source IN ('mrp','mps')),
  CONSTRAINT [CK_MfgPlannedOrder_Rule] CHECK (LotSizingRule IN ('L4L','FOQ','EOQ','POQ')),
  CONSTRAINT [CK_MfgPlannedOrder_Status] CHECK (Status IN ('proposed','approved','converted','rejected','cancelled')),
  CONSTRAINT [CK_MfgPlannedOrder_Qty] CHECK (Quantity > 0 AND (OriginalQuantity IS NULL OR OriginalQuantity > 0)),
  CONSTRAINT [CK_MfgPlannedOrder_Dates] CHECK (PlannedReleaseAt <= PlannedDueAt),
  CONSTRAINT [CK_MfgPlannedOrder_Level] CHECK (LowLevelCode >= 0 AND CumulativeLeadTimeDays >= 0)
);
CREATE UNIQUE INDEX [UX_MfgPlannedOrder_No] ON [dbo].[MfgPlannedOrder] ([PlantId], [PlannedOrderNo]);
CREATE INDEX [IX_MfgPlannedOrder_Part] ON [dbo].[MfgPlannedOrder] ([PlantId], [PartId], [Status], [PlannedDueAt]);
CREATE INDEX [IX_MfgPlannedOrder_Release] ON [dbo].[MfgPlannedOrder] ([PlantId], [Status], [PlannedReleaseAt]);
GO

-- MfgRequirementPegging · mfg · ردیابی نیاز (Pegging)
IF OBJECT_ID('dbo.MfgRequirementPegging', 'U') IS NULL
CREATE TABLE [dbo].[MfgRequirementPegging] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ComponentPartId] NVARCHAR(60) NOT NULL,
  [ComponentSupplyRef] NVARCHAR(60) NULL,
  [ParentPartId] NVARCHAR(60) NOT NULL,
  [ParentSupplyRef] NVARCHAR(60) NULL,
  [MaterialRequirementId] NVARCHAR(60) NULL,
  [ProductionOrderId] NVARCHAR(60) NULL,
  [PlannedOrderId] NVARCHAR(60) NULL,
  [PeggedQuantity] DECIMAL(18,4) NOT NULL,
  [QuantityPer] DECIMAL(18,4) NOT NULL DEFAULT 1,
  [LevelFromRoot] INT NOT NULL DEFAULT 0,
  [IsMultiLevel] BIT NOT NULL DEFAULT 0,
  [RootPartId] NVARCHAR(60) NULL,
  [RootSupplyRef] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgRequirementPegging] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgRequirementPegging_ComponentPartId] FOREIGN KEY ([ComponentPartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgRequirementPegging_ParentPartId] FOREIGN KEY ([ParentPartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgRequirementPegging_ProductionOrderId] FOREIGN KEY ([ProductionOrderId]) REFERENCES [dbo].[MfgProductionOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgRequirementPegging_PlannedOrderId] FOREIGN KEY ([PlannedOrderId]) REFERENCES [dbo].[MfgPlannedOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgPegging_Qty] CHECK (PeggedQuantity >= 0 AND QuantityPer > 0),
  CONSTRAINT [CK_MfgPegging_Level] CHECK (LevelFromRoot >= 0)
);
CREATE INDEX [IX_MfgPegging_Component] ON [dbo].[MfgRequirementPegging] ([PlantId], [ComponentPartId], [ParentPartId]);
CREATE INDEX [IX_MfgPegging_Root] ON [dbo].[MfgRequirementPegging] ([PlantId], [RootPartId], [RootSupplyRef]);
CREATE INDEX [IX_MfgPegging_Order] ON [dbo].[MfgRequirementPegging] ([PlantId], [ProductionOrderId]);
GO

-- MfgPlant · mfg · کارخانه و نوع صنعت
IF OBJECT_ID('dbo.MfgPlant', 'U') IS NULL
CREATE TABLE [dbo].[MfgPlant] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PlantCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [IndustryType] NVARCHAR(24) NOT NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgPlant] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_MfgPlant_Industry] CHECK (IndustryType IN ('discrete','process','food','pharma','automotive','metal','drilling_energy'))
);
CREATE UNIQUE INDEX [UX_MfgPlant_PlantId] ON [dbo].[MfgPlant] ([PlantId]);
CREATE UNIQUE INDEX [UX_MfgPlant_PlantCode] ON [dbo].[MfgPlant] ([PlantId], [PlantCode]);
CREATE INDEX [IX_MfgPlant_Industry] ON [dbo].[MfgPlant] ([IndustryType], [IsActive]);
GO

-- CmmsSite · cmms · سایت و مجتمع بهره‌برداری
IF OBJECT_ID('dbo.CmmsSite', 'U') IS NULL
CREATE TABLE [dbo].[CmmsSite] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [SiteCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [SiteType] NVARCHAR(24) NOT NULL,
  [PolicyStatementFa] NVARCHAR(2000) NULL,
  [TimeZoneId] NVARCHAR(80) NULL DEFAULT 'Asia/Tehran',
  [Currency] NVARCHAR(8) NULL DEFAULT 'IRR',
  [BaseYear] INT NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsSite] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_CmmsSite_Type] CHECK (SiteType IN ('plant','refinery','power','drilling','utility','workshop','office')),
  CONSTRAINT [CK_CmmsSite_Year] CHECK (BaseYear IS NULL OR (BaseYear >= 1900 AND BaseYear <= 2200))
);
CREATE UNIQUE INDEX [UX_CmmsSite_SiteId] ON [dbo].[CmmsSite] ([SiteId]);
CREATE UNIQUE INDEX [UX_CmmsSite_Code] ON [dbo].[CmmsSite] ([SiteId], [SiteCode]);
CREATE INDEX [IX_CmmsSite_Type] ON [dbo].[CmmsSite] ([SiteType], [IsActive]);
GO

-- CmmsLocation · cmms · مکان و ساختار درختی استقرار
IF OBJECT_ID('dbo.CmmsLocation', 'U') IS NULL
CREATE TABLE [dbo].[CmmsLocation] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [LocationCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [Level] INT NOT NULL,
  [ParentLocationId] NVARCHAR(60) NULL,
  [PathCode] NVARCHAR(400) NULL,
  [Latitude] DECIMAL(12,8) NULL,
  [Longitude] DECIMAL(12,8) NULL,
  [GeoAccuracyMeters] INT NULL,
  [ZoneClassification] NVARCHAR(40) NULL,
  [IsHazardousArea] BIT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsLocation] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsLocation_ParentLocationId] FOREIGN KEY ([ParentLocationId]) REFERENCES [dbo].[CmmsLocation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsLocation_Level] CHECK (Level BETWEEN 1 AND 9),
  CONSTRAINT [CK_CmmsLocation_Self] CHECK (ParentLocationId IS NULL OR ParentLocationId <> Id),
  CONSTRAINT [CK_CmmsLocation_Lat] CHECK (Latitude IS NULL OR (Latitude >= -90 AND Latitude <= 90)),
  CONSTRAINT [CK_CmmsLocation_Lon] CHECK (Longitude IS NULL OR (Longitude >= -180 AND Longitude <= 180))
);
CREATE UNIQUE INDEX [UX_CmmsLocation_Code] ON [dbo].[CmmsLocation] ([SiteId], [LocationCode]);
CREATE INDEX [IX_CmmsLocation_Parent] ON [dbo].[CmmsLocation] ([SiteId], [ParentLocationId]);
CREATE INDEX [IX_CmmsLocation_Level] ON [dbo].[CmmsLocation] ([SiteId], [Level], [IsActive]);
GO

-- CmmsFamilyGroup · cmms · گروه خانوادهٔ تجهیزات
IF OBJECT_ID('dbo.CmmsFamilyGroup', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamilyGroup] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [GroupCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [EquipmentClass] NVARCHAR(40) NOT NULL,
  [Discipline] NVARCHAR(40) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamilyGroup] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_CmmsFamilyGroup_Discipline] CHECK (Discipline IS NULL OR Discipline IN ('mechanical','electrical','instrument','civil','rotating','static'))
);
CREATE UNIQUE INDEX [UX_CmmsFamilyGroup_Code] ON [dbo].[CmmsFamilyGroup] ([SiteId], [GroupCode]);
CREATE INDEX [IX_CmmsFamilyGroup_Class] ON [dbo].[CmmsFamilyGroup] ([SiteId], [EquipmentClass], [IsActive]);
GO

-- CmmsFamily · cmms · الگوی خانوادهٔ تجهیز
IF OBJECT_ID('dbo.CmmsFamily', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamily] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyGroupId] NVARCHAR(60) NOT NULL,
  [FamilyCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [Manufacturer] NVARCHAR(240) NULL,
  [ModelSeries] NVARCHAR(160) NULL,
  [CriticalityRank] NVARCHAR(16) NOT NULL DEFAULT 'C',
  [DefaultStrategy] NVARCHAR(28) NOT NULL DEFAULT 'pm',
  [Version] INT NOT NULL DEFAULT 1,
  [IsTemplate] BIT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [ApprovedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamily] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFamily_FamilyGroupId] FOREIGN KEY ([FamilyGroupId]) REFERENCES [dbo].[CmmsFamilyGroup] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsFamily_Criticality] CHECK (CriticalityRank IN ('A','B','C','D')),
  CONSTRAINT [CK_CmmsFamily_Strategy] CHECK (DefaultStrategy IN ('pm','cbm','predictive','risk-based','run-to-failure','zero-breakdown')),
  CONSTRAINT [CK_CmmsFamily_Status] CHECK (Status IN ('draft','approved','obsolete')),
  CONSTRAINT [CK_CmmsFamily_Approve] CHECK (Status <> 'approved' OR ApprovedAt IS NOT NULL),
  CONSTRAINT [CK_CmmsFamily_Version] CHECK (Version >= 1)
);
CREATE UNIQUE INDEX [UX_CmmsFamily_Code] ON [dbo].[CmmsFamily] ([SiteId], [FamilyCode]);
CREATE INDEX [IX_CmmsFamily_Group] ON [dbo].[CmmsFamily] ([SiteId], [FamilyGroupId], [Status]);
CREATE INDEX [IX_CmmsFamily_Criticality] ON [dbo].[CmmsFamily] ([SiteId], [CriticalityRank], [Status]);
GO

-- CmmsFamilyNode · cmms · گره درخت خانوادهٔ تجهیز
IF OBJECT_ID('dbo.CmmsFamilyNode', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamilyNode] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [NodeCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [BoundaryLevel] NVARCHAR(24) NOT NULL,
  [ParentNodeId] NVARCHAR(60) NULL,
  [PathLevel] INT NOT NULL DEFAULT 1,
  [PathCode] NVARCHAR(400) NULL,
  [Iso14224Code] NVARCHAR(120) NULL,
  [IsMaintainable] BIT NOT NULL DEFAULT 1,
  [IsCriticalPart] BIT NOT NULL DEFAULT 0,
  [TechnicalSpecFa] NVARCHAR(1200) NULL,
  [SortOrder] INT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamilyNode] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFamilyNode_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsFamilyNode_ParentNodeId] FOREIGN KEY ([ParentNodeId]) REFERENCES [dbo].[CmmsFamilyNode] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsFamilyNode_Boundary] CHECK (BoundaryLevel IN ('equipment','sub-unit','component','maintenance-item')),
  CONSTRAINT [CK_CmmsFamilyNode_Self] CHECK (ParentNodeId IS NULL OR ParentNodeId <> Id),
  CONSTRAINT [CK_CmmsFamilyNode_Level] CHECK (PathLevel >= 1)
);
CREATE UNIQUE INDEX [UX_CmmsFamilyNode_Code] ON [dbo].[CmmsFamilyNode] ([FamilyId], [NodeCode]);
CREATE INDEX [IX_CmmsFamilyNode_Parent] ON [dbo].[CmmsFamilyNode] ([FamilyId], [ParentNodeId]);
CREATE INDEX [IX_CmmsFamilyNode_Boundary] ON [dbo].[CmmsFamilyNode] ([SiteId], [BoundaryLevel], [IsMaintainable]);
GO

-- CmmsFamilyProfile · cmms · پروفایل جامع خانوادهٔ تجهیز
IF OBJECT_ID('dbo.CmmsFamilyProfile', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamilyProfile] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [ProfileKey] NVARCHAR(80) NOT NULL,
  [CategoryFa] NVARCHAR(160) NOT NULL,
  [ContentFa] NVARCHAR(4000) NULL,
  [ContentEn] NVARCHAR(4000) NULL,
  [ReferenceStandard] NVARCHAR(200) NULL,
  [Uom] NVARCHAR(24) NULL,
  [SortOrder] INT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamilyProfile] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFamilyProfile_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE
);
CREATE UNIQUE INDEX [UX_CmmsFamilyProfile_Key] ON [dbo].[CmmsFamilyProfile] ([FamilyId], [ProfileKey]);
CREATE INDEX [IX_CmmsFamilyProfile_Category] ON [dbo].[CmmsFamilyProfile] ([SiteId], [IsActive], [SortOrder]);
GO

-- CmmsFamilyOperatingParam · cmms · پارامتر کارکردی خانواده
IF OBJECT_ID('dbo.CmmsFamilyOperatingParam', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamilyOperatingParam] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [ParamCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [ParamType] NVARCHAR(28) NOT NULL,
  [Uom] NVARCHAR(24) NOT NULL,
  [NominalRatePerHour] DECIMAL(18,4) NULL,
  [WarnLimit] DECIMAL(18,4) NULL,
  [AlarmLimit] DECIMAL(18,4) NULL,
  [IsPmDriver] BIT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamilyOperatingParam] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFamilyOperatingParam_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsFamilyOperatingParam_Type] CHECK (ParamType IN ('running_hours','odometer','stroke_count','cycle_count','throughput','start_count')),
  CONSTRAINT [CK_CmmsFamilyOperatingParam_Limits] CHECK (AlarmLimit IS NULL OR WarnLimit IS NULL OR AlarmLimit > WarnLimit)
);
CREATE UNIQUE INDEX [UX_CmmsFamilyOperatingParam_Code] ON [dbo].[CmmsFamilyOperatingParam] ([FamilyId], [ParamCode]);
CREATE INDEX [IX_CmmsFamilyOperatingParam_Driver] ON [dbo].[CmmsFamilyOperatingParam] ([SiteId], [IsPmDriver], [IsActive]);
GO

-- CmmsFamilyConditionParam · cmms · پارامتر پایش وضعیت خانواده
IF OBJECT_ID('dbo.CmmsFamilyConditionParam', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamilyConditionParam] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [ParamCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [Technique] NVARCHAR(28) NOT NULL,
  [Uom] NVARCHAR(24) NOT NULL,
  [MeasurementPoint] NVARCHAR(120) NULL,
  [BaselineValue] DECIMAL(18,4) NULL,
  [AlertLimit] DECIMAL(18,4) NULL,
  [AlarmLimit] DECIMAL(18,4) NULL,
  [TripLimit] DECIMAL(18,4) NULL,
  [SamplingIntervalHours] DECIMAL(12,2) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamilyConditionParam] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFamilyConditionParam_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsFamilyConditionParam_Tech] CHECK (Technique IN ('vibration','thermal','oil_analysis','ultrasonic','motor_current','performance','visual')),
  CONSTRAINT [CK_CmmsFamilyConditionParam_Limits] CHECK (AlarmLimit IS NULL OR AlertLimit IS NULL OR AlarmLimit >= AlertLimit),
  CONSTRAINT [CK_CmmsFamilyConditionParam_Trip] CHECK (TripLimit IS NULL OR AlarmLimit IS NULL OR TripLimit >= AlarmLimit)
);
CREATE UNIQUE INDEX [UX_CmmsFamilyConditionParam_Code] ON [dbo].[CmmsFamilyConditionParam] ([FamilyId], [ParamCode]);
CREATE INDEX [IX_CmmsFamilyConditionParam_Tech] ON [dbo].[CmmsFamilyConditionParam] ([SiteId], [Technique], [IsActive]);
GO

-- CmmsFamilyFailureMode · cmms · حالت خرابی استاندارد خانواده
IF OBJECT_ID('dbo.CmmsFamilyFailureMode', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamilyFailureMode] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [FamilyNodeId] NVARCHAR(60) NULL,
  [FailureModeCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [FailureMode] NVARCHAR(40) NOT NULL,
  [FailureMechanism] NVARCHAR(40) NOT NULL,
  [DetectionMethod] NVARCHAR(120) NULL,
  [EffectDescriptionFa] NVARCHAR(1200) NULL,
  [SeverityClass] INT NOT NULL DEFAULT 2,
  [OccurrenceClass] INT NOT NULL DEFAULT 2,
  [DetectionClass] INT NOT NULL DEFAULT 2,
  [CriticalityRank] NVARCHAR(16) NOT NULL DEFAULT 'C',
  [IsHiddenFailure] BIT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamilyFailureMode] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFamilyFailureMode_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsFamilyFailureMode_FamilyNodeId] FOREIGN KEY ([FamilyNodeId]) REFERENCES [dbo].[CmmsFamilyNode] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsFamilyFailureMode_Mode] CHECK (FailureMode IN ('fail-to-start','fail-to-function','fail-to-stop','abnormal-start','abnormal-shutdown','erratic-output','reduced-output','excessive-output','spurious-output','leakage','structural')),
  CONSTRAINT [CK_CmmsFamilyFailureMode_Mechanism] CHECK (FailureMechanism IN ('wear','corrosion','fatigue','overload','fouling','misalignment','imbalance','lubrication','electrical','seal','thermal','vibration','other')),
  CONSTRAINT [CK_CmmsFamilyFailureMode_Severity] CHECK (SeverityClass BETWEEN 1 AND 5),
  CONSTRAINT [CK_CmmsFamilyFailureMode_Occurrence] CHECK (OccurrenceClass BETWEEN 1 AND 5),
  CONSTRAINT [CK_CmmsFamilyFailureMode_Detection] CHECK (DetectionClass BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX [UX_CmmsFamilyFailureMode_Code] ON [dbo].[CmmsFamilyFailureMode] ([FamilyId], [FailureModeCode]);
CREATE INDEX [IX_CmmsFamilyFailureMode_Mode] ON [dbo].[CmmsFamilyFailureMode] ([SiteId], [FailureMode], [IsActive]);
CREATE INDEX [IX_CmmsFamilyFailureMode_Node] ON [dbo].[CmmsFamilyFailureMode] ([FamilyId], [FamilyNodeId]);
GO

-- CmmsFamilyDocument · cmms · آرشیو فنی خانواده
IF OBJECT_ID('dbo.CmmsFamilyDocument', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamilyDocument] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [DocCode] NVARCHAR(60) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [DocType] NVARCHAR(28) NOT NULL,
  [Revision] NVARCHAR(40) NULL,
  [StoragePath] NVARCHAR(600) NULL,
  [FileFormat] NVARCHAR(20) NULL,
  [FileSizeBytes] BIGINT NULL,
  [IssuedBy] NVARCHAR(240) NULL,
  [IssuedOn] DATE NULL,
  [ExpiresOn] DATE NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamilyDocument] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFamilyDocument_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsFamilyDocument_Type] CHECK (DocType IN ('drawing','catalog','manual','datasheet','certificate','sop','procedure','photo','other')),
  CONSTRAINT [CK_CmmsFamilyDocument_Size] CHECK (FileSizeBytes IS NULL OR FileSizeBytes >= 0),
  CONSTRAINT [CK_CmmsFamilyDocument_Dates] CHECK (ExpiresOn IS NULL OR IssuedOn IS NULL OR ExpiresOn >= IssuedOn)
);
CREATE UNIQUE INDEX [UX_CmmsFamilyDocument_Code] ON [dbo].[CmmsFamilyDocument] ([FamilyId], [DocCode], [Revision]) WHERE [Revision] IS NOT NULL;
CREATE INDEX [IX_CmmsFamilyDocument_Type] ON [dbo].[CmmsFamilyDocument] ([SiteId], [DocType], [IsActive]);
GO

-- CmmsFamilyPmTask · cmms · فعالیت نگهداشت خانواده
IF OBJECT_ID('dbo.CmmsFamilyPmTask', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamilyPmTask] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [FamilyNodeId] NVARCHAR(60) NULL,
  [TaskCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(300) NOT NULL,
  [TaskType] NVARCHAR(28) NOT NULL,
  [StrategyType] NVARCHAR(24) NOT NULL DEFAULT 'pm',
  [StandardMinutes] DECIMAL(18,4) NULL,
  [TradeSkill] NVARCHAR(60) NOT NULL,
  [ToolRequired] NVARCHAR(400) NULL,
  [SafetyRequirementFa] NVARCHAR(1000) NULL,
  [IntervalValue] DECIMAL(18,4) NULL,
  [IntervalUnit] NVARCHAR(24) NULL,
  [IsMandatory] BIT NOT NULL DEFAULT 1,
  [SortOrder] INT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [InstructionFa] NVARCHAR(2000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamilyPmTask] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFamilyPmTask_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsFamilyPmTask_FamilyNodeId] FOREIGN KEY ([FamilyNodeId]) REFERENCES [dbo].[CmmsFamilyNode] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsFamilyPmTask_Type] CHECK (TaskType IN ('inspection','lubrication','adjustment','cleaning','replacement','overhaul','test','calibration')),
  CONSTRAINT [CK_CmmsFamilyPmTask_Strategy] CHECK (StrategyType IN ('pm','cbm','predictive','run-to-failure')),
  CONSTRAINT [CK_CmmsFamilyPmTask_Interval] CHECK (IntervalValue IS NULL OR IntervalValue > 0),
  CONSTRAINT [CK_CmmsFamilyPmTask_Unit] CHECK (IntervalUnit IS NULL OR IntervalUnit IN ('hours','days','weeks','months','cycles','km')),
  CONSTRAINT [CK_CmmsFamilyPmTask_Minutes] CHECK (StandardMinutes IS NULL OR StandardMinutes >= 0)
);
CREATE UNIQUE INDEX [UX_CmmsFamilyPmTask_Code] ON [dbo].[CmmsFamilyPmTask] ([FamilyId], [TaskCode]);
CREATE INDEX [IX_CmmsFamilyPmTask_Strategy] ON [dbo].[CmmsFamilyPmTask] ([SiteId], [StrategyType], [IsActive]);
GO

-- CmmsPmChecklistItem · cmms · ردیف چک‌لیست PM
IF OBJECT_ID('dbo.CmmsPmChecklistItem', 'U') IS NULL
CREATE TABLE [dbo].[CmmsPmChecklistItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyPmTaskId] NVARCHAR(60) NOT NULL,
  [ItemCode] NVARCHAR(60) NOT NULL,
  [DescriptionFa] NVARCHAR(600) NOT NULL,
  [InputType] NVARCHAR(24) NOT NULL DEFAULT 'passfail',
  [ExpectedValue] NVARCHAR(200) NULL,
  [MinValue] DECIMAL(18,4) NULL,
  [MaxValue] DECIMAL(18,4) NULL,
  [Uom] NVARCHAR(24) NULL,
  [IsRequired] BIT NOT NULL DEFAULT 1,
  [SortOrder] INT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsPmChecklistItem] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsPmChecklistItem_FamilyPmTaskId] FOREIGN KEY ([FamilyPmTaskId]) REFERENCES [dbo].[CmmsFamilyPmTask] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsPmChecklistItem_Input] CHECK (InputType IN ('passfail','numeric','text','select','measurement')),
  CONSTRAINT [CK_CmmsPmChecklistItem_Range] CHECK (MaxValue IS NULL OR MinValue IS NULL OR MaxValue >= MinValue)
);
CREATE UNIQUE INDEX [UX_CmmsPmChecklistItem_Code] ON [dbo].[CmmsPmChecklistItem] ([FamilyPmTaskId], [ItemCode]);
CREATE INDEX [IX_CmmsPmChecklistItem_Order] ON [dbo].[CmmsPmChecklistItem] ([SiteId], [SortOrder]);
GO

-- CmmsFamilyCustomField · cmms · فیلد سفارشی خانواده
IF OBJECT_ID('dbo.CmmsFamilyCustomField', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamilyCustomField] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [FieldKey] NVARCHAR(60) NOT NULL,
  [LabelFa] NVARCHAR(200) NOT NULL,
  [LabelEn] NVARCHAR(200) NULL,
  [FieldType] NVARCHAR(24) NOT NULL,
  [Unit] NVARCHAR(24) NULL,
  [OptionsJson] NVARCHAR(MAX) NULL,
  [DefaultValue] NVARCHAR(400) NULL,
  [IsRequired] BIT NOT NULL DEFAULT 0,
  [AppliesTo] NVARCHAR(24) NOT NULL DEFAULT 'asset',
  [SortOrder] INT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamilyCustomField] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFamilyCustomField_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsFamilyCustomField_Type] CHECK (FieldType IN ('text','number','date','boolean','select')),
  CONSTRAINT [CK_CmmsFamilyCustomField_Scope] CHECK (AppliesTo IN ('asset','node','both'))
);
CREATE UNIQUE INDEX [UX_CmmsFamilyCustomField_Key] ON [dbo].[CmmsFamilyCustomField] ([FamilyId], [FieldKey]);
CREATE INDEX [IX_CmmsFamilyCustomField_Type] ON [dbo].[CmmsFamilyCustomField] ([SiteId], [FieldType], [IsActive]);
GO

-- CmmsFamilyBulkChange · cmms · تغییر همگانی روی خانواده
IF OBJECT_ID('dbo.CmmsFamilyBulkChange', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFamilyBulkChange] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [ChangeKind] NVARCHAR(28) NOT NULL,
  [TargetField] NVARCHAR(120) NOT NULL,
  [NewValueJson] NVARCHAR(MAX) NOT NULL,
  [AffectedAssetCount] INT NOT NULL DEFAULT 0,
  [ReasonFa] NVARCHAR(1000) NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'pending',
  [RequestedBy] NVARCHAR(60) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [AppliedAt] DATETIME2 NULL,
  [RollbackOfId] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFamilyBulkChange] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFamilyBulkChange_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsFamilyBulkChange_Kind] CHECK (ChangeKind IN ('pm-interval','failure-mode','checklist','custom-field','node','document','strategy')),
  CONSTRAINT [CK_CmmsFamilyBulkChange_Status] CHECK (Status IN ('pending','approved','applied','rolled-back','rejected')),
  CONSTRAINT [CK_CmmsFamilyBulkChange_Count] CHECK (AffectedAssetCount >= 0)
);
CREATE INDEX [IX_CmmsFamilyBulkChange_Family] ON [dbo].[CmmsFamilyBulkChange] ([SiteId], [FamilyId], [Status]);
CREATE INDEX [IX_CmmsFamilyBulkChange_Kind] ON [dbo].[CmmsFamilyBulkChange] ([SiteId], [ChangeKind], [Status]);
GO

-- CmmsVendor · cmms · تأمین‌کننده و پیمانکار نت
IF OBJECT_ID('dbo.CmmsVendor', 'U') IS NULL
CREATE TABLE [dbo].[CmmsVendor] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [VendorCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [VendorType] NVARCHAR(24) NOT NULL,
  [ContactName] NVARCHAR(160) NULL,
  [ContactPhone] NVARCHAR(60) NULL,
  [ContactEmail] NVARCHAR(200) NULL,
  [NationalId] NVARCHAR(40) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [IsApproved] BIT NOT NULL DEFAULT 0,
  [ApprovedOn] DATE NULL,
  [QualificationExpiresOn] DATE NULL,
  [RatingScore] DECIMAL(6,2) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsVendor] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_CmmsVendor_Type] CHECK (VendorType IN ('oem','supplier','contractor','service','calibration-lab')),
  CONSTRAINT [CK_CmmsVendor_Rating] CHECK (RatingScore IS NULL OR (RatingScore >= 0 AND RatingScore <= 100))
);
CREATE UNIQUE INDEX [UX_CmmsVendor_Code] ON [dbo].[CmmsVendor] ([SiteId], [VendorCode]);
CREATE INDEX [IX_CmmsVendor_Type] ON [dbo].[CmmsVendor] ([SiteId], [VendorType], [IsApproved]);
GO

-- CmmsAsset · cmms · تجهیز و دارایی فیزیکی
IF OBJECT_ID('dbo.CmmsAsset', 'U') IS NULL
CREATE TABLE [dbo].[CmmsAsset] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [AssetTag] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [ParentAssetId] NVARCHAR(60) NULL,
  [LocationId] NVARCHAR(60) NULL,
  [SerialNumber] NVARCHAR(120) NULL,
  [Manufacturer] NVARCHAR(240) NULL,
  [Model] NVARCHAR(160) NULL,
  [AssetState] NVARCHAR(28) NOT NULL DEFAULT 'commissioned',
  [CriticalityRank] NVARCHAR(16) NOT NULL DEFAULT 'C',
  [VendorId] NVARCHAR(60) NULL,
  [CommissionedOn] DATE NULL,
  [InstalledOn] DATE NULL,
  [WarrantyExpiresOn] DATE NULL,
  [AcquisitionCost] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NULL DEFAULT 'IRR',
  [ExpectedLifeYears] DECIMAL(8,2) NULL,
  [MfgWorkCenterId] NVARCHAR(60) NULL,
  [ScmWarehouseId] NVARCHAR(60) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsAsset] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsAsset_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_CmmsAsset_ParentAssetId] FOREIGN KEY ([ParentAssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_CmmsAsset_LocationId] FOREIGN KEY ([LocationId]) REFERENCES [dbo].[CmmsLocation] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsAsset_VendorId] FOREIGN KEY ([VendorId]) REFERENCES [dbo].[CmmsVendor] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsAsset_State] CHECK (AssetState IN ('planned','installed','commissioned','operating','standby','under-maintenance','degraded','retired','disposed')),
  CONSTRAINT [CK_CmmsAsset_Criticality] CHECK (CriticalityRank IN ('A','B','C','D')),
  CONSTRAINT [CK_CmmsAsset_Self] CHECK (ParentAssetId IS NULL OR ParentAssetId <> Id),
  CONSTRAINT [CK_CmmsAsset_Cost] CHECK (AcquisitionCost IS NULL OR AcquisitionCost >= 0),
  CONSTRAINT [CK_CmmsAsset_Life] CHECK (ExpectedLifeYears IS NULL OR ExpectedLifeYears > 0)
);
CREATE UNIQUE INDEX [UX_CmmsAsset_Tag] ON [dbo].[CmmsAsset] ([SiteId], [AssetTag]);
CREATE INDEX [IX_CmmsAsset_Family] ON [dbo].[CmmsAsset] ([SiteId], [FamilyId], [AssetState]);
CREATE INDEX [IX_CmmsAsset_Parent] ON [dbo].[CmmsAsset] ([SiteId], [ParentAssetId]);
CREATE INDEX [IX_CmmsAsset_Location] ON [dbo].[CmmsAsset] ([SiteId], [LocationId]);
CREATE INDEX [IX_CmmsAsset_Criticality] ON [dbo].[CmmsAsset] ([SiteId], [CriticalityRank], [IsActive]);
GO

-- CmmsAssetFamilyAssignment · cmms · انتساب تجهیز به خانواده
IF OBJECT_ID('dbo.CmmsAssetFamilyAssignment', 'U') IS NULL
CREATE TABLE [dbo].[CmmsAssetFamilyAssignment] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [IsPrimary] BIT NOT NULL DEFAULT 1,
  [InheritPmTasks] BIT NOT NULL DEFAULT 1,
  [InheritFailureModes] BIT NOT NULL DEFAULT 1,
  [InheritCustomFields] BIT NOT NULL DEFAULT 1,
  [ReasonFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsAssetFamilyAssignment] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsAssetFamilyAssignment_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAssetFamilyAssignment_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsAssetFamilyAssignment_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX [UX_CmmsAssetFamilyAssignment_Pair] ON [dbo].[CmmsAssetFamilyAssignment] ([AssetId], [FamilyId], [EffectiveFrom]);
CREATE INDEX [IX_CmmsAssetFamilyAssignment_Family] ON [dbo].[CmmsAssetFamilyAssignment] ([SiteId], [FamilyId], [IsPrimary]);
GO

-- CmmsAssetDocument · cmms · آرشیو فنی تجهیز
IF OBJECT_ID('dbo.CmmsAssetDocument', 'U') IS NULL
CREATE TABLE [dbo].[CmmsAssetDocument] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [DocCode] NVARCHAR(60) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [DocType] NVARCHAR(28) NOT NULL,
  [Revision] NVARCHAR(40) NULL,
  [StoragePath] NVARCHAR(600) NULL,
  [FileFormat] NVARCHAR(20) NULL,
  [FileSizeBytes] BIGINT NULL,
  [InheritedFromFamilyDocumentId] NVARCHAR(60) NULL,
  [IssuedOn] DATE NULL,
  [ExpiresOn] DATE NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsAssetDocument] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsAssetDocument_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAssetDocument_InheritedFromFamilyDocumentId] FOREIGN KEY ([InheritedFromFamilyDocumentId]) REFERENCES [dbo].[CmmsFamilyDocument] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsAssetDocument_Type] CHECK (DocType IN ('drawing','catalog','manual','datasheet','certificate','sop','procedure','photo','test-report','other')),
  CONSTRAINT [CK_CmmsAssetDocument_Dates] CHECK (ExpiresOn IS NULL OR IssuedOn IS NULL OR ExpiresOn >= IssuedOn)
);
CREATE UNIQUE INDEX [UX_CmmsAssetDocument_Code] ON [dbo].[CmmsAssetDocument] ([AssetId], [DocCode], [Revision]) WHERE [Revision] IS NOT NULL;
CREATE INDEX [IX_CmmsAssetDocument_Type] ON [dbo].[CmmsAssetDocument] ([SiteId], [DocType], [IsActive]);
GO

-- CmmsAssetCustomValue · cmms · مقدار فیلد پویای تجهیز
IF OBJECT_ID('dbo.CmmsAssetCustomValue', 'U') IS NULL
CREATE TABLE [dbo].[CmmsAssetCustomValue] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [FamilyCustomFieldId] NVARCHAR(60) NOT NULL,
  [AssetNodeId] NVARCHAR(60) NULL,
  [ValueText] NVARCHAR(1000) NOT NULL,
  [ValueNumber] DECIMAL(18,6) NULL,
  [ValueDate] DATE NULL,
  [ValueBool] BIT NULL,
  [MeasuredOn] DATETIME2 NULL,
  [Source] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsAssetCustomValue] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsAssetCustomValue_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAssetCustomValue_FamilyCustomFieldId] FOREIGN KEY ([FamilyCustomFieldId]) REFERENCES [dbo].[CmmsFamilyCustomField] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsAssetCustomValue_Source] CHECK (Source IS NULL OR Source IN ('manual','import','sensor','ai-tree-generator'))
);
CREATE UNIQUE INDEX [UX_CmmsAssetCustomValue_Key] ON [dbo].[CmmsAssetCustomValue] ([AssetId], [FamilyCustomFieldId], [AssetNodeId]) WHERE [AssetNodeId] IS NOT NULL;
CREATE INDEX [IX_CmmsAssetCustomValue_Field] ON [dbo].[CmmsAssetCustomValue] ([SiteId], [FamilyCustomFieldId]);
GO

-- CmmsAssetBarcode · cmms · بارکد و QR تجهیز
IF OBJECT_ID('dbo.CmmsAssetBarcode', 'U') IS NULL
CREATE TABLE [dbo].[CmmsAssetBarcode] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [BarcodeValue] NVARCHAR(120) NOT NULL,
  [BarcodeType] NVARCHAR(24) NOT NULL DEFAULT 'qr',
  [PrintedLabel] NVARCHAR(120) NULL,
  [PrintedOn] DATE NULL,
  [PrintedBy] NVARCHAR(60) NULL,
  [IsPrimary] BIT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [LastScannedAt] DATETIME2 NULL,
  [LastScannedBy] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsAssetBarcode] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsAssetBarcode_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsAssetBarcode_Type] CHECK (BarcodeType IN ('qr','code128','ean13','datamatrix','rfid'))
);
CREATE UNIQUE INDEX [UX_CmmsAssetBarcode_Value] ON [dbo].[CmmsAssetBarcode] ([SiteId], [BarcodeValue]);
CREATE INDEX [IX_CmmsAssetBarcode_Asset] ON [dbo].[CmmsAssetBarcode] ([AssetId], [IsActive]);
GO

-- CmmsAssetLifecycleEvent · cmms · رویداد چرخهٔ عمر دارایی
IF OBJECT_ID('dbo.CmmsAssetLifecycleEvent', 'U') IS NULL
CREATE TABLE [dbo].[CmmsAssetLifecycleEvent] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [EventKind] NVARCHAR(28) NOT NULL,
  [OccurredOn] DATE NOT NULL,
  [OccurredAt] DATETIME2 NULL,
  [PreviousState] NVARCHAR(28) NULL,
  [NewState] NVARCHAR(28) NULL,
  [LocationId] NVARCHAR(60) NULL,
  [EventCost] DECIMAL(18,2) NULL,
  [ReferenceDocId] NVARCHAR(60) NULL,
  [DescriptionFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsAssetLifecycleEvent] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsAssetLifecycleEvent_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAssetLifecycleEvent_LocationId] FOREIGN KEY ([LocationId]) REFERENCES [dbo].[CmmsLocation] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsAssetLifecycleEvent_Kind] CHECK (EventKind IN ('acquired','installed','commissioned','transferred','modified','major-overhaul','degraded','retired','disposed'))
);
CREATE INDEX [IX_CmmsAssetLifecycleEvent_Asset] ON [dbo].[CmmsAssetLifecycleEvent] ([AssetId], [OccurredOn]);
CREATE INDEX [IX_CmmsAssetLifecycleEvent_Kind] ON [dbo].[CmmsAssetLifecycleEvent] ([SiteId], [EventKind]);
GO

-- CmmsMeterDefinition · cmms · تعریف کنتور کارکرد
IF OBJECT_ID('dbo.CmmsMeterDefinition', 'U') IS NULL
CREATE TABLE [dbo].[CmmsMeterDefinition] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [FamilyOperatingParamId] NVARCHAR(60) NULL,
  [MeterCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [Uom] NVARCHAR(24) NOT NULL,
  [MeterType] NVARCHAR(24) NOT NULL DEFAULT 'absolute',
  [InitialValue] DECIMAL(18,4) NULL,
  [RollOverAt] DECIMAL(18,4) NULL,
  [ReadingSource] NVARCHAR(40) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsMeterDefinition] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsMeterDefinition_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsMeterDefinition_FamilyOperatingParamId] FOREIGN KEY ([FamilyOperatingParamId]) REFERENCES [dbo].[CmmsFamilyOperatingParam] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsMeterDefinition_Type] CHECK (MeterType IN ('absolute','delta')),
  CONSTRAINT [CK_CmmsMeterDefinition_Rollover] CHECK (RollOverAt IS NULL OR RollOverAt > 0)
);
CREATE UNIQUE INDEX [UX_CmmsMeterDefinition_Code] ON [dbo].[CmmsMeterDefinition] ([AssetId], [MeterCode]);
CREATE INDEX [IX_CmmsMeterDefinition_Asset] ON [dbo].[CmmsMeterDefinition] ([SiteId], [AssetId], [IsActive]);
GO

-- CmmsMeterReading · cmms · قرائت کنتور کارکرد
IF OBJECT_ID('dbo.CmmsMeterReading', 'U') IS NULL
CREATE TABLE [dbo].[CmmsMeterReading] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [MeterDefinitionId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [ReadAt] DATETIME2 NOT NULL,
  [ReadOn] DATE NOT NULL,
  [Value] DECIMAL(18,4) NOT NULL,
  [Delta] DECIMAL(18,4) NULL,
  [ReadBy] NVARCHAR(60) NULL,
  [Source] NVARCHAR(24) NOT NULL DEFAULT 'manual',
  [IsEstimated] BIT NULL DEFAULT 0,
  [WorkOrderId] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsMeterReading] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsMeterReading_MeterDefinitionId] FOREIGN KEY ([MeterDefinitionId]) REFERENCES [dbo].[CmmsMeterDefinition] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsMeterReading_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsMeterReading_Value] CHECK (Value >= 0),
  CONSTRAINT [CK_CmmsMeterReading_Delta] CHECK (Delta IS NULL OR Delta >= 0),
  CONSTRAINT [CK_CmmsMeterReading_Source] CHECK (Source IN ('manual','scada','iiot','erp'))
);
CREATE UNIQUE INDEX [UX_CmmsMeterReading_Reading] ON [dbo].[CmmsMeterReading] ([MeterDefinitionId], [ReadAt]);
CREATE INDEX [IX_CmmsMeterReading_Asset] ON [dbo].[CmmsMeterReading] ([SiteId], [AssetId], [ReadOn]);
GO

-- CmmsTechnician · cmms · تکنسین نگهداری
IF OBJECT_ID('dbo.CmmsTechnician', 'U') IS NULL
CREATE TABLE [dbo].[CmmsTechnician] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [TechnicianCode] NVARCHAR(60) NOT NULL,
  [FullNameFa] NVARCHAR(240) NOT NULL,
  [FullNameEn] NVARCHAR(240) NULL,
  [NationalCode] NVARCHAR(40) NULL,
  [PrimaryTrade] NVARCHAR(60) NOT NULL,
  [Grade] NVARCHAR(24) NOT NULL DEFAULT 'junior',
  [CrewId] NVARCHAR(60) NULL,
  [StandardHourlyRate] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NULL DEFAULT 'IRR',
  [CapacityHoursPerWeek] DECIMAL(8,2) NOT NULL DEFAULT 40,
  [EmploymentType] NVARCHAR(24) NOT NULL DEFAULT 'direct',
  [VendorId] NVARCHAR(60) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [UserId] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsTechnician] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsTechnician_VendorId] FOREIGN KEY ([VendorId]) REFERENCES [dbo].[CmmsVendor] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsTechnician_Grade] CHECK (Grade IN ('apprentice','junior','senior','expert','master')),
  CONSTRAINT [CK_CmmsTechnician_Employment] CHECK (EmploymentType IN ('direct','contractor','oem')),
  CONSTRAINT [CK_CmmsTechnician_Capacity] CHECK (CapacityHoursPerWeek > 0 AND CapacityHoursPerWeek <= 168),
  CONSTRAINT [CK_CmmsTechnician_Rate] CHECK (StandardHourlyRate IS NULL OR StandardHourlyRate >= 0)
);
CREATE UNIQUE INDEX [UX_CmmsTechnician_Code] ON [dbo].[CmmsTechnician] ([SiteId], [TechnicianCode]);
CREATE INDEX [IX_CmmsTechnician_Trade] ON [dbo].[CmmsTechnician] ([SiteId], [PrimaryTrade], [IsActive]);
CREATE INDEX [IX_CmmsTechnician_Crew] ON [dbo].[CmmsTechnician] ([SiteId], [CrewId]);
GO

-- CmmsTechnicianSkill · cmms · مهارت تکنسین
IF OBJECT_ID('dbo.CmmsTechnicianSkill', 'U') IS NULL
CREATE TABLE [dbo].[CmmsTechnicianSkill] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [TechnicianId] NVARCHAR(60) NOT NULL,
  [SkillKey] NVARCHAR(80) NOT NULL,
  [SkillLevel] INT NOT NULL DEFAULT 1,
  [CertifiedBy] NVARCHAR(240) NULL,
  [CertifiedOn] DATE NULL,
  [ExpiresOn] DATE NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsTechnicianSkill] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsTechnicianSkill_TechnicianId] FOREIGN KEY ([TechnicianId]) REFERENCES [dbo].[CmmsTechnician] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsTechnicianSkill_Level] CHECK (SkillLevel BETWEEN 1 AND 5),
  CONSTRAINT [CK_CmmsTechnicianSkill_Dates] CHECK (ExpiresOn IS NULL OR CertifiedOn IS NULL OR ExpiresOn >= CertifiedOn)
);
CREATE UNIQUE INDEX [UX_CmmsTechnicianSkill_Key] ON [dbo].[CmmsTechnicianSkill] ([TechnicianId], [SkillKey]);
CREATE INDEX [IX_CmmsTechnicianSkill_Skill] ON [dbo].[CmmsTechnicianSkill] ([SiteId], [SkillKey], [SkillLevel]);
GO

-- CmmsCrew · cmms · گروه کاری نت
IF OBJECT_ID('dbo.CmmsCrew', 'U') IS NULL
CREATE TABLE [dbo].[CmmsCrew] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [CrewCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [ShiftPattern] NVARCHAR(60) NOT NULL,
  [DailyCapacityHours] DECIMAL(10,2) NOT NULL DEFAULT 8,
  [SupervisorTechnicianId] NVARCHAR(60) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsCrew] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsCrew_SupervisorTechnicianId] FOREIGN KEY ([SupervisorTechnicianId]) REFERENCES [dbo].[CmmsTechnician] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsCrew_Capacity] CHECK (DailyCapacityHours > 0)
);
CREATE UNIQUE INDEX [UX_CmmsCrew_Code] ON [dbo].[CmmsCrew] ([SiteId], [CrewCode]);
CREATE INDEX [IX_CmmsCrew_Active] ON [dbo].[CmmsCrew] ([SiteId], [IsActive]);
GO

-- CmmsShiftCalendar · cmms · تقویم شیفت نت
IF OBJECT_ID('dbo.CmmsShiftCalendar', 'U') IS NULL
CREATE TABLE [dbo].[CmmsShiftCalendar] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [CrewId] NVARCHAR(60) NULL,
  [CalendarDate] DATE NOT NULL,
  [DayType] NVARCHAR(24) NOT NULL DEFAULT 'working',
  [CapacityMinutes] INT NOT NULL DEFAULT 480,
  [WindowStart] NVARCHAR(10) NULL,
  [WindowEnd] NVARCHAR(10) NULL,
  [ReasonFa] NVARCHAR(400) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsShiftCalendar] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsShiftCalendar_CrewId] FOREIGN KEY ([CrewId]) REFERENCES [dbo].[CmmsCrew] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsShiftCalendar_Type] CHECK (DayType IN ('working','non-working','holiday','shutdown-window')),
  CONSTRAINT [CK_CmmsShiftCalendar_Capacity] CHECK (CapacityMinutes >= 0 AND CapacityMinutes <= 1440)
);
CREATE UNIQUE INDEX [UX_CmmsShiftCalendar_Date] ON [dbo].[CmmsShiftCalendar] ([SiteId], [CrewId], [CalendarDate]) WHERE [CrewId] IS NOT NULL;
CREATE INDEX [IX_CmmsShiftCalendar_Type] ON [dbo].[CmmsShiftCalendar] ([SiteId], [CalendarDate], [DayType]);
GO

-- CmmsTool · cmms · ابزار نگهداری
IF OBJECT_ID('dbo.CmmsTool', 'U') IS NULL
CREATE TABLE [dbo].[CmmsTool] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [ToolCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [ToolType] NVARCHAR(28) NOT NULL,
  [Quantity] INT NOT NULL DEFAULT 1,
  [CalibrationDueOn] DATE NULL,
  [IsReservedOnly] BIT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsTool] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_CmmsTool_Type] CHECK (ToolType IN ('hand','power','special','calibrated','lifting','safety')),
  CONSTRAINT [CK_CmmsTool_Qty] CHECK (Quantity > 0)
);
CREATE UNIQUE INDEX [UX_CmmsTool_Code] ON [dbo].[CmmsTool] ([SiteId], [ToolCode]);
CREATE INDEX [IX_CmmsTool_Type] ON [dbo].[CmmsTool] ([SiteId], [ToolType], [IsActive]);
GO

-- CmmsSparePart · cmms · قطعهٔ یدکی MRO
IF OBJECT_ID('dbo.CmmsSparePart', 'U') IS NULL
CREATE TABLE [dbo].[CmmsSparePart] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [PartNumber] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [Category] NVARCHAR(28) NOT NULL,
  [Uom] NVARCHAR(24) NOT NULL,
  [Manufacturer] NVARCHAR(240) NULL,
  [OemPartNumber] NVARCHAR(120) NULL,
  [VendorId] NVARCHAR(60) NULL,
  [ScmWarehouseId] NVARCHAR(60) NULL,
  [UnitCost] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [QtyOnHand] DECIMAL(18,4) NULL,
  [MinStock] DECIMAL(18,4) NULL,
  [MaxStock] DECIMAL(18,4) NULL,
  [ReorderPoint] DECIMAL(18,4) NULL,
  [SafetyStock] DECIMAL(18,4) NULL,
  [LeadTimeDays] DECIMAL(10,2) NULL,
  [IsCriticalSpare] BIT NOT NULL DEFAULT 0,
  [IsConsumable] BIT NOT NULL DEFAULT 0,
  [ShelfLifeMonths] INT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsSparePart] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsSparePart_VendorId] FOREIGN KEY ([VendorId]) REFERENCES [dbo].[CmmsVendor] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsSparePart_Category] CHECK (Category IN ('mechanical','electrical','instrument','consumable','lubricant','seal','bearing','filter')),
  CONSTRAINT [CK_CmmsSparePart_Cost] CHECK (UnitCost IS NULL OR UnitCost >= 0),
  CONSTRAINT [CK_CmmsSparePart_Qty] CHECK (QtyOnHand IS NULL OR QtyOnHand >= 0),
  CONSTRAINT [CK_CmmsSparePart_Levels] CHECK (MinStock IS NULL OR ReorderPoint IS NULL OR ReorderPoint >= MinStock),
  CONSTRAINT [CK_CmmsSparePart_Lead] CHECK (LeadTimeDays IS NULL OR LeadTimeDays >= 0)
);
CREATE UNIQUE INDEX [UX_CmmsSparePart_Number] ON [dbo].[CmmsSparePart] ([SiteId], [PartNumber]);
CREATE INDEX [IX_CmmsSparePart_Category] ON [dbo].[CmmsSparePart] ([SiteId], [Category], [IsActive]);
CREATE INDEX [IX_CmmsSparePart_Critical] ON [dbo].[CmmsSparePart] ([SiteId], [IsCriticalSpare], [IsActive]);
GO

-- CmmsAssetSpareLink · cmms · BOM تعمیراتی تجهیز
IF OBJECT_ID('dbo.CmmsAssetSpareLink', 'U') IS NULL
CREATE TABLE [dbo].[CmmsAssetSpareLink] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NULL,
  [FamilyNodeId] NVARCHAR(60) NULL,
  [SparePartId] NVARCHAR(60) NOT NULL,
  [QuantityPerUnit] DECIMAL(18,4) NOT NULL,
  [Position] NVARCHAR(120) NULL,
  [IsMandatory] BIT NOT NULL DEFAULT 0,
  [ReplacementIntervalHours] DECIMAL(12,2) NULL,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsAssetSpareLink] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsAssetSpareLink_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAssetSpareLink_FamilyNodeId] FOREIGN KEY ([FamilyNodeId]) REFERENCES [dbo].[CmmsFamilyNode] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAssetSpareLink_SparePartId] FOREIGN KEY ([SparePartId]) REFERENCES [dbo].[CmmsSparePart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsAssetSpareLink_Target] CHECK (AssetId IS NOT NULL OR FamilyNodeId IS NOT NULL),
  CONSTRAINT [CK_CmmsAssetSpareLink_Qty] CHECK (QuantityPerUnit > 0)
);
CREATE UNIQUE INDEX [UX_CmmsAssetSpareLink_Pair] ON [dbo].[CmmsAssetSpareLink] ([AssetId], [FamilyNodeId], [SparePartId]) WHERE [AssetId] IS NOT NULL AND [FamilyNodeId] IS NOT NULL;
CREATE INDEX [IX_CmmsAssetSpareLink_Part] ON [dbo].[CmmsAssetSpareLink] ([SiteId], [SparePartId]);
GO

-- CmmsSpareTransaction · cmms · تراکنش قطعات یدکی
IF OBJECT_ID('dbo.CmmsSpareTransaction', 'U') IS NULL
CREATE TABLE [dbo].[CmmsSpareTransaction] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [SparePartId] NVARCHAR(60) NOT NULL,
  [TransactionType] NVARCHAR(24) NOT NULL,
  [OccurredAt] DATETIME2 NOT NULL,
  [OccurredOn] DATE NOT NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [WorkOrderId] NVARCHAR(60) NULL,
  [AssetId] NVARCHAR(60) NULL,
  [TechnicianId] NVARCHAR(60) NULL,
  [TotalCost] DECIMAL(18,2) NULL,
  [ReferenceNo] NVARCHAR(120) NULL,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsSpareTransaction] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsSpareTransaction_SparePartId] FOREIGN KEY ([SparePartId]) REFERENCES [dbo].[CmmsSparePart] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsSpareTransaction_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsSpareTransaction_TechnicianId] FOREIGN KEY ([TechnicianId]) REFERENCES [dbo].[CmmsTechnician] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsSpareTransaction_Type] CHECK (TransactionType IN ('receipt','issue','return','reserve','unreserve','adjust','scrap')),
  CONSTRAINT [CK_CmmsSpareTransaction_Qty] CHECK (Quantity <> 0)
);
CREATE INDEX [IX_CmmsSpareTransaction_Part] ON [dbo].[CmmsSpareTransaction] ([SparePartId], [OccurredOn]);
CREATE INDEX [IX_CmmsSpareTransaction_Wo] ON [dbo].[CmmsSpareTransaction] ([SiteId], [WorkOrderId]);
CREATE INDEX [IX_CmmsSpareTransaction_Type] ON [dbo].[CmmsSpareTransaction] ([SiteId], [TransactionType], [OccurredOn]);
GO

-- CmmsWorkflowDefinition · cmms · تعریف گردش‌کار
IF OBJECT_ID('dbo.CmmsWorkflowDefinition', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkflowDefinition] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkflowCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [AppliesTo] NVARCHAR(28) NOT NULL,
  [StartStepCode] NVARCHAR(60) NOT NULL,
  [Version] INT NOT NULL DEFAULT 1,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkflowDefinition] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_CmmsWorkflowDefinition_Applies] CHECK (AppliesTo IN ('work-request','work-order','rca','pm-schedule','bulk-change')),
  CONSTRAINT [CK_CmmsWorkflowDefinition_Version] CHECK (Version >= 1)
);
CREATE UNIQUE INDEX [UX_CmmsWorkflowDefinition_Code] ON [dbo].[CmmsWorkflowDefinition] ([SiteId], [WorkflowCode], [Version]);
CREATE INDEX [IX_CmmsWorkflowDefinition_Applies] ON [dbo].[CmmsWorkflowDefinition] ([SiteId], [AppliesTo], [IsActive]);
GO

-- CmmsWorkflowStep · cmms · گام گردش‌کار
IF OBJECT_ID('dbo.CmmsWorkflowStep', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkflowStep] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkflowDefinitionId] NVARCHAR(60) NOT NULL,
  [StepCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [StepKind] NVARCHAR(24) NOT NULL,
  [OwnerRole] NVARCHAR(60) NOT NULL,
  [SlaHours] DECIMAL(10,2) NULL,
  [IsTerminal] BIT NOT NULL DEFAULT 0,
  [RequiresEvidence] BIT NOT NULL DEFAULT 0,
  [SortOrder] INT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkflowStep] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkflowStep_WorkflowDefinitionId] FOREIGN KEY ([WorkflowDefinitionId]) REFERENCES [dbo].[CmmsWorkflowDefinition] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsWorkflowStep_Kind] CHECK (StepKind IN ('task','approval','notification','end')),
  CONSTRAINT [CK_CmmsWorkflowStep_Sla] CHECK (SlaHours IS NULL OR SlaHours > 0)
);
CREATE UNIQUE INDEX [UX_CmmsWorkflowStep_Code] ON [dbo].[CmmsWorkflowStep] ([WorkflowDefinitionId], [StepCode]);
CREATE INDEX [IX_CmmsWorkflowStep_Role] ON [dbo].[CmmsWorkflowStep] ([SiteId], [OwnerRole]);
GO

-- CmmsWorkflowTransition · cmms · گذار گردش‌کار
IF OBJECT_ID('dbo.CmmsWorkflowTransition', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkflowTransition] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkflowDefinitionId] NVARCHAR(60) NOT NULL,
  [FromStepCode] NVARCHAR(60) NOT NULL,
  [ToStepCode] NVARCHAR(60) NOT NULL,
  [ActionCode] NVARCHAR(60) NOT NULL,
  [RequiredPermission] NVARCHAR(80) NOT NULL,
  [SortOrder] INT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkflowTransition] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkflowTransition_WorkflowDefinitionId] FOREIGN KEY ([WorkflowDefinitionId]) REFERENCES [dbo].[CmmsWorkflowDefinition] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsWorkflowTransition_Action] CHECK (ActionCode IN ('submit','approve','reject','assign','complete','cancel','reopen')),
  CONSTRAINT [CK_CmmsWorkflowTransition_Self] CHECK (FromStepCode <> ToStepCode OR ActionCode IN ('reopen','assign'))
);
CREATE UNIQUE INDEX [UX_CmmsWorkflowTransition_Path] ON [dbo].[CmmsWorkflowTransition] ([WorkflowDefinitionId], [FromStepCode], [ToStepCode], [ActionCode]);
CREATE INDEX [IX_CmmsWorkflowTransition_From] ON [dbo].[CmmsWorkflowTransition] ([WorkflowDefinitionId], [FromStepCode], [IsActive]);
GO

-- CmmsWorkflowInstance · cmms · نمونهٔ گردش‌کار
IF OBJECT_ID('dbo.CmmsWorkflowInstance', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkflowInstance] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkflowDefinitionId] NVARCHAR(60) NOT NULL,
  [SubjectEntity] NVARCHAR(60) NOT NULL,
  [SubjectId] NVARCHAR(60) NOT NULL,
  [CurrentStepCode] NVARCHAR(60) NOT NULL,
  [State] NVARCHAR(24) NOT NULL DEFAULT 'running',
  [StartedAt] DATETIME2 NULL,
  [CompletedAt] DATETIME2 NULL,
  [CurrentOwnerId] NVARCHAR(60) NULL,
  [DueAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkflowInstance] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkflowInstance_WorkflowDefinitionId] FOREIGN KEY ([WorkflowDefinitionId]) REFERENCES [dbo].[CmmsWorkflowDefinition] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsWorkflowInstance_State] CHECK (State IN ('running','completed','cancelled')),
  CONSTRAINT [CK_CmmsWorkflowInstance_Done] CHECK (State <> 'completed' OR CompletedAt IS NOT NULL)
);
CREATE INDEX [IX_CmmsWorkflowInstance_Subject] ON [dbo].[CmmsWorkflowInstance] ([SiteId], [SubjectEntity], [SubjectId]);
CREATE INDEX [IX_CmmsWorkflowInstance_State] ON [dbo].[CmmsWorkflowInstance] ([SiteId], [State], [CurrentStepCode]);
CREATE INDEX [IX_CmmsWorkflowInstance_Owner] ON [dbo].[CmmsWorkflowInstance] ([SiteId], [CurrentOwnerId], [State]);
GO

-- CmmsWorkflowEvent · cmms · رویداد گردش‌کار
IF OBJECT_ID('dbo.CmmsWorkflowEvent', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkflowEvent] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkflowInstanceId] NVARCHAR(60) NOT NULL,
  [FromStepCode] NVARCHAR(60) NOT NULL,
  [ToStepCode] NVARCHAR(60) NOT NULL,
  [ActionCode] NVARCHAR(60) NOT NULL,
  [OccurredAt] DATETIME2 NOT NULL,
  [ActorId] NVARCHAR(60) NULL,
  [CommentFa] NVARCHAR(1000) NULL,
  [EvidencePath] NVARCHAR(600) NULL,
  [ElapsedHours] DECIMAL(10,3) NULL,
  [SlaHours] DECIMAL(10,2) NULL,
  [IsSlaBreached] BIT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkflowEvent] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkflowEvent_WorkflowInstanceId] FOREIGN KEY ([WorkflowInstanceId]) REFERENCES [dbo].[CmmsWorkflowInstance] ([Id]) ON DELETE CASCADE
);
CREATE INDEX [IX_CmmsWorkflowEvent_Instance] ON [dbo].[CmmsWorkflowEvent] ([WorkflowInstanceId], [OccurredAt]);
CREATE INDEX [IX_CmmsWorkflowEvent_Actor] ON [dbo].[CmmsWorkflowEvent] ([SiteId], [ActorId], [OccurredAt]);
CREATE INDEX [IX_CmmsWorkflowEvent_Sla] ON [dbo].[CmmsWorkflowEvent] ([SiteId], [IsSlaBreached]);
GO

-- CmmsPmStrategy · cmms · استراتژی نگهداشت
IF OBJECT_ID('dbo.CmmsPmStrategy', 'U') IS NULL
CREATE TABLE [dbo].[CmmsPmStrategy] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NULL,
  [AssetId] NVARCHAR(60) NULL,
  [StrategyType] NVARCHAR(28) NOT NULL,
  [SourceAnalysis] NVARCHAR(28) NOT NULL DEFAULT 'manual',
  [RcmAnalysisId] NVARCHAR(60) NULL,
  [ReviewIntervalDays] DECIMAL(10,2) NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [ApprovedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsPmStrategy] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsPmStrategy_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsPmStrategy_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsPmStrategy_Target] CHECK (FamilyId IS NOT NULL OR AssetId IS NOT NULL),
  CONSTRAINT [CK_CmmsPmStrategy_Type] CHECK (StrategyType IN ('pm','cbm','predictive','risk-based','run-to-failure','zero-breakdown')),
  CONSTRAINT [CK_CmmsPmStrategy_Source] CHECK (SourceAnalysis IN ('manual','rcm','fmea','ai-pm-optimization','pmo-study')),
  CONSTRAINT [CK_CmmsPmStrategy_Status] CHECK (Status IN ('draft','approved','obsolete'))
);
CREATE INDEX [IX_CmmsPmStrategy_Family] ON [dbo].[CmmsPmStrategy] ([SiteId], [FamilyId], [Status]);
CREATE INDEX [IX_CmmsPmStrategy_Asset] ON [dbo].[CmmsPmStrategy] ([SiteId], [AssetId], [Status]);
GO

-- CmmsPmSchedule · cmms · برنامهٔ نگهداشت پیشگیرانه
IF OBJECT_ID('dbo.CmmsPmSchedule', 'U') IS NULL
CREATE TABLE [dbo].[CmmsPmSchedule] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [FamilyPmTaskId] NVARCHAR(60) NULL,
  [StrategyId] NVARCHAR(60) NULL,
  [ScheduleCode] NVARCHAR(60) NOT NULL,
  [TriggerType] NVARCHAR(24) NOT NULL,
  [IntervalValue] DECIMAL(18,4) NULL,
  [IntervalUnit] NVARCHAR(24) NULL,
  [MeterDefinitionId] NVARCHAR(60) NULL,
  [LastDoneAt] DATETIME2 NULL,
  [LastMeterValue] DECIMAL(18,4) NULL,
  [NextDueAt] DATETIME2 NULL,
  [NextDueMeterValue] DECIMAL(18,4) NULL,
  [Priority] INT NOT NULL DEFAULT 3,
  [LeadTimeDays] INT NOT NULL DEFAULT 7,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [OptimizedByAi] BIT NULL DEFAULT 0,
  [OptimizationReasonFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsPmSchedule] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsPmSchedule_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsPmSchedule_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsPmSchedule_FamilyPmTaskId] FOREIGN KEY ([FamilyPmTaskId]) REFERENCES [dbo].[CmmsFamilyPmTask] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsPmSchedule_StrategyId] FOREIGN KEY ([StrategyId]) REFERENCES [dbo].[CmmsPmStrategy] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsPmSchedule_MeterDefinitionId] FOREIGN KEY ([MeterDefinitionId]) REFERENCES [dbo].[CmmsMeterDefinition] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsPmSchedule_Trigger] CHECK (TriggerType IN ('time','meter','condition','combined')),
  CONSTRAINT [CK_CmmsPmSchedule_Interval] CHECK (IntervalValue IS NULL OR IntervalValue > 0),
  CONSTRAINT [CK_CmmsPmSchedule_Priority] CHECK (Priority BETWEEN 1 AND 5),
  CONSTRAINT [CK_CmmsPmSchedule_Lead] CHECK (LeadTimeDays >= 0)
);
CREATE UNIQUE INDEX [UX_CmmsPmSchedule_Code] ON [dbo].[CmmsPmSchedule] ([SiteId], [AssetId], [ScheduleCode]);
CREATE INDEX [IX_CmmsPmSchedule_Due] ON [dbo].[CmmsPmSchedule] ([SiteId], [NextDueAt], [IsActive]);
CREATE INDEX [IX_CmmsPmSchedule_Family] ON [dbo].[CmmsPmSchedule] ([SiteId], [FamilyId], [IsActive]);
CREATE INDEX [IX_CmmsPmSchedule_Meter] ON [dbo].[CmmsPmSchedule] ([SiteId], [MeterDefinitionId]);
GO

-- CmmsWorkRequest · cmms · درخواست کار نت
IF OBJECT_ID('dbo.CmmsWorkRequest', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkRequest] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [RequestNo] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [LocationId] NVARCHAR(60) NULL,
  [RequestType] NVARCHAR(28) NOT NULL,
  [Priority] INT NOT NULL DEFAULT 3,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'submitted',
  [ReportedOn] DATE NOT NULL,
  [ReportedAt] DATETIME2 NULL,
  [ReporterId] NVARCHAR(60) NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [DescriptionFa] NVARCHAR(4000) NULL,
  [SymptomFa] NVARCHAR(1000) NULL,
  [FamilyFailureModeId] NVARCHAR(60) NULL,
  [IsAssetStopped] BIT NOT NULL DEFAULT 0,
  [ReviewedById] NVARCHAR(60) NULL,
  [ReviewedAt] DATETIME2 NULL,
  [RejectionReasonFa] NVARCHAR(1000) NULL,
  [ConvertedWorkOrderId] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkRequest] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkRequest_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_CmmsWorkRequest_LocationId] FOREIGN KEY ([LocationId]) REFERENCES [dbo].[CmmsLocation] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsWorkRequest_FamilyFailureModeId] FOREIGN KEY ([FamilyFailureModeId]) REFERENCES [dbo].[CmmsFamilyFailureMode] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsWorkRequest_Type] CHECK (RequestType IN ('breakdown','corrective','preventive','improvement','service','inspection')),
  CONSTRAINT [CK_CmmsWorkRequest_Priority] CHECK (Priority BETWEEN 1 AND 5),
  CONSTRAINT [CK_CmmsWorkRequest_Status] CHECK (Status IN ('submitted','under-review','approved','converted','rejected','cancelled')),
  CONSTRAINT [CK_CmmsWorkRequest_Converted] CHECK (Status <> 'converted' OR ConvertedWorkOrderId IS NOT NULL)
);
CREATE UNIQUE INDEX [UX_CmmsWorkRequest_No] ON [dbo].[CmmsWorkRequest] ([SiteId], [RequestNo]);
CREATE INDEX [IX_CmmsWorkRequest_Asset] ON [dbo].[CmmsWorkRequest] ([SiteId], [AssetId], [Status]);
CREATE INDEX [IX_CmmsWorkRequest_Status] ON [dbo].[CmmsWorkRequest] ([SiteId], [Status], [Priority]);
GO

-- CmmsWorkOrder · cmms · دستورکار نت
IF OBJECT_ID('dbo.CmmsWorkOrder', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkOrder] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkOrderNo] NVARCHAR(60) NOT NULL,
  [WorkOrderType] NVARCHAR(28) NOT NULL,
  [AssetId] NVARCHAR(60) NULL,
  [LocationId] NVARCHAR(60) NULL,
  [WorkRequestId] NVARCHAR(60) NULL,
  [PmScheduleId] NVARCHAR(60) NULL,
  [FamilyPmTaskId] NVARCHAR(60) NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [ScopeFa] NVARCHAR(4000) NULL,
  [Priority] INT NOT NULL DEFAULT 3,
  [Status] NVARCHAR(28) NOT NULL DEFAULT 'draft',
  [PlannedStartAt] DATETIME2 NULL,
  [PlannedFinishAt] DATETIME2 NULL,
  [ScheduledStartAt] DATETIME2 NULL,
  [ReleasedAt] DATETIME2 NULL,
  [StartedAt] DATETIME2 NULL,
  [CompletedAt] DATETIME2 NULL,
  [ClosedAt] DATETIME2 NULL,
  [EstimatedHours] DECIMAL(12,3) NULL,
  [ActualHours] DECIMAL(12,3) NULL,
  [EstimatedCost] DECIMAL(18,2) NULL,
  [ActualCost] DECIMAL(18,2) NULL,
  [CrewId] NVARCHAR(60) NULL,
  [PrimaryTechnicianId] NVARCHAR(60) NULL,
  [VendorId] NVARCHAR(60) NULL,
  [WorkflowInstanceId] NVARCHAR(60) NULL,
  [SafetyPermitNo] NVARCHAR(80) NULL,
  [IsAssetDown] BIT NOT NULL DEFAULT 0,
  [ProductionImpact] NVARCHAR(24) NOT NULL DEFAULT 'none',
  [CompletedById] NVARCHAR(60) NULL,
  [ClosedById] NVARCHAR(60) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkOrder] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkOrder_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsWorkOrder_LocationId] FOREIGN KEY ([LocationId]) REFERENCES [dbo].[CmmsLocation] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsWorkOrder_WorkRequestId] FOREIGN KEY ([WorkRequestId]) REFERENCES [dbo].[CmmsWorkRequest] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsWorkOrder_PmScheduleId] FOREIGN KEY ([PmScheduleId]) REFERENCES [dbo].[CmmsPmSchedule] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsWorkOrder_CrewId] FOREIGN KEY ([CrewId]) REFERENCES [dbo].[CmmsCrew] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsWorkOrder_PrimaryTechnicianId] FOREIGN KEY ([PrimaryTechnicianId]) REFERENCES [dbo].[CmmsTechnician] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsWorkOrder_VendorId] FOREIGN KEY ([VendorId]) REFERENCES [dbo].[CmmsVendor] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsWorkOrder_WorkflowInstanceId] FOREIGN KEY ([WorkflowInstanceId]) REFERENCES [dbo].[CmmsWorkflowInstance] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsWorkOrder_Type] CHECK (WorkOrderType IN ('pm','cm','emergency','overhaul','project','calibration','inspection')),
  CONSTRAINT [CK_CmmsWorkOrder_Priority] CHECK (Priority BETWEEN 1 AND 5),
  CONSTRAINT [CK_CmmsWorkOrder_Status] CHECK (Status IN ('draft','planned','scheduled','released','in-progress','on-hold','completed','closed','cancelled')),
  CONSTRAINT [CK_CmmsWorkOrder_Impact] CHECK (ProductionImpact IN ('none','partial','line-stop','plant-stop')),
  CONSTRAINT [CK_CmmsWorkOrder_Hours] CHECK (ActualHours IS NULL OR ActualHours >= 0),
  CONSTRAINT [CK_CmmsWorkOrder_Release] CHECK (Status NOT IN ('released','in-progress','completed','closed') OR ReleasedAt IS NOT NULL),
  CONSTRAINT [CK_CmmsWorkOrder_Close] CHECK (Status <> 'closed' OR ClosedAt IS NOT NULL)
);
CREATE UNIQUE INDEX [UX_CmmsWorkOrder_No] ON [dbo].[CmmsWorkOrder] ([SiteId], [WorkOrderNo]);
CREATE INDEX [IX_CmmsWorkOrder_Asset] ON [dbo].[CmmsWorkOrder] ([SiteId], [AssetId], [Status]);
CREATE INDEX [IX_CmmsWorkOrder_Status] ON [dbo].[CmmsWorkOrder] ([SiteId], [Status], [Priority]);
CREATE INDEX [IX_CmmsWorkOrder_Schedule] ON [dbo].[CmmsWorkOrder] ([SiteId], [ScheduledStartAt], [Status]);
CREATE INDEX [IX_CmmsWorkOrder_Technician] ON [dbo].[CmmsWorkOrder] ([SiteId], [PrimaryTechnicianId], [Status]);
GO

-- CmmsWorkOrderTask · cmms · ردیف چک‌لیست دستورکار
IF OBJECT_ID('dbo.CmmsWorkOrderTask', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkOrderTask] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkOrderId] NVARCHAR(60) NOT NULL,
  [FamilyPmTaskId] NVARCHAR(60) NULL,
  [ChecklistItemId] NVARCHAR(60) NULL,
  [LineNo] INT NOT NULL,
  [DescriptionFa] NVARCHAR(600) NOT NULL,
  [ResultStatus] NVARCHAR(24) NOT NULL DEFAULT 'pending',
  [MeasuredValueText] NVARCHAR(200) NULL,
  [MeasuredValueNumber] DECIMAL(18,6) NULL,
  [PlannedMinutes] DECIMAL(12,3) NULL,
  [ActualMinutes] DECIMAL(12,3) NULL,
  [PerformedBy] NVARCHAR(60) NULL,
  [PerformedAt] DATETIME2 NULL,
  [FindingFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkOrderTask] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkOrderTask_WorkOrderId] FOREIGN KEY ([WorkOrderId]) REFERENCES [dbo].[CmmsWorkOrder] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsWorkOrderTask_FamilyPmTaskId] FOREIGN KEY ([FamilyPmTaskId]) REFERENCES [dbo].[CmmsFamilyPmTask] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsWorkOrderTask_ChecklistItemId] FOREIGN KEY ([ChecklistItemId]) REFERENCES [dbo].[CmmsPmChecklistItem] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsWorkOrderTask_Line] CHECK (LineNo > 0),
  CONSTRAINT [CK_CmmsWorkOrderTask_Result] CHECK (ResultStatus IN ('pending','pass','fail','na','deferred'))
);
CREATE UNIQUE INDEX [UX_CmmsWorkOrderTask_Line] ON [dbo].[CmmsWorkOrderTask] ([WorkOrderId], [LineNo]);
CREATE INDEX [IX_CmmsWorkOrderTask_Result] ON [dbo].[CmmsWorkOrderTask] ([SiteId], [ResultStatus]);
GO

-- CmmsWorkOrderLabor · cmms · نفرساعت دستورکار
IF OBJECT_ID('dbo.CmmsWorkOrderLabor', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkOrderLabor] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkOrderId] NVARCHAR(60) NOT NULL,
  [TechnicianId] NVARCHAR(60) NOT NULL,
  [WorkDate] DATE NOT NULL,
  [StartTime] NVARCHAR(10) NOT NULL,
  [EndTime] NVARCHAR(10) NOT NULL,
  [RegularHours] DECIMAL(12,3) NOT NULL,
  [OvertimeHours] DECIMAL(12,3) NULL,
  [LaborRate] DECIMAL(18,4) NOT NULL,
  [LaborCost] DECIMAL(18,2) NULL,
  [IsOvertime] BIT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkOrderLabor] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkOrderLabor_WorkOrderId] FOREIGN KEY ([WorkOrderId]) REFERENCES [dbo].[CmmsWorkOrder] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsWorkOrderLabor_TechnicianId] FOREIGN KEY ([TechnicianId]) REFERENCES [dbo].[CmmsTechnician] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsWorkOrderLabor_Hours] CHECK (RegularHours >= 0 AND RegularHours <= 24),
  CONSTRAINT [CK_CmmsWorkOrderLabor_OT] CHECK (OvertimeHours IS NULL OR (OvertimeHours >= 0 AND OvertimeHours <= 24)),
  CONSTRAINT [CK_CmmsWorkOrderLabor_Rate] CHECK (LaborRate >= 0)
);
CREATE INDEX [IX_CmmsWorkOrderLabor_Wo] ON [dbo].[CmmsWorkOrderLabor] ([WorkOrderId], [WorkDate]);
CREATE INDEX [IX_CmmsWorkOrderLabor_Tech] ON [dbo].[CmmsWorkOrderLabor] ([SiteId], [TechnicianId], [WorkDate]);
GO

-- CmmsWorkOrderMaterial · cmms · قطعات مصرفی دستورکار
IF OBJECT_ID('dbo.CmmsWorkOrderMaterial', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkOrderMaterial] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkOrderId] NVARCHAR(60) NOT NULL,
  [SparePartId] NVARCHAR(60) NOT NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [IssuedOn] DATE NOT NULL,
  [UnitCost] DECIMAL(18,2) NULL,
  [TotalCost] DECIMAL(18,2) NULL,
  [IssuedBy] NVARCHAR(60) NULL,
  [LineType] NVARCHAR(24) NOT NULL DEFAULT 'planned',
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkOrderMaterial] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkOrderMaterial_WorkOrderId] FOREIGN KEY ([WorkOrderId]) REFERENCES [dbo].[CmmsWorkOrder] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsWorkOrderMaterial_SparePartId] FOREIGN KEY ([SparePartId]) REFERENCES [dbo].[CmmsSparePart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsWorkOrderMaterial_Qty] CHECK (Quantity > 0),
  CONSTRAINT [CK_CmmsWorkOrderMaterial_Line] CHECK (LineType IN ('planned','actual','returned'))
);
CREATE INDEX [IX_CmmsWorkOrderMaterial_Wo] ON [dbo].[CmmsWorkOrderMaterial] ([WorkOrderId], [IssuedOn]);
CREATE INDEX [IX_CmmsWorkOrderMaterial_Part] ON [dbo].[CmmsWorkOrderMaterial] ([SiteId], [SparePartId]);
GO

-- CmmsWorkOrderCost · cmms · هزینهٔ دستورکار
IF OBJECT_ID('dbo.CmmsWorkOrderCost', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkOrderCost] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkOrderId] NVARCHAR(60) NOT NULL,
  [CostElement] NVARCHAR(28) NOT NULL,
  [Amount] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [PostedOn] DATE NOT NULL,
  [CostCenterRef] NVARCHAR(60) NULL,
  [VendorId] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkOrderCost] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkOrderCost_WorkOrderId] FOREIGN KEY ([WorkOrderId]) REFERENCES [dbo].[CmmsWorkOrder] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsWorkOrderCost_VendorId] FOREIGN KEY ([VendorId]) REFERENCES [dbo].[CmmsVendor] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsWorkOrderCost_Element] CHECK (CostElement IN ('labor','material','contract','tool','overhead','downtime-loss')),
  CONSTRAINT [CK_CmmsWorkOrderCost_Amount] CHECK (Amount IS NULL OR Amount >= 0)
);
CREATE INDEX [IX_CmmsWorkOrderCost_Wo] ON [dbo].[CmmsWorkOrderCost] ([WorkOrderId], [PostedOn]);
CREATE INDEX [IX_CmmsWorkOrderCost_Element] ON [dbo].[CmmsWorkOrderCost] ([SiteId], [CostElement], [PostedOn]);
GO

-- CmmsFailureRecord · cmms · ثبت خرابی (ISO 14224)
IF OBJECT_ID('dbo.CmmsFailureRecord', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFailureRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [FamilyFailureModeId] NVARCHAR(60) NULL,
  [FamilyNodeId] NVARCHAR(60) NULL,
  [FailureMode] NVARCHAR(40) NOT NULL,
  [FailureMechanism] NVARCHAR(40) NOT NULL,
  [FailureSubMechanism] NVARCHAR(120) NULL,
  [Iso14224Code] NVARCHAR(160) NULL,
  [DetectedAt] DATETIME2 NOT NULL,
  [DetectedOn] DATE NOT NULL,
  [DetectedBy] NVARCHAR(60) NULL,
  [DetectionMethod] NVARCHAR(28) NOT NULL,
  [RestoredAt] DATETIME2 NULL,
  [DowntimeHours] DECIMAL(12,3) NULL,
  [RepairHours] DECIMAL(12,3) NULL,
  [RunningHoursBefore] DECIMAL(12,3) NULL,
  [WorkOrderId] NVARCHAR(60) NULL,
  [RcaCaseId] NVARCHAR(60) NULL,
  [Consequence] NVARCHAR(28) NOT NULL DEFAULT 'non-operational',
  [DescriptionFa] NVARCHAR(2000) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFailureRecord] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFailureRecord_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsFailureRecord_FamilyFailureModeId] FOREIGN KEY ([FamilyFailureModeId]) REFERENCES [dbo].[CmmsFamilyFailureMode] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsFailureRecord_FamilyNodeId] FOREIGN KEY ([FamilyNodeId]) REFERENCES [dbo].[CmmsFamilyNode] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsFailureRecord_Detection] CHECK (DetectionMethod IN ('operator','inspection','cbm','alarm','breakdown-report','other')),
  CONSTRAINT [CK_CmmsFailureRecord_Consequence] CHECK (Consequence IN ('safety-environmental','operational','non-operational','hidden')),
  CONSTRAINT [CK_CmmsFailureRecord_Downtime] CHECK (DowntimeHours IS NULL OR DowntimeHours >= 0),
  CONSTRAINT [CK_CmmsFailureRecord_Restore] CHECK (RestoredAt IS NULL OR RestoredAt >= DetectedAt)
);
CREATE INDEX [IX_CmmsFailureRecord_Asset] ON [dbo].[CmmsFailureRecord] ([SiteId], [AssetId], [DetectedOn]);
CREATE INDEX [IX_CmmsFailureRecord_Mode] ON [dbo].[CmmsFailureRecord] ([SiteId], [FailureMode], [FailureMechanism]);
CREATE INDEX [IX_CmmsFailureRecord_Wo] ON [dbo].[CmmsFailureRecord] ([SiteId], [WorkOrderId]);
GO

-- CmmsDowntimeRecord · cmms · ثبت توقف تجهیز
IF OBJECT_ID('dbo.CmmsDowntimeRecord', 'U') IS NULL
CREATE TABLE [dbo].[CmmsDowntimeRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [StartedAt] DATETIME2 NOT NULL,
  [EndedAt] DATETIME2 NULL,
  [DowntimeType] NVARCHAR(28) NOT NULL,
  [DurationHours] DECIMAL(12,3) NULL,
  [CausedByMaintenance] BIT NOT NULL DEFAULT 1,
  [ProductionImpact] NVARCHAR(24) NOT NULL DEFAULT 'none',
  [CustomersAffected] DECIMAL(18,0) NULL,
  [WorkOrderId] NVARCHAR(60) NULL,
  [FailureRecordId] NVARCHAR(60) NULL,
  [ReasonFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsDowntimeRecord] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsDowntimeRecord_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsDowntimeRecord_FailureRecordId] FOREIGN KEY ([FailureRecordId]) REFERENCES [dbo].[CmmsFailureRecord] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsDowntimeRecord_Type] CHECK (DowntimeType IN ('planned','unplanned','standby','waiting-for-parts','waiting-for-crew','no-demand')),
  CONSTRAINT [CK_CmmsDowntimeRecord_Impact] CHECK (ProductionImpact IN ('none','partial','line-stop','plant-stop')),
  CONSTRAINT [CK_CmmsDowntimeRecord_End] CHECK (EndedAt IS NULL OR EndedAt >= StartedAt),
  CONSTRAINT [CK_CmmsDowntimeRecord_Duration] CHECK (DurationHours IS NULL OR DurationHours >= 0)
);
CREATE INDEX [IX_CmmsDowntimeRecord_Asset] ON [dbo].[CmmsDowntimeRecord] ([SiteId], [AssetId], [StartedAt]);
CREATE INDEX [IX_CmmsDowntimeRecord_Type] ON [dbo].[CmmsDowntimeRecord] ([SiteId], [DowntimeType], [StartedAt]);
GO

-- CmmsConditionThreshold · cmms · آستانهٔ پایش وضعیت
IF OBJECT_ID('dbo.CmmsConditionThreshold', 'U') IS NULL
CREATE TABLE [dbo].[CmmsConditionThreshold] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyConditionParamId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NULL,
  [MachineClass] NVARCHAR(24) NOT NULL DEFAULT 'group2',
  [RigidSupport] BIT NOT NULL DEFAULT 1,
  [ZoneAUpper] DECIMAL(18,6) NULL,
  [ZoneBUpper] DECIMAL(18,6) NULL,
  [ZoneCUpper] DECIMAL(18,6) NULL,
  [ZoneDefinitionRef] NVARCHAR(200) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsConditionThreshold] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsConditionThreshold_FamilyConditionParamId] FOREIGN KEY ([FamilyConditionParamId]) REFERENCES [dbo].[CmmsFamilyConditionParam] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsConditionThreshold_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsConditionThreshold_Class] CHECK (MachineClass IN ('group1','group2','group3','group4')),
  CONSTRAINT [CK_CmmsConditionThreshold_Zones] CHECK (ZoneBUpper IS NULL OR ZoneAUpper IS NULL OR ZoneBUpper > ZoneAUpper),
  CONSTRAINT [CK_CmmsConditionThreshold_ZonesC] CHECK (ZoneCUpper IS NULL OR ZoneBUpper IS NULL OR ZoneCUpper > ZoneBUpper)
);
CREATE UNIQUE INDEX [UX_CmmsConditionThreshold_Param] ON [dbo].[CmmsConditionThreshold] ([FamilyConditionParamId], [AssetId]) WHERE [AssetId] IS NOT NULL;
CREATE INDEX [IX_CmmsConditionThreshold_Class] ON [dbo].[CmmsConditionThreshold] ([SiteId], [MachineClass]);
GO

-- CmmsConditionReading · cmms · قرائت پایش وضعیت
IF OBJECT_ID('dbo.CmmsConditionReading', 'U') IS NULL
CREATE TABLE [dbo].[CmmsConditionReading] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [FamilyConditionParamId] NVARCHAR(60) NOT NULL,
  [MeasuredAt] DATETIME2 NOT NULL,
  [MeasuredOn] DATE NOT NULL,
  [Value] DECIMAL(18,6) NULL,
  [Uom] NVARCHAR(24) NOT NULL,
  [Zone] NVARCHAR(12) NULL,
  [Source] NVARCHAR(24) NULL DEFAULT 'manual',
  [AnalystId] NVARCHAR(60) NULL,
  [WorkOrderId] NVARCHAR(60) NULL,
  [TrendDirection] NVARCHAR(16) NULL,
  [RateOfChange] DECIMAL(18,6) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsConditionReading] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsConditionReading_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsConditionReading_FamilyConditionParamId] FOREIGN KEY ([FamilyConditionParamId]) REFERENCES [dbo].[CmmsFamilyConditionParam] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsConditionReading_Zone] CHECK (Zone IS NULL OR Zone IN ('A','B','C','D')),
  CONSTRAINT [CK_CmmsConditionReading_Source] CHECK (Source IS NULL OR Source IN ('manual','iiot','scada','portable','lab')),
  CONSTRAINT [CK_CmmsConditionReading_Trend] CHECK (TrendDirection IS NULL OR TrendDirection IN ('rising','falling','stable'))
);
CREATE INDEX [IX_CmmsConditionReading_Asset] ON [dbo].[CmmsConditionReading] ([SiteId], [AssetId], [MeasuredOn]);
CREATE INDEX [IX_CmmsConditionReading_Param] ON [dbo].[CmmsConditionReading] ([FamilyConditionParamId], [MeasuredAt]);
CREATE INDEX [IX_CmmsConditionReading_Zone] ON [dbo].[CmmsConditionReading] ([SiteId], [Zone], [MeasuredOn]);
GO

-- CmmsFmeaRecord · cmms · تحلیل FMEA/FMECA
IF OBJECT_ID('dbo.CmmsFmeaRecord', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFmeaRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NULL,
  [AssetId] NVARCHAR(60) NULL,
  [AnalysisCode] NVARCHAR(60) NOT NULL,
  [AnalysisType] NVARCHAR(24) NOT NULL DEFAULT 'fmea',
  [Methodology] NVARCHAR(40) NOT NULL DEFAULT 'IEC 60812',
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [TeamLeadId] NVARCHAR(60) NULL,
  [AnalyzedOn] DATE NULL,
  [ReviewedOn] DATE NULL,
  [MaxRpnThreshold] DECIMAL(10,2) NULL,
  [TotalRpn] DECIMAL(18,2) NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFmeaRecord] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFmeaRecord_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsFmeaRecord_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsFmeaRecord_Target] CHECK (FamilyId IS NOT NULL OR AssetId IS NOT NULL),
  CONSTRAINT [CK_CmmsFmeaRecord_Type] CHECK (AnalysisType IN ('fmea','fmeca')),
  CONSTRAINT [CK_CmmsFmeaRecord_Status] CHECK (Status IN ('draft','in-review','approved','obsolete')),
  CONSTRAINT [CK_CmmsFmeaRecord_Threshold] CHECK (MaxRpnThreshold IS NULL OR MaxRpnThreshold > 0)
);
CREATE UNIQUE INDEX [UX_CmmsFmeaRecord_Code] ON [dbo].[CmmsFmeaRecord] ([SiteId], [AnalysisCode]);
CREATE INDEX [IX_CmmsFmeaRecord_Family] ON [dbo].[CmmsFmeaRecord] ([SiteId], [FamilyId], [Status]);
GO

-- CmmsFmeaEntry · cmms · ردیف FMEA
IF OBJECT_ID('dbo.CmmsFmeaEntry', 'U') IS NULL
CREATE TABLE [dbo].[CmmsFmeaEntry] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FmeaRecordId] NVARCHAR(60) NOT NULL,
  [FamilyFailureModeId] NVARCHAR(60) NULL,
  [FamilyNodeId] NVARCHAR(60) NULL,
  [FunctionFa] NVARCHAR(600) NOT NULL,
  [FailureModeText] NVARCHAR(400) NOT NULL,
  [EffectFa] NVARCHAR(800) NOT NULL,
  [CauseFa] NVARCHAR(800) NOT NULL,
  [CurrentControlFa] NVARCHAR(800) NULL,
  [Severity] INT NOT NULL,
  [Occurrence] INT NOT NULL,
  [Detection] INT NOT NULL,
  [Rpn] INT NOT NULL,
  [ActionPriority] NVARCHAR(12) NULL,
  [FailureRatePerHour] DECIMAL(18,10) NULL,
  [BetaFactor] DECIMAL(8,4) NULL,
  [MissionTimeHours] DECIMAL(12,2) NULL,
  [CriticalityNumber] DECIMAL(18,10) NULL,
  [RecommendedActionFa] NVARCHAR(1200) NOT NULL,
  [ActionOwnerId] NVARCHAR(60) NULL,
  [ActionDueOn] DATE NULL,
  [SortOrder] INT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsFmeaEntry] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsFmeaEntry_FmeaRecordId] FOREIGN KEY ([FmeaRecordId]) REFERENCES [dbo].[CmmsFmeaRecord] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsFmeaEntry_FamilyFailureModeId] FOREIGN KEY ([FamilyFailureModeId]) REFERENCES [dbo].[CmmsFamilyFailureMode] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsFmeaEntry_FamilyNodeId] FOREIGN KEY ([FamilyNodeId]) REFERENCES [dbo].[CmmsFamilyNode] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsFmeaEntry_Severity] CHECK (Severity BETWEEN 1 AND 10),
  CONSTRAINT [CK_CmmsFmeaEntry_Occurrence] CHECK (Occurrence BETWEEN 1 AND 10),
  CONSTRAINT [CK_CmmsFmeaEntry_Detection] CHECK (Detection BETWEEN 1 AND 10),
  CONSTRAINT [CK_CmmsFmeaEntry_Rpn] CHECK (Rpn BETWEEN 1 AND 1000),
  CONSTRAINT [CK_CmmsFmeaEntry_AP] CHECK (ActionPriority IS NULL OR ActionPriority IN ('high','medium','low'))
);
CREATE INDEX [IX_CmmsFmeaEntry_Record] ON [dbo].[CmmsFmeaEntry] ([FmeaRecordId], [SortOrder]);
CREATE INDEX [IX_CmmsFmeaEntry_Rpn] ON [dbo].[CmmsFmeaEntry] ([SiteId], [Rpn], [ActionPriority]);
GO

-- CmmsRcmAnalysis · cmms · تحلیل RCM
IF OBJECT_ID('dbo.CmmsRcmAnalysis', 'U') IS NULL
CREATE TABLE [dbo].[CmmsRcmAnalysis] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [AnalysisCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [TeamLeadId] NVARCHAR(60) NULL,
  [AnalyzedOn] DATE NULL,
  [FunctionCount] INT NOT NULL DEFAULT 0,
  [FailureModeCount] INT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsRcmAnalysis] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsRcmAnalysis_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsRcmAnalysis_Status] CHECK (Status IN ('draft','in-review','approved','obsolete')),
  CONSTRAINT [CK_CmmsRcmAnalysis_Counts] CHECK (FunctionCount >= 0 AND FailureModeCount >= 0)
);
CREATE UNIQUE INDEX [UX_CmmsRcmAnalysis_Code] ON [dbo].[CmmsRcmAnalysis] ([SiteId], [AnalysisCode]);
CREATE INDEX [IX_CmmsRcmAnalysis_Family] ON [dbo].[CmmsRcmAnalysis] ([SiteId], [FamilyId], [Status]);
GO

-- CmmsRcmEntry · cmms · ردیف تصمیم RCM
IF OBJECT_ID('dbo.CmmsRcmEntry', 'U') IS NULL
CREATE TABLE [dbo].[CmmsRcmEntry] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [RcmAnalysisId] NVARCHAR(60) NOT NULL,
  [FamilyFailureModeId] NVARCHAR(60) NULL,
  [FunctionStatementFa] NVARCHAR(600) NOT NULL,
  [FunctionalFailureFa] NVARCHAR(600) NOT NULL,
  [FailureMode] NVARCHAR(40) NOT NULL,
  [Consequence] NVARCHAR(28) NOT NULL,
  [IsHiddenFailure] BIT NOT NULL DEFAULT 0,
  [IsConditionMonitorable] BIT NOT NULL DEFAULT 0,
  [HasAgeRelatedPattern] BIT NOT NULL DEFAULT 0,
  [SelectedTask] NVARCHAR(32) NOT NULL,
  [TaskInterval] DECIMAL(18,4) NULL,
  [TaskIntervalUnit] NVARCHAR(24) NULL,
  [DecisionPathJson] NVARCHAR(MAX) NULL,
  [SortOrder] INT NOT NULL DEFAULT 0,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsRcmEntry] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsRcmEntry_RcmAnalysisId] FOREIGN KEY ([RcmAnalysisId]) REFERENCES [dbo].[CmmsRcmAnalysis] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsRcmEntry_FamilyFailureModeId] FOREIGN KEY ([FamilyFailureModeId]) REFERENCES [dbo].[CmmsFamilyFailureMode] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsRcmEntry_Consequence] CHECK (Consequence IN ('safety-environmental','operational','non-operational','hidden')),
  CONSTRAINT [CK_CmmsRcmEntry_Task] CHECK (SelectedTask IN ('condition-based','scheduled-restoration','scheduled-discard','failure-finding','run-to-failure','redesign')),
  CONSTRAINT [CK_CmmsRcmEntry_Interval] CHECK (TaskInterval IS NULL OR TaskInterval > 0)
);
CREATE INDEX [IX_CmmsRcmEntry_Analysis] ON [dbo].[CmmsRcmEntry] ([RcmAnalysisId], [SortOrder]);
CREATE INDEX [IX_CmmsRcmEntry_Task] ON [dbo].[CmmsRcmEntry] ([SiteId], [SelectedTask], [Consequence]);
GO

-- CmmsMaintenancePlan · cmms · برنامهٔ نگهداشت مصوب
IF OBJECT_ID('dbo.CmmsMaintenancePlan', 'U') IS NULL
CREATE TABLE [dbo].[CmmsMaintenancePlan] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [FamilyId] NVARCHAR(60) NOT NULL,
  [RcmAnalysisId] NVARCHAR(60) NULL,
  [FmeaRecordId] NVARCHAR(60) NULL,
  [PlanCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [StrategyType] NVARCHAR(28) NOT NULL,
  [Version] INT NOT NULL DEFAULT 1,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [ApprovedAt] DATETIME2 NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [EffectiveFrom] DATE NULL,
  [EffectiveTo] DATE NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsMaintenancePlan] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsMaintenancePlan_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsMaintenancePlan_RcmAnalysisId] FOREIGN KEY ([RcmAnalysisId]) REFERENCES [dbo].[CmmsRcmAnalysis] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsMaintenancePlan_FmeaRecordId] FOREIGN KEY ([FmeaRecordId]) REFERENCES [dbo].[CmmsFmeaRecord] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsMaintenancePlan_Strategy] CHECK (StrategyType IN ('pm','cbm','predictive','risk-based','run-to-failure','zero-breakdown')),
  CONSTRAINT [CK_CmmsMaintenancePlan_Status] CHECK (Status IN ('draft','approved','active','obsolete')),
  CONSTRAINT [CK_CmmsMaintenancePlan_Dates] CHECK (EffectiveTo IS NULL OR EffectiveFrom IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX [UX_CmmsMaintenancePlan_Code] ON [dbo].[CmmsMaintenancePlan] ([SiteId], [PlanCode], [Version]);
CREATE INDEX [IX_CmmsMaintenancePlan_Family] ON [dbo].[CmmsMaintenancePlan] ([SiteId], [FamilyId], [Status]);
GO

-- CmmsRcaCase · cmms · پروندهٔ تحلیل ریشه‌ای
IF OBJECT_ID('dbo.CmmsRcaCase', 'U') IS NULL
CREATE TABLE [dbo].[CmmsRcaCase] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [CaseNo] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [FailureRecordId] NVARCHAR(60) NULL,
  [WorkOrderId] NVARCHAR(60) NULL,
  [Method] NVARCHAR(28) NOT NULL DEFAULT 'five-why',
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'open',
  [OpenedOn] DATE NOT NULL,
  [OpenedById] NVARCHAR(60) NULL,
  [ClosedOn] DATE NULL,
  [ProblemStatementFa] NVARCHAR(1000) NOT NULL,
  [RootCauseFa] NVARCHAR(2000) NULL,
  [WhyDepth] INT NOT NULL DEFAULT 0,
  [CorrectiveActionFa] NVARCHAR(2000) NULL,
  [PreventiveActionFa] NVARCHAR(2000) NULL,
  [EffectivenessVerifiedOn] DATE NULL,
  [EstimatedAvoidedCost] DECIMAL(18,2) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsRcaCase] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsRcaCase_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsRcaCase_FailureRecordId] FOREIGN KEY ([FailureRecordId]) REFERENCES [dbo].[CmmsFailureRecord] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsRcaCase_Method] CHECK (Method IN ('five-why','fishbone','apollo','fault-tree','combined')),
  CONSTRAINT [CK_CmmsRcaCase_Status] CHECK (Status IN ('open','in-progress','closed','verified')),
  CONSTRAINT [CK_CmmsRcaCase_Depth] CHECK (WhyDepth >= 0 AND WhyDepth <= 10)
);
CREATE UNIQUE INDEX [UX_CmmsRcaCase_No] ON [dbo].[CmmsRcaCase] ([SiteId], [CaseNo]);
CREATE INDEX [IX_CmmsRcaCase_Asset] ON [dbo].[CmmsRcaCase] ([SiteId], [AssetId], [Status]);
CREATE INDEX [IX_CmmsRcaCase_Failure] ON [dbo].[CmmsRcaCase] ([SiteId], [FailureRecordId]);
GO

-- CmmsRcaEntry · cmms · ردیف تحلیل ریشه‌ای
IF OBJECT_ID('dbo.CmmsRcaEntry', 'U') IS NULL
CREATE TABLE [dbo].[CmmsRcaEntry] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [RcaCaseId] NVARCHAR(60) NOT NULL,
  [EntryType] NVARCHAR(24) NOT NULL,
  [Sequence] INT NOT NULL,
  [ParentEntryId] NVARCHAR(60) NULL,
  [StatementFa] NVARCHAR(1200) NOT NULL,
  [FishboneCategory] NVARCHAR(28) NULL,
  [IsRootCause] BIT NOT NULL DEFAULT 0,
  [EvidencePath] NVARCHAR(600) NULL,
  [OwnerId] NVARCHAR(60) NULL,
  [DueOn] DATE NULL,
  [CompletedOn] DATE NULL,
  [AiSuggested] BIT NULL DEFAULT 0,
  [AiConfidence] DECIMAL(8,4) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsRcaEntry] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsRcaEntry_RcaCaseId] FOREIGN KEY ([RcaCaseId]) REFERENCES [dbo].[CmmsRcaCase] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsRcaEntry_ParentEntryId] FOREIGN KEY ([ParentEntryId]) REFERENCES [dbo].[CmmsRcaEntry] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsRcaEntry_Type] CHECK (EntryType IN ('why','cause-branch','evidence','corrective-action','preventive-action')),
  CONSTRAINT [CK_CmmsRcaEntry_Seq] CHECK (Sequence >= 1),
  CONSTRAINT [CK_CmmsRcaEntry_Fishbone] CHECK (FishboneCategory IS NULL OR FishboneCategory IN ('man','machine','method','material','measurement','environment')),
  CONSTRAINT [CK_CmmsRcaEntry_Confidence] CHECK (AiConfidence IS NULL OR (AiConfidence >= 0 AND AiConfidence <= 1)),
  CONSTRAINT [CK_CmmsRcaEntry_Self] CHECK (ParentEntryId IS NULL OR ParentEntryId <> Id)
);
CREATE UNIQUE INDEX [UX_CmmsRcaEntry_Seq] ON [dbo].[CmmsRcaEntry] ([RcaCaseId], [EntryType], [Sequence]);
CREATE INDEX [IX_CmmsRcaEntry_Root] ON [dbo].[CmmsRcaEntry] ([SiteId], [IsRootCause]);
GO

-- CmmsReliabilitySnapshot · cmms · تصویر قابلیت اطمینان
IF OBJECT_ID('dbo.CmmsReliabilitySnapshot', 'U') IS NULL
CREATE TABLE [dbo].[CmmsReliabilitySnapshot] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NULL,
  [FamilyId] NVARCHAR(60) NULL,
  [LocationId] NVARCHAR(60) NULL,
  [PeriodType] NVARCHAR(16) NOT NULL,
  [PeriodStart] DATE NOT NULL,
  [PeriodEnd] DATE NOT NULL,
  [CalendarHours] DECIMAL(12,2) NOT NULL DEFAULT 0,
  [OperatingHours] DECIMAL(12,2) NOT NULL DEFAULT 0,
  [DowntimeHours] DECIMAL(12,2) NOT NULL DEFAULT 0,
  [FailureCount] INT NOT NULL DEFAULT 0,
  [MtbfHours] DECIMAL(18,4) NULL,
  [MttfHours] DECIMAL(18,4) NULL,
  [MttrHours] DECIMAL(18,4) NULL,
  [FailureRateLambda] DECIMAL(18,10) NULL,
  [AvailabilityPct] DECIMAL(9,4) NULL,
  [InherentAvailabilityPct] DECIMAL(9,4) NULL,
  [ReliabilityAtMission] DECIMAL(9,6) NULL,
  [MissionTimeHours] DECIMAL(12,2) NULL,
  [MeanTimeBetweenPmHours] DECIMAL(18,4) NULL,
  [PmCompliancePct] DECIMAL(9,4) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsReliabilitySnapshot] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsReliabilitySnapshot_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsReliabilitySnapshot_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsReliabilitySnapshot_LocationId] FOREIGN KEY ([LocationId]) REFERENCES [dbo].[CmmsLocation] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsReliabilitySnapshot_Period] CHECK (PeriodType IN ('daily','weekly','monthly','quarterly','yearly')),
  CONSTRAINT [CK_CmmsReliabilitySnapshot_Dates] CHECK (PeriodEnd >= PeriodStart),
  CONSTRAINT [CK_CmmsReliabilitySnapshot_Failures] CHECK (FailureCount >= 0),
  CONSTRAINT [CK_CmmsReliabilitySnapshot_Avail] CHECK (AvailabilityPct IS NULL OR (AvailabilityPct >= 0 AND AvailabilityPct <= 100)),
  CONSTRAINT [CK_CmmsReliabilitySnapshot_Mtbf] CHECK (MtbfHours IS NULL OR MtbfHours > 0)
);
CREATE UNIQUE INDEX [UX_CmmsReliabilitySnapshot_Key] ON [dbo].[CmmsReliabilitySnapshot] ([SiteId], [AssetId], [FamilyId], [PeriodType], [PeriodStart]) WHERE [AssetId] IS NOT NULL AND [FamilyId] IS NOT NULL;
CREATE INDEX [IX_CmmsReliabilitySnapshot_Period] ON [dbo].[CmmsReliabilitySnapshot] ([SiteId], [PeriodType], [PeriodEnd]);
GO

-- CmmsOeeSnapshot · cmms · تصویر OEE
IF OBJECT_ID('dbo.CmmsOeeSnapshot', 'U') IS NULL
CREATE TABLE [dbo].[CmmsOeeSnapshot] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [PeriodType] NVARCHAR(16) NOT NULL,
  [PeriodStart] DATE NOT NULL,
  [PeriodEnd] DATE NOT NULL,
  [PlannedProductionHours] DECIMAL(12,2) NOT NULL DEFAULT 0,
  [RunHours] DECIMAL(12,2) NOT NULL DEFAULT 0,
  [BreakdownHours] DECIMAL(12,3) NULL,
  [SetupHours] DECIMAL(12,3) NULL,
  [MinorStopHours] DECIMAL(12,3) NULL,
  [ReducedSpeedHours] DECIMAL(12,3) NULL,
  [StartupRejectUnits] DECIMAL(18,4) NULL,
  [ProductionRejectUnits] DECIMAL(18,4) NULL,
  [TotalUnits] DECIMAL(18,4) NULL,
  [IdealCycleTimeSeconds] DECIMAL(12,4) NULL,
  [AvailabilityPct] DECIMAL(9,4) NULL,
  [PerformancePct] DECIMAL(9,4) NULL,
  [QualityPct] DECIMAL(9,4) NULL,
  [OeePct] DECIMAL(9,4) NULL,
  [TeepPct] DECIMAL(9,4) NULL,
  [CalendarHours] DECIMAL(12,2) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsOeeSnapshot] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsOeeSnapshot_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsOeeSnapshot_Period] CHECK (PeriodType IN ('daily','weekly','monthly','quarterly','yearly')),
  CONSTRAINT [CK_CmmsOeeSnapshot_Dates] CHECK (PeriodEnd >= PeriodStart),
  CONSTRAINT [CK_CmmsOeeSnapshot_Oee] CHECK (OeePct IS NULL OR (OeePct >= 0 AND OeePct <= 100)),
  CONSTRAINT [CK_CmmsOeeSnapshot_Avail] CHECK (AvailabilityPct IS NULL OR (AvailabilityPct >= 0 AND AvailabilityPct <= 100)),
  CONSTRAINT [CK_CmmsOeeSnapshot_Units] CHECK (TotalUnits IS NULL OR TotalUnits >= 0)
);
CREATE UNIQUE INDEX [UX_CmmsOeeSnapshot_Key] ON [dbo].[CmmsOeeSnapshot] ([SiteId], [AssetId], [PeriodType], [PeriodStart]);
CREATE INDEX [IX_CmmsOeeSnapshot_Period] ON [dbo].[CmmsOeeSnapshot] ([SiteId], [PeriodType], [PeriodEnd]);
GO

-- CmmsSupplyReliability · cmms · شاخص قابلیت اطمینان IEEE 1366
IF OBJECT_ID('dbo.CmmsSupplyReliability', 'U') IS NULL
CREATE TABLE [dbo].[CmmsSupplyReliability] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [LocationId] NVARCHAR(60) NULL,
  [PeriodType] NVARCHAR(16) NOT NULL,
  [PeriodStart] DATE NOT NULL,
  [PeriodEnd] DATE NOT NULL,
  [CustomersServed] INT NOT NULL DEFAULT 0,
  [TotalInterruptions] INT NOT NULL DEFAULT 0,
  [CustomersInterrupted] INT NOT NULL DEFAULT 0,
  [TotalCustomerInterruptionMinutes] DECIMAL(18,2) NULL,
  [TotalCustomerMinutesAffected] DECIMAL(18,2) NULL,
  [SaidiMinutes] DECIMAL(18,4) NULL,
  [SaifiCount] DECIMAL(18,4) NULL,
  [CaidiMinutes] DECIMAL(18,4) NULL,
  [AsaiPct] DECIMAL(12,8) NULL,
  [MaifiCount] DECIMAL(18,4) NULL,
  [EnrsCurrency] DECIMAL(18,2) NULL,
  [ExcludeMajorEvents] BIT NOT NULL DEFAULT 0,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsSupplyReliability] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsSupplyReliability_LocationId] FOREIGN KEY ([LocationId]) REFERENCES [dbo].[CmmsLocation] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsSupplyReliability_Period] CHECK (PeriodType IN ('daily','weekly','monthly','quarterly','yearly')),
  CONSTRAINT [CK_CmmsSupplyReliability_Customers] CHECK (CustomersServed >= 0),
  CONSTRAINT [CK_CmmsSupplyReliability_Asai] CHECK (AsaiPct IS NULL OR (AsaiPct >= 0 AND AsaiPct <= 100))
);
CREATE UNIQUE INDEX [UX_CmmsSupplyReliability_Key] ON [dbo].[CmmsSupplyReliability] ([SiteId], [LocationId], [PeriodType], [PeriodStart]) WHERE [LocationId] IS NOT NULL;
CREATE INDEX [IX_CmmsSupplyReliability_Period] ON [dbo].[CmmsSupplyReliability] ([SiteId], [PeriodType], [PeriodEnd]);
GO

-- CmmsLccRecord · cmms · هزینهٔ چرخهٔ عمر (LCC)
IF OBJECT_ID('dbo.CmmsLccRecord', 'U') IS NULL
CREATE TABLE [dbo].[CmmsLccRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NOT NULL,
  [ScenarioName] NVARCHAR(200) NULL,
  [AnalysisDate] DATE NOT NULL,
  [LifeYears] INT NOT NULL,
  [DiscountRatePct] DECIMAL(9,4) NULL,
  [AcquisitionCost] DECIMAL(18,2) NULL,
  [InstallationCost] DECIMAL(18,2) NULL,
  [OperatingCostPerYear] DECIMAL(18,2) NULL,
  [MaintenanceCostPerYear] DECIMAL(18,2) NULL,
  [DowntimeLossPerYear] DECIMAL(18,2) NULL,
  [EnergyCostPerYear] DECIMAL(18,2) NULL,
  [DisposalCost] DECIMAL(18,2) NULL,
  [ResidualValue] DECIMAL(18,2) NULL,
  [NpvAcquisition] DECIMAL(18,2) NULL,
  [NpvOperation] DECIMAL(18,2) NULL,
  [NpvMaintenance] DECIMAL(18,2) NULL,
  [NpvDowntime] DECIMAL(18,2) NULL,
  [NpvDisposal] DECIMAL(18,2) NULL,
  [TotalNpv] DECIMAL(18,2) NULL,
  [CostPerOperatingHour] DECIMAL(18,4) NULL,
  [CostPerUnitProduced] DECIMAL(18,4) NULL,
  [IsSelectedOption] BIT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(1000) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsLccRecord] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsLccRecord_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsLccRecord_Life] CHECK (LifeYears > 0),
  CONSTRAINT [CK_CmmsLccRecord_Rate] CHECK (DiscountRatePct IS NULL OR DiscountRatePct >= 0)
);
CREATE INDEX [IX_CmmsLccRecord_Asset] ON [dbo].[CmmsLccRecord] ([SiteId], [AssetId], [AnalysisDate]);
CREATE INDEX [IX_CmmsLccRecord_Selected] ON [dbo].[CmmsLccRecord] ([SiteId], [IsSelectedOption]);
GO

-- CmmsCostRecord · cmms · ثبت هزینهٔ نت
IF OBJECT_ID('dbo.CmmsCostRecord', 'U') IS NULL
CREATE TABLE [dbo].[CmmsCostRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NULL,
  [FamilyId] NVARCHAR(60) NULL,
  [CostElement] NVARCHAR(28) NOT NULL,
  [PeriodType] NVARCHAR(16) NOT NULL,
  [PeriodStart] DATE NOT NULL,
  [PeriodEnd] DATE NOT NULL,
  [Amount] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [WorkOrderId] NVARCHAR(60) NULL,
  [VendorId] NVARCHAR(60) NULL,
  [CostPerReplacementAssetValue] DECIMAL(9,4) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsCostRecord] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsCostRecord_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsCostRecord_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsCostRecord_VendorId] FOREIGN KEY ([VendorId]) REFERENCES [dbo].[CmmsVendor] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsCostRecord_Element] CHECK (CostElement IN ('labor','material','contract','tool','overhead','downtime-loss','capital')),
  CONSTRAINT [CK_CmmsCostRecord_Period] CHECK (PeriodType IN ('daily','weekly','monthly','quarterly','yearly')),
  CONSTRAINT [CK_CmmsCostRecord_Dates] CHECK (PeriodEnd >= PeriodStart)
);
CREATE INDEX [IX_CmmsCostRecord_Asset] ON [dbo].[CmmsCostRecord] ([SiteId], [AssetId], [PeriodStart]);
CREATE INDEX [IX_CmmsCostRecord_Element] ON [dbo].[CmmsCostRecord] ([SiteId], [CostElement], [PeriodType], [PeriodStart]);
GO

-- CmmsKpiTarget · cmms · هدف شاخص عملکرد نت
IF OBJECT_ID('dbo.CmmsKpiTarget', 'U') IS NULL
CREATE TABLE [dbo].[CmmsKpiTarget] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [KpiCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [Category] NVARCHAR(28) NOT NULL,
  [Uom] NVARCHAR(24) NOT NULL,
  [Direction] NVARCHAR(16) NOT NULL DEFAULT 'maximize',
  [TargetValue] DECIMAL(18,4) NULL,
  [WarnThreshold] DECIMAL(18,4) NULL,
  [AlarmThreshold] DECIMAL(18,4) NULL,
  [PeriodType] NVARCHAR(16) NOT NULL DEFAULT 'monthly',
  [IsActive] BIT NOT NULL DEFAULT 1,
  [FormulaFa] NVARCHAR(800) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsKpiTarget] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_CmmsKpiTarget_Category] CHECK (Category IN ('technical','economic','organizational')),
  CONSTRAINT [CK_CmmsKpiTarget_Direction] CHECK (Direction IN ('maximize','minimize','target')),
  CONSTRAINT [CK_CmmsKpiTarget_Period] CHECK (PeriodType IN ('daily','weekly','monthly','quarterly','yearly'))
);
CREATE UNIQUE INDEX [UX_CmmsKpiTarget_Code] ON [dbo].[CmmsKpiTarget] ([SiteId], [KpiCode]);
CREATE INDEX [IX_CmmsKpiTarget_Category] ON [dbo].[CmmsKpiTarget] ([SiteId], [Category], [IsActive]);
GO

-- CmmsKpiResult · cmms · نتیجهٔ شاخص عملکرد نت
IF OBJECT_ID('dbo.CmmsKpiResult', 'U') IS NULL
CREATE TABLE [dbo].[CmmsKpiResult] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [KpiTargetId] NVARCHAR(60) NOT NULL,
  [AssetId] NVARCHAR(60) NULL,
  [FamilyId] NVARCHAR(60) NULL,
  [PeriodType] NVARCHAR(16) NOT NULL,
  [PeriodStart] DATE NOT NULL,
  [PeriodEnd] DATE NOT NULL,
  [ActualValue] DECIMAL(18,6) NOT NULL,
  [TargetValue] DECIMAL(18,4) NULL,
  [VariancePct] DECIMAL(9,4) NULL,
  [Health] NVARCHAR(16) NOT NULL DEFAULT 'green',
  [ComputedBy] NVARCHAR(40) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsKpiResult] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsKpiResult_KpiTargetId] FOREIGN KEY ([KpiTargetId]) REFERENCES [dbo].[CmmsKpiTarget] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsKpiResult_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsKpiResult_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_CmmsKpiResult_Health] CHECK (Health IN ('green','amber','red')),
  CONSTRAINT [CK_CmmsKpiResult_Dates] CHECK (PeriodEnd >= PeriodStart)
);
CREATE UNIQUE INDEX [UX_CmmsKpiResult_Key] ON [dbo].[CmmsKpiResult] ([KpiTargetId], [AssetId], [FamilyId], [PeriodType], [PeriodStart]) WHERE [AssetId] IS NOT NULL AND [FamilyId] IS NOT NULL;
CREATE INDEX [IX_CmmsKpiResult_Health] ON [dbo].[CmmsKpiResult] ([SiteId], [Health], [PeriodEnd]);
GO

-- CmmsAlert · cmms · هشدار و اعلان نت
IF OBJECT_ID('dbo.CmmsAlert', 'U') IS NULL
CREATE TABLE [dbo].[CmmsAlert] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AlertCode] NVARCHAR(60) NOT NULL,
  [Severity] NVARCHAR(16) NOT NULL,
  [Category] NVARCHAR(28) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [MessageFa] NVARCHAR(2000) NULL,
  [AssetId] NVARCHAR(60) NULL,
  [FamilyId] NVARCHAR(60) NULL,
  [WorkOrderId] NVARCHAR(60) NULL,
  [ConditionReadingId] NVARCHAR(60) NULL,
  [AiRecommendationId] NVARCHAR(60) NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'open',
  [RaisedAt] DATETIME2 NOT NULL,
  [AcknowledgedAt] DATETIME2 NULL,
  [AcknowledgedById] NVARCHAR(60) NULL,
  [ResolvedAt] DATETIME2 NULL,
  [ResolutionNoteFa] NVARCHAR(1000) NULL,
  [NotifyInApp] BIT NOT NULL DEFAULT 1,
  [NotifyEmail] BIT NOT NULL DEFAULT 0,
  [NotifySms] BIT NOT NULL DEFAULT 0,
  [DeliveredToJson] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsAlert] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsAlert_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAlert_FamilyId] FOREIGN KEY ([FamilyId]) REFERENCES [dbo].[CmmsFamily] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAlert_WorkOrderId] FOREIGN KEY ([WorkOrderId]) REFERENCES [dbo].[CmmsWorkOrder] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAlert_ConditionReadingId] FOREIGN KEY ([ConditionReadingId]) REFERENCES [dbo].[CmmsConditionReading] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsAlert_Severity] CHECK (Severity IN ('critical','high','medium','low')),
  CONSTRAINT [CK_CmmsAlert_Category] CHECK (Category IN ('condition','pm-due','pm-overdue','spare-shortage','sla-breach','safety','reliability','ai-insight')),
  CONSTRAINT [CK_CmmsAlert_Status] CHECK (Status IN ('open','acknowledged','resolved','suppressed')),
  CONSTRAINT [CK_CmmsAlert_Ack] CHECK (Status NOT IN ('acknowledged','resolved') OR AcknowledgedAt IS NOT NULL)
);
CREATE INDEX [IX_CmmsAlert_Status] ON [dbo].[CmmsAlert] ([SiteId], [Status], [Severity]);
CREATE INDEX [IX_CmmsAlert_Asset] ON [dbo].[CmmsAlert] ([SiteId], [AssetId], [RaisedAt]);
CREATE INDEX [IX_CmmsAlert_Category] ON [dbo].[CmmsAlert] ([SiteId], [Category], [Status]);
CREATE UNIQUE INDEX [UX_CmmsAlert_Code] ON [dbo].[CmmsAlert] ([SiteId], [AlertCode], [RaisedAt]);
GO

-- CmmsAiRun · cmms · اجرای موتور هوش مصنوعی نت
IF OBJECT_ID('dbo.CmmsAiRun', 'U') IS NULL
CREATE TABLE [dbo].[CmmsAiRun] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [Engine] NVARCHAR(32) NOT NULL,
  [EngineVersion] NVARCHAR(40) NOT NULL,
  [RanAt] DATETIME2 NOT NULL,
  [RanById] NVARCHAR(60) NULL,
  [SubjectEntity] NVARCHAR(60) NULL,
  [SubjectId] NVARCHAR(60) NULL,
  [InputSnapshotJson] NVARCHAR(MAX) NULL,
  [OutputSummaryJson] NVARCHAR(MAX) NULL,
  [RecommendationCount] INT NOT NULL DEFAULT 0,
  [ElapsedMilliseconds] DECIMAL(12,2) NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'succeeded',
  [ErrorMessageFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsAiRun] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_CmmsAiRun_Engine] CHECK (Engine IN ('failure-analysis','pm-optimization','repair-guidance','tree-generator','smart-scheduler')),
  CONSTRAINT [CK_CmmsAiRun_Status] CHECK (Status IN ('succeeded','failed','partial')),
  CONSTRAINT [CK_CmmsAiRun_Count] CHECK (RecommendationCount >= 0)
);
CREATE INDEX [IX_CmmsAiRun_Engine] ON [dbo].[CmmsAiRun] ([SiteId], [Engine], [RanAt]);
CREATE INDEX [IX_CmmsAiRun_Subject] ON [dbo].[CmmsAiRun] ([SiteId], [SubjectEntity], [SubjectId]);
GO

-- CmmsAiRecommendation · cmms · پیشنهاد هوش مصنوعی نت
IF OBJECT_ID('dbo.CmmsAiRecommendation', 'U') IS NULL
CREATE TABLE [dbo].[CmmsAiRecommendation] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [AiRunId] NVARCHAR(60) NOT NULL,
  [Engine] NVARCHAR(32) NOT NULL,
  [RecommendationType] NVARCHAR(32) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [ExplanationFa] NVARCHAR(2000) NULL,
  [Confidence] DECIMAL(8,4) NULL,
  [Priority] INT NOT NULL DEFAULT 3,
  [AssetId] NVARCHAR(60) NULL,
  [FamilyId] NVARCHAR(60) NULL,
  [WorkOrderId] NVARCHAR(60) NULL,
  [SparePartId] NVARCHAR(60) NULL,
  [TechnicianId] NVARCHAR(60) NULL,
  [SuggestedValueJson] NVARCHAR(MAX) NULL,
  [EvidenceJson] NVARCHAR(MAX) NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'proposed',
  [DecidedById] NVARCHAR(60) NULL,
  [DecidedAt] DATETIME2 NULL,
  [DecisionNoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsAiRecommendation] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsAiRecommendation_AiRunId] FOREIGN KEY ([AiRunId]) REFERENCES [dbo].[CmmsAiRun] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAiRecommendation_AssetId] FOREIGN KEY ([AssetId]) REFERENCES [dbo].[CmmsAsset] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsAiRecommendation_SparePartId] FOREIGN KEY ([SparePartId]) REFERENCES [dbo].[CmmsSparePart] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsAiRecommendation_TechnicianId] FOREIGN KEY ([TechnicianId]) REFERENCES [dbo].[CmmsTechnician] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsAiRecommendation_Confidence] CHECK (Confidence IS NULL OR (Confidence >= 0 AND Confidence <= 1)),
  CONSTRAINT [CK_CmmsAiRecommendation_Priority] CHECK (Priority BETWEEN 1 AND 5),
  CONSTRAINT [CK_CmmsAiRecommendation_Status] CHECK (Status IN ('proposed','accepted','rejected','applied')),
  CONSTRAINT [CK_CmmsAiRecommendation_Type] CHECK (RecommendationType IN ('root-cause','pm-interval','repair-action','spare-needed','tree-node','schedule-slot')),
  CONSTRAINT [CK_CmmsAiRecommendation_Decide] CHECK (Status IN ('proposed','rejected') OR DecidedAt IS NOT NULL)
);
CREATE INDEX [IX_CmmsAiRecommendation_Run] ON [dbo].[CmmsAiRecommendation] ([AiRunId], [Priority]);
CREATE INDEX [IX_CmmsAiRecommendation_Asset] ON [dbo].[CmmsAiRecommendation] ([SiteId], [AssetId], [Status]);
CREATE INDEX [IX_CmmsAiRecommendation_Engine] ON [dbo].[CmmsAiRecommendation] ([SiteId], [Engine], [RecommendationType]);
GO

-- CmmsIntegrationEvent · cmms · رویداد یکپارچگی بین‌بخشی (صف خروجی)
IF OBJECT_ID('dbo.CmmsIntegrationEvent', 'U') IS NULL
CREATE TABLE [dbo].[CmmsIntegrationEvent] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [EventType] NVARCHAR(40) NOT NULL,
  [TargetSystem] NVARCHAR(24) NOT NULL,
  [TargetRef] NVARCHAR(120) NULL,
  [SourceTable] NVARCHAR(60) NOT NULL,
  [SourceId] NVARCHAR(60) NOT NULL,
  [Contract] NVARCHAR(40) NOT NULL DEFAULT 'cmms-mes-v1',
  [IdempotencyKey] NVARCHAR(200) NOT NULL,
  [CorrelationId] NVARCHAR(80) NULL,
  [PayloadJson] NVARCHAR(MAX) NULL,
  [OccurredAt] DATETIME2 NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'pending',
  [Attempts] INT NOT NULL DEFAULT 0,
  [LastAttemptAt] DATETIME2 NULL,
  [AcknowledgedAt] DATETIME2 NULL,
  [ExternalRef] NVARCHAR(120) NULL,
  [AckPayloadJson] NVARCHAR(MAX) NULL,
  [LastErrorCode] NVARCHAR(60) NULL,
  [LastErrorFa] NVARCHAR(1000) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsIntegrationEvent] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_CmmsIntegrationEvent_Type] CHECK (EventType IN ('downtime.started','downtime.finished','downtime.reported','capacity.block.requested','capacity.block.released')),
  CONSTRAINT [CK_CmmsIntegrationEvent_Target] CHECK (TargetSystem IN ('mes')),
  CONSTRAINT [CK_CmmsIntegrationEvent_Status] CHECK (Status IN ('pending','published','acknowledged','failed','cancelled')),
  CONSTRAINT [CK_CmmsIntegrationEvent_Attempts] CHECK (Attempts >= 0)
);
CREATE UNIQUE INDEX [UX_CmmsIntegrationEvent_Idem] ON [dbo].[CmmsIntegrationEvent] ([SiteId], [IdempotencyKey]);
CREATE INDEX [IX_CmmsIntegrationEvent_Status] ON [dbo].[CmmsIntegrationEvent] ([SiteId], [Status], [OccurredAt]);
CREATE INDEX [IX_CmmsIntegrationEvent_Source] ON [dbo].[CmmsIntegrationEvent] ([SiteId], [SourceTable], [SourceId]);
GO

-- CmmsWorkOrderHold · cmms · توقف دستورکار (Hold)
IF OBJECT_ID('dbo.CmmsWorkOrderHold', 'U') IS NULL
CREATE TABLE [dbo].[CmmsWorkOrderHold] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [WorkOrderId] NVARCHAR(60) NOT NULL,
  [HoldReasonCode] NVARCHAR(40) NOT NULL,
  [HoldCategory] NVARCHAR(24) NOT NULL,
  [DowntimeType] NVARCHAR(16) NOT NULL,
  [PreviousStatus] NVARCHAR(28) NOT NULL,
  [HoldReasonFa] NVARCHAR(1000) NOT NULL,
  [NoteFa] NVARCHAR(2000) NULL,
  [HeldAt] DATETIME2 NOT NULL,
  [HeldBy] NVARCHAR(60) NOT NULL,
  [ExpectedResumeAt] DATETIME2 NULL,
  [HoldStatus] NVARCHAR(16) NOT NULL DEFAULT 'open',
  [ResumedAt] DATETIME2 NULL,
  [ResumedBy] NVARCHAR(60) NULL,
  [ResumeNoteFa] NVARCHAR(1000) NULL,
  [ResumedVia] NVARCHAR(24) NULL,
  [DurationMinutes] INT NULL,
  [DowntimeEventId] NVARCHAR(60) NULL,
  [WorkCenterRef] NVARCHAR(60) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsWorkOrderHold] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsWorkOrderHold_WorkOrderId] FOREIGN KEY ([WorkOrderId]) REFERENCES [dbo].[CmmsWorkOrder] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsWorkOrderHold_DowntimeEventId] FOREIGN KEY ([DowntimeEventId]) REFERENCES [dbo].[CmmsIntegrationEvent] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsWorkOrderHold_Category] CHECK (HoldCategory IN ('material','labor','permit','schedule','safety','machine','process','other')),
  CONSTRAINT [CK_CmmsWorkOrderHold_DowntimeType] CHECK (DowntimeType IN ('planned','unplanned')),
  CONSTRAINT [CK_CmmsWorkOrderHold_Status] CHECK (HoldStatus IN ('open','resumed','cancelled')),
  CONSTRAINT [CK_CmmsWorkOrderHold_Previous] CHECK (PreviousStatus IN ('draft','planned','scheduled','released','in-progress')),
  CONSTRAINT [CK_CmmsWorkOrderHold_Open] CHECK (HoldStatus <> 'open' OR ResumedAt IS NULL),
  CONSTRAINT [CK_CmmsWorkOrderHold_Window] CHECK (ResumedAt IS NULL OR ResumedAt >= HeldAt),
  CONSTRAINT [CK_CmmsWorkOrderHold_Duration] CHECK (DurationMinutes IS NULL OR DurationMinutes >= 0)
);
CREATE INDEX [IX_CmmsWorkOrderHold_Wo] ON [dbo].[CmmsWorkOrderHold] ([SiteId], [WorkOrderId], [HoldStatus]);
CREATE INDEX [IX_CmmsWorkOrderHold_Reason] ON [dbo].[CmmsWorkOrderHold] ([SiteId], [HoldReasonCode], [HeldAt]);
CREATE INDEX [IX_CmmsWorkOrderHold_Open] ON [dbo].[CmmsWorkOrderHold] ([SiteId], [HoldStatus], [HeldAt]);
GO

-- CmmsRcfaCause · cmms · علت تحلیل ریشه‌ای (استخوان‌ماهی/پارتو)
IF OBJECT_ID('dbo.CmmsRcfaCause', 'U') IS NULL
CREATE TABLE [dbo].[CmmsRcfaCause] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [RcaCaseId] NVARCHAR(60) NOT NULL,
  [ParentCauseId] NVARCHAR(60) NULL,
  [Category] NVARCHAR(24) NOT NULL,
  [StatementFa] NVARCHAR(1200) NOT NULL,
  [OccurrenceCount] INT NOT NULL DEFAULT 0,
  [ImpactScore] INT NOT NULL DEFAULT 5,
  [DetectionScore] INT NULL,
  [IsRootCause] BIT NOT NULL DEFAULT 0,
  [EvidenceRef] NVARCHAR(600) NULL,
  [VerifiedBy] NVARCHAR(60) NULL,
  [VerifiedAt] DATETIME2 NULL,
  [SourceEntryId] NVARCHAR(60) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsRcfaCause] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsRcfaCause_RcaCaseId] FOREIGN KEY ([RcaCaseId]) REFERENCES [dbo].[CmmsRcaCase] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsRcfaCause_ParentCauseId] FOREIGN KEY ([ParentCauseId]) REFERENCES [dbo].[CmmsRcfaCause] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_CmmsRcfaCause_Category] CHECK (Category IN ('man','machine','method','material','measurement','environment')),
  CONSTRAINT [CK_CmmsRcfaCause_Occurrence] CHECK (OccurrenceCount >= 0),
  CONSTRAINT [CK_CmmsRcfaCause_Impact] CHECK (ImpactScore >= 1 AND ImpactScore <= 10),
  CONSTRAINT [CK_CmmsRcfaCause_Detection] CHECK (DetectionScore IS NULL OR (DetectionScore >= 1 AND DetectionScore <= 10)),
  CONSTRAINT [CK_CmmsRcfaCause_Self] CHECK (ParentCauseId IS NULL OR ParentCauseId <> Id)
);
CREATE INDEX [IX_CmmsRcfaCause_Case] ON [dbo].[CmmsRcfaCause] ([SiteId], [RcaCaseId], [Category]);
CREATE INDEX [IX_CmmsRcfaCause_Root] ON [dbo].[CmmsRcfaCause] ([SiteId], [RcaCaseId], [IsRootCause]);
CREATE INDEX [IX_CmmsRcfaCause_Branch] ON [dbo].[CmmsRcfaCause] ([SiteId], [ParentCauseId]);
GO

-- CmmsRcfaCapa · cmms · اقدام اصلاحی و پیشگیرانه (CAPA)
IF OBJECT_ID('dbo.CmmsRcfaCapa', 'U') IS NULL
CREATE TABLE [dbo].[CmmsRcfaCapa] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [RcaCaseId] NVARCHAR(60) NOT NULL,
  [RootCauseId] NVARCHAR(60) NULL,
  [RootCauseRef] NVARCHAR(60) NULL,
  [RootCauseFa] NVARCHAR(1200) NULL,
  [ActionType] NVARCHAR(24) NOT NULL,
  [StatementFa] NVARCHAR(1500) NOT NULL,
  [Priority] INT NOT NULL DEFAULT 3,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [OwnerUserId] NVARCHAR(60) NULL,
  [OwnerNameFa] NVARCHAR(120) NULL,
  [DueOn] DATE NOT NULL,
  [ImplementedAt] DATETIME2 NULL,
  [ImplementedBy] NVARCHAR(60) NULL,
  [ImplementationEvidenceRef] NVARCHAR(600) NULL,
  [VerificationResult] NVARCHAR(24) NULL,
  [VerifiedAt] DATETIME2 NULL,
  [VerifiedBy] NVARCHAR(60) NULL,
  [VerificationNoteFa] NVARCHAR(1000) NULL,
  [ReferralKind] NVARCHAR(24) NULL,
  [WorkOrderId] NVARCHAR(60) NULL,
  [AutoCreatedWorkOrder] BIT NOT NULL DEFAULT 0,
  [EffectivenessVerifiedOn] DATE NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsRcfaCapa] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsRcfaCapa_RcaCaseId] FOREIGN KEY ([RcaCaseId]) REFERENCES [dbo].[CmmsRcaCase] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_CmmsRcfaCapa_RootCauseId] FOREIGN KEY ([RootCauseId]) REFERENCES [dbo].[CmmsRcfaCause] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_CmmsRcfaCapa_WorkOrderId] FOREIGN KEY ([WorkOrderId]) REFERENCES [dbo].[CmmsWorkOrder] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsRcfaCapa_Action] CHECK (ActionType IN ('containment','corrective','preventive','detection','systemic')),
  CONSTRAINT [CK_CmmsRcfaCapa_Status] CHECK (Status IN ('draft','assigned','in-progress','implemented','verified','closed','cancelled')),
  CONSTRAINT [CK_CmmsRcfaCapa_Verify] CHECK (VerificationResult IS NULL OR VerificationResult IN ('effective','partially-effective','ineffective')),
  CONSTRAINT [CK_CmmsRcfaCapa_Referral] CHECK (ReferralKind IS NULL OR ReferralKind IN ('work-order','owner','vendor','procedure','training')),
  CONSTRAINT [CK_CmmsRcfaCapa_Priority] CHECK (Priority BETWEEN 1 AND 5),
  CONSTRAINT [CK_CmmsRcfaCapa_Done] CHECK (Status NOT IN ('implemented','verified','closed') OR ImplementedAt IS NOT NULL),
  CONSTRAINT [CK_CmmsRcfaCapa_Verified] CHECK (Status <> 'verified' OR VerificationResult IS NOT NULL)
);
CREATE INDEX [IX_CmmsRcfaCapa_Case] ON [dbo].[CmmsRcfaCapa] ([SiteId], [RcaCaseId], [Status]);
CREATE INDEX [IX_CmmsRcfaCapa_Owner] ON [dbo].[CmmsRcfaCapa] ([OwnerUserId], [DueOn]);
CREATE INDEX [IX_CmmsRcfaCapa_WorkOrder] ON [dbo].[CmmsRcfaCapa] ([WorkOrderId]);
GO

-- CmmsCapacityBlock · cmms · بلوکه‌سازی نرم ظرفیت مرکز کاری
IF OBJECT_ID('dbo.CmmsCapacityBlock', 'U') IS NULL
CREATE TABLE [dbo].[CmmsCapacityBlock] (
  [Id] NVARCHAR(60) NOT NULL,
  [SiteId] NVARCHAR(60) NOT NULL,
  [BlockNo] NVARCHAR(60) NOT NULL,
  [PlantRef] NVARCHAR(60) NULL,
  [WorkCenterRef] NVARCHAR(60) NOT NULL,
  [SourceType] NVARCHAR(24) NOT NULL,
  [SourceRef] NVARCHAR(60) NULL,
  [WindowStart] DATETIME2 NOT NULL,
  [WindowEnd] DATETIME2 NOT NULL,
  [ReservedMinutes] INT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'requested',
  [ReasonFa] NVARCHAR(1000) NOT NULL,
  [IsSoft] BIT NOT NULL DEFAULT 1,
  [RequestedAt] DATETIME2 NOT NULL,
  [RequestedBy] NVARCHAR(60) NOT NULL,
  [AcknowledgedAt] DATETIME2 NULL,
  [ExternalRef] NVARCHAR(120) NULL,
  [IntegrationEventId] NVARCHAR(60) NULL,
  [ReleasedAt] DATETIME2 NULL,
  [ReleasedBy] NVARCHAR(60) NULL,
  [ReleaseReasonFa] NVARCHAR(1000) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_CmmsCapacityBlock] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_CmmsCapacityBlock_IntegrationEventId] FOREIGN KEY ([IntegrationEventId]) REFERENCES [dbo].[CmmsIntegrationEvent] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_CmmsCapacityBlock_Source] CHECK (SourceType IN ('pm-schedule','work-order','shutdown','manual')),
  CONSTRAINT [CK_CmmsCapacityBlock_Status] CHECK (Status IN ('requested','active','released','rejected','cancelled')),
  CONSTRAINT [CK_CmmsCapacityBlock_Window] CHECK (WindowEnd > WindowStart),
  CONSTRAINT [CK_CmmsCapacityBlock_Minutes] CHECK (ReservedMinutes >= 0),
  CONSTRAINT [CK_CmmsCapacityBlock_Release] CHECK (Status <> 'released' OR ReleasedAt IS NOT NULL)
);
CREATE UNIQUE INDEX [UX_CmmsCapacityBlock_No] ON [dbo].[CmmsCapacityBlock] ([SiteId], [BlockNo]);
CREATE INDEX [IX_CmmsCapacityBlock_Wc] ON [dbo].[CmmsCapacityBlock] ([SiteId], [WorkCenterRef], [WindowStart]);
CREATE INDEX [IX_CmmsCapacityBlock_Status] ON [dbo].[CmmsCapacityBlock] ([SiteId], [Status], [WindowStart]);
GO

-- IotDrillingRig · iiot · دکل حفاری و جریان عملیات
IF OBJECT_ID('dbo.IotDrillingRig', 'U') IS NULL
CREATE TABLE [dbo].[IotDrillingRig] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [RigNo] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [RigType] NVARCHAR(24) NOT NULL,
  [OwnerFa] NVARCHAR(240) NULL,
  [DrillingContractorFa] NVARCHAR(240) NULL,
  [CmmsSiteRef] NVARCHAR(60) NULL,
  [PmisProjectRef] NVARCHAR(60) NULL,
  [MesWorkCenterRef] NVARCHAR(60) NULL,
  [FieldName] NVARCHAR(160) NULL,
  [WellName] NVARCHAR(160) NULL,
  [SpudDate] DATE NULL,
  [TargetDepthM] DECIMAL(12,2) NULL,
  [CurrentDepthM] DECIMAL(12,2) NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'drilling',
  [Latitude] DECIMAL(10,6) NULL,
  [Longitude] DECIMAL(10,6) NULL,
  [TimeZoneId] NVARCHAR(80) NULL DEFAULT 'Asia/Tehran',
  [NominalSampleRateHz] INT NOT NULL DEFAULT 1,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotDrillingRig] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_IotDrillingRig_Type] CHECK (RigType IN ('land','jackup','semi-submersible','platform','workover','coiled-tubing')),
  CONSTRAINT [CK_IotDrillingRig_Status] CHECK (Status IN ('mobilizing','drilling','tripping','cementing','completion','workover','stacked','demobilized')),
  CONSTRAINT [CK_IotDrillingRig_Rate] CHECK (NominalSampleRateHz >= 1)
);
CREATE UNIQUE INDEX [UX_IotDrillingRig_RigId] ON [dbo].[IotDrillingRig] ([RigId]);
CREATE UNIQUE INDEX [UX_IotDrillingRig_No] ON [dbo].[IotDrillingRig] ([RigNo]);
CREATE INDEX [IX_IotDrillingRig_Status] ON [dbo].[IotDrillingRig] ([Status], [IsActive]);
GO

-- IotEdgeGateway · iiot · گیت‌وی لبه (Edge Gateway)
IF OBJECT_ID('dbo.IotEdgeGateway', 'U') IS NULL
CREATE TABLE [dbo].[IotEdgeGateway] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [GatewayCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [Protocol] NVARCHAR(24) NOT NULL,
  [FirmwareVersion] NVARCHAR(60) NULL,
  [IpAddress] NVARCHAR(60) NULL,
  [LocationFa] NVARCHAR(240) NULL,
  [SyncMode] NVARCHAR(24) NOT NULL DEFAULT 'store-forward',
  [BufferCapacity] INT NOT NULL DEFAULT 100000,
  [BufferUsed] INT NOT NULL DEFAULT 0,
  [MaxBatchSize] INT NOT NULL DEFAULT 1000,
  [MaxAttempts] INT NOT NULL DEFAULT 5,
  [ConnectionState] NVARCHAR(16) NOT NULL DEFAULT 'offline',
  [LastHeartbeatAt] DATETIME2 NULL,
  [LastSyncAt] DATETIME2 NULL,
  [HeartbeatIntervalSeconds] INT NULL,
  [InstalledAt] DATETIME2 NOT NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [AuthMode] NVARCHAR(24) NULL DEFAULT 'token',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotEdgeGateway] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_IotEdgeGateway_Protocol] CHECK (Protocol IN ('mqtt','opc-ua','modbus','witsml','http')),
  CONSTRAINT [CK_IotEdgeGateway_Sync] CHECK (SyncMode IN ('realtime','store-forward','batch')),
  CONSTRAINT [CK_IotEdgeGateway_State] CHECK (ConnectionState IN ('online','degraded','offline')),
  CONSTRAINT [CK_IotEdgeGateway_Buffer] CHECK (BufferUsed >= 0 AND BufferUsed <= BufferCapacity),
  CONSTRAINT [CK_IotEdgeGateway_Batch] CHECK (MaxBatchSize >= 1)
);
CREATE UNIQUE INDEX [UX_IotEdgeGateway_Code] ON [dbo].[IotEdgeGateway] ([RigId], [GatewayCode]);
CREATE INDEX [IX_IotEdgeGateway_State] ON [dbo].[IotEdgeGateway] ([RigId], [ConnectionState], [IsActive]);
GO

-- IotSensorNode · iiot · سنسور و تگ میدان
IF OBJECT_ID('dbo.IotSensorNode', 'U') IS NULL
CREATE TABLE [dbo].[IotSensorNode] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [SensorTag] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [SensorType] NVARCHAR(40) NOT NULL,
  [Manufacturer] NVARCHAR(160) NULL,
  [ModelNo] NVARCHAR(120) NULL,
  [SerialNo] NVARCHAR(120) NULL,
  [RangeMin] DECIMAL(18,4) NULL,
  [RangeMax] DECIMAL(18,4) NULL,
  [Unit] NVARCHAR(24) NULL,
  [AccuracyPct] DECIMAL(9,4) NULL,
  [LocationFa] NVARCHAR(240) NULL,
  [GatewayId] NVARCHAR(60) NULL,
  [InstalledAt] DATETIME2 NULL,
  [LastCalibratedAt] DATETIME2 NULL,
  [NextCalibrationDue] DATE NULL,
  [CalibrationIntervalDays] INT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'active',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotSensorNode] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_IotSensorNode_GatewayId] FOREIGN KEY ([GatewayId]) REFERENCES [dbo].[IotEdgeGateway] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_IotSensorNode_Status] CHECK (Status IN ('active','faulty','calibration-due','removed')),
  CONSTRAINT [CK_IotSensorNode_Range] CHECK (RangeMin IS NULL OR RangeMax IS NULL OR RangeMax > RangeMin)
);
CREATE UNIQUE INDEX [UX_IotSensorNode_Tag] ON [dbo].[IotSensorNode] ([RigId], [SensorTag]);
CREATE INDEX [IX_IotSensorNode_Status] ON [dbo].[IotSensorNode] ([RigId], [Status]);
CREATE INDEX [IX_IotSensorNode_Calibration] ON [dbo].[IotSensorNode] ([RigId], [NextCalibrationDue]);
GO

-- IotDrillingRigStream · iiot · جریان تله‌متری دکل
IF OBJECT_ID('dbo.IotDrillingRigStream', 'U') IS NULL
CREATE TABLE [dbo].[IotDrillingRigStream] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [StreamCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [SourceSystem] NVARCHAR(24) NOT NULL,
  [GatewayId] NVARCHAR(60) NULL,
  [TransportProtocol] NVARCHAR(24) NOT NULL,
  [SampleRateHz] INT NOT NULL DEFAULT 1,
  [BatchSize] INT NOT NULL DEFAULT 100,
  [ConnectionState] NVARCHAR(16) NOT NULL DEFAULT 'offline',
  [LastSampleAt] DATETIME2 NULL,
  [LastSeqNo] BIGINT NULL,
  [QualityPct] DECIMAL(9,4) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [WitsmlMnemonicMapJson] NVARCHAR(MAX) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotDrillingRigStream] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_IotDrillingRigStream_GatewayId] FOREIGN KEY ([GatewayId]) REFERENCES [dbo].[IotEdgeGateway] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_IotRigStream_Source] CHECK (SourceSystem IN ('witsml','mudlogger','plc','scada','edge','manual')),
  CONSTRAINT [CK_IotRigStream_Protocol] CHECK (TransportProtocol IN ('mqtt','opc-ua','modbus','witsml','http')),
  CONSTRAINT [CK_IotRigStream_Rate] CHECK (SampleRateHz >= 1),
  CONSTRAINT [CK_IotRigStream_State] CHECK (ConnectionState IN ('online','degraded','offline'))
);
CREATE UNIQUE INDEX [UX_IotRigStream_Code] ON [dbo].[IotDrillingRigStream] ([RigId], [StreamCode]);
CREATE INDEX [IX_IotRigStream_State] ON [dbo].[IotDrillingRigStream] ([RigId], [ConnectionState], [IsActive]);
CREATE INDEX [IX_IotRigStream_Gateway] ON [dbo].[IotDrillingRigStream] ([GatewayId]);
GO

-- IotDasChannel · iiot · کانال سیگنال حفاری (DAS)
IF OBJECT_ID('dbo.IotDasChannel', 'U') IS NULL
CREATE TABLE [dbo].[IotDasChannel] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [StreamId] NVARCHAR(60) NULL,
  [ChannelCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [SignalType] NVARCHAR(32) NOT NULL,
  [Unit] NVARCHAR(24) NOT NULL,
  [NominalMin] DECIMAL(18,4) NULL,
  [NominalMax] DECIMAL(18,4) NULL,
  [NominalValue] DECIMAL(18,4) NULL,
  [DisplayMin] DECIMAL(18,4) NULL,
  [DisplayMax] DECIMAL(18,4) NULL,
  [SampleRateHz] INT NOT NULL DEFAULT 1,
  [FilterMethod] NVARCHAR(16) NOT NULL DEFAULT 'sma',
  [FilterWindowSeconds] INT NOT NULL DEFAULT 10,
  [DeadbandPct] DECIMAL(9,4) NULL,
  [SensorTag] NVARCHAR(60) NULL,
  [WitsmlMnemonic] NVARCHAR(80) NULL,
  [IsCritical] BIT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [InstalledLocationFa] NVARCHAR(240) NULL,
  [CalibratedAt] DATETIME2 NULL,
  [NextCalibrationDue] DATE NULL,
  [LastValueAt] DATETIME2 NULL,
  [LastValue] DECIMAL(18,6) NULL,
  [LastQuality] NVARCHAR(16) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotDasChannel] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_IotDasChannel_StreamId] FOREIGN KEY ([StreamId]) REFERENCES [dbo].[IotDrillingRigStream] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_IotDasChannel_Signal] CHECK (SignalType IN ('wob','rpm','torque','mud-pump-pressure','flow-rate','temperature','vibration','rop','depth','standpipe-pressure','hookload','gas')),
  CONSTRAINT [CK_IotDasChannel_Filter] CHECK (FilterMethod IN ('none','sma','ema','median')),
  CONSTRAINT [CK_IotDasChannel_Window] CHECK (FilterWindowSeconds >= 1),
  CONSTRAINT [CK_IotDasChannel_Rate] CHECK (SampleRateHz >= 1),
  CONSTRAINT [CK_IotDasChannel_Display] CHECK (DisplayMin IS NULL OR DisplayMax IS NULL OR DisplayMax > DisplayMin),
  CONSTRAINT [CK_IotDasChannel_Deadband] CHECK (DeadbandPct IS NULL OR DeadbandPct >= 0)
);
CREATE UNIQUE INDEX [UX_IotDasChannel_Code] ON [dbo].[IotDasChannel] ([RigId], [ChannelCode]);
CREATE INDEX [IX_IotDasChannel_Signal] ON [dbo].[IotDasChannel] ([RigId], [SignalType], [IsActive]);
CREATE INDEX [IX_IotDasChannel_Stream] ON [dbo].[IotDasChannel] ([StreamId], [IsActive]);
GO

-- IotGatewayBuffer · iiot · بافر لبه (Store-and-Forward)
IF OBJECT_ID('dbo.IotGatewayBuffer', 'U') IS NULL
CREATE TABLE [dbo].[IotGatewayBuffer] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [GatewayId] NVARCHAR(60) NULL,
  [BatchNo] NVARCHAR(80) NOT NULL,
  [CapturedAt] DATETIME2 NOT NULL,
  [FromAt] DATETIME2 NOT NULL,
  [ToAt] DATETIME2 NOT NULL,
  [SampleCount] INT NOT NULL DEFAULT 0,
  [PayloadJson] NVARCHAR(MAX) NOT NULL,
  [Checksum] NVARCHAR(80) NOT NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'buffered',
  [Attempts] INT NOT NULL DEFAULT 0,
  [MaxAttempts] INT NOT NULL DEFAULT 5,
  [LastAttemptAt] DATETIME2 NULL,
  [SentAt] DATETIME2 NULL,
  [AckRef] NVARCHAR(120) NULL,
  [ErrorCode] NVARCHAR(60) NULL,
  [ErrorFa] NVARCHAR(600) NULL,
  [ConnectivityState] NVARCHAR(24) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotGatewayBuffer] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_IotGatewayBuffer_GatewayId] FOREIGN KEY ([GatewayId]) REFERENCES [dbo].[IotEdgeGateway] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_IotGatewayBuffer_Status] CHECK (Status IN ('buffered','sending','sent','failed','dead-letter')),
  CONSTRAINT [CK_IotGatewayBuffer_Window] CHECK (ToAt >= FromAt),
  CONSTRAINT [CK_IotGatewayBuffer_Attempts] CHECK (Attempts >= 0 AND Attempts <= MaxAttempts)
);
CREATE UNIQUE INDEX [UX_IotGatewayBuffer_Batch] ON [dbo].[IotGatewayBuffer] ([GatewayId], [BatchNo]) WHERE [GatewayId] IS NOT NULL;
CREATE INDEX [IX_IotGatewayBuffer_Status] ON [dbo].[IotGatewayBuffer] ([RigId], [Status], [CapturedAt]);
GO

-- IotTelemetrySample · iiot · نمونهٔ تله‌متری
IF OBJECT_ID('dbo.IotTelemetrySample', 'U') IS NULL
CREATE TABLE [dbo].[IotTelemetrySample] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [StreamId] NVARCHAR(60) NULL,
  [ChannelId] NVARCHAR(60) NULL,
  [SampledAt] DATETIME2 NOT NULL,
  [Value] DECIMAL(18,6) NOT NULL,
  [RawValue] DECIMAL(18,6) NULL,
  [FilteredValue] DECIMAL(18,6) NULL,
  [Unit] NVARCHAR(24) NULL,
  [SeqNo] BIGINT NULL,
  [Quality] NVARCHAR(16) NOT NULL DEFAULT 'good',
  [Source] NVARCHAR(16) NOT NULL DEFAULT 'live',
  [GatewayId] NVARCHAR(60) NULL,
  [BufferId] NVARCHAR(60) NULL,
  [BatchNo] NVARCHAR(80) NULL,
  [IngestedAt] DATETIME2 NOT NULL,
  [IsFlagged] BIT NOT NULL DEFAULT 0,
  [QualityReasonFa] NVARCHAR(240) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotTelemetrySample] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_IotTelemetrySample_StreamId] FOREIGN KEY ([StreamId]) REFERENCES [dbo].[IotDrillingRigStream] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_IotTelemetrySample_ChannelId] FOREIGN KEY ([ChannelId]) REFERENCES [dbo].[IotDasChannel] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_IotTelemetrySample_GatewayId] FOREIGN KEY ([GatewayId]) REFERENCES [dbo].[IotEdgeGateway] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [FK_IotTelemetrySample_BufferId] FOREIGN KEY ([BufferId]) REFERENCES [dbo].[IotGatewayBuffer] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_IotSample_Quality] CHECK (Quality IN ('good','suspect','bad','stale')),
  CONSTRAINT [CK_IotSample_Source] CHECK (Source IN ('live','buffer','replay','simulated','manual'))
);
CREATE INDEX [IX_IotSample_ChannelTime] ON [dbo].[IotTelemetrySample] ([ChannelId], [SampledAt]);
CREATE INDEX [IX_IotSample_RigTime] ON [dbo].[IotTelemetrySample] ([RigId], [SampledAt]);
CREATE INDEX [IX_IotSample_Quality] ON [dbo].[IotTelemetrySample] ([RigId], [Quality], [SampledAt]);
CREATE INDEX [IX_IotSample_Buffer] ON [dbo].[IotTelemetrySample] ([BufferId], [SampledAt]);
GO

-- IotTelemetryRollup · iiot · تجمیع سری زمانی
IF OBJECT_ID('dbo.IotTelemetryRollup', 'U') IS NULL
CREATE TABLE [dbo].[IotTelemetryRollup] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [ChannelId] NVARCHAR(60) NULL,
  [BucketSeconds] INT NOT NULL,
  [BucketStart] DATETIME2 NOT NULL,
  [SampleCount] INT NOT NULL DEFAULT 0,
  [BadCount] INT NOT NULL DEFAULT 0,
  [MinValue] DECIMAL(18,6) NULL,
  [MaxValue] DECIMAL(18,6) NULL,
  [AvgValue] DECIMAL(18,6) NULL,
  [StdDev] DECIMAL(18,6) NULL,
  [FirstValue] DECIMAL(18,6) NULL,
  [LastValue] DECIMAL(18,6) NULL,
  [QualityPct] DECIMAL(9,4) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotTelemetryRollup] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_IotTelemetryRollup_ChannelId] FOREIGN KEY ([ChannelId]) REFERENCES [dbo].[IotDasChannel] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_IotRollup_Bucket] CHECK (BucketSeconds >= 1),
  CONSTRAINT [CK_IotRollup_Count] CHECK (SampleCount >= 0 AND BadCount >= 0),
  CONSTRAINT [CK_IotRollup_MinMax] CHECK (MinValue IS NULL OR MaxValue IS NULL OR MaxValue >= MinValue)
);
CREATE UNIQUE INDEX [UX_IotRollup_Channel] ON [dbo].[IotTelemetryRollup] ([ChannelId], [BucketSeconds], [BucketStart]) WHERE [ChannelId] IS NOT NULL;
CREATE INDEX [IX_IotRollup_Rig] ON [dbo].[IotTelemetryRollup] ([RigId], [BucketStart]);
GO

-- IotSignalFilterRule · iiot · قاعدهٔ فیلترینگ سیگنال
IF OBJECT_ID('dbo.IotSignalFilterRule', 'U') IS NULL
CREATE TABLE [dbo].[IotSignalFilterRule] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [RuleCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [AppliesToSignals] NVARCHAR(400) NOT NULL,
  [FilterMethod] NVARCHAR(16) NOT NULL DEFAULT 'sma',
  [WindowSeconds] INT NOT NULL DEFAULT 10,
  [EmaAlpha] DECIMAL(9,4) NULL,
  [MinSamples] INT NOT NULL DEFAULT 5,
  [DeadbandPct] DECIMAL(9,4) NULL,
  [SpikeZThreshold] DECIMAL(9,4) NULL,
  [FlatlineSeconds] INT NOT NULL DEFAULT 60,
  [IsDefault] BIT NOT NULL DEFAULT 0,
  [Version] INT NOT NULL DEFAULT 1,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [EffectiveFrom] DATETIME2 NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotSignalFilterRule] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_IotSignalFilterRule_Method] CHECK (FilterMethod IN ('none','sma','ema','median')),
  CONSTRAINT [CK_IotSignalFilterRule_Window] CHECK (WindowSeconds >= 1),
  CONSTRAINT [CK_IotSignalFilterRule_Min] CHECK (MinSamples >= 1),
  CONSTRAINT [CK_IotSignalFilterRule_Alpha] CHECK (EmaAlpha IS NULL OR (EmaAlpha > 0 AND EmaAlpha <= 1))
);
CREATE UNIQUE INDEX [UX_IotSignalFilterRule_Code] ON [dbo].[IotSignalFilterRule] ([RigId], [RuleCode]);
CREATE INDEX [IX_IotSignalFilterRule_Active] ON [dbo].[IotSignalFilterRule] ([RigId], [IsActive]);
GO

-- IotThresholdRule · iiot · آستانهٔ هشدار چندسطحی
IF OBJECT_ID('dbo.IotThresholdRule', 'U') IS NULL
CREATE TABLE [dbo].[IotThresholdRule] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [ChannelId] NVARCHAR(60) NULL,
  [RuleCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [Level] NVARCHAR(12) NOT NULL,
  [DetectKind] NVARCHAR(24) NOT NULL DEFAULT 'threshold',
  [Comparison] NVARCHAR(16) NOT NULL DEFAULT 'gt',
  [ThresholdValue] DECIMAL(18,6) NULL,
  [SecondaryValue] DECIMAL(18,6) NULL,
  [DurationSeconds] INT NOT NULL DEFAULT 30,
  [MinSamples] INT NOT NULL DEFAULT 10,
  [HysteresisPct] DECIMAL(9,4) NULL,
  [CooldownSeconds] INT NOT NULL DEFAULT 600,
  [TorqueCvThreshold] DECIMAL(9,4) NULL,
  [RpmSwingPctThreshold] DECIMAL(9,4) NULL,
  [PressureDropPctThreshold] DECIMAL(9,4) NULL,
  [AutoDispatch] BIT NOT NULL DEFAULT 0,
  [DispatchTargets] NVARCHAR(120) NULL,
  [CmmsPriority] INT NULL,
  [CmmsSiteRef] NVARCHAR(60) NULL,
  [CmmsAssetRef] NVARCHAR(60) NULL,
  [MesWorkCenterRef] NVARCHAR(60) NULL,
  [MesPlantRef] NVARCHAR(60) NULL,
  [PmisProjectRef] NVARCHAR(60) NULL,
  [NptCode] NVARCHAR(40) NULL,
  [EscalationNoteFa] NVARCHAR(1000) NULL,
  [Version] INT NOT NULL DEFAULT 1,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [EffectiveFrom] DATETIME2 NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotThresholdRule] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_IotThresholdRule_ChannelId] FOREIGN KEY ([ChannelId]) REFERENCES [dbo].[IotDasChannel] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [CK_IotThresholdRule_Level] CHECK (Level IN ('warning','critical')),
  CONSTRAINT [CK_IotThresholdRule_Kind] CHECK (DetectKind IN ('threshold','rate-of-change','stick-slip','pump-drop','flatline','spike')),
  CONSTRAINT [CK_IotThresholdRule_Comparison] CHECK (Comparison IN ('gt','gte','lt','lte','band-out','rate')),
  CONSTRAINT [CK_IotThresholdRule_Duration] CHECK (DurationSeconds >= 0),
  CONSTRAINT [CK_IotThresholdRule_MinSamples] CHECK (MinSamples >= 1),
  CONSTRAINT [CK_IotThresholdRule_Cooldown] CHECK (CooldownSeconds >= 0),
  CONSTRAINT [CK_IotThresholdRule_Targets] CHECK (AutoDispatch = 0 OR DispatchTargets IS NOT NULL)
);
CREATE UNIQUE INDEX [UX_IotThresholdRule_Code] ON [dbo].[IotThresholdRule] ([RigId], [RuleCode]);
CREATE INDEX [IX_IotThresholdRule_Channel] ON [dbo].[IotThresholdRule] ([ChannelId], [Level], [IsActive]);
CREATE INDEX [IX_IotThresholdRule_Kind] ON [dbo].[IotThresholdRule] ([RigId], [DetectKind], [IsActive]);
GO

-- IotTelemetryAlert · iiot · هشدار تله‌متری
IF OBJECT_ID('dbo.IotTelemetryAlert', 'U') IS NULL
CREATE TABLE [dbo].[IotTelemetryAlert] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [ChannelId] NVARCHAR(60) NULL,
  [RuleId] NVARCHAR(60) NULL,
  [AlertCode] NVARCHAR(80) NOT NULL,
  [DetectionKind] NVARCHAR(24) NOT NULL,
  [Level] NVARCHAR(12) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [MessageFa] NVARCHAR(2000) NULL,
  [DetectedAt] DATETIME2 NOT NULL,
  [TriggeredAt] DATETIME2 NULL,
  [ResolvedAt] DATETIME2 NULL,
  [TriggerValue] DECIMAL(18,6) NULL,
  [FilteredValue] DECIMAL(18,6) NULL,
  [BaselineValue] DECIMAL(18,6) NULL,
  [DeviationPct] DECIMAL(9,4) NULL,
  [SampleCount] INT NOT NULL DEFAULT 0,
  [DurationSeconds] INT NOT NULL DEFAULT 0,
  [MetricsJson] NVARCHAR(MAX) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [AcknowledgedAt] DATETIME2 NULL,
  [AcknowledgedById] NVARCHAR(60) NULL,
  [AckNoteFa] NVARCHAR(1000) NULL,
  [ResolvedById] NVARCHAR(60) NULL,
  [ResolutionNoteFa] NVARCHAR(1000) NULL,
  [SuppressedReasonFa] NVARCHAR(600) NULL,
  [DispatchStatus] NVARCHAR(16) NOT NULL DEFAULT 'none',
  [CmmsWorkOrderRef] NVARCHAR(80) NULL,
  [MesDowntimeRef] NVARCHAR(80) NULL,
  [PmisEventRef] NVARCHAR(80) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotTelemetryAlert] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_IotTelemetryAlert_ChannelId] FOREIGN KEY ([ChannelId]) REFERENCES [dbo].[IotDasChannel] ([Id]) ON DELETE CASCADE,
  CONSTRAINT [FK_IotTelemetryAlert_RuleId] FOREIGN KEY ([RuleId]) REFERENCES [dbo].[IotThresholdRule] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_IotAlert_Level] CHECK (Level IN ('warning','critical')),
  CONSTRAINT [CK_IotAlert_Status] CHECK (Status IN ('active','acknowledged','resolved','suppressed','false-positive')),
  CONSTRAINT [CK_IotAlert_Kind] CHECK (DetectionKind IN ('threshold','rate-of-change','stick-slip','pump-drop','flatline','spike')),
  CONSTRAINT [CK_IotAlert_Dispatch] CHECK (DispatchStatus IN ('none','pending','partial','dispatched','failed')),
  CONSTRAINT [CK_IotAlert_Resolve] CHECK (Status <> 'resolved' OR ResolvedAt IS NOT NULL)
);
CREATE UNIQUE INDEX [UX_IotAlert_Code] ON [dbo].[IotTelemetryAlert] ([RigId], [AlertCode], [DetectedAt]);
CREATE INDEX [IX_IotAlert_Status] ON [dbo].[IotTelemetryAlert] ([RigId], [Status], [Level]);
CREATE INDEX [IX_IotAlert_Channel] ON [dbo].[IotTelemetryAlert] ([ChannelId], [DetectedAt]);
CREATE INDEX [IX_IotAlert_Dispatch] ON [dbo].[IotTelemetryAlert] ([RigId], [DispatchStatus]);
GO

-- IotRigDowntime · iiot · توقف دکل و زمان نامولّد
IF OBJECT_ID('dbo.IotRigDowntime', 'U') IS NULL
CREATE TABLE [dbo].[IotRigDowntime] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [DowntimeCode] NVARCHAR(60) NOT NULL,
  [Category] NVARCHAR(32) NOT NULL,
  [DowntimeType] NVARCHAR(24) NOT NULL DEFAULT 'non-productive',
  [NptCode] NVARCHAR(40) NULL,
  [CauseFa] NVARCHAR(1000) NOT NULL,
  [EffectFa] NVARCHAR(1000) NULL,
  [StartedAt] DATETIME2 NOT NULL,
  [EndedAt] DATETIME2 NULL,
  [DurationMinutes] DECIMAL(12,3) NULL,
  [IsNpt] BIT NOT NULL DEFAULT 1,
  [RecoverableMinutes] DECIMAL(12,3) NULL,
  [ResponsibilityFa] NVARCHAR(240) NULL,
  [AlertId] NVARCHAR(60) NULL,
  [DetectedBy] NVARCHAR(16) NOT NULL DEFAULT 'auto',
  [ShiftName] NVARCHAR(80) NULL,
  [RecordedById] NVARCHAR(60) NULL,
  [VerifiedById] NVARCHAR(60) NULL,
  [VerifiedAt] DATETIME2 NULL,
  [ReportedToMes] BIT NOT NULL DEFAULT 0,
  [ReportedToPmis] BIT NOT NULL DEFAULT 0,
  [MesDowntimeRef] NVARCHAR(80) NULL,
  [PmisEventRef] NVARCHAR(80) NULL,
  [PmisClaimRef] NVARCHAR(80) NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotRigDowntime] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_IotRigDowntime_AlertId] FOREIGN KEY ([AlertId]) REFERENCES [dbo].[IotTelemetryAlert] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_IotRigDowntime_Window] CHECK (EndedAt IS NULL OR EndedAt >= StartedAt),
  CONSTRAINT [CK_IotRigDowntime_Duration] CHECK (DurationMinutes IS NULL OR DurationMinutes >= 0),
  CONSTRAINT [CK_IotRigDowntime_Type] CHECK (DowntimeType IN ('productive','non-productive','planned')),
  CONSTRAINT [CK_IotRigDowntime_Category] CHECK (Category IN ('equipment','mud','directional','wellbore','weather','power','logistics','cementing','waiting-on-decision','other')),
  CONSTRAINT [CK_IotRigDowntime_Npt] CHECK (IsNpt = 0 OR DowntimeType = 'non-productive')
);
CREATE UNIQUE INDEX [UX_IotRigDowntime_Code] ON [dbo].[IotRigDowntime] ([RigId], [DowntimeCode]);
CREATE INDEX [IX_IotRigDowntime_Window] ON [dbo].[IotRigDowntime] ([RigId], [StartedAt], [IsNpt]);
CREATE INDEX [IX_IotRigDowntime_Category] ON [dbo].[IotRigDowntime] ([RigId], [Category], [StartedAt]);
GO

-- IotIntegrationEvent · iiot · رویداد یکپارچگی بین‌بخشی
IF OBJECT_ID('dbo.IotIntegrationEvent', 'U') IS NULL
CREATE TABLE [dbo].[IotIntegrationEvent] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [EventType] NVARCHAR(60) NOT NULL,
  [TargetSystem] NVARCHAR(16) NOT NULL,
  [TargetRef] NVARCHAR(120) NULL,
  [Contract] NVARCHAR(40) NOT NULL,
  [IdempotencyKey] NVARCHAR(160) NOT NULL,
  [CorrelationId] NVARCHAR(120) NULL,
  [SourceTable] NVARCHAR(60) NULL,
  [SourceId] NVARCHAR(120) NULL,
  [OccurredAt] DATETIME2 NOT NULL,
  [PayloadJson] NVARCHAR(MAX) NOT NULL,
  [Status] NVARCHAR(16) NOT NULL DEFAULT 'pending',
  [Attempts] INT NOT NULL DEFAULT 0,
  [MaxAttempts] INT NOT NULL DEFAULT 5,
  [LastAttemptAt] DATETIME2 NULL,
  [DeliveredAt] DATETIME2 NULL,
  [AckRef] NVARCHAR(120) NULL,
  [ErrorCode] NVARCHAR(60) NULL,
  [ErrorFa] NVARCHAR(600) NULL,
  [EmittedBy] NVARCHAR(60) NOT NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotIntegrationEvent] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_IotIntegrationEvent_Target] CHECK (TargetSystem IN ('cmms','mes','pmis')),
  CONSTRAINT [CK_IotIntegrationEvent_Status] CHECK (Status IN ('pending','dispatched','failed','dead-letter')),
  CONSTRAINT [CK_IotIntegrationEvent_Contract] CHECK (Contract IN ('iiot-cmms-v1','iiot-mes-v1','iiot-pmis-v1')),
  CONSTRAINT [CK_IotIntegrationEvent_Attempts] CHECK (Attempts >= 0 AND Attempts <= MaxAttempts)
);
CREATE UNIQUE INDEX [UX_IotIntegrationEvent_Key] ON [dbo].[IotIntegrationEvent] ([IdempotencyKey]);
CREATE INDEX [IX_IotIntegrationEvent_Queue] ON [dbo].[IotIntegrationEvent] ([Status], [OccurredAt]);
CREATE INDEX [IX_IotIntegrationEvent_Target] ON [dbo].[IotIntegrationEvent] ([RigId], [TargetSystem], [EventType]);
GO

-- IotConditionSnapshot · iiot · عکس پایش وضعیت
IF OBJECT_ID('dbo.IotConditionSnapshot', 'U') IS NULL
CREATE TABLE [dbo].[IotConditionSnapshot] (
  [Id] NVARCHAR(60) NOT NULL,
  [RigId] NVARCHAR(60) NOT NULL,
  [CmmsAssetRef] NVARCHAR(60) NULL,
  [SensorTag] NVARCHAR(60) NULL,
  [ReadingType] NVARCHAR(24) NOT NULL,
  [Value] DECIMAL(18,6) NOT NULL,
  [Uom] NVARCHAR(24) NOT NULL,
  [Zone] NVARCHAR(12) NULL,
  [MeasuredAt] DATETIME2 NOT NULL,
  [MeasuredOn] DATE NOT NULL,
  [HealthIndex] DECIMAL(9,4) NULL,
  [TrendDirection] NVARCHAR(16) NULL,
  [RateOfChange] DECIMAL(18,6) NULL,
  [Source] NVARCHAR(16) NOT NULL DEFAULT 'iiot',
  [ReportedToCmms] BIT NOT NULL DEFAULT 0,
  [CmmsReadingRef] NVARCHAR(80) NULL,
  [AlertId] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_IotConditionSnapshot] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_IotConditionSnapshot_AlertId] FOREIGN KEY ([AlertId]) REFERENCES [dbo].[IotTelemetryAlert] ([Id]) ON DELETE SET NULL,
  CONSTRAINT [CK_IotConditionSnapshot_Zone] CHECK (Zone IS NULL OR Zone IN ('A','B','C','D')),
  CONSTRAINT [CK_IotConditionSnapshot_Trend] CHECK (TrendDirection IS NULL OR TrendDirection IN ('rising','falling','stable')),
  CONSTRAINT [CK_IotConditionSnapshot_Source] CHECK (Source IN ('iiot','manual','scada','portable')),
  CONSTRAINT [CK_IotConditionSnapshot_Type] CHECK (ReadingType IN ('vibration','temperature','humidity','pressure','current','gas','flow'))
);
CREATE INDEX [IX_IotConditionSnapshot_Rig] ON [dbo].[IotConditionSnapshot] ([RigId], [MeasuredOn]);
CREATE INDEX [IX_IotConditionSnapshot_Asset] ON [dbo].[IotConditionSnapshot] ([CmmsAssetRef], [MeasuredAt]);
CREATE INDEX [IX_IotConditionSnapshot_Zone] ON [dbo].[IotConditionSnapshot] ([RigId], [Zone], [MeasuredOn]);
GO

-- HrmOrgUnit · hrm · واحد سازمانی (چارت سازمانی)
IF OBJECT_ID('dbo.HrmOrgUnit', 'U') IS NULL
CREATE TABLE [dbo].[HrmOrgUnit] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(240) NOT NULL,
  [TitleEn] NVARCHAR(240) NULL,
  [UnitType] NVARCHAR(30) NOT NULL DEFAULT 'department',
  [ParentUnitCode] NVARCHAR(40) NULL,
  [ManagerPersonNo] NVARCHAR(40) NULL,
  [CostCenterRef] NVARCHAR(60) NULL,
  [ApprovedHeadcount] INT NOT NULL DEFAULT 1,
  [CurrentHeadcount] INT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmOrgUnit] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmOrgUnit_Code] ON [dbo].[HrmOrgUnit] ([ProjectId], [Code]);
CREATE INDEX [IX_HrmOrgUnit_Parent] ON [dbo].[HrmOrgUnit] ([ProjectId], [ParentUnitCode]);
GO

-- HrmPersonnelProfile · hrm · شناسنامهٔ جامع پرسنل
IF OBJECT_ID('dbo.HrmPersonnelProfile', 'U') IS NULL
CREATE TABLE [dbo].[HrmPersonnelProfile] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [FullNameFa] NVARCHAR(240) NOT NULL,
  [FullNameEn] NVARCHAR(240) NULL,
  [NationalId] NVARCHAR(20) NOT NULL,
  [BirthDate] DATE NULL,
  [HireDate] DATE NOT NULL,
  [EmploymentType] NVARCHAR(30) NOT NULL DEFAULT 'contractual',
  [OrgUnitCode] NVARCHAR(40) NOT NULL,
  [JobTitleFa] NVARCHAR(200) NOT NULL,
  [JobGrade] NVARCHAR(20) NULL,
  [EducationLevel] NVARCHAR(40) NULL,
  [InsuranceNo] NVARCHAR(40) NULL,
  [CmmsTechnicianRef] NVARCHAR(60) NULL,
  [MesOperatorRef] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmPersonnelProfile] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmPersonnelProfile_No] ON [dbo].[HrmPersonnelProfile] ([ProjectId], [PersonnelNo]);
CREATE INDEX [IX_HrmPersonnelProfile_Org] ON [dbo].[HrmPersonnelProfile] ([ProjectId], [OrgUnitCode], [Status]);
GO

-- HrmPersonnelAction · hrm · حکم کارگزینی و پرسنلی
IF OBJECT_ID('dbo.HrmPersonnelAction', 'U') IS NULL
CREATE TABLE [dbo].[HrmPersonnelAction] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ActionNo] NVARCHAR(40) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [ActionType] NVARCHAR(30) NOT NULL,
  [EffectiveDate] DATE NOT NULL,
  [FromOrgUnitCode] NVARCHAR(40) NULL,
  [ToOrgUnitCode] NVARCHAR(40) NULL,
  [FromJobGrade] NVARCHAR(20) NULL,
  [ToJobGrade] NVARCHAR(20) NULL,
  [BaseSalaryRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [HousingAllowanceRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [FoodAllowanceRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [ChildAllowanceRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [SeniorityAllowanceRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [ApprovedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'issued',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmPersonnelAction] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmPersonnelAction_No] ON [dbo].[HrmPersonnelAction] ([ProjectId], [ActionNo]);
CREATE INDEX [IX_HrmPersonnelAction_Person] ON [dbo].[HrmPersonnelAction] ([ProjectId], [PersonnelNo], [EffectiveDate]);
GO

-- HrmEmploymentContract · hrm · قرارداد کار پرسنل
IF OBJECT_ID('dbo.HrmEmploymentContract', 'U') IS NULL
CREATE TABLE [dbo].[HrmEmploymentContract] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ContractNo] NVARCHAR(40) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [ContractType] NVARCHAR(30) NOT NULL DEFAULT 'fixed-term',
  [StartDate] DATE NOT NULL,
  [EndDate] DATE NOT NULL,
  [BaseMonthlyRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [WeeklyHours] DECIMAL(6,2) NOT NULL DEFAULT 44,
  [WorkLocationFa] NVARCHAR(200) NULL,
  [SsiCovered] BIT NOT NULL DEFAULT 1,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmEmploymentContract] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmEmpContract_No] ON [dbo].[HrmEmploymentContract] ([ProjectId], [ContractNo]);
CREATE INDEX [IX_HrmEmpContract_Person] ON [dbo].[HrmEmploymentContract] ([ProjectId], [PersonnelNo], [Status]);
GO

-- HrmSkillMatrixItem · hrm · ماتریس مهارت و گواهی‌نامهٔ فنی/کارگاهی
IF OBJECT_ID('dbo.HrmSkillMatrixItem', 'U') IS NULL
CREATE TABLE [dbo].[HrmSkillMatrixItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MatrixCode] NVARCHAR(40) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [SkillCode] NVARCHAR(40) NOT NULL,
  [SkillTitleFa] NVARCHAR(240) NOT NULL,
  [Discipline] NVARCHAR(30) NOT NULL,
  [ProficiencyLevel] INT NOT NULL DEFAULT 3,
  [CertificateNo] NVARCHAR(60) NULL,
  [IssuedDate] DATE NULL,
  [ExpiryDate] DATE NULL,
  [CmmsAssetFamilyRef] NVARCHAR(60) NULL,
  [MesWorkCenterRef] NVARCHAR(60) NULL,
  [AssessedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'valid',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmSkillMatrixItem] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmSkillMatrix_Code] ON [dbo].[HrmSkillMatrixItem] ([ProjectId], [MatrixCode]);
CREATE INDEX [IX_HrmSkillMatrix_Person] ON [dbo].[HrmSkillMatrixItem] ([ProjectId], [PersonnelNo], [Discipline]);
GO

-- HrmShiftPattern · hrm · الگوی تقویم کاری و شیفت‌بندی
IF OBJECT_ID('dbo.HrmShiftPattern', 'U') IS NULL
CREATE TABLE [dbo].[HrmShiftPattern] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ShiftCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(240) NOT NULL,
  [PatternType] NVARCHAR(30) NOT NULL,
  [StartClock] NVARCHAR(10) NOT NULL DEFAULT '07:00',
  [EndClock] NVARCHAR(10) NOT NULL DEFAULT '15:00',
  [WorkDaysCycle] INT NOT NULL DEFAULT 6,
  [RestDaysCycle] INT NOT NULL DEFAULT 1,
  [StandardDailyHours] DECIMAL(5,2) NOT NULL DEFAULT 8,
  [ShiftAllowancePct] DECIMAL(5,2) NOT NULL DEFAULT 10,
  [NightBonusPct] DECIMAL(5,2) NOT NULL DEFAULT 35,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmShiftPattern] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmShiftPattern_Code] ON [dbo].[HrmShiftPattern] ([ProjectId], [ShiftCode]);
GO

-- HrmShiftRoster · hrm · کارکرد روزانه و تخصیص شیفت (متصل به CMMS/MES)
IF OBJECT_ID('dbo.HrmShiftRoster', 'U') IS NULL
CREATE TABLE [dbo].[HrmShiftRoster] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RosterCode] NVARCHAR(40) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [ShiftCode] NVARCHAR(40) NOT NULL,
  [WorkDate] DATE NOT NULL,
  [CheckInClock] NVARCHAR(10) NULL,
  [CheckOutClock] NVARCHAR(10) NULL,
  [NormalHours] DECIMAL(6,2) NOT NULL DEFAULT 8,
  [OvertimeHours] DECIMAL(6,2) NOT NULL DEFAULT 0,
  [NightHours] DECIMAL(6,2) NOT NULL DEFAULT 0,
  [HolidayHours] DECIMAL(6,2) NOT NULL DEFAULT 0,
  [AttendanceState] NVARCHAR(24) NOT NULL DEFAULT 'present',
  [CmmsWorkOrderRef] NVARCHAR(60) NULL,
  [MesOrderRef] NVARCHAR(60) NULL,
  [MesOperationCode] NVARCHAR(40) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'recorded',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmShiftRoster] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmShiftRoster_Code] ON [dbo].[HrmShiftRoster] ([ProjectId], [RosterCode]);
CREATE INDEX [IX_HrmShiftRoster_PersonDate] ON [dbo].[HrmShiftRoster] ([ProjectId], [PersonnelNo], [WorkDate]);
GO

-- HrmLeaveRequest · hrm · درخواست مرخصی پرسنل
IF OBJECT_ID('dbo.HrmLeaveRequest', 'U') IS NULL
CREATE TABLE [dbo].[HrmLeaveRequest] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [LeaveNo] NVARCHAR(40) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [LeaveType] NVARCHAR(30) NOT NULL,
  [FromDate] DATE NOT NULL,
  [ToDate] DATE NOT NULL,
  [DaysCount] DECIMAL(5,1) NOT NULL DEFAULT 1,
  [ReplacementPersonNo] NVARCHAR(40) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'pending',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmLeaveRequest] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmLeaveReq_No] ON [dbo].[HrmLeaveRequest] ([ProjectId], [LeaveNo]);
CREATE INDEX [IX_HrmLeaveReq_Person] ON [dbo].[HrmLeaveRequest] ([ProjectId], [PersonnelNo], [Status]);
GO

-- HrmMissionOrder · hrm · حکم مأموریت پرسنل
IF OBJECT_ID('dbo.HrmMissionOrder', 'U') IS NULL
CREATE TABLE [dbo].[HrmMissionOrder] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [MissionNo] NVARCHAR(40) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [DestinationFa] NVARCHAR(200) NOT NULL,
  [PurposeFa] NVARCHAR(400) NOT NULL,
  [FromDate] DATE NOT NULL,
  [ToDate] DATE NOT NULL,
  [DaysCount] INT NOT NULL DEFAULT 1,
  [MissionAllowanceRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [TransportCostRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [CmmsSiteRef] NVARCHAR(60) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'approved',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmMissionOrder] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmMissionOrder_No] ON [dbo].[HrmMissionOrder] ([ProjectId], [MissionNo]);
CREATE INDEX [IX_HrmMissionOrder_Person] ON [dbo].[HrmMissionOrder] ([ProjectId], [PersonnelNo], [FromDate]);
GO

-- HrmPayrollRun · hrm · دورهٔ محاسبهٔ حقوق و دستمزد
IF OBJECT_ID('dbo.HrmPayrollRun', 'U') IS NULL
CREATE TABLE [dbo].[HrmPayrollRun] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RunNo] NVARCHAR(40) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [TitleFa] NVARCHAR(240) NOT NULL,
  [EmployeeCount] INT NOT NULL DEFAULT 0,
  [TotalGrossRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [TotalEmployeeSsiRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [TotalEmployerSsiRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [TotalTaxRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [TotalNetPayableRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [DirectLaborCostRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [IndirectLaborCostRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [FinVoucherRef] NVARCHAR(60) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'calculated',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmPayrollRun] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmPayrollRun_No] ON [dbo].[HrmPayrollRun] ([ProjectId], [RunNo]);
CREATE INDEX [IX_HrmPayrollRun_Period] ON [dbo].[HrmPayrollRun] ([ProjectId], [PeriodCode], [Status]);
GO

-- HrmPayslip · hrm · فیش حقوقی پرسنل
IF OBJECT_ID('dbo.HrmPayslip', 'U') IS NULL
CREATE TABLE [dbo].[HrmPayslip] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [SlipNo] NVARCHAR(40) NOT NULL,
  [RunNo] NVARCHAR(40) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [WorkedDays] INT NOT NULL DEFAULT 30,
  [NormalHours] DECIMAL(6,2) NOT NULL DEFAULT 176,
  [OvertimeHours] DECIMAL(6,2) NOT NULL DEFAULT 0,
  [BasePayRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [OvertimePayRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [ShiftAndHardshipRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [BenefitsAllowanceRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [GrossPayRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [EmployeeSsi7PctRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [EmployerSsi23PctRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [IncomeTaxRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [OtherDeductionsRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [NetPayRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [CostType] NVARCHAR(20) NOT NULL DEFAULT 'direct',
  [FinCostCenterRef] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'issued',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmPayslip] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmPayslip_No] ON [dbo].[HrmPayslip] ([ProjectId], [SlipNo]);
CREATE INDEX [IX_HrmPayslip_RunPerson] ON [dbo].[HrmPayslip] ([ProjectId], [RunNo], [PersonnelNo]);
GO

-- HrmCostVoucher · hrm · سند تسهیم هزینهٔ دستمزد به مالی و بهای تمام‌شده
IF OBJECT_ID('dbo.HrmCostVoucher', 'U') IS NULL
CREATE TABLE [dbo].[HrmCostVoucher] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [VoucherNo] NVARCHAR(40) NOT NULL,
  [RunNo] NVARCHAR(40) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [CostCategory] NVARCHAR(32) NOT NULL,
  [FinCostCenterRef] NVARCHAR(60) NOT NULL,
  [MesOrderRef] NVARCHAR(60) NULL,
  [CmmsWorkOrderRef] NVARCHAR(60) NULL,
  [DirectLaborRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [IndirectLaborRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [EmployerSsiRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [TotalAllocatedRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [PostedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'posted',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmCostVoucher] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmCostVoucher_No] ON [dbo].[HrmCostVoucher] ([ProjectId], [VoucherNo]);
CREATE INDEX [IX_HrmCostVoucher_Period] ON [dbo].[HrmCostVoucher] ([ProjectId], [PeriodCode], [CostCategory]);
GO

-- HrmTrainingNeed · hrm · نیازسنجی آموزشی (TNA)
IF OBJECT_ID('dbo.HrmTrainingNeed', 'U') IS NULL
CREATE TABLE [dbo].[HrmTrainingNeed] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [TnaCode] NVARCHAR(40) NOT NULL,
  [OrgUnitCode] NVARCHAR(40) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NULL,
  [JobTitleFa] NVARCHAR(200) NOT NULL,
  [SkillGapFa] NVARCHAR(400) NOT NULL,
  [RecommendedCourseFa] NVARCHAR(240) NOT NULL,
  [Priority] NVARCHAR(20) NOT NULL DEFAULT 'medium',
  [TargetPeriod] NVARCHAR(20) NULL,
  [EstimatedCostRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'identified',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmTrainingNeed] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmTrainingNeed_Code] ON [dbo].[HrmTrainingNeed] ([ProjectId], [TnaCode]);
GO

-- HrmTrainingCourse · hrm · برنامه‌ریزی دورهٔ آموزشی
IF OBJECT_ID('dbo.HrmTrainingCourse', 'U') IS NULL
CREATE TABLE [dbo].[HrmTrainingCourse] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [CourseCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(240) NOT NULL,
  [Category] NVARCHAR(30) NOT NULL,
  [ProviderFa] NVARCHAR(200) NOT NULL,
  [InstructorFa] NVARCHAR(200) NULL,
  [DurationHours] INT NOT NULL DEFAULT 16,
  [StartDate] DATE NOT NULL,
  [EndDate] DATE NULL,
  [Capacity] INT NOT NULL DEFAULT 20,
  [CostPerPersonRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [SkillCodeGranted] NVARCHAR(40) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'planned',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmTrainingCourse] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmTrainingCourse_Code] ON [dbo].[HrmTrainingCourse] ([ProjectId], [CourseCode]);
GO

-- HrmTrainingRecord · hrm · سابقهٔ آموزش و ارزیابی اثربخشی دوره
IF OBJECT_ID('dbo.HrmTrainingRecord', 'U') IS NULL
CREATE TABLE [dbo].[HrmTrainingRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RecordNo] NVARCHAR(40) NOT NULL,
  [CourseCode] NVARCHAR(40) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [AttendancePct] DECIMAL(5,2) NOT NULL DEFAULT 100,
  [ExamScorePct] DECIMAL(5,2) NOT NULL DEFAULT 85,
  [CertificateNo] NVARCHAR(60) NULL,
  [IssuedDate] DATE NULL,
  [ExpiryDate] DATE NULL,
  [EffectivenessScorePct] DECIMAL(5,2) NOT NULL DEFAULT 80,
  [KirkpatrickSummaryFa] NVARCHAR(400) NULL,
  [EvaluatedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'certified',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmTrainingRecord] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmTrainingRecord_No] ON [dbo].[HrmTrainingRecord] ([ProjectId], [RecordNo]);
CREATE INDEX [IX_HrmTrainingRecord_Person] ON [dbo].[HrmTrainingRecord] ([ProjectId], [PersonnelNo], [CourseCode]);
GO

-- HrmPerformanceKpi · hrm · شاخص کلیدی عملکرد و هدف کلیدی (KPI / OKR)
IF OBJECT_ID('dbo.HrmPerformanceKpi', 'U') IS NULL
CREATE TABLE [dbo].[HrmPerformanceKpi] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [KpiCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(240) NOT NULL,
  [OrgUnitCode] NVARCHAR(40) NOT NULL,
  [JobRoleFa] NVARCHAR(200) NULL,
  [Perspective] NVARCHAR(24) NOT NULL,
  [MetricUnit] NVARCHAR(30) NOT NULL DEFAULT '%',
  [TargetValue] DECIMAL(12,2) NOT NULL DEFAULT 100,
  [WeightPct] DECIMAL(5,2) NOT NULL DEFAULT 20,
  [EvalFrequency] NVARCHAR(20) NOT NULL DEFAULT 'quarterly',
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmPerformanceKpi] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmPerfKpi_Code] ON [dbo].[HrmPerformanceKpi] ([ProjectId], [KpiCode]);
GO

-- HrmPerformanceReview · hrm · ارزیابی دوره‌ای ۳۶۰ درجه عملکرد پرسنل
IF OBJECT_ID('dbo.HrmPerformanceReview', 'U') IS NULL
CREATE TABLE [dbo].[HrmPerformanceReview] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ReviewNo] NVARCHAR(40) NOT NULL,
  [PeriodCode] NVARCHAR(20) NOT NULL,
  [PersonnelNo] NVARCHAR(40) NOT NULL,
  [ReviewerPersonNo] NVARCHAR(40) NOT NULL,
  [SelfScorePct] DECIMAL(5,2) NOT NULL DEFAULT 85,
  [ManagerScorePct] DECIMAL(5,2) NOT NULL DEFAULT 85,
  [PeerScorePct] DECIMAL(5,2) NOT NULL DEFAULT 85,
  [SubordinateScorePct] DECIMAL(5,2) NOT NULL DEFAULT 85,
  [KpiAchievementPct] DECIMAL(5,2) NOT NULL DEFAULT 90,
  [FinalScorePct] DECIMAL(5,2) NOT NULL DEFAULT 86.5,
  [PerformanceGrade] NVARCHAR(24) NOT NULL DEFAULT 'B-Exceeds',
  [BonusMultiplierPct] DECIMAL(5,2) NOT NULL DEFAULT 100,
  [StrengthsFa] NVARCHAR(600) NULL,
  [ImprovementPlanFa] NVARCHAR(600) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'finalized',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_HrmPerformanceReview] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_HrmPerfReview_No] ON [dbo].[HrmPerformanceReview] ([ProjectId], [ReviewNo]);
CREATE INDEX [IX_HrmPerfReview_PersonPeriod] ON [dbo].[HrmPerformanceReview] ([ProjectId], [PersonnelNo], [PeriodCode]);
GO

-- EdmsNumberingRule · edms · الگوی شماره‌گذاری و کدینگ خودکار اسناد
IF OBJECT_ID('dbo.EdmsNumberingRule', 'U') IS NULL
CREATE TABLE [dbo].[EdmsNumberingRule] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RuleCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(240) NOT NULL,
  [DocCategory] NVARCHAR(30) NOT NULL,
  [PrefixPattern] NVARCHAR(60) NOT NULL,
  [DisciplineCode] NVARCHAR(20) NOT NULL DEFAULT 'GEN',
  [DocTypeCode] NVARCHAR(20) NOT NULL DEFAULT 'DOC',
  [Separator] NVARCHAR(5) NOT NULL DEFAULT '-',
  [SeqDigits] INT NOT NULL DEFAULT 4,
  [CurrentSeq] INT NOT NULL DEFAULT 1,
  [ExampleDocCode] NVARCHAR(80) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EdmsNumberingRule] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EdmsNumberingRule_Code] ON [dbo].[EdmsNumberingRule] ([ProjectId], [RuleCode]);
GO

-- EdmsMasterDocument · edms · شناسنامهٔ جامع اسناد (Document Master Index - DMI)
IF OBJECT_ID('dbo.EdmsMasterDocument', 'U') IS NULL
CREATE TABLE [dbo].[EdmsMasterDocument] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [DocCode] NVARCHAR(80) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [TitleEn] NVARCHAR(300) NULL,
  [DocCategory] NVARCHAR(30) NOT NULL DEFAULT 'engineering',
  [Discipline] NVARCHAR(30) NOT NULL DEFAULT 'mechanical',
  [DocType] NVARCHAR(30) NOT NULL DEFAULT 'drawing',
  [NumberingRuleCode] NVARCHAR(40) NULL,
  [CurrentRevision] NVARCHAR(20) NOT NULL DEFAULT 'Rev-A',
  [LifecycleStage] NVARCHAR(24) NOT NULL DEFAULT 'Approved',
  [Confidentiality] NVARCHAR(20) NOT NULL DEFAULT 'internal',
  [OwnerDepartmentFa] NVARCHAR(160) NOT NULL,
  [OriginatorFa] NVARCHAR(160) NULL,
  [CheckedOutBy] NVARCHAR(60) NULL,
  [ArchiveZoneCode] NVARCHAR(40) NULL,
  [LinkedAssetOrWbsRef] NVARCHAR(80) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EdmsMasterDocument] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EdmsMasterDoc_Code] ON [dbo].[EdmsMasterDocument] ([ProjectId], [DocCode]);
CREATE INDEX [IX_EdmsMasterDoc_Disc] ON [dbo].[EdmsMasterDocument] ([ProjectId], [DocCategory], [Discipline], [LifecycleStage]);
GO

-- EdmsRevisionRecord · edms · سابقهٔ ویرایش و نسخهٔ سند (Revision History & Diff)
IF OBJECT_ID('dbo.EdmsRevisionRecord', 'U') IS NULL
CREATE TABLE [dbo].[EdmsRevisionRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [RevisionNo] NVARCHAR(40) NOT NULL,
  [DocCode] NVARCHAR(80) NOT NULL,
  [RevisionCode] NVARCHAR(20) NOT NULL,
  [ChangeSummaryFa] NVARCHAR(600) NOT NULL,
  [ComparedToRev] NVARCHAR(20) NULL,
  [DiffHighlightsFa] NVARCHAR(800) NULL,
  [FileUri] NVARCHAR(300) NULL,
  [FileHashSha256] NVARCHAR(80) NULL,
  [PageCount] INT NOT NULL DEFAULT 1,
  [PreparedBy] NVARCHAR(60) NOT NULL,
  [CheckedBy] NVARCHAR(60) NULL,
  [ApprovedBy] NVARCHAR(60) NULL,
  [IssueDate] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'approved',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EdmsRevisionRecord] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EdmsRevision_No] ON [dbo].[EdmsRevisionRecord] ([ProjectId], [RevisionNo]);
CREATE INDEX [IX_EdmsRevision_Doc] ON [dbo].[EdmsRevisionRecord] ([ProjectId], [DocCode], [RevisionCode]);
GO

-- EdmsCheckoutLock · edms · قفل رزرو و ویرایش سند (Check-Out / Check-In)
IF OBJECT_ID('dbo.EdmsCheckoutLock', 'U') IS NULL
CREATE TABLE [dbo].[EdmsCheckoutLock] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [LockNo] NVARCHAR(40) NOT NULL,
  [DocCode] NVARCHAR(80) NOT NULL,
  [BaseRevision] NVARCHAR(20) NOT NULL,
  [CheckedOutBy] NVARCHAR(60) NOT NULL,
  [CheckedOutAt] DATETIME2 NOT NULL,
  [ExpectedReturnDate] DATE NULL,
  [CheckOutReasonFa] NVARCHAR(400) NOT NULL,
  [CheckedInAt] DATETIME2 NULL,
  [ResultingRevision] NVARCHAR(20) NULL,
  [CheckInDiffNotesFa] NVARCHAR(600) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'checked-out',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EdmsCheckoutLock] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EdmsCheckoutLock_No] ON [dbo].[EdmsCheckoutLock] ([ProjectId], [LockNo]);
CREATE INDEX [IX_EdmsCheckoutLock_Doc] ON [dbo].[EdmsCheckoutLock] ([ProjectId], [DocCode], [Status]);
GO

-- EdmsWorkflowInstance · edms · گردش‌کار بررسی و تأیید سند (Review & Approval Workflow)
IF OBJECT_ID('dbo.EdmsWorkflowInstance', 'U') IS NULL
CREATE TABLE [dbo].[EdmsWorkflowInstance] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [WorkflowNo] NVARCHAR(40) NOT NULL,
  [DocCode] NVARCHAR(80) NOT NULL,
  [RevisionCode] NVARCHAR(20) NOT NULL,
  [WorkflowType] NVARCHAR(32) NOT NULL,
  [CurrentStep] NVARCHAR(30) NOT NULL DEFAULT 'lead-engineer',
  [ReviewResultCode] NVARCHAR(32) NOT NULL DEFAULT 'pending',
  [InitiatedBy] NVARCHAR(60) NOT NULL,
  [AssignedReviewer] NVARCHAR(60) NOT NULL,
  [FinalApprover] NVARCHAR(60) NULL,
  [DueDate] DATE NOT NULL,
  [CompletedDate] DATE NULL,
  [ReviewCommentsFa] NVARCHAR(800) NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'in-review',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EdmsWorkflowInstance] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EdmsWorkflow_No] ON [dbo].[EdmsWorkflowInstance] ([ProjectId], [WorkflowNo]);
CREATE INDEX [IX_EdmsWorkflow_Doc] ON [dbo].[EdmsWorkflowInstance] ([ProjectId], [DocCode], [Status]);
GO

-- EdmsTransmittalPackage · edms · برگهٔ ارسال مدارک و مکاتبات مهندسی/اداری (Transmittal)
IF OBJECT_ID('dbo.EdmsTransmittalPackage', 'U') IS NULL
CREATE TABLE [dbo].[EdmsTransmittalPackage] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [TransmittalNo] NVARCHAR(40) NOT NULL,
  [SubjectFa] NVARCHAR(300) NOT NULL,
  [Direction] NVARCHAR(16) NOT NULL DEFAULT 'outgoing',
  [SenderOrgFa] NVARCHAR(200) NOT NULL,
  [ReceiverOrgFa] NVARCHAR(200) NOT NULL,
  [IssuePurpose] NVARCHAR(30) NOT NULL DEFAULT 'for-approval',
  [IncludedDocCodes] NVARCHAR(600) NOT NULL,
  [DeliveryChannel] NVARCHAR(30) NOT NULL DEFAULT 'edms-portal',
  [IssueDate] DATE NOT NULL,
  [AcknowledgedDate] DATE NULL,
  [ReceiptRefNo] NVARCHAR(60) NULL,
  [IssuedBy] NVARCHAR(60) NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'issued',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EdmsTransmittalPackage] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EdmsTransmittal_No] ON [dbo].[EdmsTransmittalPackage] ([ProjectId], [TransmittalNo]);
CREATE INDEX [IX_EdmsTransmittal_Date] ON [dbo].[EdmsTransmittalPackage] ([ProjectId], [Direction], [IssueDate]);
GO

-- EdmsArchiveZone · edms · زون‌بندی و طبقه‌بندی بایگانی دیجیتال و فیزیکی
IF OBJECT_ID('dbo.EdmsArchiveZone', 'U') IS NULL
CREATE TABLE [dbo].[EdmsArchiveZone] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ZoneCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(240) NOT NULL,
  [Classification] NVARCHAR(32) NOT NULL,
  [StorageTier] NVARCHAR(24) NOT NULL DEFAULT 'hot-nvme',
  [RetentionYears] INT NOT NULL DEFAULT 15,
  [DispositionPolicy] NVARCHAR(30) NOT NULL DEFAULT 'permanent-keep',
  [EncryptionAes256] BIT NOT NULL DEFAULT 1,
  [StoredDocsCount] INT NOT NULL DEFAULT 0,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'active',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EdmsArchiveZone] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EdmsArchiveZone_Code] ON [dbo].[EdmsArchiveZone] ([ProjectId], [ZoneCode]);
GO

-- EdmsOcrSearchIndex · edms · رکورد اسکن، استخراج متن (OCR) و نمایهٔ جستجوی تمام‌متن
IF OBJECT_ID('dbo.EdmsOcrSearchIndex', 'U') IS NULL
CREATE TABLE [dbo].[EdmsOcrSearchIndex] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [IndexNo] NVARCHAR(40) NOT NULL,
  [DocCode] NVARCHAR(80) NOT NULL,
  [RevisionCode] NVARCHAR(20) NOT NULL,
  [ArchiveZoneCode] NVARCHAR(40) NOT NULL,
  [ScanDpi] INT NOT NULL DEFAULT 300,
  [OcrLang] NVARCHAR(20) NOT NULL DEFAULT 'fa+en',
  [OcrConfidencePct] DECIMAL(5,2) NOT NULL DEFAULT 97.5,
  [ExtractedTextFa] NVARCHAR(2000) NOT NULL,
  [KeywordsTagsFa] NVARCHAR(400) NOT NULL,
  [PhysicalBoxRef] NVARCHAR(60) NULL,
  [IndexedBy] NVARCHAR(60) NOT NULL,
  [IndexedDate] DATE NOT NULL,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'indexed',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_EdmsOcrSearchIndex] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_EdmsOcrIndex_No] ON [dbo].[EdmsOcrSearchIndex] ([ProjectId], [IndexNo]);
CREATE INDEX [IX_EdmsOcrIndex_Doc] ON [dbo].[EdmsOcrSearchIndex] ([ProjectId], [DocCode], [ArchiveZoneCode]);
GO

-- KmsLessonRecord · edms · درس‌آموختهٔ پروژه و تولید (Lessons Learned)
IF OBJECT_ID('dbo.KmsLessonRecord', 'U') IS NULL
CREATE TABLE [dbo].[KmsLessonRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [LessonCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [DomainPillar] NVARCHAR(30) NOT NULL,
  [SourceContextFa] NVARCHAR(200) NOT NULL,
  [ProblemOrEventFa] NVARCHAR(800) NOT NULL,
  [RootCauseFa] NVARCHAR(600) NOT NULL,
  [ActionAndLessonFa] NVARCHAR(800) NOT NULL,
  [SeverityImpact] NVARCHAR(20) NOT NULL DEFAULT 'high',
  [EstimatedSavingRials] DECIMAL(18,0) NOT NULL DEFAULT 0,
  [AuthorBy] NVARCHAR(60) NOT NULL,
  [ValidatedBy] NVARCHAR(60) NULL,
  [AppliedCount] INT NOT NULL DEFAULT 1,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'published',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_KmsLessonRecord] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_KmsLesson_Code] ON [dbo].[KmsLessonRecord] ([ProjectId], [LessonCode]);
CREATE INDEX [IX_KmsLesson_Domain] ON [dbo].[KmsLessonRecord] ([ProjectId], [DomainPillar], [Status]);
GO

-- KmsKnowledgeBaseArticle · edms · مقالهٔ پایگاه دانش، ویکی فنی و Best Practice
IF OBJECT_ID('dbo.KmsKnowledgeBaseArticle', 'U') IS NULL
CREATE TABLE [dbo].[KmsKnowledgeBaseArticle] (
  [Id] NVARCHAR(60) NOT NULL,
  [ProjectId] NVARCHAR(60) NOT NULL,
  [ArticleCode] NVARCHAR(40) NOT NULL,
  [TitleFa] NVARCHAR(300) NOT NULL,
  [ArticleType] NVARCHAR(30) NOT NULL DEFAULT 'best-practice',
  [KnowledgeAreaFa] NVARCHAR(160) NOT NULL,
  [SummaryFa] NVARCHAR(500) NOT NULL,
  [BodyMarkdownFa] NVARCHAR(2000) NOT NULL,
  [TagsCsv] NVARCHAR(300) NOT NULL,
  [RefDocCode] NVARCHAR(80) NULL,
  [AuthorBy] NVARCHAR(60) NOT NULL,
  [ReviewedBy] NVARCHAR(60) NULL,
  [ViewCount] INT NOT NULL DEFAULT 12,
  [HelpfulVotes] INT NOT NULL DEFAULT 5,
  [VersionNo] INT NOT NULL DEFAULT 1,
  [Status] NVARCHAR(20) NOT NULL DEFAULT 'published',
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_KmsKnowledgeBaseArticle] PRIMARY KEY ([Id])
);
CREATE UNIQUE INDEX [UX_KmsArticle_Code] ON [dbo].[KmsKnowledgeBaseArticle] ([ProjectId], [ArticleCode]);
CREATE INDEX [IX_KmsArticle_Type] ON [dbo].[KmsKnowledgeBaseArticle] ([ProjectId], [ArticleType], [Status]);
GO
`;
export const PMIS_FULL_SCHEMA_TABLE_COUNT = 412;
