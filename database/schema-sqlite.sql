-- ═══════════════════════════════════════════════════════════════
-- شِمای تولیدشده برای SQLite — 224 جدول
-- تولید خودکار از روی کد (scripts/generate-schema.mjs) — دستی ویرایش نکنید.
-- اگر شِمای واقعی دارید، database/schema.custom.sql را جایگزین کنید.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS AI_Config (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_AI_Config_ProjectCode ON AI_Config(ProjectCode);

CREATE TABLE IF NOT EXISTS AI_Model_Input (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_AI_Model_Input_ProjectCode ON AI_Model_Input(ProjectCode);

CREATE TABLE IF NOT EXISTS Action_Item (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Action_Item_ProjectCode ON Action_Item(ProjectCode);

CREATE TABLE IF NOT EXISTS Action_Plan (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Action_Plan_ProjectCode ON Action_Plan(ProjectCode);

CREATE TABLE IF NOT EXISTS Action_Register (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Action_Register_ProjectCode ON Action_Register(ProjectCode);

CREATE TABLE IF NOT EXISTS Activity (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Activity_ProjectCode ON Activity(ProjectCode);

CREATE TABLE IF NOT EXISTS AdjustmentIndexCatalog (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_AdjustmentIndexCatalog_ProjectCode ON AdjustmentIndexCatalog(ProjectCode);

CREATE TABLE IF NOT EXISTS AdvancePaymentSchedule (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_AdvancePaymentSchedule_ProjectCode ON AdvancePaymentSchedule(ProjectCode);

CREATE TABLE IF NOT EXISTS Advance_Ledger (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Advance_Ledger_ProjectCode ON Advance_Ledger(ProjectCode);

CREATE TABLE IF NOT EXISTS Alert_Register (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Alert_Register_ProjectCode ON Alert_Register(ProjectCode);

CREATE TABLE IF NOT EXISTS ApprovalAuthority (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ApprovalAuthority_ProjectCode ON ApprovalAuthority(ProjectCode);

CREATE TABLE IF NOT EXISTS AspectImpact (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_AspectImpact_ProjectCode ON AspectImpact(ProjectCode);

CREATE TABLE IF NOT EXISTS Audit_Finding (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Audit_Finding_ProjectCode ON Audit_Finding(ProjectCode);

CREATE TABLE IF NOT EXISTS Audit_Log (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    ActionCode TEXT,
    EntityName TEXT,
    EntityId INTEGER,
    AfterJson TEXT,
    IpAddress TEXT,
    UserId INTEGER,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_Audit_Log_ProjectCode ON Audit_Log(ProjectCode);

CREATE TABLE IF NOT EXISTS Audit_Register (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Audit_Register_ProjectCode ON Audit_Register(ProjectCode);

CREATE TABLE IF NOT EXISTS BOQ_QuantityChange (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_BOQ_QuantityChange_ProjectCode ON BOQ_QuantityChange(ProjectCode);

CREATE TABLE IF NOT EXISTS BackToBackDeduction (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_BackToBackDeduction_ProjectCode ON BackToBackDeduction(ProjectCode);

CREATE TABLE IF NOT EXISTS Boq_Item (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Boq_Item_ProjectCode ON Boq_Item(ProjectCode);

CREATE TABLE IF NOT EXISTS Boq_Measurement (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Boq_Measurement_ProjectCode ON Boq_Measurement(ProjectCode);

CREATE TABLE IF NOT EXISTS BreakdownNode (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_BreakdownNode_ProjectCode ON BreakdownNode(ProjectCode);

CREATE TABLE IF NOT EXISTS Bsc_Perspective (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Bsc_Perspective_ProjectCode ON Bsc_Perspective(ProjectCode);

CREATE TABLE IF NOT EXISTS CAPA_Action (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_CAPA_Action_ProjectCode ON CAPA_Action(ProjectCode);

CREATE TABLE IF NOT EXISTS CapaAction (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_CapaAction_ProjectCode ON CapaAction(ProjectCode);

CREATE TABLE IF NOT EXISTS Cash_Flow (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Cash_Flow_ProjectCode ON Cash_Flow(ProjectCode);

CREATE TABLE IF NOT EXISTS Cashflow_Plan (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Cashflow_Plan_ProjectCode ON Cashflow_Plan(ProjectCode);

CREATE TABLE IF NOT EXISTS Change_Request (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Change_Request_ProjectCode ON Change_Request(ProjectCode);

CREATE TABLE IF NOT EXISTS CheckRecordPack (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_CheckRecordPack_ProjectCode ON CheckRecordPack(ProjectCode);

CREATE TABLE IF NOT EXISTS CheckSheet (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_CheckSheet_ProjectCode ON CheckSheet(ProjectCode);

CREATE TABLE IF NOT EXISTS Claim_Register (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Claim_Register_ProjectCode ON Claim_Register(ProjectCode);

CREATE TABLE IF NOT EXISTS CompletionCertificate (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_CompletionCertificate_ProjectCode ON CompletionCertificate(ProjectCode);

CREATE TABLE IF NOT EXISTS Completion_Certificate (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Completion_Certificate_ProjectCode ON Completion_Certificate(ProjectCode);

CREATE TABLE IF NOT EXISTS Connection_Strings (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Connection_Strings_ProjectCode ON Connection_Strings(ProjectCode);

CREATE TABLE IF NOT EXISTS ContractAlertRule (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ContractAlertRule_ProjectCode ON ContractAlertRule(ProjectCode);

CREATE TABLE IF NOT EXISTS ContractAmendment (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ContractAmendment_ProjectCode ON ContractAmendment(ProjectCode);

CREATE TABLE IF NOT EXISTS ContractBOQ_Item (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ContractBOQ_Item_ProjectCode ON ContractBOQ_Item(ProjectCode);

CREATE TABLE IF NOT EXISTS ContractFinPosting (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ContractFinPosting_ProjectCode ON ContractFinPosting(ProjectCode);

CREATE TABLE IF NOT EXISTS ContractGuarantee (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ContractGuarantee_ProjectCode ON ContractGuarantee(ProjectCode);

CREATE TABLE IF NOT EXISTS ContractMaster (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ContractMaster_ProjectCode ON ContractMaster(ProjectCode);

CREATE TABLE IF NOT EXISTS ContractMetricsSnapshot (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ContractMetricsSnapshot_ProjectCode ON ContractMetricsSnapshot(ProjectCode);

CREATE TABLE IF NOT EXISTS Contractor_Performance (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Contractor_Performance_ProjectCode ON Contractor_Performance(ProjectCode);

CREATE TABLE IF NOT EXISTS Correspondence_Master (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Correspondence_Master_ProjectCode ON Correspondence_Master(ProjectCode);

CREATE TABLE IF NOT EXISTS Cost_Transaction (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Cost_Transaction_ProjectCode ON Cost_Transaction(ProjectCode);

CREATE TABLE IF NOT EXISTS CrsComment (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_CrsComment_ProjectCode ON CrsComment(ProjectCode);

CREATE TABLE IF NOT EXISTS CtrDocument (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_CtrDocument_ProjectCode ON CtrDocument(ProjectCode);

CREATE TABLE IF NOT EXISTS Daily_Report (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    ReportNo TEXT,
    ReportDate TEXT,
    HeaderJson TEXT,
    Status TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_Daily_Report_ProjectCode ON Daily_Report(ProjectCode);

CREATE TABLE IF NOT EXISTS Decision_Log (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Decision_Log_ProjectCode ON Decision_Log(ProjectCode);

CREATE TABLE IF NOT EXISTS Delay_Register (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Delay_Register_ProjectCode ON Delay_Register(ProjectCode);

CREATE TABLE IF NOT EXISTS Document_Master (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Document_Master_ProjectCode ON Document_Master(ProjectCode);

CREATE TABLE IF NOT EXISTS Document_Revision (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Document_Revision_ProjectCode ON Document_Revision(ProjectCode);

CREATE TABLE IF NOT EXISTS Document_Status (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Document_Status_ProjectCode ON Document_Status(ProjectCode);

CREATE TABLE IF NOT EXISTS Document_Transaction (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Document_Transaction_ProjectCode ON Document_Transaction(ProjectCode);

CREATE TABLE IF NOT EXISTS DossierItem (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_DossierItem_ProjectCode ON DossierItem(ProjectCode);

CREATE TABLE IF NOT EXISTS EVM_Transaction (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_EVM_Transaction_ProjectCode ON EVM_Transaction(ProjectCode);

CREATE TABLE IF NOT EXISTS Efqm_Assessment (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Efqm_Assessment_ProjectCode ON Efqm_Assessment(ProjectCode);

CREATE TABLE IF NOT EXISTS Efqm_Improvement (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Efqm_Improvement_ProjectCode ON Efqm_Improvement(ProjectCode);

CREATE TABLE IF NOT EXISTS Efqm_Score (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Efqm_Score_ProjectCode ON Efqm_Score(ProjectCode);

CREATE TABLE IF NOT EXISTS EngineeringProgressSnapshot (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_EngineeringProgressSnapshot_ProjectCode ON EngineeringProgressSnapshot(ProjectCode);

CREATE TABLE IF NOT EXISTS EngineeringRevision (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_EngineeringRevision_ProjectCode ON EngineeringRevision(ProjectCode);

CREATE TABLE IF NOT EXISTS EnvironmentalAspect (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_EnvironmentalAspect_ProjectCode ON EnvironmentalAspect(ProjectCode);

CREATE TABLE IF NOT EXISTS EnvironmentalMonitoring (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_EnvironmentalMonitoring_ProjectCode ON EnvironmentalMonitoring(ProjectCode);

CREATE TABLE IF NOT EXISTS Equipment (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Equipment_ProjectCode ON Equipment(ProjectCode);

CREATE TABLE IF NOT EXISTS EquipmentDispatch (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_EquipmentDispatch_ProjectCode ON EquipmentDispatch(ProjectCode);

CREATE TABLE IF NOT EXISTS EquipmentFuelLog (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_EquipmentFuelLog_ProjectCode ON EquipmentFuelLog(ProjectCode);

CREATE TABLE IF NOT EXISTS EquipmentMeter (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_EquipmentMeter_ProjectCode ON EquipmentMeter(ProjectCode);

CREATE TABLE IF NOT EXISTS EquipmentRental (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_EquipmentRental_ProjectCode ON EquipmentRental(ProjectCode);

CREATE TABLE IF NOT EXISTS ExtraWorkItem (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ExtraWorkItem_ProjectCode ON ExtraWorkItem(ProjectCode);

CREATE TABLE IF NOT EXISTS GasTestLog (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_GasTestLog_ProjectCode ON GasTestLog(ProjectCode);

CREATE TABLE IF NOT EXISTS GateRule (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_GateRule_ProjectCode ON GateRule(ProjectCode);

CREATE TABLE IF NOT EXISTS HSE_AlertRule (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_HSE_AlertRule_ProjectCode ON HSE_AlertRule(ProjectCode);

CREATE TABLE IF NOT EXISTS HSE_Investigation (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_HSE_Investigation_ProjectCode ON HSE_Investigation(ProjectCode);

CREATE TABLE IF NOT EXISTS HSE_ManHourLog (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_HSE_ManHourLog_ProjectCode ON HSE_ManHourLog(ProjectCode);

CREATE TABLE IF NOT EXISTS HSE_MetricSnapshot (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_HSE_MetricSnapshot_ProjectCode ON HSE_MetricSnapshot(ProjectCode);

CREATE TABLE IF NOT EXISTS HSE_RiskAssessment (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_HSE_RiskAssessment_ProjectCode ON HSE_RiskAssessment(ProjectCode);

CREATE TABLE IF NOT EXISTS HSE_Violation (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_HSE_Violation_ProjectCode ON HSE_Violation(ProjectCode);

CREATE TABLE IF NOT EXISTS HandoverDossier (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_HandoverDossier_ProjectCode ON HandoverDossier(ProjectCode);

CREATE TABLE IF NOT EXISTS HealthExamination (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_HealthExamination_ProjectCode ON HealthExamination(ProjectCode);

CREATE TABLE IF NOT EXISTS Heat_Trace_Link (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Heat_Trace_Link_ProjectCode ON Heat_Trace_Link(ProjectCode);

CREATE TABLE IF NOT EXISTS IPC_Deduction (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_IPC_Deduction_ProjectCode ON IPC_Deduction(ProjectCode);

CREATE TABLE IF NOT EXISTS IPC_LineItem (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_IPC_LineItem_ProjectCode ON IPC_LineItem(ProjectCode);

CREATE TABLE IF NOT EXISTS IPC_WorkflowStep (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_IPC_WorkflowStep_ProjectCode ON IPC_WorkflowStep(ProjectCode);

CREATE TABLE IF NOT EXISTS ITP_Master (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ITP_Master_ProjectCode ON ITP_Master(ProjectCode);

CREATE TABLE IF NOT EXISTS ITP_Point (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ITP_Point_ProjectCode ON ITP_Point(ProjectCode);

CREATE TABLE IF NOT EXISTS Industry_Master (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    Code TEXT,
    TitleFa TEXT,
    TitleEn TEXT,
    Icon TEXT,
    Color TEXT,
    IsActive INTEGER,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_Industry_Master_ProjectCode ON Industry_Master(ProjectCode);

CREATE TABLE IF NOT EXISTS Initiative_Link (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Initiative_Link_ProjectCode ON Initiative_Link(ProjectCode);

CREATE TABLE IF NOT EXISTS InjuredPerson (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_InjuredPerson_ProjectCode ON InjuredPerson(ProjectCode);

CREATE TABLE IF NOT EXISTS InspectionFinding (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_InspectionFinding_ProjectCode ON InspectionFinding(ProjectCode);

CREATE TABLE IF NOT EXISTS Inspection_Request (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Inspection_Request_ProjectCode ON Inspection_Request(ProjectCode);

CREATE TABLE IF NOT EXISTS Inspection_Result (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Inspection_Result_ProjectCode ON Inspection_Result(ProjectCode);

CREATE TABLE IF NOT EXISTS Integration_Log (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Integration_Log_ProjectCode ON Integration_Log(ProjectCode);

CREATE TABLE IF NOT EXISTS InterfaceClashLog (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_InterfaceClashLog_ProjectCode ON InterfaceClashLog(ProjectCode);

CREATE TABLE IF NOT EXISTS InterimPaymentCertificate (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_InterimPaymentCertificate_ProjectCode ON InterimPaymentCertificate(ProjectCode);

CREATE TABLE IF NOT EXISTS Ipc_Certificate (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Ipc_Certificate_ProjectCode ON Ipc_Certificate(ProjectCode);

CREATE TABLE IF NOT EXISTS IsolationLog (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_IsolationLog_ProjectCode ON IsolationLog(ProjectCode);

CREATE TABLE IF NOT EXISTS JSA_Control (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_JSA_Control_ProjectCode ON JSA_Control(ProjectCode);

CREATE TABLE IF NOT EXISTS JSA_Hazard (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_JSA_Hazard_ProjectCode ON JSA_Hazard(ProjectCode);

CREATE TABLE IF NOT EXISTS JSA_JobStep (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_JSA_JobStep_ProjectCode ON JSA_JobStep(ProjectCode);

CREATE TABLE IF NOT EXISTS KPI_Master (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_KPI_Master_ProjectCode ON KPI_Master(ProjectCode);

CREATE TABLE IF NOT EXISTS KPI_Value (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_KPI_Value_ProjectCode ON KPI_Value(ProjectCode);

CREATE TABLE IF NOT EXISTS Knowledge_Base (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Knowledge_Base_ProjectCode ON Knowledge_Base(ProjectCode);

CREATE TABLE IF NOT EXISTS KpiSnapshot (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_KpiSnapshot_ProjectCode ON KpiSnapshot(ProjectCode);

CREATE TABLE IF NOT EXISTS LessonLearned (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_LessonLearned_ProjectCode ON LessonLearned(ProjectCode);

CREATE TABLE IF NOT EXISTS Logistics_Route (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Logistics_Route_ProjectCode ON Logistics_Route(ProjectCode);

CREATE TABLE IF NOT EXISTS LumpSumMilestone (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_LumpSumMilestone_ProjectCode ON LumpSumMilestone(ProjectCode);

CREATE TABLE IF NOT EXISTS MaintenanceOrder (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_MaintenanceOrder_ProjectCode ON MaintenanceOrder(ProjectCode);

CREATE TABLE IF NOT EXISTS MaterialDiffCalc (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_MaterialDiffCalc_ProjectCode ON MaterialDiffCalc(ProjectCode);

CREATE TABLE IF NOT EXISTS Material_Certificate (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Material_Certificate_ProjectCode ON Material_Certificate(ProjectCode);

CREATE TABLE IF NOT EXISTS Material_Issue (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Material_Issue_ProjectCode ON Material_Issue(ProjectCode);

CREATE TABLE IF NOT EXISTS Material_Ledger (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Material_Ledger_ProjectCode ON Material_Ledger(ProjectCode);

CREATE TABLE IF NOT EXISTS Material_Norm (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Material_Norm_ProjectCode ON Material_Norm(ProjectCode);

CREATE TABLE IF NOT EXISTS Material_Register (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Material_Register_ProjectCode ON Material_Register(ProjectCode);

CREATE TABLE IF NOT EXISTS MdrDeliverable (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_MdrDeliverable_ProjectCode ON MdrDeliverable(ProjectCode);

CREATE TABLE IF NOT EXISTS MeasurementSheet (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_MeasurementSheet_ProjectCode ON MeasurementSheet(ProjectCode);

CREATE TABLE IF NOT EXISTS Measurement_Approval (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Measurement_Approval_ProjectCode ON Measurement_Approval(ProjectCode);

CREATE TABLE IF NOT EXISTS Monthly_Report (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Monthly_Report_ProjectCode ON Monthly_Report(ProjectCode);

CREATE TABLE IF NOT EXISTS NCR_Register (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_NCR_Register_ProjectCode ON NCR_Register(ProjectCode);

CREATE TABLE IF NOT EXISTS Ncr (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Ncr_ProjectCode ON Ncr(ProjectCode);

CREATE TABLE IF NOT EXISTS Notification_Queue (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    Channel TEXT,
    Recipient TEXT,
    Subject TEXT,
    Body TEXT,
    Priority TEXT,
    RelatedEntity TEXT,
    RelatedEntityId INTEGER,
    Status TEXT,
    Attempts TEXT,
    LastError TEXT,
    SentAt TEXT,
    SCOPE_IDENTITY TEXT,
    Number TEXT,
    CREATE_NOTIFICATION TEXT,
    Notification_Queue TEXT,
    String TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_Notification_Queue_ProjectCode ON Notification_Queue(ProjectCode);

CREATE TABLE IF NOT EXISTS OccupationalHazard (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_OccupationalHazard_ProjectCode ON OccupationalHazard(ProjectCode);

CREATE TABLE IF NOT EXISTS PTW_Approval (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_PTW_Approval_ProjectCode ON PTW_Approval(ProjectCode);

CREATE TABLE IF NOT EXISTS PTW_Precaution (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_PTW_Precaution_ProjectCode ON PTW_Precaution(ProjectCode);

CREATE TABLE IF NOT EXISTS PartTransaction (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_PartTransaction_ProjectCode ON PartTransaction(ProjectCode);

CREATE TABLE IF NOT EXISTS PerformanceTestReading (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_PerformanceTestReading_ProjectCode ON PerformanceTestReading(ProjectCode);

CREATE TABLE IF NOT EXISTS PerformanceTestRun (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_PerformanceTestRun_ProjectCode ON PerformanceTestRun(ProjectCode);

CREATE TABLE IF NOT EXISTS PmSchedule (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_PmSchedule_ProjectCode ON PmSchedule(ProjectCode);

CREATE TABLE IF NOT EXISTS Portfolio_Snapshot (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    ActiveProjects TEXT,
    TenderProjects TEXT,
    StoppedProjects TEXT,
    CompletedProjects TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_Portfolio_Snapshot_ProjectCode ON Portfolio_Snapshot(ProjectCode);

CREATE TABLE IF NOT EXISTS PpeIssuance (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_PpeIssuance_ProjectCode ON PpeIssuance(ProjectCode);

CREATE TABLE IF NOT EXISTS PriceAdjustmentCalculation (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_PriceAdjustmentCalculation_ProjectCode ON PriceAdjustmentCalculation(ProjectCode);

CREATE TABLE IF NOT EXISTS ProcessTree (
    Id TEXT PRIMARY KEY,
    ProjectId TEXT NOT NULL,
    DomainId TEXT NOT NULL,
    Payload TEXT NOT NULL,
    IsActive INTEGER NOT NULL DEFAULT 1,
    CreatedAt TEXT NOT NULL,
    CreatedBy TEXT,
    UpdatedAt TEXT,
    UpdatedBy TEXT,
    RowVersion INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS UX_ProcessTree_ProjectDomain ON ProcessTree(ProjectId, DomainId);

CREATE TABLE IF NOT EXISTS Process_Master (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Process_Master_ProjectCode ON Process_Master(ProjectCode);

CREATE TABLE IF NOT EXISTS Production_Log (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Production_Log_ProjectCode ON Production_Log(ProjectCode);

CREATE TABLE IF NOT EXISTS Progress_Transaction (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Progress_Transaction_ProjectCode ON Progress_Transaction(ProjectCode);

CREATE TABLE IF NOT EXISTS ProjectClosureRecord (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ProjectClosureRecord_ProjectCode ON ProjectClosureRecord(ProjectCode);

CREATE TABLE IF NOT EXISTS Project_Budget (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Project_Budget_ProjectCode ON Project_Budget(ProjectCode);

CREATE TABLE IF NOT EXISTS Project_Master (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    IndustryCode TEXT,
    NameFa TEXT,
    NameEn TEXT,
    ClientFa TEXT,
    LocationFa TEXT,
    Budget TEXT,
    Status TEXT,
    Progress REAL,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_Project_Master_ProjectCode ON Project_Master(ProjectCode);

CREATE TABLE IF NOT EXISTS Project_Site (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Project_Site_ProjectCode ON Project_Site(ProjectCode);

CREATE TABLE IF NOT EXISTS PunchListItem (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_PunchListItem_ProjectCode ON PunchListItem(ProjectCode);

CREATE TABLE IF NOT EXISTS Punch_List (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Punch_List_ProjectCode ON Punch_List(ProjectCode);

CREATE TABLE IF NOT EXISTS Purchase_Order (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Purchase_Order_ProjectCode ON Purchase_Order(ProjectCode);

CREATE TABLE IF NOT EXISTS Purchase_Request (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Purchase_Request_ProjectCode ON Purchase_Request(ProjectCode);

CREATE TABLE IF NOT EXISTS Quality_Audit (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Quality_Audit_ProjectCode ON Quality_Audit(ProjectCode);

CREATE TABLE IF NOT EXISTS Quality_Dossier (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Quality_Dossier_ProjectCode ON Quality_Dossier(ProjectCode);

CREATE TABLE IF NOT EXISTS Quality_Plan (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Quality_Plan_ProjectCode ON Quality_Plan(ProjectCode);

CREATE TABLE IF NOT EXISTS RetainageLedger (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_RetainageLedger_ProjectCode ON RetainageLedger(ProjectCode);

CREATE TABLE IF NOT EXISTS Retention_Ledger (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Retention_Ledger_ProjectCode ON Retention_Ledger(ProjectCode);

CREATE TABLE IF NOT EXISTS Risk_Assessment (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Risk_Assessment_ProjectCode ON Risk_Assessment(ProjectCode);

CREATE TABLE IF NOT EXISTS Risk_Register (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Risk_Register_ProjectCode ON Risk_Register(ProjectCode);

CREATE TABLE IF NOT EXISTS RootCauseNode (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_RootCauseNode_ProjectCode ON RootCauseNode(ProjectCode);

CREATE TABLE IF NOT EXISTS SafetyIncident (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_SafetyIncident_ProjectCode ON SafetyIncident(ProjectCode);

CREATE TABLE IF NOT EXISTS SafetyInspection (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_SafetyInspection_ProjectCode ON SafetyInspection(ProjectCode);

CREATE TABLE IF NOT EXISTS SafetyTrainingRecord (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_SafetyTrainingRecord_ProjectCode ON SafetyTrainingRecord(ProjectCode);

CREATE TABLE IF NOT EXISTS Scenario_Model (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Scenario_Model_ProjectCode ON Scenario_Model(ProjectCode);

CREATE TABLE IF NOT EXISTS Schedule_Activity (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    ScheduleId INTEGER,
    ActivityCode TEXT,
    ActivityName TEXT,
    StartDate TEXT,
    FinishDate TEXT,
    DurationDays REAL,
    Progress REAL,
    IsCritical INTEGER,
    WbsId INTEGER,
    ISNULL INTEGER,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_Schedule_Activity_ProjectCode ON Schedule_Activity(ProjectCode);

CREATE TABLE IF NOT EXISTS Schedule_Master (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    ScheduleName TEXT,
    SourceSystem TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_Schedule_Master_ProjectCode ON Schedule_Master(ProjectCode);

CREATE TABLE IF NOT EXISTS Schema_Config (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Schema_Config_ProjectCode ON Schema_Config(ProjectCode);

CREATE TABLE IF NOT EXISTS Schema_Version (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    VersionNo TEXT,
    Notes TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_Schema_Version_ProjectCode ON Schema_Version(ProjectCode);

CREATE TABLE IF NOT EXISTS Sensitivity_Run (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Sensitivity_Run_ProjectCode ON Sensitivity_Run(ProjectCode);

CREATE TABLE IF NOT EXISTS SparePart (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_SparePart_ProjectCode ON SparePart(ProjectCode);

CREATE TABLE IF NOT EXISTS SquadCheck (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_SquadCheck_ProjectCode ON SquadCheck(ProjectCode);

CREATE TABLE IF NOT EXISTS Stakeholder_Register (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Stakeholder_Register_ProjectCode ON Stakeholder_Register(ProjectCode);

CREATE TABLE IF NOT EXISTS Strategy_Initiative (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Strategy_Initiative_ProjectCode ON Strategy_Initiative(ProjectCode);

CREATE TABLE IF NOT EXISTS Strategy_Kpi (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Strategy_Kpi_ProjectCode ON Strategy_Kpi(ProjectCode);

CREATE TABLE IF NOT EXISTS Strategy_Kpi_Value (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Strategy_Kpi_Value_ProjectCode ON Strategy_Kpi_Value(ProjectCode);

CREATE TABLE IF NOT EXISTS Strategy_Objective (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Strategy_Objective_ProjectCode ON Strategy_Objective(ProjectCode);

CREATE TABLE IF NOT EXISTS Strategy_Theme (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Strategy_Theme_ProjectCode ON Strategy_Theme(ProjectCode);

CREATE TABLE IF NOT EXISTS SubcontractorIPC (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_SubcontractorIPC_ProjectCode ON SubcontractorIPC(ProjectCode);

CREATE TABLE IF NOT EXISTS SubcontractorIPC_LineItem (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_SubcontractorIPC_LineItem_ProjectCode ON SubcontractorIPC_LineItem(ProjectCode);

CREATE TABLE IF NOT EXISTS SystemBoundaryMapping (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_SystemBoundaryMapping_ProjectCode ON SystemBoundaryMapping(ProjectCode);

CREATE TABLE IF NOT EXISTS SystemSubsystem (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_SystemSubsystem_ProjectCode ON SystemSubsystem(ProjectCode);

CREATE TABLE IF NOT EXISTS TechnicalQuery (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_TechnicalQuery_ProjectCode ON TechnicalQuery(ProjectCode);

CREATE TABLE IF NOT EXISTS Test_Report (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Test_Report_ProjectCode ON Test_Report(ProjectCode);

CREATE TABLE IF NOT EXISTS Theme_Config (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Theme_Config_ProjectCode ON Theme_Config(ProjectCode);

CREATE TABLE IF NOT EXISTS TrainingAttendee (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_TrainingAttendee_ProjectCode ON TrainingAttendee(ProjectCode);

CREATE TABLE IF NOT EXISTS TrainingSession (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_TrainingSession_ProjectCode ON TrainingSession(ProjectCode);

CREATE TABLE IF NOT EXISTS Transmittal_Register (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Transmittal_Register_ProjectCode ON Transmittal_Register(ProjectCode);

CREATE TABLE IF NOT EXISTS Variance_Log (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Variance_Log_ProjectCode ON Variance_Log(ProjectCode);

CREATE TABLE IF NOT EXISTS VendorPrintReview (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_VendorPrintReview_ProjectCode ON VendorPrintReview(ProjectCode);

CREATE TABLE IF NOT EXISTS Vendor_Score (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Vendor_Score_ProjectCode ON Vendor_Score(ProjectCode);

CREATE TABLE IF NOT EXISTS Vendor_Score_History (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Vendor_Score_History_ProjectCode ON Vendor_Score_History(ProjectCode);

CREATE TABLE IF NOT EXISTS ViolationClosure (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ViolationClosure_ProjectCode ON ViolationClosure(ProjectCode);

CREATE TABLE IF NOT EXISTS WarrantyClaim (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_WarrantyClaim_ProjectCode ON WarrantyClaim(ProjectCode);

CREATE TABLE IF NOT EXISTS WasteLog (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_WasteLog_ProjectCode ON WasteLog(ProjectCode);

CREATE TABLE IF NOT EXISTS WbsNode (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_WbsNode_ProjectCode ON WbsNode(ProjectCode);

CREATE TABLE IF NOT EXISTS Weekly_Report (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Weekly_Report_ProjectCode ON Weekly_Report(ProjectCode);

CREATE TABLE IF NOT EXISTS WorkPermit (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_WorkPermit_ProjectCode ON WorkPermit(ProjectCode);

CREATE TABLE IF NOT EXISTS Workflow_Instance (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_Workflow_Instance_ProjectCode ON Workflow_Instance(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_action_item (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_action_item_ProjectCode ON ckm_action_item(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_alert (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_alert_ProjectCode ON ckm_alert(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_comm_matrix (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_comm_matrix_ProjectCode ON ckm_comm_matrix(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_engagement_log (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_engagement_log_ProjectCode ON ckm_engagement_log(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_lesson (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_lesson_ProjectCode ON ckm_lesson(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_lesson_reuse (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_lesson_reuse_ProjectCode ON ckm_lesson_reuse(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_letter (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_letter_ProjectCode ON ckm_letter(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_letter_link (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_letter_link_ProjectCode ON ckm_letter_link(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_meeting (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_meeting_ProjectCode ON ckm_meeting(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_metric_snapshot (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_metric_snapshot_ProjectCode ON ckm_metric_snapshot(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_notice_watch (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_notice_watch_ProjectCode ON ckm_notice_watch(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_notification_log (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_notification_log_ProjectCode ON ckm_notification_log(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_notification_rule (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_notification_rule_ProjectCode ON ckm_notification_rule(ProjectCode);

CREATE TABLE IF NOT EXISTS ckm_stakeholder (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_ckm_stakeholder_ProjectCode ON ckm_stakeholder(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_alert (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_alert_ProjectCode ON hrm_alert(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_alert_rule (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_alert_rule_ProjectCode ON hrm_alert_rule(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_assignment (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_assignment_ProjectCode ON hrm_assignment(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_crew (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_crew_ProjectCode ON hrm_crew(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_document (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_document_ProjectCode ON hrm_document(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_leave_log (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_leave_log_ProjectCode ON hrm_leave_log(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_manpower_plan (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_manpower_plan_ProjectCode ON hrm_manpower_plan(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_manpower_plan_line (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_manpower_plan_line_ProjectCode ON hrm_manpower_plan_line(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_metric_snapshot (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_metric_snapshot_ProjectCode ON hrm_metric_snapshot(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_mobilization_request (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_mobilization_request_ProjectCode ON hrm_mobilization_request(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_obs_node (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_obs_node_ProjectCode ON hrm_obs_node(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_person (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_person_ProjectCode ON hrm_person(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_productivity_log (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_productivity_log_ProjectCode ON hrm_productivity_log(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_rca_reason (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_rca_reason_ProjectCode ON hrm_rca_reason(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_skill_matrix (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_skill_matrix_ProjectCode ON hrm_skill_matrix(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_sub_attendance (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_sub_attendance_ProjectCode ON hrm_sub_attendance(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_sub_contract (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_sub_contract_ProjectCode ON hrm_sub_contract(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_timesheet_entry (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_timesheet_entry_ProjectCode ON hrm_timesheet_entry(ProjectCode);

CREATE TABLE IF NOT EXISTS hrm_timesheet_header (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hrm_timesheet_header_ProjectCode ON hrm_timesheet_header(ProjectCode);

CREATE TABLE IF NOT EXISTS hse_action (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hse_action_ProjectCode ON hse_action(ProjectCode);

CREATE TABLE IF NOT EXISTS hse_incident (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    Code TEXT,
    IncidentDate TEXT,
    Type TEXT,
    SeverityW TEXT,
    LostDays REAL,
    Area TEXT,
    DescFa TEXT,
    Status TEXT,
    VolumeL TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_hse_incident_ProjectCode ON hse_incident(ProjectCode);

CREATE TABLE IF NOT EXISTS hse_inspection (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    Area TEXT,
    InspectDate TEXT,
    Score REAL,
    Band TEXT,
    ItemsJson TEXT,
    NextDue TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_hse_inspection_ProjectCode ON hse_inspection(ProjectCode);

CREATE TABLE IF NOT EXISTS hse_manhour (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hse_manhour_ProjectCode ON hse_manhour(ProjectCode);

CREATE TABLE IF NOT EXISTS hse_permit (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    Type TEXT,
    Status TEXT,
    WorkDate TEXT,
    Area TEXT,
    RiskLevel TEXT,
    FlagsJson TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER
);
CREATE INDEX IF NOT EXISTS IX_hse_permit_ProjectCode ON hse_permit(ProjectCode);

CREATE TABLE IF NOT EXISTS hse_tbt (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    ProjectCode TEXT,
    CreatedAt TEXT,
    UpdatedAt TEXT,
    IsDeleted INTEGER,
    Payload TEXT NULL -- فیلدهای اختصاصی تا زمانِ تعریفِ شِمای واقعی
);
CREATE INDEX IF NOT EXISTS IX_hse_tbt_ProjectCode ON hse_tbt(ProjectCode);
