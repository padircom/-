/* GENERATED توسط scripts/generate-schema.mjs — ویرایش دستی ممنوع.
 * بازتولید: npm run db:schema
 * شِمای کاملِ 223 جدولِ ارجاع‌شده در فریم‌ورک. */
export const PMIS_FULL_SCHEMA_SCRIPT = `-- ═══════════════════════════════════════════════════════════════
-- شِمای تولیدشده برای SQL Server — 223 جدول
-- تولید خودکار از روی کد (scripts/generate-schema.mjs) — دستی ویرایش نکنید.
-- اگر شِمای واقعی دارید، database/schema.custom.sql را جایگزین کنید.
-- ═══════════════════════════════════════════════════════════════

IF OBJECT_ID(N'dbo.AI_Config', N'U') IS NULL
CREATE TABLE dbo.AI_Config (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AI_Config PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AI_Config_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_AI_Config_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AI_Config_ProjectCode' AND object_id = OBJECT_ID(N'dbo.AI_Config'))
  CREATE INDEX IX_AI_Config_ProjectCode ON dbo.AI_Config(ProjectCode);

IF OBJECT_ID(N'dbo.AI_Model_Input', N'U') IS NULL
CREATE TABLE dbo.AI_Model_Input (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AI_Model_Input PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AI_Model_Input_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_AI_Model_Input_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AI_Model_Input_ProjectCode' AND object_id = OBJECT_ID(N'dbo.AI_Model_Input'))
  CREATE INDEX IX_AI_Model_Input_ProjectCode ON dbo.AI_Model_Input(ProjectCode);

IF OBJECT_ID(N'dbo.Action_Item', N'U') IS NULL
CREATE TABLE dbo.Action_Item (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Action_Item PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Action_Item_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Action_Item_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Action_Item_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Action_Item'))
  CREATE INDEX IX_Action_Item_ProjectCode ON dbo.Action_Item(ProjectCode);

IF OBJECT_ID(N'dbo.Action_Plan', N'U') IS NULL
CREATE TABLE dbo.Action_Plan (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Action_Plan PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Action_Plan_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Action_Plan_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Action_Plan_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Action_Plan'))
  CREATE INDEX IX_Action_Plan_ProjectCode ON dbo.Action_Plan(ProjectCode);

IF OBJECT_ID(N'dbo.Action_Register', N'U') IS NULL
CREATE TABLE dbo.Action_Register (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Action_Register PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Action_Register_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Action_Register_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Action_Register_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Action_Register'))
  CREATE INDEX IX_Action_Register_ProjectCode ON dbo.Action_Register(ProjectCode);

IF OBJECT_ID(N'dbo.Activity', N'U') IS NULL
CREATE TABLE dbo.Activity (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Activity PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Activity_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Activity_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Activity_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Activity'))
  CREATE INDEX IX_Activity_ProjectCode ON dbo.Activity(ProjectCode);

IF OBJECT_ID(N'dbo.AdjustmentIndexCatalog', N'U') IS NULL
CREATE TABLE dbo.AdjustmentIndexCatalog (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AdjustmentIndexCatalog PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AdjustmentIndexCatalog_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_AdjustmentIndexCatalog_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AdjustmentIndexCatalog_ProjectCode' AND object_id = OBJECT_ID(N'dbo.AdjustmentIndexCatalog'))
  CREATE INDEX IX_AdjustmentIndexCatalog_ProjectCode ON dbo.AdjustmentIndexCatalog(ProjectCode);

IF OBJECT_ID(N'dbo.AdvancePaymentSchedule', N'U') IS NULL
CREATE TABLE dbo.AdvancePaymentSchedule (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AdvancePaymentSchedule PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AdvancePaymentSchedule_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_AdvancePaymentSchedule_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AdvancePaymentSchedule_ProjectCode' AND object_id = OBJECT_ID(N'dbo.AdvancePaymentSchedule'))
  CREATE INDEX IX_AdvancePaymentSchedule_ProjectCode ON dbo.AdvancePaymentSchedule(ProjectCode);

IF OBJECT_ID(N'dbo.Advance_Ledger', N'U') IS NULL
CREATE TABLE dbo.Advance_Ledger (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Advance_Ledger PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Advance_Ledger_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Advance_Ledger_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Advance_Ledger_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Advance_Ledger'))
  CREATE INDEX IX_Advance_Ledger_ProjectCode ON dbo.Advance_Ledger(ProjectCode);

IF OBJECT_ID(N'dbo.Alert_Register', N'U') IS NULL
CREATE TABLE dbo.Alert_Register (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Alert_Register PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Alert_Register_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Alert_Register_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Alert_Register_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Alert_Register'))
  CREATE INDEX IX_Alert_Register_ProjectCode ON dbo.Alert_Register(ProjectCode);

IF OBJECT_ID(N'dbo.ApprovalAuthority', N'U') IS NULL
CREATE TABLE dbo.ApprovalAuthority (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ApprovalAuthority PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ApprovalAuthority_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ApprovalAuthority_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ApprovalAuthority_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ApprovalAuthority'))
  CREATE INDEX IX_ApprovalAuthority_ProjectCode ON dbo.ApprovalAuthority(ProjectCode);

IF OBJECT_ID(N'dbo.AspectImpact', N'U') IS NULL
CREATE TABLE dbo.AspectImpact (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AspectImpact PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AspectImpact_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_AspectImpact_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AspectImpact_ProjectCode' AND object_id = OBJECT_ID(N'dbo.AspectImpact'))
  CREATE INDEX IX_AspectImpact_ProjectCode ON dbo.AspectImpact(ProjectCode);

IF OBJECT_ID(N'dbo.Audit_Finding', N'U') IS NULL
CREATE TABLE dbo.Audit_Finding (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Audit_Finding PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Audit_Finding_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Audit_Finding_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Audit_Finding_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Audit_Finding'))
  CREATE INDEX IX_Audit_Finding_ProjectCode ON dbo.Audit_Finding(ProjectCode);

IF OBJECT_ID(N'dbo.Audit_Log', N'U') IS NULL
CREATE TABLE dbo.Audit_Log (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Audit_Log PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    ActionCode NVARCHAR(50) NULL,
    EntityName NVARCHAR(200) NULL,
    EntityId BIGINT NULL,
    AfterJson DATETIME2(0) NULL,
    IpAddress NVARCHAR(200) NULL,
    UserId BIGINT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Audit_Log_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Audit_Log_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Audit_Log_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Audit_Log'))
  CREATE INDEX IX_Audit_Log_ProjectCode ON dbo.Audit_Log(ProjectCode);

IF OBJECT_ID(N'dbo.Audit_Register', N'U') IS NULL
CREATE TABLE dbo.Audit_Register (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Audit_Register PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Audit_Register_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Audit_Register_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Audit_Register_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Audit_Register'))
  CREATE INDEX IX_Audit_Register_ProjectCode ON dbo.Audit_Register(ProjectCode);

IF OBJECT_ID(N'dbo.BOQ_QuantityChange', N'U') IS NULL
CREATE TABLE dbo.BOQ_QuantityChange (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BOQ_QuantityChange PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BOQ_QuantityChange_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_BOQ_QuantityChange_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BOQ_QuantityChange_ProjectCode' AND object_id = OBJECT_ID(N'dbo.BOQ_QuantityChange'))
  CREATE INDEX IX_BOQ_QuantityChange_ProjectCode ON dbo.BOQ_QuantityChange(ProjectCode);

IF OBJECT_ID(N'dbo.BackToBackDeduction', N'U') IS NULL
CREATE TABLE dbo.BackToBackDeduction (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BackToBackDeduction PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BackToBackDeduction_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_BackToBackDeduction_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BackToBackDeduction_ProjectCode' AND object_id = OBJECT_ID(N'dbo.BackToBackDeduction'))
  CREATE INDEX IX_BackToBackDeduction_ProjectCode ON dbo.BackToBackDeduction(ProjectCode);

IF OBJECT_ID(N'dbo.Boq_Item', N'U') IS NULL
CREATE TABLE dbo.Boq_Item (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Boq_Item PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Boq_Item_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Boq_Item_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Boq_Item_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Boq_Item'))
  CREATE INDEX IX_Boq_Item_ProjectCode ON dbo.Boq_Item(ProjectCode);

IF OBJECT_ID(N'dbo.Boq_Measurement', N'U') IS NULL
CREATE TABLE dbo.Boq_Measurement (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Boq_Measurement PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Boq_Measurement_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Boq_Measurement_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Boq_Measurement_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Boq_Measurement'))
  CREATE INDEX IX_Boq_Measurement_ProjectCode ON dbo.Boq_Measurement(ProjectCode);

IF OBJECT_ID(N'dbo.BreakdownNode', N'U') IS NULL
CREATE TABLE dbo.BreakdownNode (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BreakdownNode PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_BreakdownNode_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_BreakdownNode_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BreakdownNode_ProjectCode' AND object_id = OBJECT_ID(N'dbo.BreakdownNode'))
  CREATE INDEX IX_BreakdownNode_ProjectCode ON dbo.BreakdownNode(ProjectCode);

IF OBJECT_ID(N'dbo.Bsc_Perspective', N'U') IS NULL
CREATE TABLE dbo.Bsc_Perspective (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Bsc_Perspective PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Bsc_Perspective_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Bsc_Perspective_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Bsc_Perspective_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Bsc_Perspective'))
  CREATE INDEX IX_Bsc_Perspective_ProjectCode ON dbo.Bsc_Perspective(ProjectCode);

IF OBJECT_ID(N'dbo.CAPA_Action', N'U') IS NULL
CREATE TABLE dbo.CAPA_Action (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CAPA_Action PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CAPA_Action_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CAPA_Action_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CAPA_Action_ProjectCode' AND object_id = OBJECT_ID(N'dbo.CAPA_Action'))
  CREATE INDEX IX_CAPA_Action_ProjectCode ON dbo.CAPA_Action(ProjectCode);

IF OBJECT_ID(N'dbo.CapaAction', N'U') IS NULL
CREATE TABLE dbo.CapaAction (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CapaAction PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CapaAction_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CapaAction_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CapaAction_ProjectCode' AND object_id = OBJECT_ID(N'dbo.CapaAction'))
  CREATE INDEX IX_CapaAction_ProjectCode ON dbo.CapaAction(ProjectCode);

IF OBJECT_ID(N'dbo.Cash_Flow', N'U') IS NULL
CREATE TABLE dbo.Cash_Flow (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cash_Flow PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Cash_Flow_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Cash_Flow_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Cash_Flow_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Cash_Flow'))
  CREATE INDEX IX_Cash_Flow_ProjectCode ON dbo.Cash_Flow(ProjectCode);

IF OBJECT_ID(N'dbo.Cashflow_Plan', N'U') IS NULL
CREATE TABLE dbo.Cashflow_Plan (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cashflow_Plan PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Cashflow_Plan_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Cashflow_Plan_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Cashflow_Plan_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Cashflow_Plan'))
  CREATE INDEX IX_Cashflow_Plan_ProjectCode ON dbo.Cashflow_Plan(ProjectCode);

IF OBJECT_ID(N'dbo.Change_Request', N'U') IS NULL
CREATE TABLE dbo.Change_Request (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Change_Request PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Change_Request_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Change_Request_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Change_Request_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Change_Request'))
  CREATE INDEX IX_Change_Request_ProjectCode ON dbo.Change_Request(ProjectCode);

IF OBJECT_ID(N'dbo.CheckRecordPack', N'U') IS NULL
CREATE TABLE dbo.CheckRecordPack (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CheckRecordPack PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CheckRecordPack_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CheckRecordPack_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CheckRecordPack_ProjectCode' AND object_id = OBJECT_ID(N'dbo.CheckRecordPack'))
  CREATE INDEX IX_CheckRecordPack_ProjectCode ON dbo.CheckRecordPack(ProjectCode);

IF OBJECT_ID(N'dbo.CheckSheet', N'U') IS NULL
CREATE TABLE dbo.CheckSheet (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CheckSheet PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CheckSheet_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CheckSheet_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CheckSheet_ProjectCode' AND object_id = OBJECT_ID(N'dbo.CheckSheet'))
  CREATE INDEX IX_CheckSheet_ProjectCode ON dbo.CheckSheet(ProjectCode);

IF OBJECT_ID(N'dbo.Claim_Register', N'U') IS NULL
CREATE TABLE dbo.Claim_Register (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Claim_Register PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Claim_Register_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Claim_Register_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Claim_Register_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Claim_Register'))
  CREATE INDEX IX_Claim_Register_ProjectCode ON dbo.Claim_Register(ProjectCode);

IF OBJECT_ID(N'dbo.CompletionCertificate', N'U') IS NULL
CREATE TABLE dbo.CompletionCertificate (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CompletionCertificate PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CompletionCertificate_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CompletionCertificate_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CompletionCertificate_ProjectCode' AND object_id = OBJECT_ID(N'dbo.CompletionCertificate'))
  CREATE INDEX IX_CompletionCertificate_ProjectCode ON dbo.CompletionCertificate(ProjectCode);

IF OBJECT_ID(N'dbo.Completion_Certificate', N'U') IS NULL
CREATE TABLE dbo.Completion_Certificate (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Completion_Certificate PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Completion_Certificate_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Completion_Certificate_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Completion_Certificate_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Completion_Certificate'))
  CREATE INDEX IX_Completion_Certificate_ProjectCode ON dbo.Completion_Certificate(ProjectCode);

IF OBJECT_ID(N'dbo.Connection_Strings', N'U') IS NULL
CREATE TABLE dbo.Connection_Strings (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Connection_Strings PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Connection_Strings_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Connection_Strings_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Connection_Strings_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Connection_Strings'))
  CREATE INDEX IX_Connection_Strings_ProjectCode ON dbo.Connection_Strings(ProjectCode);

IF OBJECT_ID(N'dbo.ContractAlertRule', N'U') IS NULL
CREATE TABLE dbo.ContractAlertRule (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ContractAlertRule PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ContractAlertRule_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ContractAlertRule_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ContractAlertRule_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ContractAlertRule'))
  CREATE INDEX IX_ContractAlertRule_ProjectCode ON dbo.ContractAlertRule(ProjectCode);

IF OBJECT_ID(N'dbo.ContractAmendment', N'U') IS NULL
CREATE TABLE dbo.ContractAmendment (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ContractAmendment PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ContractAmendment_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ContractAmendment_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ContractAmendment_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ContractAmendment'))
  CREATE INDEX IX_ContractAmendment_ProjectCode ON dbo.ContractAmendment(ProjectCode);

IF OBJECT_ID(N'dbo.ContractBOQ_Item', N'U') IS NULL
CREATE TABLE dbo.ContractBOQ_Item (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ContractBOQ_Item PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ContractBOQ_Item_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ContractBOQ_Item_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ContractBOQ_Item_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ContractBOQ_Item'))
  CREATE INDEX IX_ContractBOQ_Item_ProjectCode ON dbo.ContractBOQ_Item(ProjectCode);

IF OBJECT_ID(N'dbo.ContractFinPosting', N'U') IS NULL
CREATE TABLE dbo.ContractFinPosting (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ContractFinPosting PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ContractFinPosting_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ContractFinPosting_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ContractFinPosting_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ContractFinPosting'))
  CREATE INDEX IX_ContractFinPosting_ProjectCode ON dbo.ContractFinPosting(ProjectCode);

IF OBJECT_ID(N'dbo.ContractGuarantee', N'U') IS NULL
CREATE TABLE dbo.ContractGuarantee (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ContractGuarantee PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ContractGuarantee_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ContractGuarantee_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ContractGuarantee_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ContractGuarantee'))
  CREATE INDEX IX_ContractGuarantee_ProjectCode ON dbo.ContractGuarantee(ProjectCode);

IF OBJECT_ID(N'dbo.ContractMaster', N'U') IS NULL
CREATE TABLE dbo.ContractMaster (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ContractMaster PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ContractMaster_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ContractMaster_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ContractMaster_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ContractMaster'))
  CREATE INDEX IX_ContractMaster_ProjectCode ON dbo.ContractMaster(ProjectCode);

IF OBJECT_ID(N'dbo.ContractMetricsSnapshot', N'U') IS NULL
CREATE TABLE dbo.ContractMetricsSnapshot (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ContractMetricsSnapshot PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ContractMetricsSnapshot_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ContractMetricsSnapshot_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ContractMetricsSnapshot_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ContractMetricsSnapshot'))
  CREATE INDEX IX_ContractMetricsSnapshot_ProjectCode ON dbo.ContractMetricsSnapshot(ProjectCode);

IF OBJECT_ID(N'dbo.Contractor_Performance', N'U') IS NULL
CREATE TABLE dbo.Contractor_Performance (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Contractor_Performance PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Contractor_Performance_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Contractor_Performance_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Contractor_Performance_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Contractor_Performance'))
  CREATE INDEX IX_Contractor_Performance_ProjectCode ON dbo.Contractor_Performance(ProjectCode);

IF OBJECT_ID(N'dbo.Correspondence_Master', N'U') IS NULL
CREATE TABLE dbo.Correspondence_Master (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Correspondence_Master PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Correspondence_Master_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Correspondence_Master_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Correspondence_Master_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Correspondence_Master'))
  CREATE INDEX IX_Correspondence_Master_ProjectCode ON dbo.Correspondence_Master(ProjectCode);

IF OBJECT_ID(N'dbo.Cost_Transaction', N'U') IS NULL
CREATE TABLE dbo.Cost_Transaction (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cost_Transaction PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Cost_Transaction_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Cost_Transaction_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Cost_Transaction_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Cost_Transaction'))
  CREATE INDEX IX_Cost_Transaction_ProjectCode ON dbo.Cost_Transaction(ProjectCode);

IF OBJECT_ID(N'dbo.CrsComment', N'U') IS NULL
CREATE TABLE dbo.CrsComment (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CrsComment PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CrsComment_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CrsComment_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CrsComment_ProjectCode' AND object_id = OBJECT_ID(N'dbo.CrsComment'))
  CREATE INDEX IX_CrsComment_ProjectCode ON dbo.CrsComment(ProjectCode);

IF OBJECT_ID(N'dbo.CtrDocument', N'U') IS NULL
CREATE TABLE dbo.CtrDocument (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CtrDocument PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CtrDocument_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_CtrDocument_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CtrDocument_ProjectCode' AND object_id = OBJECT_ID(N'dbo.CtrDocument'))
  CREATE INDEX IX_CtrDocument_ProjectCode ON dbo.CtrDocument(ProjectCode);

IF OBJECT_ID(N'dbo.Daily_Report', N'U') IS NULL
CREATE TABLE dbo.Daily_Report (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Daily_Report PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    ReportNo NVARCHAR(50) NULL,
    ReportDate DATETIME2(0) NULL,
    HeaderJson DATETIME2(0) NULL,
    Status NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Daily_Report_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Daily_Report_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Daily_Report_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Daily_Report'))
  CREATE INDEX IX_Daily_Report_ProjectCode ON dbo.Daily_Report(ProjectCode);

IF OBJECT_ID(N'dbo.Decision_Log', N'U') IS NULL
CREATE TABLE dbo.Decision_Log (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Decision_Log PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Decision_Log_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Decision_Log_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Decision_Log_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Decision_Log'))
  CREATE INDEX IX_Decision_Log_ProjectCode ON dbo.Decision_Log(ProjectCode);

IF OBJECT_ID(N'dbo.Delay_Register', N'U') IS NULL
CREATE TABLE dbo.Delay_Register (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Delay_Register PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Delay_Register_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Delay_Register_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Delay_Register_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Delay_Register'))
  CREATE INDEX IX_Delay_Register_ProjectCode ON dbo.Delay_Register(ProjectCode);

IF OBJECT_ID(N'dbo.Document_Master', N'U') IS NULL
CREATE TABLE dbo.Document_Master (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Document_Master PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Document_Master_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Document_Master_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Document_Master_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Document_Master'))
  CREATE INDEX IX_Document_Master_ProjectCode ON dbo.Document_Master(ProjectCode);

IF OBJECT_ID(N'dbo.Document_Revision', N'U') IS NULL
CREATE TABLE dbo.Document_Revision (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Document_Revision PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Document_Revision_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Document_Revision_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Document_Revision_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Document_Revision'))
  CREATE INDEX IX_Document_Revision_ProjectCode ON dbo.Document_Revision(ProjectCode);

IF OBJECT_ID(N'dbo.Document_Status', N'U') IS NULL
CREATE TABLE dbo.Document_Status (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Document_Status PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Document_Status_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Document_Status_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Document_Status_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Document_Status'))
  CREATE INDEX IX_Document_Status_ProjectCode ON dbo.Document_Status(ProjectCode);

IF OBJECT_ID(N'dbo.Document_Transaction', N'U') IS NULL
CREATE TABLE dbo.Document_Transaction (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Document_Transaction PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Document_Transaction_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Document_Transaction_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Document_Transaction_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Document_Transaction'))
  CREATE INDEX IX_Document_Transaction_ProjectCode ON dbo.Document_Transaction(ProjectCode);

IF OBJECT_ID(N'dbo.DossierItem', N'U') IS NULL
CREATE TABLE dbo.DossierItem (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DossierItem PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_DossierItem_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_DossierItem_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DossierItem_ProjectCode' AND object_id = OBJECT_ID(N'dbo.DossierItem'))
  CREATE INDEX IX_DossierItem_ProjectCode ON dbo.DossierItem(ProjectCode);

IF OBJECT_ID(N'dbo.EVM_Transaction', N'U') IS NULL
CREATE TABLE dbo.EVM_Transaction (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EVM_Transaction PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EVM_Transaction_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_EVM_Transaction_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EVM_Transaction_ProjectCode' AND object_id = OBJECT_ID(N'dbo.EVM_Transaction'))
  CREATE INDEX IX_EVM_Transaction_ProjectCode ON dbo.EVM_Transaction(ProjectCode);

IF OBJECT_ID(N'dbo.Efqm_Assessment', N'U') IS NULL
CREATE TABLE dbo.Efqm_Assessment (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Efqm_Assessment PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Efqm_Assessment_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Efqm_Assessment_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Efqm_Assessment_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Efqm_Assessment'))
  CREATE INDEX IX_Efqm_Assessment_ProjectCode ON dbo.Efqm_Assessment(ProjectCode);

IF OBJECT_ID(N'dbo.Efqm_Improvement', N'U') IS NULL
CREATE TABLE dbo.Efqm_Improvement (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Efqm_Improvement PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Efqm_Improvement_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Efqm_Improvement_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Efqm_Improvement_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Efqm_Improvement'))
  CREATE INDEX IX_Efqm_Improvement_ProjectCode ON dbo.Efqm_Improvement(ProjectCode);

IF OBJECT_ID(N'dbo.Efqm_Score', N'U') IS NULL
CREATE TABLE dbo.Efqm_Score (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Efqm_Score PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Efqm_Score_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Efqm_Score_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Efqm_Score_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Efqm_Score'))
  CREATE INDEX IX_Efqm_Score_ProjectCode ON dbo.Efqm_Score(ProjectCode);

IF OBJECT_ID(N'dbo.EngineeringProgressSnapshot', N'U') IS NULL
CREATE TABLE dbo.EngineeringProgressSnapshot (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EngineeringProgressSnapshot PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EngineeringProgressSnapshot_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_EngineeringProgressSnapshot_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EngineeringProgressSnapshot_ProjectCode' AND object_id = OBJECT_ID(N'dbo.EngineeringProgressSnapshot'))
  CREATE INDEX IX_EngineeringProgressSnapshot_ProjectCode ON dbo.EngineeringProgressSnapshot(ProjectCode);

IF OBJECT_ID(N'dbo.EngineeringRevision', N'U') IS NULL
CREATE TABLE dbo.EngineeringRevision (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EngineeringRevision PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EngineeringRevision_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_EngineeringRevision_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EngineeringRevision_ProjectCode' AND object_id = OBJECT_ID(N'dbo.EngineeringRevision'))
  CREATE INDEX IX_EngineeringRevision_ProjectCode ON dbo.EngineeringRevision(ProjectCode);

IF OBJECT_ID(N'dbo.EnvironmentalAspect', N'U') IS NULL
CREATE TABLE dbo.EnvironmentalAspect (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EnvironmentalAspect PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EnvironmentalAspect_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_EnvironmentalAspect_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EnvironmentalAspect_ProjectCode' AND object_id = OBJECT_ID(N'dbo.EnvironmentalAspect'))
  CREATE INDEX IX_EnvironmentalAspect_ProjectCode ON dbo.EnvironmentalAspect(ProjectCode);

IF OBJECT_ID(N'dbo.EnvironmentalMonitoring', N'U') IS NULL
CREATE TABLE dbo.EnvironmentalMonitoring (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EnvironmentalMonitoring PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EnvironmentalMonitoring_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_EnvironmentalMonitoring_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EnvironmentalMonitoring_ProjectCode' AND object_id = OBJECT_ID(N'dbo.EnvironmentalMonitoring'))
  CREATE INDEX IX_EnvironmentalMonitoring_ProjectCode ON dbo.EnvironmentalMonitoring(ProjectCode);

IF OBJECT_ID(N'dbo.Equipment', N'U') IS NULL
CREATE TABLE dbo.Equipment (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Equipment PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Equipment_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Equipment_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Equipment_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Equipment'))
  CREATE INDEX IX_Equipment_ProjectCode ON dbo.Equipment(ProjectCode);

IF OBJECT_ID(N'dbo.EquipmentDispatch', N'U') IS NULL
CREATE TABLE dbo.EquipmentDispatch (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EquipmentDispatch PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EquipmentDispatch_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_EquipmentDispatch_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EquipmentDispatch_ProjectCode' AND object_id = OBJECT_ID(N'dbo.EquipmentDispatch'))
  CREATE INDEX IX_EquipmentDispatch_ProjectCode ON dbo.EquipmentDispatch(ProjectCode);

IF OBJECT_ID(N'dbo.EquipmentFuelLog', N'U') IS NULL
CREATE TABLE dbo.EquipmentFuelLog (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EquipmentFuelLog PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EquipmentFuelLog_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_EquipmentFuelLog_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EquipmentFuelLog_ProjectCode' AND object_id = OBJECT_ID(N'dbo.EquipmentFuelLog'))
  CREATE INDEX IX_EquipmentFuelLog_ProjectCode ON dbo.EquipmentFuelLog(ProjectCode);

IF OBJECT_ID(N'dbo.EquipmentMeter', N'U') IS NULL
CREATE TABLE dbo.EquipmentMeter (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EquipmentMeter PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EquipmentMeter_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_EquipmentMeter_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EquipmentMeter_ProjectCode' AND object_id = OBJECT_ID(N'dbo.EquipmentMeter'))
  CREATE INDEX IX_EquipmentMeter_ProjectCode ON dbo.EquipmentMeter(ProjectCode);

IF OBJECT_ID(N'dbo.EquipmentRental', N'U') IS NULL
CREATE TABLE dbo.EquipmentRental (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EquipmentRental PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EquipmentRental_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_EquipmentRental_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_EquipmentRental_ProjectCode' AND object_id = OBJECT_ID(N'dbo.EquipmentRental'))
  CREATE INDEX IX_EquipmentRental_ProjectCode ON dbo.EquipmentRental(ProjectCode);

IF OBJECT_ID(N'dbo.ExtraWorkItem', N'U') IS NULL
CREATE TABLE dbo.ExtraWorkItem (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ExtraWorkItem PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ExtraWorkItem_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ExtraWorkItem_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ExtraWorkItem_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ExtraWorkItem'))
  CREATE INDEX IX_ExtraWorkItem_ProjectCode ON dbo.ExtraWorkItem(ProjectCode);

IF OBJECT_ID(N'dbo.GasTestLog', N'U') IS NULL
CREATE TABLE dbo.GasTestLog (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_GasTestLog PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_GasTestLog_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_GasTestLog_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GasTestLog_ProjectCode' AND object_id = OBJECT_ID(N'dbo.GasTestLog'))
  CREATE INDEX IX_GasTestLog_ProjectCode ON dbo.GasTestLog(ProjectCode);

IF OBJECT_ID(N'dbo.GateRule', N'U') IS NULL
CREATE TABLE dbo.GateRule (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_GateRule PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_GateRule_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_GateRule_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_GateRule_ProjectCode' AND object_id = OBJECT_ID(N'dbo.GateRule'))
  CREATE INDEX IX_GateRule_ProjectCode ON dbo.GateRule(ProjectCode);

IF OBJECT_ID(N'dbo.HSE_AlertRule', N'U') IS NULL
CREATE TABLE dbo.HSE_AlertRule (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HSE_AlertRule PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HSE_AlertRule_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_HSE_AlertRule_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HSE_AlertRule_ProjectCode' AND object_id = OBJECT_ID(N'dbo.HSE_AlertRule'))
  CREATE INDEX IX_HSE_AlertRule_ProjectCode ON dbo.HSE_AlertRule(ProjectCode);

IF OBJECT_ID(N'dbo.HSE_Investigation', N'U') IS NULL
CREATE TABLE dbo.HSE_Investigation (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HSE_Investigation PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HSE_Investigation_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_HSE_Investigation_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HSE_Investigation_ProjectCode' AND object_id = OBJECT_ID(N'dbo.HSE_Investigation'))
  CREATE INDEX IX_HSE_Investigation_ProjectCode ON dbo.HSE_Investigation(ProjectCode);

IF OBJECT_ID(N'dbo.HSE_ManHourLog', N'U') IS NULL
CREATE TABLE dbo.HSE_ManHourLog (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HSE_ManHourLog PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HSE_ManHourLog_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_HSE_ManHourLog_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HSE_ManHourLog_ProjectCode' AND object_id = OBJECT_ID(N'dbo.HSE_ManHourLog'))
  CREATE INDEX IX_HSE_ManHourLog_ProjectCode ON dbo.HSE_ManHourLog(ProjectCode);

IF OBJECT_ID(N'dbo.HSE_MetricSnapshot', N'U') IS NULL
CREATE TABLE dbo.HSE_MetricSnapshot (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HSE_MetricSnapshot PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HSE_MetricSnapshot_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_HSE_MetricSnapshot_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HSE_MetricSnapshot_ProjectCode' AND object_id = OBJECT_ID(N'dbo.HSE_MetricSnapshot'))
  CREATE INDEX IX_HSE_MetricSnapshot_ProjectCode ON dbo.HSE_MetricSnapshot(ProjectCode);

IF OBJECT_ID(N'dbo.HSE_RiskAssessment', N'U') IS NULL
CREATE TABLE dbo.HSE_RiskAssessment (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HSE_RiskAssessment PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HSE_RiskAssessment_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_HSE_RiskAssessment_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HSE_RiskAssessment_ProjectCode' AND object_id = OBJECT_ID(N'dbo.HSE_RiskAssessment'))
  CREATE INDEX IX_HSE_RiskAssessment_ProjectCode ON dbo.HSE_RiskAssessment(ProjectCode);

IF OBJECT_ID(N'dbo.HSE_Violation', N'U') IS NULL
CREATE TABLE dbo.HSE_Violation (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HSE_Violation PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HSE_Violation_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_HSE_Violation_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HSE_Violation_ProjectCode' AND object_id = OBJECT_ID(N'dbo.HSE_Violation'))
  CREATE INDEX IX_HSE_Violation_ProjectCode ON dbo.HSE_Violation(ProjectCode);

IF OBJECT_ID(N'dbo.HandoverDossier', N'U') IS NULL
CREATE TABLE dbo.HandoverDossier (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HandoverDossier PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HandoverDossier_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_HandoverDossier_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HandoverDossier_ProjectCode' AND object_id = OBJECT_ID(N'dbo.HandoverDossier'))
  CREATE INDEX IX_HandoverDossier_ProjectCode ON dbo.HandoverDossier(ProjectCode);

IF OBJECT_ID(N'dbo.HealthExamination', N'U') IS NULL
CREATE TABLE dbo.HealthExamination (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HealthExamination PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HealthExamination_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_HealthExamination_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HealthExamination_ProjectCode' AND object_id = OBJECT_ID(N'dbo.HealthExamination'))
  CREATE INDEX IX_HealthExamination_ProjectCode ON dbo.HealthExamination(ProjectCode);

IF OBJECT_ID(N'dbo.Heat_Trace_Link', N'U') IS NULL
CREATE TABLE dbo.Heat_Trace_Link (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Heat_Trace_Link PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Heat_Trace_Link_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Heat_Trace_Link_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Heat_Trace_Link_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Heat_Trace_Link'))
  CREATE INDEX IX_Heat_Trace_Link_ProjectCode ON dbo.Heat_Trace_Link(ProjectCode);

IF OBJECT_ID(N'dbo.IPC_Deduction', N'U') IS NULL
CREATE TABLE dbo.IPC_Deduction (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IPC_Deduction PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IPC_Deduction_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_IPC_Deduction_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_IPC_Deduction_ProjectCode' AND object_id = OBJECT_ID(N'dbo.IPC_Deduction'))
  CREATE INDEX IX_IPC_Deduction_ProjectCode ON dbo.IPC_Deduction(ProjectCode);

IF OBJECT_ID(N'dbo.IPC_LineItem', N'U') IS NULL
CREATE TABLE dbo.IPC_LineItem (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IPC_LineItem PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IPC_LineItem_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_IPC_LineItem_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_IPC_LineItem_ProjectCode' AND object_id = OBJECT_ID(N'dbo.IPC_LineItem'))
  CREATE INDEX IX_IPC_LineItem_ProjectCode ON dbo.IPC_LineItem(ProjectCode);

IF OBJECT_ID(N'dbo.IPC_WorkflowStep', N'U') IS NULL
CREATE TABLE dbo.IPC_WorkflowStep (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IPC_WorkflowStep PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IPC_WorkflowStep_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_IPC_WorkflowStep_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_IPC_WorkflowStep_ProjectCode' AND object_id = OBJECT_ID(N'dbo.IPC_WorkflowStep'))
  CREATE INDEX IX_IPC_WorkflowStep_ProjectCode ON dbo.IPC_WorkflowStep(ProjectCode);

IF OBJECT_ID(N'dbo.ITP_Master', N'U') IS NULL
CREATE TABLE dbo.ITP_Master (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ITP_Master PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ITP_Master_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ITP_Master_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ITP_Master_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ITP_Master'))
  CREATE INDEX IX_ITP_Master_ProjectCode ON dbo.ITP_Master(ProjectCode);

IF OBJECT_ID(N'dbo.ITP_Point', N'U') IS NULL
CREATE TABLE dbo.ITP_Point (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ITP_Point PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ITP_Point_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ITP_Point_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ITP_Point_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ITP_Point'))
  CREATE INDEX IX_ITP_Point_ProjectCode ON dbo.ITP_Point(ProjectCode);

IF OBJECT_ID(N'dbo.Industry_Master', N'U') IS NULL
CREATE TABLE dbo.Industry_Master (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Industry_Master PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    Code NVARCHAR(50) NULL,
    TitleFa NVARCHAR(MAX) NULL,
    TitleEn NVARCHAR(MAX) NULL,
    Icon DATETIME2(0) NULL,
    Color NVARCHAR(50) NULL,
    IsActive BIT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Industry_Master_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Industry_Master_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Industry_Master_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Industry_Master'))
  CREATE INDEX IX_Industry_Master_ProjectCode ON dbo.Industry_Master(ProjectCode);

IF OBJECT_ID(N'dbo.Initiative_Link', N'U') IS NULL
CREATE TABLE dbo.Initiative_Link (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Initiative_Link PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Initiative_Link_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Initiative_Link_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Initiative_Link_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Initiative_Link'))
  CREATE INDEX IX_Initiative_Link_ProjectCode ON dbo.Initiative_Link(ProjectCode);

IF OBJECT_ID(N'dbo.InjuredPerson', N'U') IS NULL
CREATE TABLE dbo.InjuredPerson (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InjuredPerson PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_InjuredPerson_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_InjuredPerson_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_InjuredPerson_ProjectCode' AND object_id = OBJECT_ID(N'dbo.InjuredPerson'))
  CREATE INDEX IX_InjuredPerson_ProjectCode ON dbo.InjuredPerson(ProjectCode);

IF OBJECT_ID(N'dbo.InspectionFinding', N'U') IS NULL
CREATE TABLE dbo.InspectionFinding (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InspectionFinding PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_InspectionFinding_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_InspectionFinding_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_InspectionFinding_ProjectCode' AND object_id = OBJECT_ID(N'dbo.InspectionFinding'))
  CREATE INDEX IX_InspectionFinding_ProjectCode ON dbo.InspectionFinding(ProjectCode);

IF OBJECT_ID(N'dbo.Inspection_Request', N'U') IS NULL
CREATE TABLE dbo.Inspection_Request (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Inspection_Request PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Inspection_Request_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Inspection_Request_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Inspection_Request_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Inspection_Request'))
  CREATE INDEX IX_Inspection_Request_ProjectCode ON dbo.Inspection_Request(ProjectCode);

IF OBJECT_ID(N'dbo.Inspection_Result', N'U') IS NULL
CREATE TABLE dbo.Inspection_Result (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Inspection_Result PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Inspection_Result_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Inspection_Result_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Inspection_Result_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Inspection_Result'))
  CREATE INDEX IX_Inspection_Result_ProjectCode ON dbo.Inspection_Result(ProjectCode);

IF OBJECT_ID(N'dbo.Integration_Log', N'U') IS NULL
CREATE TABLE dbo.Integration_Log (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Integration_Log PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Integration_Log_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Integration_Log_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Integration_Log_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Integration_Log'))
  CREATE INDEX IX_Integration_Log_ProjectCode ON dbo.Integration_Log(ProjectCode);

IF OBJECT_ID(N'dbo.InterfaceClashLog', N'U') IS NULL
CREATE TABLE dbo.InterfaceClashLog (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InterfaceClashLog PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_InterfaceClashLog_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_InterfaceClashLog_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_InterfaceClashLog_ProjectCode' AND object_id = OBJECT_ID(N'dbo.InterfaceClashLog'))
  CREATE INDEX IX_InterfaceClashLog_ProjectCode ON dbo.InterfaceClashLog(ProjectCode);

IF OBJECT_ID(N'dbo.InterimPaymentCertificate', N'U') IS NULL
CREATE TABLE dbo.InterimPaymentCertificate (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_InterimPaymentCertificate PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_InterimPaymentCertificate_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_InterimPaymentCertificate_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_InterimPaymentCertificate_ProjectCode' AND object_id = OBJECT_ID(N'dbo.InterimPaymentCertificate'))
  CREATE INDEX IX_InterimPaymentCertificate_ProjectCode ON dbo.InterimPaymentCertificate(ProjectCode);

IF OBJECT_ID(N'dbo.Ipc_Certificate', N'U') IS NULL
CREATE TABLE dbo.Ipc_Certificate (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Ipc_Certificate PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Ipc_Certificate_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Ipc_Certificate_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Ipc_Certificate_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Ipc_Certificate'))
  CREATE INDEX IX_Ipc_Certificate_ProjectCode ON dbo.Ipc_Certificate(ProjectCode);

IF OBJECT_ID(N'dbo.IsolationLog', N'U') IS NULL
CREATE TABLE dbo.IsolationLog (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_IsolationLog PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_IsolationLog_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_IsolationLog_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_IsolationLog_ProjectCode' AND object_id = OBJECT_ID(N'dbo.IsolationLog'))
  CREATE INDEX IX_IsolationLog_ProjectCode ON dbo.IsolationLog(ProjectCode);

IF OBJECT_ID(N'dbo.JSA_Control', N'U') IS NULL
CREATE TABLE dbo.JSA_Control (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_JSA_Control PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_JSA_Control_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_JSA_Control_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JSA_Control_ProjectCode' AND object_id = OBJECT_ID(N'dbo.JSA_Control'))
  CREATE INDEX IX_JSA_Control_ProjectCode ON dbo.JSA_Control(ProjectCode);

IF OBJECT_ID(N'dbo.JSA_Hazard', N'U') IS NULL
CREATE TABLE dbo.JSA_Hazard (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_JSA_Hazard PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_JSA_Hazard_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_JSA_Hazard_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JSA_Hazard_ProjectCode' AND object_id = OBJECT_ID(N'dbo.JSA_Hazard'))
  CREATE INDEX IX_JSA_Hazard_ProjectCode ON dbo.JSA_Hazard(ProjectCode);

IF OBJECT_ID(N'dbo.JSA_JobStep', N'U') IS NULL
CREATE TABLE dbo.JSA_JobStep (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_JSA_JobStep PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_JSA_JobStep_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_JSA_JobStep_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_JSA_JobStep_ProjectCode' AND object_id = OBJECT_ID(N'dbo.JSA_JobStep'))
  CREATE INDEX IX_JSA_JobStep_ProjectCode ON dbo.JSA_JobStep(ProjectCode);

IF OBJECT_ID(N'dbo.KPI_Master', N'U') IS NULL
CREATE TABLE dbo.KPI_Master (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KPI_Master PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_KPI_Master_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_KPI_Master_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_KPI_Master_ProjectCode' AND object_id = OBJECT_ID(N'dbo.KPI_Master'))
  CREATE INDEX IX_KPI_Master_ProjectCode ON dbo.KPI_Master(ProjectCode);

IF OBJECT_ID(N'dbo.KPI_Value', N'U') IS NULL
CREATE TABLE dbo.KPI_Value (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KPI_Value PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_KPI_Value_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_KPI_Value_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_KPI_Value_ProjectCode' AND object_id = OBJECT_ID(N'dbo.KPI_Value'))
  CREATE INDEX IX_KPI_Value_ProjectCode ON dbo.KPI_Value(ProjectCode);

IF OBJECT_ID(N'dbo.Knowledge_Base', N'U') IS NULL
CREATE TABLE dbo.Knowledge_Base (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Knowledge_Base PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Knowledge_Base_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Knowledge_Base_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Knowledge_Base_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Knowledge_Base'))
  CREATE INDEX IX_Knowledge_Base_ProjectCode ON dbo.Knowledge_Base(ProjectCode);

IF OBJECT_ID(N'dbo.KpiSnapshot', N'U') IS NULL
CREATE TABLE dbo.KpiSnapshot (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_KpiSnapshot PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_KpiSnapshot_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_KpiSnapshot_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_KpiSnapshot_ProjectCode' AND object_id = OBJECT_ID(N'dbo.KpiSnapshot'))
  CREATE INDEX IX_KpiSnapshot_ProjectCode ON dbo.KpiSnapshot(ProjectCode);

IF OBJECT_ID(N'dbo.LessonLearned', N'U') IS NULL
CREATE TABLE dbo.LessonLearned (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LessonLearned PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_LessonLearned_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_LessonLearned_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LessonLearned_ProjectCode' AND object_id = OBJECT_ID(N'dbo.LessonLearned'))
  CREATE INDEX IX_LessonLearned_ProjectCode ON dbo.LessonLearned(ProjectCode);

IF OBJECT_ID(N'dbo.Logistics_Route', N'U') IS NULL
CREATE TABLE dbo.Logistics_Route (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Logistics_Route PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Logistics_Route_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Logistics_Route_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Logistics_Route_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Logistics_Route'))
  CREATE INDEX IX_Logistics_Route_ProjectCode ON dbo.Logistics_Route(ProjectCode);

IF OBJECT_ID(N'dbo.LumpSumMilestone', N'U') IS NULL
CREATE TABLE dbo.LumpSumMilestone (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LumpSumMilestone PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_LumpSumMilestone_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_LumpSumMilestone_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LumpSumMilestone_ProjectCode' AND object_id = OBJECT_ID(N'dbo.LumpSumMilestone'))
  CREATE INDEX IX_LumpSumMilestone_ProjectCode ON dbo.LumpSumMilestone(ProjectCode);

IF OBJECT_ID(N'dbo.MaintenanceOrder', N'U') IS NULL
CREATE TABLE dbo.MaintenanceOrder (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MaintenanceOrder PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MaintenanceOrder_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_MaintenanceOrder_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MaintenanceOrder_ProjectCode' AND object_id = OBJECT_ID(N'dbo.MaintenanceOrder'))
  CREATE INDEX IX_MaintenanceOrder_ProjectCode ON dbo.MaintenanceOrder(ProjectCode);

IF OBJECT_ID(N'dbo.MaterialDiffCalc', N'U') IS NULL
CREATE TABLE dbo.MaterialDiffCalc (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MaterialDiffCalc PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MaterialDiffCalc_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_MaterialDiffCalc_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MaterialDiffCalc_ProjectCode' AND object_id = OBJECT_ID(N'dbo.MaterialDiffCalc'))
  CREATE INDEX IX_MaterialDiffCalc_ProjectCode ON dbo.MaterialDiffCalc(ProjectCode);

IF OBJECT_ID(N'dbo.Material_Certificate', N'U') IS NULL
CREATE TABLE dbo.Material_Certificate (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Material_Certificate PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Material_Certificate_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Material_Certificate_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Material_Certificate_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Material_Certificate'))
  CREATE INDEX IX_Material_Certificate_ProjectCode ON dbo.Material_Certificate(ProjectCode);

IF OBJECT_ID(N'dbo.Material_Issue', N'U') IS NULL
CREATE TABLE dbo.Material_Issue (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Material_Issue PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Material_Issue_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Material_Issue_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Material_Issue_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Material_Issue'))
  CREATE INDEX IX_Material_Issue_ProjectCode ON dbo.Material_Issue(ProjectCode);

IF OBJECT_ID(N'dbo.Material_Ledger', N'U') IS NULL
CREATE TABLE dbo.Material_Ledger (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Material_Ledger PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Material_Ledger_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Material_Ledger_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Material_Ledger_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Material_Ledger'))
  CREATE INDEX IX_Material_Ledger_ProjectCode ON dbo.Material_Ledger(ProjectCode);

IF OBJECT_ID(N'dbo.Material_Norm', N'U') IS NULL
CREATE TABLE dbo.Material_Norm (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Material_Norm PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Material_Norm_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Material_Norm_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Material_Norm_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Material_Norm'))
  CREATE INDEX IX_Material_Norm_ProjectCode ON dbo.Material_Norm(ProjectCode);

IF OBJECT_ID(N'dbo.Material_Register', N'U') IS NULL
CREATE TABLE dbo.Material_Register (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Material_Register PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Material_Register_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Material_Register_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Material_Register_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Material_Register'))
  CREATE INDEX IX_Material_Register_ProjectCode ON dbo.Material_Register(ProjectCode);

IF OBJECT_ID(N'dbo.MdrDeliverable', N'U') IS NULL
CREATE TABLE dbo.MdrDeliverable (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MdrDeliverable PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MdrDeliverable_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_MdrDeliverable_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MdrDeliverable_ProjectCode' AND object_id = OBJECT_ID(N'dbo.MdrDeliverable'))
  CREATE INDEX IX_MdrDeliverable_ProjectCode ON dbo.MdrDeliverable(ProjectCode);

IF OBJECT_ID(N'dbo.MeasurementSheet', N'U') IS NULL
CREATE TABLE dbo.MeasurementSheet (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MeasurementSheet PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_MeasurementSheet_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_MeasurementSheet_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MeasurementSheet_ProjectCode' AND object_id = OBJECT_ID(N'dbo.MeasurementSheet'))
  CREATE INDEX IX_MeasurementSheet_ProjectCode ON dbo.MeasurementSheet(ProjectCode);

IF OBJECT_ID(N'dbo.Measurement_Approval', N'U') IS NULL
CREATE TABLE dbo.Measurement_Approval (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Measurement_Approval PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Measurement_Approval_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Measurement_Approval_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Measurement_Approval_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Measurement_Approval'))
  CREATE INDEX IX_Measurement_Approval_ProjectCode ON dbo.Measurement_Approval(ProjectCode);

IF OBJECT_ID(N'dbo.Monthly_Report', N'U') IS NULL
CREATE TABLE dbo.Monthly_Report (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Monthly_Report PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Monthly_Report_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Monthly_Report_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Monthly_Report_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Monthly_Report'))
  CREATE INDEX IX_Monthly_Report_ProjectCode ON dbo.Monthly_Report(ProjectCode);

IF OBJECT_ID(N'dbo.NCR_Register', N'U') IS NULL
CREATE TABLE dbo.NCR_Register (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_NCR_Register PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_NCR_Register_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_NCR_Register_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_NCR_Register_ProjectCode' AND object_id = OBJECT_ID(N'dbo.NCR_Register'))
  CREATE INDEX IX_NCR_Register_ProjectCode ON dbo.NCR_Register(ProjectCode);

IF OBJECT_ID(N'dbo.Ncr', N'U') IS NULL
CREATE TABLE dbo.Ncr (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Ncr PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Ncr_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Ncr_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Ncr_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Ncr'))
  CREATE INDEX IX_Ncr_ProjectCode ON dbo.Ncr(ProjectCode);

IF OBJECT_ID(N'dbo.Notification_Queue', N'U') IS NULL
CREATE TABLE dbo.Notification_Queue (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notification_Queue PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    Channel NVARCHAR(200) NULL,
    Recipient NVARCHAR(200) NULL,
    Subject NVARCHAR(200) NULL,
    Body NVARCHAR(MAX) NULL,
    Priority NVARCHAR(200) NULL,
    RelatedEntity NVARCHAR(200) NULL,
    RelatedEntityId BIGINT NULL,
    Status NVARCHAR(50) NULL,
    Attempts NVARCHAR(200) NULL,
    LastError NVARCHAR(200) NULL,
    SentAt DATETIME2(0) NULL,
    SCOPE_IDENTITY NVARCHAR(200) NULL,
    Number NVARCHAR(50) NULL,
    CREATE_NOTIFICATION DATETIME2(0) NULL,
    Notification_Queue NVARCHAR(200) NULL,
    String NVARCHAR(200) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Notification_Queue_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Notification_Queue_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Notification_Queue_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Notification_Queue'))
  CREATE INDEX IX_Notification_Queue_ProjectCode ON dbo.Notification_Queue(ProjectCode);

IF OBJECT_ID(N'dbo.OccupationalHazard', N'U') IS NULL
CREATE TABLE dbo.OccupationalHazard (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OccupationalHazard PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_OccupationalHazard_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_OccupationalHazard_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_OccupationalHazard_ProjectCode' AND object_id = OBJECT_ID(N'dbo.OccupationalHazard'))
  CREATE INDEX IX_OccupationalHazard_ProjectCode ON dbo.OccupationalHazard(ProjectCode);

IF OBJECT_ID(N'dbo.PTW_Approval', N'U') IS NULL
CREATE TABLE dbo.PTW_Approval (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PTW_Approval PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PTW_Approval_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_PTW_Approval_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PTW_Approval_ProjectCode' AND object_id = OBJECT_ID(N'dbo.PTW_Approval'))
  CREATE INDEX IX_PTW_Approval_ProjectCode ON dbo.PTW_Approval(ProjectCode);

IF OBJECT_ID(N'dbo.PTW_Precaution', N'U') IS NULL
CREATE TABLE dbo.PTW_Precaution (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PTW_Precaution PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PTW_Precaution_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_PTW_Precaution_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PTW_Precaution_ProjectCode' AND object_id = OBJECT_ID(N'dbo.PTW_Precaution'))
  CREATE INDEX IX_PTW_Precaution_ProjectCode ON dbo.PTW_Precaution(ProjectCode);

IF OBJECT_ID(N'dbo.PartTransaction', N'U') IS NULL
CREATE TABLE dbo.PartTransaction (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PartTransaction PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PartTransaction_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_PartTransaction_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PartTransaction_ProjectCode' AND object_id = OBJECT_ID(N'dbo.PartTransaction'))
  CREATE INDEX IX_PartTransaction_ProjectCode ON dbo.PartTransaction(ProjectCode);

IF OBJECT_ID(N'dbo.PerformanceTestReading', N'U') IS NULL
CREATE TABLE dbo.PerformanceTestReading (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PerformanceTestReading PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PerformanceTestReading_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_PerformanceTestReading_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PerformanceTestReading_ProjectCode' AND object_id = OBJECT_ID(N'dbo.PerformanceTestReading'))
  CREATE INDEX IX_PerformanceTestReading_ProjectCode ON dbo.PerformanceTestReading(ProjectCode);

IF OBJECT_ID(N'dbo.PerformanceTestRun', N'U') IS NULL
CREATE TABLE dbo.PerformanceTestRun (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PerformanceTestRun PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PerformanceTestRun_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_PerformanceTestRun_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PerformanceTestRun_ProjectCode' AND object_id = OBJECT_ID(N'dbo.PerformanceTestRun'))
  CREATE INDEX IX_PerformanceTestRun_ProjectCode ON dbo.PerformanceTestRun(ProjectCode);

IF OBJECT_ID(N'dbo.PmSchedule', N'U') IS NULL
CREATE TABLE dbo.PmSchedule (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PmSchedule PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PmSchedule_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_PmSchedule_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PmSchedule_ProjectCode' AND object_id = OBJECT_ID(N'dbo.PmSchedule'))
  CREATE INDEX IX_PmSchedule_ProjectCode ON dbo.PmSchedule(ProjectCode);

IF OBJECT_ID(N'dbo.Portfolio_Snapshot', N'U') IS NULL
CREATE TABLE dbo.Portfolio_Snapshot (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Portfolio_Snapshot PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    ActiveProjects NVARCHAR(200) NULL,
    TenderProjects NVARCHAR(200) NULL,
    StoppedProjects NVARCHAR(200) NULL,
    CompletedProjects NVARCHAR(200) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Portfolio_Snapshot_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Portfolio_Snapshot_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Portfolio_Snapshot_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Portfolio_Snapshot'))
  CREATE INDEX IX_Portfolio_Snapshot_ProjectCode ON dbo.Portfolio_Snapshot(ProjectCode);

IF OBJECT_ID(N'dbo.PpeIssuance', N'U') IS NULL
CREATE TABLE dbo.PpeIssuance (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PpeIssuance PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PpeIssuance_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_PpeIssuance_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PpeIssuance_ProjectCode' AND object_id = OBJECT_ID(N'dbo.PpeIssuance'))
  CREATE INDEX IX_PpeIssuance_ProjectCode ON dbo.PpeIssuance(ProjectCode);

IF OBJECT_ID(N'dbo.PriceAdjustmentCalculation', N'U') IS NULL
CREATE TABLE dbo.PriceAdjustmentCalculation (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PriceAdjustmentCalculation PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PriceAdjustmentCalculation_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_PriceAdjustmentCalculation_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PriceAdjustmentCalculation_ProjectCode' AND object_id = OBJECT_ID(N'dbo.PriceAdjustmentCalculation'))
  CREATE INDEX IX_PriceAdjustmentCalculation_ProjectCode ON dbo.PriceAdjustmentCalculation(ProjectCode);

IF OBJECT_ID(N'dbo.Process_Master', N'U') IS NULL
CREATE TABLE dbo.Process_Master (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Process_Master PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Process_Master_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Process_Master_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Process_Master_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Process_Master'))
  CREATE INDEX IX_Process_Master_ProjectCode ON dbo.Process_Master(ProjectCode);

IF OBJECT_ID(N'dbo.Production_Log', N'U') IS NULL
CREATE TABLE dbo.Production_Log (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Production_Log PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Production_Log_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Production_Log_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Production_Log_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Production_Log'))
  CREATE INDEX IX_Production_Log_ProjectCode ON dbo.Production_Log(ProjectCode);

IF OBJECT_ID(N'dbo.Progress_Transaction', N'U') IS NULL
CREATE TABLE dbo.Progress_Transaction (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Progress_Transaction PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Progress_Transaction_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Progress_Transaction_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Progress_Transaction_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Progress_Transaction'))
  CREATE INDEX IX_Progress_Transaction_ProjectCode ON dbo.Progress_Transaction(ProjectCode);

IF OBJECT_ID(N'dbo.ProjectClosureRecord', N'U') IS NULL
CREATE TABLE dbo.ProjectClosureRecord (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProjectClosureRecord PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ProjectClosureRecord_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ProjectClosureRecord_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ProjectClosureRecord_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ProjectClosureRecord'))
  CREATE INDEX IX_ProjectClosureRecord_ProjectCode ON dbo.ProjectClosureRecord(ProjectCode);

IF OBJECT_ID(N'dbo.Project_Budget', N'U') IS NULL
CREATE TABLE dbo.Project_Budget (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Project_Budget PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Project_Budget_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Project_Budget_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Project_Budget_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Project_Budget'))
  CREATE INDEX IX_Project_Budget_ProjectCode ON dbo.Project_Budget(ProjectCode);

IF OBJECT_ID(N'dbo.Project_Master', N'U') IS NULL
CREATE TABLE dbo.Project_Master (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Project_Master PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    IndustryCode NVARCHAR(50) NULL,
    NameFa NVARCHAR(MAX) NULL,
    NameEn NVARCHAR(MAX) NULL,
    ClientFa NVARCHAR(MAX) NULL,
    LocationFa NVARCHAR(MAX) NULL,
    Budget NVARCHAR(200) NULL,
    Status NVARCHAR(50) NULL,
    Progress DECIMAL(18,4) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Project_Master_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Project_Master_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Project_Master_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Project_Master'))
  CREATE INDEX IX_Project_Master_ProjectCode ON dbo.Project_Master(ProjectCode);

IF OBJECT_ID(N'dbo.Project_Site', N'U') IS NULL
CREATE TABLE dbo.Project_Site (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Project_Site PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Project_Site_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Project_Site_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Project_Site_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Project_Site'))
  CREATE INDEX IX_Project_Site_ProjectCode ON dbo.Project_Site(ProjectCode);

IF OBJECT_ID(N'dbo.PunchListItem', N'U') IS NULL
CREATE TABLE dbo.PunchListItem (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PunchListItem PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PunchListItem_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_PunchListItem_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PunchListItem_ProjectCode' AND object_id = OBJECT_ID(N'dbo.PunchListItem'))
  CREATE INDEX IX_PunchListItem_ProjectCode ON dbo.PunchListItem(ProjectCode);

IF OBJECT_ID(N'dbo.Punch_List', N'U') IS NULL
CREATE TABLE dbo.Punch_List (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Punch_List PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Punch_List_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Punch_List_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Punch_List_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Punch_List'))
  CREATE INDEX IX_Punch_List_ProjectCode ON dbo.Punch_List(ProjectCode);

IF OBJECT_ID(N'dbo.Purchase_Order', N'U') IS NULL
CREATE TABLE dbo.Purchase_Order (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Purchase_Order PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Purchase_Order_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Purchase_Order_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Purchase_Order_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Purchase_Order'))
  CREATE INDEX IX_Purchase_Order_ProjectCode ON dbo.Purchase_Order(ProjectCode);

IF OBJECT_ID(N'dbo.Purchase_Request', N'U') IS NULL
CREATE TABLE dbo.Purchase_Request (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Purchase_Request PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Purchase_Request_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Purchase_Request_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Purchase_Request_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Purchase_Request'))
  CREATE INDEX IX_Purchase_Request_ProjectCode ON dbo.Purchase_Request(ProjectCode);

IF OBJECT_ID(N'dbo.Quality_Audit', N'U') IS NULL
CREATE TABLE dbo.Quality_Audit (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Quality_Audit PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Quality_Audit_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Quality_Audit_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Quality_Audit_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Quality_Audit'))
  CREATE INDEX IX_Quality_Audit_ProjectCode ON dbo.Quality_Audit(ProjectCode);

IF OBJECT_ID(N'dbo.Quality_Dossier', N'U') IS NULL
CREATE TABLE dbo.Quality_Dossier (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Quality_Dossier PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Quality_Dossier_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Quality_Dossier_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Quality_Dossier_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Quality_Dossier'))
  CREATE INDEX IX_Quality_Dossier_ProjectCode ON dbo.Quality_Dossier(ProjectCode);

IF OBJECT_ID(N'dbo.Quality_Plan', N'U') IS NULL
CREATE TABLE dbo.Quality_Plan (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Quality_Plan PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Quality_Plan_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Quality_Plan_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Quality_Plan_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Quality_Plan'))
  CREATE INDEX IX_Quality_Plan_ProjectCode ON dbo.Quality_Plan(ProjectCode);

IF OBJECT_ID(N'dbo.RetainageLedger', N'U') IS NULL
CREATE TABLE dbo.RetainageLedger (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RetainageLedger PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RetainageLedger_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_RetainageLedger_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RetainageLedger_ProjectCode' AND object_id = OBJECT_ID(N'dbo.RetainageLedger'))
  CREATE INDEX IX_RetainageLedger_ProjectCode ON dbo.RetainageLedger(ProjectCode);

IF OBJECT_ID(N'dbo.Retention_Ledger', N'U') IS NULL
CREATE TABLE dbo.Retention_Ledger (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Retention_Ledger PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Retention_Ledger_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Retention_Ledger_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Retention_Ledger_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Retention_Ledger'))
  CREATE INDEX IX_Retention_Ledger_ProjectCode ON dbo.Retention_Ledger(ProjectCode);

IF OBJECT_ID(N'dbo.Risk_Assessment', N'U') IS NULL
CREATE TABLE dbo.Risk_Assessment (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Risk_Assessment PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Risk_Assessment_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Risk_Assessment_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Risk_Assessment_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Risk_Assessment'))
  CREATE INDEX IX_Risk_Assessment_ProjectCode ON dbo.Risk_Assessment(ProjectCode);

IF OBJECT_ID(N'dbo.Risk_Register', N'U') IS NULL
CREATE TABLE dbo.Risk_Register (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Risk_Register PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Risk_Register_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Risk_Register_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Risk_Register_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Risk_Register'))
  CREATE INDEX IX_Risk_Register_ProjectCode ON dbo.Risk_Register(ProjectCode);

IF OBJECT_ID(N'dbo.RootCauseNode', N'U') IS NULL
CREATE TABLE dbo.RootCauseNode (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RootCauseNode PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_RootCauseNode_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_RootCauseNode_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RootCauseNode_ProjectCode' AND object_id = OBJECT_ID(N'dbo.RootCauseNode'))
  CREATE INDEX IX_RootCauseNode_ProjectCode ON dbo.RootCauseNode(ProjectCode);

IF OBJECT_ID(N'dbo.SafetyIncident', N'U') IS NULL
CREATE TABLE dbo.SafetyIncident (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SafetyIncident PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SafetyIncident_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_SafetyIncident_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SafetyIncident_ProjectCode' AND object_id = OBJECT_ID(N'dbo.SafetyIncident'))
  CREATE INDEX IX_SafetyIncident_ProjectCode ON dbo.SafetyIncident(ProjectCode);

IF OBJECT_ID(N'dbo.SafetyInspection', N'U') IS NULL
CREATE TABLE dbo.SafetyInspection (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SafetyInspection PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SafetyInspection_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_SafetyInspection_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SafetyInspection_ProjectCode' AND object_id = OBJECT_ID(N'dbo.SafetyInspection'))
  CREATE INDEX IX_SafetyInspection_ProjectCode ON dbo.SafetyInspection(ProjectCode);

IF OBJECT_ID(N'dbo.SafetyTrainingRecord', N'U') IS NULL
CREATE TABLE dbo.SafetyTrainingRecord (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SafetyTrainingRecord PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SafetyTrainingRecord_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_SafetyTrainingRecord_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SafetyTrainingRecord_ProjectCode' AND object_id = OBJECT_ID(N'dbo.SafetyTrainingRecord'))
  CREATE INDEX IX_SafetyTrainingRecord_ProjectCode ON dbo.SafetyTrainingRecord(ProjectCode);

IF OBJECT_ID(N'dbo.Scenario_Model', N'U') IS NULL
CREATE TABLE dbo.Scenario_Model (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Scenario_Model PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Scenario_Model_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Scenario_Model_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Scenario_Model_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Scenario_Model'))
  CREATE INDEX IX_Scenario_Model_ProjectCode ON dbo.Scenario_Model(ProjectCode);

IF OBJECT_ID(N'dbo.Schedule_Activity', N'U') IS NULL
CREATE TABLE dbo.Schedule_Activity (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Schedule_Activity PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    ScheduleId BIGINT NULL,
    ActivityCode NVARCHAR(50) NULL,
    ActivityName NVARCHAR(200) NULL,
    StartDate DATETIME2(0) NULL,
    FinishDate DATETIME2(0) NULL,
    DurationDays DECIMAL(18,4) NULL,
    Progress DECIMAL(18,4) NULL,
    IsCritical BIT NULL,
    WbsId BIGINT NULL,
    ISNULL BIT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Schedule_Activity_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Schedule_Activity_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Schedule_Activity_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Schedule_Activity'))
  CREATE INDEX IX_Schedule_Activity_ProjectCode ON dbo.Schedule_Activity(ProjectCode);

IF OBJECT_ID(N'dbo.Schedule_Master', N'U') IS NULL
CREATE TABLE dbo.Schedule_Master (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Schedule_Master PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    ScheduleName NVARCHAR(200) NULL,
    SourceSystem NVARCHAR(200) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Schedule_Master_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Schedule_Master_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Schedule_Master_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Schedule_Master'))
  CREATE INDEX IX_Schedule_Master_ProjectCode ON dbo.Schedule_Master(ProjectCode);

IF OBJECT_ID(N'dbo.Schema_Config', N'U') IS NULL
CREATE TABLE dbo.Schema_Config (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Schema_Config PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Schema_Config_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Schema_Config_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Schema_Config_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Schema_Config'))
  CREATE INDEX IX_Schema_Config_ProjectCode ON dbo.Schema_Config(ProjectCode);

IF OBJECT_ID(N'dbo.Schema_Version', N'U') IS NULL
CREATE TABLE dbo.Schema_Version (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Schema_Version PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    VersionNo NVARCHAR(50) NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Schema_Version_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Schema_Version_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Schema_Version_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Schema_Version'))
  CREATE INDEX IX_Schema_Version_ProjectCode ON dbo.Schema_Version(ProjectCode);

IF OBJECT_ID(N'dbo.Sensitivity_Run', N'U') IS NULL
CREATE TABLE dbo.Sensitivity_Run (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Sensitivity_Run PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Sensitivity_Run_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Sensitivity_Run_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Sensitivity_Run_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Sensitivity_Run'))
  CREATE INDEX IX_Sensitivity_Run_ProjectCode ON dbo.Sensitivity_Run(ProjectCode);

IF OBJECT_ID(N'dbo.SparePart', N'U') IS NULL
CREATE TABLE dbo.SparePart (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SparePart PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SparePart_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_SparePart_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SparePart_ProjectCode' AND object_id = OBJECT_ID(N'dbo.SparePart'))
  CREATE INDEX IX_SparePart_ProjectCode ON dbo.SparePart(ProjectCode);

IF OBJECT_ID(N'dbo.SquadCheck', N'U') IS NULL
CREATE TABLE dbo.SquadCheck (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SquadCheck PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SquadCheck_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_SquadCheck_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SquadCheck_ProjectCode' AND object_id = OBJECT_ID(N'dbo.SquadCheck'))
  CREATE INDEX IX_SquadCheck_ProjectCode ON dbo.SquadCheck(ProjectCode);

IF OBJECT_ID(N'dbo.Stakeholder_Register', N'U') IS NULL
CREATE TABLE dbo.Stakeholder_Register (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Stakeholder_Register PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Stakeholder_Register_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Stakeholder_Register_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Stakeholder_Register_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Stakeholder_Register'))
  CREATE INDEX IX_Stakeholder_Register_ProjectCode ON dbo.Stakeholder_Register(ProjectCode);

IF OBJECT_ID(N'dbo.Strategy_Initiative', N'U') IS NULL
CREATE TABLE dbo.Strategy_Initiative (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Strategy_Initiative PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Strategy_Initiative_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Strategy_Initiative_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Strategy_Initiative_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Strategy_Initiative'))
  CREATE INDEX IX_Strategy_Initiative_ProjectCode ON dbo.Strategy_Initiative(ProjectCode);

IF OBJECT_ID(N'dbo.Strategy_Kpi', N'U') IS NULL
CREATE TABLE dbo.Strategy_Kpi (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Strategy_Kpi PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Strategy_Kpi_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Strategy_Kpi_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Strategy_Kpi_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Strategy_Kpi'))
  CREATE INDEX IX_Strategy_Kpi_ProjectCode ON dbo.Strategy_Kpi(ProjectCode);

IF OBJECT_ID(N'dbo.Strategy_Kpi_Value', N'U') IS NULL
CREATE TABLE dbo.Strategy_Kpi_Value (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Strategy_Kpi_Value PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Strategy_Kpi_Value_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Strategy_Kpi_Value_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Strategy_Kpi_Value_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Strategy_Kpi_Value'))
  CREATE INDEX IX_Strategy_Kpi_Value_ProjectCode ON dbo.Strategy_Kpi_Value(ProjectCode);

IF OBJECT_ID(N'dbo.Strategy_Objective', N'U') IS NULL
CREATE TABLE dbo.Strategy_Objective (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Strategy_Objective PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Strategy_Objective_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Strategy_Objective_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Strategy_Objective_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Strategy_Objective'))
  CREATE INDEX IX_Strategy_Objective_ProjectCode ON dbo.Strategy_Objective(ProjectCode);

IF OBJECT_ID(N'dbo.Strategy_Theme', N'U') IS NULL
CREATE TABLE dbo.Strategy_Theme (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Strategy_Theme PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Strategy_Theme_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Strategy_Theme_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Strategy_Theme_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Strategy_Theme'))
  CREATE INDEX IX_Strategy_Theme_ProjectCode ON dbo.Strategy_Theme(ProjectCode);

IF OBJECT_ID(N'dbo.SubcontractorIPC', N'U') IS NULL
CREATE TABLE dbo.SubcontractorIPC (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SubcontractorIPC PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SubcontractorIPC_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_SubcontractorIPC_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SubcontractorIPC_ProjectCode' AND object_id = OBJECT_ID(N'dbo.SubcontractorIPC'))
  CREATE INDEX IX_SubcontractorIPC_ProjectCode ON dbo.SubcontractorIPC(ProjectCode);

IF OBJECT_ID(N'dbo.SubcontractorIPC_LineItem', N'U') IS NULL
CREATE TABLE dbo.SubcontractorIPC_LineItem (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SubcontractorIPC_LineItem PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SubcontractorIPC_LineItem_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_SubcontractorIPC_LineItem_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SubcontractorIPC_LineItem_ProjectCode' AND object_id = OBJECT_ID(N'dbo.SubcontractorIPC_LineItem'))
  CREATE INDEX IX_SubcontractorIPC_LineItem_ProjectCode ON dbo.SubcontractorIPC_LineItem(ProjectCode);

IF OBJECT_ID(N'dbo.SystemBoundaryMapping', N'U') IS NULL
CREATE TABLE dbo.SystemBoundaryMapping (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SystemBoundaryMapping PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SystemBoundaryMapping_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_SystemBoundaryMapping_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SystemBoundaryMapping_ProjectCode' AND object_id = OBJECT_ID(N'dbo.SystemBoundaryMapping'))
  CREATE INDEX IX_SystemBoundaryMapping_ProjectCode ON dbo.SystemBoundaryMapping(ProjectCode);

IF OBJECT_ID(N'dbo.SystemSubsystem', N'U') IS NULL
CREATE TABLE dbo.SystemSubsystem (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SystemSubsystem PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_SystemSubsystem_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_SystemSubsystem_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_SystemSubsystem_ProjectCode' AND object_id = OBJECT_ID(N'dbo.SystemSubsystem'))
  CREATE INDEX IX_SystemSubsystem_ProjectCode ON dbo.SystemSubsystem(ProjectCode);

IF OBJECT_ID(N'dbo.TechnicalQuery', N'U') IS NULL
CREATE TABLE dbo.TechnicalQuery (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TechnicalQuery PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TechnicalQuery_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_TechnicalQuery_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TechnicalQuery_ProjectCode' AND object_id = OBJECT_ID(N'dbo.TechnicalQuery'))
  CREATE INDEX IX_TechnicalQuery_ProjectCode ON dbo.TechnicalQuery(ProjectCode);

IF OBJECT_ID(N'dbo.Test_Report', N'U') IS NULL
CREATE TABLE dbo.Test_Report (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Report PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Test_Report_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Test_Report_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Test_Report_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Test_Report'))
  CREATE INDEX IX_Test_Report_ProjectCode ON dbo.Test_Report(ProjectCode);

IF OBJECT_ID(N'dbo.Theme_Config', N'U') IS NULL
CREATE TABLE dbo.Theme_Config (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Theme_Config PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Theme_Config_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Theme_Config_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Theme_Config_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Theme_Config'))
  CREATE INDEX IX_Theme_Config_ProjectCode ON dbo.Theme_Config(ProjectCode);

IF OBJECT_ID(N'dbo.TrainingAttendee', N'U') IS NULL
CREATE TABLE dbo.TrainingAttendee (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TrainingAttendee PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TrainingAttendee_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_TrainingAttendee_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TrainingAttendee_ProjectCode' AND object_id = OBJECT_ID(N'dbo.TrainingAttendee'))
  CREATE INDEX IX_TrainingAttendee_ProjectCode ON dbo.TrainingAttendee(ProjectCode);

IF OBJECT_ID(N'dbo.TrainingSession', N'U') IS NULL
CREATE TABLE dbo.TrainingSession (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TrainingSession PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_TrainingSession_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_TrainingSession_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TrainingSession_ProjectCode' AND object_id = OBJECT_ID(N'dbo.TrainingSession'))
  CREATE INDEX IX_TrainingSession_ProjectCode ON dbo.TrainingSession(ProjectCode);

IF OBJECT_ID(N'dbo.Transmittal_Register', N'U') IS NULL
CREATE TABLE dbo.Transmittal_Register (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Transmittal_Register PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Transmittal_Register_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Transmittal_Register_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Transmittal_Register_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Transmittal_Register'))
  CREATE INDEX IX_Transmittal_Register_ProjectCode ON dbo.Transmittal_Register(ProjectCode);

IF OBJECT_ID(N'dbo.Variance_Log', N'U') IS NULL
CREATE TABLE dbo.Variance_Log (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Variance_Log PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Variance_Log_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Variance_Log_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Variance_Log_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Variance_Log'))
  CREATE INDEX IX_Variance_Log_ProjectCode ON dbo.Variance_Log(ProjectCode);

IF OBJECT_ID(N'dbo.VendorPrintReview', N'U') IS NULL
CREATE TABLE dbo.VendorPrintReview (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_VendorPrintReview PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_VendorPrintReview_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_VendorPrintReview_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_VendorPrintReview_ProjectCode' AND object_id = OBJECT_ID(N'dbo.VendorPrintReview'))
  CREATE INDEX IX_VendorPrintReview_ProjectCode ON dbo.VendorPrintReview(ProjectCode);

IF OBJECT_ID(N'dbo.Vendor_Score', N'U') IS NULL
CREATE TABLE dbo.Vendor_Score (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Vendor_Score PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Vendor_Score_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Vendor_Score_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Vendor_Score_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Vendor_Score'))
  CREATE INDEX IX_Vendor_Score_ProjectCode ON dbo.Vendor_Score(ProjectCode);

IF OBJECT_ID(N'dbo.Vendor_Score_History', N'U') IS NULL
CREATE TABLE dbo.Vendor_Score_History (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Vendor_Score_History PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Vendor_Score_History_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Vendor_Score_History_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Vendor_Score_History_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Vendor_Score_History'))
  CREATE INDEX IX_Vendor_Score_History_ProjectCode ON dbo.Vendor_Score_History(ProjectCode);

IF OBJECT_ID(N'dbo.ViolationClosure', N'U') IS NULL
CREATE TABLE dbo.ViolationClosure (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ViolationClosure PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ViolationClosure_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ViolationClosure_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ViolationClosure_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ViolationClosure'))
  CREATE INDEX IX_ViolationClosure_ProjectCode ON dbo.ViolationClosure(ProjectCode);

IF OBJECT_ID(N'dbo.WarrantyClaim', N'U') IS NULL
CREATE TABLE dbo.WarrantyClaim (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WarrantyClaim PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_WarrantyClaim_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_WarrantyClaim_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WarrantyClaim_ProjectCode' AND object_id = OBJECT_ID(N'dbo.WarrantyClaim'))
  CREATE INDEX IX_WarrantyClaim_ProjectCode ON dbo.WarrantyClaim(ProjectCode);

IF OBJECT_ID(N'dbo.WasteLog', N'U') IS NULL
CREATE TABLE dbo.WasteLog (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WasteLog PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_WasteLog_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_WasteLog_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WasteLog_ProjectCode' AND object_id = OBJECT_ID(N'dbo.WasteLog'))
  CREATE INDEX IX_WasteLog_ProjectCode ON dbo.WasteLog(ProjectCode);

IF OBJECT_ID(N'dbo.WbsNode', N'U') IS NULL
CREATE TABLE dbo.WbsNode (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WbsNode PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_WbsNode_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_WbsNode_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WbsNode_ProjectCode' AND object_id = OBJECT_ID(N'dbo.WbsNode'))
  CREATE INDEX IX_WbsNode_ProjectCode ON dbo.WbsNode(ProjectCode);

IF OBJECT_ID(N'dbo.Weekly_Report', N'U') IS NULL
CREATE TABLE dbo.Weekly_Report (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Weekly_Report PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Weekly_Report_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Weekly_Report_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Weekly_Report_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Weekly_Report'))
  CREATE INDEX IX_Weekly_Report_ProjectCode ON dbo.Weekly_Report(ProjectCode);

IF OBJECT_ID(N'dbo.WorkPermit', N'U') IS NULL
CREATE TABLE dbo.WorkPermit (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_WorkPermit PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_WorkPermit_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_WorkPermit_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WorkPermit_ProjectCode' AND object_id = OBJECT_ID(N'dbo.WorkPermit'))
  CREATE INDEX IX_WorkPermit_ProjectCode ON dbo.WorkPermit(ProjectCode);

IF OBJECT_ID(N'dbo.Workflow_Instance', N'U') IS NULL
CREATE TABLE dbo.Workflow_Instance (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Workflow_Instance PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Workflow_Instance_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_Workflow_Instance_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Workflow_Instance_ProjectCode' AND object_id = OBJECT_ID(N'dbo.Workflow_Instance'))
  CREATE INDEX IX_Workflow_Instance_ProjectCode ON dbo.Workflow_Instance(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_action_item', N'U') IS NULL
CREATE TABLE dbo.ckm_action_item (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_action_item PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_action_item_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_action_item_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_action_item_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_action_item'))
  CREATE INDEX IX_ckm_action_item_ProjectCode ON dbo.ckm_action_item(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_alert', N'U') IS NULL
CREATE TABLE dbo.ckm_alert (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_alert PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_alert_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_alert_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_alert_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_alert'))
  CREATE INDEX IX_ckm_alert_ProjectCode ON dbo.ckm_alert(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_comm_matrix', N'U') IS NULL
CREATE TABLE dbo.ckm_comm_matrix (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_comm_matrix PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_comm_matrix_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_comm_matrix_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_comm_matrix_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_comm_matrix'))
  CREATE INDEX IX_ckm_comm_matrix_ProjectCode ON dbo.ckm_comm_matrix(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_engagement_log', N'U') IS NULL
CREATE TABLE dbo.ckm_engagement_log (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_engagement_log PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_engagement_log_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_engagement_log_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_engagement_log_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_engagement_log'))
  CREATE INDEX IX_ckm_engagement_log_ProjectCode ON dbo.ckm_engagement_log(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_lesson', N'U') IS NULL
CREATE TABLE dbo.ckm_lesson (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_lesson PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_lesson_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_lesson_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_lesson_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_lesson'))
  CREATE INDEX IX_ckm_lesson_ProjectCode ON dbo.ckm_lesson(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_lesson_reuse', N'U') IS NULL
CREATE TABLE dbo.ckm_lesson_reuse (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_lesson_reuse PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_lesson_reuse_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_lesson_reuse_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_lesson_reuse_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_lesson_reuse'))
  CREATE INDEX IX_ckm_lesson_reuse_ProjectCode ON dbo.ckm_lesson_reuse(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_letter', N'U') IS NULL
CREATE TABLE dbo.ckm_letter (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_letter PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_letter_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_letter_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_letter_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_letter'))
  CREATE INDEX IX_ckm_letter_ProjectCode ON dbo.ckm_letter(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_letter_link', N'U') IS NULL
CREATE TABLE dbo.ckm_letter_link (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_letter_link PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_letter_link_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_letter_link_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_letter_link_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_letter_link'))
  CREATE INDEX IX_ckm_letter_link_ProjectCode ON dbo.ckm_letter_link(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_meeting', N'U') IS NULL
CREATE TABLE dbo.ckm_meeting (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_meeting PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_meeting_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_meeting_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_meeting_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_meeting'))
  CREATE INDEX IX_ckm_meeting_ProjectCode ON dbo.ckm_meeting(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_metric_snapshot', N'U') IS NULL
CREATE TABLE dbo.ckm_metric_snapshot (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_metric_snapshot PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_metric_snapshot_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_metric_snapshot_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_metric_snapshot_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_metric_snapshot'))
  CREATE INDEX IX_ckm_metric_snapshot_ProjectCode ON dbo.ckm_metric_snapshot(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_notice_watch', N'U') IS NULL
CREATE TABLE dbo.ckm_notice_watch (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_notice_watch PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_notice_watch_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_notice_watch_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_notice_watch_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_notice_watch'))
  CREATE INDEX IX_ckm_notice_watch_ProjectCode ON dbo.ckm_notice_watch(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_notification_log', N'U') IS NULL
CREATE TABLE dbo.ckm_notification_log (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_notification_log PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_notification_log_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_notification_log_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_notification_log_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_notification_log'))
  CREATE INDEX IX_ckm_notification_log_ProjectCode ON dbo.ckm_notification_log(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_notification_rule', N'U') IS NULL
CREATE TABLE dbo.ckm_notification_rule (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_notification_rule PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_notification_rule_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_notification_rule_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_notification_rule_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_notification_rule'))
  CREATE INDEX IX_ckm_notification_rule_ProjectCode ON dbo.ckm_notification_rule(ProjectCode);

IF OBJECT_ID(N'dbo.ckm_stakeholder', N'U') IS NULL
CREATE TABLE dbo.ckm_stakeholder (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ckm_stakeholder PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ckm_stakeholder_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_ckm_stakeholder_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ckm_stakeholder_ProjectCode' AND object_id = OBJECT_ID(N'dbo.ckm_stakeholder'))
  CREATE INDEX IX_ckm_stakeholder_ProjectCode ON dbo.ckm_stakeholder(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_alert', N'U') IS NULL
CREATE TABLE dbo.hrm_alert (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_alert PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_alert_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_alert_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_alert_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_alert'))
  CREATE INDEX IX_hrm_alert_ProjectCode ON dbo.hrm_alert(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_alert_rule', N'U') IS NULL
CREATE TABLE dbo.hrm_alert_rule (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_alert_rule PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_alert_rule_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_alert_rule_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_alert_rule_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_alert_rule'))
  CREATE INDEX IX_hrm_alert_rule_ProjectCode ON dbo.hrm_alert_rule(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_assignment', N'U') IS NULL
CREATE TABLE dbo.hrm_assignment (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_assignment PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_assignment_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_assignment_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_assignment_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_assignment'))
  CREATE INDEX IX_hrm_assignment_ProjectCode ON dbo.hrm_assignment(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_crew', N'U') IS NULL
CREATE TABLE dbo.hrm_crew (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_crew PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_crew_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_crew_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_crew_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_crew'))
  CREATE INDEX IX_hrm_crew_ProjectCode ON dbo.hrm_crew(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_document', N'U') IS NULL
CREATE TABLE dbo.hrm_document (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_document PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_document_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_document_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_document_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_document'))
  CREATE INDEX IX_hrm_document_ProjectCode ON dbo.hrm_document(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_leave_log', N'U') IS NULL
CREATE TABLE dbo.hrm_leave_log (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_leave_log PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_leave_log_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_leave_log_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_leave_log_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_leave_log'))
  CREATE INDEX IX_hrm_leave_log_ProjectCode ON dbo.hrm_leave_log(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_manpower_plan', N'U') IS NULL
CREATE TABLE dbo.hrm_manpower_plan (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_manpower_plan PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_manpower_plan_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_manpower_plan_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_manpower_plan_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_manpower_plan'))
  CREATE INDEX IX_hrm_manpower_plan_ProjectCode ON dbo.hrm_manpower_plan(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_manpower_plan_line', N'U') IS NULL
CREATE TABLE dbo.hrm_manpower_plan_line (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_manpower_plan_line PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_manpower_plan_line_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_manpower_plan_line_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_manpower_plan_line_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_manpower_plan_line'))
  CREATE INDEX IX_hrm_manpower_plan_line_ProjectCode ON dbo.hrm_manpower_plan_line(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_metric_snapshot', N'U') IS NULL
CREATE TABLE dbo.hrm_metric_snapshot (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_metric_snapshot PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_metric_snapshot_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_metric_snapshot_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_metric_snapshot_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_metric_snapshot'))
  CREATE INDEX IX_hrm_metric_snapshot_ProjectCode ON dbo.hrm_metric_snapshot(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_mobilization_request', N'U') IS NULL
CREATE TABLE dbo.hrm_mobilization_request (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_mobilization_request PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_mobilization_request_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_mobilization_request_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_mobilization_request_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_mobilization_request'))
  CREATE INDEX IX_hrm_mobilization_request_ProjectCode ON dbo.hrm_mobilization_request(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_obs_node', N'U') IS NULL
CREATE TABLE dbo.hrm_obs_node (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_obs_node PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_obs_node_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_obs_node_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_obs_node_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_obs_node'))
  CREATE INDEX IX_hrm_obs_node_ProjectCode ON dbo.hrm_obs_node(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_person', N'U') IS NULL
CREATE TABLE dbo.hrm_person (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_person PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_person_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_person_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_person_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_person'))
  CREATE INDEX IX_hrm_person_ProjectCode ON dbo.hrm_person(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_productivity_log', N'U') IS NULL
CREATE TABLE dbo.hrm_productivity_log (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_productivity_log PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_productivity_log_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_productivity_log_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_productivity_log_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_productivity_log'))
  CREATE INDEX IX_hrm_productivity_log_ProjectCode ON dbo.hrm_productivity_log(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_rca_reason', N'U') IS NULL
CREATE TABLE dbo.hrm_rca_reason (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_rca_reason PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_rca_reason_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_rca_reason_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_rca_reason_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_rca_reason'))
  CREATE INDEX IX_hrm_rca_reason_ProjectCode ON dbo.hrm_rca_reason(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_skill_matrix', N'U') IS NULL
CREATE TABLE dbo.hrm_skill_matrix (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_skill_matrix PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_skill_matrix_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_skill_matrix_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_skill_matrix_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_skill_matrix'))
  CREATE INDEX IX_hrm_skill_matrix_ProjectCode ON dbo.hrm_skill_matrix(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_sub_attendance', N'U') IS NULL
CREATE TABLE dbo.hrm_sub_attendance (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_sub_attendance PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_sub_attendance_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_sub_attendance_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_sub_attendance_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_sub_attendance'))
  CREATE INDEX IX_hrm_sub_attendance_ProjectCode ON dbo.hrm_sub_attendance(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_sub_contract', N'U') IS NULL
CREATE TABLE dbo.hrm_sub_contract (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_sub_contract PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_sub_contract_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_sub_contract_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_sub_contract_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_sub_contract'))
  CREATE INDEX IX_hrm_sub_contract_ProjectCode ON dbo.hrm_sub_contract(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_timesheet_entry', N'U') IS NULL
CREATE TABLE dbo.hrm_timesheet_entry (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_timesheet_entry PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_timesheet_entry_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_timesheet_entry_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_timesheet_entry_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_timesheet_entry'))
  CREATE INDEX IX_hrm_timesheet_entry_ProjectCode ON dbo.hrm_timesheet_entry(ProjectCode);

IF OBJECT_ID(N'dbo.hrm_timesheet_header', N'U') IS NULL
CREATE TABLE dbo.hrm_timesheet_header (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hrm_timesheet_header PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hrm_timesheet_header_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hrm_timesheet_header_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hrm_timesheet_header_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hrm_timesheet_header'))
  CREATE INDEX IX_hrm_timesheet_header_ProjectCode ON dbo.hrm_timesheet_header(ProjectCode);

IF OBJECT_ID(N'dbo.hse_action', N'U') IS NULL
CREATE TABLE dbo.hse_action (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hse_action PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hse_action_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hse_action_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hse_action_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hse_action'))
  CREATE INDEX IX_hse_action_ProjectCode ON dbo.hse_action(ProjectCode);

IF OBJECT_ID(N'dbo.hse_incident', N'U') IS NULL
CREATE TABLE dbo.hse_incident (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hse_incident PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    Code NVARCHAR(50) NULL,
    IncidentDate DATETIME2(0) NULL,
    Type NVARCHAR(50) NULL,
    SeverityW NVARCHAR(200) NULL,
    LostDays DECIMAL(18,4) NULL,
    Area NVARCHAR(200) NULL,
    DescFa NVARCHAR(MAX) NULL,
    Status NVARCHAR(50) NULL,
    VolumeL NVARCHAR(200) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hse_incident_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hse_incident_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hse_incident_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hse_incident'))
  CREATE INDEX IX_hse_incident_ProjectCode ON dbo.hse_incident(ProjectCode);

IF OBJECT_ID(N'dbo.hse_inspection', N'U') IS NULL
CREATE TABLE dbo.hse_inspection (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hse_inspection PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    Area NVARCHAR(200) NULL,
    InspectDate DATETIME2(0) NULL,
    Score DECIMAL(18,4) NULL,
    Band NVARCHAR(200) NULL,
    ItemsJson DATETIME2(0) NULL,
    NextDue NVARCHAR(200) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hse_inspection_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hse_inspection_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hse_inspection_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hse_inspection'))
  CREATE INDEX IX_hse_inspection_ProjectCode ON dbo.hse_inspection(ProjectCode);

IF OBJECT_ID(N'dbo.hse_manhour', N'U') IS NULL
CREATE TABLE dbo.hse_manhour (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hse_manhour PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hse_manhour_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hse_manhour_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hse_manhour_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hse_manhour'))
  CREATE INDEX IX_hse_manhour_ProjectCode ON dbo.hse_manhour(ProjectCode);

IF OBJECT_ID(N'dbo.hse_permit', N'U') IS NULL
CREATE TABLE dbo.hse_permit (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hse_permit PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    Type NVARCHAR(50) NULL,
    Status NVARCHAR(50) NULL,
    WorkDate DATETIME2(0) NULL,
    Area NVARCHAR(200) NULL,
    RiskLevel NVARCHAR(200) NULL,
    FlagsJson DATETIME2(0) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hse_permit_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hse_permit_IsDeleted DEFAULT 0
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hse_permit_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hse_permit'))
  CREATE INDEX IX_hse_permit_ProjectCode ON dbo.hse_permit(ProjectCode);

IF OBJECT_ID(N'dbo.hse_tbt', N'U') IS NULL
CREATE TABLE dbo.hse_tbt (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_hse_tbt PRIMARY KEY,
    ProjectCode NVARCHAR(50) NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_hse_tbt_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2(0) NULL,
    IsDeleted BIT NOT NULL CONSTRAINT DF_hse_tbt_IsDeleted DEFAULT 0,
    Payload NVARCHAR(MAX) NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_hse_tbt_ProjectCode' AND object_id = OBJECT_ID(N'dbo.hse_tbt'))
  CREATE INDEX IX_hse_tbt_ProjectCode ON dbo.hse_tbt(ProjectCode);
`;

export const PMIS_FULL_SCHEMA_TABLE_COUNT = 223;
