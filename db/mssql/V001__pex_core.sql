/* ─────────────────────────────────────────────────────────────
   F5-G1 · PEX core tables (SQL Server 2008 R2 سازگار)
   مبنا: docs/PEX_D2_DataModel.md
   اجرا: sqlcmd -S <server> -d <db> -i V001__pex_core.sql
   ───────────────────────────────────────────────────────────── */

IF OBJECT_ID(N'dbo.pex_project', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pex_project (
    ProjectCode     NVARCHAR(50)  NOT NULL CONSTRAINT PK_pex_project PRIMARY KEY,
    NameFa          NVARCHAR(400) NOT NULL,
    NameEn          NVARCHAR(400) NULL,
    ClientFa        NVARCHAR(200) NULL,
    DataDate        DATE          NOT NULL,
    FormulaVersion  NVARCHAR(20)  NOT NULL CONSTRAINT DF_pex_project_fv DEFAULT (N'v1'),
    CreatedAt       DATETIME      NOT NULL CONSTRAINT DF_pex_project_ca DEFAULT (GETUTCDATE())
  );
END
GO

IF OBJECT_ID(N'dbo.pex_wbs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pex_wbs (
    Id            INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_pex_wbs PRIMARY KEY,
    ProjectCode   NVARCHAR(50)  NOT NULL,
    ParentId      INT           NULL,
    Code          NVARCHAR(50)  NOT NULL,
    NameFa        NVARCHAR(400) NOT NULL,
    NameEn        NVARCHAR(400) NULL,
    NodeLevel     INT           NOT NULL,
    NodeType      NVARCHAR(20)  NOT NULL CONSTRAINT CK_pex_wbs_type CHECK (NodeType IN (N'Summary', N'CA', N'WP')),
    Weight        DECIMAL(8,4)  NOT NULL CONSTRAINT CK_pex_wbs_w CHECK (Weight >= 0 AND Weight <= 1),
    IsLocked      BIT           NOT NULL CONSTRAINT DF_pex_wbs_lock DEFAULT (0),
    CONSTRAINT UQ_pex_wbs_proj_code UNIQUE (ProjectCode, Code),
    CONSTRAINT FK_pex_wbs_project FOREIGN KEY (ProjectCode) REFERENCES dbo.pex_project (ProjectCode),
    CONSTRAINT FK_pex_wbs_parent FOREIGN KEY (ParentId) REFERENCES dbo.pex_wbs (Id)
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.pex_wbs'), N'IX_pex_wbs_parent', N'IndexID') IS NULL
  CREATE INDEX IX_pex_wbs_parent ON dbo.pex_wbs (ParentId);
GO

IF OBJECT_ID(N'dbo.pex_roc', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pex_roc (
    RocCode     NVARCHAR(50)  NOT NULL CONSTRAINT PK_pex_roc PRIMARY KEY,
    NameFa      NVARCHAR(200) NOT NULL,
    NameEn      NVARCHAR(200) NULL,
    Discipline  NVARCHAR(50)  NULL,
    StepsJson   NVARCHAR(MAX) NOT NULL, -- [{seq,nameFa,nameEn,weight}] جمع وزن = ۱
    CreatedAt   DATETIME      NOT NULL CONSTRAINT DF_pex_roc_ca DEFAULT (GETUTCDATE())
  );
END
GO

IF OBJECT_ID(N'dbo.pex_activity', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pex_activity (
    Id                INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_pex_activity PRIMARY KEY,
    ProjectCode       NVARCHAR(50)  NOT NULL,
    WbsId             INT           NULL,
    Code              NVARCHAR(50)  NOT NULL,
    NameFa            NVARCHAR(400) NOT NULL,
    NameEn            NVARCHAR(400) NULL,
    Bac               DECIMAL(18,4) NOT NULL CONSTRAINT DF_pex_act_bac DEFAULT (0),
    DurationHours     DECIMAL(10,2) NOT NULL CONSTRAINT DF_pex_act_dur DEFAULT (0),
    TotalFloatH       DECIMAL(10,2) NOT NULL CONSTRAINT DF_pex_act_tf DEFAULT (0),
    PctApproved       DECIMAL(8,4)  NOT NULL CONSTRAINT DF_pex_act_pct DEFAULT (0),
    PctPhysicalDraft  DECIMAL(8,4)  NOT NULL CONSTRAINT DF_pex_act_draft DEFAULT (0),
    IsLocked          BIT           NOT NULL CONSTRAINT DF_pex_act_lock DEFAULT (0),
    RocCode           NVARCHAR(50)  NULL,
    DataDate          DATE          NULL,
    CONSTRAINT UQ_pex_activity_proj_code UNIQUE (ProjectCode, Code),
    CONSTRAINT FK_pex_activity_project FOREIGN KEY (ProjectCode) REFERENCES dbo.pex_project (ProjectCode),
    CONSTRAINT FK_pex_activity_wbs FOREIGN KEY (WbsId) REFERENCES dbo.pex_wbs (Id),
    CONSTRAINT FK_pex_activity_roc FOREIGN KEY (RocCode) REFERENCES dbo.pex_roc (RocCode)
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.pex_activity'), N'IX_pex_activity_wbs', N'IndexID') IS NULL
  CREATE INDEX IX_pex_activity_wbs ON dbo.pex_activity (ProjectCode, WbsId);
GO

IF OBJECT_ID(N'dbo.pex_activity_step', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pex_activity_step (
    Id            INT           NOT NULL IDENTITY(1,1) CONSTRAINT PK_pex_activity_step PRIMARY KEY,
    ActivityId    INT           NOT NULL,
    StepSeq       INT           NOT NULL,
    NameFa        NVARCHAR(200) NOT NULL,
    NameEn        NVARCHAR(200) NULL,
    Weight        DECIMAL(8,4)  NOT NULL CONSTRAINT CK_pex_step_w CHECK (Weight >= 0 AND Weight <= 1),
    TargetQty     DECIMAL(18,4) NOT NULL CONSTRAINT DF_pex_step_tq DEFAULT (0),
    Uom           NVARCHAR(20)  NULL,
    ApprovedQty   DECIMAL(18,4) NOT NULL CONSTRAINT DF_pex_step_aq DEFAULT (0),
    CONSTRAINT UQ_pex_step_act_seq UNIQUE (ActivityId, StepSeq),
    CONSTRAINT FK_pex_step_activity FOREIGN KEY (ActivityId) REFERENCES dbo.pex_activity (Id)
  );
END
GO

IF OBJECT_ID(N'dbo.pex_milestone', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pex_milestone (
    Id              INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_pex_milestone PRIMARY KEY,
    ProjectCode     NVARCHAR(50)   NOT NULL,
    ActivityId      INT            NULL,
    Code            NVARCHAR(50)   NOT NULL,
    MsType          NVARCHAR(30)   NOT NULL CONSTRAINT CK_pex_ms_type CHECK (MsType IN (N'Contractual', N'Key', N'Payment', N'Gate', N'Internal', N'Interface')),
    Status          NVARCHAR(20)   NOT NULL CONSTRAINT DF_pex_ms_st DEFAULT (N'OnTrack'),
    ContractualDate DATE           NULL,
    ForecastDate    DATE           NULL,
    ContractualFa   NVARCHAR(20)   NULL,
    ForecastFa      NVARCHAR(20)   NULL,
    PenaltyPerDay   DECIMAL(18,2)  NOT NULL CONSTRAINT DF_pex_ms_pen DEFAULT (0),
    OwnerOrg        NVARCHAR(30)   NULL,
    Priority        NVARCHAR(20)   NULL,
    CONSTRAINT UQ_pex_ms_proj_code UNIQUE (ProjectCode, Code),
    CONSTRAINT FK_pex_ms_project FOREIGN KEY (ProjectCode) REFERENCES dbo.pex_project (ProjectCode),
    CONSTRAINT FK_pex_ms_activity FOREIGN KEY (ActivityId) REFERENCES dbo.pex_activity (Id)
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.pex_milestone'), N'IX_pex_ms_status', N'IndexID') IS NULL
  CREATE INDEX IX_pex_ms_status ON dbo.pex_milestone (ProjectCode, Status, ContractualDate);
GO
