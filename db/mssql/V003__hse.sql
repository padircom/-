/* ─────────────────────────────────────────────────────────────
   HSE-D2 · جداول ایمنی/بهداشت/محیط (SQL Server 2008 R2 سازگار)
   مبنا: docs/HSE_D2_DataModel.md (طرح §۵ از HSE_D1)
   پیش‌نیاز: V001__pex_core.sql (+ سید pex برای FK)
   اجرا: sqlcmd -S <server> -d <db> -i V003__hse.sql
   ───────────────────────────────────────────────────────────── */

IF OBJECT_ID(N'dbo.hse_incident', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.hse_incident (
    Id            INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_hse_incident PRIMARY KEY,
    ProjectCode   NVARCHAR(50)   NOT NULL,
    Code          NVARCHAR(50)   NOT NULL,
    IncidentDate  DATE           NOT NULL,
    Type          NVARCHAR(20)   NOT NULL CONSTRAINT CK_hse_inc_type CHECK (Type IN (N'near_miss', N'first_aid', N'medical', N'lost_time', N'fatality', N'spill', N'property')),
    SeverityW     DECIMAL(8,2)   NOT NULL CONSTRAINT DF_hse_inc_sev DEFAULT (0),
    LostDays      INT            NOT NULL CONSTRAINT DF_hse_inc_ld DEFAULT (0),
    Area          NVARCHAR(200)  NOT NULL,
    DescFa        NVARCHAR(1000) NOT NULL,
    Status        NVARCHAR(20)   NOT NULL CONSTRAINT DF_hse_inc_st DEFAULT (N'open')
                    CONSTRAINT CK_hse_inc_status CHECK (Status IN (N'open', N'investigating', N'closed')),
    VolumeL       DECIMAL(18,2)  NULL, -- فقط spill
    CreatedAt     DATETIME       NOT NULL CONSTRAINT DF_hse_inc_ca DEFAULT (GETUTCDATE()),
    UpdatedAt     DATETIME       NULL,
    CONSTRAINT UQ_hse_inc_proj_code UNIQUE (ProjectCode, Code),
    CONSTRAINT FK_hse_inc_project FOREIGN KEY (ProjectCode) REFERENCES dbo.pex_project (ProjectCode)
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.hse_incident'), N'IX_hse_inc_proj_date', N'IndexID') IS NULL
  CREATE INDEX IX_hse_inc_proj_date ON dbo.hse_incident (ProjectCode, IncidentDate, Status);
GO

IF OBJECT_ID(N'dbo.hse_permit', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.hse_permit (
    Id            INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_hse_permit PRIMARY KEY,
    ProjectCode   NVARCHAR(50)   NOT NULL,
    No            NVARCHAR(50)   NOT NULL,
    Type          NVARCHAR(20)   NOT NULL CONSTRAINT CK_hse_pmt_type CHECK (Type IN (N'hot', N'cold', N'confined', N'electrical', N'height', N'excavation', N'radiation')),
    Status        NVARCHAR(20)   NOT NULL CONSTRAINT DF_hse_pmt_st DEFAULT (N'draft')
                    CONSTRAINT CK_hse_pmt_status CHECK (Status IN (N'draft', N'requested', N'approved', N'active', N'suspended', N'closed', N'expired')),
    WorkDate      DATE           NOT NULL,
    Area          NVARCHAR(200)  NOT NULL,
    RiskLevel     NVARCHAR(20)   NOT NULL CONSTRAINT CK_hse_pmt_risk CHECK (RiskLevel IN (N'low', N'medium', N'high')),
    FlagsJson     NVARCHAR(MAX)  NULL, -- {gasTest,rescuePlan,isolation,barricade}
    ExpiresAt     DATETIME       NULL,
    CreatedAt     DATETIME       NOT NULL CONSTRAINT DF_hse_pmt_ca DEFAULT (GETUTCDATE()),
    UpdatedAt     DATETIME       NULL,
    CONSTRAINT UQ_hse_pmt_proj_no UNIQUE (ProjectCode, No),
    CONSTRAINT FK_hse_pmt_project FOREIGN KEY (ProjectCode) REFERENCES dbo.pex_project (ProjectCode)
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.hse_permit'), N'IX_hse_pmt_proj_status', N'IndexID') IS NULL
  CREATE INDEX IX_hse_pmt_proj_status ON dbo.hse_permit (ProjectCode, Status, WorkDate);
GO

IF OBJECT_ID(N'dbo.hse_inspection', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.hse_inspection (
    Id            INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_hse_inspection PRIMARY KEY,
    ProjectCode   NVARCHAR(50)   NOT NULL,
    Area          NVARCHAR(200)  NOT NULL,
    InspectDate   DATE           NOT NULL,
    Score         INT            NOT NULL CONSTRAINT CK_hse_insp_score CHECK (Score >= 0 AND Score <= 100),
    Band          CHAR(1)        NOT NULL CONSTRAINT CK_hse_insp_band CHECK (Band IN ('A', 'B', 'C', 'D')),
    ItemsJson     NVARCHAR(MAX)  NOT NULL, -- [{item,ok,na?}]
    NextDue       DATE           NULL, -- قاعده باند A:+90 B:+30 C:+14 D:+7
    CreatedAt     DATETIME       NOT NULL CONSTRAINT DF_hse_insp_ca DEFAULT (GETUTCDATE()),
    CONSTRAINT FK_hse_insp_project FOREIGN KEY (ProjectCode) REFERENCES dbo.pex_project (ProjectCode)
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.hse_inspection'), N'IX_hse_insp_proj_date', N'IndexID') IS NULL
  CREATE INDEX IX_hse_insp_proj_date ON dbo.hse_inspection (ProjectCode, InspectDate);
GO

IF OBJECT_ID(N'dbo.hse_action', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.hse_action (
    Id            INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_hse_action PRIMARY KEY,
    ProjectCode   NVARCHAR(50)   NOT NULL,
    IncidentId    INT            NULL,
    Title         NVARCHAR(500)  NOT NULL,
    DueDate       DATE           NOT NULL,
    ClosedAt      DATE           NULL,
    Severity      NVARCHAR(20)   NOT NULL CONSTRAINT CK_hse_act_sev CHECK (Severity IN (N'low', N'medium', N'high', N'critical')),
    Escalation    NVARCHAR(5)    NULL, -- آخرین L موتور (L0..L3)
    CreatedAt     DATETIME       NOT NULL CONSTRAINT DF_hse_act_ca DEFAULT (GETUTCDATE()),
    UpdatedAt     DATETIME       NULL,
    CONSTRAINT FK_hse_act_project FOREIGN KEY (ProjectCode) REFERENCES dbo.pex_project (ProjectCode),
    CONSTRAINT FK_hse_act_incident FOREIGN KEY (IncidentId) REFERENCES dbo.hse_incident (Id)
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.hse_action'), N'IX_hse_act_proj_due', N'IndexID') IS NULL
  CREATE INDEX IX_hse_act_proj_due ON dbo.hse_action (ProjectCode, DueDate);
GO

IF OBJECT_ID(N'dbo.hse_manhour', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.hse_manhour (
    ProjectCode   NVARCHAR(50)   NOT NULL,
    Period        NVARCHAR(20)   NOT NULL, -- مثل 1405-04
    Hours         DECIMAL(18,2)  NOT NULL CONSTRAINT CK_hse_mh_hours CHECK (Hours >= 0),
    CONSTRAINT PK_hse_manhour PRIMARY KEY (ProjectCode, Period),
    CONSTRAINT FK_hse_mh_project FOREIGN KEY (ProjectCode) REFERENCES dbo.pex_project (ProjectCode)
  );
END
GO

IF OBJECT_ID(N'dbo.hse_tbt', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.hse_tbt (
    Id            INT            NOT NULL IDENTITY(1,1) CONSTRAINT PK_hse_tbt PRIMARY KEY,
    ProjectCode   NVARCHAR(50)   NOT NULL,
    SessionDate   DATE           NOT NULL,
    Area          NVARCHAR(200)  NOT NULL,
    Attendees     INT            NOT NULL CONSTRAINT CK_hse_tbt_att CHECK (Attendees >= 0),
    Topic         NVARCHAR(500)  NOT NULL,
    CreatedAt     DATETIME       NOT NULL CONSTRAINT DF_hse_tbt_ca DEFAULT (GETUTCDATE()),
    CONSTRAINT FK_hse_tbt_project FOREIGN KEY (ProjectCode) REFERENCES dbo.pex_project (ProjectCode)
  );
END
GO

IF INDEXPROPERTY(OBJECT_ID(N'dbo.hse_tbt'), N'IX_hse_tbt_proj_date', N'IndexID') IS NULL
  CREATE INDEX IX_hse_tbt_proj_date ON dbo.hse_tbt (ProjectCode, SessionDate);
GO
