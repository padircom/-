/* ─────────────────────────────────────────────────────────────
   F5-G2 · PEX DPR tables (SQL Server 2008 R2 سازگار)
   مبنا: docs/PEX_D9_SiteOps.md — جریان Draft → Submit → Approved
   فقط خطوط Approved وارد roll-up گام/فعالیت می‌شوند.
   ───────────────────────────────────────────────────────────── */

IF OBJECT_ID(N'dbo.pex_dpr', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pex_dpr (
    Id              INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_pex_dpr PRIMARY KEY,
    ProjectCode     NVARCHAR(50)   NOT NULL,
    ReportNo        NVARCHAR(30)   NOT NULL,
    ReportDate      DATE           NOT NULL,
    Shift           NVARCHAR(10)   NOT NULL CONSTRAINT CK_pex_dpr_shift CHECK (Shift IN (N'A', N'B', N'C', N'N')),
    Weather         NVARCHAR(100)  NULL,
    Status          NVARCHAR(30)   NOT NULL CONSTRAINT DF_pex_dpr_st DEFAULT (N'draft')
                      CONSTRAINT CK_pex_dpr_status CHECK (Status IN (N'draft', N'submitted', N'approved', N'rejected', N'revision_required')),
    ManpowerJson    NVARCHAR(MAX)  NULL,
    EquipmentJson   NVARCHAR(MAX)  NULL,
    StopsJson       NVARCHAR(MAX)  NULL,
    SafetyJson      NVARCHAR(MAX)  NULL,
    EvidenceDmsId   NVARCHAR(100)  NULL,
    AssigneeRole    NVARCHAR(60)   NULL,
    CreatedBy       NVARCHAR(100)  NULL,
    CreatedAt       DATETIME       NOT NULL CONSTRAINT DF_pex_dpr_ca DEFAULT (GETUTCDATE()),
    UpdatedAt       DATETIME       NULL,
    CONSTRAINT UQ_pex_dpr_proj_no UNIQUE (ProjectCode, ReportNo),
    CONSTRAINT FK_pex_dpr_project FOREIGN KEY (ProjectCode) REFERENCES dbo.pex_project (ProjectCode)
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.pex_dpr'), N'IX_pex_dpr_proj_date', N'IndexID') IS NULL
  CREATE INDEX IX_pex_dpr_proj_date ON dbo.pex_dpr (ProjectCode, ReportDate, Shift);
GO

IF OBJECT_ID(N'dbo.pex_progress_line', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pex_progress_line (
    Id            INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_pex_progress_line PRIMARY KEY,
    DprId         INT            NOT NULL,
    ActivityCode  NVARCHAR(50)   NOT NULL,
    LocationCode  NVARCHAR(50)   NULL,
    StepSeq       INT            NOT NULL,
    Qty           DECIMAL(18,4)  NOT NULL CONSTRAINT CK_pex_pl_qty CHECK (Qty > 0),
    Uom           NVARCHAR(20)   NULL,
    LineStatus    NVARCHAR(20)   NOT NULL CONSTRAINT DF_pex_pl_st DEFAULT (N'draft')
                    CONSTRAINT CK_pex_pl_status CHECK (LineStatus IN (N'draft', N'approved', N'void')),
    ApprovedQty   DECIMAL(18,4)  NULL,
    ApprovedBy    NVARCHAR(100)  NULL,
    ApprovedAt    DATETIME       NULL,
    CrId          NVARCHAR(50)   NULL, -- مجوز ثبت روی فعالیت قفل
    Note          NVARCHAR(500)  NULL,
    CONSTRAINT FK_pex_pl_dpr FOREIGN KEY (DprId) REFERENCES dbo.pex_dpr (Id) ON DELETE CASCADE
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.pex_progress_line'), N'IX_pex_pl_dpr', N'IndexID') IS NULL
  CREATE INDEX IX_pex_pl_dpr ON dbo.pex_progress_line (DprId);
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.pex_progress_line'), N'IX_pex_pl_act', N'IndexID') IS NULL
  CREATE INDEX IX_pex_pl_act ON dbo.pex_progress_line (ActivityCode, StepSeq);
GO

IF OBJECT_ID(N'dbo.pex_dpr_event', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pex_dpr_event (
    Id          INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_pex_dpr_event PRIMARY KEY,
    DprId       INT            NOT NULL,
    ActionCode  NVARCHAR(40)   NOT NULL, -- submit/approve/reject/revise
    FromStatus  NVARCHAR(30)   NOT NULL,
    ToStatus    NVARCHAR(30)   NOT NULL,
    ActorRole   NVARCHAR(60)   NOT NULL,
    Comment     NVARCHAR(2000) NULL,
    CreatedAt   DATETIME       NOT NULL CONSTRAINT DF_pex_dpr_ev_ca DEFAULT (GETUTCDATE()),
    CONSTRAINT FK_pex_dpr_ev_dpr FOREIGN KEY (DprId) REFERENCES dbo.pex_dpr (Id) ON DELETE CASCADE
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.pex_dpr_event'), N'IX_pex_dpr_ev_dpr', N'IndexID') IS NULL
  CREATE INDEX IX_pex_dpr_ev_dpr ON dbo.pex_dpr_event (DprId, Id);
GO
