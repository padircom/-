/* ─────────────────────────────────────────────────────────────
   F5-G1 · Seed پروژه OG-2401 (idempotent — اجرای چندباره بی‌خطر)
   آینه src/data/pexProject.ts · ApprovedQty بازتولید pctApproved است.
   پیش‌نیاز: V001__pex_core.sql
   ───────────────────────────────────────────────────────────── */

IF NOT EXISTS (SELECT 1 FROM dbo.pex_project WHERE ProjectCode = N'OG-2401')
  INSERT INTO dbo.pex_project (ProjectCode, NameFa, NameEn, ClientFa, DataDate, FormulaVersion)
  VALUES (N'OG-2401', N'پروژه نمونه OG-2401', N'Sample Project OG-2401', N'کارفرمای نمونه', '2026-09-04', N'v1');
GO

-- RoC library
IF NOT EXISTS (SELECT 1 FROM dbo.pex_roc WHERE RocCode = N'CIV-FND')
  INSERT INTO dbo.pex_roc (RocCode, NameFa, NameEn, Discipline, StepsJson) VALUES
  (N'CIV-FND', N'فونداسیون', N'Foundation', N'Civil',
   N'[{"seq":1,"nameFa":"گودبرداری","nameEn":"Excavation","weight":0.10},{"seq":2,"nameFa":"بتن مگر","nameEn":"Lean concrete","weight":0.08},{"seq":3,"nameFa":"آرماتوربندی","nameEn":"Rebar","weight":0.22},{"seq":4,"nameFa":"قالب‌بندی","nameEn":"Formwork","weight":0.12},{"seq":5,"nameFa":"بتن‌ریزی","nameEn":"Pour","weight":0.30},{"seq":6,"nameFa":"عمل‌آوری","nameEn":"Curing","weight":0.18}]');
IF NOT EXISTS (SELECT 1 FROM dbo.pex_roc WHERE RocCode = N'PIP-LINE')
  INSERT INTO dbo.pex_roc (RocCode, NameFa, NameEn, Discipline, StepsJson) VALUES
  (N'PIP-LINE', N'پایپینگ', N'Piping', N'Piping',
   N'[{"seq":1,"nameFa":"ساخت اسپول","nameEn":"Spool fab","weight":0.12},{"seq":2,"nameFa":"فیت‌آپ","nameEn":"Fit-up","weight":0.15},{"seq":3,"nameFa":"جوشکاری","nameEn":"Welding","weight":0.22},{"seq":4,"nameFa":"تست غیرمخرب","nameEn":"NDT","weight":0.13},{"seq":5,"nameFa":"تنش‌زدایی","nameEn":"PWHT","weight":0.08},{"seq":6,"nameFa":"هیدروتست","nameEn":"Hydrotest","weight":0.18},{"seq":7,"nameFa":"رنگ","nameEn":"Painting","weight":0.12}]');
IF NOT EXISTS (SELECT 1 FROM dbo.pex_roc WHERE RocCode = N'ELE-CABLE')
  INSERT INTO dbo.pex_roc (RocCode, NameFa, NameEn, Discipline, StepsJson) VALUES
  (N'ELE-CABLE', N'کابل', N'Cable', N'Electrical',
   N'[{"seq":1,"nameFa":"سینی کابل","nameEn":"Cable tray","weight":0.15},{"seq":2,"nameFa":"کابل‌کشی","nameEn":"Pulling","weight":0.35},{"seq":3,"nameFa":"سرسیم‌بندی","nameEn":"Termination","weight":0.25},{"seq":4,"nameFa":"تست مگر","nameEn":"Megger test","weight":0.25}]');
IF NOT EXISTS (SELECT 1 FROM dbo.pex_roc WHERE RocCode = N'STR-STL')
  INSERT INTO dbo.pex_roc (RocCode, NameFa, NameEn, Discipline, StepsJson) VALUES
  (N'STR-STL', N'استراکچر', N'Steel structure', N'Structural',
   N'[{"seq":1,"nameFa":"ساخت","nameEn":"Fabrication","weight":0.30},{"seq":2,"nameFa":"نصب","nameEn":"Erection","weight":0.40},{"seq":3,"nameFa":"بولت و تراز","nameEn":"Bolting & alignment","weight":0.15},{"seq":4,"nameFa":"رنگ","nameEn":"Painting","weight":0.15}]');
GO

-- WBS (وزن نسبی؛ جمع فرزندان هر گره = ۱)
DECLARE @w1 INT, @w2 INT, @w3 INT, @w11 INT, @w12 INT, @w21 INT, @w22 INT, @w23 INT;
IF NOT EXISTS (SELECT 1 FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'1')
  INSERT INTO dbo.pex_wbs (ProjectCode, ParentId, Code, NameFa, NameEn, NodeLevel, NodeType, Weight, IsLocked)
  VALUES (N'OG-2401', NULL, N'1', N'مهندسی', N'Engineering', 1, N'Summary', 0.18, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2')
  INSERT INTO dbo.pex_wbs (ProjectCode, ParentId, Code, NameFa, NameEn, NodeLevel, NodeType, Weight, IsLocked)
  VALUES (N'OG-2401', NULL, N'2', N'ساخت', N'Construction', 1, N'Summary', 0.62, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'3')
  INSERT INTO dbo.pex_wbs (ProjectCode, ParentId, Code, NameFa, NameEn, NodeLevel, NodeType, Weight, IsLocked)
  VALUES (N'OG-2401', NULL, N'3', N'تدارکات', N'Procurement', 1, N'Summary', 0.20, 0);
SELECT @w1 = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'1';
SELECT @w2 = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2';
SELECT @w3 = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'3';
IF NOT EXISTS (SELECT 1 FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'1.1')
  INSERT INTO dbo.pex_wbs (ProjectCode, ParentId, Code, NameFa, NameEn, NodeLevel, NodeType, Weight, IsLocked)
  VALUES (N'OG-2401', @w1, N'1.1', N'طراحی', N'Design', 2, N'CA', 0.35, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'1.2')
  INSERT INTO dbo.pex_wbs (ProjectCode, ParentId, Code, NameFa, NameEn, NodeLevel, NodeType, Weight, IsLocked)
  VALUES (N'OG-2401', @w1, N'1.2', N'فونداسیون', N'Foundations', 2, N'WP', 0.65, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2.1')
  INSERT INTO dbo.pex_wbs (ProjectCode, ParentId, Code, NameFa, NameEn, NodeLevel, NodeType, Weight, IsLocked)
  VALUES (N'OG-2401', @w2, N'2.1', N'سازه', N'Structural', 2, N'WP', 0.30, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2.2')
  INSERT INTO dbo.pex_wbs (ProjectCode, ParentId, Code, NameFa, NameEn, NodeLevel, NodeType, Weight, IsLocked)
  VALUES (N'OG-2401', @w2, N'2.2', N'پایپینگ', N'Piping', 2, N'WP', 0.45, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2.3')
  INSERT INTO dbo.pex_wbs (ProjectCode, ParentId, Code, NameFa, NameEn, NodeLevel, NodeType, Weight, IsLocked)
  VALUES (N'OG-2401', @w2, N'2.3', N'برق', N'Electrical', 2, N'WP', 0.25, 0);
SELECT @w12 = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'1.2';
SELECT @w21 = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2.1';
SELECT @w22 = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2.2';
SELECT @w23 = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2.3';
GO

-- Activities
DECLARE @w12b INT, @w21b INT, @w22b INT, @w23b INT;
SELECT @w12b = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'1.2';
SELECT @w21b = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2.1';
SELECT @w22b = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2.2';
SELECT @w23b = Id FROM dbo.pex_wbs WHERE ProjectCode = N'OG-2401' AND Code = N'2.3';
IF NOT EXISTS (SELECT 1 FROM dbo.pex_activity WHERE ProjectCode = N'OG-2401' AND Code = N'CIV-001')
  INSERT INTO dbo.pex_activity (ProjectCode, WbsId, Code, NameFa, NameEn, Bac, DurationHours, TotalFloatH, PctApproved, PctPhysicalDraft, IsLocked, RocCode, DataDate)
  VALUES (N'OG-2401', @w12b, N'CIV-001', N'بتن فونداسیون', N'Foundation pour', 4200, 80, 0, 0.62, 0.70, 1, N'CIV-FND', '2026-09-04');
IF NOT EXISTS (SELECT 1 FROM dbo.pex_activity WHERE ProjectCode = N'OG-2401' AND Code = N'PIP-ISO-012')
  INSERT INTO dbo.pex_activity (ProjectCode, WbsId, Code, NameFa, NameEn, Bac, DurationHours, TotalFloatH, PctApproved, PctPhysicalDraft, IsLocked, RocCode, DataDate)
  VALUES (N'OG-2401', @w22b, N'PIP-ISO-012', N'اسپول خط ۱۲', N'Spool 12', 3100, 40, 0, 0.41, 0.50, 1, N'PIP-LINE', '2026-09-04');
IF NOT EXISTS (SELECT 1 FROM dbo.pex_activity WHERE ProjectCode = N'OG-2401' AND Code = N'ELE-CBL-04')
  INSERT INTO dbo.pex_activity (ProjectCode, WbsId, Code, NameFa, NameEn, Bac, DurationHours, TotalFloatH, PctApproved, PctPhysicalDraft, IsLocked, RocCode, DataDate)
  VALUES (N'OG-2401', @w23b, N'ELE-CBL-04', N'کابل فشار متوسط', N'MV cable', 1800, 32, 48, 0.28, 0.28, 0, N'ELE-CABLE', '2026-09-04');
IF NOT EXISTS (SELECT 1 FROM dbo.pex_activity WHERE ProjectCode = N'OG-2401' AND Code = N'STR-PR-02')
  INSERT INTO dbo.pex_activity (ProjectCode, WbsId, Code, NameFa, NameEn, Bac, DurationHours, TotalFloatH, PctApproved, PctPhysicalDraft, IsLocked, RocCode, DataDate)
  VALUES (N'OG-2401', @w21b, N'STR-PR-02', N'پایپ‌رک محور B', N'Piperack B', 2600, 56, 16, 0.55, 0.60, 1, N'STR-STL', '2026-09-04');
GO

-- Activity steps (ApprovedQty = Target × pctApproved)
DECLARE @aCiv INT, @aPip INT, @aEle INT, @aStr INT;
SELECT @aCiv = Id FROM dbo.pex_activity WHERE ProjectCode = N'OG-2401' AND Code = N'CIV-001';
SELECT @aPip = Id FROM dbo.pex_activity WHERE ProjectCode = N'OG-2401' AND Code = N'PIP-ISO-012';
SELECT @aEle = Id FROM dbo.pex_activity WHERE ProjectCode = N'OG-2401' AND Code = N'ELE-CBL-04';
SELECT @aStr = Id FROM dbo.pex_activity WHERE ProjectCode = N'OG-2401' AND Code = N'STR-PR-02';

IF NOT EXISTS (SELECT 1 FROM dbo.pex_activity_step WHERE ActivityId = @aCiv AND StepSeq = 1)
  INSERT INTO dbo.pex_activity_step (ActivityId, StepSeq, NameFa, NameEn, Weight, TargetQty, Uom, ApprovedQty) VALUES
  (@aCiv, 1, N'گودبرداری', N'Excavation', 0.10, 500, N'm3', 310),
  (@aCiv, 2, N'بتن مگر', N'Lean concrete', 0.08, 60, N'm3', 37.2),
  (@aCiv, 3, N'آرماتوربندی', N'Rebar', 0.22, 45, N'ton', 27.9),
  (@aCiv, 4, N'قالب‌بندی', N'Formwork', 0.12, 800, N'm2', 496),
  (@aCiv, 5, N'بتن‌ریزی', N'Pour', 0.30, 420, N'm3', 260.4),
  (@aCiv, 6, N'عمل‌آوری', N'Curing', 0.18, 14, N'day', 8.68);
IF NOT EXISTS (SELECT 1 FROM dbo.pex_activity_step WHERE ActivityId = @aPip AND StepSeq = 1)
  INSERT INTO dbo.pex_activity_step (ActivityId, StepSeq, NameFa, NameEn, Weight, TargetQty, Uom, ApprovedQty) VALUES
  (@aPip, 1, N'ساخت اسپول', N'Spool fab', 0.12, 12, N'jt', 4.92),
  (@aPip, 2, N'فیت‌آپ', N'Fit-up', 0.15, 40, N'di', 16.4),
  (@aPip, 3, N'جوشکاری', N'Welding', 0.22, 40, N'di', 16.4),
  (@aPip, 4, N'تست غیرمخرب', N'NDT', 0.13, 40, N'jt', 16.4),
  (@aPip, 5, N'تنش‌زدایی', N'PWHT', 0.08, 8, N'jt', 3.28),
  (@aPip, 6, N'هیدروتست', N'Hydrotest', 0.18, 3, N'test', 1.23),
  (@aPip, 7, N'رنگ', N'Painting', 0.12, 250, N'm2', 102.5);
IF NOT EXISTS (SELECT 1 FROM dbo.pex_activity_step WHERE ActivityId = @aEle AND StepSeq = 1)
  INSERT INTO dbo.pex_activity_step (ActivityId, StepSeq, NameFa, NameEn, Weight, TargetQty, Uom, ApprovedQty) VALUES
  (@aEle, 1, N'سینی کابل', N'Cable tray', 0.15, 120, N'm', 33.6),
  (@aEle, 2, N'کابل‌کشی', N'Pulling', 0.35, 1800, N'm', 504),
  (@aEle, 3, N'سرسیم‌بندی', N'Termination', 0.25, 64, N'ea', 17.92),
  (@aEle, 4, N'تست مگر', N'Megger test', 0.25, 64, N'test', 17.92);
IF NOT EXISTS (SELECT 1 FROM dbo.pex_activity_step WHERE ActivityId = @aStr AND StepSeq = 1)
  INSERT INTO dbo.pex_activity_step (ActivityId, StepSeq, NameFa, NameEn, Weight, TargetQty, Uom, ApprovedQty) VALUES
  (@aStr, 1, N'ساخت', N'Fabrication', 0.30, 18, N'ton', 9.9),
  (@aStr, 2, N'نصب', N'Erection', 0.40, 18, N'ton', 9.9),
  (@aStr, 3, N'بولت و تراز', N'Bolting & alignment', 0.15, 320, N'bolt', 176),
  (@aStr, 4, N'رنگ', N'Painting', 0.15, 180, N'm2', 99);
GO

-- Milestones
DECLARE @mCiv INT, @mPip INT;
SELECT @mCiv = Id FROM dbo.pex_activity WHERE ProjectCode = N'OG-2401' AND Code = N'CIV-001';
SELECT @mPip = Id FROM dbo.pex_activity WHERE ProjectCode = N'OG-2401' AND Code = N'PIP-ISO-012';
IF NOT EXISTS (SELECT 1 FROM dbo.pex_milestone WHERE ProjectCode = N'OG-2401' AND Code = N'MS-MECH-RFSU')
  INSERT INTO dbo.pex_milestone (ProjectCode, ActivityId, Code, MsType, Status, ContractualDate, ForecastDate, ContractualFa, ForecastFa, PenaltyPerDay, OwnerOrg, Priority)
  VALUES (N'OG-2401', @mPip, N'MS-MECH-RFSU', N'Contractual', N'Delayed', '2026-02-02', '2026-02-16', N'1404/11/14', N'1404/11/28', 25000, N'Contractor', N'Critical');
IF NOT EXISTS (SELECT 1 FROM dbo.pex_milestone WHERE ProjectCode = N'OG-2401' AND Code = N'MS-CIV-FOC')
  INSERT INTO dbo.pex_milestone (ProjectCode, ActivityId, Code, MsType, Status, ContractualDate, ForecastDate, ContractualFa, ForecastFa, PenaltyPerDay, OwnerOrg, Priority)
  VALUES (N'OG-2401', @mCiv, N'MS-CIV-FOC', N'Key', N'AtRisk', '2024-09-22', '2024-09-25', N'1403/07/01', N'1403/07/04', 0, N'Contractor', N'High');
IF NOT EXISTS (SELECT 1 FROM dbo.pex_milestone WHERE ProjectCode = N'OG-2401' AND Code = N'MS-PIP-HYDRO')
  INSERT INTO dbo.pex_milestone (ProjectCode, ActivityId, Code, MsType, Status, ContractualDate, ForecastDate, ContractualFa, ForecastFa, PenaltyPerDay, OwnerOrg, Priority)
  VALUES (N'OG-2401', @mPip, N'MS-PIP-HYDRO', N'Gate', N'OnTrack', '2024-12-05', '2024-12-02', N'1403/09/15', N'1403/09/12', 0, N'Contractor', N'Medium');
GO
