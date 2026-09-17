/* ─────────────────────────────────────────────────────────────
   HSE-D2 · Seed ایمنی/بهداشت/محیط پروژه OG-2401 (idempotent)
   آینه src/services/hse.ts (جز hse_tbt که نمونه گویاست — رکوع D2 §۵)
   پیش‌نیاز: V003__hse.sql + سید pex (ردیف pex_project)
   ───────────────────────────────────────────────────────────── */

-- من‌اور دوره‌ای (مبنای TRIR/LTIFR)
IF NOT EXISTS (SELECT 1 FROM dbo.hse_manhour WHERE ProjectCode = N'OG-2401' AND Period = N'1405-04')
  INSERT INTO dbo.hse_manhour (ProjectCode, Period, Hours) VALUES (N'OG-2401', N'1405-04', 176400);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_manhour WHERE ProjectCode = N'OG-2401' AND Period = N'1405-05')
  INSERT INTO dbo.hse_manhour (ProjectCode, Period, Hours) VALUES (N'OG-2401', N'1405-05', 184000);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_manhour WHERE ProjectCode = N'OG-2401' AND Period = N'1405-06')
  INSERT INTO dbo.hse_manhour (ProjectCode, Period, Hours) VALUES (N'OG-2401', N'1405-06', 62100);
GO

-- رجیستر حوادث (SeverityW از severityWeight موتور)
IF NOT EXISTS (SELECT 1 FROM dbo.hse_incident WHERE ProjectCode = N'OG-2401' AND Code = N'INC-101')
  INSERT INTO dbo.hse_incident (ProjectCode, Code, IncidentDate, Type, SeverityW, LostDays, Area, DescFa, Status, VolumeL)
  VALUES (N'OG-2401', N'INC-101', '2026-08-02', N'near_miss', 0.2, 0, N'Piperack B', N'سقوط ابزار از ارتفاع (بدون مصدوم)', N'closed', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_incident WHERE ProjectCode = N'OG-2401' AND Code = N'INC-102')
  INSERT INTO dbo.hse_incident (ProjectCode, Code, IncidentDate, Type, SeverityW, LostDays, Area, DescFa, Status, VolumeL)
  VALUES (N'OG-2401', N'INC-102', '2026-08-09', N'first_aid', 1, 0, N'FND', N'بریدگی سطحی دست', N'closed', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_incident WHERE ProjectCode = N'OG-2401' AND Code = N'INC-103')
  INSERT INTO dbo.hse_incident (ProjectCode, Code, IncidentDate, Type, SeverityW, LostDays, Area, DescFa, Status, VolumeL)
  VALUES (N'OG-2401', N'INC-103', '2026-08-17', N'medical', 5, 0, N'Spool yard', N'درمان سرپایی چشم', N'closed', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_incident WHERE ProjectCode = N'OG-2401' AND Code = N'INC-104')
  INSERT INTO dbo.hse_incident (ProjectCode, Code, IncidentDate, Type, SeverityW, LostDays, Area, DescFa, Status, VolumeL)
  VALUES (N'OG-2401', N'INC-104', '2026-08-21', N'spill', 3, 0, N'Laydown', N'نشت ۱۲ لیتری گازوئیل', N'closed', 12);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_incident WHERE ProjectCode = N'OG-2401' AND Code = N'INC-105')
  INSERT INTO dbo.hse_incident (ProjectCode, Code, IncidentDate, Type, SeverityW, LostDays, Area, DescFa, Status, VolumeL)
  VALUES (N'OG-2401', N'INC-105', '2026-08-28', N'near_miss', 0.2, 0, N'MV trench', N'نزدیک‌برخورد با کابل مدفون', N'investigating', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_incident WHERE ProjectCode = N'OG-2401' AND Code = N'INC-106')
  INSERT INTO dbo.hse_incident (ProjectCode, Code, IncidentDate, Type, SeverityW, LostDays, Area, DescFa, Status, VolumeL)
  VALUES (N'OG-2401', N'INC-106', '2026-09-01', N'lost_time', 10, 4, N'Piperack B', N'پیچ‌خوردگی مچ در نصب', N'investigating', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_incident WHERE ProjectCode = N'OG-2401' AND Code = N'INC-107')
  INSERT INTO dbo.hse_incident (ProjectCode, Code, IncidentDate, Type, SeverityW, LostDays, Area, DescFa, Status, VolumeL)
  VALUES (N'OG-2401', N'INC-107', '2026-09-03', N'property', 2, 0, N'Gate', N'برخورد لیفتراک با گارد', N'open', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_incident WHERE ProjectCode = N'OG-2401' AND Code = N'INC-108')
  INSERT INTO dbo.hse_incident (ProjectCode, Code, IncidentDate, Type, SeverityW, LostDays, Area, DescFa, Status, VolumeL)
  VALUES (N'OG-2401', N'INC-108', '2026-09-05', N'first_aid', 1, 0, N'FND', N'کمک‌های اولیه گرمازدگی', N'open', NULL);
GO

-- پروانه‌های کار (FlagsJson در جریان D3 پر می‌شود)
IF NOT EXISTS (SELECT 1 FROM dbo.hse_permit WHERE ProjectCode = N'OG-2401' AND No = N'PTW-2201')
  INSERT INTO dbo.hse_permit (ProjectCode, No, Type, Status, WorkDate, Area, RiskLevel, FlagsJson, ExpiresAt)
  VALUES (N'OG-2401', N'PTW-2201', N'hot', N'closed', '2026-08-28', N'Spool yard', N'high', NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_permit WHERE ProjectCode = N'OG-2401' AND No = N'PTW-2202')
  INSERT INTO dbo.hse_permit (ProjectCode, No, Type, Status, WorkDate, Area, RiskLevel, FlagsJson, ExpiresAt)
  VALUES (N'OG-2401', N'PTW-2202', N'confined', N'active', '2026-09-06', N'Tank TK-01', N'high', NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_permit WHERE ProjectCode = N'OG-2401' AND No = N'PTW-2203')
  INSERT INTO dbo.hse_permit (ProjectCode, No, Type, Status, WorkDate, Area, RiskLevel, FlagsJson, ExpiresAt)
  VALUES (N'OG-2401', N'PTW-2203', N'electrical', N'approved', '2026-09-08', N'MCC room', N'medium', NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_permit WHERE ProjectCode = N'OG-2401' AND No = N'PTW-2204')
  INSERT INTO dbo.hse_permit (ProjectCode, No, Type, Status, WorkDate, Area, RiskLevel, FlagsJson, ExpiresAt)
  VALUES (N'OG-2401', N'PTW-2204', N'height', N'requested', '2026-09-09', N'Piperack B', N'medium', NULL, NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_permit WHERE ProjectCode = N'OG-2401' AND No = N'PTW-2205')
  INSERT INTO dbo.hse_permit (ProjectCode, No, Type, Status, WorkDate, Area, RiskLevel, FlagsJson, ExpiresAt)
  VALUES (N'OG-2401', N'PTW-2205', N'cold', N'draft', '2026-09-10', N'Laydown', N'low', NULL, NULL);
GO

-- بازرسی‌ها (Score/Band از موتور؛ NextDue طبق قاعده باند)
IF NOT EXISTS (SELECT 1 FROM dbo.hse_inspection WHERE ProjectCode = N'OG-2401' AND Area = N'Spool yard' AND InspectDate = '2026-09-04')
  INSERT INTO dbo.hse_inspection (ProjectCode, Area, InspectDate, Score, Band, ItemsJson, NextDue)
  VALUES (N'OG-2401', N'Spool yard', '2026-09-04', 75, 'B',
    N'[{"item":"کپسول حریق","ok":1},{"item":"داربست برچسب‌دار","ok":1},{"item":"سیم ارت","ok":0},{"item":"نظم کارگاه","ok":1}]', '2026-10-04');
IF NOT EXISTS (SELECT 1 FROM dbo.hse_inspection WHERE ProjectCode = N'OG-2401' AND Area = N'Piperack B' AND InspectDate = '2026-09-05')
  INSERT INTO dbo.hse_inspection (ProjectCode, Area, InspectDate, Score, Band, ItemsJson, NextDue)
  VALUES (N'OG-2401', N'Piperack B', '2026-09-05', 100, 'A',
    N'[{"item":"هارنس","ok":1},{"item":"توری زیرکار","ok":1},{"item":"روشنایی","ok":1},{"item":"نردبان استاندارد","ok":1}]', '2026-12-04');
IF NOT EXISTS (SELECT 1 FROM dbo.hse_inspection WHERE ProjectCode = N'OG-2401' AND Area = N'Tank TK-01' AND InspectDate = '2026-09-06')
  INSERT INTO dbo.hse_inspection (ProjectCode, Area, InspectDate, Score, Band, ItemsJson, NextDue)
  VALUES (N'OG-2401', N'Tank TK-01', '2026-09-06', 50, 'D',
    N'[{"item":"گازسنج کالیبره","ok":1},{"item":"تهویه","ok":0},{"item":"نگهبان دهانه","ok":1},{"item":"طناب نجات","ok":0}]', '2026-09-13');
IF NOT EXISTS (SELECT 1 FROM dbo.hse_inspection WHERE ProjectCode = N'OG-2401' AND Area = N'MCC room' AND InspectDate = '2026-09-07')
  INSERT INTO dbo.hse_inspection (ProjectCode, Area, InspectDate, Score, Band, ItemsJson, NextDue)
  VALUES (N'OG-2401', N'MCC room', '2026-09-07', 100, 'A',
    N'[{"item":"LOTO","ok":1},{"item":"دستکش عایق","ok":1},{"item":"کفپوش","ok":1}]', '2026-12-06');
GO

-- اقدامات اصلاحی (IncidentId/Escalation موتوری‌اند)
IF NOT EXISTS (SELECT 1 FROM dbo.hse_action WHERE ProjectCode = N'OG-2401' AND Title = N'رفع نقص سیم ارت اسپول‌یارد')
  INSERT INTO dbo.hse_action (ProjectCode, IncidentId, Title, DueDate, ClosedAt, Severity, Escalation)
  VALUES (N'OG-2401', NULL, N'رفع نقص سیم ارت اسپول‌یارد', '2026-09-06', '2026-09-05', N'medium', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_action WHERE ProjectCode = N'OG-2401' AND Title = N'تهویه و طناب نجات TK-01')
  INSERT INTO dbo.hse_action (ProjectCode, IncidentId, Title, DueDate, ClosedAt, Severity, Escalation)
  VALUES (N'OG-2401', NULL, N'تهویه و طناب نجات TK-01', '2026-09-09', NULL, N'critical', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_action WHERE ProjectCode = N'OG-2401' AND Title = N'برچسب‌گذاری مجدد داربست‌ها')
  INSERT INTO dbo.hse_action (ProjectCode, IncidentId, Title, DueDate, ClosedAt, Severity, Escalation)
  VALUES (N'OG-2401', NULL, N'برچسب‌گذاری مجدد داربست‌ها', '2026-09-12', NULL, N'low', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_action WHERE ProjectCode = N'OG-2401' AND Title = N'آموزش مجدد LOTO برق')
  INSERT INTO dbo.hse_action (ProjectCode, IncidentId, Title, DueDate, ClosedAt, Severity, Escalation)
  VALUES (N'OG-2401', NULL, N'آموزش مجدد LOTO برق', '2026-09-04', NULL, N'high', NULL);
IF NOT EXISTS (SELECT 1 FROM dbo.hse_action WHERE ProjectCode = N'OG-2401' AND Title = N'خط‌کشی مسیر لیفتراک گیت')
  INSERT INTO dbo.hse_action (ProjectCode, IncidentId, Title, DueDate, ClosedAt, Severity, Escalation)
  VALUES (N'OG-2401', NULL, N'خط‌کشی مسیر لیفتراک گیت', '2026-09-15', NULL, N'medium', NULL);
GO

-- جلسات TBT (نمونه گویا — سید D1 فقط تجمیع دارد)
IF NOT EXISTS (SELECT 1 FROM dbo.hse_tbt WHERE ProjectCode = N'OG-2401' AND SessionDate = '2026-08-25' AND Area = N'Spool yard')
  INSERT INTO dbo.hse_tbt (ProjectCode, SessionDate, Area, Attendees, Topic)
  VALUES (N'OG-2401', '2026-08-25', N'Spool yard', 14, N'ایمنی جوشکاری و حریق');
IF NOT EXISTS (SELECT 1 FROM dbo.hse_tbt WHERE ProjectCode = N'OG-2401' AND SessionDate = '2026-08-27' AND Area = N'Piperack B')
  INSERT INTO dbo.hse_tbt (ProjectCode, SessionDate, Area, Attendees, Topic)
  VALUES (N'OG-2401', '2026-08-27', N'Piperack B', 18, N'کار در ارتفاع و هارنس');
IF NOT EXISTS (SELECT 1 FROM dbo.hse_tbt WHERE ProjectCode = N'OG-2401' AND SessionDate = '2026-09-01' AND Area = N'Tank TK-01')
  INSERT INTO dbo.hse_tbt (ProjectCode, SessionDate, Area, Attendees, Topic)
  VALUES (N'OG-2401', '2026-09-01', N'Tank TK-01', 9, N'ورود به فضای بسته');
IF NOT EXISTS (SELECT 1 FROM dbo.hse_tbt WHERE ProjectCode = N'OG-2401' AND SessionDate = '2026-09-03' AND Area = N'MCC room')
  INSERT INTO dbo.hse_tbt (ProjectCode, SessionDate, Area, Attendees, Topic)
  VALUES (N'OG-2401', '2026-09-03', N'MCC room', 8, N'LOTO و ایمنی برق');
IF NOT EXISTS (SELECT 1 FROM dbo.hse_tbt WHERE ProjectCode = N'OG-2401' AND SessionDate = '2026-09-05' AND Area = N'FND')
  INSERT INTO dbo.hse_tbt (ProjectCode, SessionDate, Area, Attendees, Topic)
  VALUES (N'OG-2401', '2026-09-05', N'FND', 16, N'گرمازدگی و هیدراتاسیون');
IF NOT EXISTS (SELECT 1 FROM dbo.hse_tbt WHERE ProjectCode = N'OG-2401' AND SessionDate = '2026-09-07' AND Area = N'Laydown')
  INSERT INTO dbo.hse_tbt (ProjectCode, SessionDate, Area, Attendees, Topic)
  VALUES (N'OG-2401', '2026-09-07', N'Laydown', 12, N'نظم کارگاه و تفکیک پسماند');
GO
