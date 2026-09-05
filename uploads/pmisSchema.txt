/**
 * Operational SQL Server schema blueprint for PMIS.
 * Run in SSMS on a clean or development database before enabling the backend.
 */
export const PMIS_CORE_SCHEMA_SCRIPT = `-- PMIS Operational Schema v1.0
-- Execute this script in SQL Server Management Studio.

IF DB_ID('PMIS_MASTER_DB') IS NULL
BEGIN
  CREATE DATABASE PMIS_MASTER_DB;
END;
GO
USE PMIS_MASTER_DB;
GO

IF OBJECT_ID('dbo.Schema_Version', 'U') IS NULL
CREATE TABLE dbo.Schema_Version (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  VersionNo NVARCHAR(30) NOT NULL UNIQUE,
  AppliedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  Notes NVARCHAR(500) NULL
);
GO

IF OBJECT_ID('dbo.Industry_Master', 'U') IS NULL
CREATE TABLE dbo.Industry_Master (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Code NVARCHAR(20) NOT NULL UNIQUE,
  TitleFa NVARCHAR(200) NOT NULL,
  TitleEn NVARCHAR(200) NULL,
  Icon NVARCHAR(30) NULL,
  Color NVARCHAR(20) NULL,
  IsActive BIT NOT NULL DEFAULT 1,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2 NULL
);
GO

IF OBJECT_ID('dbo.Project_Master', 'U') IS NULL
CREATE TABLE dbo.Project_Master (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  IndustryCode NVARCHAR(20) NOT NULL,
  ProjectCode NVARCHAR(50) NOT NULL UNIQUE,
  NameFa NVARCHAR(400) NOT NULL,
  NameEn NVARCHAR(400) NULL,
  ClientFa NVARCHAR(200) NULL,
  ConsultantFa NVARCHAR(200) NULL,
  ContractorFa NVARCHAR(200) NULL,
  LocationFa NVARCHAR(250) NULL,
  Budget DECIMAL(18,2) NULL,
  CurrencyCode NVARCHAR(10) NULL DEFAULT 'USD',
  Status NVARCHAR(20) NOT NULL DEFAULT 'active',
  Progress DECIMAL(5,2) NOT NULL DEFAULT 0,
  StartDate DATE NULL,
  FinishDate DATE NULL,
  IsArchived BIT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2 NULL
);
GO
CREATE INDEX IX_Project_Master_IndustryCode ON dbo.Project_Master(IndustryCode);
GO

IF OBJECT_ID('dbo.Project_Organization', 'U') IS NULL
CREATE TABLE dbo.Project_Organization (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  RoleCode NVARCHAR(30) NOT NULL,
  OrganizationName NVARCHAR(250) NOT NULL,
  LogoFileId UNIQUEIDENTIFIER NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Project_Organization UNIQUE(ProjectCode, RoleCode)
);
GO

IF OBJECT_ID('dbo.System_User', 'U') IS NULL
CREATE TABLE dbo.System_User (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  UserName NVARCHAR(100) NOT NULL UNIQUE,
  DisplayName NVARCHAR(200) NOT NULL,
  Email NVARCHAR(250) NULL,
  IsActive BIT NOT NULL DEFAULT 1,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Role_Master', 'U') IS NULL
CREATE TABLE dbo.Role_Master (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Code NVARCHAR(60) NOT NULL UNIQUE,
  TitleFa NVARCHAR(150) NOT NULL,
  TitleEn NVARCHAR(150) NULL
);
GO

IF OBJECT_ID('dbo.Project_User_Access', 'U') IS NULL
CREATE TABLE dbo.Project_User_Access (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  UserId INT NOT NULL,
  ProjectCode NVARCHAR(50) NOT NULL,
  RoleCode NVARCHAR(60) NOT NULL,
  GrantedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Project_User_Access UNIQUE(UserId, ProjectCode, RoleCode)
);
GO

IF OBJECT_ID('dbo.File_Object', 'U') IS NULL
CREATE TABLE dbo.File_Object (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  FileName NVARCHAR(300) NOT NULL,
  MimeType NVARCHAR(150) NOT NULL,
  SizeBytes BIGINT NOT NULL,
  StorageKey NVARCHAR(600) NOT NULL,
  ChecksumSha256 NVARCHAR(128) NULL,
  UploadedBy INT NULL,
  UploadedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  IsDeleted BIT NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID('dbo.Report_Template', 'U') IS NULL
CREATE TABLE dbo.Report_Template (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NULL,
  IndustryCode NVARCHAR(20) NULL,
  ModuleCode NVARCHAR(60) NOT NULL,
  TemplateKind NVARCHAR(20) NOT NULL,
  Name NVARCHAR(250) NOT NULL,
  VersionNo NVARCHAR(50) NOT NULL,
  FileId UNIQUEIDENTIFIER NULL,
  IsLocked BIT NOT NULL DEFAULT 0,
  IsActive BIT NOT NULL DEFAULT 1,
  EffectiveFrom DATE NULL,
  EffectiveTo DATE NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX IX_Report_Template_Scope ON dbo.Report_Template(ProjectCode, IndustryCode, ModuleCode, TemplateKind);
GO

IF OBJECT_ID('dbo.Document_Master', 'U') IS NULL
CREATE TABLE dbo.Document_Master (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  DocumentNo NVARCHAR(120) NOT NULL,
  TitleFa NVARCHAR(500) NOT NULL,
  DisciplineCode NVARCHAR(40) NULL,
  Status NVARCHAR(40) NOT NULL DEFAULT 'draft',
  CurrentRevision NVARCHAR(30) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Document_Master UNIQUE(ProjectCode, DocumentNo)
);
GO

IF OBJECT_ID('dbo.Document_Revision', 'U') IS NULL
CREATE TABLE dbo.Document_Revision (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  DocumentId INT NOT NULL,
  RevisionNo NVARCHAR(30) NOT NULL,
  FileId UNIQUEIDENTIFIER NULL,
  RevisionDate DATE NULL,
  Remarks NVARCHAR(1000) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Document_Revision UNIQUE(DocumentId, RevisionNo)
);
GO

IF OBJECT_ID('dbo.Knowledge_Document', 'U') IS NULL
CREATE TABLE dbo.Knowledge_Document (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  FileId UNIQUEIDENTIFIER NOT NULL,
  DocumentType NVARCHAR(50) NOT NULL,
  Title NVARCHAR(400) NOT NULL,
  LanguageCode NVARCHAR(10) NULL,
  ExtractionStatus NVARCHAR(30) NOT NULL DEFAULT 'pending',
  CharacterCount INT NOT NULL DEFAULT 0,
  ChunkCount INT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX IX_Knowledge_Document_Project ON dbo.Knowledge_Document(ProjectCode, DocumentType, CreatedAt);
GO

IF OBJECT_ID('dbo.Document_Chunk', 'U') IS NULL
CREATE TABLE dbo.Document_Chunk (
  Id BIGINT IDENTITY(1,1) PRIMARY KEY,
  KnowledgeDocumentId UNIQUEIDENTIFIER NOT NULL,
  ProjectCode NVARCHAR(50) NOT NULL,
  ChunkIndex INT NOT NULL,
  Content NVARCHAR(MAX) NOT NULL,
  SearchText NVARCHAR(2000) NULL,
  TokenEstimate INT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Document_Chunk UNIQUE(KnowledgeDocumentId, ChunkIndex)
);
GO
CREATE INDEX IX_Document_Chunk_Project ON dbo.Document_Chunk(ProjectCode, KnowledgeDocumentId, ChunkIndex);
GO

IF OBJECT_ID('dbo.OCR_Job', 'U') IS NULL
CREATE TABLE dbo.OCR_Job (
  Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  FileId UNIQUEIDENTIFIER NOT NULL,
  Engine NVARCHAR(80) NOT NULL,
  LanguageCode NVARCHAR(50) NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'queued',
  CharacterCount INT NOT NULL DEFAULT 0,
  Confidence DECIMAL(5,2) NULL,
  ErrorMessage NVARCHAR(1000) NULL,
  KnowledgeDocumentId UNIQUEIDENTIFIER NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CompletedAt DATETIME2 NULL
);
GO
CREATE INDEX IX_OCR_Job_Project ON dbo.OCR_Job(ProjectCode, Status, CreatedAt);
GO

IF OBJECT_ID('dbo.Correspondence_Master', 'U') IS NULL
CREATE TABLE dbo.Correspondence_Master (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  LetterNo NVARCHAR(100) NOT NULL,
  Subject NVARCHAR(500) NOT NULL,
  LetterDate DATE NULL,
  Direction NVARCHAR(20) NULL,
  FileId UNIQUEIDENTIFIER NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'open',
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Correspondence_Master UNIQUE(ProjectCode, LetterNo)
);
GO

IF OBJECT_ID('dbo.Project_WBS', 'U') IS NULL
CREATE TABLE dbo.Project_WBS (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  ParentId INT NULL,
  WbsCode NVARCHAR(100) NOT NULL,
  Title NVARCHAR(400) NOT NULL,
  [Level] INT NOT NULL,
  Weight DECIMAL(9,4) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Project_WBS UNIQUE(ProjectCode, WbsCode)
);
GO
CREATE INDEX IX_Project_WBS_Project_Parent ON dbo.Project_WBS(ProjectCode, ParentId);
GO

IF OBJECT_ID('dbo.Schedule_Master', 'U') IS NULL
CREATE TABLE dbo.Schedule_Master (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  ScheduleName NVARCHAR(250) NOT NULL,
  SourceSystem NVARCHAR(30) NOT NULL,
  FileId UNIQUEIDENTIFIER NULL,
  DataDate DATE NULL,
  IsBaseline BIT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Schedule_Activity', 'U') IS NULL
CREATE TABLE dbo.Schedule_Activity (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ScheduleId INT NOT NULL,
  WbsId INT NULL,
  ActivityCode NVARCHAR(100) NOT NULL,
  ActivityName NVARCHAR(400) NOT NULL,
  StartDate DATE NULL,
  FinishDate DATE NULL,
  DurationDays INT NULL,
  Progress DECIMAL(5,2) NOT NULL DEFAULT 0,
  IsCritical BIT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Schedule_Activity UNIQUE(ScheduleId, ActivityCode)
);
GO

IF OBJECT_ID('dbo.Schedule_Import_Log', 'U') IS NULL
CREATE TABLE dbo.Schedule_Import_Log (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  SourceSystem NVARCHAR(30) NOT NULL,
  FileId UNIQUEIDENTIFIER NULL,
  ImportedBy INT NULL,
  ImportedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  Status NVARCHAR(30) NOT NULL,
  Details NVARCHAR(MAX) NULL
);
GO

IF OBJECT_ID('dbo.Daily_Report', 'U') IS NULL
CREATE TABLE dbo.Daily_Report (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  ReportNo NVARCHAR(30) NOT NULL,
  ReportDate DATE NOT NULL,
  TemplateId INT NULL,
  HeaderJson NVARCHAR(MAX) NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
  CreatedBy INT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2 NULL,
  CONSTRAINT UQ_Daily_Report UNIQUE(ProjectCode, ReportNo, ReportDate)
);
GO

IF OBJECT_ID('dbo.Daily_Report_Value', 'U') IS NULL
CREATE TABLE dbo.Daily_Report_Value (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  DailyReportId INT NOT NULL,
  SectionCode NVARCHAR(60) NOT NULL,
  FieldCode NVARCHAR(100) NOT NULL,
  ValueText NVARCHAR(MAX) NULL,
  ValueNumber DECIMAL(18,4) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Report_Workflow', 'U') IS NULL
CREATE TABLE dbo.Report_Workflow (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  DailyReportId INT NOT NULL,
  CurrentStatus NVARCHAR(30) NOT NULL DEFAULT 'draft',
  CurrentAssigneeRole NVARCHAR(60) NULL,
  SubmittedAt DATETIME2 NULL,
  ReviewedAt DATETIME2 NULL,
  ApprovedAt DATETIME2 NULL,
  ClosedAt DATETIME2 NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2 NULL,
  CONSTRAINT UQ_Report_Workflow UNIQUE(DailyReportId)
);
GO

IF OBJECT_ID('dbo.Report_Workflow_Action', 'U') IS NULL
CREATE TABLE dbo.Report_Workflow_Action (
  Id BIGINT IDENTITY(1,1) PRIMARY KEY,
  WorkflowId INT NOT NULL,
  ActionCode NVARCHAR(40) NOT NULL,
  FromStatus NVARCHAR(30) NOT NULL,
  ToStatus NVARCHAR(30) NOT NULL,
  ActorUserId INT NULL,
  ActorRole NVARCHAR(60) NULL,
  Comment NVARCHAR(2000) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX IX_Report_Workflow_Action_Workflow ON dbo.Report_Workflow_Action(WorkflowId, CreatedAt);
GO

IF OBJECT_ID('dbo.Progress_Transaction', 'U') IS NULL
CREATE TABLE dbo.Progress_Transaction (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  WbsId INT NULL,
  ActivityId INT NULL,
  ReportId INT NULL,
  Unit NVARCHAR(30) NULL,
  TodayQty DECIMAL(18,4) NOT NULL DEFAULT 0,
  CumulativeQty DECIMAL(18,4) NOT NULL DEFAULT 0,
  ProgressDate DATE NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.KPI_Master', 'U') IS NULL
CREATE TABLE dbo.KPI_Master (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  Code NVARCHAR(60) NOT NULL UNIQUE,
  TitleFa NVARCHAR(200) NOT NULL,
  Unit NVARCHAR(30) NULL,
  TargetValue DECIMAL(18,4) NULL,
  Direction NVARCHAR(20) NULL
);
GO

IF OBJECT_ID('dbo.KPI_Value', 'U') IS NULL
CREATE TABLE dbo.KPI_Value (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  KPIId INT NOT NULL,
  PeriodDate DATE NOT NULL,
  Value DECIMAL(18,4) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_KPI_Value UNIQUE(ProjectCode, KPIId, PeriodDate)
);
GO

IF OBJECT_ID('dbo.EVM_Transaction', 'U') IS NULL
CREATE TABLE dbo.EVM_Transaction (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  PeriodDate DATE NOT NULL,
  PV DECIMAL(18,4) NOT NULL DEFAULT 0,
  EV DECIMAL(18,4) NOT NULL DEFAULT 0,
  AC DECIMAL(18,4) NOT NULL DEFAULT 0,
  SPI DECIMAL(9,4) NULL,
  CPI DECIMAL(9,4) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_EVM_Transaction UNIQUE(ProjectCode, PeriodDate)
);
GO

IF OBJECT_ID('dbo.Action_Plan', 'U') IS NULL
CREATE TABLE dbo.Action_Plan (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  HorizonMonths INT NOT NULL,
  SourceMode NVARCHAR(30) NOT NULL,
  TemplateId INT NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Action_Item', 'U') IS NULL
CREATE TABLE dbo.Action_Item (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ActionPlanId INT NOT NULL,
  Title NVARCHAR(500) NOT NULL,
  Owner NVARCHAR(150) NULL,
  DueDate DATE NULL,
  Weight DECIMAL(5,2) NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'open',
  IsImportant BIT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Alert_Register', 'U') IS NULL
CREATE TABLE dbo.Alert_Register (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NULL,
  SourceCode NVARCHAR(80) NOT NULL,
  Severity NVARCHAR(20) NOT NULL,
  Title NVARCHAR(500) NOT NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'open',
  RaisedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  ResolvedAt DATETIME2 NULL
);
GO

IF OBJECT_ID('dbo.Notification_Queue', 'U') IS NULL
CREATE TABLE dbo.Notification_Queue (
  Id BIGINT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NULL,
  Channel NVARCHAR(20) NOT NULL,
  Recipient NVARCHAR(300) NOT NULL,
  Subject NVARCHAR(300) NULL,
  Body NVARCHAR(MAX) NOT NULL,
  Priority NVARCHAR(20) NOT NULL DEFAULT 'normal',
  Status NVARCHAR(30) NOT NULL DEFAULT 'pending',
  RelatedEntity NVARCHAR(100) NULL,
  RelatedEntityId NVARCHAR(100) NULL,
  Attempts INT NOT NULL DEFAULT 0,
  LastError NVARCHAR(1000) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  SentAt DATETIME2 NULL
);
GO
CREATE INDEX IX_Notification_Queue_Status ON dbo.Notification_Queue(Status, CreatedAt);
GO

IF OBJECT_ID('dbo.Notification_Delivery_Log', 'U') IS NULL
CREATE TABLE dbo.Notification_Delivery_Log (
  Id BIGINT IDENTITY(1,1) PRIMARY KEY,
  NotificationId BIGINT NOT NULL,
  Channel NVARCHAR(20) NOT NULL,
  Provider NVARCHAR(80) NULL,
  Status NVARCHAR(30) NOT NULL,
  ResponseText NVARCHAR(MAX) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX IX_Notification_Delivery_Log_Notification ON dbo.Notification_Delivery_Log(NotificationId, CreatedAt);
GO

IF OBJECT_ID('dbo.Risk_Register', 'U') IS NULL
CREATE TABLE dbo.Risk_Register (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  TitleFa NVARCHAR(500) NOT NULL,
  Probability INT NOT NULL,
  Impact INT NOT NULL,
  Score AS (Probability * Impact) PERSISTED,
  Owner NVARCHAR(150) NULL,
  ResponsePlan NVARCHAR(MAX) NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'open',
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Change_Request', 'U') IS NULL
CREATE TABLE dbo.Change_Request (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  RequestNo NVARCHAR(60) NULL,
  Title NVARCHAR(500) NOT NULL,
  Reason NVARCHAR(MAX) NULL,
  TimeImpactDays DECIMAL(9,2) NULL,
  CostImpact DECIMAL(18,2) NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Delay_Register', 'U') IS NULL
CREATE TABLE dbo.Delay_Register (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  DelayNo NVARCHAR(60) NULL,
  DelayTitle NVARCHAR(500) NOT NULL,
  StartDate DATE NULL,
  FinishDate DATE NULL,
  DelayDays DECIMAL(9,2) NULL,
  CauseCategory NVARCHAR(80) NULL,
  ContractReference NVARCHAR(250) NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'under_review',
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Claim_Register', 'U') IS NULL
CREATE TABLE dbo.Claim_Register (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  ClaimNo NVARCHAR(60) NULL,
  Subject NVARCHAR(500) NOT NULL,
  ClaimedDays DECIMAL(9,2) NULL,
  ClaimedAmount DECIMAL(18,2) NULL,
  Status NVARCHAR(30) NOT NULL DEFAULT 'draft',
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Claim_Evidence', 'U') IS NULL
CREATE TABLE dbo.Claim_Evidence (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ClaimId INT NOT NULL,
  EvidenceType NVARCHAR(50) NOT NULL,
  ReferenceNo NVARCHAR(150) NULL,
  FileId UNIQUEIDENTIFIER NULL,
  Notes NVARCHAR(MAX) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Project_Budget', 'U') IS NULL
CREATE TABLE dbo.Project_Budget (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  CBSCode NVARCHAR(100) NULL,
  BudgetAmount DECIMAL(18,2) NOT NULL,
  CurrencyCode NVARCHAR(10) NOT NULL DEFAULT 'USD',
  BaselineDate DATE NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Cost_Transaction', 'U') IS NULL
CREATE TABLE dbo.Cost_Transaction (
  Id INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode NVARCHAR(50) NOT NULL,
  CBSCode NVARCHAR(100) NULL,
  TransactionDate DATE NOT NULL,
  Amount DECIMAL(18,2) NOT NULL,
  CurrencyCode NVARCHAR(10) NOT NULL DEFAULT 'USD',
  SourceSystem NVARCHAR(50) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID('dbo.Audit_Log', 'U') IS NULL
CREATE TABLE dbo.Audit_Log (
  Id BIGINT IDENTITY(1,1) PRIMARY KEY,
  UserId INT NULL,
  ProjectCode NVARCHAR(50) NULL,
  ActionCode NVARCHAR(80) NOT NULL,
  EntityName NVARCHAR(100) NULL,
  EntityId NVARCHAR(100) NULL,
  BeforeJson NVARCHAR(MAX) NULL,
  AfterJson NVARCHAR(MAX) NULL,
  IpAddress NVARCHAR(60) NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE INDEX IX_Audit_Log_Entity ON dbo.Audit_Log(EntityName, EntityId, CreatedAt);
GO

IF OBJECT_ID('dbo.Portfolio_Snapshot', 'V') IS NOT NULL
  DROP VIEW dbo.Portfolio_Snapshot;
GO
CREATE VIEW dbo.Portfolio_Snapshot AS
SELECT
  IndustryCode,
  COUNT(*) AS TotalProjects,
  SUM(CASE WHEN Status = 'active' THEN 1 ELSE 0 END) AS ActiveProjects,
  SUM(CASE WHEN Status = 'tender' THEN 1 ELSE 0 END) AS TenderProjects,
  SUM(CASE WHEN Status = 'stopped' THEN 1 ELSE 0 END) AS StoppedProjects,
  SUM(CASE WHEN Status = 'completed' THEN 1 ELSE 0 END) AS CompletedProjects,
  AVG(Progress) AS AverageProgress,
  SUM(ISNULL(Budget, 0)) AS TotalBudget
FROM dbo.Project_Master
WHERE IsArchived = 0
GROUP BY IndustryCode;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Schema_Version WHERE VersionNo = '1.0')
INSERT INTO dbo.Schema_Version (VersionNo, Notes) VALUES ('1.0', 'Core PMIS operational entities');

/* ==========================================================================
   SQL Schema Setup: Risk Management Module
   ========================================================================== */
export const SQL_INIT_SCRIPTS = [
  \`CREATE TABLE Risk_Core (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    root_cause NVARCHAR(MAX),
    owner NVARCHAR(100),
    status VARCHAR(20) DEFAULT 'identified',
    probability INT CHECK (probability BETWEEN 1 AND 5),
    impact INT CHECK (impact BETWEEN 1 AND 5),
    financial_impact DECIMAL(18,2) DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE()
  );\`
];`;
