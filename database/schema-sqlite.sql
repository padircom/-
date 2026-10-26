-- Arena Platform · sql-v1 · dialect=sqlite
-- تولیدشده از src/services/persistence.ts — ویرایش دستی نکنید.

-- StrategyPlan · d20 · برنامهٔ استراتژیک
CREATE TABLE IF NOT EXISTS "StrategyPlan" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DataDate" TEXT NOT NULL,
  "ModelVersion" TEXT NOT NULL,
  "Objectives" TEXT NOT NULL,
  "Initiatives" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_StrategyPlan" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_StrategyPlan_Code" ON "StrategyPlan" ("ProjectId", "Code");


-- ExcellenceAssessment · d19 · خودارزیابی داخلی تعالی
CREATE TABLE IF NOT EXISTS "ExcellenceAssessment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DataDate" TEXT NOT NULL,
  "ModelVersion" TEXT NOT NULL,
  "Scores" TEXT NOT NULL,
  "Notes" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ExcellenceAssessment" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ExcellenceAssessment_Code" ON "ExcellenceAssessment" ("ProjectId", "Code");


-- SchemaMigration · core · تاریخچه مهاجرت اسکیما
CREATE TABLE IF NOT EXISTS "SchemaMigration" (
  "Version" TEXT NOT NULL,
  "Name" TEXT NOT NULL,
  "Checksum" TEXT NOT NULL,
  "AppliedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "DurationMs" INTEGER NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SchemaMigration" PRIMARY KEY ("Version")
);


-- Industry · core · خوشه صنعتی
CREATE TABLE IF NOT EXISTS "Industry" (
  "Id" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "TitleEn" TEXT NULL,
  "Color" TEXT NULL,
  "Icon" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Industry" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_Industry_Code" ON "Industry" ("Code");


-- Project · core · پروژه
CREATE TABLE IF NOT EXISTS "Project" (
  "Id" TEXT NOT NULL,
  "IndustryId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "ClientFa" TEXT NULL,
  "ConsultantFa" TEXT NULL,
  "ContractorFa" TEXT NULL,
  "LocationFa" TEXT NULL,
  "ContractNo" TEXT NULL,
  "Budget" NUMERIC NULL,
  "StartDate" TEXT NULL,
  "FinishDate" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Project" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_Project_IndustryId" FOREIGN KEY ("IndustryId") REFERENCES "Industry" ("Id") ON DELETE NO ACTION
);
CREATE UNIQUE INDEX "UX_Project_Code" ON "Project" ("Code");
CREATE INDEX "IX_Project_Industry" ON "Project" ("IndustryId");


-- ProcessTree · core · درخت فرایند پروژه
CREATE TABLE IF NOT EXISTS "ProcessTree" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DomainId" TEXT NOT NULL,
  "Payload" TEXT NOT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ProcessTree" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ProcessTree_ProjectDomain" ON "ProcessTree" ("ProjectId", "DomainId");


-- AppUser · d7 · کاربر
CREATE TABLE IF NOT EXISTS "AppUser" (
  "Id" TEXT NOT NULL,
  "Username" TEXT NOT NULL,
  "DisplayName" TEXT NOT NULL,
  "Email" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "Clearance" TEXT NULL,
  "Party" TEXT NULL,
  "PasswordChangedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_AppUser" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_AppUser_Username" ON "AppUser" ("Username");


-- UserRole · d7 · انتساب نقش
CREATE TABLE IF NOT EXISTS "UserRole" (
  "Id" TEXT NOT NULL,
  "UserId" TEXT NOT NULL,
  "RoleCode" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_UserRole" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_UserRole_UserId" FOREIGN KEY ("UserId") REFERENCES "AppUser" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_UserRole" ON "UserRole" ("UserId", "RoleCode");


-- UserProjectScope · d7 · دامنه پروژه کاربر
CREATE TABLE IF NOT EXISTS "UserProjectScope" (
  "Id" TEXT NOT NULL,
  "UserId" TEXT NOT NULL,
  "ProjectCode" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_UserProjectScope" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_UserProjectScope_UserId" FOREIGN KEY ("UserId") REFERENCES "AppUser" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_UserProjectScope" ON "UserProjectScope" ("UserId", "ProjectCode");


-- Delegation · d7 · تفویض اختیار
CREATE TABLE IF NOT EXISTS "Delegation" (
  "Id" TEXT NOT NULL,
  "FromUserId" TEXT NOT NULL,
  "ToUserId" TEXT NOT NULL,
  "Permissions" TEXT NOT NULL,
  "ValidFrom" TEXT NOT NULL,
  "ValidTo" TEXT NOT NULL,
  "Reason" TEXT NOT NULL,
  "Revoked" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Delegation" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_Delegation_To" ON "Delegation" ("ToUserId", "ValidTo");


-- AuditLog · d7 · لاگ ممیزی
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "Id" TEXT NOT NULL,
  "At" TEXT NOT NULL,
  "SubjectId" TEXT NOT NULL,
  "Action" TEXT NOT NULL,
  "Permission" TEXT NULL,
  "Decision" TEXT NULL,
  "ProjectCode" TEXT NULL,
  "EntityName" TEXT NULL,
  "EntityId" TEXT NULL,
  "Severity" TEXT NOT NULL DEFAULT 'info',
  "Details" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_AuditLog" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_AuditLog_At" ON "AuditLog" ("At");
CREATE INDEX "IX_AuditLog_Subject" ON "AuditLog" ("SubjectId", "At");


-- Document · d1 · مدرک
CREATE TABLE IF NOT EXISTS "Document" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "TitleEn" TEXT NULL,
  "Revision" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "Discipline" TEXT NULL,
  "Classification" TEXT NULL,
  "FilePath" TEXT NULL,
  "IssuedAt" TEXT NULL,
  "ReviewCode" TEXT NULL,
  "SlaHours" INTEGER NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Document" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_Document_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES "Project" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_Document_DocNoRev" ON "Document" ("ProjectId", "DocNo", "Revision");


-- Transmittal · d1 · ترانسمیتال
CREATE TABLE IF NOT EXISTS "Transmittal" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "TrnNo" TEXT NOT NULL,
  "Direction" TEXT NOT NULL,
  "IssuedAt" TEXT NOT NULL,
  "DueAt" TEXT NULL,
  "Status" TEXT NOT NULL,
  "Items" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Transmittal" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_Transmittal_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES "Project" ("Id") ON DELETE CASCADE
);


-- WbsNode · d2 · گره WBS
CREATE TABLE IF NOT EXISTS "WbsNode" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "ParentId" TEXT NULL,
  "Level" INTEGER NOT NULL,
  "Weight" NUMERIC NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_WbsNode" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_WbsNode_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES "Project" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_WbsNode_Code" ON "WbsNode" ("ProjectId", "Code");


-- Activity · d2 · فعالیت
CREATE TABLE IF NOT EXISTS "Activity" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "WbsId" TEXT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Discipline" TEXT NULL,
  "PlannedStart" TEXT NOT NULL,
  "PlannedFinish" TEXT NOT NULL,
  "ActualStart" TEXT NULL,
  "ActualFinish" TEXT NULL,
  "DurationDays" INTEGER NULL,
  "TotalFloat" INTEGER NULL,
  "FreeFloat" INTEGER NULL,
  "PhysicalPct" NUMERIC NOT NULL DEFAULT 0,
  "BudgetCost" NUMERIC NULL,
  "BudgetMh" NUMERIC NULL,
  "RocCode" TEXT NULL,
  "IsCritical" INTEGER NOT NULL DEFAULT 0,
  "BlockedByEquipmentId" TEXT NULL,
  "BlockedByDocumentId" TEXT NULL,
  "IsStopWorkOrder" INTEGER NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Activity" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_Activity_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES "Project" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_Activity_Code" ON "Activity" ("ProjectId", "Code");
CREATE INDEX "IX_Activity_Float" ON "Activity" ("ProjectId", "TotalFloat");


-- ActivityRelation · d2 · رابطه فعالیت
CREATE TABLE IF NOT EXISTS "ActivityRelation" (
  "Id" TEXT NOT NULL,
  "PredecessorId" TEXT NOT NULL,
  "SuccessorId" TEXT NOT NULL,
  "RelType" TEXT NOT NULL DEFAULT 'FS',
  "LagDays" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ActivityRelation" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ActivityRelation" ON "ActivityRelation" ("PredecessorId", "SuccessorId", "RelType");


-- Baseline · d2 · برنامه مبنا
CREATE TABLE IF NOT EXISTS "Baseline" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Name" TEXT NOT NULL,
  "SetAt" TEXT NOT NULL,
  "SetBy" TEXT NOT NULL,
  "IsCurrent" INTEGER NOT NULL DEFAULT 0,
  "Snapshot" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Baseline" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_Baseline_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES "Project" ("Id") ON DELETE CASCADE
);


-- Period · d2 · دوره گزارشی
CREATE TABLE IF NOT EXISTS "Period" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "StartDate" TEXT NOT NULL,
  "EndDate" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'open',
  "ClosedAt" TEXT NULL,
  "ClosedBy" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Period" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_Period_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES "Project" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_Period_Code" ON "Period" ("ProjectId", "Code");


-- ProgressEntry · d2 · ثبت پیشرفت
CREATE TABLE IF NOT EXISTS "ProgressEntry" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ActivityId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "EntryDate" TEXT NOT NULL,
  "PhysicalPct" NUMERIC NOT NULL,
  "Steps" TEXT NULL,
  "BlockedSteps" TEXT NULL,
  "AcceptedIntoEv" INTEGER NOT NULL DEFAULT 0,
  "Note" TEXT NULL,
  "EnteredBy" TEXT NOT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ProgressEntry" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ProgressEntry_Activity" ON "ProgressEntry" ("ActivityId", "EntryDate");
CREATE INDEX "IX_ProgressEntry_Period" ON "ProgressEntry" ("ProjectId", "PeriodCode");


-- EvmSnapshot · d3 · عکس ارزش کسب‌شده
CREATE TABLE IF NOT EXISTS "EvmSnapshot" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DataDate" TEXT NOT NULL,
  "Pv" NUMERIC NOT NULL,
  "Ev" NUMERIC NOT NULL,
  "Ac" NUMERIC NOT NULL,
  "Bac" NUMERIC NULL,
  "Eac" NUMERIC NULL,
  "Spi" NUMERIC NULL,
  "Cpi" NUMERIC NULL,
  "FormulaVersion" TEXT NULL,
  "Hash" TEXT NULL,
  "Inputs" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EvmSnapshot" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EvmSnapshot" ON "EvmSnapshot" ("ProjectId", "DataDate");


-- KpiSnapshot · d3 · عکس شاخص
CREATE TABLE IF NOT EXISTS "KpiSnapshot" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "KpiCode" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "Value" NUMERIC NOT NULL,
  "Target" NUMERIC NULL,
  "Status" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_KpiSnapshot" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_KpiSnapshot" ON "KpiSnapshot" ("ProjectId", "KpiCode", "PeriodCode");


-- Risk · d4 · ریسک
CREATE TABLE IF NOT EXISTS "Risk" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "Probability" INTEGER NOT NULL,
  "Impact" INTEGER NOT NULL,
  "Score" INTEGER NULL,
  "Status" TEXT NOT NULL,
  "Owner" TEXT NULL,
  "Response" TEXT NULL,
  "Cause" TEXT NULL,
  "Event" TEXT NULL,
  "Effect" TEXT NULL,
  "SourceRef" TEXT NULL,
  "WbsCode" TEXT NULL,
  "ActivityCode" TEXT NULL,
  "BaselineId" TEXT NULL,
  "ReserveAmount" NUMERIC NULL,
  "ReserveUsedAmount" NUMERIC NULL,
  "ReserveStatus" TEXT NULL,
  "NextReviewDate" TEXT NULL,
  "LastReviewedAt" TEXT NULL,
  "LastReviewedBy" TEXT NULL,
  "MonitoringNote" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Risk" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_Risk_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES "Project" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_Risk_Code" ON "Risk" ("ProjectId", "Code");


-- ChangeRequest · d4 · درخواست تغییر
CREATE TABLE IF NOT EXISTS "ChangeRequest" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "RaisedBy" TEXT NOT NULL,
  "RaisedAt" TEXT NOT NULL,
  "CostImpact" NUMERIC NULL,
  "TimeImpactDays" INTEGER NULL,
  "Status" TEXT NOT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "Reason" TEXT NULL,
  "Assessment" TEXT NULL,
  "DecisionReason" TEXT NULL,
  "WbsCode" TEXT NULL,
  "ActivityCode" TEXT NULL,
  "BaselineId" TEXT NULL,
  "ApplicationStatus" TEXT NULL,
  "AppliedBaselineId" TEXT NULL,
  "ApplicationNote" TEXT NULL,
  "AppliedBy" TEXT NULL,
  "AppliedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ChangeRequest" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ChangeRequest_Code" ON "ChangeRequest" ("ProjectId", "Code");


-- Claim · d4 · ادعا
CREATE TABLE IF NOT EXISTS "Claim" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "NoticeDate" TEXT NOT NULL,
  "SubmittedAt" TEXT NULL,
  "Amount" NUMERIC NULL,
  "ProposedAmount" NUMERIC NULL,
  "ExtensionDays" INTEGER NULL,
  "Status" TEXT NOT NULL,
  "TimeBarred" INTEGER NOT NULL DEFAULT 0,
  "EventDate" TEXT NULL,
  "NoticeDays" INTEGER NULL,
  "NoticeDeliveredAt" TEXT NULL,
  "NoticeRef" TEXT NULL,
  "Clause" TEXT NULL,
  "EvidenceRef" TEXT NULL,
  "Entitlement" TEXT NULL,
  "Causation" TEXT NULL,
  "QuantumNote" TEXT NULL,
  "BaselineId" TEXT NULL,
  "DataDate" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "ReviewNote" TEXT NULL,
  "ReviewBy" TEXT NULL,
  "ReviewAt" TEXT NULL,
  "NegotiationNote" TEXT NULL,
  "NegotiationBy" TEXT NULL,
  "NegotiationAt" TEXT NULL,
  "DeterminedAmount" NUMERIC NULL,
  "DeterminedDays" INTEGER NULL,
  "DeterminationNote" TEXT NULL,
  "DeterminedBy" TEXT NULL,
  "DeterminedAt" TEXT NULL,
  "RejectionNote" TEXT NULL,
  "RejectedBy" TEXT NULL,
  "RejectedAt" TEXT NULL,
  "SettlementAmount" NUMERIC NULL,
  "SettlementDays" INTEGER NULL,
  "SettlementNote" TEXT NULL,
  "SettledBy" TEXT NULL,
  "SettledAt" TEXT NULL,
  "DisputeNote" TEXT NULL,
  "DisputedBy" TEXT NULL,
  "DisputedAt" TEXT NULL,
  "WithdrawalNote" TEXT NULL,
  "WithdrawnBy" TEXT NULL,
  "WithdrawnAt" TEXT NULL,
  "ClosureNote" TEXT NULL,
  "ClosedBy" TEXT NULL,
  "ClosedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Claim" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_Claim_Code" ON "Claim" ("ProjectId", "Code");


-- RccIssue · d4 · مسئله و هشدار زودهنگام
CREATE TABLE IF NOT EXISTS "RccIssue" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Description" TEXT NULL,
  "Severity" TEXT NULL,
  "Status" TEXT NOT NULL,
  "Owner" TEXT NULL,
  "DueDate" TEXT NULL,
  "RiskCode" TEXT NULL,
  "WbsCode" TEXT NULL,
  "ActivityCode" TEXT NULL,
  "SourceRef" TEXT NULL,
  "EscalationLevel" INTEGER NULL,
  "EscalationNote" TEXT NULL,
  "EscalatedBy" TEXT NULL,
  "EscalatedAt" TEXT NULL,
  "ResolutionNote" TEXT NULL,
  "ResolvedBy" TEXT NULL,
  "ResolvedAt" TEXT NULL,
  "ClosedBy" TEXT NULL,
  "ClosedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_RccIssue" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_RccIssue_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES "Project" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_RccIssue_Code" ON "RccIssue" ("ProjectId", "Code");


-- DelayEvent · d4 · رویداد تأخیر و Extension of Time
CREATE TABLE IF NOT EXISTS "DelayEvent" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "SourceParty" TEXT NOT NULL,
  "StartDate" TEXT NOT NULL,
  "FinishDate" TEXT NOT NULL,
  "NoticedDate" TEXT NULL,
  "Status" TEXT NULL,
  "ContractCode" TEXT NULL,
  "ClaimCode" TEXT NULL,
  "RiskCode" TEXT NULL,
  "IssueCode" TEXT NULL,
  "WbsCode" TEXT NULL,
  "ActivityCode" TEXT NULL,
  "BaselineId" TEXT NULL,
  "IpcId" TEXT NULL,
  "ClauseRef" TEXT NULL,
  "EvidenceRef" TEXT NULL,
  "EvidenceRefs" TEXT NULL,
  "EstimatedDelayDays" INTEGER NULL,
  "CompletionImpactDays" INTEGER NULL,
  "IsCritical" INTEGER NULL DEFAULT 0,
  "RootCauseFa" TEXT NULL,
  "ReviewNote" TEXT NULL,
  "ReviewedBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_DelayEvent" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_DelayEvent_Code" ON "DelayEvent" ("ProjectId", "Code");
CREATE INDEX "IX_DelayEvent_Claim" ON "DelayEvent" ("ProjectId", "ClaimCode");


-- DelayCalculation · d4 · محاسبهٔ تأخیر و تمدید مدت
CREATE TABLE IF NOT EXISTS "DelayCalculation" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DelayEventId" TEXT NOT NULL,
  "Engine" TEXT NOT NULL,
  "RuleVersion" TEXT NOT NULL,
  "Method" TEXT NULL,
  "Inputs" TEXT NOT NULL,
  "Result" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "RawValueDays" NUMERIC NULL,
  "FinalValueDays" NUMERIC NULL,
  "CalculatedBy" TEXT NULL,
  "CalculatedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ApprovalNote" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_DelayCalculation" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_DelayCalculation_Event" ON "DelayCalculation" ("ProjectId", "DelayEventId", "Engine");


-- ClaimCostItem · d4 · آیتم هزینهٔ ادعای مالی (Prolongation)
CREATE TABLE IF NOT EXISTS "ClaimCostItem" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DelayEventId" TEXT NOT NULL,
  "ClaimCode" TEXT NULL,
  "CostType" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Amount" NUMERIC NOT NULL DEFAULT 0,
  "Currency" TEXT NULL,
  "Basis" TEXT NULL,
  "PeriodFrom" TEXT NULL,
  "PeriodTo" TEXT NULL,
  "DocumentRefs" TEXT NULL,
  "Status" TEXT NULL DEFAULT 'draft',
  "LossCategory" TEXT NULL,
  "CostNature" TEXT NULL,
  "Quantity" NUMERIC NULL,
  "Rate" NUMERIC NULL,
  "UnitFa" TEXT NULL,
  "DocumentedAmount" NUMERIC NULL,
  "ApprovedAmount" NUMERIC NULL,
  "RuleCode" TEXT NULL,
  "ResourceKind" TEXT NULL,
  "ResourceNameFa" TEXT NULL,
  "WorkedUnits" NUMERIC NULL,
  "IdleUnits" NUMERIC NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ClaimCostItem" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ClaimCostItem_Event" ON "ClaimCostItem" ("ProjectId", "DelayEventId");


-- ClaimCalculationRule · d4 · قاعدهٔ محاسبهٔ خسارت
CREATE TABLE IF NOT EXISTS "ClaimCalculationRule" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "Kind" TEXT NOT NULL,
  "FormulaFa" TEXT NULL,
  "SourceFa" TEXT NULL,
  "Version" TEXT NULL DEFAULT '1.0',
  "Status" TEXT NOT NULL,
  "EffectiveFrom" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ClaimCalculationRule" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ClaimCalculationRule_Code" ON "ClaimCalculationRule" ("ProjectId", "Code", "Version");


-- ClaimCalculationRun · d4 · اجرای محاسبهٔ خسارت (append-only)
CREATE TABLE IF NOT EXISTS "ClaimCalculationRun" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ClaimCostItemId" TEXT NOT NULL,
  "RuleId" TEXT NULL,
  "RuleCode" TEXT NULL,
  "RuleVersion" TEXT NULL,
  "Engine" TEXT NOT NULL DEFAULT 'claim-loss-v1',
  "Inputs" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "RawAmount" NUMERIC NULL,
  "FinalAmount" NUMERIC NULL,
  "ManualAdjustment" NUMERIC NULL DEFAULT 0,
  "ManualReason" TEXT NULL,
  "Issues" TEXT NULL,
  "CalculatedBy" TEXT NULL,
  "CalculatedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ClaimCalculationRun" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ClaimCalculationRun_Item" ON "ClaimCalculationRun" ("ProjectId", "ClaimCostItemId");


-- ClaimCostAllocation · d4 · تخصیص هزینه میان رویدادها
CREATE TABLE IF NOT EXISTS "ClaimCostAllocation" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ClaimCostItemId" TEXT NOT NULL,
  "DelayEventId" TEXT NOT NULL,
  "AllocationPct" NUMERIC NOT NULL,
  "Basis" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ClaimCostAllocation" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ClaimCostAllocation_Item" ON "ClaimCostAllocation" ("ProjectId", "ClaimCostItemId");


-- ClaimDocumentVersion · d4 · نسخهٔ لایحهٔ ضرر و زیان
CREATE TABLE IF NOT EXISTS "ClaimDocumentVersion" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ClaimId" TEXT NOT NULL,
  "ClaimCode" TEXT NULL,
  "Version" INTEGER NOT NULL,
  "Format" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "Totals" TEXT NULL,
  "GeneratedBy" TEXT NULL,
  "GeneratedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ClaimDocumentVersion" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ClaimDocumentVersion_Claim" ON "ClaimDocumentVersion" ("ProjectId", "ClaimId", "Version");


-- ContractRiskRegister · d14 · دفتر ثبت ریسک قراردادی
CREATE TABLE IF NOT EXISTS "ContractRiskRegister" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DescriptionFa" TEXT NULL,
  "ContractCode" TEXT NULL,
  "ClauseRef" TEXT NULL,
  "DocumentId" TEXT NULL,
  "Category" TEXT NOT NULL,
  "CauseFa" TEXT NULL,
  "EventFa" TEXT NULL,
  "ConsequenceFa" TEXT NULL,
  "Owner" TEXT NULL,
  "IdentifiedAt" TEXT NULL,
  "Probability" INTEGER NULL,
  "ImpactTime" INTEGER NULL,
  "ImpactFinancial" INTEGER NULL,
  "ImpactLegal" INTEGER NULL,
  "ImpactOperational" INTEGER NULL,
  "ImpactQuality" INTEGER NULL,
  "ExistingControlsFa" TEXT NULL,
  "ControlEffectiveness" TEXT NULL,
  "ControlEvidenceRefs" TEXT NULL,
  "InherentScore" NUMERIC NULL,
  "InherentBand" TEXT NULL,
  "ResidualScore" NUMERIC NULL,
  "ResidualBand" TEXT NULL,
  "ScoringVersion" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'identified',
  "NextReviewDate" TEXT NULL,
  "DelayEventCode" TEXT NULL,
  "ClaimCode" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractRiskRegister" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractRiskRegister_Code" ON "ContractRiskRegister" ("ProjectId", "Code");
CREATE INDEX "IX_ContractRiskRegister_Contract" ON "ContractRiskRegister" ("ProjectId", "ContractCode");


-- ContractRiskAssessment · d14 · سابقهٔ ارزیابی ریسک قراردادی (append-only)
CREATE TABLE IF NOT EXISTS "ContractRiskAssessment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RiskCode" TEXT NOT NULL,
  "Inputs" TEXT NOT NULL,
  "InherentScore" NUMERIC NULL,
  "InherentBand" TEXT NULL,
  "ResidualScore" NUMERIC NULL,
  "ResidualBand" TEXT NULL,
  "ScoringVersion" TEXT NULL,
  "AssessedBy" TEXT NULL,
  "AssessedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractRiskAssessment" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ContractRiskAssessment_Risk" ON "ContractRiskAssessment" ("ProjectId", "RiskCode", "AssessedAt");


-- ContractRiskScoringRule · d14 · قاعده و نسخهٔ امتیازدهی ریسک قراردادی
CREATE TABLE IF NOT EXISTS "ContractRiskScoringRule" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Version" TEXT NULL DEFAULT '1.0',
  "Config" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractRiskScoringRule" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractRiskScoringRule_Code" ON "ContractRiskScoringRule" ("ProjectId", "Code", "Version");


-- ContractClauseFinding · d14 · یافتهٔ تحلیل بند قرارداد
CREATE TABLE IF NOT EXISTS "ContractClauseFinding" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NULL,
  "ContractCode" TEXT NULL,
  "ClauseNo" TEXT NULL,
  "ClauseText" TEXT NULL,
  "Kind" TEXT NOT NULL,
  "FindingFa" TEXT NULL,
  "ReasonFa" TEXT NULL,
  "Confidence" NUMERIC NULL,
  "SourceRef" TEXT NULL,
  "SuggestedCategory" TEXT NULL,
  "ReviewStatus" TEXT NOT NULL DEFAULT 'pending',
  "ReviewedBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractClauseFinding" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ContractClauseFinding_Doc" ON "ContractClauseFinding" ("ProjectId", "DocumentId");


-- ContractObligation · d14 · تعهد و مهلت قراردادی
CREATE TABLE IF NOT EXISTS "ContractObligation" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "ContractCode" TEXT NULL,
  "ClauseRef" TEXT NULL,
  "TitleFa" TEXT NOT NULL,
  "ResponsibleParty" TEXT NULL,
  "BeneficiaryParty" TEXT NULL,
  "StartDate" TEXT NULL,
  "DueDate" TEXT NULL,
  "PreconditionFa" TEXT NULL,
  "EvidenceDocumentId" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'pending',
  "NoteFa" TEXT NULL,
  "RiskCode" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractObligation" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractObligation_Code" ON "ContractObligation" ("ProjectId", "Code");
CREATE INDEX "IX_ContractObligation_Due" ON "ContractObligation" ("ProjectId", "DueDate");


-- ContractImprovement · d14 · پیشنهاد اصلاح و بهبود بند قرارداد
CREATE TABLE IF NOT EXISTS "ContractImprovement" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "ContractCode" TEXT NULL,
  "ClauseRef" TEXT NULL,
  "CurrentText" TEXT NULL,
  "ProblemFa" TEXT NULL,
  "RiskFa" TEXT NULL,
  "ConsequenceFa" TEXT NULL,
  "ProposedText" TEXT NULL,
  "ReasonFa" TEXT NULL,
  "EffectEmployerFa" TEXT NULL,
  "EffectContractorFa" TEXT NULL,
  "EffectCostTimeFa" TEXT NULL,
  "BasisFa" TEXT NULL,
  "Confidence" NUMERIC NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "ReviewerBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "RiskCode" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractImprovement" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractImprovement_Code" ON "ContractImprovement" ("ProjectId", "Code");


-- ContractRiskAction · d14 · اقدام پاسخ به ریسک قراردادی
CREATE TABLE IF NOT EXISTS "ContractRiskAction" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "RiskCode" TEXT NOT NULL,
  "Strategy" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Owner" TEXT NULL,
  "StartDate" TEXT NULL,
  "DueDate" TEXT NULL,
  "Cost" NUMERIC NULL,
  "ProgressPct" NUMERIC NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'defined',
  "EffectivenessMetricFa" TEXT NULL,
  "EvidenceDocumentId" TEXT NULL,
  "EffectivenessNoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractRiskAction" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractRiskAction_Code" ON "ContractRiskAction" ("ProjectId", "Code");
CREATE INDEX "IX_ContractRiskAction_Risk" ON "ContractRiskAction" ("ProjectId", "RiskCode");


-- PmisSchedReconMissions · d4 · مأموریت کارشناسی بازسازی زمان‌بندی ادعا
CREATE TABLE IF NOT EXISTS "PmisSchedReconMissions" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "PurposeFa" TEXT NULL,
  "PeriodFrom" TEXT NOT NULL,
  "PeriodTo" TEXT NOT NULL,
  "AnalysisStandard" TEXT NULL DEFAULT 'BOTH',
  "ClaimCode" TEXT NULL,
  "DelayEventCode" TEXT NULL,
  "ContractCode" TEXT NULL,
  "ScheduleFileRefs" TEXT NULL,
  "CurrentStep" INTEGER NULL DEFAULT 1,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "StartedAt" TEXT NULL,
  "CompletedAt" TEXT NULL,
  "ExpertNoteFa" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconMissions" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconMissions_Code" ON "PmisSchedReconMissions" ("ProjectId", "Code");


-- PmisSchedReconExtractions · d4 · مستندات استخراج‌شده از واقعیت میدانی
CREATE TABLE IF NOT EXISTS "PmisSchedReconExtractions" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "DocType" TEXT NOT NULL,
  "DocumentId" TEXT NULL,
  "SourceRef" TEXT NULL,
  "EventDate" TEXT NOT NULL,
  "PeriodFrom" TEXT NULL,
  "PeriodTo" TEXT NULL,
  "SummaryFa" TEXT NULL,
  "FactsJson" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'collected',
  "VerifiedBy" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconExtractions" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconExtractions_Code" ON "PmisSchedReconExtractions" ("ProjectId", "Code");
CREATE INDEX "IX_PmisSchedReconExtractions_Mission" ON "PmisSchedReconExtractions" ("ProjectId", "MissionCode");


-- PmisSchedReconEvaluations · d4 · ارزیابی آسیب‌دیدگی فایل زمان‌بندی و تصمیم Repair/Reconstruction
CREATE TABLE IF NOT EXISTS "PmisSchedReconEvaluations" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "FileKind" TEXT NOT NULL,
  "DocumentId" TEXT NULL,
  "BaselineDate" TEXT NULL,
  "DataDate" TEXT NULL,
  "ActivityCount" INTEGER NULL,
  "RelationshipCount" INTEGER NULL,
  "OpenEndsCount" INTEGER NULL,
  "NegativeFloatCount" INTEGER NULL,
  "LoopCount" INTEGER NULL,
  "OutOfSequenceCount" INTEGER NULL,
  "MissingCalendarCount" INTEGER NULL,
  "DamageClass" TEXT NULL,
  "Decision" TEXT NULL DEFAULT 'pending',
  "DecisionReasonFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'pending_review',
  "EvaluatedBy" TEXT NULL,
  "EvaluatedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconEvaluations" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconEvaluations_Code" ON "PmisSchedReconEvaluations" ("ProjectId", "Code");
CREATE INDEX "IX_PmisSchedReconEvaluations_Mission" ON "PmisSchedReconEvaluations" ("ProjectId", "MissionCode");


-- PmisSchedReconWbsMaps · d4 · نقشه تطبیق و همسان‌سازی WBS مصوب با واقعیت
CREATE TABLE IF NOT EXISTS "PmisSchedReconWbsMaps" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "BaselineWbsCode" TEXT NOT NULL,
  "BaselineWbsTitleFa" TEXT NULL,
  "ActualWbsCode" TEXT NULL,
  "ActualWbsTitleFa" TEXT NULL,
  "MapKind" TEXT NOT NULL,
  "Confidence" NUMERIC NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconWbsMaps" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconWbsMaps_Code" ON "PmisSchedReconWbsMaps" ("ProjectId", "MissionCode", "Code");


-- PmisSchedReconActivities · d4 · دیکشنری فعالیت‌های بازسازی‌شده
CREATE TABLE IF NOT EXISTS "PmisSchedReconActivities" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "ActivityId" TEXT NOT NULL,
  "WbsMapCode" TEXT NULL,
  "TitleFa" TEXT NOT NULL,
  "ActivityType" TEXT NULL DEFAULT 'task',
  "PlannedStart" TEXT NULL,
  "PlannedFinish" TEXT NULL,
  "ActualStart" TEXT NULL,
  "ActualFinish" TEXT NULL,
  "OriginalDuration" NUMERIC NULL,
  "ActualDuration" NUMERIC NULL,
  "PctComplete" NUMERIC NULL,
  "StatusFlag" TEXT NOT NULL DEFAULT 'not_started',
  "SourceRef" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconActivities" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconActivities_Code" ON "PmisSchedReconActivities" ("ProjectId", "MissionCode", "Code");
CREATE INDEX "IX_PmisSchedReconActivities_Activity" ON "PmisSchedReconActivities" ("ProjectId", "MissionCode", "ActivityId");


-- PmisSchedReconCalendars · d4 · تقویم‌های کاری بازسازی‌شده، شیفت‌ها و تعلیق‌های جوی
CREATE TABLE IF NOT EXISTS "PmisSchedReconCalendars" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "BaseKind" TEXT NOT NULL,
  "DaysPerWeek" INTEGER NULL,
  "HoursPerDay" NUMERIC NULL,
  "ShiftDefJson" TEXT NULL,
  "ExceptionsJson" TEXT NULL,
  "ValidFrom" TEXT NULL,
  "ValidTo" TEXT NULL,
  "SourceRef" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconCalendars" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconCalendars_Code" ON "PmisSchedReconCalendars" ("ProjectId", "MissionCode", "Code");


-- PmisSchedReconDurations · d4 · مدت‌های واقعی بازسازی‌شده در برابر برنامه‌ای
CREATE TABLE IF NOT EXISTS "PmisSchedReconDurations" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "ActivityCode" TEXT NOT NULL,
  "PlannedDuration" NUMERIC NULL,
  "ObservedDuration" NUMERIC NULL,
  "Deviation" NUMERIC NULL,
  "Method" TEXT NOT NULL,
  "EvidenceRefs" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'estimated',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconDurations" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconDurations_Activity" ON "PmisSchedReconDurations" ("ProjectId", "MissionCode", "ActivityCode");


-- PmisSchedReconLogic · d4 · منطق شبکهٔ بازسازی‌شده؛ روابط FS/SS/FF/SF و Lag/Lead
CREATE TABLE IF NOT EXISTS "PmisSchedReconLogic" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "PredecessorCode" TEXT NOT NULL,
  "SuccessorCode" TEXT NOT NULL,
  "RelType" TEXT NOT NULL,
  "Lag" NUMERIC NULL DEFAULT 0,
  "LagUnit" TEXT NULL DEFAULT 'd',
  "ReconstructionBasis" TEXT NOT NULL,
  "EvidenceRef" TEXT NULL,
  "Confidence" NUMERIC NULL,
  "Flag" TEXT NOT NULL DEFAULT 'normal',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconLogic" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconLogic_Code" ON "PmisSchedReconLogic" ("ProjectId", "MissionCode", "Code");
CREATE INDEX "IX_PmisSchedReconLogic_Pred" ON "PmisSchedReconLogic" ("ProjectId", "MissionCode", "PredecessorCode");


-- PmisSchedReconCriticalPaths · d4 · ردیابی تغییرات مسیر بحرانی در مقاطع زمانی
CREATE TABLE IF NOT EXISTS "PmisSchedReconCriticalPaths" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "SnapshotCode" TEXT NOT NULL,
  "PathRank" INTEGER NULL DEFAULT 1,
  "ActivityCodes" TEXT NULL,
  "TotalDuration" NUMERIC NULL,
  "DrivingLogic" TEXT NULL,
  "ChangeKind" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconCriticalPaths" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconCriticalPaths_Code" ON "PmisSchedReconCriticalPaths" ("ProjectId", "MissionCode", "Code");
CREATE INDEX "IX_PmisSchedReconCriticalPaths_Snapshot" ON "PmisSchedReconCriticalPaths" ("ProjectId", "MissionCode", "SnapshotCode");


-- PmisSchedReconSnapshots · d4 · مقاطع زمانی و قطع‌های دوره‌ای (Cut-Off Dates)
CREATE TABLE IF NOT EXISTS "PmisSchedReconSnapshots" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "LabelFa" TEXT NOT NULL,
  "CutoffDate" TEXT NOT NULL,
  "DataKind" TEXT NULL,
  "SourceRefs" TEXT NULL,
  "MetricsJson" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'open',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconSnapshots" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconSnapshots_Code" ON "PmisSchedReconSnapshots" ("ProjectId", "MissionCode", "Code");


-- PmisSchedReconValidations · d4 · یافته‌های اعتبارسنجی مدل زمان‌بندی
CREATE TABLE IF NOT EXISTS "PmisSchedReconValidations" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "SnapshotCode" TEXT NULL,
  "CheckKind" TEXT NOT NULL,
  "Severity" TEXT NOT NULL,
  "ActivityCode" TEXT NULL,
  "DetailFa" TEXT NULL,
  "AutoDetected" INTEGER NULL,
  "Resolution" TEXT NOT NULL DEFAULT 'open',
  "ResolvedBy" TEXT NULL,
  "ResolvedAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconValidations" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconValidations_Code" ON "PmisSchedReconValidations" ("ProjectId", "MissionCode", "Code");
CREATE INDEX "IX_PmisSchedReconValidations_Kind" ON "PmisSchedReconValidations" ("ProjectId", "MissionCode", "CheckKind");


-- PmisSchedReconMipMappings · d4 · تطبیق دادهٔ بازسازی با پروتکل‌های AACE 29R-03 (MIP 3.1..3.9)
CREATE TABLE IF NOT EXISTS "PmisSchedReconMipMappings" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "MipCode" TEXT NOT NULL,
  "Family" TEXT NULL,
  "Feasibility" TEXT NULL,
  "FeasibilityReasonFa" TEXT NULL,
  "RequiredDataJson" TEXT NULL,
  "ProvidedDataJson" TEXT NULL,
  "SelectedFlag" INTEGER NULL,
  "SelectedBy" TEXT NULL,
  "SelectedAt" TEXT NULL,
  "OutputTableRefs" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisSchedReconMipMappings" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisSchedReconMipMappings_Mip" ON "PmisSchedReconMipMappings" ("ProjectId", "MissionCode", "MipCode");


-- PmisDisputeCases · d4 · پرونده اختلاف
CREATE TABLE IF NOT EXISTS "PmisDisputeCases" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "SubjectCode" TEXT NOT NULL,
  "DescriptionFa" TEXT NULL,
  "EmployerFa" TEXT NULL,
  "ContractorFa" TEXT NULL,
  "ConsultantFa" TEXT NULL,
  "CourtRefFa" TEXT NULL,
  "ExpertScopeFa" TEXT NULL,
  "ClaimDescriptionFa" TEXT NULL,
  "ClaimedAmount" NUMERIC NULL,
  "Currency" TEXT NULL DEFAULT 'IRR',
  "ClaimedDelayDays" INTEGER NULL,
  "ContractCode" TEXT NULL,
  "ClaimCode" TEXT NULL,
  "DelayEventCode" TEXT NULL,
  "DelayCaseId" TEXT NULL,
  "LossCaseId" TEXT NULL,
  "ContractRiskId" TEXT NULL,
  "IncidentDate" TEXT NULL,
  "RegistrationDate" TEXT NULL,
  "ResponseDeadline" TEXT NULL,
  "DeliveryDeadline" TEXT NULL,
  "Priority" TEXT NULL DEFAULT 'normal',
  "InternalOwnerFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "StatusChangedBy" TEXT NULL,
  "StatusChangedAt" TEXT NULL,
  "StatusNoteFa" TEXT NULL,
  "ExpertNoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeCases" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeCases_Code" ON "PmisDisputeCases" ("ProjectId", "Code");
CREATE INDEX "IX_PmisDisputeCases_Status" ON "PmisDisputeCases" ("ProjectId", "Status");
CREATE INDEX "IX_PmisDisputeCases_Contract" ON "PmisDisputeCases" ("ProjectId", "ContractCode");


-- PmisDisputeParties · d4 · طرفین و نمایندگان پرونده
CREATE TABLE IF NOT EXISTS "PmisDisputeParties" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "Role" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "OrgInfoFa" TEXT NULL,
  "RepresentativeFa" TEXT NULL,
  "ContactInfo" TEXT NULL,
  "ClaimLinkNoteFa" TEXT NULL,
  "Status" TEXT NULL DEFAULT 'active',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeParties" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeParties_Code" ON "PmisDisputeParties" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeParties_Case" ON "PmisDisputeParties" ("ProjectId", "CaseCode");


-- PmisDisputeClaims · d4 · ادعای پرونده
CREATE TABLE IF NOT EXISTS "PmisDisputeClaims" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DemandFa" TEXT NULL,
  "ClaimantPartyCode" TEXT NOT NULL,
  "BasisKind" TEXT NOT NULL,
  "ClaimedAmount" NUMERIC NULL,
  "Currency" TEXT NULL DEFAULT 'IRR',
  "ClaimedDelayDays" INTEGER NULL,
  "ContractClauseRef" TEXT NULL,
  "EventRefs" TEXT NULL,
  "EvidenceRefs" TEXT NULL,
  "ResponseFa" TEXT NULL,
  "AgreementsFa" TEXT NULL,
  "DisagreementsFa" TEXT NULL,
  "EvidenceSufficiency" TEXT NULL DEFAULT 'unchecked',
  "ContradictionsFa" TEXT NULL,
  "QuestionsJson" TEXT NULL,
  "ReviewedAmount" NUMERIC NULL,
  "ReviewBasisFa" TEXT NULL,
  "ReviewedBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "ApprovedAmount" NUMERIC NULL,
  "ApprovedBasisFa" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ReviewResultFa" TEXT NULL,
  "ReviewStatus" TEXT NULL DEFAULT 'open',
  "ExpertNoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeClaims" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeClaims_Code" ON "PmisDisputeClaims" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeClaims_Case" ON "PmisDisputeClaims" ("ProjectId", "CaseCode");


-- PmisDisputeResponses · d4 · پاسخ و دفاعیه طرف مقابل
CREATE TABLE IF NOT EXISTS "PmisDisputeResponses" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "ClaimCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "ResponderPartyCode" TEXT NOT NULL,
  "BodyFa" TEXT NOT NULL,
  "EvidenceRefs" TEXT NULL,
  "ReceivedAt" TEXT NULL,
  "DocumentId" TEXT NULL,
  "AssessmentFa" TEXT NULL,
  "Status" TEXT NULL DEFAULT 'received',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeResponses" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeResponses_Code" ON "PmisDisputeResponses" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeResponses_Claim" ON "PmisDisputeResponses" ("ProjectId", "CaseCode", "ClaimCode");


-- PmisDisputeEvidence · d4 · مدرک/سند پرونده
CREATE TABLE IF NOT EXISTS "PmisDisputeEvidence" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "DocType" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DocumentId" TEXT NULL,
  "DocNo" TEXT NULL,
  "Revision" TEXT NULL,
  "IssuedAt" TEXT NULL,
  "ReceivedAt" TEXT NULL,
  "SenderFa" TEXT NULL,
  "ReceiverFa" TEXT NULL,
  "ContractClauseRef" TEXT NULL,
  "ClaimRefs" TEXT NULL,
  "EventRefs" TEXT NULL,
  "CalculationRefs" TEXT NULL,
  "ExpertNoteFa" TEXT NULL,
  "ReviewStatus" TEXT NULL DEFAULT 'pending',
  "AuthenticityStatus" TEXT NULL DEFAULT 'pending',
  "SufficiencyStatus" TEXT NULL DEFAULT 'unchecked',
  "DeficiencyNoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeEvidence" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeEvidence_Code" ON "PmisDisputeEvidence" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeEvidence_Case" ON "PmisDisputeEvidence" ("ProjectId", "CaseCode");


-- PmisDisputeAnalyses · d4 · تحلیل کارشناسی
CREATE TABLE IF NOT EXISTS "PmisDisputeAnalyses" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TopicFa" TEXT NOT NULL,
  "QuestionFa" TEXT NOT NULL,
  "InputDataJson" TEXT NULL,
  "EvidenceRefs" TEXT NULL,
  "MethodFa" TEXT NOT NULL,
  "AssumptionsFa" TEXT NULL,
  "CalculationsFa" TEXT NULL,
  "ResultsFa" TEXT NULL,
  "UncertaintiesFa" TEXT NULL,
  "InfoGapsFa" TEXT NULL,
  "MethodLimitsFa" TEXT NULL,
  "SuggestedConclusionFa" TEXT NULL,
  "AnalyzedBy" TEXT NULL,
  "AnalyzedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ApprovalStatus" TEXT NULL DEFAULT 'draft',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeAnalyses" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeAnalyses_Code" ON "PmisDisputeAnalyses" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeAnalyses_Case" ON "PmisDisputeAnalyses" ("ProjectId", "CaseCode");


-- PmisDisputeCalculations · d4 · محاسبه مستقل کارشناسی برای مقایسه
CREATE TABLE IF NOT EXISTS "PmisDisputeCalculations" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "PurposeFa" TEXT NULL,
  "MethodFa" TEXT NOT NULL,
  "InputsJson" TEXT NULL,
  "ResultAmount" NUMERIC NULL,
  "Currency" TEXT NULL,
  "ResultBaseDate" TEXT NULL,
  "DataSourceFa" TEXT NULL,
  "ComparedWithClaimCode" TEXT NULL,
  "VarianceNoteFa" TEXT NULL,
  "CalculatedBy" TEXT NULL,
  "CalculatedAt" TEXT NULL,
  "ReviewedBy" TEXT NULL,
  "Status" TEXT NULL DEFAULT 'draft',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeCalculations" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeCalculations_Code" ON "PmisDisputeCalculations" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeCalculations_Case" ON "PmisDisputeCalculations" ("ProjectId", "CaseCode");


-- PmisDisputeHearings · d4 · جلسه و صورت‌جلسه
CREATE TABLE IF NOT EXISTS "PmisDisputeHearings" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "MeetingDate" TEXT NOT NULL,
  "LocationFa" TEXT NULL,
  "AttendeesJson" TEXT NULL,
  "TopicsJson" TEXT NULL,
  "QuestionsJson" TEXT NULL,
  "ResponsesJson" TEXT NULL,
  "DocsShownJson" TEXT NULL,
  "QuestionDeadline" TEXT NULL,
  "MinutesBodyFa" TEXT NULL,
  "MinutesDocumentId" TEXT NULL,
  "MinutesStatus" TEXT NULL DEFAULT 'draft',
  "SignedAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeHearings" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeHearings_Code" ON "PmisDisputeHearings" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeHearings_Case" ON "PmisDisputeHearings" ("ProjectId", "CaseCode");


-- PmisDisputeOpinions · d4 · نظریه کارشناسی
CREATE TABLE IF NOT EXISTS "PmisDisputeOpinions" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "BodyFa" TEXT NOT NULL,
  "SourcesJson" TEXT NULL,
  "Version" INTEGER NOT NULL DEFAULT 1,
  "PreviousVersionCode" TEXT NULL,
  "SupplementaryNoteFa" TEXT NULL,
  "AuthoredBy" TEXT NULL,
  "AuthoredAt" TEXT NULL,
  "ReviewedBy" TEXT NULL,
  "ReviewStatus" TEXT NULL DEFAULT 'draft',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeOpinions" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeOpinions_Code" ON "PmisDisputeOpinions" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeOpinions_Case" ON "PmisDisputeOpinions" ("ProjectId", "CaseCode");


-- PmisDisputeReports · d4 · نسخهٔ گزارش کارشناسی
CREATE TABLE IF NOT EXISTS "PmisDisputeReports" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Version" INTEGER NOT NULL DEFAULT 1,
  "PreviousVersionCode" TEXT NULL,
  "EnabledSectionsJson" TEXT NULL,
  "GeneratedAt" TEXT NULL,
  "GeneratedBy" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "IssuedAt" TEXT NULL,
  "IssuedBy" TEXT NULL,
  "DataVersionNoteFa" TEXT NULL,
  "WordFileRef" TEXT NULL,
  "PdfFileRef" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeReports" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeReports_Code" ON "PmisDisputeReports" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeReports_Case" ON "PmisDisputeReports" ("ProjectId", "CaseCode", "Status");


-- PmisDisputeDeadlines · d4 · ارجاع و مهلت
CREATE TABLE IF NOT EXISTS "PmisDisputeDeadlines" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Kind" TEXT NOT NULL,
  "DueDate" TEXT NOT NULL,
  "OwnerPartyCode" TEXT NULL,
  "RelatedCode" TEXT NULL,
  "Status" TEXT NULL DEFAULT 'open',
  "MetAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeDeadlines" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeDeadlines_Code" ON "PmisDisputeDeadlines" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeDeadlines_Due" ON "PmisDisputeDeadlines" ("ProjectId", "Status", "DueDate");


-- PmisDisputeModuleLinks · d4 · پیوند نرم به ماژول/پرونده بیرونی
CREATE TABLE IF NOT EXISTS "PmisDisputeModuleLinks" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "LinkKind" TEXT NOT NULL,
  "TargetCode" TEXT NOT NULL,
  "TargetTitleFa" TEXT NOT NULL,
  "TargetId" TEXT NULL,
  "ConsistencyCheckFa" TEXT NULL,
  "QuestionSentFa" TEXT NULL,
  "CorrectionRequestFa" TEXT NULL,
  "EstablishedBy" TEXT NULL,
  "EstablishedAt" TEXT NULL,
  "Status" TEXT NULL DEFAULT 'active',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeModuleLinks" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisDisputeModuleLinks_Code" ON "PmisDisputeModuleLinks" ("ProjectId", "CaseCode", "Code");
CREATE INDEX "IX_PmisDisputeModuleLinks_Case" ON "PmisDisputeModuleLinks" ("ProjectId", "CaseCode");


-- PmisDisputeAuditTrail · d4 · رویداد تاریخچهٔ پرونده
CREATE TABLE IF NOT EXISTS "PmisDisputeAuditTrail" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CaseCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "Action" TEXT NOT NULL,
  "Actor" TEXT NOT NULL,
  "DetailFa" TEXT NULL,
  "FromValue" TEXT NULL,
  "ToValue" TEXT NULL,
  "OccurredAt" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisDisputeAuditTrail" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_PmisDisputeAuditTrail_Case" ON "PmisDisputeAuditTrail" ("ProjectId", "CaseCode", "OccurredAt");


-- PmisChangeRequests · d4 · درخواست تغییر (چرخهٔ کامل)
CREATE TABLE IF NOT EXISTS "PmisChangeRequests" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "ContractCode" TEXT NULL,
  "DescriptionFa" TEXT NULL,
  "RequestedBy" TEXT NOT NULL,
  "RequestedByRoleCode" TEXT NULL,
  "RequestDate" TEXT NULL,
  "ChangeType" TEXT NULL,
  "ReasonFa" TEXT NULL,
  "NecessityFa" TEXT NULL,
  "AffectedScopeFa" TEXT NULL,
  "WbsRefs" TEXT NULL,
  "ActivityRefs" TEXT NULL,
  "SupportDocRefs" TEXT NULL,
  "ClauseRefs" TEXT NULL,
  "OptionsJson" TEXT NULL,
  "InitialCostEstimate" NUMERIC NULL,
  "Currency" TEXT NULL DEFAULT 'IRR',
  "InitialTimeImpactDays" INTEGER NULL,
  "InitialRisksJson" TEXT NULL,
  "Priority" TEXT NULL DEFAULT 'normal',
  "ReviewOwnerFa" TEXT NULL,
  "ReviewDueDate" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "StatusChangedBy" TEXT NULL,
  "StatusChangedAt" TEXT NULL,
  "StatusNoteFa" TEXT NULL,
  "DecisionFa" TEXT NULL,
  "RejectionReasonFa" TEXT NULL,
  "DecidedBy" TEXT NULL,
  "DecidedAt" TEXT NULL,
  "ClosedAt" TEXT NULL,
  "ClosedBy" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeRequests" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeRequests_Code" ON "PmisChangeRequests" ("ProjectId", "Code");
CREATE INDEX "IX_PmisChangeRequests_Status" ON "PmisChangeRequests" ("ProjectId", "Status");
CREATE INDEX "IX_PmisChangeRequests_Contract" ON "PmisChangeRequests" ("ProjectId", "ContractCode");


-- PmisChangeImpacts · d4 · بررسی فنی/مهندسی اثر تغییر
CREATE TABLE IF NOT EXISTS "PmisChangeImpacts" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ChangeCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TopicFa" TEXT NOT NULL,
  "Aspect" TEXT NULL,
  "AffectedItemsJson" TEXT NULL,
  "ConclusionFa" TEXT NOT NULL,
  "AssumptionsFa" TEXT NULL,
  "LimitationsFa" TEXT NULL,
  "AnalyzedBy" TEXT NULL,
  "AnalyzedAt" TEXT NULL,
  "ReviewStatus" TEXT NULL DEFAULT 'draft',
  "ReviewedBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "ReviewNoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeImpacts" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeImpacts_Code" ON "PmisChangeImpacts" ("ProjectId", "ChangeCode", "Code");


-- PmisChangeCostEstimates · d4 · برآورد هزینهٔ لایه‌ای تغییر
CREATE TABLE IF NOT EXISTS "PmisChangeCostEstimates" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ChangeCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "Layer" TEXT NOT NULL,
  "Amount" NUMERIC NOT NULL,
  "Currency" TEXT NULL DEFAULT 'IRR',
  "FormulaFa" TEXT NOT NULL,
  "UnitFa" TEXT NULL,
  "InputDataJson" TEXT NULL,
  "SourceFa" TEXT NOT NULL,
  "BasisDate" TEXT NOT NULL,
  "DirectAmount" NUMERIC NULL,
  "IndirectAmount" NUMERIC NULL,
  "TimeRelatedAmount" NUMERIC NULL,
  "ScopeNoteFa" TEXT NULL,
  "PreparedBy" TEXT NULL,
  "PreparedAt" TEXT NULL,
  "ReviewStatus" TEXT NULL DEFAULT 'draft',
  "ReviewedBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "ReviewNoteFa" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeCostEstimates" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeCostEstimates_Code" ON "PmisChangeCostEstimates" ("ProjectId", "ChangeCode", "Code");
CREATE INDEX "IX_PmisChangeCostEstimates_Layer" ON "PmisChangeCostEstimates" ("ProjectId", "Layer");


-- PmisChangeScheduleImpacts · d4 · تحلیل اثر تغییر بر زمان‌بندی
CREATE TABLE IF NOT EXISTS "PmisChangeScheduleImpacts" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ChangeCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "BaselineVersionRef" TEXT NULL,
  "MethodFa" TEXT NOT NULL,
  "AffectedActivitiesJson" TEXT NULL,
  "CriticalPathEffect" TEXT NULL,
  "FloatEffectDays" INTEGER NULL,
  "EstimatedDurationDeltaDays" INTEGER NULL,
  "CompletionEffectDays" INTEGER NULL,
  "ApprovedEotDays" INTEGER NULL,
  "EotEntitlementFa" TEXT NULL,
  "AssumptionsFa" TEXT NOT NULL,
  "LimitationsFa" TEXT NULL,
  "DataVersionNoteFa" TEXT NULL,
  "PreparedBy" TEXT NULL,
  "PreparedAt" TEXT NULL,
  "ReviewStatus" TEXT NULL DEFAULT 'draft',
  "ReviewedBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "ReviewNoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeScheduleImpacts" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeScheduleImpacts_Code" ON "PmisChangeScheduleImpacts" ("ProjectId", "ChangeCode", "Code");


-- PmisChangeApprovals · d4 · گام تصویب گردش‌کار
CREATE TABLE IF NOT EXISTS "PmisChangeApprovals" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ChangeCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "StepCode" TEXT NOT NULL,
  "Stage" TEXT NULL,
  "Decision" TEXT NULL DEFAULT 'pending',
  "DecidedBy" TEXT NULL,
  "DecidedAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "ConditionsFa" TEXT NULL,
  "Sequence" INTEGER NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeApprovals" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeApprovals_Code" ON "PmisChangeApprovals" ("ProjectId", "ChangeCode", "Code");


-- PmisChangeRiskLinks · d4 · پیوند ریسکِ ناشی از تغییر
CREATE TABLE IF NOT EXISTS "PmisChangeRiskLinks" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ChangeCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "LinkType" TEXT NOT NULL,
  "DescriptionFa" TEXT NOT NULL,
  "RiskRegisterRef" TEXT NULL,
  "Probability" INTEGER NULL,
  "Severity" INTEGER NULL,
  "Score" INTEGER NULL,
  "MethodFa" TEXT NULL,
  "OwnerFa" TEXT NULL,
  "ControlActionsJson" TEXT NULL,
  "ActionDueDate" TEXT NULL,
  "ResidualNoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeRiskLinks" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeRiskLinks_Code" ON "PmisChangeRiskLinks" ("ProjectId", "ChangeCode", "Code");


-- PmisChangeClaimLinks · d4 · ادعا/اختلاف مرتبط با تغییر
CREATE TABLE IF NOT EXISTS "PmisChangeClaimLinks" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ChangeCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "LinkType" TEXT NOT NULL,
  "DescriptionFa" TEXT NOT NULL,
  "ClaimRefCode" TEXT NULL,
  "ExpertCaseRef" TEXT NULL,
  "CorrespondenceJson" TEXT NULL,
  "SupportingDocRefsJson" TEXT NULL,
  "Status" TEXT NULL DEFAULT 'open',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeClaimLinks" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeClaimLinks_Code" ON "PmisChangeClaimLinks" ("ProjectId", "ChangeCode", "Code");


-- PmisChangeDocuments · d4 · سند پشتیبان تغییر
CREATE TABLE IF NOT EXISTS "PmisChangeDocuments" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ChangeCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Kind" TEXT NOT NULL,
  "DocNo" TEXT NULL,
  "DocRef" TEXT NULL,
  "VersionFa" TEXT NULL,
  "DocDate" TEXT NULL,
  "FileRef" TEXT NULL,
  "FileNameFa" TEXT NULL,
  "MimeType" TEXT NULL,
  "SizeBytes" INTEGER NULL,
  "Sha256" TEXT NULL,
  "UploadedBy" TEXT NULL,
  "UploadedAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeDocuments" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeDocuments_Code" ON "PmisChangeDocuments" ("ProjectId", "ChangeCode", "Code");


-- PmisChangeImplementation · d4 · کنترل اجرای تغییر مصوب
CREATE TABLE IF NOT EXISTS "PmisChangeImplementation" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ChangeCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "Step" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "BaselineUpdateRef" TEXT NULL,
  "ExecutionResultFa" TEXT NULL,
  "VerifiedBy" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "VerifiedNoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeImplementation" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeImplementation_Code" ON "PmisChangeImplementation" ("ProjectId", "ChangeCode", "Code");


-- PmisChangeAuditTrail · d4 · رویداد تاریخچهٔ تغییر
CREATE TABLE IF NOT EXISTS "PmisChangeAuditTrail" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ChangeCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "Action" TEXT NOT NULL,
  "Actor" TEXT NOT NULL,
  "DetailFa" TEXT NULL,
  "FromValue" TEXT NULL,
  "ToValue" TEXT NULL,
  "OccurredAt" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeAuditTrail" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_PmisChangeAuditTrail_Change" ON "PmisChangeAuditTrail" ("ProjectId", "ChangeCode", "OccurredAt");


-- PmisChangeModuleLinks · d4 · پیوند نرم تغییر به ماژول‌ها
CREATE TABLE IF NOT EXISTS "PmisChangeModuleLinks" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ChangeCode" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "LinkKind" TEXT NOT NULL,
  "TargetCode" TEXT NOT NULL,
  "TargetTitleFa" TEXT NOT NULL,
  "TargetId" TEXT NULL,
  "NoteFa" TEXT NULL,
  "EstablishedBy" TEXT NULL,
  "EstablishedAt" TEXT NULL,
  "Status" TEXT NULL DEFAULT 'active',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeModuleLinks" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeModuleLinks_Code" ON "PmisChangeModuleLinks" ("ProjectId", "ChangeCode", "Code");


-- PmisChangeSettings · d4 · تنظیمات گردش‌کار تغییر
CREATE TABLE IF NOT EXISTS "PmisChangeSettings" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SettingKey" TEXT NOT NULL,
  "SettingValueJson" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmisChangeSettings" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmisChangeSettings_Key" ON "PmisChangeSettings" ("ProjectId", "SettingKey");


-- CostAccount · d5 · حساب هزینه
CREATE TABLE IF NOT EXISTS "CostAccount" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Budget" NUMERIC NOT NULL,
  "Committed" NUMERIC NOT NULL DEFAULT 0,
  "Actual" NUMERIC NOT NULL DEFAULT 0,
  "Currency" TEXT NULL DEFAULT 'IRR',
  "ParentCode" TEXT NULL,
  "Kind" TEXT NULL,
  "Category" TEXT NULL,
  "ProgressPct" NUMERIC NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CostAccount" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CostAccount_Code" ON "CostAccount" ("ProjectId", "Code");


-- PaymentCertificate · d5 · صورت‌وضعیت
CREATE TABLE IF NOT EXISTS "PaymentCertificate" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SerialNo" INTEGER NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "GrossAmount" NUMERIC NOT NULL,
  "Deductions" NUMERIC NULL DEFAULT 0,
  "NetAmount" NUMERIC NULL,
  "Status" TEXT NOT NULL,
  "PreparedBy" TEXT NOT NULL,
  "PreparedAt" TEXT NOT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PaymentCertificate" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PaymentCertificate" ON "PaymentCertificate" ("ProjectId", "SerialNo");


-- PurchaseRequisition · d5 · درخواست خرید
CREATE TABLE IF NOT EXISTS "PurchaseRequisition" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "MrCode" TEXT NULL,
  "TitleFa" TEXT NOT NULL,
  "Discipline" TEXT NULL,
  "RequestedBy" TEXT NOT NULL,
  "RequestedAt" TEXT NOT NULL,
  "NeedByDate" TEXT NULL,
  "EstimatedAmount" NUMERIC NULL,
  "Currency" TEXT NULL,
  "CostAccountCode" TEXT NULL,
  "BudgetStatus" TEXT NULL,
  "Status" TEXT NOT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "RemarksFa" TEXT NULL,
  "Quantity" NUMERIC NULL,
  "Unit" TEXT NULL,
  "IsUrgent" INTEGER NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PurchaseRequisition" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PurchaseRequisition" ON "PurchaseRequisition" ("ProjectId", "Code");
CREATE INDEX "IX_PurchaseRequisition_Mr" ON "PurchaseRequisition" ("ProjectId", "MrCode");


-- PurchaseOrder · d5 · سفارش خرید
CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PoNo" TEXT NOT NULL,
  "PrCode" TEXT NULL,
  "VendorName" TEXT NOT NULL,
  "VendorCode" TEXT NULL,
  "TitleFa" TEXT NOT NULL,
  "Discipline" TEXT NULL,
  "IssuedAt" TEXT NOT NULL,
  "PromisedDate" TEXT NULL,
  "Amount" NUMERIC NULL,
  "Currency" TEXT NULL,
  "CostAccountCode" TEXT NULL,
  "Status" TEXT NOT NULL,
  "ClosedAt" TEXT NULL,
  "RemarksFa" TEXT NULL,
  "Quantity" NUMERIC NULL,
  "Unit" TEXT NULL,
  "UnitPrice" NUMERIC NULL,
  "ReceivedQty" NUMERIC NULL,
  "InvoicedQty" NUMERIC NULL,
  "InvoiceUnitPrice" NUMERIC NULL,
  "PaidAmount" NUMERIC NULL,
  "DeliveredDate" TEXT NULL,
  "KpiOnTimePct" INTEGER NULL,
  "KpiQualityPct" INTEGER NULL,
  "KpiPricePct" INTEGER NULL,
  "KpiResponsePct" INTEGER NULL,
  "KpiHsePct" INTEGER NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PurchaseOrder" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PurchaseOrder" ON "PurchaseOrder" ("ProjectId", "PoNo");
CREATE INDEX "IX_PurchaseOrder_Pr" ON "PurchaseOrder" ("ProjectId", "PrCode");


-- FinSetting · d5 · تنظیمات مالی پروژه
CREATE TABLE IF NOT EXISTS "FinSetting" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DataDate" TEXT NOT NULL,
  "CurrentPeriod" INTEGER NOT NULL,
  "PeriodCount" INTEGER NOT NULL,
  "Curve" TEXT NULL,
  "Rates" TEXT NULL,
  "BillingMarkupPct" NUMERIC NULL,
  "CollectionLagPeriods" INTEGER NULL,
  "RetentionPct" NUMERIC NULL,
  "AdvanceRecoveryPct" NUMERIC NULL,
  "LegalDeductionPct" NUMERIC NULL,
  "MrpHorizonDays" INTEGER NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_FinSetting" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_FinSetting" ON "FinSetting" ("ProjectId");


-- CostTransaction · d5 · هزینهٔ واقعی
CREATE TABLE IF NOT EXISTS "CostTransaction" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "CostAccountCode" TEXT NOT NULL,
  "DescriptionFa" TEXT NOT NULL,
  "Amount" NUMERIC NOT NULL,
  "Currency" TEXT NOT NULL,
  "BaseAmount" NUMERIC NOT NULL,
  "PeriodNo" INTEGER NOT NULL,
  "TxnDate" TEXT NULL,
  "SourceType" TEXT NOT NULL,
  "SourceRef" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CostTransaction" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CostTransaction" ON "CostTransaction" ("ProjectId", "Code");
CREATE INDEX "IX_CostTransaction_Account" ON "CostTransaction" ("ProjectId", "CostAccountCode");


-- StockItem · d5 · کالای انبار
CREATE TABLE IF NOT EXISTS "StockItem" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Unit" TEXT NULL,
  "OnHand" NUMERIC NOT NULL,
  "AvgDailyUse" NUMERIC NOT NULL,
  "MaxDailyUse" NUMERIC NOT NULL,
  "LeadTimeDays" INTEGER NOT NULL,
  "UnitCost" NUMERIC NOT NULL,
  "OnOrder" NUMERIC NULL,
  "BatchNo" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_StockItem" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_StockItem" ON "StockItem" ("ProjectId", "Code");


-- Receivable · d5 · مطالبه
CREATE TABLE IF NOT EXISTS "Receivable" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "PartyFa" TEXT NOT NULL,
  "Amount" NUMERIC NOT NULL,
  "Currency" TEXT NULL,
  "DueDate" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "CollectedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Receivable" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_Receivable" ON "Receivable" ("ProjectId", "Code");


-- BudgetTransfer · d5 · جابه‌جایی بودجه
CREATE TABLE IF NOT EXISTS "BudgetTransfer" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "FromCode" TEXT NOT NULL,
  "ToCode" TEXT NOT NULL,
  "Amount" NUMERIC NOT NULL,
  "Authority" TEXT NOT NULL,
  "ReasonFa" TEXT NULL,
  "ApprovedBy" TEXT NOT NULL,
  "ApprovedAt" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_BudgetTransfer" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_BudgetTransfer" ON "BudgetTransfer" ("ProjectId", "Code");


-- Ncr · d8 · عدم انطباق
CREATE TABLE IF NOT EXISTS "Ncr" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Severity" TEXT NOT NULL,
  "Discipline" TEXT NOT NULL,
  "RaisedBy" TEXT NOT NULL,
  "RaisedAt" TEXT NOT NULL,
  "DueAt" TEXT NULL,
  "Status" TEXT NOT NULL,
  "ClosedBy" TEXT NULL,
  "ClosedAt" TEXT NULL,
  "Disposition" TEXT NULL,
  "ActivityId" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Ncr" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_Ncr_Code" ON "Ncr" ("ProjectId", "Code");
CREATE INDEX "IX_Ncr_Open" ON "Ncr" ("ProjectId", "Status", "Severity");
CREATE INDEX "IX_Ncr_Activity" ON "Ncr" ("ProjectId", "ActivityId", "Status");


-- InspectionRecord · d8 · گزارش بازرسی
CREATE TABLE IF NOT EXISTS "InspectionRecord" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "ItpPointCode" TEXT NOT NULL,
  "ActivityId" TEXT NOT NULL,
  "InspectedAt" TEXT NOT NULL,
  "Outcome" TEXT NOT NULL,
  "InspectedBy" TEXT NOT NULL,
  "WitnessedBy" TEXT NULL,
  "Remarks" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_InspectionRecord" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_InspectionRecord_Code" ON "InspectionRecord" ("ProjectId", "Code");


-- WorkforceMember · d10 · نیروی کار
CREATE TABLE IF NOT EXISTS "WorkforceMember" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "FullName" TEXT NOT NULL,
  "TradeCode" TEXT NOT NULL,
  "Discipline" TEXT NULL,
  "NationalId" TEXT NULL,
  "Mobile" TEXT NULL,
  "DailyRate" NUMERIC NULL,
  "IsSubcontracted" INTEGER NOT NULL DEFAULT 0,
  "Active" INTEGER NOT NULL DEFAULT 1,
  "LicenseType" TEXT NULL,
  "LicenseExpiry" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_WorkforceMember" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_WorkforceMember" ON "WorkforceMember" ("ProjectId", "PersonnelNo");


-- Timesheet · d10 · تایم‌شیت
CREATE TABLE IF NOT EXISTS "Timesheet" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MemberId" TEXT NOT NULL,
  "WorkDate" TEXT NOT NULL,
  "NormalHours" NUMERIC NOT NULL DEFAULT 0,
  "OvertimeHours" NUMERIC NOT NULL DEFAULT 0,
  "HolidayHours" NUMERIC NOT NULL DEFAULT 0,
  "ActivityId" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "EnteredBy" TEXT NOT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Timesheet" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_Timesheet" ON "Timesheet" ("MemberId", "WorkDate");


-- HrmTimesheetHeader · d10 · برگهٔ روزانهٔ کارکرد
CREATE TABLE IF NOT EXISTS "HrmTimesheetHeader" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CrewId" TEXT NOT NULL,
  "ObsNodeId" TEXT NULL,
  "WorkDate" TEXT NOT NULL,
  "Shift" TEXT NOT NULL DEFAULT 'day',
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "Source" TEXT NOT NULL DEFAULT 'web',
  "Weather" TEXT NULL,
  "SiteCondition" TEXT NULL,
  "GpsLat" NUMERIC NULL,
  "GpsLng" NUMERIC NULL,
  "GpsAccuracyM" NUMERIC NULL,
  "PhotoRefs" TEXT NULL,
  "ForemanSignatureRef" TEXT NULL,
  "ClientSignatureRef" TEXT NULL,
  "DeviceId" TEXT NULL,
  "AppVersion" TEXT NULL,
  "CapturedAt" TEXT NULL,
  "SyncState" TEXT NOT NULL DEFAULT 'synced',
  "Revision" INTEGER NOT NULL DEFAULT 1,
  "LockedAt" TEXT NULL,
  "LockedBy" TEXT NULL,
  "TotalHoursRaw" NUMERIC NOT NULL DEFAULT 0,
  "TotalHoursNormal" NUMERIC NOT NULL DEFAULT 0,
  "TotalHoursOt" NUMERIC NOT NULL DEFAULT 0,
  "TotalHoursNight" NUMERIC NOT NULL DEFAULT 0,
  "TotalHoursHoliday" NUMERIC NOT NULL DEFAULT 0,
  "EnteredBy" TEXT NOT NULL,
  "SubmittedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "RejectReason" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmTimesheetHeader" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmTsHeader" ON "HrmTimesheetHeader" ("ProjectId", "CrewId", "WorkDate", "Shift");
CREATE INDEX "IX_HrmTsHeader_Status" ON "HrmTimesheetHeader" ("ProjectId", "WorkDate", "Status");


-- HrmTimesheetEntry · d10 · ردیف شارژ کارکرد
CREATE TABLE IF NOT EXISTS "HrmTimesheetEntry" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "HeaderId" TEXT NOT NULL,
  "PersonId" TEXT NOT NULL,
  "WorkDate" TEXT NOT NULL,
  "TradeCode" TEXT NOT NULL,
  "Grade" TEXT NULL,
  "ActivityId" TEXT NOT NULL,
  "WbsId" TEXT NULL,
  "CbsId" TEXT NOT NULL,
  "HoursRaw" NUMERIC NOT NULL,
  "HoursNormal" NUMERIC NOT NULL DEFAULT 0,
  "HoursOt" NUMERIC NOT NULL DEFAULT 0,
  "HoursNight" NUMERIC NOT NULL DEFAULT 0,
  "HoursHoliday" NUMERIC NOT NULL DEFAULT 0,
  "AttendanceCode" TEXT NOT NULL DEFAULT 'present',
  "IsProductive" INTEGER NOT NULL DEFAULT 1,
  "QtyDone" NUMERIC NULL,
  "QtyUom" TEXT NULL,
  "RateLineId" TEXT NULL,
  "RcaReasonId" TEXT NULL,
  "Note" TEXT NULL,
  "VoidedAt" TEXT NULL,
  "VoidedBy" TEXT NULL,
  "VoidReason" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmTimesheetEntry" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_HrmTsEntry_Header" ON "HrmTimesheetEntry" ("HeaderId");
CREATE INDEX "IX_HrmTsEntry_Person" ON "HrmTimesheetEntry" ("PersonId", "WorkDate");
CREATE INDEX "IX_HrmTsEntry_Act" ON "HrmTimesheetEntry" ("ProjectId", "WorkDate", "ActivityId");
CREATE INDEX "IX_HrmTsEntry_Cbs" ON "HrmTimesheetEntry" ("CbsId", "WorkDate");


-- HrmPeriodLock · d10 · قفل دورهٔ کارکرد
CREATE TABLE IF NOT EXISTS "HrmPeriodLock" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "LockedBy" TEXT NOT NULL,
  "LockedAt" TEXT NOT NULL,
  "ReasonFa" TEXT NULL,
  "UnlockedBy" TEXT NULL,
  "UnlockedAt" TEXT NULL,
  "UnlockReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmPeriodLock" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmPeriodLock" ON "HrmPeriodLock" ("ProjectId", "PeriodCode");


-- HrmSyncConflict · d10 · تعارض همگام‌سازی آفلاین
CREATE TABLE IF NOT EXISTS "HrmSyncConflict" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "EntityType" TEXT NOT NULL,
  "EntityId" TEXT NOT NULL,
  "DeviceId" TEXT NULL,
  "LocalRevision" INTEGER NOT NULL DEFAULT 0,
  "ServerRevision" INTEGER NOT NULL DEFAULT 0,
  "LocalPayload" TEXT NULL,
  "ServerPayload" TEXT NULL,
  "DetectedAt" TEXT NOT NULL,
  "Resolution" TEXT NOT NULL DEFAULT 'manual',
  "ResolvedBy" TEXT NULL,
  "ResolvedAt" TEXT NULL,
  "DiffSummaryFa" TEXT NULL,
  "RequiresAdjustment" INTEGER NOT NULL DEFAULT 0,
  "BlockReasonFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'open',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmSyncConflict" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_HrmSyncConflict" ON "HrmSyncConflict" ("ProjectId", "Status", "DetectedAt");
CREATE INDEX "IX_HrmSyncConflict_Entity" ON "HrmSyncConflict" ("EntityType", "EntityId");


-- HrmAdjustment · d10 · سند اصلاحی کارکرد
CREATE TABLE IF NOT EXISTS "HrmAdjustment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "OriginalEntryId" TEXT NOT NULL,
  "AdjustmentType" TEXT NOT NULL,
  "DeltaHours" NUMERIC NOT NULL DEFAULT 0,
  "NewActivityId" TEXT NULL,
  "NewCbsId" TEXT NULL,
  "ReasonCode" TEXT NULL,
  "ReasonTextFa" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "PostedToFin" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmAdjustment" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_HrmAdjustment_Entry" ON "HrmAdjustment" ("OriginalEntryId");
CREATE INDEX "IX_HrmAdjustment_Period" ON "HrmAdjustment" ("ProjectId", "PeriodCode", "Status");


-- HrmProductivityLog · d10 · سیاههٔ بهره‌وری
CREATE TABLE IF NOT EXISTS "HrmProductivityLog" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ActivityId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "TradeCode" TEXT NULL,
  "CbsId" TEXT NULL,
  "BudgetMh" NUMERIC NOT NULL DEFAULT 0,
  "EarnedMh" NUMERIC NOT NULL DEFAULT 0,
  "ActualMh" NUMERIC NOT NULL DEFAULT 0,
  "ApprovedProgressPct" NUMERIC NOT NULL DEFAULT 0,
  "Pi" NUMERIC NOT NULL DEFAULT 0,
  "Pf" NUMERIC NOT NULL DEFAULT 0,
  "QtyDone" NUMERIC NULL,
  "QtyUom" TEXT NULL,
  "UnitRate" NUMERIC NULL,
  "StdRate" NUMERIC NULL,
  "VariancePct" NUMERIC NULL,
  "Trend" TEXT NOT NULL DEFAULT 'stable',
  "Status" TEXT NOT NULL DEFAULT 'green',
  "LostMh" NUMERIC NOT NULL DEFAULT 0,
  "IsCalibrated" INTEGER NOT NULL DEFAULT 0,
  "ComputedAt" TEXT NOT NULL,
  "InputHash" TEXT NOT NULL,
  "IsFinal" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmProductivityLog" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmProdLog" ON "HrmProductivityLog" ("ProjectId", "ActivityId", "PeriodCode");
CREATE INDEX "IX_HrmProdLog_Period" ON "HrmProductivityLog" ("ProjectId", "PeriodCode", "Status");
CREATE INDEX "IX_HrmProdLog_Trade" ON "HrmProductivityLog" ("ProjectId", "TradeCode", "PeriodCode");


-- HrmRcaReason · d10 · علت افت بهره‌وری
CREATE TABLE IF NOT EXISTS "HrmRcaReason" (
  "Id" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "IsClaimable" INTEGER NOT NULL DEFAULT 0,
  "DefaultOwnerDomain" TEXT NOT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmRcaReason" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmRcaReason_Code" ON "HrmRcaReason" ("Code");


-- HrmRcaEntry · d10 · ثبت علت افت
CREATE TABLE IF NOT EXISTS "HrmRcaEntry" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ActivityId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "ReasonCode" TEXT NOT NULL,
  "SharePct" NUMERIC NOT NULL DEFAULT 100,
  "LostMh" NUMERIC NOT NULL DEFAULT 0,
  "EstimatedCost" NUMERIC NULL,
  "NoteFa" TEXT NOT NULL,
  "RaisedBy" TEXT NOT NULL,
  "RaisedAt" TEXT NOT NULL,
  "ClaimRef" TEXT NULL,
  "ClaimedAt" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'open',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmRcaEntry" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_HrmRcaEntry_Act" ON "HrmRcaEntry" ("ProjectId", "ActivityId", "PeriodCode");
CREATE INDEX "IX_HrmRcaEntry_Reason" ON "HrmRcaEntry" ("ProjectId", "ReasonCode", "Status");


-- HrmMetricSnapshot · d10 · عکس متریک بهره‌وری
CREATE TABLE IF NOT EXISTS "HrmMetricSnapshot" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "MetricCode" TEXT NOT NULL,
  "Dimension" TEXT NOT NULL DEFAULT 'project',
  "DimensionId" TEXT NULL,
  "Value" NUMERIC NOT NULL DEFAULT 0,
  "Target" NUMERIC NULL,
  "Status" TEXT NOT NULL DEFAULT 'green',
  "ComputedAt" TEXT NOT NULL,
  "InputHash" TEXT NOT NULL,
  "IsFinal" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmMetricSnapshot" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmMetricSnap" ON "HrmMetricSnapshot" ("ProjectId", "PeriodCode", "MetricCode", "Dimension", "DimensionId");
CREATE INDEX "IX_HrmMetricSnap_Period" ON "HrmMetricSnapshot" ("ProjectId", "PeriodCode", "Status");


-- HrmCrew · d10 · اکیپ کاری
CREATE TABLE IF NOT EXISTS "HrmCrew" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "ObsNodeId" TEXT NULL,
  "ForemanPersonId" TEXT NULL,
  "PrimaryTradeCode" TEXT NOT NULL,
  "TargetMix" TEXT NULL,
  "TargetSize" INTEGER NOT NULL DEFAULT 0,
  "DefaultCbsId" TEXT NULL,
  "ShiftCode" TEXT NULL DEFAULT 'day',
  "IsSubcontracted" INTEGER NOT NULL DEFAULT 0,
  "SubContractId" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'forming',
  "DisbandedAt" TEXT NULL,
  "DisbandReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmCrew" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmCrew_Code" ON "HrmCrew" ("ProjectId", "Code");
CREATE INDEX "IX_HrmCrew_Status" ON "HrmCrew" ("ProjectId", "Status", "PrimaryTradeCode");


-- HrmCrewMember · d10 · عضویت در اکیپ
CREATE TABLE IF NOT EXISTS "HrmCrewMember" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CrewId" TEXT NOT NULL,
  "PersonId" TEXT NOT NULL,
  "RoleInCrew" TEXT NOT NULL DEFAULT 'skilled',
  "TradeCode" TEXT NOT NULL,
  "Grade" TEXT NULL,
  "FromDate" TEXT NOT NULL,
  "ToDate" TEXT NULL,
  "AllocationPct" NUMERIC NOT NULL DEFAULT 100,
  "ExitReasonFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmCrewMember" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_HrmCrewMember_Crew" ON "HrmCrewMember" ("CrewId", "Status");
CREATE INDEX "IX_HrmCrewMember_Person" ON "HrmCrewMember" ("ProjectId", "PersonId", "FromDate");


-- HrmSubContract · d10 · قرارداد نیروی پیمانکاری
CREATE TABLE IF NOT EXISTS "HrmSubContract" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractNo" TEXT NOT NULL,
  "ContractorName" TEXT NOT NULL,
  "ScopeTrades" TEXT NULL,
  "PricingModel" TEXT NOT NULL DEFAULT 'hourly',
  "AgreedRates" TEXT NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "StartDate" TEXT NOT NULL,
  "EndDate" TEXT NOT NULL,
  "RetentionPct" NUMERIC NOT NULL DEFAULT 0,
  "PenaltyTermsFa" TEXT NULL,
  "FinVendorId" TEXT NULL,
  "CntContractId" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmSubContract" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmSubContract_No" ON "HrmSubContract" ("ProjectId", "ContractNo");
CREATE INDEX "IX_HrmSubContract_Status" ON "HrmSubContract" ("ProjectId", "Status", "EndDate");


-- HrmSubAttendance · d10 · حضور نیروی پیمانکاری
CREATE TABLE IF NOT EXISTS "HrmSubAttendance" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SubContractId" TEXT NOT NULL,
  "WorkDate" TEXT NOT NULL,
  "TradeCode" TEXT NOT NULL,
  "Headcount" INTEGER NOT NULL DEFAULT 0,
  "HoursPerPerson" NUMERIC NOT NULL DEFAULT 0,
  "TotalHours" NUMERIC NOT NULL DEFAULT 0,
  "ActivityId" TEXT NOT NULL,
  "CbsId" TEXT NOT NULL,
  "CrewId" TEXT NULL,
  "GatePassRef" TEXT NULL,
  "VerifiedBy" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "InvoicePeriod" TEXT NULL,
  "SubIpcId" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "RejectReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmSubAttendance" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmSubAtt" ON "HrmSubAttendance" ("SubContractId", "WorkDate", "TradeCode", "ActivityId");
CREATE INDEX "IX_HrmSubAtt_Period" ON "HrmSubAttendance" ("ProjectId", "InvoicePeriod", "Status");


-- HrmSubIpc · d10 · صورت‌کارکرد نیروی پیمانکاری
CREATE TABLE IF NOT EXISTS "HrmSubIpc" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SubContractId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "SerialNo" INTEGER NOT NULL DEFAULT 1,
  "TotalHours" NUMERIC NOT NULL DEFAULT 0,
  "GrossAmount" NUMERIC NOT NULL DEFAULT 0,
  "RetentionAmount" NUMERIC NOT NULL DEFAULT 0,
  "DeductionAmount" NUMERIC NOT NULL DEFAULT 0,
  "NetAmount" NUMERIC NOT NULL DEFAULT 0,
  "UnpricedHours" NUMERIC NOT NULL DEFAULT 0,
  "DeductionNoteFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "PreparedBy" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "FinPostingRef" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmSubIpc" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmSubIpc" ON "HrmSubIpc" ("SubContractId", "PeriodCode");
CREATE INDEX "IX_HrmSubIpc_Status" ON "HrmSubIpc" ("ProjectId", "Status", "PeriodCode");


-- HrmPerson · d10 · پروندهٔ پرسنلی
CREATE TABLE IF NOT EXISTS "HrmPerson" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "FullNameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "NationalId" TEXT NULL,
  "Mobile" TEXT NULL,
  "EmergencyContact" TEXT NULL,
  "EmploymentType" TEXT NOT NULL DEFAULT 'permanent',
  "EmployerSubContractId" TEXT NULL,
  "PrimaryTradeCode" TEXT NOT NULL,
  "Grade" TEXT NULL,
  "HireDate" TEXT NULL,
  "TerminationDate" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'candidate',
  "HseClearance" TEXT NOT NULL DEFAULT 'none',
  "HseCheckedAt" TEXT NULL,
  "GatePassRef" TEXT NULL,
  "PhotoRef" TEXT NULL,
  "SignatureRef" TEXT NULL,
  "ActivatedAt" TEXT NULL,
  "DemobilizedAt" TEXT NULL,
  "ExitReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmPerson" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmPerson_No" ON "HrmPerson" ("ProjectId", "PersonnelNo");
CREATE INDEX "IX_HrmPerson_Status" ON "HrmPerson" ("ProjectId", "Status", "PrimaryTradeCode");


-- HrmPersonDoc · d10 · مدرک پرسنلی
CREATE TABLE IF NOT EXISTS "HrmPersonDoc" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PersonId" TEXT NOT NULL,
  "DocType" TEXT NOT NULL,
  "DocNo" TEXT NULL,
  "IssuedAt" TEXT NULL,
  "ExpiresAt" TEXT NULL,
  "FileRef" TEXT NULL,
  "IsBlocking" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'valid',
  "VerifiedBy" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmPersonDoc" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmPersonDoc" ON "HrmPersonDoc" ("PersonId", "DocType", "DocNo");
CREATE INDEX "IX_HrmPersonDoc_Exp" ON "HrmPersonDoc" ("ProjectId", "ExpiresAt", "IsBlocking");


-- HrmSkill · d10 · مهارت و صلاحیت
CREATE TABLE IF NOT EXISTS "HrmSkill" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PersonId" TEXT NOT NULL,
  "SkillCode" TEXT NOT NULL,
  "SkillNameFa" TEXT NULL,
  "Level" INTEGER NOT NULL DEFAULT 0,
  "CertifiedAt" TEXT NULL,
  "ExpiresAt" TEXT NULL,
  "EvidenceRef" TEXT NULL,
  "VerifiedBy" TEXT NULL,
  "IsBlocking" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'valid',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmSkill" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmSkill" ON "HrmSkill" ("PersonId", "SkillCode");
CREATE INDEX "IX_HrmSkill_Exp" ON "HrmSkill" ("ProjectId", "ExpiresAt", "IsBlocking");


-- HrmMobRequest · d10 · درخواست تجهیز نیرو
CREATE TABLE IF NOT EXISTS "HrmMobRequest" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RequestNo" TEXT NOT NULL,
  "RequestType" TEXT NOT NULL DEFAULT 'mobilize',
  "TradeCode" TEXT NOT NULL,
  "Qty" INTEGER NOT NULL DEFAULT 1,
  "NeedByDate" TEXT NOT NULL,
  "ObsNodeId" TEXT NULL,
  "CrewId" TEXT NULL,
  "PlanLineRef" TEXT NULL,
  "JustificationFa" TEXT NOT NULL,
  "FulfilledQty" INTEGER NOT NULL DEFAULT 0,
  "FulfilledAt" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "SubmittedBy" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "RejectReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmMobRequest" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmMobReq_No" ON "HrmMobRequest" ("ProjectId", "RequestNo");
CREATE INDEX "IX_HrmMobReq_Status" ON "HrmMobRequest" ("ProjectId", "Status", "NeedByDate");


-- HrmDemobCheck · d10 · چک‌لیست تخلیهٔ نیرو
CREATE TABLE IF NOT EXISTS "HrmDemobCheck" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PersonId" TEXT NOT NULL,
  "ItemCode" TEXT NOT NULL,
  "IsDone" INTEGER NOT NULL DEFAULT 0,
  "DoneBy" TEXT NULL,
  "DoneAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "IsMandatory" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmDemobCheck" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmDemobCheck" ON "HrmDemobCheck" ("PersonId", "ItemCode");


-- HrmManpowerPlan · d10 · برنامهٔ مبنای نیرو
CREATE TABLE IF NOT EXISTS "HrmManpowerPlan" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "Revision" TEXT NOT NULL DEFAULT 'baseline',
  "TradeCode" TEXT NULL,
  "ObsNodeId" TEXT NULL,
  "PlannedMh" NUMERIC NOT NULL DEFAULT 0,
  "PlannedHeadcount" INTEGER NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmManpowerPlan" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmManpowerPlan" ON "HrmManpowerPlan" ("ProjectId", "PeriodCode", "Revision", "TradeCode");
CREATE INDEX "IX_HrmManpowerPlan_Period" ON "HrmManpowerPlan" ("ProjectId", "PeriodCode");


-- HrmSyncBatch · d10 · دستهٔ همگام‌سازی میدانی
CREATE TABLE IF NOT EXISTS "HrmSyncBatch" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DeviceId" TEXT NOT NULL,
  "Fingerprint" TEXT NOT NULL,
  "ItemCount" INTEGER NOT NULL DEFAULT 0,
  "ReceivedAt" TEXT NOT NULL,
  "ReceivedBy" TEXT NOT NULL,
  "AppVersion" TEXT NULL,
  "ResultJson" TEXT NULL,
  "AppliedCount" INTEGER NOT NULL DEFAULT 0,
  "ConflictCount" INTEGER NOT NULL DEFAULT 0,
  "ReplayCount" INTEGER NOT NULL DEFAULT 0,
  "LastReplayAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmSyncBatch" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmSyncBatch" ON "HrmSyncBatch" ("ProjectId", "DeviceId", "Fingerprint");
CREATE INDEX "IX_HrmSyncBatch_Device" ON "HrmSyncBatch" ("ProjectId", "DeviceId", "ReceivedAt");


-- HrmRateCard · d10 · کارت نرخ ساعتی رسته
CREATE TABLE IF NOT EXISTS "HrmRateCard" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "TradeCode" TEXT NOT NULL,
  "Grade" TEXT NULL,
  "HourlyRate" NUMERIC NOT NULL DEFAULT 0,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "EffectiveFrom" TEXT NOT NULL,
  "EffectiveTo" TEXT NULL,
  "SourceFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmRateCard" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_HrmRateCard" ON "HrmRateCard" ("ProjectId", "TradeCode", "EffectiveFrom");
CREATE UNIQUE INDEX "UX_HrmRateCard" ON "HrmRateCard" ("ProjectId", "TradeCode", "Grade", "EffectiveFrom");


-- HrmCostPosting · d10 · ارسال هزینهٔ نیرو به مالی
CREATE TABLE IF NOT EXISTS "HrmCostPosting" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CostAccountId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "Amount" NUMERIC NOT NULL DEFAULT 0,
  "EquivalentHours" NUMERIC NOT NULL DEFAULT 0,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "UnpricedHours" NUMERIC NOT NULL DEFAULT 0,
  "MemoFa" TEXT NULL,
  "PostedAt" TEXT NOT NULL,
  "PostedBy" TEXT NOT NULL,
  "EventKey" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmCostPosting" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmCostPosting" ON "HrmCostPosting" ("ProjectId", "CostAccountId", "PeriodCode");
CREATE INDEX "IX_HrmCostPosting_Period" ON "HrmCostPosting" ("ProjectId", "PeriodCode", "PostedAt");


-- IntegrationEvent · core · رویداد یکپارچه‌سازی
CREATE TABLE IF NOT EXISTS "IntegrationEvent" (
  "Id" TEXT NOT NULL,
  "EventKey" TEXT NOT NULL,
  "EventType" TEXT NOT NULL,
  "SchemaVersion" TEXT NOT NULL DEFAULT '1.0',
  "SourceModule" TEXT NOT NULL,
  "TargetModule" TEXT NULL,
  "ProjectId" TEXT NOT NULL,
  "EntityName" TEXT NULL,
  "EntityId" TEXT NULL,
  "PayloadJson" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'pending',
  "OccurredAt" TEXT NOT NULL,
  "DeliveredAt" TEXT NULL,
  "AttemptCount" INTEGER NOT NULL DEFAULT 0,
  "LastErrorFa" TEXT NULL,
  "AckRef" TEXT NULL,
  "EmittedBy" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IntegrationEvent" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_IntegrationEvent" ON "IntegrationEvent" ("EventKey");
CREATE INDEX "IX_IntegrationEvent_Queue" ON "IntegrationEvent" ("Status", "OccurredAt");
CREATE INDEX "IX_IntegrationEvent_Project" ON "IntegrationEvent" ("ProjectId", "EventType", "OccurredAt");


-- Correspondence · d11 · مکاتبه
CREATE TABLE IF NOT EXISTS "Correspondence" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "LetterNo" TEXT NOT NULL,
  "Direction" TEXT NOT NULL,
  "Kind" TEXT NOT NULL,
  "SubjectFa" TEXT NOT NULL,
  "IssuedAt" TEXT NOT NULL,
  "DueAt" TEXT NULL,
  "Status" TEXT NOT NULL,
  "Classification" TEXT NULL,
  "RefLetterNo" TEXT NULL,
  "TimeBarred" INTEGER NOT NULL DEFAULT 0,
  "FromParty" TEXT NULL,
  "ToParty" TEXT NULL,
  "ReceivedAt" TEXT NULL,
  "ResponseDays" INTEGER NULL,
  "RespondedAt" TEXT NULL,
  "ResponseRef" TEXT NULL,
  "Links" TEXT NULL,
  "OwnerRole" TEXT NULL,
  "Attachments" INTEGER NULL,
  "DraftedBy" TEXT NULL,
  "SignedBy" TEXT NULL,
  "SignedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Correspondence" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_Correspondence_LetterNo" ON "Correspondence" ("ProjectId", "LetterNo");
CREATE INDEX "IX_Correspondence_Due" ON "Correspondence" ("ProjectId", "DueAt", "Status");


-- MeetingMinute · d11 · صورت‌جلسه
CREATE TABLE IF NOT EXISTS "MeetingMinute" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "HeldAt" TEXT NOT NULL,
  "Attendees" TEXT NULL,
  "Decisions" TEXT NULL,
  "Actions" TEXT NULL,
  "MeetingType" TEXT NULL,
  "Chair" TEXT NULL,
  "Invited" TEXT NULL,
  "MinutesApproved" INTEGER NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "DistributedAt" TEXT NULL,
  "DistributedTo" TEXT NULL,
  "RecordedBy" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MeetingMinute" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_MeetingMinute_Code" ON "MeetingMinute" ("ProjectId", "Code");


-- LessonLearned · d11 · درس آموخته
CREATE TABLE IF NOT EXISTS "LessonLearned" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "Impact" TEXT NOT NULL,
  "Validated" INTEGER NOT NULL DEFAULT 0,
  "ReuseCount" INTEGER NOT NULL DEFAULT 0,
  "Value" INTEGER NULL,
  "SourceRef" TEXT NULL,
  "SituationFa" TEXT NULL,
  "RecommendationFa" TEXT NULL,
  "CapturedAt" TEXT NULL,
  "CapturedBy" TEXT NULL,
  "Tags" TEXT NULL,
  "ValidatedBy" TEXT NULL,
  "ValidatedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_LessonLearned" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_LessonLearned_Code" ON "LessonLearned" ("ProjectId", "Code");


-- MeetingAction · d11 · مصوبهٔ جلسه
CREATE TABLE IF NOT EXISTS "MeetingAction" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "MeetingCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "OwnerRole" TEXT NOT NULL,
  "DueDate" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "ClosedAt" TEXT NULL,
  "Links" TEXT NULL,
  "CancelReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MeetingAction" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_MeetingAction_Code" ON "MeetingAction" ("ProjectId", "Code");
CREATE INDEX "IX_MeetingAction_Meeting" ON "MeetingAction" ("ProjectId", "MeetingCode");
CREATE INDEX "IX_MeetingAction_Due" ON "MeetingAction" ("ProjectId", "DueDate", "Status");


-- Stakeholder · d11 · ذی‌نفع
CREATE TABLE IF NOT EXISTS "Stakeholder" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Org" TEXT NULL,
  "RoleFa" TEXT NULL,
  "Power" INTEGER NOT NULL,
  "Interest" INTEGER NOT NULL,
  "CurrentLevel" TEXT NOT NULL,
  "DesiredLevel" TEXT NOT NULL,
  "Channels" TEXT NULL,
  "Frequency" TEXT NULL,
  "OwnerRole" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Stakeholder" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_Stakeholder_Code" ON "Stakeholder" ("ProjectId", "Code");


-- LessonReuse · d11 · استفادهٔ مجدد از درس‌آموخته
CREATE TABLE IF NOT EXISTS "LessonReuse" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "LessonCode" TEXT NOT NULL,
  "UsedBy" TEXT NOT NULL,
  "UsedAt" TEXT NOT NULL,
  "NoteFa" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_LessonReuse" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_LessonReuse" ON "LessonReuse" ("ProjectId", "LessonCode", "UsedBy");


-- NotificationRule · d11 · قاعدهٔ اطلاع‌رسانی و تشدید
CREATE TABLE IF NOT EXISTS "NotificationRule" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "EventCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Channels" TEXT NULL,
  "AudienceRoles" TEXT NULL,
  "EscalateAfterHours" INTEGER NOT NULL,
  "EscalateToRole" TEXT NULL,
  "Active" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_NotificationRule" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_NotificationRule_Code" ON "NotificationRule" ("ProjectId", "Code");


-- Equipment · d9 · ماشین‌آلات و تجهیزات
CREATE TABLE IF NOT EXISTS "Equipment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "Ownership" TEXT NOT NULL,
  "BrandFa" TEXT NULL,
  "Model" TEXT NULL,
  "Year" INTEGER NULL,
  "Capacity" NUMERIC NULL,
  "CapacityUom" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "CommissionedAt" TEXT NULL,
  "LocationFa" TEXT NULL,
  "PurchaseValue" NUMERIC NULL,
  "SalvageValue" NUMERIC NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_Equipment" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_Equipment_Code" ON "Equipment" ("ProjectId", "Code");
CREATE INDEX "IX_Equipment_Status" ON "Equipment" ("ProjectId", "Status", "Category");


-- EquipmentMeter · d9 · ساعت کارکرد
CREATE TABLE IF NOT EXISTS "EquipmentMeter" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "EquipmentId" TEXT NOT NULL,
  "ReadAt" TEXT NOT NULL,
  "HourMeter" NUMERIC NOT NULL DEFAULT 0,
  "WorkHours" NUMERIC NOT NULL DEFAULT 0,
  "Source" TEXT NOT NULL DEFAULT 'manual',
  "EnteredBy" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EquipmentMeter" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EquipmentMeter" ON "EquipmentMeter" ("EquipmentId", "ReadAt");
CREATE INDEX "IX_EquipmentMeter_Equip" ON "EquipmentMeter" ("EquipmentId");


-- EquipmentRental · d9 · اجاره ماشین‌آلات
CREATE TABLE IF NOT EXISTS "EquipmentRental" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "EquipmentId" TEXT NOT NULL,
  "Supplier" TEXT NULL,
  "ContractNo" TEXT NULL,
  "RateType" TEXT NOT NULL,
  "Rate" NUMERIC NOT NULL,
  "Currency" TEXT NULL DEFAULT 'IRR',
  "StartDate" TEXT NOT NULL,
  "EndDate" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EquipmentRental" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EquipmentRental_Contract" ON "EquipmentRental" ("ProjectId", "ContractNo");
CREATE INDEX "IX_EquipmentRental_Equip" ON "EquipmentRental" ("EquipmentId", "Status");


-- MaintenanceOrder · d9 · دستورکار تعمیرات
CREATE TABLE IF NOT EXISTS "MaintenanceOrder" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "EquipmentId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "Kind" TEXT NOT NULL,
  "Priority" TEXT NOT NULL,
  "ReportedAt" TEXT NOT NULL,
  "DownFrom" TEXT NULL,
  "DownTo" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'open',
  "Cost" NUMERIC NULL DEFAULT 0,
  "DescriptionFa" TEXT NULL,
  "AssignedTo" TEXT NULL,
  "RootCause" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MaintenanceOrder" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_MaintenanceOrder_Code" ON "MaintenanceOrder" ("ProjectId", "Code");
CREATE INDEX "IX_MaintenanceOrder_Open" ON "MaintenanceOrder" ("ProjectId", "Status", "Priority");


-- EquipmentDispatch · d9 · دیسپچ روزانه ماشین‌آلات
CREATE TABLE IF NOT EXISTS "EquipmentDispatch" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "EquipmentId" TEXT NOT NULL,
  "DispatchDate" TEXT NOT NULL,
  "Shift" TEXT NOT NULL DEFAULT 'day',
  "OperatorId" TEXT NULL,
  "ActivityId" TEXT NULL,
  "CostAccountId" TEXT NULL,
  "SiteFa" TEXT NULL,
  "PlannedHours" NUMERIC NOT NULL DEFAULT 8,
  "PlannedQty" NUMERIC NULL,
  "QtyUom" TEXT NULL,
  "SafetyCheck" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "ApprovedBy" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EquipmentDispatch" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EquipmentDispatch" ON "EquipmentDispatch" ("EquipmentId", "DispatchDate", "Shift");
CREATE INDEX "IX_EquipmentDispatch_Day" ON "EquipmentDispatch" ("ProjectId", "DispatchDate", "Status");


-- EquipmentFuelLog · d9 · مصرف سوخت و مواد مصرفی
CREATE TABLE IF NOT EXISTS "EquipmentFuelLog" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "EquipmentId" TEXT NOT NULL,
  "LogDate" TEXT NOT NULL,
  "Kind" TEXT NOT NULL DEFAULT 'diesel',
  "Quantity" NUMERIC NOT NULL,
  "Uom" TEXT NULL,
  "UnitCost" NUMERIC NULL,
  "HourMeter" NUMERIC NULL,
  "IssuedBy" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EquipmentFuelLog" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_EquipmentFuelLog_Equip" ON "EquipmentFuelLog" ("EquipmentId", "LogDate");
CREATE INDEX "IX_EquipmentFuelLog_Kind" ON "EquipmentFuelLog" ("ProjectId", "Kind", "LogDate");


-- PmSchedule · d9 · برنامه نگهداری پیشگیرانه
CREATE TABLE IF NOT EXISTS "PmSchedule" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "EquipmentId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Basis" TEXT NOT NULL DEFAULT 'run_hours',
  "IntervalValue" NUMERIC NOT NULL,
  "LastDoneAt" TEXT NULL,
  "LastDoneReading" NUMERIC NULL,
  "ChecklistFa" TEXT NULL,
  "Active" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmSchedule" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmSchedule_Code" ON "PmSchedule" ("ProjectId", "Code");
CREATE INDEX "IX_PmSchedule_Equip" ON "PmSchedule" ("EquipmentId", "Active");


-- SparePart · d9 · قطعات یدکی
CREATE TABLE IF NOT EXISTS "SparePart" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PartNo" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Uom" TEXT NULL,
  "OnHand" NUMERIC NOT NULL DEFAULT 0,
  "MinLevel" NUMERIC NOT NULL DEFAULT 0,
  "LeadTimeDays" INTEGER NULL,
  "AvgDailyUsage" NUMERIC NULL,
  "UnitCost" NUMERIC NULL,
  "Critical" INTEGER NOT NULL DEFAULT 0,
  "EquipmentCategory" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SparePart" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_SparePart_No" ON "SparePart" ("ProjectId", "PartNo");
CREATE INDEX "IX_SparePart_Critical" ON "SparePart" ("ProjectId", "Critical");


-- EquipmentCostPosting · d9 · ثبت هزینه ماشین‌آلات
CREATE TABLE IF NOT EXISTS "EquipmentCostPosting" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CostAccountId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "Amount" NUMERIC NOT NULL DEFAULT 0,
  "RentalCost" NUMERIC NULL DEFAULT 0,
  "MaintenanceCost" NUMERIC NULL DEFAULT 0,
  "FuelCost" NUMERIC NULL DEFAULT 0,
  "WorkHours" NUMERIC NULL DEFAULT 0,
  "MemoFa" TEXT NULL,
  "PostedAt" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EquipmentCostPosting" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EquipmentCostPosting" ON "EquipmentCostPosting" ("CostAccountId", "PeriodCode");


-- PartTransaction · d9 · تراکنش قطعات یدکی
CREATE TABLE IF NOT EXISTS "PartTransaction" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "TxnDate" TEXT NOT NULL,
  "Direction" TEXT NOT NULL DEFAULT 'issue',
  "Quantity" NUMERIC NOT NULL,
  "WorkOrderId" TEXT NULL,
  "EquipmentId" TEXT NULL,
  "UnitCost" NUMERIC NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PartTransaction" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_PartTransaction_Part" ON "PartTransaction" ("PartId", "TxnDate");
CREATE INDEX "IX_PartTransaction_Wo" ON "PartTransaction" ("WorkOrderId");


-- ReportIssue · core · صدور گزارش
CREATE TABLE IF NOT EXISTS "ReportIssue" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ReportCode" TEXT NOT NULL,
  "DocNo" TEXT NOT NULL,
  "Revision" TEXT NOT NULL,
  "Audience" TEXT NOT NULL,
  "IssuedAt" TEXT NOT NULL,
  "IssuedBy" TEXT NOT NULL,
  "Distribution" TEXT NULL,
  "Format" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ReportIssue" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ReportIssue" ON "ReportIssue" ("DocNo", "Revision");


-- MdrDeliverable · d12 · قلم فهرست مدارک مهندسی
CREATE TABLE IF NOT EXISTS "MdrDeliverable" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "TitleEn" TEXT NULL,
  "Discipline" TEXT NOT NULL,
  "DocType" TEXT NOT NULL,
  "PlannedWeight" NUMERIC NOT NULL,
  "EstimatedManhours" NUMERIC NULL,
  "WbsId" TEXT NULL,
  "DocumentId" TEXT NULL,
  "TargetIfaDate" TEXT NULL,
  "TargetIfcDate" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CriticalityLevel" TEXT NULL,
  "ContractReviewDays" INTEGER NULL,
  "RemarksFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MdrDeliverable" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_MdrDeliverable" ON "MdrDeliverable" ("ProjectId", "DocNo");
CREATE INDEX "IX_MdrDeliverable_Discipline" ON "MdrDeliverable" ("ProjectId", "Discipline");
CREATE INDEX "IX_MdrDeliverable_Status" ON "MdrDeliverable" ("ProjectId", "Status");


-- EngineeringRevision · d12 · ریویژن مدرک مهندسی
CREATE TABLE IF NOT EXISTS "EngineeringRevision" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DeliverableId" TEXT NOT NULL,
  "RevCode" TEXT NOT NULL,
  "Purpose" TEXT NOT NULL,
  "IssuedAt" TEXT NOT NULL,
  "IssuedBy" TEXT NULL,
  "TransmittalId" TEXT NULL,
  "ReviewDueAt" TEXT NULL,
  "ReviewCode" TEXT NULL,
  "ReviewedBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "ReviewAgingDays" INTEGER NULL,
  "Status" TEXT NOT NULL,
  "IdcCompletedAt" TEXT NULL,
  "DocumentId" TEXT NULL,
  "RemarksFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EngineeringRevision" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_EngineeringRevision_DeliverableId" FOREIGN KEY ("DeliverableId") REFERENCES "MdrDeliverable" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_EngineeringRevision" ON "EngineeringRevision" ("DeliverableId", "RevCode");
CREATE INDEX "IX_EngineeringRevision_Project" ON "EngineeringRevision" ("ProjectId", "Status");
CREATE INDEX "IX_EngineeringRevision_Due" ON "EngineeringRevision" ("ProjectId", "ReviewDueAt");


-- CrsComment · d12 · نظر و پاسخ شیت بررسی
CREATE TABLE IF NOT EXISTS "CrsComment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RevisionId" TEXT NOT NULL,
  "CommentNo" INTEGER NOT NULL,
  "RaisedBy" TEXT NOT NULL,
  "RaisedAt" TEXT NOT NULL,
  "Discipline" TEXT NULL,
  "SheetRef" TEXT NULL,
  "Severity" TEXT NOT NULL,
  "CommentText" TEXT NOT NULL,
  "ResponseText" TEXT NULL,
  "RespondedBy" TEXT NULL,
  "RespondedAt" TEXT NULL,
  "ResponseStatus" TEXT NOT NULL,
  "VerifiedBy" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "ClosedInRevCode" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CrsComment" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CrsComment_RevisionId" FOREIGN KEY ("RevisionId") REFERENCES "EngineeringRevision" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_CrsComment" ON "CrsComment" ("RevisionId", "CommentNo");
CREATE INDEX "IX_CrsComment_Status" ON "CrsComment" ("ProjectId", "ResponseStatus");


-- SquadCheck · d12 · بررسی بین‌دیسیپلینی
CREATE TABLE IF NOT EXISTS "SquadCheck" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RevisionId" TEXT NOT NULL,
  "Discipline" TEXT NOT NULL,
  "ReviewerId" TEXT NOT NULL,
  "RequestedAt" TEXT NOT NULL,
  "DueAt" TEXT NULL,
  "CompletedAt" TEXT NULL,
  "Status" TEXT NOT NULL,
  "FindingsCount" INTEGER NULL,
  "RemarksFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SquadCheck" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_SquadCheck_RevisionId" FOREIGN KEY ("RevisionId") REFERENCES "EngineeringRevision" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_SquadCheck" ON "SquadCheck" ("RevisionId", "Discipline");
CREATE INDEX "IX_SquadCheck_Status" ON "SquadCheck" ("ProjectId", "Status");


-- InterfaceClashLog · d12 · لاگ تداخل مدل سه‌بعدی
CREATE TABLE IF NOT EXISTS "InterfaceClashLog" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ClashNo" TEXT NOT NULL,
  "DetectedAt" TEXT NOT NULL,
  "SourceTool" TEXT NOT NULL,
  "DisciplineA" TEXT NOT NULL,
  "DisciplineB" TEXT NOT NULL,
  "ElementA" TEXT NULL,
  "ElementB" TEXT NULL,
  "Zone" TEXT NULL,
  "Severity" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "OwnerDiscipline" TEXT NULL,
  "ResolvedAt" TEXT NULL,
  "ResolutionFa" TEXT NULL,
  "ModelReviewStage" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_InterfaceClashLog" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_InterfaceClashLog" ON "InterfaceClashLog" ("ProjectId", "ClashNo");
CREATE INDEX "IX_InterfaceClashLog_Status" ON "InterfaceClashLog" ("ProjectId", "Status");


-- TechnicalQuery · d12 · استعلام و تغییر فنی کارگاهی
CREATE TABLE IF NOT EXISTS "TechnicalQuery" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "Kind" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Discipline" TEXT NOT NULL,
  "RaisedBy" TEXT NOT NULL,
  "RaisedAt" TEXT NOT NULL,
  "DeliverableId" TEXT NULL,
  "DueAt" TEXT NULL,
  "Status" TEXT NOT NULL,
  "AnsweredBy" TEXT NULL,
  "AnsweredAt" TEXT NULL,
  "AnswerText" TEXT NULL,
  "CostImpact" NUMERIC NULL,
  "TimeImpactDays" INTEGER NULL,
  "LinkedCrCode" TEXT NULL,
  "RedlineDocumentId" TEXT NULL,
  "AsBuiltStatus" TEXT NULL,
  "ParentTqId" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_TechnicalQuery" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_TechnicalQuery" ON "TechnicalQuery" ("ProjectId", "Code");
CREATE INDEX "IX_TechnicalQuery_Status" ON "TechnicalQuery" ("ProjectId", "Status");
CREATE INDEX "IX_TechnicalQuery_Kind" ON "TechnicalQuery" ("ProjectId", "Kind");


-- VendorPrintReview · d12 · بررسی مدرک فنی سازنده
CREATE TABLE IF NOT EXISTS "VendorPrintReview" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "VendorDocNo" TEXT NOT NULL,
  "VendorName" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "PoNo" TEXT NULL,
  "TagNo" TEXT NULL,
  "Discipline" TEXT NOT NULL,
  "RevCode" TEXT NOT NULL,
  "ReceivedAt" TEXT NOT NULL,
  "DueAt" TEXT NULL,
  "ReviewCode" TEXT NULL,
  "ReviewedBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "Status" TEXT NOT NULL,
  "DocumentId" TEXT NULL,
  "RemarksFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_VendorPrintReview" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_VendorPrintReview" ON "VendorPrintReview" ("ProjectId", "VendorDocNo", "RevCode");
CREATE INDEX "IX_VendorPrintReview_Po" ON "VendorPrintReview" ("ProjectId", "PoNo");
CREATE INDEX "IX_VendorPrintReview_Status" ON "VendorPrintReview" ("ProjectId", "Status");


-- MaterialRequest · d12 · درخواست کالای مهندسی
CREATE TABLE IF NOT EXISTS "MaterialRequest" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Discipline" TEXT NOT NULL,
  "DeliverableId" TEXT NULL,
  "DocNo" TEXT NULL,
  "ItemCode" TEXT NULL,
  "Quantity" NUMERIC NULL,
  "Unit" TEXT NULL,
  "LeadTimeDays" INTEGER NULL,
  "NeedByDate" TEXT NULL,
  "ReleaseByDate" TEXT NULL,
  "RaisedBy" TEXT NOT NULL,
  "RaisedAt" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "LinkedPrCode" TEXT NULL,
  "RemarksFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MaterialRequest" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_MaterialRequest" ON "MaterialRequest" ("ProjectId", "Code");
CREATE INDEX "IX_MaterialRequest_Deliverable" ON "MaterialRequest" ("ProjectId", "DeliverableId");


-- EngineeringProgressSnapshot · d12 · عکس دوره‌ای پیشرفت مهندسی
CREATE TABLE IF NOT EXISTS "EngineeringProgressSnapshot" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "Discipline" TEXT NULL,
  "PlannedPct" NUMERIC NOT NULL,
  "ActualPct" NUMERIC NOT NULL,
  "EarnedWeight" NUMERIC NULL,
  "SpiEng" NUMERIC NULL,
  "DeliverableCount" INTEGER NULL,
  "IfcIssuedCount" INTEGER NULL,
  "OpenCommentCount" INTEGER NULL,
  "SnapshotAt" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EngineeringProgressSnapshot" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EngineeringProgressSnapshot" ON "EngineeringProgressSnapshot" ("ProjectId", "PeriodCode", "Discipline");


-- ContractMaster · d14 · شناسنامه پیمان
CREATE TABLE IF NOT EXISTS "ContractMaster" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "ContractType" TEXT NOT NULL,
  "Party" TEXT NOT NULL,
  "EmployerName" TEXT NOT NULL,
  "ConsultantName" TEXT NULL,
  "ContractorName" TEXT NOT NULL,
  "SignDate" TEXT NOT NULL,
  "StartDate" TEXT NOT NULL,
  "DurationDays" INTEGER NOT NULL,
  "InitialAmount" NUMERIC NOT NULL,
  "CurrentAmount" NUMERIC NOT NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "CeilingPct" NUMERIC NOT NULL DEFAULT 25,
  "AdvancePct" NUMERIC NULL,
  "AdvanceRecoveryPct" NUMERIC NULL,
  "RetainagePct" NUMERIC NOT NULL DEFAULT 10,
  "InsuranceRatePct" NUMERIC NULL,
  "WithholdingTaxPct" NUMERIC NULL,
  "VatPct" NUMERIC NULL,
  "AdjustmentEnabled" INTEGER NOT NULL DEFAULT 0,
  "BaseIndexPeriod" TEXT NULL,
  "ReviewDaysConsultant" INTEGER NULL,
  "ReviewDaysEmployer" INTEGER NULL,
  "Status" TEXT NOT NULL,
  "CostAccountCode" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractMaster" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractMaster" ON "ContractMaster" ("ProjectId", "Code");
CREATE INDEX "IX_ContractMaster_Status" ON "ContractMaster" ("ProjectId", "Status");


-- VendorEvaluation · d14 · ارزیابی دوره‌ای طرف قرارداد
CREATE TABLE IF NOT EXISTS "VendorEvaluation" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SourceKind" TEXT NOT NULL,
  "SourceId" TEXT NOT NULL,
  "PartyName" TEXT NOT NULL,
  "SourceCode" TEXT NOT NULL,
  "PeriodDate" TEXT NOT NULL,
  "Scores" TEXT NOT NULL,
  "Weighted" INTEGER NOT NULL,
  "Grade" TEXT NOT NULL,
  "Weakest" TEXT NOT NULL,
  "DocumentRef" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "DecidedBy" TEXT NULL,
  "DecidedAt" TEXT NULL,
  "DecisionNote" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_VendorEvaluation" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_VendorEvaluation_Period" ON "VendorEvaluation" ("ProjectId", "SourceKind", "SourceId", "PeriodDate");


-- VendorImprovement · d14 · اقدام بهبود طرف قرارداد
CREATE TABLE IF NOT EXISTS "VendorImprovement" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "EvaluationId" TEXT NOT NULL,
  "Axis" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "OwnerId" TEXT NOT NULL,
  "DueDate" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "Evidence" TEXT NULL,
  "CompletedBy" TEXT NULL,
  "VerifiedBy" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_VendorImprovement" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_VendorImprovement_Project" ON "VendorImprovement" ("ProjectId", "EvaluationId");


-- ContractAmendment · d14 · الحاقیه پیمان
CREATE TABLE IF NOT EXISTS "ContractAmendment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "AmendmentType" TEXT NOT NULL,
  "EffectiveDate" TEXT NOT NULL,
  "AmountDelta" NUMERIC NULL,
  "DurationDeltaDays" INTEGER NULL,
  "LinkedCrCode" TEXT NULL,
  "DocumentRef" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "SubmittedAt" TEXT NULL,
  "DecidedBy" TEXT NULL,
  "DecidedAt" TEXT NULL,
  "DecisionNote" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractAmendment" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractAmendment" ON "ContractAmendment" ("ProjectId", "Code");
CREATE INDEX "IX_ContractAmendment_Contract" ON "ContractAmendment" ("ContractId", "EffectiveDate");


-- ApprovalAuthority · d14 · سطح اختیار تأیید
CREATE TABLE IF NOT EXISTS "ApprovalAuthority" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "Level" INTEGER NOT NULL,
  "RoleCode" TEXT NOT NULL,
  "MaxAmount" NUMERIC NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ApprovalAuthority" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ApprovalAuthority" ON "ApprovalAuthority" ("ContractId", "Level", "RoleCode");


-- ContractBOQ_Item · d14 · ردیف فهرست بها
CREATE TABLE IF NOT EXISTS "ContractBOQ_Item" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "ItemNo" TEXT NOT NULL,
  "ParentItemNo" TEXT NULL,
  "ChapterCode" TEXT NULL,
  "TitleFa" TEXT NOT NULL,
  "PricingBasis" TEXT NOT NULL,
  "Unit" TEXT NULL,
  "ContractQty" NUMERIC NULL,
  "UnitRate" NUMERIC NULL,
  "LumpSumAmount" NUMERIC NULL,
  "LineAmount" NUMERIC NOT NULL,
  "WbsId" TEXT NULL,
  "CostAccountCode" TEXT NULL,
  "IsStarred" INTEGER NOT NULL DEFAULT 0,
  "RateStatus" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractBOQ_Item" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractBOQ_Item" ON "ContractBOQ_Item" ("ContractId", "ItemNo");
CREATE INDEX "IX_BOQ_Chapter" ON "ContractBOQ_Item" ("ContractId", "ChapterCode");
CREATE INDEX "IX_BOQ_Wbs" ON "ContractBOQ_Item" ("ProjectId", "WbsId");


-- LumpSumMilestone · d14 · مرحله پیمان مقطوع
CREATE TABLE IF NOT EXISTS "LumpSumMilestone" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "BoqItemId" TEXT NOT NULL,
  "MilestoneNo" INTEGER NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "WeightPct" NUMERIC NOT NULL,
  "PlannedDate" TEXT NULL,
  "AcceptanceCriteriaFa" TEXT NULL,
  "AchievedDate" TEXT NULL,
  "AchievedPct" NUMERIC NULL,
  "EvidenceDocNo" TEXT NULL,
  "VerifiedBy" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_LumpSumMilestone" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_LumpSumMilestone" ON "LumpSumMilestone" ("BoqItemId", "MilestoneNo");
CREATE INDEX "IX_LumpSumMilestone_Contract" ON "LumpSumMilestone" ("ContractId", "Status");


-- BOQ_QuantityChange · d14 · تغییر مقادیر
CREATE TABLE IF NOT EXISTS "BOQ_QuantityChange" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "BoqItemId" TEXT NOT NULL,
  "ChangeNo" INTEGER NOT NULL,
  "BaseRowVersion" INTEGER NULL,
  "UnitRateSnapshot" NUMERIC NULL,
  "PreviousQty" NUMERIC NULL,
  "NewQty" NUMERIC NULL,
  "DeltaAmount" NUMERIC NULL,
  "ReasonFa" TEXT NULL,
  "LinkedCrCode" TEXT NULL,
  "RequestedAt" TEXT NOT NULL,
  "DocumentRef" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "SubmittedAt" TEXT NULL,
  "DecidedBy" TEXT NULL,
  "DecidedAt" TEXT NULL,
  "DecisionNote" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_BOQ_QuantityChange" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_BOQ_QuantityChange" ON "BOQ_QuantityChange" ("BoqItemId", "ChangeNo");


-- ExtraWorkItem · d14 · کار جدید
CREATE TABLE IF NOT EXISTS "ExtraWorkItem" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Unit" TEXT NULL,
  "Quantity" NUMERIC NULL,
  "ProposedRate" NUMERIC NULL,
  "AgreedRate" NUMERIC NULL,
  "ReasonFa" TEXT NULL,
  "AnalysisMethod" TEXT NULL,
  "LinkedCrCode" TEXT NULL,
  "BoqItemId" TEXT NULL,
  "DocumentRef" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "SubmittedAt" TEXT NULL,
  "DecidedBy" TEXT NULL,
  "DecidedAt" TEXT NULL,
  "DecisionNote" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ExtraWorkItem" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ExtraWorkItem" ON "ExtraWorkItem" ("ContractId", "Code");


-- MeasurementSheet · d14 · برگه ریزمتره
CREATE TABLE IF NOT EXISTS "MeasurementSheet" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "IpcId" TEXT NULL,
  "BoqItemId" TEXT NOT NULL,
  "SheetNo" INTEGER NOT NULL,
  "LocationFa" TEXT NULL,
  "DrawingNo" TEXT NULL,
  "Count" NUMERIC NULL,
  "Length" NUMERIC NULL,
  "Width" NUMERIC NULL,
  "Height" NUMERIC NULL,
  "Factor" NUMERIC NULL,
  "Quantity" NUMERIC NOT NULL,
  "SourceDprId" TEXT NULL,
  "InspectionRecordCode" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MeasurementSheet" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_MeasurementSheet" ON "MeasurementSheet" ("BoqItemId", "SheetNo");
CREATE INDEX "IX_MeasurementSheet_Ipc" ON "MeasurementSheet" ("ContractId", "IpcId");


-- InterimPaymentCertificate · d14 · صورت‌وضعیت موقت
CREATE TABLE IF NOT EXISTS "InterimPaymentCertificate" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "SerialNo" INTEGER NOT NULL,
  "IpcType" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "PeriodFrom" TEXT NOT NULL,
  "PeriodTo" TEXT NOT NULL,
  "GrossCurrent" NUMERIC NOT NULL DEFAULT 0,
  "GrossCumulative" NUMERIC NOT NULL DEFAULT 0,
  "AdjustmentAmount" NUMERIC NULL,
  "MaterialDiffAmount" NUMERIC NULL,
  "SubtotalAmount" NUMERIC NOT NULL DEFAULT 0,
  "TotalDeductions" NUMERIC NOT NULL DEFAULT 0,
  "VatAmount" NUMERIC NULL,
  "NetPayable" NUMERIC NOT NULL DEFAULT 0,
  "WorkflowState" TEXT NOT NULL,
  "SubmittedAt" TEXT NULL,
  "ConsultantApprovedAt" TEXT NULL,
  "EmployerApprovedAt" TEXT NULL,
  "PaidAt" TEXT NULL,
  "PostedToFin" INTEGER NOT NULL DEFAULT 0,
  "LegacyRef" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_InterimPaymentCertificate" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_InterimPaymentCertificate" ON "InterimPaymentCertificate" ("ContractId", "SerialNo");
CREATE INDEX "IX_IPC_Period" ON "InterimPaymentCertificate" ("ProjectId", "PeriodCode");
CREATE INDEX "IX_IPC_Workflow" ON "InterimPaymentCertificate" ("ProjectId", "WorkflowState");


-- IPC_LineItem · d14 · ردیف صورت‌وضعیت
CREATE TABLE IF NOT EXISTS "IPC_LineItem" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "IpcId" TEXT NOT NULL,
  "BoqItemId" TEXT NOT NULL,
  "PricingBasis" TEXT NOT NULL,
  "PrevQty" NUMERIC NULL,
  "CumQty" NUMERIC NULL,
  "CurrentQty" NUMERIC NULL,
  "PrevPct" NUMERIC NULL,
  "CumPct" NUMERIC NULL,
  "MilestoneId" TEXT NULL,
  "UnitRate" NUMERIC NULL,
  "EarnedCurrent" NUMERIC NOT NULL DEFAULT 0,
  "EarnedCumulative" NUMERIC NOT NULL DEFAULT 0,
  "ClaimedQty" NUMERIC NULL,
  "VerifiedQty" NUMERIC NULL,
  "ApprovedQty" NUMERIC NULL,
  "QualityGateStatus" TEXT NOT NULL,
  "OverrideBy" TEXT NULL,
  "OverrideReasonFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IPC_LineItem" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_IPC_LineItem" ON "IPC_LineItem" ("IpcId", "BoqItemId");
CREATE INDEX "IX_IPC_LineItem_Boq" ON "IPC_LineItem" ("ProjectId", "BoqItemId");


-- IPC_WorkflowStep · d14 · گام گردش صورت‌وضعیت
CREATE TABLE IF NOT EXISTS "IPC_WorkflowStep" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "IpcId" TEXT NOT NULL,
  "StepNo" INTEGER NOT NULL,
  "Actor" TEXT NOT NULL,
  "ActorUserId" TEXT NULL,
  "Action" TEXT NOT NULL,
  "ActedAt" TEXT NOT NULL,
  "DueAt" TEXT NULL,
  "OverdueDays" INTEGER NULL,
  "CommentFa" TEXT NULL,
  "SnapshotSha256" TEXT NULL,
  "DocumentSha256" TEXT NULL,
  "PrevHash" TEXT NULL,
  "SignatureMethod" TEXT NULL,
  "SignatureVersion" TEXT NULL,
  "AttestationFa" TEXT NULL,
  "GuaranteeCheckJson" TEXT NULL,
  "PkiSignature" TEXT NULL,
  "PkiCertPem" TEXT NULL,
  "PkiCertSha256" TEXT NULL,
  "PkiKeyId" TEXT NULL,
  "PkiAlgorithm" TEXT NULL,
  "PkiSignedAt" TEXT NULL,
  "PkiTrustLevel" TEXT NULL,
  "PkiCertInfoJson" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IPC_WorkflowStep" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_IPC_WorkflowStep" ON "IPC_WorkflowStep" ("IpcId", "StepNo");


-- IPC_Deduction · d14 · کسور صورت‌وضعیت
CREATE TABLE IF NOT EXISTS "IPC_Deduction" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "IpcId" TEXT NOT NULL,
  "DeductionType" TEXT NOT NULL,
  "BaseAmount" NUMERIC NULL,
  "RatePct" NUMERIC NULL,
  "Amount" NUMERIC NOT NULL,
  "IsStatutory" INTEGER NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IPC_Deduction" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_IPC_Deduction" ON "IPC_Deduction" ("IpcId", "DeductionType");


-- AdjustmentIndexCatalog · d14 · کاتالوگ شاخص تعدیل
CREATE TABLE IF NOT EXISTS "AdjustmentIndexCatalog" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "IndexPeriod" TEXT NOT NULL,
  "ChapterCode" TEXT NOT NULL,
  "IndexValue" NUMERIC NOT NULL,
  "SourceFa" TEXT NULL,
  "PublishedAt" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_AdjustmentIndexCatalog" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_AdjustmentIndexCatalog" ON "AdjustmentIndexCatalog" ("ProjectId", "IndexPeriod", "ChapterCode");


-- PriceAdjustmentCalculation · d14 · محاسبه تعدیل
CREATE TABLE IF NOT EXISTS "PriceAdjustmentCalculation" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "IpcId" TEXT NOT NULL,
  "ChapterCode" TEXT NOT NULL,
  "WorkAmount" NUMERIC NOT NULL,
  "BaseIndex" NUMERIC NOT NULL,
  "PeriodIndex" NUMERIC NOT NULL,
  "AdjustmentFactor" NUMERIC NOT NULL,
  "AdjustmentAmount" NUMERIC NOT NULL,
  "AppliedRatePct" NUMERIC NULL,
  "CalcNoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PriceAdjustmentCalculation" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PriceAdjustmentCalculation" ON "PriceAdjustmentCalculation" ("IpcId", "ChapterCode");


-- MaterialDiffCalc · d14 · مابه‌التفاوت مصالح
CREATE TABLE IF NOT EXISTS "MaterialDiffCalc" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "IpcId" TEXT NOT NULL,
  "MaterialCode" TEXT NOT NULL,
  "MaterialNameFa" TEXT NOT NULL,
  "Quantity" NUMERIC NULL,
  "Unit" TEXT NULL,
  "BaseRate" NUMERIC NULL,
  "PeriodRate" NUMERIC NULL,
  "DiffAmount" NUMERIC NOT NULL,
  "EvidenceDocNo" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MaterialDiffCalc" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_MaterialDiffCalc" ON "MaterialDiffCalc" ("IpcId", "MaterialCode");


-- ContractGuarantee · d14 · ضمانت‌نامه
CREATE TABLE IF NOT EXISTS "ContractGuarantee" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "GuaranteeType" TEXT NOT NULL,
  "BankName" TEXT NOT NULL,
  "GuaranteeNo" TEXT NOT NULL,
  "Amount" NUMERIC NOT NULL,
  "Currency" TEXT NULL DEFAULT 'IRR',
  "IssueDate" TEXT NOT NULL,
  "ExpiryDate" TEXT NOT NULL,
  "ExtendedToDate" TEXT NULL,
  "ReleaseDate" TEXT NULL,
  "Status" TEXT NOT NULL,
  "AlertLevel" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractGuarantee" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractGuarantee" ON "ContractGuarantee" ("ProjectId", "Code");
CREATE INDEX "IX_Guarantee_Expiry" ON "ContractGuarantee" ("ProjectId", "ExpiryDate", "Status");


-- AdvancePaymentSchedule · d14 · برنامه پیش‌پرداخت
CREATE TABLE IF NOT EXISTS "AdvancePaymentSchedule" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "InstallmentNo" INTEGER NOT NULL,
  "PaidAmount" NUMERIC NULL,
  "PaidAt" TEXT NULL,
  "RecoveryPct" NUMERIC NULL,
  "RecoveredToDate" NUMERIC NULL DEFAULT 0,
  "OutstandingAmount" NUMERIC NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_AdvancePaymentSchedule" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_AdvancePaymentSchedule" ON "AdvancePaymentSchedule" ("ContractId", "InstallmentNo");


-- RetainageLedger · d14 · دفتر سپرده حسن انجام کار
CREATE TABLE IF NOT EXISTS "RetainageLedger" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "IpcId" TEXT NULL,
  "EntryType" TEXT NOT NULL,
  "Amount" NUMERIC NOT NULL,
  "BalanceAfter" NUMERIC NOT NULL,
  "TriggerEvent" TEXT NULL,
  "TriggerDocNo" TEXT NULL,
  "EntryDate" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_RetainageLedger" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_RetainageLedger_Contract" ON "RetainageLedger" ("ContractId", "EntryDate");


-- SubcontractorIPC · d14 · صورت‌وضعیت پیمانکار جزء
CREATE TABLE IF NOT EXISTS "SubcontractorIPC" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "MainContractId" TEXT NULL,
  "MainIpcId" TEXT NULL,
  "SerialNo" INTEGER NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "GrossCurrent" NUMERIC NOT NULL DEFAULT 0,
  "TotalDeductions" NUMERIC NULL,
  "NetPayable" NUMERIC NOT NULL DEFAULT 0,
  "WorkflowState" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SubcontractorIPC" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_SubcontractorIPC" ON "SubcontractorIPC" ("ContractId", "SerialNo");


-- SubcontractorIPC_LineItem · d14 · ردیف صورت‌وضعیت جزء
CREATE TABLE IF NOT EXISTS "SubcontractorIPC_LineItem" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SubIpcId" TEXT NOT NULL,
  "BoqItemId" TEXT NULL,
  "DescriptionFa" TEXT NOT NULL,
  "Unit" TEXT NULL,
  "Quantity" NUMERIC NULL,
  "UnitRate" NUMERIC NULL,
  "Amount" NUMERIC NOT NULL DEFAULT 0,
  "MainApprovedQty" NUMERIC NULL,
  "VarianceFlag" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SubcontractorIPC_LineItem" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_SubIpcLine_Sub" ON "SubcontractorIPC_LineItem" ("SubIpcId", "BoqItemId");


-- BackToBackDeduction · d14 · کسور متقابل
CREATE TABLE IF NOT EXISTS "BackToBackDeduction" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SubIpcId" TEXT NOT NULL,
  "SourceModule" TEXT NOT NULL,
  "SourceRefCode" TEXT NULL,
  "DescriptionFa" TEXT NOT NULL,
  "Amount" NUMERIC NOT NULL,
  "EvidenceDocNo" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_BackToBackDeduction" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_BackToBack_Sub" ON "BackToBackDeduction" ("SubIpcId", "SourceModule");


-- ContractMetricsSnapshot · d14 · عکس شاخص پیمان
CREATE TABLE IF NOT EXISTS "ContractMetricsSnapshot" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "PhysicalPct" NUMERIC NULL,
  "FinancialPct" NUMERIC NULL,
  "VariancePct" NUMERIC NULL,
  "CeilingUsedPct" NUMERIC NULL,
  "AdvanceRecoveredPct" NUMERIC NULL,
  "ExtraWorkRatioPct" NUMERIC NULL,
  "AvgIpcCycleDays" NUMERIC NULL,
  "OpenGuaranteeCount" INTEGER NULL,
  "ExpiringGuaranteeCount" INTEGER NULL,
  "IsGapReliable" INTEGER NULL,
  "RetainageBalance" NUMERIC NULL,
  "SnapshotAt" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractMetricsSnapshot" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractMetricsSnapshot" ON "ContractMetricsSnapshot" ("ContractId", "PeriodCode");


-- ContractAlertRule · d14 · قاعده هشدار پیمان
CREATE TABLE IF NOT EXISTS "ContractAlertRule" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RuleCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Severity" TEXT NOT NULL,
  "ThresholdValue" NUMERIC NULL,
  "IsEnabled" INTEGER NOT NULL DEFAULT 1,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractAlertRule" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractAlertRule" ON "ContractAlertRule" ("ProjectId", "RuleCode");


-- ContractFinPosting · d14 · ثبت صورت‌وضعیت در مالی
CREATE TABLE IF NOT EXISTS "ContractFinPosting" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NOT NULL,
  "IpcId" TEXT NOT NULL,
  "SerialNo" INTEGER NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "CostAccountId" TEXT NOT NULL,
  "GrossAmount" NUMERIC NOT NULL DEFAULT 0,
  "NetAmount" NUMERIC NOT NULL DEFAULT 0,
  "DeductionAmount" NUMERIC NOT NULL DEFAULT 0,
  "VatAmount" NUMERIC NULL DEFAULT 0,
  "PreviousActual" NUMERIC NOT NULL DEFAULT 0,
  "NextActual" NUMERIC NOT NULL DEFAULT 0,
  "MemoFa" TEXT NULL,
  "PostedBy" TEXT NOT NULL,
  "PostedAt" TEXT NOT NULL,
  "ReversedBy" TEXT NULL,
  "ReversedAt" TEXT NULL,
  "ReversalReasonFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ContractFinPosting" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ContractFinPosting_Ipc" ON "ContractFinPosting" ("IpcId");
CREATE INDEX "IX_ContractFinPosting_Account" ON "ContractFinPosting" ("CostAccountId", "PeriodCode");


-- CompletionCertificate · d15 · گواهی تحویل
CREATE TABLE IF NOT EXISTS "CompletionCertificate" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NULL,
  "CertificateType" TEXT NOT NULL,
  "CertificateNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "HandoverDate" TEXT NOT NULL,
  "IssueDate" TEXT NULL,
  "WarrantyMonths" INTEGER NULL,
  "WarrantyEndDate" TEXT NULL,
  "PredecessorId" TEXT NULL,
  "OpenPunchCount" INTEGER NULL,
  "SystemId" TEXT NULL,
  "ReadyForGateAt" TEXT NULL,
  "CommitteeFa" TEXT NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CompletionCertificate" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CompletionCertificate" ON "CompletionCertificate" ("ProjectId", "CertificateNo");
CREATE INDEX "IX_CompletionCertificate_Type" ON "CompletionCertificate" ("ProjectId", "CertificateType", "Status");
CREATE INDEX "IX_CompletionCertificate_Contract" ON "CompletionCertificate" ("ContractId", "CertificateType");


-- PunchListItem · d15 · نقص فهرست تحویل
CREATE TABLE IF NOT EXISTS "PunchListItem" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CertificateId" TEXT NULL,
  "ContractId" TEXT NULL,
  "ItemNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "SystemId" TEXT NULL,
  "DisciplineCode" TEXT NULL,
  "LocationFa" TEXT NULL,
  "RaisedBy" TEXT NULL,
  "RaisedAt" TEXT NOT NULL,
  "DueDate" TEXT NULL,
  "ClosedAt" TEXT NULL,
  "ClosedBy" TEXT NULL,
  "EvidenceDocNo" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PunchListItem" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PunchListItem" ON "PunchListItem" ("ProjectId", "ItemNo");
CREATE INDEX "IX_PunchListItem_Cert" ON "PunchListItem" ("CertificateId", "Status");
CREATE INDEX "IX_PunchListItem_Category" ON "PunchListItem" ("ProjectId", "Category", "Status");
CREATE INDEX "IX_PunchListItem_Gate" ON "PunchListItem" ("ProjectId", "SystemId", "Category", "Status");


-- SystemSubsystem · d15 · سیستم و زیرسیستم
CREATE TABLE IF NOT EXISTS "SystemSubsystem" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ParentId" TEXT NULL,
  "SystemCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "TitleEn" TEXT NULL,
  "SystemType" TEXT NOT NULL,
  "DisciplineCode" TEXT NULL,
  "CommissioningPriority" INTEGER NULL,
  "CriticalityFa" TEXT NULL,
  "OwnerUserId" TEXT NULL,
  "SortOrder" INTEGER NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SystemSubsystem" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_SystemSubsystem_Code" ON "SystemSubsystem" ("ProjectId", "SystemCode");
CREATE INDEX "IX_SystemSubsystem_Parent" ON "SystemSubsystem" ("ParentId");
CREATE INDEX "IX_SystemSubsystem_Status" ON "SystemSubsystem" ("ProjectId", "Status");


-- SystemBoundaryMapping · d15 · مرزبندی سیستم
CREATE TABLE IF NOT EXISTS "SystemBoundaryMapping" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SystemId" TEXT NOT NULL,
  "TargetKind" TEXT NOT NULL,
  "TargetRef" TEXT NOT NULL,
  "BoundaryNoteFa" TEXT NULL,
  "IsPrimary" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SystemBoundaryMapping" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_SystemBoundary" ON "SystemBoundaryMapping" ("SystemId", "TargetKind", "TargetRef");
CREATE INDEX "IX_SystemBoundary_Target" ON "SystemBoundaryMapping" ("ProjectId", "TargetKind", "TargetRef");


-- SystemMilestoneTarget · d15 · تاریخ هدف دروازه
CREATE TABLE IF NOT EXISTS "SystemMilestoneTarget" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SystemId" TEXT NOT NULL,
  "GateType" TEXT NOT NULL,
  "TargetDate" TEXT NOT NULL,
  "ForecastDate" TEXT NULL,
  "ActualDate" TEXT NULL,
  "SlipDays" INTEGER NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SystemMilestoneTarget" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_SystemMilestone" ON "SystemMilestoneTarget" ("SystemId", "GateType");
CREATE INDEX "IX_SystemMilestone_Gate" ON "SystemMilestoneTarget" ("ProjectId", "GateType", "TargetDate");


-- CheckRecordPack · d15 · بستهٔ آزمون
CREATE TABLE IF NOT EXISTS "CheckRecordPack" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SystemId" TEXT NOT NULL,
  "PackNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "PackType" TEXT NOT NULL,
  "DisciplineCode" TEXT NULL,
  "TotalSheets" INTEGER NULL,
  "ClearedSheets" INTEGER NULL,
  "ClearedAt" TEXT NULL,
  "ClearedBy" TEXT NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CheckRecordPack" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CheckRecordPack" ON "CheckRecordPack" ("ProjectId", "PackNo");
CREATE INDEX "IX_CheckRecordPack_System" ON "CheckRecordPack" ("SystemId", "PackType", "Status");


-- CheckSheet · d15 · برگهٔ آزمون
CREATE TABLE IF NOT EXISTS "CheckSheet" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PackId" TEXT NOT NULL,
  "SheetNo" TEXT NOT NULL,
  "SheetType" TEXT NOT NULL,
  "TestKind" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "TestDate" TEXT NULL,
  "TestedBy" TEXT NULL,
  "WitnessedBy" TEXT NULL,
  "ResultFa" TEXT NULL,
  "NcrRef" TEXT NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CheckSheet" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CheckSheet" ON "CheckSheet" ("ProjectId", "SheetNo");
CREATE INDEX "IX_CheckSheet_Pack" ON "CheckSheet" ("PackId", "Status");
CREATE INDEX "IX_CheckSheet_Kind" ON "CheckSheet" ("ProjectId", "SheetType", "TestKind");


-- CheckSheetLine · d15 · ردیف برگهٔ آزمون
CREATE TABLE IF NOT EXISTS "CheckSheetLine" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SheetId" TEXT NOT NULL,
  "LineNo" INTEGER NOT NULL,
  "ParameterFa" TEXT NOT NULL,
  "ExpectedValue" TEXT NULL,
  "ActualValue" TEXT NULL,
  "UnitFa" TEXT NULL,
  "IsMandatory" INTEGER NOT NULL DEFAULT 1,
  "Passed" INTEGER NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CheckSheetLine" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CheckSheetLine" ON "CheckSheetLine" ("SheetId", "LineNo");
CREATE INDEX "IX_CheckSheetLine_Sheet" ON "CheckSheetLine" ("SheetId", "IsMandatory");


-- CommissioningTag · d15 · بانک تگ راه‌اندازی
CREATE TABLE IF NOT EXISTS "CommissioningTag" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SystemId" TEXT NULL,
  "TagNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "TitleEn" TEXT NULL,
  "TagType" TEXT NOT NULL,
  "DisciplineCode" TEXT NULL,
  "LocationFa" TEXT NULL,
  "LoopNo" TEXT NULL,
  "ManufacturerFa" TEXT NULL,
  "ModelFa" TEXT NULL,
  "SerialNo" TEXT NULL,
  "CriticalityFa" TEXT NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CommissioningTag" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CommissioningTag_No" ON "CommissioningTag" ("ProjectId", "TagNo");
CREATE INDEX "IX_CommissioningTag_System" ON "CommissioningTag" ("SystemId", "TagType", "Status");
CREATE INDEX "IX_CommissioningTag_Type" ON "CommissioningTag" ("ProjectId", "TagType", "Status");


-- DocumentAttachment · d1 · پیوست مدرک
CREATE TABLE IF NOT EXISTS "DocumentAttachment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NOT NULL,
  "DocNo" TEXT NOT NULL,
  "Revision" TEXT NOT NULL,
  "FileName" TEXT NOT NULL,
  "MimeType" TEXT NOT NULL,
  "SizeBytes" INTEGER NOT NULL,
  "StorageKey" TEXT NOT NULL,
  "ChecksumSha256" TEXT NULL,
  "UploadedBy" TEXT NOT NULL,
  "UploadedAt" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_DocumentAttachment" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_DocAttach_Doc" ON "DocumentAttachment" ("DocumentId");
CREATE INDEX "IX_DocAttach_DocNoRev" ON "DocumentAttachment" ("ProjectId", "DocNo", "Revision");
CREATE INDEX "IX_DocAttach_Project" ON "DocumentAttachment" ("ProjectId", "UploadedAt");


-- DocumentHold · d1 · هولد مدرک
CREATE TABLE IF NOT EXISTS "DocumentHold" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NOT NULL,
  "DocNo" TEXT NOT NULL,
  "Revision" TEXT NOT NULL,
  "HoldNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "HoldType" TEXT NOT NULL,
  "RaisedBy" TEXT NOT NULL,
  "RaisedAt" TEXT NOT NULL,
  "DueAt" TEXT NULL,
  "ReleasedBy" TEXT NULL,
  "ReleasedAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_DocumentHold" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_DocHold_No" ON "DocumentHold" ("ProjectId", "HoldNo");
CREATE INDEX "IX_DocHold_Doc" ON "DocumentHold" ("DocumentId", "Status");
CREATE INDEX "IX_DocHold_Status" ON "DocumentHold" ("ProjectId", "Status", "DueAt");


-- DocumentDependency · d1 · پیش‌نیاز مدرک
CREATE TABLE IF NOT EXISTS "DocumentDependency" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NOT NULL,
  "DependsOnDocumentId" TEXT NOT NULL,
  "DependencyType" TEXT NOT NULL,
  "IsMandatory" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_DocumentDependency" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_DocDep" ON "DocumentDependency" ("DocumentId", "DependsOnDocumentId");
CREATE INDEX "IX_DocDep_Prereq" ON "DocumentDependency" ("DependsOnDocumentId");
CREATE INDEX "IX_DocDep_Project" ON "DocumentDependency" ("ProjectId", "DocumentId");


-- DocumentComment · d1 · نظر و جمع‌بندی مدرک
CREATE TABLE IF NOT EXISTS "DocumentComment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NOT NULL,
  "DocNo" TEXT NOT NULL,
  "Revision" TEXT NOT NULL,
  "CommentNo" INTEGER NOT NULL,
  "CommentText" TEXT NOT NULL,
  "CommentedBy" TEXT NOT NULL,
  "CommentedAt" TEXT NOT NULL,
  "ReplyText" TEXT NULL,
  "RepliedBy" TEXT NULL,
  "RepliedAt" TEXT NULL,
  "ConclusionText" TEXT NULL,
  "ConcludedBy" TEXT NULL,
  "ConcludedAt" TEXT NULL,
  "ReviewCode" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_DocumentComment" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_DocComment_No" ON "DocumentComment" ("DocumentId", "CommentNo");
CREATE INDEX "IX_DocComment_Status" ON "DocumentComment" ("ProjectId", "Status");
CREATE INDEX "IX_DocComment_Doc" ON "DocumentComment" ("DocumentId", "Status");


-- DocumentDistribution · d1 · توزیع مدرک
CREATE TABLE IF NOT EXISTS "DocumentDistribution" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NOT NULL,
  "DocNo" TEXT NOT NULL,
  "Revision" TEXT NOT NULL,
  "Party" TEXT NOT NULL,
  "TransmittalNo" TEXT NULL,
  "DistributedAt" TEXT NOT NULL,
  "DistributedBy" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_DocumentDistribution" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_DocDist_Id" ON "DocumentDistribution" ("Id");
CREATE INDEX "IX_DocDist_Doc" ON "DocumentDistribution" ("ProjectId", "DocumentId");
CREATE INDEX "IX_DocDist_Party" ON "DocumentDistribution" ("ProjectId", "Party");


-- DocumentTemplate · d1 · قالب مدرک/ترنسمیتال
CREATE TABLE IF NOT EXISTS "DocumentTemplate" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "TemplateType" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Code" TEXT NULL,
  "ContentJson" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_DocumentTemplate" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_DocTpl_Id" ON "DocumentTemplate" ("Id");
CREATE INDEX "IX_DocTpl_ProjectType" ON "DocumentTemplate" ("ProjectId", "TemplateType");


-- EdmsNotification · d1 · اعلان EDMS
CREATE TABLE IF NOT EXISTS "EdmsNotification" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NOT NULL,
  "DocNo" TEXT NOT NULL,
  "EventType" TEXT NOT NULL,
  "RecipientParty" TEXT NOT NULL,
  "RecipientEmail" TEXT NULL,
  "SubjectFa" TEXT NOT NULL,
  "BodyFa" TEXT NULL,
  "Channel" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "SentAt" TEXT NULL,
  "ErrorText" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EdmsNotification" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EdmsNotif_Id" ON "EdmsNotification" ("Id");
CREATE INDEX "IX_EdmsNotif_Project" ON "EdmsNotification" ("ProjectId", "Status");
CREATE INDEX "IX_EdmsNotif_Doc" ON "EdmsNotification" ("DocumentId", "EventType");


-- DocumentEffort · d1 · نفرساعت مدرک
CREATE TABLE IF NOT EXISTS "DocumentEffort" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NOT NULL,
  "DocNo" TEXT NOT NULL,
  "Revision" TEXT NOT NULL,
  "PersonId" TEXT NULL,
  "PersonName" TEXT NULL,
  "WorkDate" TEXT NOT NULL,
  "Hours" NUMERIC NOT NULL,
  "Cost" NUMERIC NULL,
  "Activity" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_DocumentEffort" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_DocEffort_Id" ON "DocumentEffort" ("Id");
CREATE INDEX "IX_DocEffort_Doc" ON "DocumentEffort" ("ProjectId", "DocumentId");
CREATE INDEX "IX_DocEffort_Date" ON "DocumentEffort" ("ProjectId", "WorkDate");


-- DocumentSubReview · d1 · شفاف‌سازی فنی پیمانکار فرعی
CREATE TABLE IF NOT EXISTS "DocumentSubReview" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NOT NULL,
  "DocNo" TEXT NOT NULL,
  "Revision" TEXT NOT NULL,
  "SubcontractorParty" TEXT NOT NULL,
  "QuestionFa" TEXT NOT NULL,
  "AnswerFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "AskedBy" TEXT NOT NULL,
  "AskedAt" TEXT NOT NULL,
  "AnsweredBy" TEXT NULL,
  "AnsweredAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_DocumentSubReview" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_DocSub_Id" ON "DocumentSubReview" ("Id");
CREATE INDEX "IX_DocSub_Doc" ON "DocumentSubReview" ("ProjectId", "DocumentId");
CREATE INDEX "IX_DocSub_Status" ON "DocumentSubReview" ("ProjectId", "Status");


-- CkmInboxItem · d11 · کارتابل کاربر
CREATE TABLE IF NOT EXISTS "CkmInboxItem" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RecipientUserId" TEXT NOT NULL,
  "Type" TEXT NOT NULL,
  "ReferenceId" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DueAt" TEXT NULL,
  "Status" TEXT NOT NULL,
  "ReadAt" TEXT NULL,
  "DoneAt" TEXT NULL,
  "Priority" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CkmInboxItem" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CkmInbox_Id" ON "CkmInboxItem" ("Id");
CREATE INDEX "IX_CkmInbox_Recipient" ON "CkmInboxItem" ("ProjectId", "RecipientUserId", "Status");
CREATE INDEX "IX_CkmInbox_Type" ON "CkmInboxItem" ("ProjectId", "Type");


-- CkmReferral · d11 · ارجاع مکاتبه
CREATE TABLE IF NOT EXISTS "CkmReferral" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "LetterNo" TEXT NOT NULL,
  "FromUserId" TEXT NOT NULL,
  "ToUserId" TEXT NOT NULL,
  "InstructionFa" TEXT NOT NULL,
  "Deadline" TEXT NULL,
  "Status" TEXT NOT NULL,
  "DoneAt" TEXT NULL,
  "DoneNoteFa" TEXT NULL,
  "HistoryJson" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CkmReferral" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CkmReferral_Id" ON "CkmReferral" ("Id");
CREATE INDEX "IX_CkmReferral_Letter" ON "CkmReferral" ("ProjectId", "LetterNo");
CREATE INDEX "IX_CkmReferral_To" ON "CkmReferral" ("ProjectId", "ToUserId", "Status");


-- CkmLetterSequence · d11 · شماره‌گذاری نامه
CREATE TABLE IF NOT EXISTS "CkmLetterSequence" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Prefix" TEXT NOT NULL,
  "LastNumber" INTEGER NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CkmLetterSequence" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CkmSeq_Id" ON "CkmLetterSequence" ("Id");
CREATE UNIQUE INDEX "UX_CkmSeq_ProjectPrefix" ON "CkmLetterSequence" ("ProjectId", "Prefix");


-- CkmSignature · d11 · امضای الکترونیکی نامه
CREATE TABLE IF NOT EXISTS "CkmSignature" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "LetterNo" TEXT NOT NULL,
  "SignedBy" TEXT NOT NULL,
  "SignedAt" TEXT NOT NULL,
  "SignatureHash" TEXT NULL,
  "Method" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CkmSignature" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CkmSig_Id" ON "CkmSignature" ("Id");
CREATE INDEX "IX_CkmSig_Letter" ON "CkmSignature" ("ProjectId", "LetterNo");


-- CkmLetterLink · d11 · پیوند نامه به مدرک/Tag/بسته خرید
CREATE TABLE IF NOT EXISTS "CkmLetterLink" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "LetterNo" TEXT NOT NULL,
  "LinkType" TEXT NOT NULL,
  "TargetId" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CkmLetterLink" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CkmLink_Id" ON "CkmLetterLink" ("Id");
CREATE INDEX "IX_CkmLink_Letter" ON "CkmLetterLink" ("ProjectId", "LetterNo");
CREATE INDEX "IX_CkmLink_TypeTarget" ON "CkmLetterLink" ("ProjectId", "LinkType", "TargetId");


-- ScmVendor · d5 · فروشنده
CREATE TABLE IF NOT EXISTS "ScmVendor" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "ContactPerson" TEXT NULL,
  "Email" TEXT NULL,
  "Phone" TEXT NULL,
  "Country" TEXT NULL,
  "City" TEXT NULL,
  "Disciplines" TEXT NULL,
  "MaterialCategories" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmVendor" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmVendor_Code" ON "ScmVendor" ("ProjectId", "Code");
CREATE INDEX "IX_ScmVendor_Status" ON "ScmVendor" ("ProjectId", "Status");


-- ScmAvlEntry · d5 · فهرست فروشندگان مجاز
CREATE TABLE IF NOT EXISTS "ScmAvlEntry" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "VendorId" TEXT NOT NULL,
  "Discipline" TEXT NOT NULL,
  "MaterialCategory" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ExpiryAt" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'approved',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmAvlEntry" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmAvl_VendorDisc" ON "ScmAvlEntry" ("ProjectId", "VendorId", "Discipline", "MaterialCategory");
CREATE INDEX "IX_ScmAvl_Discipline" ON "ScmAvlEntry" ("ProjectId", "Discipline", "Status");


-- ScmProcPackage · d5 · بسته خرید
CREATE TABLE IF NOT EXISTS "ScmProcPackage" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Discipline" TEXT NULL,
  "WbsId" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "PlannedIssueDate" TEXT NULL,
  "TotalEstimatedAmount" NUMERIC NULL,
  "Currency" TEXT NULL DEFAULT 'IRR',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmProcPackage" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmProcPkg_Code" ON "ScmProcPackage" ("ProjectId", "Code");
CREATE INDEX "IX_ScmProcPkg_Status" ON "ScmProcPackage" ("ProjectId", "Status");
CREATE INDEX "IX_ScmProcPkg_Disc" ON "ScmProcPackage" ("ProjectId", "Discipline");


-- ScmPackageMrLink · d5 · پیوند بسته خرید به MR
CREATE TABLE IF NOT EXISTS "ScmPackageMrLink" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PackageId" TEXT NOT NULL,
  "MrCode" TEXT NOT NULL,
  "AddedBy" TEXT NOT NULL,
  "AddedAt" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmPackageMrLink" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmPkgMr" ON "ScmPackageMrLink" ("PackageId", "MrCode");
CREATE INDEX "IX_ScmPkgMr_Project" ON "ScmPackageMrLink" ("ProjectId", "PackageId");
CREATE INDEX "IX_ScmPkgMr_Mr" ON "ScmPackageMrLink" ("ProjectId", "MrCode");


-- ScmInquiryPackage · d5 · بسته استعلام
CREATE TABLE IF NOT EXISTS "ScmInquiryPackage" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PackageId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "InquiryType" TEXT NULL DEFAULT 'rfq',
  "IssueDate" TEXT NULL,
  "DueDate" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmInquiryPackage" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmInq_Code" ON "ScmInquiryPackage" ("ProjectId", "Code");
CREATE INDEX "IX_ScmInq_Package" ON "ScmInquiryPackage" ("PackageId");
CREATE INDEX "IX_ScmInq_Status" ON "ScmInquiryPackage" ("ProjectId", "Status");


-- ScmBidderList · d5 · فهرست مناقصه‌گران
CREATE TABLE IF NOT EXISTS "ScmBidderList" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "InquiryPackageId" TEXT NOT NULL,
  "VendorId" TEXT NOT NULL,
  "ListType" TEXT NOT NULL DEFAULT 'sbl',
  "Status" TEXT NOT NULL DEFAULT 'invited',
  "InvitedAt" TEXT NULL,
  "AcknowledgedAt" TEXT NULL,
  "DeclineReasonFa" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmBidderList" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmBidder" ON "ScmBidderList" ("InquiryPackageId", "VendorId");
CREATE INDEX "IX_ScmBidder_Project" ON "ScmBidderList" ("ProjectId", "ListType", "Status");


-- ScmInvitation · d5 · دعوت‌نامه مناقصه
CREATE TABLE IF NOT EXISTS "ScmInvitation" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "InquiryPackageId" TEXT NOT NULL,
  "VendorId" TEXT NOT NULL,
  "InvitationNo" TEXT NOT NULL,
  "SentAt" TEXT NOT NULL,
  "SentBy" TEXT NOT NULL,
  "ValidUntil" TEXT NULL,
  "AckAt" TEXT NULL,
  "AckStatus" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmInvitation" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmInv_No" ON "ScmInvitation" ("ProjectId", "InvitationNo");
CREATE INDEX "IX_ScmInv_InqVendor" ON "ScmInvitation" ("InquiryPackageId", "VendorId");


-- ScmMrChangeLog · d5 · لاگ تغییر MR
CREATE TABLE IF NOT EXISTS "ScmMrChangeLog" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MrCode" TEXT NOT NULL,
  "ChangeType" TEXT NOT NULL,
  "OldValue" TEXT NULL,
  "NewValue" TEXT NULL,
  "ChangedBy" TEXT NOT NULL,
  "ChangedAt" TEXT NOT NULL,
  "NotifiedAt" TEXT NULL,
  "NotifyStatus" TEXT NOT NULL DEFAULT 'pending',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmMrChangeLog" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ScmMrChange_Mr" ON "ScmMrChangeLog" ("ProjectId", "MrCode", "ChangedAt");
CREATE INDEX "IX_ScmMrChange_Status" ON "ScmMrChangeLog" ("ProjectId", "NotifyStatus");


-- ScmMrr · d5 · رسید مواد MRS/OPI
CREATE TABLE IF NOT EXISTS "ScmMrr" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "PoNo" TEXT NOT NULL,
  "ReceivedAt" TEXT NOT NULL,
  "ReceivedBy" TEXT NOT NULL,
  "Quantity" NUMERIC NULL,
  "AcceptedQty" NUMERIC NULL,
  "RejectedQty" NUMERIC NULL,
  "OverQty" NUMERIC NULL,
  "ShortageQty" NUMERIC NULL,
  "DamageQty" NUMERIC NULL,
  "OpiType" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "Warehouse" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmMrr" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmMrr_Code" ON "ScmMrr" ("ProjectId", "Code");
CREATE INDEX "IX_ScmMrr_Po" ON "ScmMrr" ("ProjectId", "PoNo");
CREATE INDEX "IX_ScmMrr_Status" ON "ScmMrr" ("ProjectId", "Status");


-- ScmProposal · d5 · پیشنهاد فنی/بازرگانی
CREATE TABLE IF NOT EXISTS "ScmProposal" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ProposalNo" TEXT NOT NULL,
  "InquiryPackageId" TEXT NOT NULL,
  "InquiryCode" TEXT NOT NULL,
  "VendorId" TEXT NOT NULL,
  "VendorCode" TEXT NOT NULL,
  "Type" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'submitted',
  "SubmittedAt" TEXT NULL,
  "Amount" NUMERIC NULL,
  "Currency" TEXT NULL,
  "ValidUntil" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmProposal" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmProposal_No" ON "ScmProposal" ("ProjectId", "ProposalNo");
CREATE INDEX "IX_ScmProposal_Inq" ON "ScmProposal" ("ProjectId", "InquiryCode");


-- ScmClarification · d5 · شفاف‌سازی پیشنهاد
CREATE TABLE IF NOT EXISTS "ScmClarification" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ProposalId" TEXT NOT NULL,
  "ProposalNo" TEXT NOT NULL,
  "QuestionFa" TEXT NOT NULL,
  "AnswerFa" TEXT NULL,
  "AskedBy" TEXT NOT NULL,
  "AskedAt" TEXT NOT NULL,
  "AnsweredAt" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'open',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmClarification" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ScmClar_Proposal" ON "ScmClarification" ("ProjectId", "ProposalId");


-- ScmEvaluation · d5 · ارزیابی پیشنهاد TBE/TBA/CBE
CREATE TABLE IF NOT EXISTS "ScmEvaluation" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "EvalNo" TEXT NOT NULL,
  "ProposalId" TEXT NOT NULL,
  "ProposalNo" TEXT NOT NULL,
  "Type" TEXT NOT NULL,
  "Score" NUMERIC NULL,
  "Result" TEXT NOT NULL,
  "EvaluatedBy" TEXT NOT NULL,
  "EvaluatedAt" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmEvaluation" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmEval_No" ON "ScmEvaluation" ("ProjectId", "EvalNo");
CREATE INDEX "IX_ScmEval_Proposal" ON "ScmEvaluation" ("ProjectId", "ProposalNo");


-- ScmBidReport · d5 · گزارش مناقصه و صدور PO
CREATE TABLE IF NOT EXISTS "ScmBidReport" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ReportNo" TEXT NOT NULL,
  "InquiryPackageId" TEXT NOT NULL,
  "InquiryCode" TEXT NOT NULL,
  "WinnerVendorCode" TEXT NULL,
  "TotalAmount" NUMERIC NULL,
  "Currency" TEXT NULL,
  "RecommendationFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmBidReport" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmBidReport_No" ON "ScmBidReport" ("ProjectId", "ReportNo");


-- ScmKom · d5 · KOM/PIM و Expediting
CREATE TABLE IF NOT EXISTS "ScmKom" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "KomNo" TEXT NOT NULL,
  "PoNo" TEXT NULL,
  "Type" TEXT NOT NULL,
  "MeetingDate" TEXT NOT NULL,
  "LocationFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'scheduled',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmKom" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmKom_No" ON "ScmKom" ("ProjectId", "KomNo");


-- ScmInspection · d5 · بازرسی و Release Note
CREATE TABLE IF NOT EXISTS "ScmInspection" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "InspectionNo" TEXT NOT NULL,
  "PoNo" TEXT NULL,
  "Type" TEXT NOT NULL,
  "Inspector" TEXT NULL,
  "InspectionDate" TEXT NOT NULL,
  "Result" TEXT NOT NULL,
  "ReleaseNoteNo" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmInspection" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmInspection_No" ON "ScmInspection" ("ProjectId", "InspectionNo");


-- ScmShipment · d5 · حمل و ترخیص
CREATE TABLE IF NOT EXISTS "ScmShipment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ShipmentNo" TEXT NOT NULL,
  "PoNo" TEXT NULL,
  "Mode" TEXT NOT NULL,
  "OriginFa" TEXT NULL,
  "DestinationFa" TEXT NULL,
  "EtaDate" TEXT NULL,
  "AtaDate" TEXT NULL,
  "CustomsStatus" TEXT NOT NULL DEFAULT 'pending',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmShipment" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmShipment_No" ON "ScmShipment" ("ProjectId", "ShipmentNo");


-- ScmPsr · d5 · گزارش پیشرفت خرید PSR
CREATE TABLE IF NOT EXISTS "ScmPsr" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PsrNo" TEXT NOT NULL,
  "PoNo" TEXT NULL,
  "PackageCode" TEXT NULL,
  "ProgressPct" NUMERIC NOT NULL,
  "ReportDate" TEXT NOT NULL,
  "StatusFa" TEXT NULL,
  "NextActionFa" TEXT NULL,
  "ReportedBy" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmPsr" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmPsr_No" ON "ScmPsr" ("ProjectId", "PsrNo");


-- ScmWarehouse · d5 · انبار
CREATE TABLE IF NOT EXISTS "ScmWarehouse" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "LocationFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmWarehouse" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmWarehouse_Code" ON "ScmWarehouse" ("ProjectId", "Code");


-- ScmMaterialCatalog · d5 · کاتالوگ کالا
CREATE TABLE IF NOT EXISTS "ScmMaterialCatalog" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Category" TEXT NULL,
  "Unit" TEXT NULL,
  "SpecFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmMaterialCatalog" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmMatCat_Code" ON "ScmMaterialCatalog" ("ProjectId", "Code");


-- ScmMrc · d5 · درخواست رزرو MRC
CREATE TABLE IF NOT EXISTS "ScmMrc" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MrcNo" TEXT NOT NULL,
  "RequestedBy" TEXT NOT NULL,
  "RequiredDate" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmMrc" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmMrc_No" ON "ScmMrc" ("ProjectId", "MrcNo");


-- ScmMrcLine · d5 · ردیف درخواست رزرو
CREATE TABLE IF NOT EXISTS "ScmMrcLine" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MrcId" TEXT NOT NULL,
  "MrcNo" TEXT NOT NULL,
  "MaterialCode" TEXT NOT NULL,
  "Quantity" NUMERIC NOT NULL,
  "ReservedQty" NUMERIC NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmMrcLine" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ScmMrcLine_Mrc" ON "ScmMrcLine" ("ProjectId", "MrcId");


-- ScmMiv · d5 · حواله خروج MIV
CREATE TABLE IF NOT EXISTS "ScmMiv" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MivNo" TEXT NOT NULL,
  "MrcNo" TEXT NULL,
  "WarehouseCode" TEXT NOT NULL,
  "IssuedBy" TEXT NOT NULL,
  "IssuedAt" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'issued',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmMiv" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmMiv_No" ON "ScmMiv" ("ProjectId", "MivNo");


-- ScmMivLine · d5 · ردیف حواله خروج
CREATE TABLE IF NOT EXISTS "ScmMivLine" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MivId" TEXT NOT NULL,
  "MivNo" TEXT NOT NULL,
  "MaterialCode" TEXT NOT NULL,
  "Quantity" NUMERIC NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmMivLine" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ScmMivLine_Miv" ON "ScmMivLine" ("ProjectId", "MivId");


-- ScmMrv · d5 · رسید عودت MRV
CREATE TABLE IF NOT EXISTS "ScmMrv" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MrvNo" TEXT NOT NULL,
  "MivNo" TEXT NULL,
  "WarehouseCode" TEXT NOT NULL,
  "ReturnedBy" TEXT NOT NULL,
  "ReturnedAt" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'returned',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmMrv" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmMrv_No" ON "ScmMrv" ("ProjectId", "MrvNo");


-- ScmStockTransfer · d5 · جابه‌جایی انبار
CREATE TABLE IF NOT EXISTS "ScmStockTransfer" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "TransferNo" TEXT NOT NULL,
  "FromWarehouse" TEXT NOT NULL,
  "ToWarehouse" TEXT NOT NULL,
  "MaterialCode" TEXT NOT NULL,
  "Quantity" NUMERIC NOT NULL,
  "TransferredBy" TEXT NOT NULL,
  "TransferredAt" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'completed',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmStockTransfer" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmTransfer_No" ON "ScmStockTransfer" ("ProjectId", "TransferNo");


-- ScmStockBalance · d5 · موجودی به تفکیک انبار
CREATE TABLE IF NOT EXISTS "ScmStockBalance" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "WarehouseCode" TEXT NOT NULL,
  "MaterialCode" TEXT NOT NULL,
  "OnHand" NUMERIC NOT NULL DEFAULT 0,
  "Reserved" NUMERIC NULL DEFAULT 0,
  "OnOrder" NUMERIC NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ScmStockBalance" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ScmStockBal" ON "ScmStockBalance" ("ProjectId", "WarehouseCode", "MaterialCode");


-- WorkPermit · d16 · پروانهٔ کار
CREATE TABLE IF NOT EXISTS "WorkPermit" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PermitNo" TEXT NOT NULL,
  "PermitType" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "SystemId" TEXT NULL,
  "ActivityId" TEXT NULL,
  "LocationFa" TEXT NULL,
  "RequestedBy" TEXT NOT NULL,
  "ValidFrom" TEXT NOT NULL,
  "ValidTo" TEXT NOT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ClosedBy" TEXT NULL,
  "ClosedAt" TEXT NULL,
  "SimopsRequired" INTEGER NOT NULL DEFAULT 0,
  "SimopsApprovedBy" TEXT NULL,
  "GasTestResultFa" TEXT NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "JsaId" TEXT NULL,
  "QrToken" TEXT NULL,
  "SuspendedAt" TEXT NULL,
  "SuspendedBy" TEXT NULL,
  "SuspendReasonFa" TEXT NULL,
  "ParentPermitId" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_WorkPermit" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_WorkPermit_No" ON "WorkPermit" ("ProjectId", "PermitNo");
CREATE INDEX "IX_WorkPermit_System" ON "WorkPermit" ("ProjectId", "SystemId", "Status");
CREATE INDEX "IX_WorkPermit_Validity" ON "WorkPermit" ("ProjectId", "Status", "ValidTo");
CREATE UNIQUE INDEX "UX_WorkPermit_Qr" ON "WorkPermit" ("QrToken");
CREATE INDEX "IX_WorkPermit_Jsa" ON "WorkPermit" ("JsaId");


-- SafetyIncident · d16 · رویداد ایمنی
CREATE TABLE IF NOT EXISTS "SafetyIncident" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "IncidentNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "IncidentType" TEXT NOT NULL,
  "OccurredAt" TEXT NOT NULL,
  "LocationFa" TEXT NULL,
  "SystemId" TEXT NULL,
  "ActivityId" TEXT NULL,
  "ReportedBy" TEXT NOT NULL,
  "InjuredPersonFa" TEXT NULL,
  "LostDays" INTEGER NULL,
  "RootCauseFa" TEXT NULL,
  "CorrectiveActionFa" TEXT NULL,
  "NcrRef" TEXT NULL,
  "ClosedAt" TEXT NULL,
  "ClosedBy" TEXT NULL,
  "Severity" TEXT NOT NULL,
  "Status" TEXT NOT NULL,
  "PermitId" TEXT NULL,
  "FlashReportAt" TEXT NULL,
  "IsEmergencyActivated" INTEGER NULL,
  "GpsLat" NUMERIC NULL,
  "GpsLng" NUMERIC NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SafetyIncident" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_SafetyIncident_No" ON "SafetyIncident" ("ProjectId", "IncidentNo");
CREATE INDEX "IX_SafetyIncident_Type" ON "SafetyIncident" ("ProjectId", "IncidentType", "OccurredAt");
CREATE INDEX "IX_SafetyIncident_Open" ON "SafetyIncident" ("ProjectId", "Status", "Severity");
CREATE INDEX "IX_SafetyIncident_Permit" ON "SafetyIncident" ("PermitId");


-- SafetyInspection · d16 · بازرسی ایمنی
CREATE TABLE IF NOT EXISTS "SafetyInspection" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "InspectionNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "InspectionType" TEXT NOT NULL,
  "InspectedAt" TEXT NOT NULL,
  "InspectedBy" TEXT NOT NULL,
  "AreaFa" TEXT NULL,
  "FindingsCount" INTEGER NULL,
  "ClosedFindings" INTEGER NULL,
  "ScorePct" NUMERIC NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SafetyInspection" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_SafetyInspection_No" ON "SafetyInspection" ("ProjectId", "InspectionNo");
CREATE INDEX "IX_SafetyInspection_Date" ON "SafetyInspection" ("ProjectId", "InspectedAt");


-- SafetyTrainingRecord · d16 · سابقهٔ آموزش ایمنی
CREATE TABLE IF NOT EXISTS "SafetyTrainingRecord" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PersonRef" TEXT NOT NULL,
  "CourseCode" TEXT NOT NULL,
  "CourseTitleFa" TEXT NOT NULL,
  "CompletedAt" TEXT NOT NULL,
  "ExpiresAt" TEXT NULL,
  "ScorePct" NUMERIC NULL,
  "CertificateNo" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_SafetyTrainingRecord" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_SafetyTraining" ON "SafetyTrainingRecord" ("ProjectId", "PersonRef", "CourseCode");
CREATE INDEX "IX_SafetyTraining_Expiry" ON "SafetyTrainingRecord" ("ProjectId", "ExpiresAt", "Status");


-- TrainingSession · d16 · جلسهٔ آموزش ایمنی
CREATE TABLE IF NOT EXISTS "TrainingSession" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SessionNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "CourseCode" TEXT NOT NULL,
  "TrainingType" TEXT NOT NULL,
  "HeldAt" TEXT NOT NULL,
  "DurationMinutes" INTEGER NOT NULL,
  "InstructorFa" TEXT NOT NULL,
  "LocationFa" TEXT NULL,
  "ContractorFa" TEXT NULL,
  "ValidityMonths" INTEGER NULL,
  "MaterialRef" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_TrainingSession" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_TrainingSession_No" ON "TrainingSession" ("ProjectId", "SessionNo");
CREATE INDEX "IX_TrainingSession_Date" ON "TrainingSession" ("ProjectId", "HeldAt", "TrainingType");


-- TrainingAttendee · d16 · حاضر در جلسهٔ آموزش
CREATE TABLE IF NOT EXISTS "TrainingAttendee" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SessionId" TEXT NOT NULL,
  "PersonRef" TEXT NOT NULL,
  "PersonNameFa" TEXT NOT NULL,
  "TradeCode" TEXT NULL,
  "ContractorFa" TEXT NULL,
  "Attended" INTEGER NOT NULL DEFAULT 0,
  "ScorePct" NUMERIC NULL,
  "Passed" INTEGER NOT NULL DEFAULT 0,
  "SignatureRef" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_TrainingAttendee" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_TrainingAttendee" ON "TrainingAttendee" ("SessionId", "PersonRef");
CREATE INDEX "IX_TrainingAttendee_Person" ON "TrainingAttendee" ("ProjectId", "PersonRef");


-- PpeIssuance · d16 · تحویل تجهیزات حفاظت فردی
CREATE TABLE IF NOT EXISTS "PpeIssuance" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "IssueNo" TEXT NOT NULL,
  "PersonRef" TEXT NOT NULL,
  "PersonNameFa" TEXT NOT NULL,
  "PpeType" TEXT NOT NULL,
  "IssuedAt" TEXT NOT NULL,
  "IssuedBy" TEXT NOT NULL,
  "Quantity" INTEGER NOT NULL DEFAULT 1,
  "SizeFa" TEXT NULL,
  "SerialNo" TEXT NULL,
  "ReplaceDueDate" TEXT NULL,
  "ReturnedAt" TEXT NULL,
  "UnitCost" NUMERIC NULL,
  "ContractorFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PpeIssuance" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PpeIssuance_No" ON "PpeIssuance" ("ProjectId", "IssueNo");
CREATE INDEX "IX_PpeIssuance_Person" ON "PpeIssuance" ("ProjectId", "PersonRef", "PpeType");
CREATE INDEX "IX_PpeIssuance_Replace" ON "PpeIssuance" ("ProjectId", "ReplaceDueDate", "Status");


-- OccupationalHazard · d16 · عامل زیان‌آور شغلی
CREATE TABLE IF NOT EXISTS "OccupationalHazard" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "HazardCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "HazardType" TEXT NOT NULL,
  "TradeCode" TEXT NULL,
  "ExposureLimitFa" TEXT NULL,
  "ExamIntervalMonths" INTEGER NOT NULL,
  "RequiredExamsFa" TEXT NULL,
  "RequiredPpeFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_OccupationalHazard" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_OccupationalHazard" ON "OccupationalHazard" ("ProjectId", "HazardCode");
CREATE INDEX "IX_OccupationalHazard_Trade" ON "OccupationalHazard" ("ProjectId", "TradeCode", "Status");


-- HealthExamination · d16 · معاینهٔ طب کار
CREATE TABLE IF NOT EXISTS "HealthExamination" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ExamNo" TEXT NOT NULL,
  "PersonRef" TEXT NOT NULL,
  "PersonNameFa" TEXT NOT NULL,
  "ExamType" TEXT NOT NULL,
  "ExaminedAt" TEXT NOT NULL,
  "Fitness" TEXT NOT NULL,
  "RestrictionFa" TEXT NULL,
  "HazardCode" TEXT NULL,
  "NextExamDate" TEXT NULL,
  "PhysicianFa" TEXT NULL,
  "ClinicFa" TEXT NULL,
  "ReportRef" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HealthExamination" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HealthExam_No" ON "HealthExamination" ("ProjectId", "ExamNo");
CREATE INDEX "IX_HealthExam_Person" ON "HealthExamination" ("ProjectId", "PersonRef", "ExamType");
CREATE INDEX "IX_HealthExam_Next" ON "HealthExamination" ("ProjectId", "NextExamDate", "Status");


-- WasteLog · d16 · سیاههٔ پسماند
CREATE TABLE IF NOT EXISTS "WasteLog" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "WasteNo" TEXT NOT NULL,
  "WasteType" TEXT NOT NULL,
  "DescriptionFa" TEXT NOT NULL,
  "Quantity" NUMERIC NOT NULL,
  "Unit" TEXT NOT NULL,
  "GeneratedAt" TEXT NOT NULL,
  "AreaFa" TEXT NULL,
  "DisposalMethod" TEXT NOT NULL,
  "ManifestNo" TEXT NULL,
  "CarrierFa" TEXT NULL,
  "DestinationFa" TEXT NULL,
  "DisposedAt" TEXT NULL,
  "CostAmount" NUMERIC NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_WasteLog" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_WasteLog_No" ON "WasteLog" ("ProjectId", "WasteNo");
CREATE INDEX "IX_WasteLog_Type" ON "WasteLog" ("ProjectId", "WasteType", "Status");
CREATE INDEX "IX_WasteLog_Date" ON "WasteLog" ("ProjectId", "GeneratedAt");


-- EnvironmentalMonitoring · d16 · پایش زیست‌محیطی
CREATE TABLE IF NOT EXISTS "EnvironmentalMonitoring" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ReadingNo" TEXT NOT NULL,
  "Medium" TEXT NOT NULL,
  "ParameterFa" TEXT NOT NULL,
  "MeasuredAt" TEXT NOT NULL,
  "MeasuredValue" NUMERIC NOT NULL,
  "Unit" TEXT NOT NULL,
  "LimitValue" NUMERIC NOT NULL,
  "LocationFa" TEXT NULL,
  "MethodFa" TEXT NULL,
  "LabFa" TEXT NULL,
  "CorrectiveActionFa" TEXT NULL,
  "ViolationId" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EnvironmentalMonitoring" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EnvMonitoring_No" ON "EnvironmentalMonitoring" ("ProjectId", "ReadingNo");
CREATE INDEX "IX_EnvMonitoring_Medium" ON "EnvironmentalMonitoring" ("ProjectId", "Medium", "MeasuredAt");


-- HSE_MetricSnapshot · d16 · عکس شاخص ایمنی
CREATE TABLE IF NOT EXISTS "HSE_MetricSnapshot" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "MetricCode" TEXT NOT NULL,
  "Value" NUMERIC NOT NULL,
  "Target" NUMERIC NULL,
  "Unit" TEXT NOT NULL,
  "CapturedAt" TEXT NOT NULL,
  "BaseManHours" NUMERIC NULL,
  "SampleSize" INTEGER NULL,
  "IsEstimated" INTEGER NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT draft,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HSE_MetricSnapshot" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HseMetric" ON "HSE_MetricSnapshot" ("ProjectId", "PeriodCode", "MetricCode");
CREATE INDEX "IX_HseMetric_Code" ON "HSE_MetricSnapshot" ("ProjectId", "MetricCode", "CapturedAt");


-- HSE_AlertRule · d16 · قاعدهٔ هشدار ایمنی
CREATE TABLE IF NOT EXISTS "HSE_AlertRule" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RuleCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Severity" TEXT NOT NULL,
  "Threshold" NUMERIC NOT NULL,
  "Comparison" TEXT NOT NULL,
  "IsEnabled" INTEGER NOT NULL DEFAULT 1,
  "MutedUntil" TEXT NULL,
  "MuteReasonFa" TEXT NULL,
  "OwnerRole" TEXT NULL,
  "ActionFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT active,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HSE_AlertRule" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HseAlertRule" ON "HSE_AlertRule" ("ProjectId", "RuleCode");


-- HSE_RiskAssessment · d16 · ارزیابی ریسک شغلی
CREATE TABLE IF NOT EXISTS "HSE_RiskAssessment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "JsaNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "ActivityId" TEXT NULL,
  "TemplateCode" TEXT NULL,
  "DisciplineCode" TEXT NULL,
  "LocationFa" TEXT NULL,
  "PreparedBy" TEXT NOT NULL,
  "PreparedAt" TEXT NOT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ValidUntil" TEXT NULL,
  "MaxResidualRisk" INTEGER NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HSE_RiskAssessment" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HseRiskAssessment_No" ON "HSE_RiskAssessment" ("ProjectId", "JsaNo");
CREATE INDEX "IX_HseRiskAssessment_Activity" ON "HSE_RiskAssessment" ("ProjectId", "ActivityId", "Status");
CREATE INDEX "IX_HseRiskAssessment_Valid" ON "HSE_RiskAssessment" ("ProjectId", "Status", "ValidUntil");


-- JSA_JobStep · d16 · گام کاری ارزیابی ریسک
CREATE TABLE IF NOT EXISTS "JSA_JobStep" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "JsaId" TEXT NOT NULL,
  "StepNo" INTEGER NOT NULL,
  "DescriptionFa" TEXT NOT NULL,
  "ResponsibleFa" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_JSA_JobStep" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_JsaJobStep" ON "JSA_JobStep" ("JsaId", "StepNo");
CREATE INDEX "IX_JsaJobStep_Jsa" ON "JSA_JobStep" ("JsaId");


-- JSA_Hazard · d16 · خطر گام کاری
CREATE TABLE IF NOT EXISTS "JSA_Hazard" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "JsaId" TEXT NOT NULL,
  "StepId" TEXT NOT NULL,
  "HazardNo" INTEGER NOT NULL,
  "HazardFa" TEXT NOT NULL,
  "HazardCategory" TEXT NULL,
  "Likelihood" INTEGER NOT NULL,
  "Severity" INTEGER NOT NULL,
  "InitialRisk" INTEGER NULL,
  "ResidualLikelihood" INTEGER NULL,
  "ResidualSeverity" INTEGER NULL,
  "ResidualRisk" INTEGER NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_JSA_Hazard" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_JsaHazard" ON "JSA_Hazard" ("StepId", "HazardNo");
CREATE INDEX "IX_JsaHazard_Jsa" ON "JSA_Hazard" ("JsaId");
CREATE INDEX "IX_JsaHazard_Risk" ON "JSA_Hazard" ("ProjectId", "ResidualRisk");


-- JSA_Control · d16 · کنترل خطر
CREATE TABLE IF NOT EXISTS "JSA_Control" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "JsaId" TEXT NOT NULL,
  "HazardId" TEXT NOT NULL,
  "ControlNo" INTEGER NOT NULL,
  "ControlLevel" TEXT NOT NULL,
  "ControlFa" TEXT NOT NULL,
  "ResponsibleFa" TEXT NULL,
  "VerifiedBy" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_JSA_Control" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_JsaControl" ON "JSA_Control" ("HazardId", "ControlNo");
CREATE INDEX "IX_JsaControl_Jsa" ON "JSA_Control" ("JsaId", "ControlLevel");


-- GasTestLog · d16 · سابقهٔ گازسنجی
CREATE TABLE IF NOT EXISTS "GasTestLog" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PermitId" TEXT NOT NULL,
  "TestedAt" TEXT NOT NULL,
  "LelPct" NUMERIC NULL,
  "OxygenPct" NUMERIC NULL,
  "H2sPpm" NUMERIC NULL,
  "CoPpm" NUMERIC NULL,
  "IsSafe" INTEGER NOT NULL DEFAULT 0,
  "BreachedFa" TEXT NULL,
  "TestedBy" TEXT NOT NULL,
  "DeviceSerial" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_GasTestLog" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_GasTestLog_Permit" ON "GasTestLog" ("PermitId", "TestedAt");
CREATE INDEX "IX_GasTestLog_Safe" ON "GasTestLog" ("ProjectId", "IsSafe", "TestedAt");


-- IsolationLog · d16 · سابقهٔ ایزولاسیون
CREATE TABLE IF NOT EXISTS "IsolationLog" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PermitId" TEXT NOT NULL,
  "IsolationNo" INTEGER NOT NULL,
  "IsolationType" TEXT NOT NULL,
  "PointTagFa" TEXT NOT NULL,
  "LockNo" TEXT NULL,
  "TagNo" TEXT NULL,
  "AppliedAt" TEXT NULL,
  "AppliedBy" TEXT NULL,
  "RemovedAt" TEXT NULL,
  "RemovedBy" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IsolationLog" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_IsolationLog" ON "IsolationLog" ("PermitId", "IsolationNo");
CREATE INDEX "IX_IsolationLog_Status" ON "IsolationLog" ("ProjectId", "Status");


-- PTW_Approval · d16 · امضای پروانهٔ کار
CREATE TABLE IF NOT EXISTS "PTW_Approval" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PermitId" TEXT NOT NULL,
  "ApprovalLevel" TEXT NOT NULL,
  "ApproverRef" TEXT NOT NULL,
  "SignedAt" TEXT NOT NULL,
  "DecisionFa" TEXT NOT NULL,
  "CommentFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PTW_Approval" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PtwApproval" ON "PTW_Approval" ("PermitId", "ApprovalLevel");
CREATE INDEX "IX_PtwApproval_Approver" ON "PTW_Approval" ("ProjectId", "ApproverRef");


-- PTW_Precaution · d16 · اقدام احتیاطی پروانه
CREATE TABLE IF NOT EXISTS "PTW_Precaution" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PermitId" TEXT NOT NULL,
  "PrecautionNo" INTEGER NOT NULL,
  "PrecautionFa" TEXT NOT NULL,
  "IsMandatory" INTEGER NOT NULL DEFAULT 1,
  "IsConfirmed" INTEGER NULL,
  "ConfirmedBy" TEXT NULL,
  "ConfirmedAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PTW_Precaution" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PtwPrecaution" ON "PTW_Precaution" ("PermitId", "PrecautionNo");
CREATE INDEX "IX_PtwPrecaution_Pending" ON "PTW_Precaution" ("ProjectId", "IsConfirmed");


-- InjuredPerson · d16 · فرد مصدوم
CREATE TABLE IF NOT EXISTS "InjuredPerson" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "IncidentId" TEXT NOT NULL,
  "PersonNo" INTEGER NOT NULL,
  "PersonRef" TEXT NULL,
  "FullNameFa" TEXT NOT NULL,
  "CompanyFa" TEXT NULL,
  "InjuryType" TEXT NOT NULL,
  "BodyPart" TEXT NULL,
  "LostWorkDays" INTEGER NULL,
  "RestrictedDays" INTEGER NULL,
  "ReturnedToWork" INTEGER NULL,
  "ReturnedAt" TEXT NULL,
  "TreatmentFa" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_InjuredPerson" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_InjuredPerson" ON "InjuredPerson" ("IncidentId", "PersonNo");
CREATE INDEX "IX_InjuredPerson_Incident" ON "InjuredPerson" ("IncidentId");
CREATE INDEX "IX_InjuredPerson_Person" ON "InjuredPerson" ("ProjectId", "PersonRef");


-- HSE_Investigation · d16 · تحقیق حادثه
CREATE TABLE IF NOT EXISTS "HSE_Investigation" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "IncidentId" TEXT NOT NULL,
  "LeadInvestigator" TEXT NOT NULL,
  "TeamFa" TEXT NULL,
  "StartedAt" TEXT NOT NULL,
  "CompletedAt" TEXT NULL,
  "MethodFa" TEXT NULL,
  "SummaryFa" TEXT NULL,
  "DirectCost" NUMERIC NULL,
  "IndirectCost" NUMERIC NULL,
  "LessonsLearnedFa" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HSE_Investigation" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HseInvestigation" ON "HSE_Investigation" ("IncidentId");
CREATE INDEX "IX_HseInvestigation_Status" ON "HSE_Investigation" ("ProjectId", "Status");


-- RootCauseNode · d16 · گره ریشه‌یابی
CREATE TABLE IF NOT EXISTS "RootCauseNode" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "InvestigationId" TEXT NOT NULL,
  "NodeNo" INTEGER NOT NULL,
  "ParentId" TEXT NULL,
  "Depth" INTEGER NOT NULL,
  "StatementFa" TEXT NOT NULL,
  "CauseLevel" TEXT NOT NULL,
  "Category" TEXT NULL,
  "EvidenceFa" TEXT NULL,
  "IsVerified" INTEGER NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_RootCauseNode" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_RootCauseNode" ON "RootCauseNode" ("InvestigationId", "NodeNo");
CREATE INDEX "IX_RootCauseNode_Parent" ON "RootCauseNode" ("ParentId");
CREATE INDEX "IX_RootCauseNode_Level" ON "RootCauseNode" ("InvestigationId", "CauseLevel");


-- CapaAction · d16 · اقدام اصلاحی و پیشگیرانه
CREATE TABLE IF NOT EXISTS "CapaAction" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SourceType" TEXT NOT NULL,
  "SourceId" TEXT NOT NULL,
  "ActionNo" INTEGER NOT NULL,
  "ActionFa" TEXT NOT NULL,
  "ActionType" TEXT NOT NULL,
  "RootCauseNodeId" TEXT NULL,
  "OwnerRef" TEXT NOT NULL,
  "DueDate" TEXT NOT NULL,
  "CompletedAt" TEXT NULL,
  "VerifiedBy" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "EffectivenessFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CapaAction" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CapaAction" ON "CapaAction" ("SourceType", "SourceId", "ActionNo");
CREATE INDEX "IX_CapaAction_Owner" ON "CapaAction" ("ProjectId", "OwnerRef", "Status");
CREATE INDEX "IX_CapaAction_Due" ON "CapaAction" ("ProjectId", "Status", "DueDate");


-- HSE_ManHourLog · d16 · سابقهٔ نفرساعت ایمنی
CREATE TABLE IF NOT EXISTS "HSE_ManHourLog" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "LogDate" TEXT NOT NULL,
  "ManHours" NUMERIC NOT NULL,
  "HeadCount" INTEGER NULL,
  "ContractorFa" TEXT NOT NULL DEFAULT 'کل پروژه',
  "SourceFa" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HSE_ManHourLog" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HseManHourLog" ON "HSE_ManHourLog" ("ProjectId", "LogDate", "ContractorFa");
CREATE INDEX "IX_HseManHourLog_Date" ON "HSE_ManHourLog" ("ProjectId", "LogDate");


-- InspectionFinding · d16 · یافتهٔ بازرسی
CREATE TABLE IF NOT EXISTS "InspectionFinding" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "InspectionId" TEXT NOT NULL,
  "FindingNo" INTEGER NOT NULL,
  "DescriptionFa" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "Severity" TEXT NOT NULL,
  "AreaFa" TEXT NULL,
  "ActivityId" TEXT NULL,
  "PhotoRef" TEXT NULL,
  "OwnerRef" TEXT NULL,
  "DueDate" TEXT NULL,
  "ClosedAt" TEXT NULL,
  "ClosedBy" TEXT NULL,
  "ClosureNoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_InspectionFinding" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_InspectionFinding" ON "InspectionFinding" ("InspectionId", "FindingNo");
CREATE INDEX "IX_InspectionFinding_Status" ON "InspectionFinding" ("ProjectId", "Status");
CREATE INDEX "IX_InspectionFinding_Activity" ON "InspectionFinding" ("ProjectId", "ActivityId");


-- HSE_Violation · d16 · تخلف ایمنی و توقف کار
CREATE TABLE IF NOT EXISTS "HSE_Violation" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ViolationNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "ViolationType" TEXT NOT NULL,
  "Severity" TEXT NOT NULL,
  "IssuedAt" TEXT NOT NULL,
  "IssuedBy" TEXT NOT NULL,
  "AreaFa" TEXT NULL,
  "ActivityId" TEXT NULL,
  "SystemId" TEXT NULL,
  "PermitId" TEXT NULL,
  "InspectionId" TEXT NULL,
  "FindingId" TEXT NULL,
  "ContractorFa" TEXT NULL,
  "OffenderRef" TEXT NULL,
  "IsStopWork" INTEGER NOT NULL DEFAULT 0,
  "StopWorkScope" TEXT NULL,
  "FineAmount" NUMERIC NULL,
  "GpsLat" NUMERIC NULL,
  "GpsLng" NUMERIC NULL,
  "CorrectiveRequestFa" TEXT NULL,
  "DueDate" TEXT NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HSE_Violation" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HseViolation_No" ON "HSE_Violation" ("ProjectId", "ViolationNo");
CREATE INDEX "IX_HseViolation_Stop" ON "HSE_Violation" ("ProjectId", "IsStopWork", "Status");
CREATE INDEX "IX_HseViolation_Activity" ON "HSE_Violation" ("ProjectId", "ActivityId", "Status");
CREATE INDEX "IX_HseViolation_Inspection" ON "HSE_Violation" ("ProjectId", "InspectionId");


-- ViolationClosure · d16 · آزادسازی تخلف
CREATE TABLE IF NOT EXISTS "ViolationClosure" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ViolationId" TEXT NOT NULL,
  "AttemptNo" INTEGER NOT NULL,
  "ReInspectedAt" TEXT NOT NULL,
  "ReInspectedBy" TEXT NOT NULL,
  "IsSatisfactory" INTEGER NOT NULL DEFAULT 0,
  "EvidenceFa" TEXT NULL,
  "PhotoRef" TEXT NULL,
  "ReleasedBy" TEXT NULL,
  "ReleasedAt" TEXT NULL,
  "RejectReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ViolationClosure" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_ViolationClosure" ON "ViolationClosure" ("ViolationId", "AttemptNo");
CREATE INDEX "IX_ViolationClosure_Violation" ON "ViolationClosure" ("ProjectId", "ViolationId");


-- CtrDocument · d2 · سند قرارداد بارگذاری‌شده
CREATE TABLE IF NOT EXISTS "CtrDocument" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractId" TEXT NULL,
  "FileName" TEXT NOT NULL,
  "MimeType" TEXT NOT NULL,
  "SizeBytes" INTEGER NOT NULL DEFAULT 0,
  "ContentHash" TEXT NOT NULL,
  "StoredPath" TEXT NULL,
  "PageCount" INTEGER NOT NULL DEFAULT 0,
  "ExtractStatus" TEXT NOT NULL DEFAULT 'pending',
  "ExtractedText" TEXT NULL,
  "ExtractErrorFa" TEXT NULL,
  "UploadedBy" TEXT NOT NULL,
  "UploadedAt" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CtrDocument" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_CtrDocument_Project" ON "CtrDocument" ("ProjectId", "UploadedAt");
CREATE UNIQUE INDEX "UX_CtrDocument_Hash" ON "CtrDocument" ("ProjectId", "ContentHash");


-- CtrClause · d2 · بند قرارداد
CREATE TABLE IF NOT EXISTS "CtrClause" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NOT NULL,
  "ClauseNo" TEXT NOT NULL,
  "ParentClauseNo" TEXT NULL,
  "Depth" INTEGER NOT NULL DEFAULT 1,
  "TitleFa" TEXT NULL,
  "BodyText" TEXT NOT NULL,
  "PageNo" INTEGER NOT NULL DEFAULT 0,
  "CharStart" INTEGER NOT NULL DEFAULT 0,
  "CharEnd" INTEGER NOT NULL DEFAULT 0,
  "Ordinal" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CtrClause" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_CtrClause_Doc" ON "CtrClause" ("ProjectId", "DocumentId", "Ordinal");
CREATE UNIQUE INDEX "UX_CtrClause_No" ON "CtrClause" ("DocumentId", "ClauseNo");


-- CtrBoqDraft · d2 · قلم BoQ استخراجی
CREATE TABLE IF NOT EXISTS "CtrBoqDraft" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NOT NULL,
  "ClauseId" TEXT NULL,
  "ItemNo" TEXT NOT NULL,
  "ParentItemNo" TEXT NULL,
  "ChapterCode" TEXT NULL,
  "TitleFa" TEXT NOT NULL,
  "Unit" TEXT NULL,
  "Qty" NUMERIC NULL,
  "UnitRate" NUMERIC NULL,
  "LumpSumAmount" NUMERIC NULL,
  "PricingBasis" TEXT NOT NULL DEFAULT 'unit_price',
  "Currency" TEXT NULL,
  "ExtractedBy" TEXT NOT NULL DEFAULT 'rule',
  "ProviderId" TEXT NULL,
  "Confidence" INTEGER NOT NULL DEFAULT 0,
  "SourceRefFa" TEXT NULL,
  "PageNo" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "ReviewedBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "PromotedToBoqId" TEXT NULL,
  "Ordinal" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CtrBoqDraft" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_CtrBoqDraft_Doc" ON "CtrBoqDraft" ("ProjectId", "DocumentId", "Ordinal");
CREATE UNIQUE INDEX "UX_CtrBoqDraft_Item" ON "CtrBoqDraft" ("DocumentId", "ItemNo");
CREATE INDEX "IX_CtrBoqDraft_Status" ON "CtrBoqDraft" ("ProjectId", "Status");


-- BreakdownNode · d2 · گرهٔ ساختار شکست
CREATE TABLE IF NOT EXISTS "BreakdownNode" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocumentId" TEXT NULL,
  "ViewKind" TEXT NOT NULL DEFAULT 'wbs',
  "Code" TEXT NOT NULL,
  "ParentCode" TEXT NULL,
  "Depth" INTEGER NOT NULL DEFAULT 1,
  "TitleFa" TEXT NOT NULL,
  "TitleEn" TEXT NULL,
  "Unit" TEXT NULL,
  "Qty" NUMERIC NULL,
  "Amount" NUMERIC NULL,
  "WeightFactor" NUMERIC NULL,
  "WeightValue" NUMERIC NULL,
  "CostAccountCode" TEXT NULL,
  "BoqDraftId" TEXT NULL,
  "ClauseId" TEXT NULL,
  "SourceRefFa" TEXT NULL,
  "GeneratedBy" TEXT NOT NULL DEFAULT 'rule',
  "ProviderId" TEXT NULL,
  "Confidence" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "Ordinal" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_BreakdownNode" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_BreakdownNode_View" ON "BreakdownNode" ("ProjectId", "ViewKind", "Ordinal");
CREATE UNIQUE INDEX "UX_BreakdownNode_Code" ON "BreakdownNode" ("ProjectId", "ViewKind", "Code");
CREATE INDEX "IX_BreakdownNode_Parent" ON "BreakdownNode" ("ProjectId", "ViewKind", "ParentCode");


-- BreakdownColumnDef · d2 · ستون دلخواه ساختار شکست
CREATE TABLE IF NOT EXISTS "BreakdownColumnDef" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ViewKind" TEXT NOT NULL DEFAULT 'pms',
  "ColumnKey" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "TitleEn" TEXT NULL,
  "DataKind" TEXT NOT NULL DEFAULT 'text',
  "Unit" TEXT NULL,
  "RollsUp" INTEGER NOT NULL DEFAULT 0,
  "Ordinal" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_BreakdownColumnDef" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_BreakdownColumnDef" ON "BreakdownColumnDef" ("ProjectId", "ViewKind", "ColumnKey");
CREATE INDEX "IX_BreakdownColumnDef_View" ON "BreakdownColumnDef" ("ProjectId", "ViewKind", "Ordinal");


-- BreakdownValue · d2 · مقدار ستون دلخواه
CREATE TABLE IF NOT EXISTS "BreakdownValue" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "NodeId" TEXT NOT NULL,
  "ColumnKey" TEXT NOT NULL,
  "ValueText" TEXT NULL,
  "ValueNumber" NUMERIC NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_BreakdownValue" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_BreakdownValue" ON "BreakdownValue" ("NodeId", "ColumnKey");
CREATE INDEX "IX_BreakdownValue_Project" ON "BreakdownValue" ("ProjectId", "ColumnKey");


-- CpmWorkArea · d2 · حوزهٔ کاری پیمانکار
CREATE TABLE IF NOT EXISTS "CpmWorkArea" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "WbsCode" TEXT NOT NULL,
  "ContractorCode" TEXT NOT NULL,
  "Discipline" TEXT NOT NULL,
  "ScopeFa" TEXT NOT NULL,
  "PackageNo" TEXT NULL,
  "StartDate" TEXT NULL,
  "EndDate" TEXT NULL,
  "WeightPct" NUMERIC NULL,
  "Status" TEXT NOT NULL DEFAULT 'planned',
  "NoteFa" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CpmWorkArea" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CpmWorkArea_Code" ON "CpmWorkArea" ("ProjectId", "Code");
CREATE INDEX "IX_CpmWorkArea_Wbs" ON "CpmWorkArea" ("ProjectId", "WbsCode");
CREATE INDEX "IX_CpmWorkArea_Contractor" ON "CpmWorkArea" ("ProjectId", "ContractorCode");


-- CpmDprEntry · d2 · گزارش روزانهٔ پیمانکار
CREATE TABLE IF NOT EXISTS "CpmDprEntry" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ReportNo" TEXT NOT NULL,
  "ReportDate" TEXT NOT NULL,
  "Shift" TEXT NOT NULL DEFAULT 'day',
  "ContractorCode" TEXT NOT NULL,
  "Discipline" TEXT NOT NULL,
  "WorkAreaCode" TEXT NULL,
  "LocationFa" TEXT NOT NULL,
  "WeatherFa" TEXT NULL,
  "ManpowerCount" INTEGER NOT NULL,
  "EquipmentCount" INTEGER NULL,
  "WorkDoneFa" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "NoteFa" TEXT NULL,
  "SubmittedAt" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ReturnNoteFa" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CpmDprEntry" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CpmDpr_No" ON "CpmDprEntry" ("ProjectId", "ReportNo");
CREATE INDEX "IX_CpmDpr_Date" ON "CpmDprEntry" ("ProjectId", "ReportDate");


-- CpmDisciplineReport · d2 · گزارش دیسیپلینی
CREATE TABLE IF NOT EXISTS "CpmDisciplineReport" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ReportNo" TEXT NOT NULL,
  "ReportDate" TEXT NOT NULL,
  "Discipline" TEXT NOT NULL,
  "ContractorCode" TEXT NOT NULL,
  "WorkAreaCode" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "NoteFa" TEXT NULL,
  "LineCount" INTEGER NULL,
  "RejectedCount" INTEGER NULL,
  "NdtPassRate" NUMERIC NULL,
  "SubmittedAt" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ReturnNoteFa" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CpmDisciplineReport" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CpmDiscReport_No" ON "CpmDisciplineReport" ("ProjectId", "ReportNo");
CREATE INDEX "IX_CpmDiscReport_Date" ON "CpmDisciplineReport" ("ProjectId", "ReportDate");


-- CpmDisciplineLine · d2 · خط گزارش دیسیپلینی
CREATE TABLE IF NOT EXISTS "CpmDisciplineLine" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ReportNo" TEXT NOT NULL,
  "ItemRef" TEXT NOT NULL,
  "ItemType" TEXT NOT NULL,
  "SizeInch" NUMERIC NULL,
  "Quantity" NUMERIC NOT NULL,
  "Unit" TEXT NOT NULL DEFAULT 'ea',
  "ResultCode" TEXT NOT NULL DEFAULT 'na',
  "NdtMethod" TEXT NULL,
  "TestDate" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CpmDisciplineLine" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CpmDiscLine_Ref" ON "CpmDisciplineLine" ("ProjectId", "ReportNo", "ItemRef");
CREATE INDEX "IX_CpmDiscLine_Type" ON "CpmDisciplineLine" ("ProjectId", "ItemType");


-- CpmInspectionRequest · d8 · درخواست بازرسی و آزادسازی QC
CREATE TABLE IF NOT EXISTS "CpmInspectionRequest" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RequestNo" TEXT NOT NULL,
  "RequestType" TEXT NOT NULL DEFAULT 'ir',
  "ActivityCode" TEXT NOT NULL,
  "WorkAreaCode" TEXT NULL,
  "Discipline" TEXT NOT NULL,
  "ContractorCode" TEXT NOT NULL,
  "LocationFa" TEXT NOT NULL,
  "ScopeFa" TEXT NOT NULL,
  "RequestedAt" TEXT NOT NULL,
  "TargetDate" TEXT NULL,
  "WitnessRequired" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "NcrRef" TEXT NULL,
  "NoteFa" TEXT NULL,
  "RequestedBy" TEXT NULL,
  "SubmittedAt" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "ReleasedAt" TEXT NULL,
  "ReleasedBy" TEXT NULL,
  "RejectedAt" TEXT NULL,
  "RejectedBy" TEXT NULL,
  "CancelledAt" TEXT NULL,
  "CancelledBy" TEXT NULL,
  "DecisionNoteFa" TEXT NULL,
  "InspectionRecordId" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CpmInspectionRequest" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CpmInspection_No" ON "CpmInspectionRequest" ("ProjectId", "RequestNo");
CREATE INDEX "IX_CpmInspection_Status" ON "CpmInspectionRequest" ("ProjectId", "Status");
CREATE INDEX "IX_CpmInspection_Activity" ON "CpmInspectionRequest" ("ProjectId", "ActivityCode");


-- CpmDprAttachment · d2 · پیوست گزارش روزانه
CREATE TABLE IF NOT EXISTS "CpmDprAttachment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ReportNo" TEXT NOT NULL,
  "Kind" TEXT NOT NULL DEFAULT 'attachment',
  "FileName" TEXT NOT NULL,
  "MimeType" TEXT NOT NULL,
  "SizeBytes" INTEGER NOT NULL,
  "Checksum" TEXT NULL,
  "StoredName" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "UploadedBy" TEXT NULL,
  "UploadedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CpmDprAttachment" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CpmDprAtt_Stored" ON "CpmDprAttachment" ("StoredName");
CREATE INDEX "IX_CpmDprAtt_Report" ON "CpmDprAttachment" ("ProjectId", "ReportNo");


-- PmoCharter · d6 · منشور پروژه
CREATE TABLE IF NOT EXISTS "PmoCharter" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CharterNo" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "SponsorFa" TEXT NOT NULL,
  "ManagerFa" TEXT NULL,
  "ObjectivesJson" TEXT NOT NULL,
  "ScopeInFa" TEXT NOT NULL,
  "ScopeOutFa" TEXT NULL,
  "MilestonesJson" TEXT NOT NULL,
  "BudgetAmount" NUMERIC NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "RisksJson" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "SubmittedAt" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ReturnedAt" TEXT NULL,
  "ReturnedBy" TEXT NULL,
  "ReturnNoteFa" TEXT NULL,
  "SupersededAt" TEXT NULL,
  "SupersededBy" TEXT NULL,
  "SupersededByCharterNo" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmoCharter" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmoCharter_No" ON "PmoCharter" ("ProjectId", "CharterNo");
CREATE INDEX "IX_PmoCharter_Status" ON "PmoCharter" ("ProjectId", "Status");


-- PmoFormDefinition · d6 · تعریف فرم مصوب
CREATE TABLE IF NOT EXISTS "PmoFormDefinition" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "PurposeFa" TEXT NOT NULL,
  "FieldsJson" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "Version" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "PublishedAt" TEXT NULL,
  "PublishedBy" TEXT NULL,
  "RetiredAt" TEXT NULL,
  "RetiredBy" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmoFormDefinition" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_PmoFormDefinition_Code" ON "PmoFormDefinition" ("ProjectId", "Code");
CREATE INDEX "IX_PmoFormDefinition_Status" ON "PmoFormDefinition" ("ProjectId", "Status");


-- PmoFormEntry · d6 · رکورد فرم
CREATE TABLE IF NOT EXISTS "PmoFormEntry" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "FormCode" TEXT NOT NULL,
  "FormVersion" INTEGER NOT NULL,
  "SubjectFa" TEXT NOT NULL,
  "DataJson" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "NoteFa" TEXT NULL,
  "SubmittedAt" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ReturnedAt" TEXT NULL,
  "ReturnedBy" TEXT NULL,
  "ReturnNoteFa" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmoFormEntry" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_PmoFormEntry_Form" ON "PmoFormEntry" ("ProjectId", "FormCode", "FormVersion");
CREATE INDEX "IX_PmoFormEntry_Status" ON "PmoFormEntry" ("ProjectId", "Status");


-- PmoHealthAssessment · d6 · کارت سلامت پروژه
CREATE TABLE IF NOT EXISTS "PmoHealthAssessment" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "AsOfDate" TEXT NOT NULL,
  "PeriodNo" INTEGER NULL,
  "CriteriaJson" TEXT NOT NULL,
  "ScoreTotal" NUMERIC NULL,
  "Band" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "NoteFa" TEXT NULL,
  "SubmittedAt" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "ApprovedNoteFa" TEXT NULL,
  "ReturnedAt" TEXT NULL,
  "ReturnedBy" TEXT NULL,
  "ReturnNoteFa" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_PmoHealthAssessment" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_PmoHealthAssessment_Date" ON "PmoHealthAssessment" ("ProjectId", "AsOfDate");
CREATE INDEX "IX_PmoHealthAssessment_Status" ON "PmoHealthAssessment" ("ProjectId", "Status");


-- RptTemplate · d3 · قالب گزارش سفارشی
CREATE TABLE IF NOT EXISTS "RptTemplate" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DatasetKey" TEXT NOT NULL,
  "FieldsJson" TEXT NOT NULL,
  "FiltersJson" TEXT NULL,
  "GroupJson" TEXT NULL,
  "SortJson" TEXT NULL,
  "ChartJson" TEXT NULL,
  "LimitRows" INTEGER NULL DEFAULT 500,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "Version" INTEGER NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "PublishedAt" TEXT NULL,
  "PublishedBy" TEXT NULL,
  "RetiredAt" TEXT NULL,
  "RetiredBy" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_RptTemplate" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_RptTemplate_Code" ON "RptTemplate" ("ProjectId", "Code");
CREATE INDEX "IX_RptTemplate_Status" ON "RptTemplate" ("ProjectId", "Status", "DatasetKey");


-- ItgConnectorRun · core · اجرای اتصال‌دهندهٔ خروجی
CREATE TABLE IF NOT EXISTS "ItgConnectorRun" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Connector" TEXT NOT NULL,
  "Direction" TEXT NOT NULL DEFAULT 'out',
  "Status" TEXT NOT NULL DEFAULT 'queued',
  "ItemCount" INTEGER NULL,
  "PayloadBytes" INTEGER NULL,
  "Endpoint" TEXT NULL,
  "DurationMs" INTEGER NULL,
  "ErrorCode" TEXT NULL,
  "ErrorFa" TEXT NULL,
  "ActorId" TEXT NOT NULL,
  "StartedAt" TEXT NOT NULL,
  "FinishedAt" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_ItgConnectorRun" PRIMARY KEY ("Id")
);
CREATE INDEX "IX_ItgConnectorRun_Project" ON "ItgConnectorRun" ("ProjectId", "Connector", "StartedAt");
CREATE INDEX "IX_ItgConnectorRun_Status" ON "ItgConnectorRun" ("Status", "StartedAt");


-- AiInteraction · core · پرسش و پاسخ دستیار هوشمند
CREATE TABLE IF NOT EXISTS "AiInteraction" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "QuestionFa" TEXT NOT NULL,
  "Tool" TEXT NOT NULL,
  "State" TEXT NOT NULL,
  "ParamsJson" TEXT NULL,
  "AnswerFa" TEXT NOT NULL,
  "FactsJson" TEXT NULL,
  "TableJson" TEXT NULL,
  "ChartJson" TEXT NULL,
  "SourcesJson" TEXT NOT NULL,
  "RowCount" INTEGER NOT NULL DEFAULT 0,
  "Truncated" INTEGER NOT NULL DEFAULT 0,
  "Provider" TEXT NULL,
  "NarrationFa" TEXT NULL,
  "LatencyMs" INTEGER NULL,
  "ActorId" TEXT NOT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_AiInteraction" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_AiInteraction_Code" ON "AiInteraction" ("ProjectId", "Code");
CREATE INDEX "IX_AiInteraction_Actor" ON "AiInteraction" ("ProjectId", "ActorId", "CreatedAt");
CREATE INDEX "IX_AiInteraction_Tool" ON "AiInteraction" ("ProjectId", "Tool", "CreatedAt");


-- CntIpcTemplate · d14 · قالب صورت‌وضعیت
CREATE TABLE IF NOT EXISTS "CntIpcTemplate" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "ContractCode" TEXT NULL,
  "ItemsJson" TEXT NOT NULL,
  "DeductionsJson" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "Version" INTEGER NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "PublishedAt" TEXT NULL,
  "PublishedBy" TEXT NULL,
  "RetiredAt" TEXT NULL,
  "RetiredBy" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CntIpcTemplate" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CntIpcTemplate_Code" ON "CntIpcTemplate" ("ProjectId", "Code");
CREATE INDEX "IX_CntIpcTemplate_Status" ON "CntIpcTemplate" ("ProjectId", "Status");


-- CntIpcCertificate · d14 · صورت‌وضعیت دوره
CREATE TABLE IF NOT EXISTS "CntIpcCertificate" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "TemplateCode" TEXT NOT NULL,
  "TemplateVersion" INTEGER NOT NULL DEFAULT 0,
  "ContractCode" TEXT NULL,
  "PeriodNo" INTEGER NOT NULL,
  "PeriodFrom" TEXT NOT NULL,
  "PeriodTo" TEXT NOT NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "InputsJson" TEXT NOT NULL,
  "ComputationJson" TEXT NULL,
  "GrossAmount" NUMERIC NULL,
  "DeductionTotal" NUMERIC NULL,
  "NetAmount" NUMERIC NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "NoteFa" TEXT NULL,
  "SubmittedAt" TEXT NULL,
  "SubmittedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "SignedNoteFa" TEXT NULL,
  "ReturnedAt" TEXT NULL,
  "ReturnedBy" TEXT NULL,
  "ReturnNoteFa" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CntIpcCertificate" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_CntIpcCertificate_Period" ON "CntIpcCertificate" ("ProjectId", "TemplateCode", "PeriodNo");
CREATE INDEX "IX_CntIpcCertificate_Status" ON "CntIpcCertificate" ("ProjectId", "Status");


-- MfgPart · mfg · قطعه و محصول
CREATE TABLE IF NOT EXISTS "MfgPart" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "PartNo" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "PartType" TEXT NOT NULL,
  "BaseUom" TEXT NOT NULL,
  "DescriptionFa" TEXT NULL,
  "StandardUnitCost" NUMERIC NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "IsLotTracked" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgPart" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_MfgPart_Type" CHECK (PartType IN ('manufactured','purchased','phantom','subcontract')),
  CONSTRAINT "CK_MfgPart_Cost" CHECK (StandardUnitCost IS NULL OR StandardUnitCost >= 0)
);
CREATE UNIQUE INDEX "UX_MfgPart_PlantNo" ON "MfgPart" ("PlantId", "PartNo");
CREATE INDEX "IX_MfgPart_Type" ON "MfgPart" ("PlantId", "PartType", "IsActive");


-- MfgBomHeader · mfg · نسخهٔ BOM
CREATE TABLE IF NOT EXISTS "MfgBomHeader" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "Revision" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "BaseQuantity" NUMERIC NOT NULL DEFAULT 1,
  "BaseUom" TEXT NOT NULL,
  "EffectiveFrom" TEXT NOT NULL,
  "EffectiveTo" TEXT NULL,
  "IsDefault" INTEGER NOT NULL DEFAULT 0,
  "ReleasedAt" TEXT NULL,
  "ReleasedBy" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgBomHeader" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgBomHeader_PartId" FOREIGN KEY ("PartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgBomHeader_Status" CHECK (Status IN ('draft','released','obsolete')),
  CONSTRAINT "CK_MfgBomHeader_BaseQty" CHECK (BaseQuantity > 0),
  CONSTRAINT "CK_MfgBomHeader_Dates" CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
  CONSTRAINT "CK_MfgBomHeader_Release" CHECK (Status <> 'released' OR (ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL))
);
CREATE UNIQUE INDEX "UX_MfgBomHeader_Revision" ON "MfgBomHeader" ("PlantId", "PartId", "Revision");
CREATE INDEX "IX_MfgBomHeader_Effective" ON "MfgBomHeader" ("PlantId", "PartId", "Status", "EffectiveFrom");


-- MfgBomItem · mfg · ردیف BOM
CREATE TABLE IF NOT EXISTS "MfgBomItem" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "BomHeaderId" TEXT NOT NULL,
  "LineNo" INTEGER NOT NULL,
  "ComponentPartId" TEXT NOT NULL,
  "QuantityPer" NUMERIC NOT NULL,
  "Uom" TEXT NOT NULL,
  "ScrapPct" NUMERIC NOT NULL,
  "IssueAtOperationCode" TEXT NULL,
  "IssueMethod" TEXT NOT NULL DEFAULT 'manual',
  "IsPhantom" INTEGER NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgBomItem" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgBomItem_BomHeaderId" FOREIGN KEY ("BomHeaderId") REFERENCES "MfgBomHeader" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgBomItem_ComponentPartId" FOREIGN KEY ("ComponentPartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgBomItem_Line" CHECK (LineNo > 0),
  CONSTRAINT "CK_MfgBomItem_Qty" CHECK (QuantityPer > 0),
  CONSTRAINT "CK_MfgBomItem_Scrap" CHECK (ScrapPct >= 0 AND ScrapPct <= 100),
  CONSTRAINT "CK_MfgBomItem_Issue" CHECK (IssueMethod IN ('manual','backflush','kit'))
);
CREATE UNIQUE INDEX "UX_MfgBomItem_Line" ON "MfgBomItem" ("BomHeaderId", "LineNo");
CREATE INDEX "IX_MfgBomItem_Component" ON "MfgBomItem" ("PlantId", "ComponentPartId");


-- MfgCostCenter · mfg · مرکز هزینهٔ تولید
CREATE TABLE IF NOT EXISTS "MfgCostCenter" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "CostElement" TEXT NOT NULL,
  "HourlyRate" NUMERIC NOT NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "AllocationBasis" TEXT NOT NULL DEFAULT 'machine_hours',
  "EffectiveFrom" TEXT NOT NULL,
  "EffectiveTo" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgCostCenter" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_MfgCostCenter_Element" CHECK (CostElement IN ('machine','labor','overhead')),
  CONSTRAINT "CK_MfgCostCenter_Rate" CHECK (HourlyRate >= 0),
  CONSTRAINT "CK_MfgCostCenter_Basis" CHECK (AllocationBasis IN ('machine_hours','labor_hours','units','percent')),
  CONSTRAINT "CK_MfgCostCenter_Dates" CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX "UX_MfgCostCenter_Rate" ON "MfgCostCenter" ("PlantId", "Code", "EffectiveFrom");
CREATE INDEX "IX_MfgCostCenter_Element" ON "MfgCostCenter" ("PlantId", "CostElement", "IsActive");


-- MfgWorkCenter · mfg · مرکز کاری
CREATE TABLE IF NOT EXISTS "MfgWorkCenter" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "Kind" TEXT NOT NULL,
  "NominalCapacityMinutesPerDay" INTEGER NOT NULL DEFAULT 480,
  "EfficiencyPct" NUMERIC NOT NULL,
  "CostCenterId" TEXT NULL,
  "TimeZoneId" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "DescriptionFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgWorkCenter" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgWorkCenter_CostCenterId" FOREIGN KEY ("CostCenterId") REFERENCES "MfgCostCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgWorkCenter_Kind" CHECK (Kind IN ('machine','labor','assembly','inspection')),
  CONSTRAINT "CK_MfgWorkCenter_Capacity" CHECK (NominalCapacityMinutesPerDay > 0),
  CONSTRAINT "CK_MfgWorkCenter_Efficiency" CHECK (EfficiencyPct >= 0 AND EfficiencyPct <= 100),
  CONSTRAINT "CK_MfgWorkCenter_Status" CHECK (Status IN ('active','inactive','maintenance'))
);
CREATE UNIQUE INDEX "UX_MfgWorkCenter_Code" ON "MfgWorkCenter" ("PlantId", "Code");
CREATE INDEX "IX_MfgWorkCenter_Status" ON "MfgWorkCenter" ("PlantId", "Status", "Kind");


-- MfgWorkCenterResource · mfg · منبع مرکز کاری
CREATE TABLE IF NOT EXISTS "MfgWorkCenterResource" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "WorkCenterId" TEXT NOT NULL,
  "ResourceCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "ResourceKind" TEXT NOT NULL,
  "CapacityUnits" NUMERIC NOT NULL,
  "AvailabilityPct" NUMERIC NOT NULL,
  "EquipmentId" TEXT NULL,
  "CostCenterId" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "EffectiveFrom" TEXT NULL,
  "EffectiveTo" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgWorkCenterResource" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgWorkCenterResource_WorkCenterId" FOREIGN KEY ("WorkCenterId") REFERENCES "MfgWorkCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgWorkCenterResource_CostCenterId" FOREIGN KEY ("CostCenterId") REFERENCES "MfgCostCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgWcResource_Kind" CHECK (ResourceKind IN ('machine','labor')),
  CONSTRAINT "CK_MfgWcResource_Capacity" CHECK (CapacityUnits > 0),
  CONSTRAINT "CK_MfgWcResource_Availability" CHECK (AvailabilityPct >= 0 AND AvailabilityPct <= 100),
  CONSTRAINT "CK_MfgWcResource_Dates" CHECK (EffectiveTo IS NULL OR EffectiveFrom IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX "UX_MfgWcResource_Code" ON "MfgWorkCenterResource" ("WorkCenterId", "ResourceCode");
CREATE INDEX "IX_MfgWcResource_Active" ON "MfgWorkCenterResource" ("PlantId", "WorkCenterId", "IsActive");


-- MfgWorkCenterCalendar · mfg · تقویم و شیفت مرکز کاری
CREATE TABLE IF NOT EXISTS "MfgWorkCenterCalendar" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "WorkCenterId" TEXT NOT NULL,
  "RuleType" TEXT NOT NULL,
  "RuleKey" TEXT NOT NULL,
  "WeekdayIso" INTEGER NULL,
  "CalendarDate" TEXT NULL,
  "ShiftCode" TEXT NOT NULL,
  "StartMinuteOfDay" INTEGER NULL,
  "EndMinuteOfDay" INTEGER NULL,
  "BreakMinutes" INTEGER NOT NULL DEFAULT 0,
  "BreakStartMinuteOfDay" INTEGER NULL,
  "IsWorking" INTEGER NOT NULL DEFAULT 1,
  "AvailabilityPct" NUMERIC NOT NULL,
  "EffectiveFrom" TEXT NOT NULL,
  "EffectiveTo" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgWorkCenterCalendar" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgWorkCenterCalendar_WorkCenterId" FOREIGN KEY ("WorkCenterId") REFERENCES "MfgWorkCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgWcCalendar_Type" CHECK (RuleType IN ('weekly','date-override')),
  CONSTRAINT "CK_MfgWcCalendar_KeyShape" CHECK ((RuleType = 'weekly' AND WeekdayIso IS NOT NULL AND WeekdayIso BETWEEN 1 AND 7 AND CalendarDate IS NULL) OR (RuleType = 'date-override' AND WeekdayIso IS NULL AND CalendarDate IS NOT NULL)),
  CONSTRAINT "CK_MfgWcCalendar_Shift" CHECK ((IsWorking = 1 AND StartMinuteOfDay IS NOT NULL AND EndMinuteOfDay IS NOT NULL AND StartMinuteOfDay BETWEEN 0 AND 1439 AND EndMinuteOfDay > StartMinuteOfDay AND EndMinuteOfDay <= 2879 AND BreakMinutes >= 0 AND BreakMinutes <= EndMinuteOfDay - StartMinuteOfDay) OR (IsWorking = 0 AND StartMinuteOfDay IS NULL AND EndMinuteOfDay IS NULL)),
  CONSTRAINT "CK_MfgWcCalendar_BreakStart" CHECK (BreakStartMinuteOfDay IS NULL OR (IsWorking = 1 AND BreakMinutes > 0 AND BreakStartMinuteOfDay >= StartMinuteOfDay AND BreakStartMinuteOfDay + BreakMinutes <= EndMinuteOfDay)),
  CONSTRAINT "CK_MfgWcCalendar_Break" CHECK (BreakMinutes >= 0),
  CONSTRAINT "CK_MfgWcCalendar_Availability" CHECK (AvailabilityPct >= 0 AND AvailabilityPct <= 100),
  CONSTRAINT "CK_MfgWcCalendar_Dates" CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX "UX_MfgWcCalendar_Rule" ON "MfgWorkCenterCalendar" ("WorkCenterId", "RuleKey");
CREATE INDEX "IX_MfgWcCalendar_Date" ON "MfgWorkCenterCalendar" ("PlantId", "WorkCenterId", "CalendarDate");


-- MfgRouting · mfg · مسیر تولید
CREATE TABLE IF NOT EXISTS "MfgRouting" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "RoutingCode" TEXT NOT NULL,
  "Revision" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "BaseQuantity" NUMERIC NOT NULL DEFAULT 1,
  "BaseUom" TEXT NOT NULL,
  "EffectiveFrom" TEXT NOT NULL,
  "EffectiveTo" TEXT NULL,
  "IsDefault" INTEGER NOT NULL DEFAULT 0,
  "ReleasedAt" TEXT NULL,
  "ReleasedBy" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgRouting" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgRouting_PartId" FOREIGN KEY ("PartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgRouting_Status" CHECK (Status IN ('draft','released','obsolete')),
  CONSTRAINT "CK_MfgRouting_BaseQty" CHECK (BaseQuantity > 0),
  CONSTRAINT "CK_MfgRouting_Dates" CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
  CONSTRAINT "CK_MfgRouting_Release" CHECK (Status <> 'released' OR (ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL))
);
CREATE UNIQUE INDEX "UX_MfgRouting_Revision" ON "MfgRouting" ("PlantId", "PartId", "RoutingCode", "Revision");
CREATE INDEX "IX_MfgRouting_Effective" ON "MfgRouting" ("PlantId", "PartId", "Status", "EffectiveFrom");


-- MfgRoutingOperation · mfg · عملیات مسیر تولید
CREATE TABLE IF NOT EXISTS "MfgRoutingOperation" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "RoutingId" TEXT NOT NULL,
  "SequenceNo" INTEGER NOT NULL,
  "OperationCode" TEXT NOT NULL,
  "OperationNameFa" TEXT NOT NULL,
  "OperationNameEn" TEXT NULL,
  "WorkCenterId" TEXT NOT NULL,
  "SetupMinutes" NUMERIC NOT NULL,
  "RunMinutesPerUnit" NUMERIC NOT NULL,
  "QueueMinutes" NUMERIC NOT NULL,
  "MoveMinutes" NUMERIC NOT NULL,
  "OverlapAllowed" INTEGER NOT NULL DEFAULT 0,
  "TransferBatchQty" NUMERIC NULL,
  "SplitLotCount" INTEGER NULL,
  "OverlapPct" NUMERIC NULL,
  "PredecessorSequence" INTEGER NULL,
  "InspectionRequired" INTEGER NOT NULL DEFAULT 0,
  "CostCenterId" TEXT NULL,
  "WorkInstructionRef" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgRoutingOperation" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgRoutingOperation_RoutingId" FOREIGN KEY ("RoutingId") REFERENCES "MfgRouting" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgRoutingOperation_WorkCenterId" FOREIGN KEY ("WorkCenterId") REFERENCES "MfgWorkCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgRoutingOperation_CostCenterId" FOREIGN KEY ("CostCenterId") REFERENCES "MfgCostCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgRoutingOp_Sequence" CHECK (SequenceNo > 0),
  CONSTRAINT "CK_MfgRoutingOp_Times" CHECK (SetupMinutes >= 0 AND RunMinutesPerUnit >= 0 AND QueueMinutes >= 0 AND MoveMinutes >= 0),
  CONSTRAINT "CK_MfgRoutingOp_Overlap" CHECK (OverlapAllowed = 0 OR (TransferBatchQty IS NOT NULL AND TransferBatchQty > 0) OR (OverlapPct IS NOT NULL AND OverlapPct > 0 AND OverlapPct < 100)),
  CONSTRAINT "CK_MfgRoutingOp_Split" CHECK (SplitLotCount IS NULL OR SplitLotCount >= 1),
  CONSTRAINT "CK_MfgRoutingOp_Predecessor" CHECK (PredecessorSequence IS NULL OR (PredecessorSequence > 0 AND PredecessorSequence < SequenceNo))
);
CREATE UNIQUE INDEX "UX_MfgRoutingOp_Seq" ON "MfgRoutingOperation" ("RoutingId", "SequenceNo");
CREATE INDEX "IX_MfgRoutingOp_WorkCenter" ON "MfgRoutingOperation" ("PlantId", "WorkCenterId", "OperationCode");


-- MfgProductionOrder · mfg · سفارش تولید
CREATE TABLE IF NOT EXISTS "MfgProductionOrder" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "OrderNo" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "OrderQuantity" NUMERIC NOT NULL,
  "Uom" TEXT NOT NULL,
  "DueAt" TEXT NOT NULL,
  "RequestedStartAt" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'created',
  "PriorityRule" TEXT NOT NULL DEFAULT 'EDD',
  "ManualRank" INTEGER NULL,
  "DispatchWeight" NUMERIC NOT NULL DEFAULT 1,
  "DemandSource" TEXT NOT NULL,
  "DemandRef" TEXT NULL,
  "CustomerRef" TEXT NULL,
  "CustomerNameSnapshot" TEXT NULL,
  "ContractId" TEXT NULL,
  "ProjectId" TEXT NULL,
  "BomHeaderId" TEXT NULL,
  "RoutingId" TEXT NULL,
  "BomRevisionSnapshot" TEXT NULL,
  "RoutingRevisionSnapshot" TEXT NULL,
  "ReleasedAt" TEXT NULL,
  "ReleasedBy" TEXT NULL,
  "CompletedAt" TEXT NULL,
  "ClosedAt" TEXT NULL,
  "ClosedBy" TEXT NULL,
  "AllowOverrun" INTEGER NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgProductionOrder" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgProductionOrder_PartId" FOREIGN KEY ("PartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgProductionOrder_BomHeaderId" FOREIGN KEY ("BomHeaderId") REFERENCES "MfgBomHeader" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgProductionOrder_RoutingId" FOREIGN KEY ("RoutingId") REFERENCES "MfgRouting" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgProdOrder_Qty" CHECK (OrderQuantity > 0),
  CONSTRAINT "CK_MfgProdOrder_Status" CHECK (Status IN ('created','released','in-progress','completed','closed')),
  CONSTRAINT "CK_MfgProdOrder_Priority" CHECK (PriorityRule IN ('EDD','CR','MANUAL')),
  CONSTRAINT "CK_MfgProdOrder_DispatchWeight" CHECK (DispatchWeight > 0),
  CONSTRAINT "CK_MfgProdOrder_Demand" CHECK (DemandSource IN ('sales-order','contract','forecast','manual','mrp')),
  CONSTRAINT "CK_MfgProdOrder_Rank" CHECK (ManualRank IS NULL OR ManualRank >= 0),
  CONSTRAINT "CK_MfgProdOrder_Release" CHECK (Status = 'created' OR (BomHeaderId IS NOT NULL AND RoutingId IS NOT NULL AND ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL))
);
CREATE UNIQUE INDEX "UX_MfgProdOrder_No" ON "MfgProductionOrder" ("PlantId", "OrderNo");
CREATE INDEX "IX_MfgProdOrder_Dispatch" ON "MfgProductionOrder" ("PlantId", "Status", "DueAt", "PriorityRule");
CREATE INDEX "IX_MfgProdOrder_Part" ON "MfgProductionOrder" ("PlantId", "PartId", "Status");
CREATE INDEX "IX_MfgProdOrder_Contract" ON "MfgProductionOrder" ("ContractId", "Status");


-- MfgProductionOrderOperation · mfg · عملیات سفارش تولید
CREATE TABLE IF NOT EXISTS "MfgProductionOrderOperation" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ProductionOrderId" TEXT NOT NULL,
  "RoutingOperationId" TEXT NULL,
  "SequenceNo" INTEGER NOT NULL,
  "OperationCode" TEXT NOT NULL,
  "OperationNameFa" TEXT NOT NULL,
  "WorkCenterId" TEXT NOT NULL,
  "PredecessorOperationId" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'pending',
  "PlannedQuantity" NUMERIC NOT NULL,
  "PlannedSetupMinutes" NUMERIC NOT NULL,
  "PlannedRunMinutesPerUnit" NUMERIC NOT NULL,
  "PlannedQueueMinutes" NUMERIC NOT NULL,
  "PlannedMoveMinutes" NUMERIC NOT NULL,
  "PlannedCapacityMinutes" NUMERIC NOT NULL,
  "OverlapAllowed" INTEGER NOT NULL DEFAULT 0,
  "TransferBatchQty" NUMERIC NULL,
  "SplitLotCount" INTEGER NULL,
  "OverlapPct" NUMERIC NULL,
  "InspectionRequired" INTEGER NOT NULL DEFAULT 0,
  "BlockedReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgProductionOrderOperation" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgProductionOrderOperation_ProductionOrderId" FOREIGN KEY ("ProductionOrderId") REFERENCES "MfgProductionOrder" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgProductionOrderOperation_RoutingOperationId" FOREIGN KEY ("RoutingOperationId") REFERENCES "MfgRoutingOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgProductionOrderOperation_WorkCenterId" FOREIGN KEY ("WorkCenterId") REFERENCES "MfgWorkCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgProductionOrderOperation_PredecessorOperationId" FOREIGN KEY ("PredecessorOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgOrderOp_Sequence" CHECK (SequenceNo > 0),
  CONSTRAINT "CK_MfgOrderOp_Status" CHECK (Status IN ('pending','queued','ready','setup','running','blocked','completed')),
  CONSTRAINT "CK_MfgOrderOp_Qty" CHECK (PlannedQuantity > 0),
  CONSTRAINT "CK_MfgOrderOp_Times" CHECK (PlannedSetupMinutes >= 0 AND PlannedRunMinutesPerUnit >= 0 AND PlannedQueueMinutes >= 0 AND PlannedMoveMinutes >= 0 AND PlannedCapacityMinutes >= 0),
  CONSTRAINT "CK_MfgOrderOp_Overlap" CHECK (OverlapAllowed = 0 OR (TransferBatchQty IS NOT NULL AND TransferBatchQty > 0) OR (OverlapPct IS NOT NULL AND OverlapPct > 0 AND OverlapPct < 100)),
  CONSTRAINT "CK_MfgOrderOp_Split" CHECK (SplitLotCount IS NULL OR SplitLotCount >= 1)
);
CREATE UNIQUE INDEX "UX_MfgOrderOp_Sequence" ON "MfgProductionOrderOperation" ("ProductionOrderId", "SequenceNo");
CREATE INDEX "IX_MfgOrderOp_Queue" ON "MfgProductionOrderOperation" ("PlantId", "WorkCenterId", "Status", "SequenceNo");
CREATE INDEX "IX_MfgOrderOp_OrderStatus" ON "MfgProductionOrderOperation" ("ProductionOrderId", "Status");


-- MfgOperationSchedule · mfg · قطعهٔ زمان‌بندی عملیات
CREATE TABLE IF NOT EXISTS "MfgOperationSchedule" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ProductionOrderOperationId" TEXT NOT NULL,
  "ScheduleVersion" INTEGER NOT NULL,
  "SegmentNo" INTEGER NOT NULL,
  "WorkCenterId" TEXT NOT NULL,
  "ResourceId" TEXT NULL,
  "PlannedStartAt" TEXT NOT NULL,
  "PlannedEndAt" TEXT NOT NULL,
  "PlannedCapacityMinutes" NUMERIC NOT NULL,
  "QueueMinutes" NUMERIC NOT NULL,
  "MoveMinutes" NUMERIC NOT NULL,
  "CapacityMode" TEXT NOT NULL,
  "Direction" TEXT NOT NULL,
  "DispatchRule" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'tentative',
  "CommittedAt" TEXT NULL,
  "CommittedBy" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgOperationSchedule" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgOperationSchedule_ProductionOrderOperationId" FOREIGN KEY ("ProductionOrderOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgOperationSchedule_WorkCenterId" FOREIGN KEY ("WorkCenterId") REFERENCES "MfgWorkCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgOperationSchedule_ResourceId" FOREIGN KEY ("ResourceId") REFERENCES "MfgWorkCenterResource" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgOpSchedule_Version" CHECK (ScheduleVersion > 0 AND SegmentNo > 0),
  CONSTRAINT "CK_MfgOpSchedule_Window" CHECK (PlannedEndAt > PlannedStartAt),
  CONSTRAINT "CK_MfgOpSchedule_Times" CHECK (PlannedCapacityMinutes >= 0 AND QueueMinutes >= 0 AND MoveMinutes >= 0),
  CONSTRAINT "CK_MfgOpSchedule_Mode" CHECK (CapacityMode IN ('finite','semi-finite')),
  CONSTRAINT "CK_MfgOpSchedule_Direction" CHECK (Direction IN ('forward','backward')),
  CONSTRAINT "CK_MfgOpSchedule_Status" CHECK (Status IN ('tentative','firm','cancelled'))
);
CREATE UNIQUE INDEX "UX_MfgOpSchedule_Segment" ON "MfgOperationSchedule" ("ProductionOrderOperationId", "ScheduleVersion", "SegmentNo");
CREATE INDEX "IX_MfgOpSchedule_WcWindow" ON "MfgOperationSchedule" ("PlantId", "WorkCenterId", "PlannedStartAt", "PlannedEndAt", "Status");


-- MfgCapacityPlan · mfg · برنامهٔ ظرفیت مرکز کاری
CREATE TABLE IF NOT EXISTS "MfgCapacityPlan" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "WorkCenterId" TEXT NOT NULL,
  "ScheduleVersion" INTEGER NOT NULL,
  "PeriodStart" TEXT NOT NULL,
  "PeriodEnd" TEXT NOT NULL,
  "AvailableMinutes" NUMERIC NOT NULL,
  "PlannedLoadMinutes" NUMERIC NOT NULL,
  "ReservedMinutes" NUMERIC NOT NULL,
  "UtilizationPct" NUMERIC NULL,
  "OverloadMinutes" NUMERIC NOT NULL,
  "IsBottleneck" INTEGER NOT NULL DEFAULT 0,
  "CalculatedAt" TEXT NOT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgCapacityPlan" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgCapacityPlan_WorkCenterId" FOREIGN KEY ("WorkCenterId") REFERENCES "MfgWorkCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgCapacityPlan_Period" CHECK (PeriodEnd > PeriodStart),
  CONSTRAINT "CK_MfgCapacityPlan_Load" CHECK (ScheduleVersion > 0 AND AvailableMinutes >= 0 AND PlannedLoadMinutes >= 0 AND ReservedMinutes >= 0 AND OverloadMinutes >= 0 AND ((AvailableMinutes = 0 AND UtilizationPct IS NULL) OR (AvailableMinutes > 0 AND UtilizationPct IS NOT NULL AND UtilizationPct >= 0)))
);
CREATE UNIQUE INDEX "UX_MfgCapacityPlan_Bucket" ON "MfgCapacityPlan" ("PlantId", "WorkCenterId", "ScheduleVersion", "PeriodStart", "PeriodEnd");
CREATE INDEX "IX_MfgCapacityPlan_Bottleneck" ON "MfgCapacityPlan" ("PlantId", "IsBottleneck", "PeriodStart");


-- MfgOperationExecution · mfg · اجرای واقعی عملیات
CREATE TABLE IF NOT EXISTS "MfgOperationExecution" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ProductionOrderOperationId" TEXT NOT NULL,
  "ExecutionNo" INTEGER NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'running',
  "ResourceId" TEXT NULL,
  "OperatorId" TEXT NULL,
  "StartedAt" TEXT NOT NULL,
  "FinishedAt" TEXT NULL,
  "SetupActualMinutes" NUMERIC NOT NULL,
  "RunActualMinutes" NUMERIC NOT NULL,
  "InputQuantity" NUMERIC NOT NULL,
  "GoodQuantity" NUMERIC NOT NULL,
  "ReworkQuantity" NUMERIC NOT NULL,
  "ScrapQuantity" NUMERIC NOT NULL,
  "IdempotencyKey" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgOperationExecution" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgOperationExecution_ProductionOrderOperationId" FOREIGN KEY ("ProductionOrderOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgOperationExecution_ResourceId" FOREIGN KEY ("ResourceId") REFERENCES "MfgWorkCenterResource" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgExecution_No" CHECK (ExecutionNo > 0),
  CONSTRAINT "CK_MfgExecution_Status" CHECK (Status IN ('running','completed','cancelled')),
  CONSTRAINT "CK_MfgExecution_Times" CHECK (SetupActualMinutes >= 0 AND RunActualMinutes >= 0),
  CONSTRAINT "CK_MfgExecution_Qty" CHECK (InputQuantity >= 0 AND GoodQuantity >= 0 AND ReworkQuantity >= 0 AND ScrapQuantity >= 0 AND GoodQuantity + ReworkQuantity + ScrapQuantity <= InputQuantity),
  CONSTRAINT "CK_MfgExecution_Finish" CHECK (FinishedAt IS NULL OR FinishedAt >= StartedAt),
  CONSTRAINT "CK_MfgExecution_Completed" CHECK (Status <> 'completed' OR FinishedAt IS NOT NULL)
);
CREATE UNIQUE INDEX "UX_MfgExecution_No" ON "MfgOperationExecution" ("ProductionOrderOperationId", "ExecutionNo");
CREATE UNIQUE INDEX "UX_MfgExecution_Idempotency" ON "MfgOperationExecution" ("IdempotencyKey");
CREATE INDEX "IX_MfgExecution_Started" ON "MfgOperationExecution" ("PlantId", "StartedAt", "Status");


-- MfgDowntimeLog · mfg · ثبت توقف
CREATE TABLE IF NOT EXISTS "MfgDowntimeLog" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "WorkCenterId" TEXT NOT NULL,
  "ProductionOrderOperationId" TEXT NULL,
  "ExecutionId" TEXT NULL,
  "ResourceId" TEXT NULL,
  "StartedAt" TEXT NOT NULL,
  "FinishedAt" TEXT NULL,
  "DurationMinutes" NUMERIC NOT NULL,
  "DowntimeType" TEXT NOT NULL,
  "ReasonCode" TEXT NOT NULL,
  "RecordedBy" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgDowntimeLog" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgDowntimeLog_WorkCenterId" FOREIGN KEY ("WorkCenterId") REFERENCES "MfgWorkCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgDowntimeLog_ProductionOrderOperationId" FOREIGN KEY ("ProductionOrderOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgDowntimeLog_ExecutionId" FOREIGN KEY ("ExecutionId") REFERENCES "MfgOperationExecution" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgDowntimeLog_ResourceId" FOREIGN KEY ("ResourceId") REFERENCES "MfgWorkCenterResource" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgDowntime_Type" CHECK (DowntimeType IN ('planned','unplanned')),
  CONSTRAINT "CK_MfgDowntime_Duration" CHECK (DurationMinutes IS NULL OR DurationMinutes >= 0),
  CONSTRAINT "CK_MfgDowntime_Window" CHECK (FinishedAt IS NULL OR FinishedAt >= StartedAt)
);
CREATE INDEX "IX_MfgDowntime_WcTime" ON "MfgDowntimeLog" ("PlantId", "WorkCenterId", "StartedAt");
CREATE INDEX "IX_MfgDowntime_Operation" ON "MfgDowntimeLog" ("ProductionOrderOperationId", "StartedAt");


-- MfgScrapRecord · mfg · ثبت ضایعات
CREATE TABLE IF NOT EXISTS "MfgScrapRecord" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ProductionOrderOperationId" TEXT NOT NULL,
  "ExecutionId" TEXT NULL,
  "Quantity" NUMERIC NOT NULL,
  "Uom" TEXT NOT NULL,
  "ReasonCode" TEXT NOT NULL,
  "Disposition" TEXT NOT NULL,
  "CostAmount" NUMERIC NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "RecordedAt" TEXT NOT NULL,
  "RecordedBy" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgScrapRecord" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgScrapRecord_ProductionOrderOperationId" FOREIGN KEY ("ProductionOrderOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgScrapRecord_ExecutionId" FOREIGN KEY ("ExecutionId") REFERENCES "MfgOperationExecution" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgScrap_Qty" CHECK (Quantity > 0),
  CONSTRAINT "CK_MfgScrap_Disposition" CHECK (Disposition IN ('scrapped','returned-to-stock','use-as-is')),
  CONSTRAINT "CK_MfgScrap_Cost" CHECK (CostAmount IS NULL OR CostAmount >= 0)
);
CREATE INDEX "IX_MfgScrap_Operation" ON "MfgScrapRecord" ("PlantId", "ProductionOrderOperationId", "RecordedAt");
CREATE INDEX "IX_MfgScrap_Reason" ON "MfgScrapRecord" ("PlantId", "ReasonCode", "RecordedAt");


-- MfgReworkRecord · mfg · ثبت دوباره‌کاری
CREATE TABLE IF NOT EXISTS "MfgReworkRecord" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ReworkNo" TEXT NOT NULL,
  "SourceOperationId" TEXT NOT NULL,
  "ExecutionId" TEXT NULL,
  "TargetOperationId" TEXT NULL,
  "ScrapRecordId" TEXT NULL,
  "Quantity" NUMERIC NOT NULL,
  "Uom" TEXT NOT NULL,
  "ReasonCode" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'open',
  "StartedAt" TEXT NULL,
  "FinishedAt" TEXT NULL,
  "Disposition" TEXT NULL,
  "ActualCost" NUMERIC NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgReworkRecord" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgReworkRecord_SourceOperationId" FOREIGN KEY ("SourceOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgReworkRecord_TargetOperationId" FOREIGN KEY ("TargetOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgReworkRecord_ExecutionId" FOREIGN KEY ("ExecutionId") REFERENCES "MfgOperationExecution" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgReworkRecord_ScrapRecordId" FOREIGN KEY ("ScrapRecordId") REFERENCES "MfgScrapRecord" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgRework_Qty" CHECK (Quantity > 0),
  CONSTRAINT "CK_MfgRework_Status" CHECK (Status IN ('open','in-progress','completed','cancelled')),
  CONSTRAINT "CK_MfgRework_Window" CHECK (FinishedAt IS NULL OR (StartedAt IS NOT NULL AND FinishedAt >= StartedAt)),
  CONSTRAINT "CK_MfgRework_Cost" CHECK (ActualCost IS NULL OR ActualCost >= 0)
);
CREATE UNIQUE INDEX "UX_MfgRework_No" ON "MfgReworkRecord" ("PlantId", "ReworkNo");
CREATE INDEX "IX_MfgRework_Source" ON "MfgReworkRecord" ("PlantId", "SourceOperationId", "Status");


-- MfgMaterial · mfg · مادهٔ قابل برنامه‌ریزی
CREATE TABLE IF NOT EXISTS "MfgMaterial" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "ProcurementType" TEXT NOT NULL,
  "LeadTimeDays" INTEGER NOT NULL DEFAULT 0,
  "SafetyStockQty" NUMERIC NOT NULL,
  "LotSize" NUMERIC NOT NULL,
  "OrderMultiple" NUMERIC NOT NULL,
  "ShelfLifeDays" INTEGER NULL,
  "StandardUnitCost" NUMERIC NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "DefaultWarehouseCode" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgMaterial" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgMaterial_PartId" FOREIGN KEY ("PartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgMaterial_Type" CHECK (ProcurementType IN ('make','buy')),
  CONSTRAINT "CK_MfgMaterial_Lead" CHECK (LeadTimeDays >= 0 AND (ShelfLifeDays IS NULL OR ShelfLifeDays >= 0)),
  CONSTRAINT "CK_MfgMaterial_Quantities" CHECK (SafetyStockQty >= 0 AND LotSize > 0 AND OrderMultiple > 0),
  CONSTRAINT "CK_MfgMaterial_Cost" CHECK (StandardUnitCost IS NULL OR StandardUnitCost >= 0)
);
CREATE UNIQUE INDEX "UX_MfgMaterial_Part" ON "MfgMaterial" ("PlantId", "PartId");
CREATE INDEX "IX_MfgMaterial_Replenish" ON "MfgMaterial" ("PlantId", "ProcurementType", "IsActive");


-- MfgMaterialRequirement · mfg · نیاز مواد
CREATE TABLE IF NOT EXISTS "MfgMaterialRequirement" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ProductionOrderId" TEXT NOT NULL,
  "ProductionOrderOperationId" TEXT NULL,
  "BomItemId" TEXT NOT NULL,
  "MaterialId" TEXT NOT NULL,
  "RequirementKey" TEXT NOT NULL,
  "RequiredAt" TEXT NOT NULL,
  "GrossQuantity" NUMERIC NOT NULL,
  "ScrapAllowanceQty" NUMERIC NOT NULL,
  "NetQuantity" NUMERIC NOT NULL,
  "AvailableQuantity" NUMERIC NOT NULL,
  "ReservedQuantity" NUMERIC NOT NULL,
  "ShortageQuantity" NUMERIC NOT NULL,
  "Uom" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'planned',
  "ScheduleVersion" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgMaterialRequirement" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgMaterialRequirement_ProductionOrderId" FOREIGN KEY ("ProductionOrderId") REFERENCES "MfgProductionOrder" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgMaterialRequirement_ProductionOrderOperationId" FOREIGN KEY ("ProductionOrderOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgMaterialRequirement_BomItemId" FOREIGN KEY ("BomItemId") REFERENCES "MfgBomItem" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgMaterialRequirement_MaterialId" FOREIGN KEY ("MaterialId") REFERENCES "MfgMaterial" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgMatReq_Status" CHECK (Status IN ('planned','shortage','reserved','issued','closed','cancelled')),
  CONSTRAINT "CK_MfgMatReq_Qty" CHECK (GrossQuantity >= 0 AND ScrapAllowanceQty >= 0 AND NetQuantity >= 0 AND AvailableQuantity >= 0 AND ReservedQuantity >= 0 AND ShortageQuantity >= 0),
  CONSTRAINT "CK_MfgMatReq_Version" CHECK (ScheduleVersion > 0)
);
CREATE UNIQUE INDEX "UX_MfgMatReq_Key" ON "MfgMaterialRequirement" ("PlantId", "RequirementKey");
CREATE INDEX "IX_MfgMatReq_Shortage" ON "MfgMaterialRequirement" ("PlantId", "Status", "RequiredAt", "MaterialId");
CREATE INDEX "IX_MfgMatReq_Order" ON "MfgMaterialRequirement" ("ProductionOrderId", "RequiredAt");


-- MfgMaterialConsumption · mfg · مصرف واقعی مواد
CREATE TABLE IF NOT EXISTS "MfgMaterialConsumption" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ProductionOrderOperationId" TEXT NOT NULL,
  "RequirementId" TEXT NULL,
  "ExecutionId" TEXT NULL,
  "MaterialId" TEXT NOT NULL,
  "Quantity" NUMERIC NOT NULL,
  "Uom" TEXT NOT NULL,
  "LotNo" TEXT NULL,
  "UnitCost" NUMERIC NOT NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "ConsumptionMethod" TEXT NOT NULL,
  "ConsumedAt" TEXT NOT NULL,
  "IdempotencyKey" TEXT NOT NULL,
  "PostedBy" TEXT NOT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgMaterialConsumption" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgMaterialConsumption_ProductionOrderOperationId" FOREIGN KEY ("ProductionOrderOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgMaterialConsumption_RequirementId" FOREIGN KEY ("RequirementId") REFERENCES "MfgMaterialRequirement" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgMaterialConsumption_ExecutionId" FOREIGN KEY ("ExecutionId") REFERENCES "MfgOperationExecution" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgMaterialConsumption_MaterialId" FOREIGN KEY ("MaterialId") REFERENCES "MfgMaterial" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgMatConsumption_Qty" CHECK (Quantity > 0),
  CONSTRAINT "CK_MfgMatConsumption_Cost" CHECK (UnitCost >= 0),
  CONSTRAINT "CK_MfgMatConsumption_Method" CHECK (ConsumptionMethod IN ('manual','backflush','issue'))
);
CREATE UNIQUE INDEX "UX_MfgMatConsumption_Idem" ON "MfgMaterialConsumption" ("IdempotencyKey");
CREATE INDEX "IX_MfgMatConsumption_Operation" ON "MfgMaterialConsumption" ("PlantId", "ProductionOrderOperationId", "ConsumedAt");
CREATE INDEX "IX_MfgMatConsumption_Material" ON "MfgMaterialConsumption" ("PlantId", "MaterialId", "ConsumedAt");


-- MfgInventoryLevel · mfg · سطح موجودی مواد
CREATE TABLE IF NOT EXISTS "MfgInventoryLevel" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "MaterialId" TEXT NOT NULL,
  "WarehouseCode" TEXT NOT NULL,
  "LocationCode" TEXT NOT NULL DEFAULT '',
  "LotNo" TEXT NOT NULL DEFAULT '',
  "InventoryKey" TEXT NOT NULL,
  "OnHandQty" NUMERIC NOT NULL,
  "ReservedQty" NUMERIC NOT NULL,
  "BlockedQty" NUMERIC NOT NULL,
  "InTransitQty" NUMERIC NOT NULL,
  "SafetyStockQty" NUMERIC NOT NULL,
  "AsOfAt" TEXT NOT NULL,
  "LastCountedAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgInventoryLevel" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgInventoryLevel_MaterialId" FOREIGN KEY ("MaterialId") REFERENCES "MfgMaterial" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgInventory_Qty" CHECK (OnHandQty >= 0 AND ReservedQty >= 0 AND BlockedQty >= 0 AND InTransitQty >= 0 AND SafetyStockQty >= 0 AND ReservedQty + BlockedQty <= OnHandQty)
);
CREATE UNIQUE INDEX "UX_MfgInventory_Key" ON "MfgInventoryLevel" ("PlantId", "InventoryKey");
CREATE INDEX "IX_MfgInventory_Material" ON "MfgInventoryLevel" ("PlantId", "MaterialId", "WarehouseCode");


-- MfgOperationCost · mfg · هزینهٔ عملیات
CREATE TABLE IF NOT EXISTS "MfgOperationCost" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ProductionOrderOperationId" TEXT NOT NULL,
  "CostCenterId" TEXT NULL,
  "CostElement" TEXT NOT NULL,
  "CostVersion" INTEGER NOT NULL,
  "StandardQuantity" NUMERIC NOT NULL,
  "PlannedQuantity" NUMERIC NULL,
  "ActualQuantity" NUMERIC NOT NULL,
  "StandardRate" NUMERIC NOT NULL DEFAULT 0,
  "PlannedRate" NUMERIC NULL,
  "ActualRate" NUMERIC NOT NULL DEFAULT 0,
  "StandardAmount" NUMERIC NOT NULL,
  "PlannedAmount" NUMERIC NULL,
  "ActualAmount" NUMERIC NOT NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "CalculatedAt" TEXT NOT NULL,
  "SourceRef" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgOperationCost" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgOperationCost_ProductionOrderOperationId" FOREIGN KEY ("ProductionOrderOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgOperationCost_CostCenterId" FOREIGN KEY ("CostCenterId") REFERENCES "MfgCostCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgOperationCost_Element" CHECK (CostElement IN ('material','machine','labor','overhead','scrap')),
  CONSTRAINT "CK_MfgOperationCost_Version" CHECK (CostVersion > 0),
  CONSTRAINT "CK_MfgOperationCost_Amounts" CHECK (StandardQuantity >= 0 AND ActualQuantity >= 0 AND StandardRate >= 0 AND ActualRate >= 0 AND StandardAmount >= 0 AND ActualAmount >= 0),
  CONSTRAINT "CK_MfgOperationCost_PlannedAmounts" CHECK ((PlannedQuantity IS NULL OR PlannedQuantity >= 0) AND (PlannedRate IS NULL OR PlannedRate >= 0) AND (PlannedAmount IS NULL OR PlannedAmount >= 0))
);
CREATE UNIQUE INDEX "UX_MfgOperationCost_Element" ON "MfgOperationCost" ("ProductionOrderOperationId", "CostElement", "CostVersion");
CREATE INDEX "IX_MfgOperationCost_Center" ON "MfgOperationCost" ("PlantId", "CostCenterId", "CalculatedAt");


-- MfgOrderCost · mfg · هزینهٔ تجمیعی سفارش
CREATE TABLE IF NOT EXISTS "MfgOrderCost" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ProductionOrderId" TEXT NOT NULL,
  "CostVersion" INTEGER NOT NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "StandardMaterialCost" NUMERIC NOT NULL,
  "PlannedMaterialCost" NUMERIC NULL,
  "ActualMaterialCost" NUMERIC NOT NULL,
  "StandardMachineCost" NUMERIC NOT NULL,
  "PlannedMachineCost" NUMERIC NULL,
  "ActualMachineCost" NUMERIC NOT NULL,
  "StandardLaborCost" NUMERIC NOT NULL,
  "PlannedLaborCost" NUMERIC NULL,
  "ActualLaborCost" NUMERIC NOT NULL,
  "StandardOverheadCost" NUMERIC NOT NULL,
  "PlannedOverheadCost" NUMERIC NULL,
  "ActualOverheadCost" NUMERIC NOT NULL,
  "StandardScrapCost" NUMERIC NULL,
  "PlannedScrapCost" NUMERIC NULL,
  "ActualScrapCost" NUMERIC NULL,
  "StandardTotalCost" NUMERIC NOT NULL,
  "PlannedTotalCost" NUMERIC NULL,
  "ActualTotalCost" NUMERIC NOT NULL,
  "ContractRevenue" NUMERIC NULL,
  "GrossMargin" NUMERIC NULL,
  "Reconciled" INTEGER NOT NULL DEFAULT 0,
  "ReconciledAt" TEXT NULL,
  "ReconcileThrough" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgOrderCost" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgOrderCost_ProductionOrderId" FOREIGN KEY ("ProductionOrderId") REFERENCES "MfgProductionOrder" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgOrderCost_Version" CHECK (CostVersion > 0),
  CONSTRAINT "CK_MfgOrderCost_Amounts" CHECK (StandardMaterialCost >= 0 AND ActualMaterialCost >= 0 AND StandardMachineCost >= 0 AND ActualMachineCost >= 0 AND StandardLaborCost >= 0 AND ActualLaborCost >= 0 AND StandardOverheadCost >= 0 AND ActualOverheadCost >= 0 AND StandardTotalCost >= 0 AND ActualTotalCost >= 0),
  CONSTRAINT "CK_MfgOrderCost_Phase4Amounts" CHECK ((PlannedMaterialCost IS NULL OR PlannedMaterialCost >= 0) AND (PlannedMachineCost IS NULL OR PlannedMachineCost >= 0) AND (PlannedLaborCost IS NULL OR PlannedLaborCost >= 0) AND (PlannedOverheadCost IS NULL OR PlannedOverheadCost >= 0) AND (StandardScrapCost IS NULL OR StandardScrapCost >= 0) AND (PlannedScrapCost IS NULL OR PlannedScrapCost >= 0) AND (ActualScrapCost IS NULL OR ActualScrapCost >= 0) AND (PlannedTotalCost IS NULL OR PlannedTotalCost >= 0)),
  CONSTRAINT "CK_MfgOrderCost_Reconciled" CHECK (Reconciled = 0 OR ReconciledAt IS NOT NULL)
);
CREATE UNIQUE INDEX "UX_MfgOrderCost_Version" ON "MfgOrderCost" ("ProductionOrderId", "CostVersion");
CREATE INDEX "IX_MfgOrderCost_Reconcile" ON "MfgOrderCost" ("PlantId", "Reconciled", "ReconciledAt");


-- MfgProductionAlert · mfg · هشدار تولید
CREATE TABLE IF NOT EXISTS "MfgProductionAlert" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "AlertKey" TEXT NOT NULL,
  "AlertCode" TEXT NOT NULL,
  "Severity" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'open',
  "ProductionOrderId" TEXT NULL,
  "ProductionOrderOperationId" TEXT NULL,
  "WorkCenterId" TEXT NULL,
  "TitleFa" TEXT NOT NULL,
  "DetailFa" TEXT NULL,
  "FirstRaisedAt" TEXT NOT NULL,
  "LastRaisedAt" TEXT NOT NULL,
  "AcknowledgedAt" TEXT NULL,
  "AcknowledgedBy" TEXT NULL,
  "ResolvedAt" TEXT NULL,
  "ResolvedBy" TEXT NULL,
  "OccurrenceCount" INTEGER NOT NULL DEFAULT 1,
  "ThresholdValue" NUMERIC NULL,
  "ActualValue" NUMERIC NULL,
  "SourceEventKey" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgProductionAlert" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgProductionAlert_ProductionOrderId" FOREIGN KEY ("ProductionOrderId") REFERENCES "MfgProductionOrder" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgProductionAlert_ProductionOrderOperationId" FOREIGN KEY ("ProductionOrderOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgProductionAlert_WorkCenterId" FOREIGN KEY ("WorkCenterId") REFERENCES "MfgWorkCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgAlert_Severity" CHECK (Severity IN ('critical','high','medium','low')),
  CONSTRAINT "CK_MfgAlert_Status" CHECK (Status IN ('open','acknowledged','resolved','suppressed')),
  CONSTRAINT "CK_MfgAlert_Count" CHECK (OccurrenceCount > 0),
  CONSTRAINT "CK_MfgAlert_Resolved" CHECK (Status <> 'resolved' OR ResolvedAt IS NOT NULL)
);
CREATE UNIQUE INDEX "UX_MfgAlert_Dedup" ON "MfgProductionAlert" ("PlantId", "AlertKey");
CREATE INDEX "IX_MfgAlert_Open" ON "MfgProductionAlert" ("PlantId", "Status", "Severity", "LastRaisedAt");
CREATE INDEX "IX_MfgAlert_Order" ON "MfgProductionAlert" ("ProductionOrderId", "Status");


-- MfgDispatchingRule · mfg · قاعدهٔ اعزام عملیات
CREATE TABLE IF NOT EXISTS "MfgDispatchingRule" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ScopeType" TEXT NOT NULL,
  "RuleScopeKey" TEXT NOT NULL,
  "WorkCenterId" TEXT NULL,
  "RuleCode" TEXT NOT NULL,
  "PriorityOrder" INTEGER NOT NULL DEFAULT 1,
  "PriorityWeight" NUMERIC NOT NULL DEFAULT 1,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "EffectiveFrom" TEXT NOT NULL,
  "EffectiveTo" TEXT NULL,
  "ParametersJson" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgDispatchingRule" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgDispatchingRule_WorkCenterId" FOREIGN KEY ("WorkCenterId") REFERENCES "MfgWorkCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgDispatchRule_Scope" CHECK (ScopeType IN ('plant','work-center')),
  CONSTRAINT "CK_MfgDispatchRule_Rule" CHECK (RuleCode IN ('EDD','SPT','CR','WSPT','FIFO','MANUAL')),
  CONSTRAINT "CK_MfgDispatchRule_Order" CHECK (PriorityOrder > 0 AND PriorityWeight > 0),
  CONSTRAINT "CK_MfgDispatchRule_ScopeLink" CHECK ((ScopeType = 'plant' AND WorkCenterId IS NULL) OR (ScopeType = 'work-center' AND WorkCenterId IS NOT NULL)),
  CONSTRAINT "CK_MfgDispatchRule_Dates" CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX "UX_MfgDispatchRule_Scope" ON "MfgDispatchingRule" ("PlantId", "RuleScopeKey", "PriorityOrder", "EffectiveFrom");
CREATE INDEX "IX_MfgDispatchRule_Active" ON "MfgDispatchingRule" ("PlantId", "IsActive", "ScopeType", "RuleCode");


-- MfgScheduleRun · mfg · اجرای زمان‌بندی
CREATE TABLE IF NOT EXISTS "MfgScheduleRun" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ScheduleVersion" INTEGER NOT NULL,
  "Direction" TEXT NOT NULL,
  "CapacityMode" TEXT NOT NULL,
  "DispatchRule" TEXT NOT NULL,
  "WindowStart" TEXT NOT NULL,
  "WindowEnd" TEXT NOT NULL,
  "ExpectedScheduleVersion" INTEGER NULL,
  "ScheduledOperationCount" INTEGER NOT NULL DEFAULT 0,
  "UnscheduledOperationCount" INTEGER NOT NULL DEFAULT 0,
  "CalculatedAt" TEXT NOT NULL,
  "ModelVersion" TEXT NOT NULL DEFAULT 'mfg-scheduler-v1',
  "SummaryJson" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgScheduleRun" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_MfgScheduleRun_Version" CHECK (ScheduleVersion > 0 AND (ExpectedScheduleVersion IS NULL OR ExpectedScheduleVersion >= 0)),
  CONSTRAINT "CK_MfgScheduleRun_Window" CHECK (WindowEnd > WindowStart),
  CONSTRAINT "CK_MfgScheduleRun_Mode" CHECK (CapacityMode IN ('finite','semi-finite')),
  CONSTRAINT "CK_MfgScheduleRun_Direction" CHECK (Direction IN ('forward','backward')),
  CONSTRAINT "CK_MfgScheduleRun_Rule" CHECK (DispatchRule IN ('EDD','SPT','CR','WSPT','FIFO','MANUAL')),
  CONSTRAINT "CK_MfgScheduleRun_Counts" CHECK (ScheduledOperationCount >= 0 AND UnscheduledOperationCount >= 0)
);
CREATE UNIQUE INDEX "UX_MfgScheduleRun_Version" ON "MfgScheduleRun" ("PlantId", "ScheduleVersion");
CREATE INDEX "IX_MfgScheduleRun_Created" ON "MfgScheduleRun" ("PlantId", "CreatedAt");


-- MfgLotSizingPolicy · mfg · سیاست اندازه‌گذاری لات
CREATE TABLE IF NOT EXISTS "MfgLotSizingPolicy" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "PolicyCode" TEXT NOT NULL,
  "RuleCode" TEXT NOT NULL,
  "FixedLotQty" NUMERIC NULL,
  "OrderMultiple" NUMERIC NULL,
  "MinOrderQty" NUMERIC NULL,
  "MaxOrderQty" NUMERIC NULL,
  "OrderingCost" NUMERIC NULL,
  "HoldingCostPerUnitPerYear" NUMERIC NULL,
  "AnnualDemandQty" NUMERIC NULL,
  "PeriodDays" INTEGER NULL,
  "PeriodOrderQuantity" INTEGER NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "EffectiveFrom" TEXT NOT NULL,
  "EffectiveTo" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgLotSizingPolicy" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgLotSizingPolicy_PartId" FOREIGN KEY ("PartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgLotPolicy_Rule" CHECK (RuleCode IN ('L4L','FOQ','EOQ','POQ')),
  CONSTRAINT "CK_MfgLotPolicy_Qty" CHECK (FixedLotQty IS NULL OR FixedLotQty > 0),
  CONSTRAINT "CK_MfgLotPolicy_Multiple" CHECK (OrderMultiple IS NULL OR OrderMultiple >= 1),
  CONSTRAINT "CK_MfgLotPolicy_MinMax" CHECK ((MinOrderQty IS NULL OR MinOrderQty >= 0) AND (MaxOrderQty IS NULL OR MaxOrderQty > 0) AND (MinOrderQty IS NULL OR MaxOrderQty IS NULL OR MinOrderQty <= MaxOrderQty)),
  CONSTRAINT "CK_MfgLotPolicy_Eoq" CHECK ((OrderingCost IS NULL OR OrderingCost >= 0) AND (HoldingCostPerUnitPerYear IS NULL OR HoldingCostPerUnitPerYear >= 0) AND (AnnualDemandQty IS NULL OR AnnualDemandQty >= 0)),
  CONSTRAINT "CK_MfgLotPolicy_Period" CHECK ((PeriodDays IS NULL OR PeriodDays > 0) AND (PeriodOrderQuantity IS NULL OR PeriodOrderQuantity > 0)),
  CONSTRAINT "CK_MfgLotPolicy_Dates" CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX "UX_MfgLotPolicy_Part" ON "MfgLotSizingPolicy" ("PlantId", "PartId", "EffectiveFrom");
CREATE INDEX "IX_MfgLotPolicy_Rule" ON "MfgLotSizingPolicy" ("PlantId", "RuleCode", "IsActive");


-- MfgMasterScheduleRun · mfg · اجرای برنامهٔ اصلی تولید
CREATE TABLE IF NOT EXISTS "MfgMasterScheduleRun" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "RunNo" INTEGER NOT NULL,
  "TimeBucket" TEXT NOT NULL,
  "BucketCount" INTEGER NOT NULL,
  "HorizonStart" TEXT NOT NULL,
  "HorizonEnd" TEXT NOT NULL,
  "PartId" TEXT NULL,
  "DemandTimeFenceBuckets" INTEGER NOT NULL DEFAULT 0,
  "FirmPlannedTimeFenceBuckets" INTEGER NOT NULL DEFAULT 0,
  "ConsumeForecast" INTEGER NOT NULL DEFAULT 1,
  "PreviewOnly" INTEGER NOT NULL DEFAULT 0,
  "CalculatedAt" TEXT NOT NULL,
  "CalculatedBy" TEXT NOT NULL,
  "ModelVersion" TEXT NOT NULL DEFAULT 'mfg-planning-v1',
  "PartCount" INTEGER NOT NULL DEFAULT 0,
  "LineCount" INTEGER NOT NULL DEFAULT 0,
  "TotalPlannedOrderQty" NUMERIC NOT NULL DEFAULT 0,
  "SummaryJson" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "ApprovedBy" TEXT NULL,
  "ApprovedAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgMasterScheduleRun" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_MfgMpsRun_RunNo" CHECK (RunNo > 0),
  CONSTRAINT "CK_MfgMpsRun_Bucket" CHECK (TimeBucket IN ('day','week','month') AND BucketCount > 0),
  CONSTRAINT "CK_MfgMpsRun_Horizon" CHECK (HorizonEnd > HorizonStart),
  CONSTRAINT "CK_MfgMpsRun_Fence" CHECK (DemandTimeFenceBuckets >= 0 AND FirmPlannedTimeFenceBuckets >= DemandTimeFenceBuckets),
  CONSTRAINT "CK_MfgMpsRun_Counts" CHECK (PartCount >= 0 AND LineCount >= 0 AND TotalPlannedOrderQty >= 0),
  CONSTRAINT "CK_MfgMpsRun_Status" CHECK (Status IN ('draft','approved')),
  CONSTRAINT "CK_MfgMpsRun_Approval" CHECK (ApprovedAt IS NULL OR ApprovedBy IS NOT NULL)
);
CREATE UNIQUE INDEX "UX_MfgMpsRun_No" ON "MfgMasterScheduleRun" ("PlantId", "RunNo");
CREATE INDEX "IX_MfgMpsRun_Created" ON "MfgMasterScheduleRun" ("PlantId", "CalculatedAt");


-- MfgDemandForecast · mfg · تقاضا و پیش‌بینی فروش
CREATE TABLE IF NOT EXISTS "MfgDemandForecast" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "DemandType" TEXT NOT NULL,
  "DemandRef" TEXT NOT NULL,
  "CustomerRef" TEXT NULL,
  "CustomerNameSnapshot" TEXT NULL,
  "RequiredAt" TEXT NOT NULL,
  "Quantity" NUMERIC NOT NULL,
  "Uom" TEXT NOT NULL,
  "ConfidencePct" NUMERIC NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "ConsumedQuantity" NUMERIC NULL,
  "MpsRunId" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgDemandForecast" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgDemandForecast_PartId" FOREIGN KEY ("PartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgDemandForecast_MpsRunId" FOREIGN KEY ("MpsRunId") REFERENCES "MfgMasterScheduleRun" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgDemand_Type" CHECK (DemandType IN ('sales-order','forecast','contract','manual')),
  CONSTRAINT "CK_MfgDemand_Qty" CHECK (Quantity > 0),
  CONSTRAINT "CK_MfgDemand_Status" CHECK (Status IN ('draft','confirmed','cancelled')),
  CONSTRAINT "CK_MfgDemand_Confidence" CHECK (ConfidencePct IS NULL OR (ConfidencePct >= 0 AND ConfidencePct <= 100)),
  CONSTRAINT "CK_MfgDemand_Consumed" CHECK (ConsumedQuantity IS NULL OR (ConsumedQuantity >= 0 AND ConsumedQuantity <= Quantity))
);
CREATE UNIQUE INDEX "UX_MfgDemand_Ref" ON "MfgDemandForecast" ("PlantId", "DemandType", "DemandRef", "RequiredAt");
CREATE INDEX "IX_MfgDemand_PartDate" ON "MfgDemandForecast" ("PlantId", "PartId", "RequiredAt", "Status");


-- MfgMasterScheduleLine · mfg · ردیف برنامهٔ اصلی تولید
CREATE TABLE IF NOT EXISTS "MfgMasterScheduleLine" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "MpsRunId" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "BucketIndex" INTEGER NOT NULL,
  "BucketStart" TEXT NOT NULL,
  "BucketEnd" TEXT NOT NULL,
  "ForecastQty" NUMERIC NOT NULL DEFAULT 0,
  "SalesOrderQty" NUMERIC NOT NULL DEFAULT 0,
  "ContractQty" NUMERIC NOT NULL DEFAULT 0,
  "ManualQty" NUMERIC NOT NULL DEFAULT 0,
  "ConsumedForecastQty" NUMERIC NOT NULL DEFAULT 0,
  "GrossRequirementQty" NUMERIC NOT NULL DEFAULT 0,
  "ScheduledReceiptQty" NUMERIC NOT NULL DEFAULT 0,
  "ProjectedOnHandBefore" NUMERIC NOT NULL DEFAULT 0,
  "NetRequirementQty" NUMERIC NOT NULL DEFAULT 0,
  "PlannedOrderReceiptQty" NUMERIC NOT NULL DEFAULT 0,
  "PlannedOrderReleaseQty" NUMERIC NOT NULL DEFAULT 0,
  "PlannedOrderReleaseAt" TEXT NULL,
  "ProjectedOnHandAfter" NUMERIC NOT NULL DEFAULT 0,
  "LotSizingRule" TEXT NOT NULL,
  "LotSizingPolicyId" TEXT NULL,
  "InsideDemandTimeFence" INTEGER NOT NULL DEFAULT 0,
  "IsFirm" INTEGER NOT NULL DEFAULT 0,
  "AppliedConstraints" TEXT NULL,
  "DemandRefsJson" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgMasterScheduleLine" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgMasterScheduleLine_MpsRunId" FOREIGN KEY ("MpsRunId") REFERENCES "MfgMasterScheduleRun" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgMasterScheduleLine_PartId" FOREIGN KEY ("PartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgMasterScheduleLine_LotSizingPolicyId" FOREIGN KEY ("LotSizingPolicyId") REFERENCES "MfgLotSizingPolicy" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgMpsLine_Bucket" CHECK (BucketIndex >= 0 AND BucketEnd > BucketStart),
  CONSTRAINT "CK_MfgMpsLine_Rule" CHECK (LotSizingRule IN ('L4L','FOQ','EOQ','POQ')),
  CONSTRAINT "CK_MfgMpsLine_Qty" CHECK (ForecastQty >= 0 AND SalesOrderQty >= 0 AND ContractQty >= 0 AND ManualQty >= 0 AND ConsumedForecastQty >= 0 AND GrossRequirementQty >= 0 AND ScheduledReceiptQty >= 0 AND NetRequirementQty >= 0 AND PlannedOrderReceiptQty >= 0 AND PlannedOrderReleaseQty >= 0)
);
CREATE UNIQUE INDEX "UX_MfgMpsLine_Bucket" ON "MfgMasterScheduleLine" ("MpsRunId", "PartId", "BucketIndex");
CREATE INDEX "IX_MfgMpsLine_PartDate" ON "MfgMasterScheduleLine" ("PlantId", "PartId", "BucketStart");


-- MfgAtpCheck · mfg · بررسی قابلیت تعهد تحویل
CREATE TABLE IF NOT EXISTS "MfgAtpCheck" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "RequestedQty" NUMERIC NOT NULL,
  "RequestedAt" TEXT NOT NULL,
  "Mode" TEXT NOT NULL,
  "Result" TEXT NOT NULL,
  "PromisedQty" NUMERIC NOT NULL DEFAULT 0,
  "ShortageQty" NUMERIC NOT NULL DEFAULT 0,
  "PromisedAt" TEXT NULL,
  "DelayBuckets" INTEGER NOT NULL DEFAULT 0,
  "SourceBucketStart" TEXT NULL,
  "OpeningAvailableQty" NUMERIC NOT NULL DEFAULT 0,
  "IncludeSafetyStock" INTEGER NOT NULL DEFAULT 1,
  "LeadTimeDays" INTEGER NOT NULL DEFAULT 0,
  "BucketCount" INTEGER NOT NULL,
  "CheckedAt" TEXT NOT NULL,
  "CheckedBy" TEXT NOT NULL,
  "ModelVersion" TEXT NOT NULL DEFAULT 'mfg-planning-v1',
  "CustomerRef" TEXT NULL,
  "MessageFa" TEXT NULL,
  "DetailJson" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgAtpCheck" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgAtpCheck_PartId" FOREIGN KEY ("PartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgAtpCheck_Qty" CHECK (RequestedQty > 0 AND PromisedQty >= 0 AND ShortageQty >= 0 AND OpeningAvailableQty >= 0),
  CONSTRAINT "CK_MfgAtpCheck_Mode" CHECK (Mode IN ('discrete','cumulative')),
  CONSTRAINT "CK_MfgAtpCheck_Result" CHECK (Result IN ('available','delayed','unavailable')),
  CONSTRAINT "CK_MfgAtpCheck_Promise" CHECK (Result <> 'available' OR PromisedAt IS NOT NULL),
  CONSTRAINT "CK_MfgAtpCheck_Delay" CHECK (DelayBuckets >= 0 AND BucketCount >= 0 AND LeadTimeDays >= 0)
);
CREATE INDEX "IX_MfgAtpCheck_Part" ON "MfgAtpCheck" ("PlantId", "PartId", "CheckedAt");
CREATE INDEX "IX_MfgAtpCheck_Result" ON "MfgAtpCheck" ("PlantId", "Result", "RequestedAt");


-- MfgOperationSplitLot · mfg · لات تقسیم‌شدهٔ عملیات
CREATE TABLE IF NOT EXISTS "MfgOperationSplitLot" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ProductionOrderOperationId" TEXT NOT NULL,
  "SplitNo" INTEGER NOT NULL,
  "Quantity" NUMERIC NOT NULL,
  "CumulativeQuantity" NUMERIC NOT NULL,
  "IsTransferBatch" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'planned',
  "StartedAt" TEXT NULL,
  "CompletedAt" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgOperationSplitLot" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgOperationSplitLot_ProductionOrderOperationId" FOREIGN KEY ("ProductionOrderOperationId") REFERENCES "MfgProductionOrderOperation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgSplitLot_No" CHECK (SplitNo > 0),
  CONSTRAINT "CK_MfgSplitLot_Qty" CHECK (Quantity > 0 AND CumulativeQuantity >= Quantity),
  CONSTRAINT "CK_MfgSplitLot_Status" CHECK (Status IN ('planned','in-progress','completed','cancelled')),
  CONSTRAINT "CK_MfgSplitLot_Times" CHECK (CompletedAt IS NULL OR (StartedAt IS NOT NULL AND CompletedAt >= StartedAt))
);
CREATE UNIQUE INDEX "UX_MfgSplitLot_No" ON "MfgOperationSplitLot" ("ProductionOrderOperationId", "SplitNo");
CREATE INDEX "IX_MfgSplitLot_Status" ON "MfgOperationSplitLot" ("PlantId", "Status", "SplitNo");


-- MfgProductionVersion · mfg · نسخهٔ تولید
CREATE TABLE IF NOT EXISTS "MfgProductionVersion" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "VersionCode" TEXT NOT NULL,
  "BomRevision" TEXT NOT NULL,
  "RoutingRevision" TEXT NOT NULL,
  "WorkCenterId" TEXT NULL,
  "Priority" INTEGER NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "IsDefault" INTEGER NOT NULL DEFAULT 0,
  "EffectiveFrom" TEXT NULL,
  "EffectiveTo" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgProductionVersion" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgProductionVersion_PartId" FOREIGN KEY ("PartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgProductionVersion_WorkCenterId" FOREIGN KEY ("WorkCenterId") REFERENCES "MfgWorkCenter" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgProdVersion_Priority" CHECK (Priority IS NULL OR Priority >= 0),
  CONSTRAINT "CK_MfgProdVersion_Dates" CHECK (EffectiveTo IS NULL OR EffectiveFrom IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX "UX_MfgProdVersion_Code" ON "MfgProductionVersion" ("PlantId", "PartId", "VersionCode");
CREATE INDEX "IX_MfgProdVersion_Part" ON "MfgProductionVersion" ("PlantId", "PartId", "IsActive", "IsDefault");


-- MfgPlannedOrder · mfg · سفارش برنامه‌ریزی‌شده
CREATE TABLE IF NOT EXISTS "MfgPlannedOrder" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "PlannedOrderNo" TEXT NOT NULL,
  "PartId" TEXT NOT NULL,
  "ProductionVersionId" TEXT NULL,
  "Source" TEXT NOT NULL,
  "MrpRunNo" INTEGER NULL,
  "MpsRunId" TEXT NULL,
  "Quantity" NUMERIC NOT NULL,
  "OriginalQuantity" NUMERIC NULL,
  "Uom" TEXT NOT NULL,
  "LowLevelCode" INTEGER NOT NULL DEFAULT 0,
  "CumulativeLeadTimeDays" INTEGER NOT NULL DEFAULT 0,
  "PlannedReleaseAt" TEXT NOT NULL,
  "PlannedDueAt" TEXT NOT NULL,
  "BucketIndex" INTEGER NULL,
  "LotSizingRule" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'proposed',
  "ReviewedBy" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "ConvertedProductionOrderId" TEXT NULL,
  "ConvertedAt" TEXT NULL,
  "RejectReasonFa" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgPlannedOrder" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgPlannedOrder_PartId" FOREIGN KEY ("PartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgPlannedOrder_ProductionVersionId" FOREIGN KEY ("ProductionVersionId") REFERENCES "MfgProductionVersion" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgPlannedOrder_ConvertedProductionOrderId" FOREIGN KEY ("ConvertedProductionOrderId") REFERENCES "MfgProductionOrder" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgPlannedOrder_Source" CHECK (Source IN ('mrp','mps')),
  CONSTRAINT "CK_MfgPlannedOrder_Rule" CHECK (LotSizingRule IN ('L4L','FOQ','EOQ','POQ')),
  CONSTRAINT "CK_MfgPlannedOrder_Status" CHECK (Status IN ('proposed','approved','converted','rejected','cancelled')),
  CONSTRAINT "CK_MfgPlannedOrder_Qty" CHECK (Quantity > 0 AND (OriginalQuantity IS NULL OR OriginalQuantity > 0)),
  CONSTRAINT "CK_MfgPlannedOrder_Dates" CHECK (PlannedReleaseAt <= PlannedDueAt),
  CONSTRAINT "CK_MfgPlannedOrder_Level" CHECK (LowLevelCode >= 0 AND CumulativeLeadTimeDays >= 0)
);
CREATE UNIQUE INDEX "UX_MfgPlannedOrder_No" ON "MfgPlannedOrder" ("PlantId", "PlannedOrderNo");
CREATE INDEX "IX_MfgPlannedOrder_Part" ON "MfgPlannedOrder" ("PlantId", "PartId", "Status", "PlannedDueAt");
CREATE INDEX "IX_MfgPlannedOrder_Release" ON "MfgPlannedOrder" ("PlantId", "Status", "PlannedReleaseAt");


-- MfgRequirementPegging · mfg · ردیابی نیاز (Pegging)
CREATE TABLE IF NOT EXISTS "MfgRequirementPegging" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "ComponentPartId" TEXT NOT NULL,
  "ComponentSupplyRef" TEXT NULL,
  "ParentPartId" TEXT NOT NULL,
  "ParentSupplyRef" TEXT NULL,
  "MaterialRequirementId" TEXT NULL,
  "ProductionOrderId" TEXT NULL,
  "PlannedOrderId" TEXT NULL,
  "PeggedQuantity" NUMERIC NOT NULL,
  "QuantityPer" NUMERIC NOT NULL DEFAULT 1,
  "LevelFromRoot" INTEGER NOT NULL DEFAULT 0,
  "IsMultiLevel" INTEGER NOT NULL DEFAULT 0,
  "RootPartId" TEXT NULL,
  "RootSupplyRef" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgRequirementPegging" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_MfgRequirementPegging_ComponentPartId" FOREIGN KEY ("ComponentPartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgRequirementPegging_ParentPartId" FOREIGN KEY ("ParentPartId") REFERENCES "MfgPart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgRequirementPegging_ProductionOrderId" FOREIGN KEY ("ProductionOrderId") REFERENCES "MfgProductionOrder" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_MfgRequirementPegging_PlannedOrderId" FOREIGN KEY ("PlannedOrderId") REFERENCES "MfgPlannedOrder" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_MfgPegging_Qty" CHECK (PeggedQuantity >= 0 AND QuantityPer > 0),
  CONSTRAINT "CK_MfgPegging_Level" CHECK (LevelFromRoot >= 0)
);
CREATE INDEX "IX_MfgPegging_Component" ON "MfgRequirementPegging" ("PlantId", "ComponentPartId", "ParentPartId");
CREATE INDEX "IX_MfgPegging_Root" ON "MfgRequirementPegging" ("PlantId", "RootPartId", "RootSupplyRef");
CREATE INDEX "IX_MfgPegging_Order" ON "MfgRequirementPegging" ("PlantId", "ProductionOrderId");


-- MfgPlant · mfg · کارخانه و نوع صنعت
CREATE TABLE IF NOT EXISTS "MfgPlant" (
  "Id" TEXT NOT NULL,
  "PlantId" TEXT NOT NULL,
  "PlantCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "IndustryType" TEXT NOT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_MfgPlant" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_MfgPlant_Industry" CHECK (IndustryType IN ('discrete','process','food','pharma','automotive','metal','drilling_energy'))
);
CREATE UNIQUE INDEX "UX_MfgPlant_PlantId" ON "MfgPlant" ("PlantId");
CREATE UNIQUE INDEX "UX_MfgPlant_PlantCode" ON "MfgPlant" ("PlantId", "PlantCode");
CREATE INDEX "IX_MfgPlant_Industry" ON "MfgPlant" ("IndustryType", "IsActive");


-- CmmsSite · cmms · سایت و مجتمع بهره‌برداری
CREATE TABLE IF NOT EXISTS "CmmsSite" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "SiteCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "SiteType" TEXT NOT NULL,
  "PolicyStatementFa" TEXT NULL,
  "TimeZoneId" TEXT NULL DEFAULT 'Asia/Tehran',
  "Currency" TEXT NULL DEFAULT 'IRR',
  "BaseYear" INTEGER NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsSite" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_CmmsSite_Type" CHECK (SiteType IN ('plant','refinery','power','drilling','utility','workshop','office')),
  CONSTRAINT "CK_CmmsSite_Year" CHECK (BaseYear IS NULL OR (BaseYear >= 1900 AND BaseYear <= 2200))
);
CREATE UNIQUE INDEX "UX_CmmsSite_SiteId" ON "CmmsSite" ("SiteId");
CREATE UNIQUE INDEX "UX_CmmsSite_Code" ON "CmmsSite" ("SiteId", "SiteCode");
CREATE INDEX "IX_CmmsSite_Type" ON "CmmsSite" ("SiteType", "IsActive");


-- CmmsLocation · cmms · مکان و ساختار درختی استقرار
CREATE TABLE IF NOT EXISTS "CmmsLocation" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "LocationCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "Level" INTEGER NOT NULL,
  "ParentLocationId" TEXT NULL,
  "PathCode" TEXT NULL,
  "Latitude" NUMERIC NULL,
  "Longitude" NUMERIC NULL,
  "GeoAccuracyMeters" INTEGER NULL,
  "ZoneClassification" TEXT NULL,
  "IsHazardousArea" INTEGER NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsLocation" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsLocation_ParentLocationId" FOREIGN KEY ("ParentLocationId") REFERENCES "CmmsLocation" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsLocation_Level" CHECK (Level BETWEEN 1 AND 9),
  CONSTRAINT "CK_CmmsLocation_Self" CHECK (ParentLocationId IS NULL OR ParentLocationId <> Id),
  CONSTRAINT "CK_CmmsLocation_Lat" CHECK (Latitude IS NULL OR (Latitude >= -90 AND Latitude <= 90)),
  CONSTRAINT "CK_CmmsLocation_Lon" CHECK (Longitude IS NULL OR (Longitude >= -180 AND Longitude <= 180))
);
CREATE UNIQUE INDEX "UX_CmmsLocation_Code" ON "CmmsLocation" ("SiteId", "LocationCode");
CREATE INDEX "IX_CmmsLocation_Parent" ON "CmmsLocation" ("SiteId", "ParentLocationId");
CREATE INDEX "IX_CmmsLocation_Level" ON "CmmsLocation" ("SiteId", "Level", "IsActive");


-- CmmsFamilyGroup · cmms · گروه خانوادهٔ تجهیزات
CREATE TABLE IF NOT EXISTS "CmmsFamilyGroup" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "GroupCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "EquipmentClass" TEXT NOT NULL,
  "Discipline" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamilyGroup" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_CmmsFamilyGroup_Discipline" CHECK (Discipline IS NULL OR Discipline IN ('mechanical','electrical','instrument','civil','rotating','static'))
);
CREATE UNIQUE INDEX "UX_CmmsFamilyGroup_Code" ON "CmmsFamilyGroup" ("SiteId", "GroupCode");
CREATE INDEX "IX_CmmsFamilyGroup_Class" ON "CmmsFamilyGroup" ("SiteId", "EquipmentClass", "IsActive");


-- CmmsFamily · cmms · الگوی خانوادهٔ تجهیز
CREATE TABLE IF NOT EXISTS "CmmsFamily" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyGroupId" TEXT NOT NULL,
  "FamilyCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "Manufacturer" TEXT NULL,
  "ModelSeries" TEXT NULL,
  "CriticalityRank" TEXT NOT NULL DEFAULT 'C',
  "DefaultStrategy" TEXT NOT NULL DEFAULT 'pm',
  "Version" INTEGER NOT NULL DEFAULT 1,
  "IsTemplate" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "ApprovedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamily" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFamily_FamilyGroupId" FOREIGN KEY ("FamilyGroupId") REFERENCES "CmmsFamilyGroup" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsFamily_Criticality" CHECK (CriticalityRank IN ('A','B','C','D')),
  CONSTRAINT "CK_CmmsFamily_Strategy" CHECK (DefaultStrategy IN ('pm','cbm','predictive','risk-based','run-to-failure','zero-breakdown')),
  CONSTRAINT "CK_CmmsFamily_Status" CHECK (Status IN ('draft','approved','obsolete')),
  CONSTRAINT "CK_CmmsFamily_Approve" CHECK (Status <> 'approved' OR ApprovedAt IS NOT NULL),
  CONSTRAINT "CK_CmmsFamily_Version" CHECK (Version >= 1)
);
CREATE UNIQUE INDEX "UX_CmmsFamily_Code" ON "CmmsFamily" ("SiteId", "FamilyCode");
CREATE INDEX "IX_CmmsFamily_Group" ON "CmmsFamily" ("SiteId", "FamilyGroupId", "Status");
CREATE INDEX "IX_CmmsFamily_Criticality" ON "CmmsFamily" ("SiteId", "CriticalityRank", "Status");


-- CmmsFamilyNode · cmms · گره درخت خانوادهٔ تجهیز
CREATE TABLE IF NOT EXISTS "CmmsFamilyNode" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "NodeCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "BoundaryLevel" TEXT NOT NULL,
  "ParentNodeId" TEXT NULL,
  "PathLevel" INTEGER NOT NULL DEFAULT 1,
  "PathCode" TEXT NULL,
  "Iso14224Code" TEXT NULL,
  "IsMaintainable" INTEGER NOT NULL DEFAULT 1,
  "IsCriticalPart" INTEGER NOT NULL DEFAULT 0,
  "TechnicalSpecFa" TEXT NULL,
  "SortOrder" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamilyNode" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFamilyNode_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsFamilyNode_ParentNodeId" FOREIGN KEY ("ParentNodeId") REFERENCES "CmmsFamilyNode" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsFamilyNode_Boundary" CHECK (BoundaryLevel IN ('equipment','sub-unit','component','maintenance-item')),
  CONSTRAINT "CK_CmmsFamilyNode_Self" CHECK (ParentNodeId IS NULL OR ParentNodeId <> Id),
  CONSTRAINT "CK_CmmsFamilyNode_Level" CHECK (PathLevel >= 1)
);
CREATE UNIQUE INDEX "UX_CmmsFamilyNode_Code" ON "CmmsFamilyNode" ("FamilyId", "NodeCode");
CREATE INDEX "IX_CmmsFamilyNode_Parent" ON "CmmsFamilyNode" ("FamilyId", "ParentNodeId");
CREATE INDEX "IX_CmmsFamilyNode_Boundary" ON "CmmsFamilyNode" ("SiteId", "BoundaryLevel", "IsMaintainable");


-- CmmsFamilyProfile · cmms · پروفایل جامع خانوادهٔ تجهیز
CREATE TABLE IF NOT EXISTS "CmmsFamilyProfile" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "ProfileKey" TEXT NOT NULL,
  "CategoryFa" TEXT NOT NULL,
  "ContentFa" TEXT NULL,
  "ContentEn" TEXT NULL,
  "ReferenceStandard" TEXT NULL,
  "Uom" TEXT NULL,
  "SortOrder" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamilyProfile" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFamilyProfile_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "UX_CmmsFamilyProfile_Key" ON "CmmsFamilyProfile" ("FamilyId", "ProfileKey");
CREATE INDEX "IX_CmmsFamilyProfile_Category" ON "CmmsFamilyProfile" ("SiteId", "IsActive", "SortOrder");


-- CmmsFamilyOperatingParam · cmms · پارامتر کارکردی خانواده
CREATE TABLE IF NOT EXISTS "CmmsFamilyOperatingParam" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "ParamCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "ParamType" TEXT NOT NULL,
  "Uom" TEXT NOT NULL,
  "NominalRatePerHour" NUMERIC NULL,
  "WarnLimit" NUMERIC NULL,
  "AlarmLimit" NUMERIC NULL,
  "IsPmDriver" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamilyOperatingParam" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFamilyOperatingParam_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsFamilyOperatingParam_Type" CHECK (ParamType IN ('running_hours','odometer','stroke_count','cycle_count','throughput','start_count')),
  CONSTRAINT "CK_CmmsFamilyOperatingParam_Limits" CHECK (AlarmLimit IS NULL OR WarnLimit IS NULL OR AlarmLimit > WarnLimit)
);
CREATE UNIQUE INDEX "UX_CmmsFamilyOperatingParam_Code" ON "CmmsFamilyOperatingParam" ("FamilyId", "ParamCode");
CREATE INDEX "IX_CmmsFamilyOperatingParam_Driver" ON "CmmsFamilyOperatingParam" ("SiteId", "IsPmDriver", "IsActive");


-- CmmsFamilyConditionParam · cmms · پارامتر پایش وضعیت خانواده
CREATE TABLE IF NOT EXISTS "CmmsFamilyConditionParam" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "ParamCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Technique" TEXT NOT NULL,
  "Uom" TEXT NOT NULL,
  "MeasurementPoint" TEXT NULL,
  "BaselineValue" NUMERIC NULL,
  "AlertLimit" NUMERIC NULL,
  "AlarmLimit" NUMERIC NULL,
  "TripLimit" NUMERIC NULL,
  "SamplingIntervalHours" NUMERIC NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamilyConditionParam" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFamilyConditionParam_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsFamilyConditionParam_Tech" CHECK (Technique IN ('vibration','thermal','oil_analysis','ultrasonic','motor_current','performance','visual')),
  CONSTRAINT "CK_CmmsFamilyConditionParam_Limits" CHECK (AlarmLimit IS NULL OR AlertLimit IS NULL OR AlarmLimit >= AlertLimit),
  CONSTRAINT "CK_CmmsFamilyConditionParam_Trip" CHECK (TripLimit IS NULL OR AlarmLimit IS NULL OR TripLimit >= AlarmLimit)
);
CREATE UNIQUE INDEX "UX_CmmsFamilyConditionParam_Code" ON "CmmsFamilyConditionParam" ("FamilyId", "ParamCode");
CREATE INDEX "IX_CmmsFamilyConditionParam_Tech" ON "CmmsFamilyConditionParam" ("SiteId", "Technique", "IsActive");


-- CmmsFamilyFailureMode · cmms · حالت خرابی استاندارد خانواده
CREATE TABLE IF NOT EXISTS "CmmsFamilyFailureMode" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "FamilyNodeId" TEXT NULL,
  "FailureModeCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "FailureMode" TEXT NOT NULL,
  "FailureMechanism" TEXT NOT NULL,
  "DetectionMethod" TEXT NULL,
  "EffectDescriptionFa" TEXT NULL,
  "SeverityClass" INTEGER NOT NULL DEFAULT 2,
  "OccurrenceClass" INTEGER NOT NULL DEFAULT 2,
  "DetectionClass" INTEGER NOT NULL DEFAULT 2,
  "CriticalityRank" TEXT NOT NULL DEFAULT 'C',
  "IsHiddenFailure" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamilyFailureMode" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFamilyFailureMode_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsFamilyFailureMode_FamilyNodeId" FOREIGN KEY ("FamilyNodeId") REFERENCES "CmmsFamilyNode" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsFamilyFailureMode_Mode" CHECK (FailureMode IN ('fail-to-start','fail-to-function','fail-to-stop','abnormal-start','abnormal-shutdown','erratic-output','reduced-output','excessive-output','spurious-output','leakage','structural')),
  CONSTRAINT "CK_CmmsFamilyFailureMode_Mechanism" CHECK (FailureMechanism IN ('wear','corrosion','fatigue','overload','fouling','misalignment','imbalance','lubrication','electrical','seal','thermal','vibration','other')),
  CONSTRAINT "CK_CmmsFamilyFailureMode_Severity" CHECK (SeverityClass BETWEEN 1 AND 5),
  CONSTRAINT "CK_CmmsFamilyFailureMode_Occurrence" CHECK (OccurrenceClass BETWEEN 1 AND 5),
  CONSTRAINT "CK_CmmsFamilyFailureMode_Detection" CHECK (DetectionClass BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX "UX_CmmsFamilyFailureMode_Code" ON "CmmsFamilyFailureMode" ("FamilyId", "FailureModeCode");
CREATE INDEX "IX_CmmsFamilyFailureMode_Mode" ON "CmmsFamilyFailureMode" ("SiteId", "FailureMode", "IsActive");
CREATE INDEX "IX_CmmsFamilyFailureMode_Node" ON "CmmsFamilyFailureMode" ("FamilyId", "FamilyNodeId");


-- CmmsFamilyDocument · cmms · آرشیو فنی خانواده
CREATE TABLE IF NOT EXISTS "CmmsFamilyDocument" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "DocCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DocType" TEXT NOT NULL,
  "Revision" TEXT NULL,
  "StoragePath" TEXT NULL,
  "FileFormat" TEXT NULL,
  "FileSizeBytes" INTEGER NULL,
  "IssuedBy" TEXT NULL,
  "IssuedOn" TEXT NULL,
  "ExpiresOn" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamilyDocument" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFamilyDocument_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsFamilyDocument_Type" CHECK (DocType IN ('drawing','catalog','manual','datasheet','certificate','sop','procedure','photo','other')),
  CONSTRAINT "CK_CmmsFamilyDocument_Size" CHECK (FileSizeBytes IS NULL OR FileSizeBytes >= 0),
  CONSTRAINT "CK_CmmsFamilyDocument_Dates" CHECK (ExpiresOn IS NULL OR IssuedOn IS NULL OR ExpiresOn >= IssuedOn)
);
CREATE UNIQUE INDEX "UX_CmmsFamilyDocument_Code" ON "CmmsFamilyDocument" ("FamilyId", "DocCode", "Revision");
CREATE INDEX "IX_CmmsFamilyDocument_Type" ON "CmmsFamilyDocument" ("SiteId", "DocType", "IsActive");


-- CmmsFamilyPmTask · cmms · فعالیت نگهداشت خانواده
CREATE TABLE IF NOT EXISTS "CmmsFamilyPmTask" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "FamilyNodeId" TEXT NULL,
  "TaskCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "TaskType" TEXT NOT NULL,
  "StrategyType" TEXT NOT NULL DEFAULT 'pm',
  "StandardMinutes" NUMERIC NULL,
  "TradeSkill" TEXT NOT NULL,
  "ToolRequired" TEXT NULL,
  "SafetyRequirementFa" TEXT NULL,
  "IntervalValue" NUMERIC NULL,
  "IntervalUnit" TEXT NULL,
  "IsMandatory" INTEGER NOT NULL DEFAULT 1,
  "SortOrder" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "InstructionFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamilyPmTask" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFamilyPmTask_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsFamilyPmTask_FamilyNodeId" FOREIGN KEY ("FamilyNodeId") REFERENCES "CmmsFamilyNode" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsFamilyPmTask_Type" CHECK (TaskType IN ('inspection','lubrication','adjustment','cleaning','replacement','overhaul','test','calibration')),
  CONSTRAINT "CK_CmmsFamilyPmTask_Strategy" CHECK (StrategyType IN ('pm','cbm','predictive','run-to-failure')),
  CONSTRAINT "CK_CmmsFamilyPmTask_Interval" CHECK (IntervalValue IS NULL OR IntervalValue > 0),
  CONSTRAINT "CK_CmmsFamilyPmTask_Unit" CHECK (IntervalUnit IS NULL OR IntervalUnit IN ('hours','days','weeks','months','cycles','km')),
  CONSTRAINT "CK_CmmsFamilyPmTask_Minutes" CHECK (StandardMinutes IS NULL OR StandardMinutes >= 0)
);
CREATE UNIQUE INDEX "UX_CmmsFamilyPmTask_Code" ON "CmmsFamilyPmTask" ("FamilyId", "TaskCode");
CREATE INDEX "IX_CmmsFamilyPmTask_Strategy" ON "CmmsFamilyPmTask" ("SiteId", "StrategyType", "IsActive");


-- CmmsPmChecklistItem · cmms · ردیف چک‌لیست PM
CREATE TABLE IF NOT EXISTS "CmmsPmChecklistItem" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyPmTaskId" TEXT NOT NULL,
  "ItemCode" TEXT NOT NULL,
  "DescriptionFa" TEXT NOT NULL,
  "InputType" TEXT NOT NULL DEFAULT 'passfail',
  "ExpectedValue" TEXT NULL,
  "MinValue" NUMERIC NULL,
  "MaxValue" NUMERIC NULL,
  "Uom" TEXT NULL,
  "IsRequired" INTEGER NOT NULL DEFAULT 1,
  "SortOrder" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsPmChecklistItem" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsPmChecklistItem_FamilyPmTaskId" FOREIGN KEY ("FamilyPmTaskId") REFERENCES "CmmsFamilyPmTask" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsPmChecklistItem_Input" CHECK (InputType IN ('passfail','numeric','text','select','measurement')),
  CONSTRAINT "CK_CmmsPmChecklistItem_Range" CHECK (MaxValue IS NULL OR MinValue IS NULL OR MaxValue >= MinValue)
);
CREATE UNIQUE INDEX "UX_CmmsPmChecklistItem_Code" ON "CmmsPmChecklistItem" ("FamilyPmTaskId", "ItemCode");
CREATE INDEX "IX_CmmsPmChecklistItem_Order" ON "CmmsPmChecklistItem" ("SiteId", "SortOrder");


-- CmmsFamilyCustomField · cmms · فیلد سفارشی خانواده
CREATE TABLE IF NOT EXISTS "CmmsFamilyCustomField" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "FieldKey" TEXT NOT NULL,
  "LabelFa" TEXT NOT NULL,
  "LabelEn" TEXT NULL,
  "FieldType" TEXT NOT NULL,
  "Unit" TEXT NULL,
  "OptionsJson" TEXT NULL,
  "DefaultValue" TEXT NULL,
  "IsRequired" INTEGER NOT NULL DEFAULT 0,
  "AppliesTo" TEXT NOT NULL DEFAULT 'asset',
  "SortOrder" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamilyCustomField" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFamilyCustomField_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsFamilyCustomField_Type" CHECK (FieldType IN ('text','number','date','boolean','select')),
  CONSTRAINT "CK_CmmsFamilyCustomField_Scope" CHECK (AppliesTo IN ('asset','node','both'))
);
CREATE UNIQUE INDEX "UX_CmmsFamilyCustomField_Key" ON "CmmsFamilyCustomField" ("FamilyId", "FieldKey");
CREATE INDEX "IX_CmmsFamilyCustomField_Type" ON "CmmsFamilyCustomField" ("SiteId", "FieldType", "IsActive");


-- CmmsFamilyBulkChange · cmms · تغییر همگانی روی خانواده
CREATE TABLE IF NOT EXISTS "CmmsFamilyBulkChange" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "ChangeKind" TEXT NOT NULL,
  "TargetField" TEXT NOT NULL,
  "NewValueJson" TEXT NOT NULL,
  "AffectedAssetCount" INTEGER NOT NULL DEFAULT 0,
  "ReasonFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'pending',
  "RequestedBy" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "AppliedAt" TEXT NULL,
  "RollbackOfId" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFamilyBulkChange" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFamilyBulkChange_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsFamilyBulkChange_Kind" CHECK (ChangeKind IN ('pm-interval','failure-mode','checklist','custom-field','node','document','strategy')),
  CONSTRAINT "CK_CmmsFamilyBulkChange_Status" CHECK (Status IN ('pending','approved','applied','rolled-back','rejected')),
  CONSTRAINT "CK_CmmsFamilyBulkChange_Count" CHECK (AffectedAssetCount >= 0)
);
CREATE INDEX "IX_CmmsFamilyBulkChange_Family" ON "CmmsFamilyBulkChange" ("SiteId", "FamilyId", "Status");
CREATE INDEX "IX_CmmsFamilyBulkChange_Kind" ON "CmmsFamilyBulkChange" ("SiteId", "ChangeKind", "Status");


-- CmmsVendor · cmms · تأمین‌کننده و پیمانکار نت
CREATE TABLE IF NOT EXISTS "CmmsVendor" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "VendorCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "VendorType" TEXT NOT NULL,
  "ContactName" TEXT NULL,
  "ContactPhone" TEXT NULL,
  "ContactEmail" TEXT NULL,
  "NationalId" TEXT NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "IsApproved" INTEGER NOT NULL DEFAULT 0,
  "ApprovedOn" TEXT NULL,
  "QualificationExpiresOn" TEXT NULL,
  "RatingScore" NUMERIC NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsVendor" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_CmmsVendor_Type" CHECK (VendorType IN ('oem','supplier','contractor','service','calibration-lab')),
  CONSTRAINT "CK_CmmsVendor_Rating" CHECK (RatingScore IS NULL OR (RatingScore >= 0 AND RatingScore <= 100))
);
CREATE UNIQUE INDEX "UX_CmmsVendor_Code" ON "CmmsVendor" ("SiteId", "VendorCode");
CREATE INDEX "IX_CmmsVendor_Type" ON "CmmsVendor" ("SiteId", "VendorType", "IsApproved");


-- CmmsAsset · cmms · تجهیز و دارایی فیزیکی
CREATE TABLE IF NOT EXISTS "CmmsAsset" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "AssetTag" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "ParentAssetId" TEXT NULL,
  "LocationId" TEXT NULL,
  "SerialNumber" TEXT NULL,
  "Manufacturer" TEXT NULL,
  "Model" TEXT NULL,
  "AssetState" TEXT NOT NULL DEFAULT 'commissioned',
  "CriticalityRank" TEXT NOT NULL DEFAULT 'C',
  "VendorId" TEXT NULL,
  "CommissionedOn" TEXT NULL,
  "InstalledOn" TEXT NULL,
  "WarrantyExpiresOn" TEXT NULL,
  "AcquisitionCost" NUMERIC NULL,
  "Currency" TEXT NULL DEFAULT 'IRR',
  "ExpectedLifeYears" NUMERIC NULL,
  "MfgWorkCenterId" TEXT NULL,
  "ScmWarehouseId" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsAsset" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsAsset_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_CmmsAsset_ParentAssetId" FOREIGN KEY ("ParentAssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_CmmsAsset_LocationId" FOREIGN KEY ("LocationId") REFERENCES "CmmsLocation" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsAsset_VendorId" FOREIGN KEY ("VendorId") REFERENCES "CmmsVendor" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsAsset_State" CHECK (AssetState IN ('planned','installed','commissioned','operating','standby','under-maintenance','degraded','retired','disposed')),
  CONSTRAINT "CK_CmmsAsset_Criticality" CHECK (CriticalityRank IN ('A','B','C','D')),
  CONSTRAINT "CK_CmmsAsset_Self" CHECK (ParentAssetId IS NULL OR ParentAssetId <> Id),
  CONSTRAINT "CK_CmmsAsset_Cost" CHECK (AcquisitionCost IS NULL OR AcquisitionCost >= 0),
  CONSTRAINT "CK_CmmsAsset_Life" CHECK (ExpectedLifeYears IS NULL OR ExpectedLifeYears > 0)
);
CREATE UNIQUE INDEX "UX_CmmsAsset_Tag" ON "CmmsAsset" ("SiteId", "AssetTag");
CREATE INDEX "IX_CmmsAsset_Family" ON "CmmsAsset" ("SiteId", "FamilyId", "AssetState");
CREATE INDEX "IX_CmmsAsset_Parent" ON "CmmsAsset" ("SiteId", "ParentAssetId");
CREATE INDEX "IX_CmmsAsset_Location" ON "CmmsAsset" ("SiteId", "LocationId");
CREATE INDEX "IX_CmmsAsset_Criticality" ON "CmmsAsset" ("SiteId", "CriticalityRank", "IsActive");


-- CmmsAssetFamilyAssignment · cmms · انتساب تجهیز به خانواده
CREATE TABLE IF NOT EXISTS "CmmsAssetFamilyAssignment" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "EffectiveFrom" TEXT NOT NULL,
  "EffectiveTo" TEXT NULL,
  "IsPrimary" INTEGER NOT NULL DEFAULT 1,
  "InheritPmTasks" INTEGER NOT NULL DEFAULT 1,
  "InheritFailureModes" INTEGER NOT NULL DEFAULT 1,
  "InheritCustomFields" INTEGER NOT NULL DEFAULT 1,
  "ReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsAssetFamilyAssignment" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsAssetFamilyAssignment_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAssetFamilyAssignment_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsAssetFamilyAssignment_Dates" CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX "UX_CmmsAssetFamilyAssignment_Pair" ON "CmmsAssetFamilyAssignment" ("AssetId", "FamilyId", "EffectiveFrom");
CREATE INDEX "IX_CmmsAssetFamilyAssignment_Family" ON "CmmsAssetFamilyAssignment" ("SiteId", "FamilyId", "IsPrimary");


-- CmmsAssetDocument · cmms · آرشیو فنی تجهیز
CREATE TABLE IF NOT EXISTS "CmmsAssetDocument" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "DocCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DocType" TEXT NOT NULL,
  "Revision" TEXT NULL,
  "StoragePath" TEXT NULL,
  "FileFormat" TEXT NULL,
  "FileSizeBytes" INTEGER NULL,
  "InheritedFromFamilyDocumentId" TEXT NULL,
  "IssuedOn" TEXT NULL,
  "ExpiresOn" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsAssetDocument" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsAssetDocument_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAssetDocument_InheritedFromFamilyDocumentId" FOREIGN KEY ("InheritedFromFamilyDocumentId") REFERENCES "CmmsFamilyDocument" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsAssetDocument_Type" CHECK (DocType IN ('drawing','catalog','manual','datasheet','certificate','sop','procedure','photo','test-report','other')),
  CONSTRAINT "CK_CmmsAssetDocument_Dates" CHECK (ExpiresOn IS NULL OR IssuedOn IS NULL OR ExpiresOn >= IssuedOn)
);
CREATE UNIQUE INDEX "UX_CmmsAssetDocument_Code" ON "CmmsAssetDocument" ("AssetId", "DocCode", "Revision");
CREATE INDEX "IX_CmmsAssetDocument_Type" ON "CmmsAssetDocument" ("SiteId", "DocType", "IsActive");


-- CmmsAssetCustomValue · cmms · مقدار فیلد پویای تجهیز
CREATE TABLE IF NOT EXISTS "CmmsAssetCustomValue" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "FamilyCustomFieldId" TEXT NOT NULL,
  "AssetNodeId" TEXT NULL,
  "ValueText" TEXT NOT NULL,
  "ValueNumber" NUMERIC NULL,
  "ValueDate" TEXT NULL,
  "ValueBool" INTEGER NULL,
  "MeasuredOn" TEXT NULL,
  "Source" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsAssetCustomValue" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsAssetCustomValue_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAssetCustomValue_FamilyCustomFieldId" FOREIGN KEY ("FamilyCustomFieldId") REFERENCES "CmmsFamilyCustomField" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsAssetCustomValue_Source" CHECK (Source IS NULL OR Source IN ('manual','import','sensor','ai-tree-generator'))
);
CREATE UNIQUE INDEX "UX_CmmsAssetCustomValue_Key" ON "CmmsAssetCustomValue" ("AssetId", "FamilyCustomFieldId", "AssetNodeId");
CREATE INDEX "IX_CmmsAssetCustomValue_Field" ON "CmmsAssetCustomValue" ("SiteId", "FamilyCustomFieldId");


-- CmmsAssetBarcode · cmms · بارکد و QR تجهیز
CREATE TABLE IF NOT EXISTS "CmmsAssetBarcode" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "BarcodeValue" TEXT NOT NULL,
  "BarcodeType" TEXT NOT NULL DEFAULT 'qr',
  "PrintedLabel" TEXT NULL,
  "PrintedOn" TEXT NULL,
  "PrintedBy" TEXT NULL,
  "IsPrimary" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "LastScannedAt" TEXT NULL,
  "LastScannedBy" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsAssetBarcode" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsAssetBarcode_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsAssetBarcode_Type" CHECK (BarcodeType IN ('qr','code128','ean13','datamatrix','rfid'))
);
CREATE UNIQUE INDEX "UX_CmmsAssetBarcode_Value" ON "CmmsAssetBarcode" ("SiteId", "BarcodeValue");
CREATE INDEX "IX_CmmsAssetBarcode_Asset" ON "CmmsAssetBarcode" ("AssetId", "IsActive");


-- CmmsAssetLifecycleEvent · cmms · رویداد چرخهٔ عمر دارایی
CREATE TABLE IF NOT EXISTS "CmmsAssetLifecycleEvent" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "EventKind" TEXT NOT NULL,
  "OccurredOn" TEXT NOT NULL,
  "OccurredAt" TEXT NULL,
  "PreviousState" TEXT NULL,
  "NewState" TEXT NULL,
  "LocationId" TEXT NULL,
  "EventCost" NUMERIC NULL,
  "ReferenceDocId" TEXT NULL,
  "DescriptionFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsAssetLifecycleEvent" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsAssetLifecycleEvent_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAssetLifecycleEvent_LocationId" FOREIGN KEY ("LocationId") REFERENCES "CmmsLocation" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsAssetLifecycleEvent_Kind" CHECK (EventKind IN ('acquired','installed','commissioned','transferred','modified','major-overhaul','degraded','retired','disposed'))
);
CREATE INDEX "IX_CmmsAssetLifecycleEvent_Asset" ON "CmmsAssetLifecycleEvent" ("AssetId", "OccurredOn");
CREATE INDEX "IX_CmmsAssetLifecycleEvent_Kind" ON "CmmsAssetLifecycleEvent" ("SiteId", "EventKind");


-- CmmsMeterDefinition · cmms · تعریف کنتور کارکرد
CREATE TABLE IF NOT EXISTS "CmmsMeterDefinition" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "FamilyOperatingParamId" TEXT NULL,
  "MeterCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Uom" TEXT NOT NULL,
  "MeterType" TEXT NOT NULL DEFAULT 'absolute',
  "InitialValue" NUMERIC NULL,
  "RollOverAt" NUMERIC NULL,
  "ReadingSource" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsMeterDefinition" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsMeterDefinition_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsMeterDefinition_FamilyOperatingParamId" FOREIGN KEY ("FamilyOperatingParamId") REFERENCES "CmmsFamilyOperatingParam" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsMeterDefinition_Type" CHECK (MeterType IN ('absolute','delta')),
  CONSTRAINT "CK_CmmsMeterDefinition_Rollover" CHECK (RollOverAt IS NULL OR RollOverAt > 0)
);
CREATE UNIQUE INDEX "UX_CmmsMeterDefinition_Code" ON "CmmsMeterDefinition" ("AssetId", "MeterCode");
CREATE INDEX "IX_CmmsMeterDefinition_Asset" ON "CmmsMeterDefinition" ("SiteId", "AssetId", "IsActive");


-- CmmsMeterReading · cmms · قرائت کنتور کارکرد
CREATE TABLE IF NOT EXISTS "CmmsMeterReading" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "MeterDefinitionId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "ReadAt" TEXT NOT NULL,
  "ReadOn" TEXT NOT NULL,
  "Value" NUMERIC NOT NULL,
  "Delta" NUMERIC NULL,
  "ReadBy" TEXT NULL,
  "Source" TEXT NOT NULL DEFAULT 'manual',
  "IsEstimated" INTEGER NULL DEFAULT 0,
  "WorkOrderId" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsMeterReading" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsMeterReading_MeterDefinitionId" FOREIGN KEY ("MeterDefinitionId") REFERENCES "CmmsMeterDefinition" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsMeterReading_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsMeterReading_Value" CHECK (Value >= 0),
  CONSTRAINT "CK_CmmsMeterReading_Delta" CHECK (Delta IS NULL OR Delta >= 0),
  CONSTRAINT "CK_CmmsMeterReading_Source" CHECK (Source IN ('manual','scada','iiot','erp'))
);
CREATE UNIQUE INDEX "UX_CmmsMeterReading_Reading" ON "CmmsMeterReading" ("MeterDefinitionId", "ReadAt");
CREATE INDEX "IX_CmmsMeterReading_Asset" ON "CmmsMeterReading" ("SiteId", "AssetId", "ReadOn");


-- CmmsTechnician · cmms · تکنسین نگهداری
CREATE TABLE IF NOT EXISTS "CmmsTechnician" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "TechnicianCode" TEXT NOT NULL,
  "FullNameFa" TEXT NOT NULL,
  "FullNameEn" TEXT NULL,
  "NationalCode" TEXT NULL,
  "PrimaryTrade" TEXT NOT NULL,
  "Grade" TEXT NOT NULL DEFAULT 'junior',
  "CrewId" TEXT NULL,
  "StandardHourlyRate" NUMERIC NULL,
  "Currency" TEXT NULL DEFAULT 'IRR',
  "CapacityHoursPerWeek" NUMERIC NOT NULL DEFAULT 40,
  "EmploymentType" TEXT NOT NULL DEFAULT 'direct',
  "VendorId" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "UserId" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsTechnician" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsTechnician_VendorId" FOREIGN KEY ("VendorId") REFERENCES "CmmsVendor" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsTechnician_Grade" CHECK (Grade IN ('apprentice','junior','senior','expert','master')),
  CONSTRAINT "CK_CmmsTechnician_Employment" CHECK (EmploymentType IN ('direct','contractor','oem')),
  CONSTRAINT "CK_CmmsTechnician_Capacity" CHECK (CapacityHoursPerWeek > 0 AND CapacityHoursPerWeek <= 168),
  CONSTRAINT "CK_CmmsTechnician_Rate" CHECK (StandardHourlyRate IS NULL OR StandardHourlyRate >= 0)
);
CREATE UNIQUE INDEX "UX_CmmsTechnician_Code" ON "CmmsTechnician" ("SiteId", "TechnicianCode");
CREATE INDEX "IX_CmmsTechnician_Trade" ON "CmmsTechnician" ("SiteId", "PrimaryTrade", "IsActive");
CREATE INDEX "IX_CmmsTechnician_Crew" ON "CmmsTechnician" ("SiteId", "CrewId");


-- CmmsTechnicianSkill · cmms · مهارت تکنسین
CREATE TABLE IF NOT EXISTS "CmmsTechnicianSkill" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "TechnicianId" TEXT NOT NULL,
  "SkillKey" TEXT NOT NULL,
  "SkillLevel" INTEGER NOT NULL DEFAULT 1,
  "CertifiedBy" TEXT NULL,
  "CertifiedOn" TEXT NULL,
  "ExpiresOn" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsTechnicianSkill" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsTechnicianSkill_TechnicianId" FOREIGN KEY ("TechnicianId") REFERENCES "CmmsTechnician" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsTechnicianSkill_Level" CHECK (SkillLevel BETWEEN 1 AND 5),
  CONSTRAINT "CK_CmmsTechnicianSkill_Dates" CHECK (ExpiresOn IS NULL OR CertifiedOn IS NULL OR ExpiresOn >= CertifiedOn)
);
CREATE UNIQUE INDEX "UX_CmmsTechnicianSkill_Key" ON "CmmsTechnicianSkill" ("TechnicianId", "SkillKey");
CREATE INDEX "IX_CmmsTechnicianSkill_Skill" ON "CmmsTechnicianSkill" ("SiteId", "SkillKey", "SkillLevel");


-- CmmsCrew · cmms · گروه کاری نت
CREATE TABLE IF NOT EXISTS "CmmsCrew" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "CrewCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "ShiftPattern" TEXT NOT NULL,
  "DailyCapacityHours" NUMERIC NOT NULL DEFAULT 8,
  "SupervisorTechnicianId" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsCrew" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsCrew_SupervisorTechnicianId" FOREIGN KEY ("SupervisorTechnicianId") REFERENCES "CmmsTechnician" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsCrew_Capacity" CHECK (DailyCapacityHours > 0)
);
CREATE UNIQUE INDEX "UX_CmmsCrew_Code" ON "CmmsCrew" ("SiteId", "CrewCode");
CREATE INDEX "IX_CmmsCrew_Active" ON "CmmsCrew" ("SiteId", "IsActive");


-- CmmsShiftCalendar · cmms · تقویم شیفت نت
CREATE TABLE IF NOT EXISTS "CmmsShiftCalendar" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "CrewId" TEXT NULL,
  "CalendarDate" TEXT NOT NULL,
  "DayType" TEXT NOT NULL DEFAULT 'working',
  "CapacityMinutes" INTEGER NOT NULL DEFAULT 480,
  "WindowStart" TEXT NULL,
  "WindowEnd" TEXT NULL,
  "ReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsShiftCalendar" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsShiftCalendar_CrewId" FOREIGN KEY ("CrewId") REFERENCES "CmmsCrew" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsShiftCalendar_Type" CHECK (DayType IN ('working','non-working','holiday','shutdown-window')),
  CONSTRAINT "CK_CmmsShiftCalendar_Capacity" CHECK (CapacityMinutes >= 0 AND CapacityMinutes <= 1440)
);
CREATE UNIQUE INDEX "UX_CmmsShiftCalendar_Date" ON "CmmsShiftCalendar" ("SiteId", "CrewId", "CalendarDate");
CREATE INDEX "IX_CmmsShiftCalendar_Type" ON "CmmsShiftCalendar" ("SiteId", "CalendarDate", "DayType");


-- CmmsTool · cmms · ابزار نگهداری
CREATE TABLE IF NOT EXISTS "CmmsTool" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "ToolCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "ToolType" TEXT NOT NULL,
  "Quantity" INTEGER NOT NULL DEFAULT 1,
  "CalibrationDueOn" TEXT NULL,
  "IsReservedOnly" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsTool" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_CmmsTool_Type" CHECK (ToolType IN ('hand','power','special','calibrated','lifting','safety')),
  CONSTRAINT "CK_CmmsTool_Qty" CHECK (Quantity > 0)
);
CREATE UNIQUE INDEX "UX_CmmsTool_Code" ON "CmmsTool" ("SiteId", "ToolCode");
CREATE INDEX "IX_CmmsTool_Type" ON "CmmsTool" ("SiteId", "ToolType", "IsActive");


-- CmmsSparePart · cmms · قطعهٔ یدکی MRO
CREATE TABLE IF NOT EXISTS "CmmsSparePart" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "PartNumber" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "Category" TEXT NOT NULL,
  "Uom" TEXT NOT NULL,
  "Manufacturer" TEXT NULL,
  "OemPartNumber" TEXT NULL,
  "VendorId" TEXT NULL,
  "ScmWarehouseId" TEXT NULL,
  "UnitCost" NUMERIC NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "QtyOnHand" NUMERIC NULL,
  "MinStock" NUMERIC NULL,
  "MaxStock" NUMERIC NULL,
  "ReorderPoint" NUMERIC NULL,
  "SafetyStock" NUMERIC NULL,
  "LeadTimeDays" NUMERIC NULL,
  "IsCriticalSpare" INTEGER NOT NULL DEFAULT 0,
  "IsConsumable" INTEGER NOT NULL DEFAULT 0,
  "ShelfLifeMonths" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsSparePart" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsSparePart_VendorId" FOREIGN KEY ("VendorId") REFERENCES "CmmsVendor" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsSparePart_Category" CHECK (Category IN ('mechanical','electrical','instrument','consumable','lubricant','seal','bearing','filter')),
  CONSTRAINT "CK_CmmsSparePart_Cost" CHECK (UnitCost IS NULL OR UnitCost >= 0),
  CONSTRAINT "CK_CmmsSparePart_Qty" CHECK (QtyOnHand IS NULL OR QtyOnHand >= 0),
  CONSTRAINT "CK_CmmsSparePart_Levels" CHECK (MinStock IS NULL OR ReorderPoint IS NULL OR ReorderPoint >= MinStock),
  CONSTRAINT "CK_CmmsSparePart_Lead" CHECK (LeadTimeDays IS NULL OR LeadTimeDays >= 0)
);
CREATE UNIQUE INDEX "UX_CmmsSparePart_Number" ON "CmmsSparePart" ("SiteId", "PartNumber");
CREATE INDEX "IX_CmmsSparePart_Category" ON "CmmsSparePart" ("SiteId", "Category", "IsActive");
CREATE INDEX "IX_CmmsSparePart_Critical" ON "CmmsSparePart" ("SiteId", "IsCriticalSpare", "IsActive");


-- CmmsAssetSpareLink · cmms · BOM تعمیراتی تجهیز
CREATE TABLE IF NOT EXISTS "CmmsAssetSpareLink" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NULL,
  "FamilyNodeId" TEXT NULL,
  "SparePartId" TEXT NOT NULL,
  "QuantityPerUnit" NUMERIC NOT NULL,
  "Position" TEXT NULL,
  "IsMandatory" INTEGER NOT NULL DEFAULT 0,
  "ReplacementIntervalHours" NUMERIC NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsAssetSpareLink" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsAssetSpareLink_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAssetSpareLink_FamilyNodeId" FOREIGN KEY ("FamilyNodeId") REFERENCES "CmmsFamilyNode" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAssetSpareLink_SparePartId" FOREIGN KEY ("SparePartId") REFERENCES "CmmsSparePart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsAssetSpareLink_Target" CHECK (AssetId IS NOT NULL OR FamilyNodeId IS NOT NULL),
  CONSTRAINT "CK_CmmsAssetSpareLink_Qty" CHECK (QuantityPerUnit > 0)
);
CREATE UNIQUE INDEX "UX_CmmsAssetSpareLink_Pair" ON "CmmsAssetSpareLink" ("AssetId", "FamilyNodeId", "SparePartId");
CREATE INDEX "IX_CmmsAssetSpareLink_Part" ON "CmmsAssetSpareLink" ("SiteId", "SparePartId");


-- CmmsSpareTransaction · cmms · تراکنش قطعات یدکی
CREATE TABLE IF NOT EXISTS "CmmsSpareTransaction" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "SparePartId" TEXT NOT NULL,
  "TransactionType" TEXT NOT NULL,
  "OccurredAt" TEXT NOT NULL,
  "OccurredOn" TEXT NOT NULL,
  "Quantity" NUMERIC NOT NULL,
  "WorkOrderId" TEXT NULL,
  "AssetId" TEXT NULL,
  "TechnicianId" TEXT NULL,
  "TotalCost" NUMERIC NULL,
  "ReferenceNo" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsSpareTransaction" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsSpareTransaction_SparePartId" FOREIGN KEY ("SparePartId") REFERENCES "CmmsSparePart" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsSpareTransaction_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsSpareTransaction_TechnicianId" FOREIGN KEY ("TechnicianId") REFERENCES "CmmsTechnician" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsSpareTransaction_Type" CHECK (TransactionType IN ('receipt','issue','return','reserve','unreserve','adjust','scrap')),
  CONSTRAINT "CK_CmmsSpareTransaction_Qty" CHECK (Quantity <> 0)
);
CREATE INDEX "IX_CmmsSpareTransaction_Part" ON "CmmsSpareTransaction" ("SparePartId", "OccurredOn");
CREATE INDEX "IX_CmmsSpareTransaction_Wo" ON "CmmsSpareTransaction" ("SiteId", "WorkOrderId");
CREATE INDEX "IX_CmmsSpareTransaction_Type" ON "CmmsSpareTransaction" ("SiteId", "TransactionType", "OccurredOn");


-- CmmsWorkflowDefinition · cmms · تعریف گردش‌کار
CREATE TABLE IF NOT EXISTS "CmmsWorkflowDefinition" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkflowCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "AppliesTo" TEXT NOT NULL,
  "StartStepCode" TEXT NOT NULL,
  "Version" INTEGER NOT NULL DEFAULT 1,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkflowDefinition" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_CmmsWorkflowDefinition_Applies" CHECK (AppliesTo IN ('work-request','work-order','rca','pm-schedule','bulk-change')),
  CONSTRAINT "CK_CmmsWorkflowDefinition_Version" CHECK (Version >= 1)
);
CREATE UNIQUE INDEX "UX_CmmsWorkflowDefinition_Code" ON "CmmsWorkflowDefinition" ("SiteId", "WorkflowCode", "Version");
CREATE INDEX "IX_CmmsWorkflowDefinition_Applies" ON "CmmsWorkflowDefinition" ("SiteId", "AppliesTo", "IsActive");


-- CmmsWorkflowStep · cmms · گام گردش‌کار
CREATE TABLE IF NOT EXISTS "CmmsWorkflowStep" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkflowDefinitionId" TEXT NOT NULL,
  "StepCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "StepKind" TEXT NOT NULL,
  "OwnerRole" TEXT NOT NULL,
  "SlaHours" NUMERIC NULL,
  "IsTerminal" INTEGER NOT NULL DEFAULT 0,
  "RequiresEvidence" INTEGER NOT NULL DEFAULT 0,
  "SortOrder" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkflowStep" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkflowStep_WorkflowDefinitionId" FOREIGN KEY ("WorkflowDefinitionId") REFERENCES "CmmsWorkflowDefinition" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsWorkflowStep_Kind" CHECK (StepKind IN ('task','approval','notification','end')),
  CONSTRAINT "CK_CmmsWorkflowStep_Sla" CHECK (SlaHours IS NULL OR SlaHours > 0)
);
CREATE UNIQUE INDEX "UX_CmmsWorkflowStep_Code" ON "CmmsWorkflowStep" ("WorkflowDefinitionId", "StepCode");
CREATE INDEX "IX_CmmsWorkflowStep_Role" ON "CmmsWorkflowStep" ("SiteId", "OwnerRole");


-- CmmsWorkflowTransition · cmms · گذار گردش‌کار
CREATE TABLE IF NOT EXISTS "CmmsWorkflowTransition" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkflowDefinitionId" TEXT NOT NULL,
  "FromStepCode" TEXT NOT NULL,
  "ToStepCode" TEXT NOT NULL,
  "ActionCode" TEXT NOT NULL,
  "RequiredPermission" TEXT NOT NULL,
  "SortOrder" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkflowTransition" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkflowTransition_WorkflowDefinitionId" FOREIGN KEY ("WorkflowDefinitionId") REFERENCES "CmmsWorkflowDefinition" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsWorkflowTransition_Action" CHECK (ActionCode IN ('submit','approve','reject','assign','complete','cancel','reopen')),
  CONSTRAINT "CK_CmmsWorkflowTransition_Self" CHECK (FromStepCode <> ToStepCode OR ActionCode IN ('reopen','assign'))
);
CREATE UNIQUE INDEX "UX_CmmsWorkflowTransition_Path" ON "CmmsWorkflowTransition" ("WorkflowDefinitionId", "FromStepCode", "ToStepCode", "ActionCode");
CREATE INDEX "IX_CmmsWorkflowTransition_From" ON "CmmsWorkflowTransition" ("WorkflowDefinitionId", "FromStepCode", "IsActive");


-- CmmsWorkflowInstance · cmms · نمونهٔ گردش‌کار
CREATE TABLE IF NOT EXISTS "CmmsWorkflowInstance" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkflowDefinitionId" TEXT NOT NULL,
  "SubjectEntity" TEXT NOT NULL,
  "SubjectId" TEXT NOT NULL,
  "CurrentStepCode" TEXT NOT NULL,
  "State" TEXT NOT NULL DEFAULT 'running',
  "StartedAt" TEXT NULL,
  "CompletedAt" TEXT NULL,
  "CurrentOwnerId" TEXT NULL,
  "DueAt" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkflowInstance" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkflowInstance_WorkflowDefinitionId" FOREIGN KEY ("WorkflowDefinitionId") REFERENCES "CmmsWorkflowDefinition" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsWorkflowInstance_State" CHECK (State IN ('running','completed','cancelled')),
  CONSTRAINT "CK_CmmsWorkflowInstance_Done" CHECK (State <> 'completed' OR CompletedAt IS NOT NULL)
);
CREATE INDEX "IX_CmmsWorkflowInstance_Subject" ON "CmmsWorkflowInstance" ("SiteId", "SubjectEntity", "SubjectId");
CREATE INDEX "IX_CmmsWorkflowInstance_State" ON "CmmsWorkflowInstance" ("SiteId", "State", "CurrentStepCode");
CREATE INDEX "IX_CmmsWorkflowInstance_Owner" ON "CmmsWorkflowInstance" ("SiteId", "CurrentOwnerId", "State");


-- CmmsWorkflowEvent · cmms · رویداد گردش‌کار
CREATE TABLE IF NOT EXISTS "CmmsWorkflowEvent" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkflowInstanceId" TEXT NOT NULL,
  "FromStepCode" TEXT NOT NULL,
  "ToStepCode" TEXT NOT NULL,
  "ActionCode" TEXT NOT NULL,
  "OccurredAt" TEXT NOT NULL,
  "ActorId" TEXT NULL,
  "CommentFa" TEXT NULL,
  "EvidencePath" TEXT NULL,
  "ElapsedHours" NUMERIC NULL,
  "SlaHours" NUMERIC NULL,
  "IsSlaBreached" INTEGER NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkflowEvent" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkflowEvent_WorkflowInstanceId" FOREIGN KEY ("WorkflowInstanceId") REFERENCES "CmmsWorkflowInstance" ("Id") ON DELETE CASCADE
);
CREATE INDEX "IX_CmmsWorkflowEvent_Instance" ON "CmmsWorkflowEvent" ("WorkflowInstanceId", "OccurredAt");
CREATE INDEX "IX_CmmsWorkflowEvent_Actor" ON "CmmsWorkflowEvent" ("SiteId", "ActorId", "OccurredAt");
CREATE INDEX "IX_CmmsWorkflowEvent_Sla" ON "CmmsWorkflowEvent" ("SiteId", "IsSlaBreached");


-- CmmsPmStrategy · cmms · استراتژی نگهداشت
CREATE TABLE IF NOT EXISTS "CmmsPmStrategy" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NULL,
  "AssetId" TEXT NULL,
  "StrategyType" TEXT NOT NULL,
  "SourceAnalysis" TEXT NOT NULL DEFAULT 'manual',
  "RcmAnalysisId" TEXT NULL,
  "ReviewIntervalDays" NUMERIC NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "ApprovedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsPmStrategy" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsPmStrategy_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsPmStrategy_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsPmStrategy_Target" CHECK (FamilyId IS NOT NULL OR AssetId IS NOT NULL),
  CONSTRAINT "CK_CmmsPmStrategy_Type" CHECK (StrategyType IN ('pm','cbm','predictive','risk-based','run-to-failure','zero-breakdown')),
  CONSTRAINT "CK_CmmsPmStrategy_Source" CHECK (SourceAnalysis IN ('manual','rcm','fmea','ai-pm-optimization','pmo-study')),
  CONSTRAINT "CK_CmmsPmStrategy_Status" CHECK (Status IN ('draft','approved','obsolete'))
);
CREATE INDEX "IX_CmmsPmStrategy_Family" ON "CmmsPmStrategy" ("SiteId", "FamilyId", "Status");
CREATE INDEX "IX_CmmsPmStrategy_Asset" ON "CmmsPmStrategy" ("SiteId", "AssetId", "Status");


-- CmmsPmSchedule · cmms · برنامهٔ نگهداشت پیشگیرانه
CREATE TABLE IF NOT EXISTS "CmmsPmSchedule" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NULL,
  "AssetId" TEXT NOT NULL,
  "FamilyPmTaskId" TEXT NULL,
  "StrategyId" TEXT NULL,
  "ScheduleCode" TEXT NOT NULL,
  "TriggerType" TEXT NOT NULL,
  "IntervalValue" NUMERIC NULL,
  "IntervalUnit" TEXT NULL,
  "MeterDefinitionId" TEXT NULL,
  "LastDoneAt" TEXT NULL,
  "LastMeterValue" NUMERIC NULL,
  "NextDueAt" TEXT NULL,
  "NextDueMeterValue" NUMERIC NULL,
  "Priority" INTEGER NOT NULL DEFAULT 3,
  "LeadTimeDays" INTEGER NOT NULL DEFAULT 7,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "OptimizedByAi" INTEGER NULL DEFAULT 0,
  "OptimizationReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsPmSchedule" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsPmSchedule_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsPmSchedule_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsPmSchedule_FamilyPmTaskId" FOREIGN KEY ("FamilyPmTaskId") REFERENCES "CmmsFamilyPmTask" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsPmSchedule_StrategyId" FOREIGN KEY ("StrategyId") REFERENCES "CmmsPmStrategy" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsPmSchedule_MeterDefinitionId" FOREIGN KEY ("MeterDefinitionId") REFERENCES "CmmsMeterDefinition" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsPmSchedule_Trigger" CHECK (TriggerType IN ('time','meter','condition','combined')),
  CONSTRAINT "CK_CmmsPmSchedule_Interval" CHECK (IntervalValue IS NULL OR IntervalValue > 0),
  CONSTRAINT "CK_CmmsPmSchedule_Priority" CHECK (Priority BETWEEN 1 AND 5),
  CONSTRAINT "CK_CmmsPmSchedule_Lead" CHECK (LeadTimeDays >= 0)
);
CREATE UNIQUE INDEX "UX_CmmsPmSchedule_Code" ON "CmmsPmSchedule" ("SiteId", "AssetId", "ScheduleCode");
CREATE INDEX "IX_CmmsPmSchedule_Due" ON "CmmsPmSchedule" ("SiteId", "NextDueAt", "IsActive");
CREATE INDEX "IX_CmmsPmSchedule_Family" ON "CmmsPmSchedule" ("SiteId", "FamilyId", "IsActive");
CREATE INDEX "IX_CmmsPmSchedule_Meter" ON "CmmsPmSchedule" ("SiteId", "MeterDefinitionId");


-- CmmsWorkRequest · cmms · درخواست کار نت
CREATE TABLE IF NOT EXISTS "CmmsWorkRequest" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "RequestNo" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "LocationId" TEXT NULL,
  "RequestType" TEXT NOT NULL,
  "Priority" INTEGER NOT NULL DEFAULT 3,
  "Status" TEXT NOT NULL DEFAULT 'submitted',
  "ReportedOn" TEXT NOT NULL,
  "ReportedAt" TEXT NULL,
  "ReporterId" TEXT NULL,
  "TitleFa" TEXT NOT NULL,
  "DescriptionFa" TEXT NULL,
  "SymptomFa" TEXT NULL,
  "FamilyFailureModeId" TEXT NULL,
  "IsAssetStopped" INTEGER NOT NULL DEFAULT 0,
  "ReviewedById" TEXT NULL,
  "ReviewedAt" TEXT NULL,
  "RejectionReasonFa" TEXT NULL,
  "ConvertedWorkOrderId" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkRequest" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkRequest_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_CmmsWorkRequest_LocationId" FOREIGN KEY ("LocationId") REFERENCES "CmmsLocation" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsWorkRequest_FamilyFailureModeId" FOREIGN KEY ("FamilyFailureModeId") REFERENCES "CmmsFamilyFailureMode" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsWorkRequest_Type" CHECK (RequestType IN ('breakdown','corrective','preventive','improvement','service','inspection')),
  CONSTRAINT "CK_CmmsWorkRequest_Priority" CHECK (Priority BETWEEN 1 AND 5),
  CONSTRAINT "CK_CmmsWorkRequest_Status" CHECK (Status IN ('submitted','under-review','approved','converted','rejected','cancelled')),
  CONSTRAINT "CK_CmmsWorkRequest_Converted" CHECK (Status <> 'converted' OR ConvertedWorkOrderId IS NOT NULL)
);
CREATE UNIQUE INDEX "UX_CmmsWorkRequest_No" ON "CmmsWorkRequest" ("SiteId", "RequestNo");
CREATE INDEX "IX_CmmsWorkRequest_Asset" ON "CmmsWorkRequest" ("SiteId", "AssetId", "Status");
CREATE INDEX "IX_CmmsWorkRequest_Status" ON "CmmsWorkRequest" ("SiteId", "Status", "Priority");


-- CmmsWorkOrder · cmms · دستورکار نت
CREATE TABLE IF NOT EXISTS "CmmsWorkOrder" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkOrderNo" TEXT NOT NULL,
  "WorkOrderType" TEXT NOT NULL,
  "AssetId" TEXT NULL,
  "LocationId" TEXT NULL,
  "WorkRequestId" TEXT NULL,
  "PmScheduleId" TEXT NULL,
  "FamilyPmTaskId" TEXT NULL,
  "TitleFa" TEXT NOT NULL,
  "ScopeFa" TEXT NULL,
  "Priority" INTEGER NOT NULL DEFAULT 3,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "PlannedStartAt" TEXT NULL,
  "PlannedFinishAt" TEXT NULL,
  "ScheduledStartAt" TEXT NULL,
  "ReleasedAt" TEXT NULL,
  "StartedAt" TEXT NULL,
  "CompletedAt" TEXT NULL,
  "ClosedAt" TEXT NULL,
  "EstimatedHours" NUMERIC NULL,
  "ActualHours" NUMERIC NULL,
  "EstimatedCost" NUMERIC NULL,
  "ActualCost" NUMERIC NULL,
  "CrewId" TEXT NULL,
  "PrimaryTechnicianId" TEXT NULL,
  "VendorId" TEXT NULL,
  "WorkflowInstanceId" TEXT NULL,
  "SafetyPermitNo" TEXT NULL,
  "IsAssetDown" INTEGER NOT NULL DEFAULT 0,
  "ProductionImpact" TEXT NOT NULL DEFAULT 'none',
  "CompletedById" TEXT NULL,
  "ClosedById" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkOrder" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkOrder_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsWorkOrder_LocationId" FOREIGN KEY ("LocationId") REFERENCES "CmmsLocation" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsWorkOrder_WorkRequestId" FOREIGN KEY ("WorkRequestId") REFERENCES "CmmsWorkRequest" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsWorkOrder_PmScheduleId" FOREIGN KEY ("PmScheduleId") REFERENCES "CmmsPmSchedule" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsWorkOrder_CrewId" FOREIGN KEY ("CrewId") REFERENCES "CmmsCrew" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsWorkOrder_PrimaryTechnicianId" FOREIGN KEY ("PrimaryTechnicianId") REFERENCES "CmmsTechnician" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsWorkOrder_VendorId" FOREIGN KEY ("VendorId") REFERENCES "CmmsVendor" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsWorkOrder_WorkflowInstanceId" FOREIGN KEY ("WorkflowInstanceId") REFERENCES "CmmsWorkflowInstance" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsWorkOrder_Type" CHECK (WorkOrderType IN ('pm','cm','emergency','overhaul','project','calibration','inspection')),
  CONSTRAINT "CK_CmmsWorkOrder_Priority" CHECK (Priority BETWEEN 1 AND 5),
  CONSTRAINT "CK_CmmsWorkOrder_Status" CHECK (Status IN ('draft','planned','scheduled','released','in-progress','on-hold','completed','closed','cancelled')),
  CONSTRAINT "CK_CmmsWorkOrder_Impact" CHECK (ProductionImpact IN ('none','partial','line-stop','plant-stop')),
  CONSTRAINT "CK_CmmsWorkOrder_Hours" CHECK (ActualHours IS NULL OR ActualHours >= 0),
  CONSTRAINT "CK_CmmsWorkOrder_Release" CHECK (Status NOT IN ('released','in-progress','completed','closed') OR ReleasedAt IS NOT NULL),
  CONSTRAINT "CK_CmmsWorkOrder_Close" CHECK (Status <> 'closed' OR ClosedAt IS NOT NULL)
);
CREATE UNIQUE INDEX "UX_CmmsWorkOrder_No" ON "CmmsWorkOrder" ("SiteId", "WorkOrderNo");
CREATE INDEX "IX_CmmsWorkOrder_Asset" ON "CmmsWorkOrder" ("SiteId", "AssetId", "Status");
CREATE INDEX "IX_CmmsWorkOrder_Status" ON "CmmsWorkOrder" ("SiteId", "Status", "Priority");
CREATE INDEX "IX_CmmsWorkOrder_Schedule" ON "CmmsWorkOrder" ("SiteId", "ScheduledStartAt", "Status");
CREATE INDEX "IX_CmmsWorkOrder_Technician" ON "CmmsWorkOrder" ("SiteId", "PrimaryTechnicianId", "Status");


-- CmmsWorkOrderTask · cmms · ردیف چک‌لیست دستورکار
CREATE TABLE IF NOT EXISTS "CmmsWorkOrderTask" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkOrderId" TEXT NOT NULL,
  "FamilyPmTaskId" TEXT NULL,
  "ChecklistItemId" TEXT NULL,
  "LineNo" INTEGER NOT NULL,
  "DescriptionFa" TEXT NOT NULL,
  "ResultStatus" TEXT NOT NULL DEFAULT 'pending',
  "MeasuredValueText" TEXT NULL,
  "MeasuredValueNumber" NUMERIC NULL,
  "PlannedMinutes" NUMERIC NULL,
  "ActualMinutes" NUMERIC NULL,
  "PerformedBy" TEXT NULL,
  "PerformedAt" TEXT NULL,
  "FindingFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkOrderTask" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkOrderTask_WorkOrderId" FOREIGN KEY ("WorkOrderId") REFERENCES "CmmsWorkOrder" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsWorkOrderTask_FamilyPmTaskId" FOREIGN KEY ("FamilyPmTaskId") REFERENCES "CmmsFamilyPmTask" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsWorkOrderTask_ChecklistItemId" FOREIGN KEY ("ChecklistItemId") REFERENCES "CmmsPmChecklistItem" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsWorkOrderTask_Line" CHECK (LineNo > 0),
  CONSTRAINT "CK_CmmsWorkOrderTask_Result" CHECK (ResultStatus IN ('pending','pass','fail','na','deferred'))
);
CREATE UNIQUE INDEX "UX_CmmsWorkOrderTask_Line" ON "CmmsWorkOrderTask" ("WorkOrderId", "LineNo");
CREATE INDEX "IX_CmmsWorkOrderTask_Result" ON "CmmsWorkOrderTask" ("SiteId", "ResultStatus");


-- CmmsWorkOrderLabor · cmms · نفرساعت دستورکار
CREATE TABLE IF NOT EXISTS "CmmsWorkOrderLabor" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkOrderId" TEXT NOT NULL,
  "TechnicianId" TEXT NOT NULL,
  "WorkDate" TEXT NOT NULL,
  "StartTime" TEXT NOT NULL,
  "EndTime" TEXT NOT NULL,
  "RegularHours" NUMERIC NOT NULL,
  "OvertimeHours" NUMERIC NULL,
  "LaborRate" NUMERIC NOT NULL,
  "LaborCost" NUMERIC NULL,
  "IsOvertime" INTEGER NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkOrderLabor" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkOrderLabor_WorkOrderId" FOREIGN KEY ("WorkOrderId") REFERENCES "CmmsWorkOrder" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsWorkOrderLabor_TechnicianId" FOREIGN KEY ("TechnicianId") REFERENCES "CmmsTechnician" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsWorkOrderLabor_Hours" CHECK (RegularHours >= 0 AND RegularHours <= 24),
  CONSTRAINT "CK_CmmsWorkOrderLabor_OT" CHECK (OvertimeHours IS NULL OR (OvertimeHours >= 0 AND OvertimeHours <= 24)),
  CONSTRAINT "CK_CmmsWorkOrderLabor_Rate" CHECK (LaborRate >= 0)
);
CREATE INDEX "IX_CmmsWorkOrderLabor_Wo" ON "CmmsWorkOrderLabor" ("WorkOrderId", "WorkDate");
CREATE INDEX "IX_CmmsWorkOrderLabor_Tech" ON "CmmsWorkOrderLabor" ("SiteId", "TechnicianId", "WorkDate");


-- CmmsWorkOrderMaterial · cmms · قطعات مصرفی دستورکار
CREATE TABLE IF NOT EXISTS "CmmsWorkOrderMaterial" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkOrderId" TEXT NOT NULL,
  "SparePartId" TEXT NOT NULL,
  "Quantity" NUMERIC NOT NULL,
  "IssuedOn" TEXT NOT NULL,
  "UnitCost" NUMERIC NULL,
  "TotalCost" NUMERIC NULL,
  "IssuedBy" TEXT NULL,
  "LineType" TEXT NOT NULL DEFAULT 'planned',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkOrderMaterial" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkOrderMaterial_WorkOrderId" FOREIGN KEY ("WorkOrderId") REFERENCES "CmmsWorkOrder" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsWorkOrderMaterial_SparePartId" FOREIGN KEY ("SparePartId") REFERENCES "CmmsSparePart" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsWorkOrderMaterial_Qty" CHECK (Quantity > 0),
  CONSTRAINT "CK_CmmsWorkOrderMaterial_Line" CHECK (LineType IN ('planned','actual','returned'))
);
CREATE INDEX "IX_CmmsWorkOrderMaterial_Wo" ON "CmmsWorkOrderMaterial" ("WorkOrderId", "IssuedOn");
CREATE INDEX "IX_CmmsWorkOrderMaterial_Part" ON "CmmsWorkOrderMaterial" ("SiteId", "SparePartId");


-- CmmsWorkOrderCost · cmms · هزینهٔ دستورکار
CREATE TABLE IF NOT EXISTS "CmmsWorkOrderCost" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkOrderId" TEXT NOT NULL,
  "CostElement" TEXT NOT NULL,
  "Amount" NUMERIC NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "PostedOn" TEXT NOT NULL,
  "CostCenterRef" TEXT NULL,
  "VendorId" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkOrderCost" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkOrderCost_WorkOrderId" FOREIGN KEY ("WorkOrderId") REFERENCES "CmmsWorkOrder" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsWorkOrderCost_VendorId" FOREIGN KEY ("VendorId") REFERENCES "CmmsVendor" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsWorkOrderCost_Element" CHECK (CostElement IN ('labor','material','contract','tool','overhead','downtime-loss')),
  CONSTRAINT "CK_CmmsWorkOrderCost_Amount" CHECK (Amount IS NULL OR Amount >= 0)
);
CREATE INDEX "IX_CmmsWorkOrderCost_Wo" ON "CmmsWorkOrderCost" ("WorkOrderId", "PostedOn");
CREATE INDEX "IX_CmmsWorkOrderCost_Element" ON "CmmsWorkOrderCost" ("SiteId", "CostElement", "PostedOn");


-- CmmsFailureRecord · cmms · ثبت خرابی (ISO 14224)
CREATE TABLE IF NOT EXISTS "CmmsFailureRecord" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "FamilyFailureModeId" TEXT NULL,
  "FamilyNodeId" TEXT NULL,
  "FailureMode" TEXT NOT NULL,
  "FailureMechanism" TEXT NOT NULL,
  "FailureSubMechanism" TEXT NULL,
  "Iso14224Code" TEXT NULL,
  "DetectedAt" TEXT NOT NULL,
  "DetectedOn" TEXT NOT NULL,
  "DetectedBy" TEXT NULL,
  "DetectionMethod" TEXT NOT NULL,
  "RestoredAt" TEXT NULL,
  "DowntimeHours" NUMERIC NULL,
  "RepairHours" NUMERIC NULL,
  "RunningHoursBefore" NUMERIC NULL,
  "WorkOrderId" TEXT NULL,
  "RcaCaseId" TEXT NULL,
  "Consequence" TEXT NOT NULL DEFAULT 'non-operational',
  "DescriptionFa" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFailureRecord" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFailureRecord_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsFailureRecord_FamilyFailureModeId" FOREIGN KEY ("FamilyFailureModeId") REFERENCES "CmmsFamilyFailureMode" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsFailureRecord_FamilyNodeId" FOREIGN KEY ("FamilyNodeId") REFERENCES "CmmsFamilyNode" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsFailureRecord_Detection" CHECK (DetectionMethod IN ('operator','inspection','cbm','alarm','breakdown-report','other')),
  CONSTRAINT "CK_CmmsFailureRecord_Consequence" CHECK (Consequence IN ('safety-environmental','operational','non-operational','hidden')),
  CONSTRAINT "CK_CmmsFailureRecord_Downtime" CHECK (DowntimeHours IS NULL OR DowntimeHours >= 0),
  CONSTRAINT "CK_CmmsFailureRecord_Restore" CHECK (RestoredAt IS NULL OR RestoredAt >= DetectedAt)
);
CREATE INDEX "IX_CmmsFailureRecord_Asset" ON "CmmsFailureRecord" ("SiteId", "AssetId", "DetectedOn");
CREATE INDEX "IX_CmmsFailureRecord_Mode" ON "CmmsFailureRecord" ("SiteId", "FailureMode", "FailureMechanism");
CREATE INDEX "IX_CmmsFailureRecord_Wo" ON "CmmsFailureRecord" ("SiteId", "WorkOrderId");


-- CmmsDowntimeRecord · cmms · ثبت توقف تجهیز
CREATE TABLE IF NOT EXISTS "CmmsDowntimeRecord" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "StartedAt" TEXT NOT NULL,
  "EndedAt" TEXT NULL,
  "DowntimeType" TEXT NOT NULL,
  "DurationHours" NUMERIC NULL,
  "CausedByMaintenance" INTEGER NOT NULL DEFAULT 1,
  "ProductionImpact" TEXT NOT NULL DEFAULT 'none',
  "CustomersAffected" NUMERIC NULL,
  "WorkOrderId" TEXT NULL,
  "FailureRecordId" TEXT NULL,
  "ReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsDowntimeRecord" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsDowntimeRecord_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsDowntimeRecord_FailureRecordId" FOREIGN KEY ("FailureRecordId") REFERENCES "CmmsFailureRecord" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsDowntimeRecord_Type" CHECK (DowntimeType IN ('planned','unplanned','standby','waiting-for-parts','waiting-for-crew','no-demand')),
  CONSTRAINT "CK_CmmsDowntimeRecord_Impact" CHECK (ProductionImpact IN ('none','partial','line-stop','plant-stop')),
  CONSTRAINT "CK_CmmsDowntimeRecord_End" CHECK (EndedAt IS NULL OR EndedAt >= StartedAt),
  CONSTRAINT "CK_CmmsDowntimeRecord_Duration" CHECK (DurationHours IS NULL OR DurationHours >= 0)
);
CREATE INDEX "IX_CmmsDowntimeRecord_Asset" ON "CmmsDowntimeRecord" ("SiteId", "AssetId", "StartedAt");
CREATE INDEX "IX_CmmsDowntimeRecord_Type" ON "CmmsDowntimeRecord" ("SiteId", "DowntimeType", "StartedAt");


-- CmmsConditionThreshold · cmms · آستانهٔ پایش وضعیت
CREATE TABLE IF NOT EXISTS "CmmsConditionThreshold" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyConditionParamId" TEXT NOT NULL,
  "AssetId" TEXT NULL,
  "MachineClass" TEXT NOT NULL DEFAULT 'group2',
  "RigidSupport" INTEGER NOT NULL DEFAULT 1,
  "ZoneAUpper" NUMERIC NULL,
  "ZoneBUpper" NUMERIC NULL,
  "ZoneCUpper" NUMERIC NULL,
  "ZoneDefinitionRef" TEXT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsConditionThreshold" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsConditionThreshold_FamilyConditionParamId" FOREIGN KEY ("FamilyConditionParamId") REFERENCES "CmmsFamilyConditionParam" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsConditionThreshold_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsConditionThreshold_Class" CHECK (MachineClass IN ('group1','group2','group3','group4')),
  CONSTRAINT "CK_CmmsConditionThreshold_Zones" CHECK (ZoneBUpper IS NULL OR ZoneAUpper IS NULL OR ZoneBUpper > ZoneAUpper),
  CONSTRAINT "CK_CmmsConditionThreshold_ZonesC" CHECK (ZoneCUpper IS NULL OR ZoneBUpper IS NULL OR ZoneCUpper > ZoneBUpper)
);
CREATE UNIQUE INDEX "UX_CmmsConditionThreshold_Param" ON "CmmsConditionThreshold" ("FamilyConditionParamId", "AssetId");
CREATE INDEX "IX_CmmsConditionThreshold_Class" ON "CmmsConditionThreshold" ("SiteId", "MachineClass");


-- CmmsConditionReading · cmms · قرائت پایش وضعیت
CREATE TABLE IF NOT EXISTS "CmmsConditionReading" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "FamilyConditionParamId" TEXT NOT NULL,
  "MeasuredAt" TEXT NOT NULL,
  "MeasuredOn" TEXT NOT NULL,
  "Value" NUMERIC NULL,
  "Uom" TEXT NOT NULL,
  "Zone" TEXT NULL,
  "Source" TEXT NULL DEFAULT 'manual',
  "AnalystId" TEXT NULL,
  "WorkOrderId" TEXT NULL,
  "TrendDirection" TEXT NULL,
  "RateOfChange" NUMERIC NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsConditionReading" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsConditionReading_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsConditionReading_FamilyConditionParamId" FOREIGN KEY ("FamilyConditionParamId") REFERENCES "CmmsFamilyConditionParam" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsConditionReading_Zone" CHECK (Zone IS NULL OR Zone IN ('A','B','C','D')),
  CONSTRAINT "CK_CmmsConditionReading_Source" CHECK (Source IS NULL OR Source IN ('manual','iiot','scada','portable','lab')),
  CONSTRAINT "CK_CmmsConditionReading_Trend" CHECK (TrendDirection IS NULL OR TrendDirection IN ('rising','falling','stable'))
);
CREATE INDEX "IX_CmmsConditionReading_Asset" ON "CmmsConditionReading" ("SiteId", "AssetId", "MeasuredOn");
CREATE INDEX "IX_CmmsConditionReading_Param" ON "CmmsConditionReading" ("FamilyConditionParamId", "MeasuredAt");
CREATE INDEX "IX_CmmsConditionReading_Zone" ON "CmmsConditionReading" ("SiteId", "Zone", "MeasuredOn");


-- CmmsFmeaRecord · cmms · تحلیل FMEA/FMECA
CREATE TABLE IF NOT EXISTS "CmmsFmeaRecord" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NULL,
  "AssetId" TEXT NULL,
  "AnalysisCode" TEXT NOT NULL,
  "AnalysisType" TEXT NOT NULL DEFAULT 'fmea',
  "Methodology" TEXT NOT NULL DEFAULT 'IEC 60812',
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "TeamLeadId" TEXT NULL,
  "AnalyzedOn" TEXT NULL,
  "ReviewedOn" TEXT NULL,
  "MaxRpnThreshold" NUMERIC NULL,
  "TotalRpn" NUMERIC NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFmeaRecord" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFmeaRecord_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsFmeaRecord_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsFmeaRecord_Target" CHECK (FamilyId IS NOT NULL OR AssetId IS NOT NULL),
  CONSTRAINT "CK_CmmsFmeaRecord_Type" CHECK (AnalysisType IN ('fmea','fmeca')),
  CONSTRAINT "CK_CmmsFmeaRecord_Status" CHECK (Status IN ('draft','in-review','approved','obsolete')),
  CONSTRAINT "CK_CmmsFmeaRecord_Threshold" CHECK (MaxRpnThreshold IS NULL OR MaxRpnThreshold > 0)
);
CREATE UNIQUE INDEX "UX_CmmsFmeaRecord_Code" ON "CmmsFmeaRecord" ("SiteId", "AnalysisCode");
CREATE INDEX "IX_CmmsFmeaRecord_Family" ON "CmmsFmeaRecord" ("SiteId", "FamilyId", "Status");


-- CmmsFmeaEntry · cmms · ردیف FMEA
CREATE TABLE IF NOT EXISTS "CmmsFmeaEntry" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FmeaRecordId" TEXT NOT NULL,
  "FamilyFailureModeId" TEXT NULL,
  "FamilyNodeId" TEXT NULL,
  "FunctionFa" TEXT NOT NULL,
  "FailureModeText" TEXT NOT NULL,
  "EffectFa" TEXT NOT NULL,
  "CauseFa" TEXT NOT NULL,
  "CurrentControlFa" TEXT NULL,
  "Severity" INTEGER NOT NULL,
  "Occurrence" INTEGER NOT NULL,
  "Detection" INTEGER NOT NULL,
  "Rpn" INTEGER NOT NULL,
  "ActionPriority" TEXT NULL,
  "FailureRatePerHour" NUMERIC NULL,
  "BetaFactor" NUMERIC NULL,
  "MissionTimeHours" NUMERIC NULL,
  "CriticalityNumber" NUMERIC NULL,
  "RecommendedActionFa" TEXT NOT NULL,
  "ActionOwnerId" TEXT NULL,
  "ActionDueOn" TEXT NULL,
  "SortOrder" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsFmeaEntry" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsFmeaEntry_FmeaRecordId" FOREIGN KEY ("FmeaRecordId") REFERENCES "CmmsFmeaRecord" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsFmeaEntry_FamilyFailureModeId" FOREIGN KEY ("FamilyFailureModeId") REFERENCES "CmmsFamilyFailureMode" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsFmeaEntry_FamilyNodeId" FOREIGN KEY ("FamilyNodeId") REFERENCES "CmmsFamilyNode" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsFmeaEntry_Severity" CHECK (Severity BETWEEN 1 AND 10),
  CONSTRAINT "CK_CmmsFmeaEntry_Occurrence" CHECK (Occurrence BETWEEN 1 AND 10),
  CONSTRAINT "CK_CmmsFmeaEntry_Detection" CHECK (Detection BETWEEN 1 AND 10),
  CONSTRAINT "CK_CmmsFmeaEntry_Rpn" CHECK (Rpn BETWEEN 1 AND 1000),
  CONSTRAINT "CK_CmmsFmeaEntry_AP" CHECK (ActionPriority IS NULL OR ActionPriority IN ('high','medium','low'))
);
CREATE INDEX "IX_CmmsFmeaEntry_Record" ON "CmmsFmeaEntry" ("FmeaRecordId", "SortOrder");
CREATE INDEX "IX_CmmsFmeaEntry_Rpn" ON "CmmsFmeaEntry" ("SiteId", "Rpn", "ActionPriority");


-- CmmsRcmAnalysis · cmms · تحلیل RCM
CREATE TABLE IF NOT EXISTS "CmmsRcmAnalysis" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "AnalysisCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "TeamLeadId" TEXT NULL,
  "AnalyzedOn" TEXT NULL,
  "FunctionCount" INTEGER NOT NULL DEFAULT 0,
  "FailureModeCount" INTEGER NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsRcmAnalysis" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsRcmAnalysis_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsRcmAnalysis_Status" CHECK (Status IN ('draft','in-review','approved','obsolete')),
  CONSTRAINT "CK_CmmsRcmAnalysis_Counts" CHECK (FunctionCount >= 0 AND FailureModeCount >= 0)
);
CREATE UNIQUE INDEX "UX_CmmsRcmAnalysis_Code" ON "CmmsRcmAnalysis" ("SiteId", "AnalysisCode");
CREATE INDEX "IX_CmmsRcmAnalysis_Family" ON "CmmsRcmAnalysis" ("SiteId", "FamilyId", "Status");


-- CmmsRcmEntry · cmms · ردیف تصمیم RCM
CREATE TABLE IF NOT EXISTS "CmmsRcmEntry" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "RcmAnalysisId" TEXT NOT NULL,
  "FamilyFailureModeId" TEXT NULL,
  "FunctionStatementFa" TEXT NOT NULL,
  "FunctionalFailureFa" TEXT NOT NULL,
  "FailureMode" TEXT NOT NULL,
  "Consequence" TEXT NOT NULL,
  "IsHiddenFailure" INTEGER NOT NULL DEFAULT 0,
  "IsConditionMonitorable" INTEGER NOT NULL DEFAULT 0,
  "HasAgeRelatedPattern" INTEGER NOT NULL DEFAULT 0,
  "SelectedTask" TEXT NOT NULL,
  "TaskInterval" NUMERIC NULL,
  "TaskIntervalUnit" TEXT NULL,
  "DecisionPathJson" TEXT NULL,
  "SortOrder" INTEGER NOT NULL DEFAULT 0,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsRcmEntry" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsRcmEntry_RcmAnalysisId" FOREIGN KEY ("RcmAnalysisId") REFERENCES "CmmsRcmAnalysis" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsRcmEntry_FamilyFailureModeId" FOREIGN KEY ("FamilyFailureModeId") REFERENCES "CmmsFamilyFailureMode" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsRcmEntry_Consequence" CHECK (Consequence IN ('safety-environmental','operational','non-operational','hidden')),
  CONSTRAINT "CK_CmmsRcmEntry_Task" CHECK (SelectedTask IN ('condition-based','scheduled-restoration','scheduled-discard','failure-finding','run-to-failure','redesign')),
  CONSTRAINT "CK_CmmsRcmEntry_Interval" CHECK (TaskInterval IS NULL OR TaskInterval > 0)
);
CREATE INDEX "IX_CmmsRcmEntry_Analysis" ON "CmmsRcmEntry" ("RcmAnalysisId", "SortOrder");
CREATE INDEX "IX_CmmsRcmEntry_Task" ON "CmmsRcmEntry" ("SiteId", "SelectedTask", "Consequence");


-- CmmsMaintenancePlan · cmms · برنامهٔ نگهداشت مصوب
CREATE TABLE IF NOT EXISTS "CmmsMaintenancePlan" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "FamilyId" TEXT NOT NULL,
  "RcmAnalysisId" TEXT NULL,
  "FmeaRecordId" TEXT NULL,
  "PlanCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "StrategyType" TEXT NOT NULL,
  "Version" INTEGER NOT NULL DEFAULT 1,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "ApprovedAt" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "EffectiveFrom" TEXT NULL,
  "EffectiveTo" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsMaintenancePlan" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsMaintenancePlan_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsMaintenancePlan_RcmAnalysisId" FOREIGN KEY ("RcmAnalysisId") REFERENCES "CmmsRcmAnalysis" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsMaintenancePlan_FmeaRecordId" FOREIGN KEY ("FmeaRecordId") REFERENCES "CmmsFmeaRecord" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsMaintenancePlan_Strategy" CHECK (StrategyType IN ('pm','cbm','predictive','risk-based','run-to-failure','zero-breakdown')),
  CONSTRAINT "CK_CmmsMaintenancePlan_Status" CHECK (Status IN ('draft','approved','active','obsolete')),
  CONSTRAINT "CK_CmmsMaintenancePlan_Dates" CHECK (EffectiveTo IS NULL OR EffectiveFrom IS NULL OR EffectiveTo >= EffectiveFrom)
);
CREATE UNIQUE INDEX "UX_CmmsMaintenancePlan_Code" ON "CmmsMaintenancePlan" ("SiteId", "PlanCode", "Version");
CREATE INDEX "IX_CmmsMaintenancePlan_Family" ON "CmmsMaintenancePlan" ("SiteId", "FamilyId", "Status");


-- CmmsRcaCase · cmms · پروندهٔ تحلیل ریشه‌ای
CREATE TABLE IF NOT EXISTS "CmmsRcaCase" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "CaseNo" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "FailureRecordId" TEXT NULL,
  "WorkOrderId" TEXT NULL,
  "Method" TEXT NOT NULL DEFAULT 'five-why',
  "Status" TEXT NOT NULL DEFAULT 'open',
  "OpenedOn" TEXT NOT NULL,
  "OpenedById" TEXT NULL,
  "ClosedOn" TEXT NULL,
  "ProblemStatementFa" TEXT NOT NULL,
  "RootCauseFa" TEXT NULL,
  "WhyDepth" INTEGER NOT NULL DEFAULT 0,
  "CorrectiveActionFa" TEXT NULL,
  "PreventiveActionFa" TEXT NULL,
  "EffectivenessVerifiedOn" TEXT NULL,
  "EstimatedAvoidedCost" NUMERIC NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsRcaCase" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsRcaCase_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsRcaCase_FailureRecordId" FOREIGN KEY ("FailureRecordId") REFERENCES "CmmsFailureRecord" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsRcaCase_Method" CHECK (Method IN ('five-why','fishbone','apollo','fault-tree','combined')),
  CONSTRAINT "CK_CmmsRcaCase_Status" CHECK (Status IN ('open','in-progress','closed','verified')),
  CONSTRAINT "CK_CmmsRcaCase_Depth" CHECK (WhyDepth >= 0 AND WhyDepth <= 10)
);
CREATE UNIQUE INDEX "UX_CmmsRcaCase_No" ON "CmmsRcaCase" ("SiteId", "CaseNo");
CREATE INDEX "IX_CmmsRcaCase_Asset" ON "CmmsRcaCase" ("SiteId", "AssetId", "Status");
CREATE INDEX "IX_CmmsRcaCase_Failure" ON "CmmsRcaCase" ("SiteId", "FailureRecordId");


-- CmmsRcaEntry · cmms · ردیف تحلیل ریشه‌ای
CREATE TABLE IF NOT EXISTS "CmmsRcaEntry" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "RcaCaseId" TEXT NOT NULL,
  "EntryType" TEXT NOT NULL,
  "Sequence" INTEGER NOT NULL,
  "ParentEntryId" TEXT NULL,
  "StatementFa" TEXT NOT NULL,
  "FishboneCategory" TEXT NULL,
  "IsRootCause" INTEGER NOT NULL DEFAULT 0,
  "EvidencePath" TEXT NULL,
  "OwnerId" TEXT NULL,
  "DueOn" TEXT NULL,
  "CompletedOn" TEXT NULL,
  "AiSuggested" INTEGER NULL DEFAULT 0,
  "AiConfidence" NUMERIC NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsRcaEntry" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsRcaEntry_RcaCaseId" FOREIGN KEY ("RcaCaseId") REFERENCES "CmmsRcaCase" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsRcaEntry_ParentEntryId" FOREIGN KEY ("ParentEntryId") REFERENCES "CmmsRcaEntry" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsRcaEntry_Type" CHECK (EntryType IN ('why','cause-branch','evidence','corrective-action','preventive-action')),
  CONSTRAINT "CK_CmmsRcaEntry_Seq" CHECK (Sequence >= 1),
  CONSTRAINT "CK_CmmsRcaEntry_Fishbone" CHECK (FishboneCategory IS NULL OR FishboneCategory IN ('man','machine','method','material','measurement','environment')),
  CONSTRAINT "CK_CmmsRcaEntry_Confidence" CHECK (AiConfidence IS NULL OR (AiConfidence >= 0 AND AiConfidence <= 1)),
  CONSTRAINT "CK_CmmsRcaEntry_Self" CHECK (ParentEntryId IS NULL OR ParentEntryId <> Id)
);
CREATE UNIQUE INDEX "UX_CmmsRcaEntry_Seq" ON "CmmsRcaEntry" ("RcaCaseId", "EntryType", "Sequence");
CREATE INDEX "IX_CmmsRcaEntry_Root" ON "CmmsRcaEntry" ("SiteId", "IsRootCause");


-- CmmsReliabilitySnapshot · cmms · تصویر قابلیت اطمینان
CREATE TABLE IF NOT EXISTS "CmmsReliabilitySnapshot" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NULL,
  "FamilyId" TEXT NULL,
  "LocationId" TEXT NULL,
  "PeriodType" TEXT NOT NULL,
  "PeriodStart" TEXT NOT NULL,
  "PeriodEnd" TEXT NOT NULL,
  "CalendarHours" NUMERIC NOT NULL DEFAULT 0,
  "OperatingHours" NUMERIC NOT NULL DEFAULT 0,
  "DowntimeHours" NUMERIC NOT NULL DEFAULT 0,
  "FailureCount" INTEGER NOT NULL DEFAULT 0,
  "MtbfHours" NUMERIC NULL,
  "MttfHours" NUMERIC NULL,
  "MttrHours" NUMERIC NULL,
  "FailureRateLambda" NUMERIC NULL,
  "AvailabilityPct" NUMERIC NULL,
  "InherentAvailabilityPct" NUMERIC NULL,
  "ReliabilityAtMission" NUMERIC NULL,
  "MissionTimeHours" NUMERIC NULL,
  "MeanTimeBetweenPmHours" NUMERIC NULL,
  "PmCompliancePct" NUMERIC NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsReliabilitySnapshot" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsReliabilitySnapshot_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsReliabilitySnapshot_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsReliabilitySnapshot_LocationId" FOREIGN KEY ("LocationId") REFERENCES "CmmsLocation" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsReliabilitySnapshot_Period" CHECK (PeriodType IN ('daily','weekly','monthly','quarterly','yearly')),
  CONSTRAINT "CK_CmmsReliabilitySnapshot_Dates" CHECK (PeriodEnd >= PeriodStart),
  CONSTRAINT "CK_CmmsReliabilitySnapshot_Failures" CHECK (FailureCount >= 0),
  CONSTRAINT "CK_CmmsReliabilitySnapshot_Avail" CHECK (AvailabilityPct IS NULL OR (AvailabilityPct >= 0 AND AvailabilityPct <= 100)),
  CONSTRAINT "CK_CmmsReliabilitySnapshot_Mtbf" CHECK (MtbfHours IS NULL OR MtbfHours > 0)
);
CREATE UNIQUE INDEX "UX_CmmsReliabilitySnapshot_Key" ON "CmmsReliabilitySnapshot" ("SiteId", "AssetId", "FamilyId", "PeriodType", "PeriodStart");
CREATE INDEX "IX_CmmsReliabilitySnapshot_Period" ON "CmmsReliabilitySnapshot" ("SiteId", "PeriodType", "PeriodEnd");


-- CmmsOeeSnapshot · cmms · تصویر OEE
CREATE TABLE IF NOT EXISTS "CmmsOeeSnapshot" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "PeriodType" TEXT NOT NULL,
  "PeriodStart" TEXT NOT NULL,
  "PeriodEnd" TEXT NOT NULL,
  "PlannedProductionHours" NUMERIC NOT NULL DEFAULT 0,
  "RunHours" NUMERIC NOT NULL DEFAULT 0,
  "BreakdownHours" NUMERIC NULL,
  "SetupHours" NUMERIC NULL,
  "MinorStopHours" NUMERIC NULL,
  "ReducedSpeedHours" NUMERIC NULL,
  "StartupRejectUnits" NUMERIC NULL,
  "ProductionRejectUnits" NUMERIC NULL,
  "TotalUnits" NUMERIC NULL,
  "IdealCycleTimeSeconds" NUMERIC NULL,
  "AvailabilityPct" NUMERIC NULL,
  "PerformancePct" NUMERIC NULL,
  "QualityPct" NUMERIC NULL,
  "OeePct" NUMERIC NULL,
  "TeepPct" NUMERIC NULL,
  "CalendarHours" NUMERIC NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsOeeSnapshot" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsOeeSnapshot_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsOeeSnapshot_Period" CHECK (PeriodType IN ('daily','weekly','monthly','quarterly','yearly')),
  CONSTRAINT "CK_CmmsOeeSnapshot_Dates" CHECK (PeriodEnd >= PeriodStart),
  CONSTRAINT "CK_CmmsOeeSnapshot_Oee" CHECK (OeePct IS NULL OR (OeePct >= 0 AND OeePct <= 100)),
  CONSTRAINT "CK_CmmsOeeSnapshot_Avail" CHECK (AvailabilityPct IS NULL OR (AvailabilityPct >= 0 AND AvailabilityPct <= 100)),
  CONSTRAINT "CK_CmmsOeeSnapshot_Units" CHECK (TotalUnits IS NULL OR TotalUnits >= 0)
);
CREATE UNIQUE INDEX "UX_CmmsOeeSnapshot_Key" ON "CmmsOeeSnapshot" ("SiteId", "AssetId", "PeriodType", "PeriodStart");
CREATE INDEX "IX_CmmsOeeSnapshot_Period" ON "CmmsOeeSnapshot" ("SiteId", "PeriodType", "PeriodEnd");


-- CmmsSupplyReliability · cmms · شاخص قابلیت اطمینان IEEE 1366
CREATE TABLE IF NOT EXISTS "CmmsSupplyReliability" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "LocationId" TEXT NULL,
  "PeriodType" TEXT NOT NULL,
  "PeriodStart" TEXT NOT NULL,
  "PeriodEnd" TEXT NOT NULL,
  "CustomersServed" INTEGER NOT NULL DEFAULT 0,
  "TotalInterruptions" INTEGER NOT NULL DEFAULT 0,
  "CustomersInterrupted" INTEGER NOT NULL DEFAULT 0,
  "TotalCustomerInterruptionMinutes" NUMERIC NULL,
  "TotalCustomerMinutesAffected" NUMERIC NULL,
  "SaidiMinutes" NUMERIC NULL,
  "SaifiCount" NUMERIC NULL,
  "CaidiMinutes" NUMERIC NULL,
  "AsaiPct" NUMERIC NULL,
  "MaifiCount" NUMERIC NULL,
  "EnrsCurrency" NUMERIC NULL,
  "ExcludeMajorEvents" INTEGER NOT NULL DEFAULT 0,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsSupplyReliability" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsSupplyReliability_LocationId" FOREIGN KEY ("LocationId") REFERENCES "CmmsLocation" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsSupplyReliability_Period" CHECK (PeriodType IN ('daily','weekly','monthly','quarterly','yearly')),
  CONSTRAINT "CK_CmmsSupplyReliability_Customers" CHECK (CustomersServed >= 0),
  CONSTRAINT "CK_CmmsSupplyReliability_Asai" CHECK (AsaiPct IS NULL OR (AsaiPct >= 0 AND AsaiPct <= 100))
);
CREATE UNIQUE INDEX "UX_CmmsSupplyReliability_Key" ON "CmmsSupplyReliability" ("SiteId", "LocationId", "PeriodType", "PeriodStart");
CREATE INDEX "IX_CmmsSupplyReliability_Period" ON "CmmsSupplyReliability" ("SiteId", "PeriodType", "PeriodEnd");


-- CmmsLccRecord · cmms · هزینهٔ چرخهٔ عمر (LCC)
CREATE TABLE IF NOT EXISTS "CmmsLccRecord" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NOT NULL,
  "ScenarioName" TEXT NULL,
  "AnalysisDate" TEXT NOT NULL,
  "LifeYears" INTEGER NOT NULL,
  "DiscountRatePct" NUMERIC NULL,
  "AcquisitionCost" NUMERIC NULL,
  "InstallationCost" NUMERIC NULL,
  "OperatingCostPerYear" NUMERIC NULL,
  "MaintenanceCostPerYear" NUMERIC NULL,
  "DowntimeLossPerYear" NUMERIC NULL,
  "EnergyCostPerYear" NUMERIC NULL,
  "DisposalCost" NUMERIC NULL,
  "ResidualValue" NUMERIC NULL,
  "NpvAcquisition" NUMERIC NULL,
  "NpvOperation" NUMERIC NULL,
  "NpvMaintenance" NUMERIC NULL,
  "NpvDowntime" NUMERIC NULL,
  "NpvDisposal" NUMERIC NULL,
  "TotalNpv" NUMERIC NULL,
  "CostPerOperatingHour" NUMERIC NULL,
  "CostPerUnitProduced" NUMERIC NULL,
  "IsSelectedOption" INTEGER NOT NULL DEFAULT 0,
  "NoteFa" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsLccRecord" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsLccRecord_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsLccRecord_Life" CHECK (LifeYears > 0),
  CONSTRAINT "CK_CmmsLccRecord_Rate" CHECK (DiscountRatePct IS NULL OR DiscountRatePct >= 0)
);
CREATE INDEX "IX_CmmsLccRecord_Asset" ON "CmmsLccRecord" ("SiteId", "AssetId", "AnalysisDate");
CREATE INDEX "IX_CmmsLccRecord_Selected" ON "CmmsLccRecord" ("SiteId", "IsSelectedOption");


-- CmmsCostRecord · cmms · ثبت هزینهٔ نت
CREATE TABLE IF NOT EXISTS "CmmsCostRecord" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AssetId" TEXT NULL,
  "FamilyId" TEXT NULL,
  "CostElement" TEXT NOT NULL,
  "PeriodType" TEXT NOT NULL,
  "PeriodStart" TEXT NOT NULL,
  "PeriodEnd" TEXT NOT NULL,
  "Amount" NUMERIC NULL,
  "Currency" TEXT NOT NULL DEFAULT 'IRR',
  "WorkOrderId" TEXT NULL,
  "VendorId" TEXT NULL,
  "CostPerReplacementAssetValue" NUMERIC NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsCostRecord" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsCostRecord_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsCostRecord_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsCostRecord_VendorId" FOREIGN KEY ("VendorId") REFERENCES "CmmsVendor" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsCostRecord_Element" CHECK (CostElement IN ('labor','material','contract','tool','overhead','downtime-loss','capital')),
  CONSTRAINT "CK_CmmsCostRecord_Period" CHECK (PeriodType IN ('daily','weekly','monthly','quarterly','yearly')),
  CONSTRAINT "CK_CmmsCostRecord_Dates" CHECK (PeriodEnd >= PeriodStart)
);
CREATE INDEX "IX_CmmsCostRecord_Asset" ON "CmmsCostRecord" ("SiteId", "AssetId", "PeriodStart");
CREATE INDEX "IX_CmmsCostRecord_Element" ON "CmmsCostRecord" ("SiteId", "CostElement", "PeriodType", "PeriodStart");


-- CmmsKpiTarget · cmms · هدف شاخص عملکرد نت
CREATE TABLE IF NOT EXISTS "CmmsKpiTarget" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "KpiCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "Category" TEXT NOT NULL,
  "Uom" TEXT NOT NULL,
  "Direction" TEXT NOT NULL DEFAULT 'maximize',
  "TargetValue" NUMERIC NULL,
  "WarnThreshold" NUMERIC NULL,
  "AlarmThreshold" NUMERIC NULL,
  "PeriodType" TEXT NOT NULL DEFAULT 'monthly',
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "FormulaFa" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsKpiTarget" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_CmmsKpiTarget_Category" CHECK (Category IN ('technical','economic','organizational')),
  CONSTRAINT "CK_CmmsKpiTarget_Direction" CHECK (Direction IN ('maximize','minimize','target')),
  CONSTRAINT "CK_CmmsKpiTarget_Period" CHECK (PeriodType IN ('daily','weekly','monthly','quarterly','yearly'))
);
CREATE UNIQUE INDEX "UX_CmmsKpiTarget_Code" ON "CmmsKpiTarget" ("SiteId", "KpiCode");
CREATE INDEX "IX_CmmsKpiTarget_Category" ON "CmmsKpiTarget" ("SiteId", "Category", "IsActive");


-- CmmsKpiResult · cmms · نتیجهٔ شاخص عملکرد نت
CREATE TABLE IF NOT EXISTS "CmmsKpiResult" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "KpiTargetId" TEXT NOT NULL,
  "AssetId" TEXT NULL,
  "FamilyId" TEXT NULL,
  "PeriodType" TEXT NOT NULL,
  "PeriodStart" TEXT NOT NULL,
  "PeriodEnd" TEXT NOT NULL,
  "ActualValue" NUMERIC NOT NULL,
  "TargetValue" NUMERIC NULL,
  "VariancePct" NUMERIC NULL,
  "Health" TEXT NOT NULL DEFAULT 'green',
  "ComputedBy" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsKpiResult" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsKpiResult_KpiTargetId" FOREIGN KEY ("KpiTargetId") REFERENCES "CmmsKpiTarget" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsKpiResult_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsKpiResult_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_CmmsKpiResult_Health" CHECK (Health IN ('green','amber','red')),
  CONSTRAINT "CK_CmmsKpiResult_Dates" CHECK (PeriodEnd >= PeriodStart)
);
CREATE UNIQUE INDEX "UX_CmmsKpiResult_Key" ON "CmmsKpiResult" ("KpiTargetId", "AssetId", "FamilyId", "PeriodType", "PeriodStart");
CREATE INDEX "IX_CmmsKpiResult_Health" ON "CmmsKpiResult" ("SiteId", "Health", "PeriodEnd");


-- CmmsAlert · cmms · هشدار و اعلان نت
CREATE TABLE IF NOT EXISTS "CmmsAlert" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AlertCode" TEXT NOT NULL,
  "Severity" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "MessageFa" TEXT NULL,
  "AssetId" TEXT NULL,
  "FamilyId" TEXT NULL,
  "WorkOrderId" TEXT NULL,
  "ConditionReadingId" TEXT NULL,
  "AiRecommendationId" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'open',
  "RaisedAt" TEXT NOT NULL,
  "AcknowledgedAt" TEXT NULL,
  "AcknowledgedById" TEXT NULL,
  "ResolvedAt" TEXT NULL,
  "ResolutionNoteFa" TEXT NULL,
  "NotifyInApp" INTEGER NOT NULL DEFAULT 1,
  "NotifyEmail" INTEGER NOT NULL DEFAULT 0,
  "NotifySms" INTEGER NOT NULL DEFAULT 0,
  "DeliveredToJson" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsAlert" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsAlert_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAlert_FamilyId" FOREIGN KEY ("FamilyId") REFERENCES "CmmsFamily" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAlert_WorkOrderId" FOREIGN KEY ("WorkOrderId") REFERENCES "CmmsWorkOrder" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAlert_ConditionReadingId" FOREIGN KEY ("ConditionReadingId") REFERENCES "CmmsConditionReading" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsAlert_Severity" CHECK (Severity IN ('critical','high','medium','low')),
  CONSTRAINT "CK_CmmsAlert_Category" CHECK (Category IN ('condition','pm-due','pm-overdue','spare-shortage','sla-breach','safety','reliability','ai-insight')),
  CONSTRAINT "CK_CmmsAlert_Status" CHECK (Status IN ('open','acknowledged','resolved','suppressed')),
  CONSTRAINT "CK_CmmsAlert_Ack" CHECK (Status NOT IN ('acknowledged','resolved') OR AcknowledgedAt IS NOT NULL)
);
CREATE INDEX "IX_CmmsAlert_Status" ON "CmmsAlert" ("SiteId", "Status", "Severity");
CREATE INDEX "IX_CmmsAlert_Asset" ON "CmmsAlert" ("SiteId", "AssetId", "RaisedAt");
CREATE INDEX "IX_CmmsAlert_Category" ON "CmmsAlert" ("SiteId", "Category", "Status");
CREATE UNIQUE INDEX "UX_CmmsAlert_Code" ON "CmmsAlert" ("SiteId", "AlertCode", "RaisedAt");


-- CmmsAiRun · cmms · اجرای موتور هوش مصنوعی نت
CREATE TABLE IF NOT EXISTS "CmmsAiRun" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "Engine" TEXT NOT NULL,
  "EngineVersion" TEXT NOT NULL,
  "RanAt" TEXT NOT NULL,
  "RanById" TEXT NULL,
  "SubjectEntity" TEXT NULL,
  "SubjectId" TEXT NULL,
  "InputSnapshotJson" TEXT NULL,
  "OutputSummaryJson" TEXT NULL,
  "RecommendationCount" INTEGER NOT NULL DEFAULT 0,
  "ElapsedMilliseconds" NUMERIC NULL,
  "Status" TEXT NOT NULL DEFAULT 'succeeded',
  "ErrorMessageFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsAiRun" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_CmmsAiRun_Engine" CHECK (Engine IN ('failure-analysis','pm-optimization','repair-guidance','tree-generator','smart-scheduler')),
  CONSTRAINT "CK_CmmsAiRun_Status" CHECK (Status IN ('succeeded','failed','partial')),
  CONSTRAINT "CK_CmmsAiRun_Count" CHECK (RecommendationCount >= 0)
);
CREATE INDEX "IX_CmmsAiRun_Engine" ON "CmmsAiRun" ("SiteId", "Engine", "RanAt");
CREATE INDEX "IX_CmmsAiRun_Subject" ON "CmmsAiRun" ("SiteId", "SubjectEntity", "SubjectId");


-- CmmsAiRecommendation · cmms · پیشنهاد هوش مصنوعی نت
CREATE TABLE IF NOT EXISTS "CmmsAiRecommendation" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "AiRunId" TEXT NOT NULL,
  "Engine" TEXT NOT NULL,
  "RecommendationType" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "ExplanationFa" TEXT NULL,
  "Confidence" NUMERIC NULL,
  "Priority" INTEGER NOT NULL DEFAULT 3,
  "AssetId" TEXT NULL,
  "FamilyId" TEXT NULL,
  "WorkOrderId" TEXT NULL,
  "SparePartId" TEXT NULL,
  "TechnicianId" TEXT NULL,
  "SuggestedValueJson" TEXT NULL,
  "EvidenceJson" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'proposed',
  "DecidedById" TEXT NULL,
  "DecidedAt" TEXT NULL,
  "DecisionNoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsAiRecommendation" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsAiRecommendation_AiRunId" FOREIGN KEY ("AiRunId") REFERENCES "CmmsAiRun" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAiRecommendation_AssetId" FOREIGN KEY ("AssetId") REFERENCES "CmmsAsset" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsAiRecommendation_SparePartId" FOREIGN KEY ("SparePartId") REFERENCES "CmmsSparePart" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsAiRecommendation_TechnicianId" FOREIGN KEY ("TechnicianId") REFERENCES "CmmsTechnician" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsAiRecommendation_Confidence" CHECK (Confidence IS NULL OR (Confidence >= 0 AND Confidence <= 1)),
  CONSTRAINT "CK_CmmsAiRecommendation_Priority" CHECK (Priority BETWEEN 1 AND 5),
  CONSTRAINT "CK_CmmsAiRecommendation_Status" CHECK (Status IN ('proposed','accepted','rejected','applied')),
  CONSTRAINT "CK_CmmsAiRecommendation_Type" CHECK (RecommendationType IN ('root-cause','pm-interval','repair-action','spare-needed','tree-node','schedule-slot')),
  CONSTRAINT "CK_CmmsAiRecommendation_Decide" CHECK (Status IN ('proposed','rejected') OR DecidedAt IS NOT NULL)
);
CREATE INDEX "IX_CmmsAiRecommendation_Run" ON "CmmsAiRecommendation" ("AiRunId", "Priority");
CREATE INDEX "IX_CmmsAiRecommendation_Asset" ON "CmmsAiRecommendation" ("SiteId", "AssetId", "Status");
CREATE INDEX "IX_CmmsAiRecommendation_Engine" ON "CmmsAiRecommendation" ("SiteId", "Engine", "RecommendationType");


-- CmmsIntegrationEvent · cmms · رویداد یکپارچگی بین‌بخشی (صف خروجی)
CREATE TABLE IF NOT EXISTS "CmmsIntegrationEvent" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "EventType" TEXT NOT NULL,
  "TargetSystem" TEXT NOT NULL,
  "TargetRef" TEXT NULL,
  "SourceTable" TEXT NOT NULL,
  "SourceId" TEXT NOT NULL,
  "Contract" TEXT NOT NULL DEFAULT 'cmms-mes-v1',
  "IdempotencyKey" TEXT NOT NULL,
  "CorrelationId" TEXT NULL,
  "PayloadJson" TEXT NULL,
  "OccurredAt" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'pending',
  "Attempts" INTEGER NOT NULL DEFAULT 0,
  "LastAttemptAt" TEXT NULL,
  "AcknowledgedAt" TEXT NULL,
  "ExternalRef" TEXT NULL,
  "AckPayloadJson" TEXT NULL,
  "LastErrorCode" TEXT NULL,
  "LastErrorFa" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsIntegrationEvent" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_CmmsIntegrationEvent_Type" CHECK (EventType IN ('downtime.started','downtime.finished','downtime.reported','capacity.block.requested','capacity.block.released')),
  CONSTRAINT "CK_CmmsIntegrationEvent_Target" CHECK (TargetSystem IN ('mes')),
  CONSTRAINT "CK_CmmsIntegrationEvent_Status" CHECK (Status IN ('pending','published','acknowledged','failed','cancelled')),
  CONSTRAINT "CK_CmmsIntegrationEvent_Attempts" CHECK (Attempts >= 0)
);
CREATE UNIQUE INDEX "UX_CmmsIntegrationEvent_Idem" ON "CmmsIntegrationEvent" ("SiteId", "IdempotencyKey");
CREATE INDEX "IX_CmmsIntegrationEvent_Status" ON "CmmsIntegrationEvent" ("SiteId", "Status", "OccurredAt");
CREATE INDEX "IX_CmmsIntegrationEvent_Source" ON "CmmsIntegrationEvent" ("SiteId", "SourceTable", "SourceId");


-- CmmsWorkOrderHold · cmms · توقف دستورکار (Hold)
CREATE TABLE IF NOT EXISTS "CmmsWorkOrderHold" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "WorkOrderId" TEXT NOT NULL,
  "HoldReasonCode" TEXT NOT NULL,
  "HoldCategory" TEXT NOT NULL,
  "DowntimeType" TEXT NOT NULL,
  "PreviousStatus" TEXT NOT NULL,
  "HoldReasonFa" TEXT NOT NULL,
  "NoteFa" TEXT NULL,
  "HeldAt" TEXT NOT NULL,
  "HeldBy" TEXT NOT NULL,
  "ExpectedResumeAt" TEXT NULL,
  "HoldStatus" TEXT NOT NULL DEFAULT 'open',
  "ResumedAt" TEXT NULL,
  "ResumedBy" TEXT NULL,
  "ResumeNoteFa" TEXT NULL,
  "ResumedVia" TEXT NULL,
  "DurationMinutes" INTEGER NULL,
  "DowntimeEventId" TEXT NULL,
  "WorkCenterRef" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsWorkOrderHold" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsWorkOrderHold_WorkOrderId" FOREIGN KEY ("WorkOrderId") REFERENCES "CmmsWorkOrder" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsWorkOrderHold_DowntimeEventId" FOREIGN KEY ("DowntimeEventId") REFERENCES "CmmsIntegrationEvent" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsWorkOrderHold_Category" CHECK (HoldCategory IN ('material','labor','permit','schedule','safety','machine','process','other')),
  CONSTRAINT "CK_CmmsWorkOrderHold_DowntimeType" CHECK (DowntimeType IN ('planned','unplanned')),
  CONSTRAINT "CK_CmmsWorkOrderHold_Status" CHECK (HoldStatus IN ('open','resumed','cancelled')),
  CONSTRAINT "CK_CmmsWorkOrderHold_Previous" CHECK (PreviousStatus IN ('draft','planned','scheduled','released','in-progress')),
  CONSTRAINT "CK_CmmsWorkOrderHold_Open" CHECK (HoldStatus <> 'open' OR ResumedAt IS NULL),
  CONSTRAINT "CK_CmmsWorkOrderHold_Window" CHECK (ResumedAt IS NULL OR ResumedAt >= HeldAt),
  CONSTRAINT "CK_CmmsWorkOrderHold_Duration" CHECK (DurationMinutes IS NULL OR DurationMinutes >= 0)
);
CREATE INDEX "IX_CmmsWorkOrderHold_Wo" ON "CmmsWorkOrderHold" ("SiteId", "WorkOrderId", "HoldStatus");
CREATE INDEX "IX_CmmsWorkOrderHold_Reason" ON "CmmsWorkOrderHold" ("SiteId", "HoldReasonCode", "HeldAt");
CREATE INDEX "IX_CmmsWorkOrderHold_Open" ON "CmmsWorkOrderHold" ("SiteId", "HoldStatus", "HeldAt");


-- CmmsRcfaCause · cmms · علت تحلیل ریشه‌ای (استخوان‌ماهی/پارتو)
CREATE TABLE IF NOT EXISTS "CmmsRcfaCause" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "RcaCaseId" TEXT NOT NULL,
  "ParentCauseId" TEXT NULL,
  "Category" TEXT NOT NULL,
  "StatementFa" TEXT NOT NULL,
  "OccurrenceCount" INTEGER NOT NULL DEFAULT 0,
  "ImpactScore" INTEGER NOT NULL DEFAULT 5,
  "DetectionScore" INTEGER NULL,
  "IsRootCause" INTEGER NOT NULL DEFAULT 0,
  "EvidenceRef" TEXT NULL,
  "VerifiedBy" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "SourceEntryId" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsRcfaCause" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsRcfaCause_RcaCaseId" FOREIGN KEY ("RcaCaseId") REFERENCES "CmmsRcaCase" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsRcfaCause_ParentCauseId" FOREIGN KEY ("ParentCauseId") REFERENCES "CmmsRcfaCause" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "CK_CmmsRcfaCause_Category" CHECK (Category IN ('man','machine','method','material','measurement','environment')),
  CONSTRAINT "CK_CmmsRcfaCause_Occurrence" CHECK (OccurrenceCount >= 0),
  CONSTRAINT "CK_CmmsRcfaCause_Impact" CHECK (ImpactScore >= 1 AND ImpactScore <= 10),
  CONSTRAINT "CK_CmmsRcfaCause_Detection" CHECK (DetectionScore IS NULL OR (DetectionScore >= 1 AND DetectionScore <= 10)),
  CONSTRAINT "CK_CmmsRcfaCause_Self" CHECK (ParentCauseId IS NULL OR ParentCauseId <> Id)
);
CREATE INDEX "IX_CmmsRcfaCause_Case" ON "CmmsRcfaCause" ("SiteId", "RcaCaseId", "Category");
CREATE INDEX "IX_CmmsRcfaCause_Root" ON "CmmsRcfaCause" ("SiteId", "RcaCaseId", "IsRootCause");
CREATE INDEX "IX_CmmsRcfaCause_Branch" ON "CmmsRcfaCause" ("SiteId", "ParentCauseId");


-- CmmsRcfaCapa · cmms · اقدام اصلاحی و پیشگیرانه (CAPA)
CREATE TABLE IF NOT EXISTS "CmmsRcfaCapa" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "RcaCaseId" TEXT NOT NULL,
  "RootCauseId" TEXT NULL,
  "RootCauseRef" TEXT NULL,
  "RootCauseFa" TEXT NULL,
  "ActionType" TEXT NOT NULL,
  "StatementFa" TEXT NOT NULL,
  "Priority" INTEGER NOT NULL DEFAULT 3,
  "Status" TEXT NOT NULL DEFAULT 'draft',
  "OwnerUserId" TEXT NULL,
  "OwnerNameFa" TEXT NULL,
  "DueOn" TEXT NOT NULL,
  "ImplementedAt" TEXT NULL,
  "ImplementedBy" TEXT NULL,
  "ImplementationEvidenceRef" TEXT NULL,
  "VerificationResult" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "VerifiedBy" TEXT NULL,
  "VerificationNoteFa" TEXT NULL,
  "ReferralKind" TEXT NULL,
  "WorkOrderId" TEXT NULL,
  "AutoCreatedWorkOrder" INTEGER NOT NULL DEFAULT 0,
  "EffectivenessVerifiedOn" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsRcfaCapa" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsRcfaCapa_RcaCaseId" FOREIGN KEY ("RcaCaseId") REFERENCES "CmmsRcaCase" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_CmmsRcfaCapa_RootCauseId" FOREIGN KEY ("RootCauseId") REFERENCES "CmmsRcfaCause" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_CmmsRcfaCapa_WorkOrderId" FOREIGN KEY ("WorkOrderId") REFERENCES "CmmsWorkOrder" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsRcfaCapa_Action" CHECK (ActionType IN ('containment','corrective','preventive','detection','systemic')),
  CONSTRAINT "CK_CmmsRcfaCapa_Status" CHECK (Status IN ('draft','assigned','in-progress','implemented','verified','closed','cancelled')),
  CONSTRAINT "CK_CmmsRcfaCapa_Verify" CHECK (VerificationResult IS NULL OR VerificationResult IN ('effective','partially-effective','ineffective')),
  CONSTRAINT "CK_CmmsRcfaCapa_Referral" CHECK (ReferralKind IS NULL OR ReferralKind IN ('work-order','owner','vendor','procedure','training')),
  CONSTRAINT "CK_CmmsRcfaCapa_Priority" CHECK (Priority BETWEEN 1 AND 5),
  CONSTRAINT "CK_CmmsRcfaCapa_Done" CHECK (Status NOT IN ('implemented','verified','closed') OR ImplementedAt IS NOT NULL),
  CONSTRAINT "CK_CmmsRcfaCapa_Verified" CHECK (Status <> 'verified' OR VerificationResult IS NOT NULL)
);
CREATE INDEX "IX_CmmsRcfaCapa_Case" ON "CmmsRcfaCapa" ("SiteId", "RcaCaseId", "Status");
CREATE INDEX "IX_CmmsRcfaCapa_Owner" ON "CmmsRcfaCapa" ("OwnerUserId", "DueOn");
CREATE INDEX "IX_CmmsRcfaCapa_WorkOrder" ON "CmmsRcfaCapa" ("WorkOrderId");


-- CmmsCapacityBlock · cmms · بلوکه‌سازی نرم ظرفیت مرکز کاری
CREATE TABLE IF NOT EXISTS "CmmsCapacityBlock" (
  "Id" TEXT NOT NULL,
  "SiteId" TEXT NOT NULL,
  "BlockNo" TEXT NOT NULL,
  "PlantRef" TEXT NULL,
  "WorkCenterRef" TEXT NOT NULL,
  "SourceType" TEXT NOT NULL,
  "SourceRef" TEXT NULL,
  "WindowStart" TEXT NOT NULL,
  "WindowEnd" TEXT NOT NULL,
  "ReservedMinutes" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'requested',
  "ReasonFa" TEXT NOT NULL,
  "IsSoft" INTEGER NOT NULL DEFAULT 1,
  "RequestedAt" TEXT NOT NULL,
  "RequestedBy" TEXT NOT NULL,
  "AcknowledgedAt" TEXT NULL,
  "ExternalRef" TEXT NULL,
  "IntegrationEventId" TEXT NULL,
  "ReleasedAt" TEXT NULL,
  "ReleasedBy" TEXT NULL,
  "ReleaseReasonFa" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_CmmsCapacityBlock" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_CmmsCapacityBlock_IntegrationEventId" FOREIGN KEY ("IntegrationEventId") REFERENCES "CmmsIntegrationEvent" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_CmmsCapacityBlock_Source" CHECK (SourceType IN ('pm-schedule','work-order','shutdown','manual')),
  CONSTRAINT "CK_CmmsCapacityBlock_Status" CHECK (Status IN ('requested','active','released','rejected','cancelled')),
  CONSTRAINT "CK_CmmsCapacityBlock_Window" CHECK (WindowEnd > WindowStart),
  CONSTRAINT "CK_CmmsCapacityBlock_Minutes" CHECK (ReservedMinutes >= 0),
  CONSTRAINT "CK_CmmsCapacityBlock_Release" CHECK (Status <> 'released' OR ReleasedAt IS NOT NULL)
);
CREATE UNIQUE INDEX "UX_CmmsCapacityBlock_No" ON "CmmsCapacityBlock" ("SiteId", "BlockNo");
CREATE INDEX "IX_CmmsCapacityBlock_Wc" ON "CmmsCapacityBlock" ("SiteId", "WorkCenterRef", "WindowStart");
CREATE INDEX "IX_CmmsCapacityBlock_Status" ON "CmmsCapacityBlock" ("SiteId", "Status", "WindowStart");


-- IotDrillingRig · iiot · دکل حفاری و جریان عملیات
CREATE TABLE IF NOT EXISTS "IotDrillingRig" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "RigNo" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "RigType" TEXT NOT NULL,
  "OwnerFa" TEXT NULL,
  "DrillingContractorFa" TEXT NULL,
  "CmmsSiteRef" TEXT NULL,
  "PmisProjectRef" TEXT NULL,
  "MesWorkCenterRef" TEXT NULL,
  "FieldName" TEXT NULL,
  "WellName" TEXT NULL,
  "SpudDate" TEXT NULL,
  "TargetDepthM" NUMERIC NULL,
  "CurrentDepthM" NUMERIC NULL,
  "Status" TEXT NOT NULL DEFAULT 'drilling',
  "Latitude" NUMERIC NULL,
  "Longitude" NUMERIC NULL,
  "TimeZoneId" TEXT NULL DEFAULT 'Asia/Tehran',
  "NominalSampleRateHz" INTEGER NOT NULL DEFAULT 1,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotDrillingRig" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_IotDrillingRig_Type" CHECK (RigType IN ('land','jackup','semi-submersible','platform','workover','coiled-tubing')),
  CONSTRAINT "CK_IotDrillingRig_Status" CHECK (Status IN ('mobilizing','drilling','tripping','cementing','completion','workover','stacked','demobilized')),
  CONSTRAINT "CK_IotDrillingRig_Rate" CHECK (NominalSampleRateHz >= 1)
);
CREATE UNIQUE INDEX "UX_IotDrillingRig_RigId" ON "IotDrillingRig" ("RigId");
CREATE UNIQUE INDEX "UX_IotDrillingRig_No" ON "IotDrillingRig" ("RigNo");
CREATE INDEX "IX_IotDrillingRig_Status" ON "IotDrillingRig" ("Status", "IsActive");


-- IotEdgeGateway · iiot · گیت‌وی لبه (Edge Gateway)
CREATE TABLE IF NOT EXISTS "IotEdgeGateway" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "GatewayCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Protocol" TEXT NOT NULL,
  "FirmwareVersion" TEXT NULL,
  "IpAddress" TEXT NULL,
  "LocationFa" TEXT NULL,
  "SyncMode" TEXT NOT NULL DEFAULT 'store-forward',
  "BufferCapacity" INTEGER NOT NULL DEFAULT 100000,
  "BufferUsed" INTEGER NOT NULL DEFAULT 0,
  "MaxBatchSize" INTEGER NOT NULL DEFAULT 1000,
  "MaxAttempts" INTEGER NOT NULL DEFAULT 5,
  "ConnectionState" TEXT NOT NULL DEFAULT 'offline',
  "LastHeartbeatAt" TEXT NULL,
  "LastSyncAt" TEXT NULL,
  "HeartbeatIntervalSeconds" INTEGER NULL,
  "InstalledAt" TEXT NOT NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "AuthMode" TEXT NULL DEFAULT 'token',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotEdgeGateway" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_IotEdgeGateway_Protocol" CHECK (Protocol IN ('mqtt','opc-ua','modbus','witsml','http')),
  CONSTRAINT "CK_IotEdgeGateway_Sync" CHECK (SyncMode IN ('realtime','store-forward','batch')),
  CONSTRAINT "CK_IotEdgeGateway_State" CHECK (ConnectionState IN ('online','degraded','offline')),
  CONSTRAINT "CK_IotEdgeGateway_Buffer" CHECK (BufferUsed >= 0 AND BufferUsed <= BufferCapacity),
  CONSTRAINT "CK_IotEdgeGateway_Batch" CHECK (MaxBatchSize >= 1)
);
CREATE UNIQUE INDEX "UX_IotEdgeGateway_Code" ON "IotEdgeGateway" ("RigId", "GatewayCode");
CREATE INDEX "IX_IotEdgeGateway_State" ON "IotEdgeGateway" ("RigId", "ConnectionState", "IsActive");


-- IotSensorNode · iiot · سنسور و تگ میدان
CREATE TABLE IF NOT EXISTS "IotSensorNode" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "SensorTag" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "SensorType" TEXT NOT NULL,
  "Manufacturer" TEXT NULL,
  "ModelNo" TEXT NULL,
  "SerialNo" TEXT NULL,
  "RangeMin" NUMERIC NULL,
  "RangeMax" NUMERIC NULL,
  "Unit" TEXT NULL,
  "AccuracyPct" NUMERIC NULL,
  "LocationFa" TEXT NULL,
  "GatewayId" TEXT NULL,
  "InstalledAt" TEXT NULL,
  "LastCalibratedAt" TEXT NULL,
  "NextCalibrationDue" TEXT NULL,
  "CalibrationIntervalDays" INTEGER NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotSensorNode" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_IotSensorNode_GatewayId" FOREIGN KEY ("GatewayId") REFERENCES "IotEdgeGateway" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_IotSensorNode_Status" CHECK (Status IN ('active','faulty','calibration-due','removed')),
  CONSTRAINT "CK_IotSensorNode_Range" CHECK (RangeMin IS NULL OR RangeMax IS NULL OR RangeMax > RangeMin)
);
CREATE UNIQUE INDEX "UX_IotSensorNode_Tag" ON "IotSensorNode" ("RigId", "SensorTag");
CREATE INDEX "IX_IotSensorNode_Status" ON "IotSensorNode" ("RigId", "Status");
CREATE INDEX "IX_IotSensorNode_Calibration" ON "IotSensorNode" ("RigId", "NextCalibrationDue");


-- IotDrillingRigStream · iiot · جریان تله‌متری دکل
CREATE TABLE IF NOT EXISTS "IotDrillingRigStream" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "StreamCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "SourceSystem" TEXT NOT NULL,
  "GatewayId" TEXT NULL,
  "TransportProtocol" TEXT NOT NULL,
  "SampleRateHz" INTEGER NOT NULL DEFAULT 1,
  "BatchSize" INTEGER NOT NULL DEFAULT 100,
  "ConnectionState" TEXT NOT NULL DEFAULT 'offline',
  "LastSampleAt" TEXT NULL,
  "LastSeqNo" INTEGER NULL,
  "QualityPct" NUMERIC NULL,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "WitsmlMnemonicMapJson" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotDrillingRigStream" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_IotDrillingRigStream_GatewayId" FOREIGN KEY ("GatewayId") REFERENCES "IotEdgeGateway" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_IotRigStream_Source" CHECK (SourceSystem IN ('witsml','mudlogger','plc','scada','edge','manual')),
  CONSTRAINT "CK_IotRigStream_Protocol" CHECK (TransportProtocol IN ('mqtt','opc-ua','modbus','witsml','http')),
  CONSTRAINT "CK_IotRigStream_Rate" CHECK (SampleRateHz >= 1),
  CONSTRAINT "CK_IotRigStream_State" CHECK (ConnectionState IN ('online','degraded','offline'))
);
CREATE UNIQUE INDEX "UX_IotRigStream_Code" ON "IotDrillingRigStream" ("RigId", "StreamCode");
CREATE INDEX "IX_IotRigStream_State" ON "IotDrillingRigStream" ("RigId", "ConnectionState", "IsActive");
CREATE INDEX "IX_IotRigStream_Gateway" ON "IotDrillingRigStream" ("GatewayId");


-- IotDasChannel · iiot · کانال سیگنال حفاری (DAS)
CREATE TABLE IF NOT EXISTS "IotDasChannel" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "StreamId" TEXT NULL,
  "ChannelCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "NameEn" TEXT NULL,
  "SignalType" TEXT NOT NULL,
  "Unit" TEXT NOT NULL,
  "NominalMin" NUMERIC NULL,
  "NominalMax" NUMERIC NULL,
  "NominalValue" NUMERIC NULL,
  "DisplayMin" NUMERIC NULL,
  "DisplayMax" NUMERIC NULL,
  "SampleRateHz" INTEGER NOT NULL DEFAULT 1,
  "FilterMethod" TEXT NOT NULL DEFAULT 'sma',
  "FilterWindowSeconds" INTEGER NOT NULL DEFAULT 10,
  "DeadbandPct" NUMERIC NULL,
  "SensorTag" TEXT NULL,
  "WitsmlMnemonic" TEXT NULL,
  "IsCritical" INTEGER NOT NULL DEFAULT 0,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "InstalledLocationFa" TEXT NULL,
  "CalibratedAt" TEXT NULL,
  "NextCalibrationDue" TEXT NULL,
  "LastValueAt" TEXT NULL,
  "LastValue" NUMERIC NULL,
  "LastQuality" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotDasChannel" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_IotDasChannel_StreamId" FOREIGN KEY ("StreamId") REFERENCES "IotDrillingRigStream" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_IotDasChannel_Signal" CHECK (SignalType IN ('wob','rpm','torque','mud-pump-pressure','flow-rate','temperature','vibration','rop','depth','standpipe-pressure','hookload','gas')),
  CONSTRAINT "CK_IotDasChannel_Filter" CHECK (FilterMethod IN ('none','sma','ema','median')),
  CONSTRAINT "CK_IotDasChannel_Window" CHECK (FilterWindowSeconds >= 1),
  CONSTRAINT "CK_IotDasChannel_Rate" CHECK (SampleRateHz >= 1),
  CONSTRAINT "CK_IotDasChannel_Display" CHECK (DisplayMin IS NULL OR DisplayMax IS NULL OR DisplayMax > DisplayMin),
  CONSTRAINT "CK_IotDasChannel_Deadband" CHECK (DeadbandPct IS NULL OR DeadbandPct >= 0)
);
CREATE UNIQUE INDEX "UX_IotDasChannel_Code" ON "IotDasChannel" ("RigId", "ChannelCode");
CREATE INDEX "IX_IotDasChannel_Signal" ON "IotDasChannel" ("RigId", "SignalType", "IsActive");
CREATE INDEX "IX_IotDasChannel_Stream" ON "IotDasChannel" ("StreamId", "IsActive");


-- IotGatewayBuffer · iiot · بافر لبه (Store-and-Forward)
CREATE TABLE IF NOT EXISTS "IotGatewayBuffer" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "GatewayId" TEXT NULL,
  "BatchNo" TEXT NOT NULL,
  "CapturedAt" TEXT NOT NULL,
  "FromAt" TEXT NOT NULL,
  "ToAt" TEXT NOT NULL,
  "SampleCount" INTEGER NOT NULL DEFAULT 0,
  "PayloadJson" TEXT NOT NULL,
  "Checksum" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'buffered',
  "Attempts" INTEGER NOT NULL DEFAULT 0,
  "MaxAttempts" INTEGER NOT NULL DEFAULT 5,
  "LastAttemptAt" TEXT NULL,
  "SentAt" TEXT NULL,
  "AckRef" TEXT NULL,
  "ErrorCode" TEXT NULL,
  "ErrorFa" TEXT NULL,
  "ConnectivityState" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotGatewayBuffer" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_IotGatewayBuffer_GatewayId" FOREIGN KEY ("GatewayId") REFERENCES "IotEdgeGateway" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_IotGatewayBuffer_Status" CHECK (Status IN ('buffered','sending','sent','failed','dead-letter')),
  CONSTRAINT "CK_IotGatewayBuffer_Window" CHECK (ToAt >= FromAt),
  CONSTRAINT "CK_IotGatewayBuffer_Attempts" CHECK (Attempts >= 0 AND Attempts <= MaxAttempts)
);
CREATE UNIQUE INDEX "UX_IotGatewayBuffer_Batch" ON "IotGatewayBuffer" ("GatewayId", "BatchNo");
CREATE INDEX "IX_IotGatewayBuffer_Status" ON "IotGatewayBuffer" ("RigId", "Status", "CapturedAt");


-- IotTelemetrySample · iiot · نمونهٔ تله‌متری
CREATE TABLE IF NOT EXISTS "IotTelemetrySample" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "StreamId" TEXT NULL,
  "ChannelId" TEXT NULL,
  "SampledAt" TEXT NOT NULL,
  "Value" NUMERIC NOT NULL,
  "RawValue" NUMERIC NULL,
  "FilteredValue" NUMERIC NULL,
  "Unit" TEXT NULL,
  "SeqNo" INTEGER NULL,
  "Quality" TEXT NOT NULL DEFAULT 'good',
  "Source" TEXT NOT NULL DEFAULT 'live',
  "GatewayId" TEXT NULL,
  "BufferId" TEXT NULL,
  "BatchNo" TEXT NULL,
  "IngestedAt" TEXT NOT NULL,
  "IsFlagged" INTEGER NOT NULL DEFAULT 0,
  "QualityReasonFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotTelemetrySample" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_IotTelemetrySample_StreamId" FOREIGN KEY ("StreamId") REFERENCES "IotDrillingRigStream" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_IotTelemetrySample_ChannelId" FOREIGN KEY ("ChannelId") REFERENCES "IotDasChannel" ("Id") ON DELETE NO ACTION,
  CONSTRAINT "FK_IotTelemetrySample_GatewayId" FOREIGN KEY ("GatewayId") REFERENCES "IotEdgeGateway" ("Id") ON DELETE SET NULL,
  CONSTRAINT "FK_IotTelemetrySample_BufferId" FOREIGN KEY ("BufferId") REFERENCES "IotGatewayBuffer" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_IotSample_Quality" CHECK (Quality IN ('good','suspect','bad','stale')),
  CONSTRAINT "CK_IotSample_Source" CHECK (Source IN ('live','buffer','replay','simulated','manual'))
);
CREATE INDEX "IX_IotSample_ChannelTime" ON "IotTelemetrySample" ("ChannelId", "SampledAt");
CREATE INDEX "IX_IotSample_RigTime" ON "IotTelemetrySample" ("RigId", "SampledAt");
CREATE INDEX "IX_IotSample_Quality" ON "IotTelemetrySample" ("RigId", "Quality", "SampledAt");
CREATE INDEX "IX_IotSample_Buffer" ON "IotTelemetrySample" ("BufferId", "SampledAt");


-- IotTelemetryRollup · iiot · تجمیع سری زمانی
CREATE TABLE IF NOT EXISTS "IotTelemetryRollup" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "ChannelId" TEXT NULL,
  "BucketSeconds" INTEGER NOT NULL,
  "BucketStart" TEXT NOT NULL,
  "SampleCount" INTEGER NOT NULL DEFAULT 0,
  "BadCount" INTEGER NOT NULL DEFAULT 0,
  "MinValue" NUMERIC NULL,
  "MaxValue" NUMERIC NULL,
  "AvgValue" NUMERIC NULL,
  "StdDev" NUMERIC NULL,
  "FirstValue" NUMERIC NULL,
  "LastValue" NUMERIC NULL,
  "QualityPct" NUMERIC NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotTelemetryRollup" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_IotTelemetryRollup_ChannelId" FOREIGN KEY ("ChannelId") REFERENCES "IotDasChannel" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_IotRollup_Bucket" CHECK (BucketSeconds >= 1),
  CONSTRAINT "CK_IotRollup_Count" CHECK (SampleCount >= 0 AND BadCount >= 0),
  CONSTRAINT "CK_IotRollup_MinMax" CHECK (MinValue IS NULL OR MaxValue IS NULL OR MaxValue >= MinValue)
);
CREATE UNIQUE INDEX "UX_IotRollup_Channel" ON "IotTelemetryRollup" ("ChannelId", "BucketSeconds", "BucketStart");
CREATE INDEX "IX_IotRollup_Rig" ON "IotTelemetryRollup" ("RigId", "BucketStart");


-- IotSignalFilterRule · iiot · قاعدهٔ فیلترینگ سیگنال
CREATE TABLE IF NOT EXISTS "IotSignalFilterRule" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "RuleCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "AppliesToSignals" TEXT NOT NULL,
  "FilterMethod" TEXT NOT NULL DEFAULT 'sma',
  "WindowSeconds" INTEGER NOT NULL DEFAULT 10,
  "EmaAlpha" NUMERIC NULL,
  "MinSamples" INTEGER NOT NULL DEFAULT 5,
  "DeadbandPct" NUMERIC NULL,
  "SpikeZThreshold" NUMERIC NULL,
  "FlatlineSeconds" INTEGER NOT NULL DEFAULT 60,
  "IsDefault" INTEGER NOT NULL DEFAULT 0,
  "Version" INTEGER NOT NULL DEFAULT 1,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "EffectiveFrom" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotSignalFilterRule" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_IotSignalFilterRule_Method" CHECK (FilterMethod IN ('none','sma','ema','median')),
  CONSTRAINT "CK_IotSignalFilterRule_Window" CHECK (WindowSeconds >= 1),
  CONSTRAINT "CK_IotSignalFilterRule_Min" CHECK (MinSamples >= 1),
  CONSTRAINT "CK_IotSignalFilterRule_Alpha" CHECK (EmaAlpha IS NULL OR (EmaAlpha > 0 AND EmaAlpha <= 1))
);
CREATE UNIQUE INDEX "UX_IotSignalFilterRule_Code" ON "IotSignalFilterRule" ("RigId", "RuleCode");
CREATE INDEX "IX_IotSignalFilterRule_Active" ON "IotSignalFilterRule" ("RigId", "IsActive");


-- IotThresholdRule · iiot · آستانهٔ هشدار چندسطحی
CREATE TABLE IF NOT EXISTS "IotThresholdRule" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "ChannelId" TEXT NULL,
  "RuleCode" TEXT NOT NULL,
  "NameFa" TEXT NOT NULL,
  "Level" TEXT NOT NULL,
  "DetectKind" TEXT NOT NULL DEFAULT 'threshold',
  "Comparison" TEXT NOT NULL DEFAULT 'gt',
  "ThresholdValue" NUMERIC NULL,
  "SecondaryValue" NUMERIC NULL,
  "DurationSeconds" INTEGER NOT NULL DEFAULT 30,
  "MinSamples" INTEGER NOT NULL DEFAULT 10,
  "HysteresisPct" NUMERIC NULL,
  "CooldownSeconds" INTEGER NOT NULL DEFAULT 600,
  "TorqueCvThreshold" NUMERIC NULL,
  "RpmSwingPctThreshold" NUMERIC NULL,
  "PressureDropPctThreshold" NUMERIC NULL,
  "AutoDispatch" INTEGER NOT NULL DEFAULT 0,
  "DispatchTargets" TEXT NULL,
  "CmmsPriority" INTEGER NULL,
  "CmmsSiteRef" TEXT NULL,
  "CmmsAssetRef" TEXT NULL,
  "MesWorkCenterRef" TEXT NULL,
  "MesPlantRef" TEXT NULL,
  "PmisProjectRef" TEXT NULL,
  "NptCode" TEXT NULL,
  "EscalationNoteFa" TEXT NULL,
  "Version" INTEGER NOT NULL DEFAULT 1,
  "IsActive" INTEGER NOT NULL DEFAULT 1,
  "EffectiveFrom" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotThresholdRule" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_IotThresholdRule_ChannelId" FOREIGN KEY ("ChannelId") REFERENCES "IotDasChannel" ("Id") ON DELETE CASCADE,
  CONSTRAINT "CK_IotThresholdRule_Level" CHECK (Level IN ('warning','critical')),
  CONSTRAINT "CK_IotThresholdRule_Kind" CHECK (DetectKind IN ('threshold','rate-of-change','stick-slip','pump-drop','flatline','spike')),
  CONSTRAINT "CK_IotThresholdRule_Comparison" CHECK (Comparison IN ('gt','gte','lt','lte','band-out','rate')),
  CONSTRAINT "CK_IotThresholdRule_Duration" CHECK (DurationSeconds >= 0),
  CONSTRAINT "CK_IotThresholdRule_MinSamples" CHECK (MinSamples >= 1),
  CONSTRAINT "CK_IotThresholdRule_Cooldown" CHECK (CooldownSeconds >= 0),
  CONSTRAINT "CK_IotThresholdRule_Targets" CHECK (AutoDispatch = 0 OR DispatchTargets IS NOT NULL)
);
CREATE UNIQUE INDEX "UX_IotThresholdRule_Code" ON "IotThresholdRule" ("RigId", "RuleCode");
CREATE INDEX "IX_IotThresholdRule_Channel" ON "IotThresholdRule" ("ChannelId", "Level", "IsActive");
CREATE INDEX "IX_IotThresholdRule_Kind" ON "IotThresholdRule" ("RigId", "DetectKind", "IsActive");


-- IotTelemetryAlert · iiot · هشدار تله‌متری
CREATE TABLE IF NOT EXISTS "IotTelemetryAlert" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "ChannelId" TEXT NULL,
  "RuleId" TEXT NULL,
  "AlertCode" TEXT NOT NULL,
  "DetectionKind" TEXT NOT NULL,
  "Level" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "MessageFa" TEXT NULL,
  "DetectedAt" TEXT NOT NULL,
  "TriggeredAt" TEXT NULL,
  "ResolvedAt" TEXT NULL,
  "TriggerValue" NUMERIC NULL,
  "FilteredValue" NUMERIC NULL,
  "BaselineValue" NUMERIC NULL,
  "DeviationPct" NUMERIC NULL,
  "SampleCount" INTEGER NOT NULL DEFAULT 0,
  "DurationSeconds" INTEGER NOT NULL DEFAULT 0,
  "MetricsJson" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "AcknowledgedAt" TEXT NULL,
  "AcknowledgedById" TEXT NULL,
  "AckNoteFa" TEXT NULL,
  "ResolvedById" TEXT NULL,
  "ResolutionNoteFa" TEXT NULL,
  "SuppressedReasonFa" TEXT NULL,
  "DispatchStatus" TEXT NOT NULL DEFAULT 'none',
  "CmmsWorkOrderRef" TEXT NULL,
  "MesDowntimeRef" TEXT NULL,
  "PmisEventRef" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotTelemetryAlert" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_IotTelemetryAlert_ChannelId" FOREIGN KEY ("ChannelId") REFERENCES "IotDasChannel" ("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_IotTelemetryAlert_RuleId" FOREIGN KEY ("RuleId") REFERENCES "IotThresholdRule" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_IotAlert_Level" CHECK (Level IN ('warning','critical')),
  CONSTRAINT "CK_IotAlert_Status" CHECK (Status IN ('active','acknowledged','resolved','suppressed','false-positive')),
  CONSTRAINT "CK_IotAlert_Kind" CHECK (DetectionKind IN ('threshold','rate-of-change','stick-slip','pump-drop','flatline','spike')),
  CONSTRAINT "CK_IotAlert_Dispatch" CHECK (DispatchStatus IN ('none','pending','partial','dispatched','failed')),
  CONSTRAINT "CK_IotAlert_Resolve" CHECK (Status <> 'resolved' OR ResolvedAt IS NOT NULL)
);
CREATE UNIQUE INDEX "UX_IotAlert_Code" ON "IotTelemetryAlert" ("RigId", "AlertCode", "DetectedAt");
CREATE INDEX "IX_IotAlert_Status" ON "IotTelemetryAlert" ("RigId", "Status", "Level");
CREATE INDEX "IX_IotAlert_Channel" ON "IotTelemetryAlert" ("ChannelId", "DetectedAt");
CREATE INDEX "IX_IotAlert_Dispatch" ON "IotTelemetryAlert" ("RigId", "DispatchStatus");


-- IotRigDowntime · iiot · توقف دکل و زمان نامولّد
CREATE TABLE IF NOT EXISTS "IotRigDowntime" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "DowntimeCode" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "DowntimeType" TEXT NOT NULL DEFAULT 'non-productive',
  "NptCode" TEXT NULL,
  "CauseFa" TEXT NOT NULL,
  "EffectFa" TEXT NULL,
  "StartedAt" TEXT NOT NULL,
  "EndedAt" TEXT NULL,
  "DurationMinutes" NUMERIC NULL,
  "IsNpt" INTEGER NOT NULL DEFAULT 1,
  "RecoverableMinutes" NUMERIC NULL,
  "ResponsibilityFa" TEXT NULL,
  "AlertId" TEXT NULL,
  "DetectedBy" TEXT NOT NULL DEFAULT 'auto',
  "ShiftName" TEXT NULL,
  "RecordedById" TEXT NULL,
  "VerifiedById" TEXT NULL,
  "VerifiedAt" TEXT NULL,
  "ReportedToMes" INTEGER NOT NULL DEFAULT 0,
  "ReportedToPmis" INTEGER NOT NULL DEFAULT 0,
  "MesDowntimeRef" TEXT NULL,
  "PmisEventRef" TEXT NULL,
  "PmisClaimRef" TEXT NULL,
  "ModelVersion" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotRigDowntime" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_IotRigDowntime_AlertId" FOREIGN KEY ("AlertId") REFERENCES "IotTelemetryAlert" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_IotRigDowntime_Window" CHECK (EndedAt IS NULL OR EndedAt >= StartedAt),
  CONSTRAINT "CK_IotRigDowntime_Duration" CHECK (DurationMinutes IS NULL OR DurationMinutes >= 0),
  CONSTRAINT "CK_IotRigDowntime_Type" CHECK (DowntimeType IN ('productive','non-productive','planned')),
  CONSTRAINT "CK_IotRigDowntime_Category" CHECK (Category IN ('equipment','mud','directional','wellbore','weather','power','logistics','cementing','waiting-on-decision','other')),
  CONSTRAINT "CK_IotRigDowntime_Npt" CHECK (IsNpt = 0 OR DowntimeType = 'non-productive')
);
CREATE UNIQUE INDEX "UX_IotRigDowntime_Code" ON "IotRigDowntime" ("RigId", "DowntimeCode");
CREATE INDEX "IX_IotRigDowntime_Window" ON "IotRigDowntime" ("RigId", "StartedAt", "IsNpt");
CREATE INDEX "IX_IotRigDowntime_Category" ON "IotRigDowntime" ("RigId", "Category", "StartedAt");


-- IotIntegrationEvent · iiot · رویداد یکپارچگی بین‌بخشی
CREATE TABLE IF NOT EXISTS "IotIntegrationEvent" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "EventType" TEXT NOT NULL,
  "TargetSystem" TEXT NOT NULL,
  "TargetRef" TEXT NULL,
  "Contract" TEXT NOT NULL,
  "IdempotencyKey" TEXT NOT NULL,
  "CorrelationId" TEXT NULL,
  "SourceTable" TEXT NULL,
  "SourceId" TEXT NULL,
  "OccurredAt" TEXT NOT NULL,
  "PayloadJson" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'pending',
  "Attempts" INTEGER NOT NULL DEFAULT 0,
  "MaxAttempts" INTEGER NOT NULL DEFAULT 5,
  "LastAttemptAt" TEXT NULL,
  "DeliveredAt" TEXT NULL,
  "AckRef" TEXT NULL,
  "ErrorCode" TEXT NULL,
  "ErrorFa" TEXT NULL,
  "EmittedBy" TEXT NOT NULL,
  "ModelVersion" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotIntegrationEvent" PRIMARY KEY ("Id"),
  CONSTRAINT "CK_IotIntegrationEvent_Target" CHECK (TargetSystem IN ('cmms','mes','pmis')),
  CONSTRAINT "CK_IotIntegrationEvent_Status" CHECK (Status IN ('pending','dispatched','failed','dead-letter')),
  CONSTRAINT "CK_IotIntegrationEvent_Contract" CHECK (Contract IN ('iiot-cmms-v1','iiot-mes-v1','iiot-pmis-v1')),
  CONSTRAINT "CK_IotIntegrationEvent_Attempts" CHECK (Attempts >= 0 AND Attempts <= MaxAttempts)
);
CREATE UNIQUE INDEX "UX_IotIntegrationEvent_Key" ON "IotIntegrationEvent" ("IdempotencyKey");
CREATE INDEX "IX_IotIntegrationEvent_Queue" ON "IotIntegrationEvent" ("Status", "OccurredAt");
CREATE INDEX "IX_IotIntegrationEvent_Target" ON "IotIntegrationEvent" ("RigId", "TargetSystem", "EventType");


-- IotConditionSnapshot · iiot · عکس پایش وضعیت
CREATE TABLE IF NOT EXISTS "IotConditionSnapshot" (
  "Id" TEXT NOT NULL,
  "RigId" TEXT NOT NULL,
  "CmmsAssetRef" TEXT NULL,
  "SensorTag" TEXT NULL,
  "ReadingType" TEXT NOT NULL,
  "Value" NUMERIC NOT NULL,
  "Uom" TEXT NOT NULL,
  "Zone" TEXT NULL,
  "MeasuredAt" TEXT NOT NULL,
  "MeasuredOn" TEXT NOT NULL,
  "HealthIndex" NUMERIC NULL,
  "TrendDirection" TEXT NULL,
  "RateOfChange" NUMERIC NULL,
  "Source" TEXT NOT NULL DEFAULT 'iiot',
  "ReportedToCmms" INTEGER NOT NULL DEFAULT 0,
  "CmmsReadingRef" TEXT NULL,
  "AlertId" TEXT NULL,
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_IotConditionSnapshot" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_IotConditionSnapshot_AlertId" FOREIGN KEY ("AlertId") REFERENCES "IotTelemetryAlert" ("Id") ON DELETE SET NULL,
  CONSTRAINT "CK_IotConditionSnapshot_Zone" CHECK (Zone IS NULL OR Zone IN ('A','B','C','D')),
  CONSTRAINT "CK_IotConditionSnapshot_Trend" CHECK (TrendDirection IS NULL OR TrendDirection IN ('rising','falling','stable')),
  CONSTRAINT "CK_IotConditionSnapshot_Source" CHECK (Source IN ('iiot','manual','scada','portable')),
  CONSTRAINT "CK_IotConditionSnapshot_Type" CHECK (ReadingType IN ('vibration','temperature','humidity','pressure','current','gas','flow'))
);
CREATE INDEX "IX_IotConditionSnapshot_Rig" ON "IotConditionSnapshot" ("RigId", "MeasuredOn");
CREATE INDEX "IX_IotConditionSnapshot_Asset" ON "IotConditionSnapshot" ("CmmsAssetRef", "MeasuredAt");
CREATE INDEX "IX_IotConditionSnapshot_Zone" ON "IotConditionSnapshot" ("RigId", "Zone", "MeasuredOn");


-- HrmOrgUnit · hrm · واحد سازمانی (چارت سازمانی)
CREATE TABLE IF NOT EXISTS "HrmOrgUnit" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "Code" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "TitleEn" TEXT NULL,
  "UnitType" TEXT NOT NULL DEFAULT 'department',
  "ParentUnitCode" TEXT NULL,
  "ManagerPersonNo" TEXT NULL,
  "CostCenterRef" TEXT NULL,
  "ApprovedHeadcount" INTEGER NOT NULL DEFAULT 1,
  "CurrentHeadcount" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmOrgUnit" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmOrgUnit_Code" ON "HrmOrgUnit" ("ProjectId", "Code");
CREATE INDEX "IX_HrmOrgUnit_Parent" ON "HrmOrgUnit" ("ProjectId", "ParentUnitCode");


-- HrmPersonnelProfile · hrm · شناسنامهٔ جامع پرسنل
CREATE TABLE IF NOT EXISTS "HrmPersonnelProfile" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "FullNameFa" TEXT NOT NULL,
  "FullNameEn" TEXT NULL,
  "NationalId" TEXT NOT NULL,
  "BirthDate" TEXT NULL,
  "HireDate" TEXT NOT NULL,
  "EmploymentType" TEXT NOT NULL DEFAULT 'contractual',
  "OrgUnitCode" TEXT NOT NULL,
  "JobTitleFa" TEXT NOT NULL,
  "JobGrade" TEXT NULL,
  "EducationLevel" TEXT NULL,
  "InsuranceNo" TEXT NULL,
  "CmmsTechnicianRef" TEXT NULL,
  "MesOperatorRef" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmPersonnelProfile" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmPersonnelProfile_No" ON "HrmPersonnelProfile" ("ProjectId", "PersonnelNo");
CREATE INDEX "IX_HrmPersonnelProfile_Org" ON "HrmPersonnelProfile" ("ProjectId", "OrgUnitCode", "Status");


-- HrmPersonnelAction · hrm · حکم کارگزینی و پرسنلی
CREATE TABLE IF NOT EXISTS "HrmPersonnelAction" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ActionNo" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "ActionType" TEXT NOT NULL,
  "EffectiveDate" TEXT NOT NULL,
  "FromOrgUnitCode" TEXT NULL,
  "ToOrgUnitCode" TEXT NULL,
  "FromJobGrade" TEXT NULL,
  "ToJobGrade" TEXT NULL,
  "BaseSalaryRials" NUMERIC NOT NULL DEFAULT 0,
  "HousingAllowanceRials" NUMERIC NOT NULL DEFAULT 0,
  "FoodAllowanceRials" NUMERIC NOT NULL DEFAULT 0,
  "ChildAllowanceRials" NUMERIC NOT NULL DEFAULT 0,
  "SeniorityAllowanceRials" NUMERIC NOT NULL DEFAULT 0,
  "ApprovedBy" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'issued',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmPersonnelAction" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmPersonnelAction_No" ON "HrmPersonnelAction" ("ProjectId", "ActionNo");
CREATE INDEX "IX_HrmPersonnelAction_Person" ON "HrmPersonnelAction" ("ProjectId", "PersonnelNo", "EffectiveDate");


-- HrmEmploymentContract · hrm · قرارداد کار پرسنل
CREATE TABLE IF NOT EXISTS "HrmEmploymentContract" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ContractNo" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "ContractType" TEXT NOT NULL DEFAULT 'fixed-term',
  "StartDate" TEXT NOT NULL,
  "EndDate" TEXT NOT NULL,
  "BaseMonthlyRials" NUMERIC NOT NULL DEFAULT 0,
  "WeeklyHours" NUMERIC NOT NULL DEFAULT 44,
  "WorkLocationFa" TEXT NULL,
  "SsiCovered" INTEGER NOT NULL DEFAULT 1,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmEmploymentContract" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmEmpContract_No" ON "HrmEmploymentContract" ("ProjectId", "ContractNo");
CREATE INDEX "IX_HrmEmpContract_Person" ON "HrmEmploymentContract" ("ProjectId", "PersonnelNo", "Status");


-- HrmSkillMatrixItem · hrm · ماتریس مهارت و گواهی‌نامهٔ فنی/کارگاهی
CREATE TABLE IF NOT EXISTS "HrmSkillMatrixItem" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MatrixCode" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "SkillCode" TEXT NOT NULL,
  "SkillTitleFa" TEXT NOT NULL,
  "Discipline" TEXT NOT NULL,
  "ProficiencyLevel" INTEGER NOT NULL DEFAULT 3,
  "CertificateNo" TEXT NULL,
  "IssuedDate" TEXT NULL,
  "ExpiryDate" TEXT NULL,
  "CmmsAssetFamilyRef" TEXT NULL,
  "MesWorkCenterRef" TEXT NULL,
  "AssessedBy" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'valid',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmSkillMatrixItem" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmSkillMatrix_Code" ON "HrmSkillMatrixItem" ("ProjectId", "MatrixCode");
CREATE INDEX "IX_HrmSkillMatrix_Person" ON "HrmSkillMatrixItem" ("ProjectId", "PersonnelNo", "Discipline");


-- HrmShiftPattern · hrm · الگوی تقویم کاری و شیفت‌بندی
CREATE TABLE IF NOT EXISTS "HrmShiftPattern" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ShiftCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "PatternType" TEXT NOT NULL,
  "StartClock" TEXT NOT NULL DEFAULT '07:00',
  "EndClock" TEXT NOT NULL DEFAULT '15:00',
  "WorkDaysCycle" INTEGER NOT NULL DEFAULT 6,
  "RestDaysCycle" INTEGER NOT NULL DEFAULT 1,
  "StandardDailyHours" NUMERIC NOT NULL DEFAULT 8,
  "ShiftAllowancePct" NUMERIC NOT NULL DEFAULT 10,
  "NightBonusPct" NUMERIC NOT NULL DEFAULT 35,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmShiftPattern" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmShiftPattern_Code" ON "HrmShiftPattern" ("ProjectId", "ShiftCode");


-- HrmShiftRoster · hrm · کارکرد روزانه و تخصیص شیفت (متصل به CMMS/MES)
CREATE TABLE IF NOT EXISTS "HrmShiftRoster" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RosterCode" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "ShiftCode" TEXT NOT NULL,
  "WorkDate" TEXT NOT NULL,
  "CheckInClock" TEXT NULL,
  "CheckOutClock" TEXT NULL,
  "NormalHours" NUMERIC NOT NULL DEFAULT 8,
  "OvertimeHours" NUMERIC NOT NULL DEFAULT 0,
  "NightHours" NUMERIC NOT NULL DEFAULT 0,
  "HolidayHours" NUMERIC NOT NULL DEFAULT 0,
  "AttendanceState" TEXT NOT NULL DEFAULT 'present',
  "CmmsWorkOrderRef" TEXT NULL,
  "MesOrderRef" TEXT NULL,
  "MesOperationCode" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'recorded',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmShiftRoster" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmShiftRoster_Code" ON "HrmShiftRoster" ("ProjectId", "RosterCode");
CREATE INDEX "IX_HrmShiftRoster_PersonDate" ON "HrmShiftRoster" ("ProjectId", "PersonnelNo", "WorkDate");


-- HrmLeaveRequest · hrm · درخواست مرخصی پرسنل
CREATE TABLE IF NOT EXISTS "HrmLeaveRequest" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "LeaveNo" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "LeaveType" TEXT NOT NULL,
  "FromDate" TEXT NOT NULL,
  "ToDate" TEXT NOT NULL,
  "DaysCount" NUMERIC NOT NULL DEFAULT 1,
  "ReplacementPersonNo" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'pending',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmLeaveRequest" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmLeaveReq_No" ON "HrmLeaveRequest" ("ProjectId", "LeaveNo");
CREATE INDEX "IX_HrmLeaveReq_Person" ON "HrmLeaveRequest" ("ProjectId", "PersonnelNo", "Status");


-- HrmMissionOrder · hrm · حکم مأموریت پرسنل
CREATE TABLE IF NOT EXISTS "HrmMissionOrder" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "MissionNo" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "DestinationFa" TEXT NOT NULL,
  "PurposeFa" TEXT NOT NULL,
  "FromDate" TEXT NOT NULL,
  "ToDate" TEXT NOT NULL,
  "DaysCount" INTEGER NOT NULL DEFAULT 1,
  "MissionAllowanceRials" NUMERIC NOT NULL DEFAULT 0,
  "TransportCostRials" NUMERIC NOT NULL DEFAULT 0,
  "CmmsSiteRef" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'approved',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmMissionOrder" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmMissionOrder_No" ON "HrmMissionOrder" ("ProjectId", "MissionNo");
CREATE INDEX "IX_HrmMissionOrder_Person" ON "HrmMissionOrder" ("ProjectId", "PersonnelNo", "FromDate");


-- HrmPayrollRun · hrm · دورهٔ محاسبهٔ حقوق و دستمزد
CREATE TABLE IF NOT EXISTS "HrmPayrollRun" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RunNo" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "EmployeeCount" INTEGER NOT NULL DEFAULT 0,
  "TotalGrossRials" NUMERIC NOT NULL DEFAULT 0,
  "TotalEmployeeSsiRials" NUMERIC NOT NULL DEFAULT 0,
  "TotalEmployerSsiRials" NUMERIC NOT NULL DEFAULT 0,
  "TotalTaxRials" NUMERIC NOT NULL DEFAULT 0,
  "TotalNetPayableRials" NUMERIC NOT NULL DEFAULT 0,
  "DirectLaborCostRials" NUMERIC NOT NULL DEFAULT 0,
  "IndirectLaborCostRials" NUMERIC NOT NULL DEFAULT 0,
  "FinVoucherRef" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'calculated',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmPayrollRun" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmPayrollRun_No" ON "HrmPayrollRun" ("ProjectId", "RunNo");
CREATE INDEX "IX_HrmPayrollRun_Period" ON "HrmPayrollRun" ("ProjectId", "PeriodCode", "Status");


-- HrmPayslip · hrm · فیش حقوقی پرسنل
CREATE TABLE IF NOT EXISTS "HrmPayslip" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "SlipNo" TEXT NOT NULL,
  "RunNo" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "WorkedDays" INTEGER NOT NULL DEFAULT 30,
  "NormalHours" NUMERIC NOT NULL DEFAULT 176,
  "OvertimeHours" NUMERIC NOT NULL DEFAULT 0,
  "BasePayRials" NUMERIC NOT NULL DEFAULT 0,
  "OvertimePayRials" NUMERIC NOT NULL DEFAULT 0,
  "ShiftAndHardshipRials" NUMERIC NOT NULL DEFAULT 0,
  "BenefitsAllowanceRials" NUMERIC NOT NULL DEFAULT 0,
  "GrossPayRials" NUMERIC NOT NULL DEFAULT 0,
  "EmployeeSsi7PctRials" NUMERIC NOT NULL DEFAULT 0,
  "EmployerSsi23PctRials" NUMERIC NOT NULL DEFAULT 0,
  "IncomeTaxRials" NUMERIC NOT NULL DEFAULT 0,
  "OtherDeductionsRials" NUMERIC NOT NULL DEFAULT 0,
  "NetPayRials" NUMERIC NOT NULL DEFAULT 0,
  "CostType" TEXT NOT NULL DEFAULT 'direct',
  "FinCostCenterRef" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'issued',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmPayslip" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmPayslip_No" ON "HrmPayslip" ("ProjectId", "SlipNo");
CREATE INDEX "IX_HrmPayslip_RunPerson" ON "HrmPayslip" ("ProjectId", "RunNo", "PersonnelNo");


-- HrmCostVoucher · hrm · سند تسهیم هزینهٔ دستمزد به مالی و بهای تمام‌شده
CREATE TABLE IF NOT EXISTS "HrmCostVoucher" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "VoucherNo" TEXT NOT NULL,
  "RunNo" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "CostCategory" TEXT NOT NULL,
  "FinCostCenterRef" TEXT NOT NULL,
  "MesOrderRef" TEXT NULL,
  "CmmsWorkOrderRef" TEXT NULL,
  "DirectLaborRials" NUMERIC NOT NULL DEFAULT 0,
  "IndirectLaborRials" NUMERIC NOT NULL DEFAULT 0,
  "EmployerSsiRials" NUMERIC NOT NULL DEFAULT 0,
  "TotalAllocatedRials" NUMERIC NOT NULL DEFAULT 0,
  "PostedBy" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'posted',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmCostVoucher" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmCostVoucher_No" ON "HrmCostVoucher" ("ProjectId", "VoucherNo");
CREATE INDEX "IX_HrmCostVoucher_Period" ON "HrmCostVoucher" ("ProjectId", "PeriodCode", "CostCategory");


-- HrmTrainingNeed · hrm · نیازسنجی آموزشی (TNA)
CREATE TABLE IF NOT EXISTS "HrmTrainingNeed" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "TnaCode" TEXT NOT NULL,
  "OrgUnitCode" TEXT NOT NULL,
  "PersonnelNo" TEXT NULL,
  "JobTitleFa" TEXT NOT NULL,
  "SkillGapFa" TEXT NOT NULL,
  "RecommendedCourseFa" TEXT NOT NULL,
  "Priority" TEXT NOT NULL DEFAULT 'medium',
  "TargetPeriod" TEXT NULL,
  "EstimatedCostRials" NUMERIC NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'identified',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmTrainingNeed" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmTrainingNeed_Code" ON "HrmTrainingNeed" ("ProjectId", "TnaCode");


-- HrmTrainingCourse · hrm · برنامه‌ریزی دورهٔ آموزشی
CREATE TABLE IF NOT EXISTS "HrmTrainingCourse" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "CourseCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Category" TEXT NOT NULL,
  "ProviderFa" TEXT NOT NULL,
  "InstructorFa" TEXT NULL,
  "DurationHours" INTEGER NOT NULL DEFAULT 16,
  "StartDate" TEXT NOT NULL,
  "EndDate" TEXT NULL,
  "Capacity" INTEGER NOT NULL DEFAULT 20,
  "CostPerPersonRials" NUMERIC NOT NULL DEFAULT 0,
  "SkillCodeGranted" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'planned',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmTrainingCourse" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmTrainingCourse_Code" ON "HrmTrainingCourse" ("ProjectId", "CourseCode");


-- HrmTrainingRecord · hrm · سابقهٔ آموزش و ارزیابی اثربخشی دوره
CREATE TABLE IF NOT EXISTS "HrmTrainingRecord" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RecordNo" TEXT NOT NULL,
  "CourseCode" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "AttendancePct" NUMERIC NOT NULL DEFAULT 100,
  "ExamScorePct" NUMERIC NOT NULL DEFAULT 85,
  "CertificateNo" TEXT NULL,
  "IssuedDate" TEXT NULL,
  "ExpiryDate" TEXT NULL,
  "EffectivenessScorePct" NUMERIC NOT NULL DEFAULT 80,
  "KirkpatrickSummaryFa" TEXT NULL,
  "EvaluatedBy" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'certified',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmTrainingRecord" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmTrainingRecord_No" ON "HrmTrainingRecord" ("ProjectId", "RecordNo");
CREATE INDEX "IX_HrmTrainingRecord_Person" ON "HrmTrainingRecord" ("ProjectId", "PersonnelNo", "CourseCode");


-- HrmPerformanceKpi · hrm · شاخص کلیدی عملکرد و هدف کلیدی (KPI / OKR)
CREATE TABLE IF NOT EXISTS "HrmPerformanceKpi" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "KpiCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "OrgUnitCode" TEXT NOT NULL,
  "JobRoleFa" TEXT NULL,
  "Perspective" TEXT NOT NULL,
  "MetricUnit" TEXT NOT NULL DEFAULT '%',
  "TargetValue" NUMERIC NOT NULL DEFAULT 100,
  "WeightPct" NUMERIC NOT NULL DEFAULT 20,
  "EvalFrequency" TEXT NOT NULL DEFAULT 'quarterly',
  "Status" TEXT NOT NULL DEFAULT 'active',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmPerformanceKpi" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmPerfKpi_Code" ON "HrmPerformanceKpi" ("ProjectId", "KpiCode");


-- HrmPerformanceReview · hrm · ارزیابی دوره‌ای ۳۶۰ درجه عملکرد پرسنل
CREATE TABLE IF NOT EXISTS "HrmPerformanceReview" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ReviewNo" TEXT NOT NULL,
  "PeriodCode" TEXT NOT NULL,
  "PersonnelNo" TEXT NOT NULL,
  "ReviewerPersonNo" TEXT NOT NULL,
  "SelfScorePct" NUMERIC NOT NULL DEFAULT 85,
  "ManagerScorePct" NUMERIC NOT NULL DEFAULT 85,
  "PeerScorePct" NUMERIC NOT NULL DEFAULT 85,
  "SubordinateScorePct" NUMERIC NOT NULL DEFAULT 85,
  "KpiAchievementPct" NUMERIC NOT NULL DEFAULT 90,
  "FinalScorePct" NUMERIC NOT NULL DEFAULT 86.5,
  "PerformanceGrade" TEXT NOT NULL DEFAULT 'B-Exceeds',
  "BonusMultiplierPct" NUMERIC NOT NULL DEFAULT 100,
  "StrengthsFa" TEXT NULL,
  "ImprovementPlanFa" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'finalized',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_HrmPerformanceReview" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_HrmPerfReview_No" ON "HrmPerformanceReview" ("ProjectId", "ReviewNo");
CREATE INDEX "IX_HrmPerfReview_PersonPeriod" ON "HrmPerformanceReview" ("ProjectId", "PersonnelNo", "PeriodCode");


-- EdmsNumberingRule · edms · الگوی شماره‌گذاری و کدینگ خودکار اسناد
CREATE TABLE IF NOT EXISTS "EdmsNumberingRule" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RuleCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DocCategory" TEXT NOT NULL,
  "PrefixPattern" TEXT NOT NULL,
  "DisciplineCode" TEXT NOT NULL DEFAULT 'GEN',
  "DocTypeCode" TEXT NOT NULL DEFAULT 'DOC',
  "Separator" TEXT NOT NULL DEFAULT '-',
  "SeqDigits" INTEGER NOT NULL DEFAULT 4,
  "CurrentSeq" INTEGER NOT NULL DEFAULT 1,
  "ExampleDocCode" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EdmsNumberingRule" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EdmsNumberingRule_Code" ON "EdmsNumberingRule" ("ProjectId", "RuleCode");


-- EdmsMasterDocument · edms · شناسنامهٔ جامع اسناد (Document Master Index - DMI)
CREATE TABLE IF NOT EXISTS "EdmsMasterDocument" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "DocCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "TitleEn" TEXT NULL,
  "DocCategory" TEXT NOT NULL DEFAULT 'engineering',
  "Discipline" TEXT NOT NULL DEFAULT 'mechanical',
  "DocType" TEXT NOT NULL DEFAULT 'drawing',
  "NumberingRuleCode" TEXT NULL,
  "CurrentRevision" TEXT NOT NULL DEFAULT 'Rev-A',
  "LifecycleStage" TEXT NOT NULL DEFAULT 'Approved',
  "Confidentiality" TEXT NOT NULL DEFAULT 'internal',
  "OwnerDepartmentFa" TEXT NOT NULL,
  "OriginatorFa" TEXT NULL,
  "CheckedOutBy" TEXT NULL,
  "ArchiveZoneCode" TEXT NULL,
  "LinkedAssetOrWbsRef" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EdmsMasterDocument" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EdmsMasterDoc_Code" ON "EdmsMasterDocument" ("ProjectId", "DocCode");
CREATE INDEX "IX_EdmsMasterDoc_Disc" ON "EdmsMasterDocument" ("ProjectId", "DocCategory", "Discipline", "LifecycleStage");


-- EdmsRevisionRecord · edms · سابقهٔ ویرایش و نسخهٔ سند (Revision History & Diff)
CREATE TABLE IF NOT EXISTS "EdmsRevisionRecord" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "RevisionNo" TEXT NOT NULL,
  "DocCode" TEXT NOT NULL,
  "RevisionCode" TEXT NOT NULL,
  "ChangeSummaryFa" TEXT NOT NULL,
  "ComparedToRev" TEXT NULL,
  "DiffHighlightsFa" TEXT NULL,
  "FileUri" TEXT NULL,
  "FileHashSha256" TEXT NULL,
  "PageCount" INTEGER NOT NULL DEFAULT 1,
  "PreparedBy" TEXT NOT NULL,
  "CheckedBy" TEXT NULL,
  "ApprovedBy" TEXT NULL,
  "IssueDate" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'approved',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EdmsRevisionRecord" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EdmsRevision_No" ON "EdmsRevisionRecord" ("ProjectId", "RevisionNo");
CREATE INDEX "IX_EdmsRevision_Doc" ON "EdmsRevisionRecord" ("ProjectId", "DocCode", "RevisionCode");


-- EdmsCheckoutLock · edms · قفل رزرو و ویرایش سند (Check-Out / Check-In)
CREATE TABLE IF NOT EXISTS "EdmsCheckoutLock" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "LockNo" TEXT NOT NULL,
  "DocCode" TEXT NOT NULL,
  "BaseRevision" TEXT NOT NULL,
  "CheckedOutBy" TEXT NOT NULL,
  "CheckedOutAt" TEXT NOT NULL,
  "ExpectedReturnDate" TEXT NULL,
  "CheckOutReasonFa" TEXT NOT NULL,
  "CheckedInAt" TEXT NULL,
  "ResultingRevision" TEXT NULL,
  "CheckInDiffNotesFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'checked-out',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EdmsCheckoutLock" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EdmsCheckoutLock_No" ON "EdmsCheckoutLock" ("ProjectId", "LockNo");
CREATE INDEX "IX_EdmsCheckoutLock_Doc" ON "EdmsCheckoutLock" ("ProjectId", "DocCode", "Status");


-- EdmsWorkflowInstance · edms · گردش‌کار بررسی و تأیید سند (Review & Approval Workflow)
CREATE TABLE IF NOT EXISTS "EdmsWorkflowInstance" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "WorkflowNo" TEXT NOT NULL,
  "DocCode" TEXT NOT NULL,
  "RevisionCode" TEXT NOT NULL,
  "WorkflowType" TEXT NOT NULL,
  "CurrentStep" TEXT NOT NULL DEFAULT 'lead-engineer',
  "ReviewResultCode" TEXT NOT NULL DEFAULT 'pending',
  "InitiatedBy" TEXT NOT NULL,
  "AssignedReviewer" TEXT NOT NULL,
  "FinalApprover" TEXT NULL,
  "DueDate" TEXT NOT NULL,
  "CompletedDate" TEXT NULL,
  "ReviewCommentsFa" TEXT NULL,
  "Status" TEXT NOT NULL DEFAULT 'in-review',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EdmsWorkflowInstance" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EdmsWorkflow_No" ON "EdmsWorkflowInstance" ("ProjectId", "WorkflowNo");
CREATE INDEX "IX_EdmsWorkflow_Doc" ON "EdmsWorkflowInstance" ("ProjectId", "DocCode", "Status");


-- EdmsTransmittalPackage · edms · برگهٔ ارسال مدارک و مکاتبات مهندسی/اداری (Transmittal)
CREATE TABLE IF NOT EXISTS "EdmsTransmittalPackage" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "TransmittalNo" TEXT NOT NULL,
  "SubjectFa" TEXT NOT NULL,
  "Direction" TEXT NOT NULL DEFAULT 'outgoing',
  "SenderOrgFa" TEXT NOT NULL,
  "ReceiverOrgFa" TEXT NOT NULL,
  "IssuePurpose" TEXT NOT NULL DEFAULT 'for-approval',
  "IncludedDocCodes" TEXT NOT NULL,
  "DeliveryChannel" TEXT NOT NULL DEFAULT 'edms-portal',
  "IssueDate" TEXT NOT NULL,
  "AcknowledgedDate" TEXT NULL,
  "ReceiptRefNo" TEXT NULL,
  "IssuedBy" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'issued',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EdmsTransmittalPackage" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EdmsTransmittal_No" ON "EdmsTransmittalPackage" ("ProjectId", "TransmittalNo");
CREATE INDEX "IX_EdmsTransmittal_Date" ON "EdmsTransmittalPackage" ("ProjectId", "Direction", "IssueDate");


-- EdmsArchiveZone · edms · زون‌بندی و طبقه‌بندی بایگانی دیجیتال و فیزیکی
CREATE TABLE IF NOT EXISTS "EdmsArchiveZone" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ZoneCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "Classification" TEXT NOT NULL,
  "StorageTier" TEXT NOT NULL DEFAULT 'hot-nvme',
  "RetentionYears" INTEGER NOT NULL DEFAULT 15,
  "DispositionPolicy" TEXT NOT NULL DEFAULT 'permanent-keep',
  "EncryptionAes256" INTEGER NOT NULL DEFAULT 1,
  "StoredDocsCount" INTEGER NOT NULL DEFAULT 0,
  "Status" TEXT NOT NULL DEFAULT 'active',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EdmsArchiveZone" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EdmsArchiveZone_Code" ON "EdmsArchiveZone" ("ProjectId", "ZoneCode");


-- EdmsOcrSearchIndex · edms · رکورد اسکن، استخراج متن (OCR) و نمایهٔ جستجوی تمام‌متن
CREATE TABLE IF NOT EXISTS "EdmsOcrSearchIndex" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "IndexNo" TEXT NOT NULL,
  "DocCode" TEXT NOT NULL,
  "RevisionCode" TEXT NOT NULL,
  "ArchiveZoneCode" TEXT NOT NULL,
  "ScanDpi" INTEGER NOT NULL DEFAULT 300,
  "OcrLang" TEXT NOT NULL DEFAULT 'fa+en',
  "OcrConfidencePct" NUMERIC NOT NULL DEFAULT 97.5,
  "ExtractedTextFa" TEXT NOT NULL,
  "KeywordsTagsFa" TEXT NOT NULL,
  "PhysicalBoxRef" TEXT NULL,
  "IndexedBy" TEXT NOT NULL,
  "IndexedDate" TEXT NOT NULL,
  "Status" TEXT NOT NULL DEFAULT 'indexed',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_EdmsOcrSearchIndex" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_EdmsOcrIndex_No" ON "EdmsOcrSearchIndex" ("ProjectId", "IndexNo");
CREATE INDEX "IX_EdmsOcrIndex_Doc" ON "EdmsOcrSearchIndex" ("ProjectId", "DocCode", "ArchiveZoneCode");


-- KmsLessonRecord · edms · درس‌آموختهٔ پروژه و تولید (Lessons Learned)
CREATE TABLE IF NOT EXISTS "KmsLessonRecord" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "LessonCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "DomainPillar" TEXT NOT NULL,
  "SourceContextFa" TEXT NOT NULL,
  "ProblemOrEventFa" TEXT NOT NULL,
  "RootCauseFa" TEXT NOT NULL,
  "ActionAndLessonFa" TEXT NOT NULL,
  "SeverityImpact" TEXT NOT NULL DEFAULT 'high',
  "EstimatedSavingRials" NUMERIC NOT NULL DEFAULT 0,
  "AuthorBy" TEXT NOT NULL,
  "ValidatedBy" TEXT NULL,
  "AppliedCount" INTEGER NOT NULL DEFAULT 1,
  "Status" TEXT NOT NULL DEFAULT 'published',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_KmsLessonRecord" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_KmsLesson_Code" ON "KmsLessonRecord" ("ProjectId", "LessonCode");
CREATE INDEX "IX_KmsLesson_Domain" ON "KmsLessonRecord" ("ProjectId", "DomainPillar", "Status");


-- KmsKnowledgeBaseArticle · edms · مقالهٔ پایگاه دانش، ویکی فنی و Best Practice
CREATE TABLE IF NOT EXISTS "KmsKnowledgeBaseArticle" (
  "Id" TEXT NOT NULL,
  "ProjectId" TEXT NOT NULL,
  "ArticleCode" TEXT NOT NULL,
  "TitleFa" TEXT NOT NULL,
  "ArticleType" TEXT NOT NULL DEFAULT 'best-practice',
  "KnowledgeAreaFa" TEXT NOT NULL,
  "SummaryFa" TEXT NOT NULL,
  "BodyMarkdownFa" TEXT NOT NULL,
  "TagsCsv" TEXT NOT NULL,
  "RefDocCode" TEXT NULL,
  "AuthorBy" TEXT NOT NULL,
  "ReviewedBy" TEXT NULL,
  "ViewCount" INTEGER NOT NULL DEFAULT 12,
  "HelpfulVotes" INTEGER NOT NULL DEFAULT 5,
  "VersionNo" INTEGER NOT NULL DEFAULT 1,
  "Status" TEXT NOT NULL DEFAULT 'published',
  "NoteFa" TEXT NULL,
  "CreatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "CreatedBy" TEXT NULL,
  "UpdatedAt" TEXT NULL,
  "UpdatedBy" TEXT NULL,
  "RowVersion" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "PK_KmsKnowledgeBaseArticle" PRIMARY KEY ("Id")
);
CREATE UNIQUE INDEX "UX_KmsArticle_Code" ON "KmsKnowledgeBaseArticle" ("ProjectId", "ArticleCode");
CREATE INDEX "IX_KmsArticle_Type" ON "KmsKnowledgeBaseArticle" ("ProjectId", "ArticleType", "Status");
