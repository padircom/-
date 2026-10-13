/**
 * بخش ۶ سازمان: مدیریت جامع منابع انسانی (Enterprise HRM Workspace API)
 * منطبق با ISO 30414 و قوانین کار و تأمین اجتماعی ایران.
 * ═══════════════════════════════════════════════════════════════════════════
 * شامل ۵ زیرماژول اصلی:
 * ۱. ساختار سازمانی، پرونده پرسنلی، احکام کارگزینی، قراردادها و ماتریس مهارت
 * ۲. حضور و غیاب، شیفت‌های کارگاهی/دکلی، مرخصی و مأموریت (متصل به CMMS و MES)
 * ۳. محاسبه حقوق و دستمزد، بیمه تأمین اجتماعی (۷٪/۲۳٪)، مالیات و تسهیم هزینه به مالی
 * ۴. آموزش و توسعه صلاحیت (نیازسنجی TNA، برنامه‌ریزی دوره‌ها و اثربخشی کرک‌پاتریک)
 * ۵. مدیریت و ارزیابی عملکرد (KPI/OKR فردی و ارزیابی ۳۶۰ درجه)
 */

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function wrapRepo(r, actorId = "system") {
  return {
    async list(table, filter = {}) {
      const where = Object.entries(filter).map(([column, value]) => ({ column, op: "eq", value }));
      return r.list(table, { where, limit: 5000 });
    },
    async get(table, id) {
      return r.get(table, id);
    },
    async insert(table, row) {
      const clean = r.pickWritable ? r.pickWritable(table, row) : row;
      return r.create(table, clean, actorId);
    },
    async update(table, id, patch) {
      const clean = r.pickWritable ? r.pickWritable(table, patch) : patch;
      await r.patch(table, id, clean, actorId);
      return r.get(table, id);
    },
    async remove(table, id) {
      return r.remove(table, id);
    },
  };
}

export async function seedHrmWorkspaceData(db, projectId = "c1-p1") {
  const existingUnits = await db.list("HrmOrgUnit", { ProjectId: projectId });
  if (existingUnits.length > 0) {
    return { seeded: false, projectId, orgUnits: existingUnits.length };
  }

  /* ── ۱. چارت سازمانی (HrmOrgUnit) ── */
  const orgUnits = [
    {
      Id: `hou-${projectId}-01`, ProjectId: projectId, Code: "ORG-EXEC-01",
      TitleFa: "مدیریت عامل و راهبری عملیات", TitleEn: "Executive Operations Division",
      UnitType: "executive", ParentUnitCode: null, ManagerPersonNo: "EMP-1001",
      CostCenterRef: "CC-100-EXEC", ApprovedHeadcount: 12, CurrentHeadcount: 11, Status: "active",
      NoteFa: "سطح ارشد راهبری ۵+۲ ستون سازمانی (ISO 30414)",
    },
    {
      Id: `hou-${projectId}-02`, ProjectId: projectId, Code: "ORG-MES-10",
      TitleFa: "مدیریت کارگاه ساخت و تولید صنعتی (MES)", TitleEn: "Manufacturing & Shop-Floor Dept",
      UnitType: "workshop", ParentUnitCode: "ORG-EXEC-01", ManagerPersonNo: "EMP-1002",
      CostCenterRef: "CC-210-MES", ApprovedHeadcount: 48, CurrentHeadcount: 44, Status: "active",
      NoteFa: "متصل به مراکز کاری ماشین‌کاری CNC، جوشکاری و مونتاژ سنگین",
    },
    {
      Id: `hou-${projectId}-03`, ProjectId: projectId, Code: "ORG-CMMS-20",
      TitleFa: "مدیریت نگهداری و تعمیرات و قابلیت اطمینان (CMMS)", TitleEn: "Maintenance & Reliability Dept",
      UnitType: "department", ParentUnitCode: "ORG-EXEC-01", ManagerPersonNo: "EMP-1003",
      CostCenterRef: "CC-310-CMMS", ApprovedHeadcount: 32, CurrentHeadcount: 30, Status: "active",
      NoteFa: "پشتیبانی فنی تجهیزات دوار، برق و ابزار دقیق سایت و کارخانه",
    },
    {
      Id: `hou-${projectId}-04`, ProjectId: projectId, Code: "ORG-RIG-30",
      TitleFa: "عملیات حفاری و پایش میدانی دکل‌ها (IIoT / Rig Crew)", TitleEn: "Drilling Rig Operations Crew",
      UnitType: "rig-crew", ParentUnitCode: "ORG-EXEC-01", ManagerPersonNo: "EMP-1004",
      CostCenterRef: "CC-410-RIG", ApprovedHeadcount: 40, CurrentHeadcount: 38, Status: "active",
      NoteFa: "پرسنل اقماری ۱۴-۱۴ دکل‌های حفاری و تله‌متری DAS",
    },
    {
      Id: `hou-${projectId}-05`, ProjectId: projectId, Code: "ORG-HRM-40",
      TitleFa: "مدیریت سرمایه انسانی، آموزش و جبران خدمات", TitleEn: "Human Capital & Payroll Dept",
      UnitType: "department", ParentUnitCode: "ORG-EXEC-01", ManagerPersonNo: "EMP-1005",
      CostCenterRef: "CC-510-HRM", ApprovedHeadcount: 10, CurrentHeadcount: 10, Status: "active",
      NoteFa: "مرکز مدیریت امور پرسنلی، حقوق و دستمزد و آکادمی آموزش",
    },
  ];
  for (const row of orgUnits) await db.insert("HrmOrgUnit", row);

  /* ── ۲. شناسنامه جامع پرسنل (HrmPersonnelProfile) ── */
  const profiles = [
    {
      Id: `hpp-${projectId}-01`, ProjectId: projectId, PersonnelNo: "EMP-1001",
      FullNameFa: "مهندس بهرام فرهمند", FullNameEn: "Bahram Farahmand",
      NationalId: "0061849201", BirthDate: "1979-05-12", HireDate: "2018-04-01",
      EmploymentType: "permanent", OrgUnitCode: "ORG-EXEC-01",
      JobTitleFa: "مدیر عملیات یکپارچه پروژه و کارخانه", JobGrade: "G-18",
      EducationLevel: "master", InsuranceNo: "0048291051",
      CmmsTechnicianRef: null, MesOperatorRef: null, Status: "active",
      NoteFa: "دارای گواهی PMP و ۱۸ سال سابقه در پروژه‌های نفت، گاز و ساخت",
    },
    {
      Id: `hpp-${projectId}-02`, ProjectId: projectId, PersonnelNo: "EMP-1002",
      FullNameFa: "مهندس سهراب کاظمی", FullNameEn: "Sohrab Kazemi",
      NationalId: "1289401238", BirthDate: "1984-08-23", HireDate: "2020-02-15",
      EmploymentType: "permanent", OrgUnitCode: "ORG-MES-10",
      JobTitleFa: "سرپرست ارشد ماشین‌کاری CNC و ساخت", JobGrade: "G-15",
      EducationLevel: "bachelor", InsuranceNo: "0059182734",
      CmmsTechnicianRef: null, MesOperatorRef: "WC-CNC-01", Status: "active",
      NoteFa: "اپراتور و سرپرست کلیدی مرکز کاری تراش و فرز ۵ محور در MES",
    },
    {
      Id: `hpp-${projectId}-03`, ProjectId: projectId, PersonnelNo: "EMP-1003",
      FullNameFa: "مهندس کاوه رستمی", FullNameEn: "Kaveh Rostami",
      NationalId: "2290184712", BirthDate: "1986-11-04", HireDate: "2021-06-01",
      EmploymentType: "contractual", OrgUnitCode: "ORG-CMMS-20",
      JobTitleFa: "کارشناس ارشد تعمیرات تجهیزات دوار و ارتعاش‌سنجی", JobGrade: "G-14",
      EducationLevel: "master", InsuranceNo: "0071829402",
      CmmsTechnicianRef: "TECH-ROT-01", MesOperatorRef: "WC-ASM-02", Status: "active",
      NoteFa: "متصل به دستورکارهای نت پیشگیرانه و پایش وضعیت ISO 17359",
    },
    {
      Id: `hpp-${projectId}-04`, ProjectId: projectId, PersonnelNo: "EMP-1004",
      FullNameFa: "مهندس سامان درخشانی", FullNameEn: "Saman Derakhshani",
      NationalId: "1759203845", BirthDate: "1983-02-19", HireDate: "2019-09-10",
      EmploymentType: "rotational-rig", OrgUnitCode: "ORG-RIG-30",
      JobTitleFa: "سرپرست شیفت حفاری و تله‌متری دکل (Rig Toolpusher)", JobGrade: "G-16",
      EducationLevel: "bachelor", InsuranceNo: "0063918205",
      CmmsTechnicianRef: "TECH-RIG-04", MesOperatorRef: null, Status: "active",
      NoteFa: "دارای گواهی کنترل فوران چاه (IWCF Level 4) — اقماری ۱۴/۱۴",
    },
    {
      Id: `hpp-${projectId}-05`, ProjectId: projectId, PersonnelNo: "EMP-1005",
      FullNameFa: "مهندس نیلوفر تابش", FullNameEn: "Niloofar Tabesh",
      NationalId: "0079182640", BirthDate: "1988-07-30", HireDate: "2021-01-10",
      EmploymentType: "permanent", OrgUnitCode: "ORG-HRM-40",
      JobTitleFa: "مدیر سرمایه انسانی و توسعه سازمانی", JobGrade: "G-16",
      EducationLevel: "master", InsuranceNo: "0081920384",
      CmmsTechnicianRef: null, MesOperatorRef: null, Status: "active",
      NoteFa: "مسئول پیاده‌سازی استاندارد ISO 30414 و طرح طبقه‌بندی مشاغل",
    },
    {
      Id: `hpp-${projectId}-06`, ProjectId: projectId, PersonnelNo: "EMP-1006",
      FullNameFa: "استادکار فرهاد نادری", FullNameEn: "Farhad Naderi",
      NationalId: "3391029384", BirthDate: "1985-12-09", HireDate: "2022-03-01",
      EmploymentType: "contractual", OrgUnitCode: "ORG-MES-10",
      JobTitleFa: "جوشکار ارشد مخازن تحت فشار (6G / GTAW)", JobGrade: "G-13",
      EducationLevel: "associate", InsuranceNo: "0091827365",
      CmmsTechnicianRef: "TECH-WLD-02", MesOperatorRef: "WC-WLD-01", Status: "active",
      NoteFa: "دارای گواهی ASME Sec IX برای جوشکاری لوله‌های پرفشار و مخازن",
    },
  ];
  for (const row of profiles) await db.insert("HrmPersonnelProfile", row);

  /* ── ۳. احکام کارگزینی (HrmPersonnelAction) ── */
  const actions = [
    {
      Id: `hpa-${projectId}-01`, ProjectId: projectId, ActionNo: "DEC-1405-001",
      PersonnelNo: "EMP-1002", ActionType: "promotion", EffectiveDate: "2026-04-01",
      FromOrgUnitCode: "ORG-MES-10", ToOrgUnitCode: "ORG-MES-10",
      FromJobGrade: "G-14", ToJobGrade: "G-15",
      BaseSalaryRials: 385000000, HousingAllowanceRials: 45000000,
      FoodAllowanceRials: 55000000, ChildAllowanceRials: 32000000,
      SeniorityAllowanceRials: 28000000, ApprovedBy: "u-hr", Status: "issued",
      NoteFa: "ارتقای گروه شغلی به‌پاس افزایش ۱۲٪ راندمان مرکز کاری CNC در سه‌ماهه اخیر",
    },
    {
      Id: `hpa-${projectId}-02`, ProjectId: projectId, ActionNo: "DEC-1405-002",
      PersonnelNo: "EMP-1003", ActionType: "salary-revision", EffectiveDate: "2026-04-01",
      FromOrgUnitCode: "ORG-CMMS-20", ToOrgUnitCode: "ORG-CMMS-20",
      FromJobGrade: "G-14", ToJobGrade: "G-14",
      BaseSalaryRials: 360000000, HousingAllowanceRials: 45000000,
      FoodAllowanceRials: 55000000, ChildAllowanceRials: 16000000,
      SeniorityAllowanceRials: 24000000, ApprovedBy: "u-hr", Status: "issued",
      NoteFa: "اعمال مصوبه شورای عالی کار و فوق‌العاده تخصصی پایش ارتعاشات ISO 17359",
    },
    {
      Id: `hpa-${projectId}-03`, ProjectId: projectId, ActionNo: "DEC-1405-003",
      PersonnelNo: "EMP-1004", ActionType: "shift-change", EffectiveDate: "2026-05-01",
      FromOrgUnitCode: "ORG-RIG-30", ToOrgUnitCode: "ORG-RIG-30",
      FromJobGrade: "G-16", ToJobGrade: "G-16",
      BaseSalaryRials: 440000000, HousingAllowanceRials: 45000000,
      FoodAllowanceRials: 55000000, ChildAllowanceRials: 32000000,
      SeniorityAllowanceRials: 35000000, ApprovedBy: "u-pm", Status: "issued",
      NoteFa: "حکم سرپرستی اقماری ۱۴-۱۴ دکل حفاری با احتساب فوق‌العاده سختی کار و اقماری",
    },
    {
      Id: `hpa-${projectId}-04`, ProjectId: projectId, ActionNo: "DEC-1405-004",
      PersonnelNo: "EMP-1006", ActionType: "hire", EffectiveDate: "2026-04-01",
      FromOrgUnitCode: null, ToOrgUnitCode: "ORG-MES-10",
      FromJobGrade: "G-12", ToJobGrade: "G-13",
      BaseSalaryRials: 330000000, HousingAllowanceRials: 45000000,
      FoodAllowanceRials: 55000000, ChildAllowanceRials: 16000000,
      SeniorityAllowanceRials: 18000000, ApprovedBy: "u-hr", Status: "issued",
      NoteFa: "حکم سالانه جوشکار ارشد مخازن و پایپینگ کارگاه ساخت",
    },
  ];
  for (const row of actions) await db.insert("HrmPersonnelAction", row);

  /* ── ۴. قراردادهای کار (HrmEmploymentContract) ── */
  const contracts = [
    {
      Id: `hec-${projectId}-01`, ProjectId: projectId, ContractNo: "CNT-HR-1405-101",
      PersonnelNo: "EMP-1002", ContractType: "permanent",
      StartDate: "2026-03-21", EndDate: "2027-03-20",
      BaseMonthlyRials: 545000000, WeeklyHours: 44,
      WorkLocationFa: "کارخانه مرکزی ساخت و ماشین‌کاری سنگین",
      SsiCovered: true, Status: "active",
      NoteFa: "قرارداد رسمی منطبق با ماده ۷ قانون کار جمهوری اسلامی ایران",
    },
    {
      Id: `hec-${projectId}-02`, ProjectId: projectId, ContractNo: "CNT-HR-1405-102",
      PersonnelNo: "EMP-1003", ContractType: "fixed-term",
      StartDate: "2026-03-21", EndDate: "2027-03-20",
      BaseMonthlyRials: 500000000, WeeklyHours: 44,
      WorkLocationFa: "سایت بهره‌برداری و کارگاه مرکزی نت",
      SsiCovered: true, Status: "active",
      NoteFa: "قرارداد یک‌ساله تخصصی نگهداری و تعمیرات و قابلیت اطمینان",
    },
    {
      Id: `hec-${projectId}-03`, ProjectId: projectId, ContractNo: "CNT-HR-1405-103",
      PersonnelNo: "EMP-1004", ContractType: "project-phase",
      StartDate: "2026-03-21", EndDate: "2027-03-20",
      BaseMonthlyRials: 607000000, WeeklyHours: 44,
      WorkLocationFa: "میدان حفاری آزادگان — دکل RIG-DEMO",
      SsiCovered: true, Status: "active",
      NoteFa: "قرارداد اقماری ۱۴ روز کار / ۱۴ روز استراحت با پوشش کامل بیمه تأمین اجتماعی",
    },
    {
      Id: `hec-${projectId}-04`, ProjectId: projectId, ContractNo: "CNT-HR-1405-104",
      PersonnelNo: "EMP-1006", ContractType: "fixed-term",
      StartDate: "2026-03-21", EndDate: "2027-03-20",
      BaseMonthlyRials: 464000000, WeeklyHours: 44,
      WorkLocationFa: "سالن جوشکاری و مونتاژ مخازن (MES)",
      SsiCovered: true, Status: "active",
      NoteFa: "قرارداد کار معین با فوق‌العاده سختی کار جوشکاری آرگون",
    },
  ];
  for (const row of contracts) await db.insert("HrmEmploymentContract", row);

  /* ── ۵. ماتریس مهارت و گواهی‌نامه‌های فنی (HrmSkillMatrixItem) ── */
  const skills = [
    {
      Id: `hsm-${projectId}-01`, ProjectId: projectId, MatrixCode: "SKM-101",
      PersonnelNo: "EMP-1002", SkillCode: "SK-CNC-5AX",
      SkillTitleFa: "برنامه‌نویسی و اپراتوری فرز CNC پنج‌محور همزمان (Siemens 840D)",
      Discipline: "cnc-machining", ProficiencyLevel: 5,
      CertificateNo: "CERT-TUV-CNC-8821", IssuedDate: "2024-06-15", ExpiryDate: "2027-06-15",
      CmmsAssetFamilyRef: "FAM-CNC-MILL", MesWorkCenterRef: "WC-CNC-01",
      AssessedBy: "u-hr", Status: "valid",
      NoteFa: "صلاحیت سطح ۵ (استادکار/مربی) متصل به مرکز کاری WC-CNC-01 در MES",
    },
    {
      Id: `hsm-${projectId}-02`, ProjectId: projectId, MatrixCode: "SKM-102",
      PersonnelNo: "EMP-1003", SkillCode: "SK-VIB-ISO2",
      SkillTitleFa: "تحلیل ارتعاشات و هم‌محوری لیزری توربوکمپرسورها (ISO 18436 Cat II)",
      Discipline: "mechanical", ProficiencyLevel: 4,
      CertificateNo: "CERT-MOBIUS-4910", IssuedDate: "2024-11-01", ExpiryDate: "2027-11-01",
      CmmsAssetFamilyRef: "FAM-PUMP-CENT", MesWorkCenterRef: "WC-ASM-02",
      AssessedBy: "u-cmms-manager", Status: "valid",
      NoteFa: "صلاحیت صدور مجوز سلامت ارتعاشی در CMMS و پایش وضعیت CBM",
    },
    {
      Id: `hsm-${projectId}-03`, ProjectId: projectId, MatrixCode: "SKM-103",
      PersonnelNo: "EMP-1004", SkillCode: "SK-IWCF-L4",
      SkillTitleFa: "کنترل فوران چاه و مدیریت فشار حفاری (IWCF Well Control Level 4)",
      Discipline: "rig-operations", ProficiencyLevel: 5,
      CertificateNo: "IWCF-IR-2025-7741", IssuedDate: "2025-02-10", ExpiryDate: "2027-02-10",
      CmmsAssetFamilyRef: "FAM-RIG-BOP", MesWorkCenterRef: null,
      AssessedBy: "u-iiot-driller", Status: "valid",
      NoteFa: "الزامی برای سرپرستی شیفت دکل و مدیریت هشدارهای Kick در IIoT",
    },
    {
      Id: `hsm-${projectId}-04`, ProjectId: projectId, MatrixCode: "SKM-104",
      PersonnelNo: "EMP-1006", SkillCode: "SK-WELD-ASME9",
      SkillTitleFa: "جوشکاری لوله و مخازن تحت فشار در وضعیت 6G (ASME Sec IX / GTAW+SMAW)",
      Discipline: "welding", ProficiencyLevel: 4,
      CertificateNo: "WPQ-ASME-6G-309", IssuedDate: "2025-05-01", ExpiryDate: "2026-11-01",
      CmmsAssetFamilyRef: "FAM-VESSEL-HP", MesWorkCenterRef: "WC-WLD-01",
      AssessedBy: "u-qa", Status: "expiring-soon",
      NoteFa: "گواهی‌نامه در آستانه تمدید شش‌ماهه تست NDT رادیوگرافی",
    },
  ];
  for (const row of skills) await db.insert("HrmSkillMatrixItem", row);

  /* ── ۶. الگوهای تقویم کاری و شیفت‌بندی (HrmShiftPattern) ── */
  const shifts = [
    {
      Id: `hsp-${projectId}-01`, ProjectId: projectId, ShiftCode: "SHF-DAY-REG",
      TitleFa: "شیفت روزکار عادی ستاد و مهندسی (شنبه تا چهارشنبه)",
      PatternType: "day-regular", StartClock: "07:30", EndClock: "16:15",
      WorkDaysCycle: 5, RestDaysCycle: 2, StandardDailyHours: 8,
      ShiftAllowancePct: 0, NightBonusPct: 0, Status: "active",
      NoteFa: "۴۴ ساعت کار هفتگی منطبق با ماده ۵۱ قانون کار",
    },
    {
      Id: `hsp-${projectId}-02`, ProjectId: projectId, ShiftCode: "SHF-SHOP-3X8",
      TitleFa: "شیفت سه‌نوبته ۲۴ ساعته کارگاه تولید و نت (صبح/عصر/شب)",
      PatternType: "three-shift", StartClock: "07:00", EndClock: "15:00",
      WorkDaysCycle: 6, RestDaysCycle: 2, StandardDailyHours: 8,
      ShiftAllowancePct: 22.5, NightBonusPct: 35, Status: "active",
      NoteFa: "فوق‌العاده نوبت‌کاری ۲۲.۵٪ (ماده ۵۶) و شب‌کاری ۳۵٪ (ماده ۵۸ قانون کار)",
    },
    {
      Id: `hsp-${projectId}-03`, ProjectId: projectId, ShiftCode: "SHF-RIG-14X14",
      TitleFa: "شیفت اقماری ۱۴ روز کار / ۱۴ روز استراحت دکل حفاری",
      PatternType: "rotational-14-14", StartClock: "06:00", EndClock: "18:00",
      WorkDaysCycle: 14, RestDaysCycle: 14, StandardDailyHours: 12,
      ShiftAllowancePct: 15, NightBonusPct: 35, Status: "active",
      NoteFa: "شیفت عملیاتی ۱۲ ساعته دکل حفاری با ۴ ساعت اضافه‌کاری برنامه‌ریزی‌شده روزانه",
    },
  ];
  for (const row of shifts) await db.insert("HrmShiftPattern", row);

  /* ── ۷. کارکرد روزانه متصل به دستورکار CMMS و سفارش تولید MES (HrmShiftRoster) ── */
  const rosters = [
    {
      Id: `hsr-${projectId}-01`, ProjectId: projectId, RosterCode: "RST-20261012-01",
      PersonnelNo: "EMP-1002", ShiftCode: "SHF-SHOP-3X8", WorkDate: "2026-10-12",
      CheckInClock: "06:55", CheckOutClock: "17:30",
      NormalHours: 8, OvertimeHours: 2.5, NightHours: 0, HolidayHours: 0,
      AttendanceState: "present", CmmsWorkOrderRef: null,
      MesOrderRef: "MO-1405-001", MesOperationCode: "OP-020-CNC",
      Status: "verified", NoteFa: "تراشکاری شفت توربین روی سفارش تولید MO-1405-001 در MES",
    },
    {
      Id: `hsr-${projectId}-02`, ProjectId: projectId, RosterCode: "RST-20261012-02",
      PersonnelNo: "EMP-1003", ShiftCode: "SHF-SHOP-3X8", WorkDate: "2026-10-12",
      CheckInClock: "07:00", CheckOutClock: "18:00",
      NormalHours: 8, OvertimeHours: 3, NightHours: 0, HolidayHours: 0,
      AttendanceState: "present", CmmsWorkOrderRef: "WO-1405-0102",
      MesOrderRef: null, MesOperationCode: null,
      Status: "verified", NoteFa: "تعویض مکانیکال سیل و بالانس پمپ P-101A روی دستورکار نت WO-1405-0102",
    },
    {
      Id: `hsr-${projectId}-03`, ProjectId: projectId, RosterCode: "RST-20261012-03",
      PersonnelNo: "EMP-1004", ShiftCode: "SHF-RIG-14X14", WorkDate: "2026-10-12",
      CheckInClock: "06:00", CheckOutClock: "18:00",
      NormalHours: 8, OvertimeHours: 4, NightHours: 2, HolidayHours: 0,
      AttendanceState: "present", CmmsWorkOrderRef: "WO-1405-0108",
      MesOrderRef: null, MesOperationCode: null,
      Status: "verified", NoteFa: "سرپرستی عملیات حفاری چاه شماره ۱۲ و نظارت بر تست فشار BOP",
    },
    {
      Id: `hsr-${projectId}-04`, ProjectId: projectId, RosterCode: "RST-20261012-04",
      PersonnelNo: "EMP-1006", ShiftCode: "SHF-SHOP-3X8", WorkDate: "2026-10-12",
      CheckInClock: "15:00", CheckOutClock: "23:30",
      NormalHours: 8, OvertimeHours: 0.5, NightHours: 1.5, HolidayHours: 0,
      AttendanceState: "present", CmmsWorkOrderRef: null,
      MesOrderRef: "MO-1405-002", MesOperationCode: "OP-040-WELD",
      Status: "recorded", NoteFa: "جوشکاری پاس ریشه مخزن تفکیک‌گر در شیفت عصر/شب",
    },
  ];
  for (const row of rosters) await db.insert("HrmShiftRoster", row);

  /* ── ۸. مرخصی و مأموریت (HrmLeaveRequest & HrmMissionOrder) ── */
  const leaves = [
    {
      Id: `hlr-${projectId}-01`, ProjectId: projectId, LeaveNo: "LVE-1405-019",
      PersonnelNo: "EMP-1006", LeaveType: "annual",
      FromDate: "2026-10-20", ToDate: "2026-10-22", DaysCount: 3,
      ReplacementPersonNo: "EMP-1002", ApprovedBy: "u-hr", Status: "approved",
      NoteFa: "مرخصی استحقاقی با هماهنگی سرپرست کارگاه ساخت",
    },
    {
      Id: `hlr-${projectId}-02`, ProjectId: projectId, LeaveNo: "LVE-1405-020",
      PersonnelNo: "EMP-1003", LeaveType: "annual",
      FromDate: "2026-11-01", ToDate: "2026-11-02", DaysCount: 2,
      ReplacementPersonNo: "EMP-1004", ApprovedBy: null, Status: "pending",
      NoteFa: "در انتظار بررسی تداخل با اورهال پمپ‌های خوراک واحد ۱۰۰",
    },
  ];
  for (const row of leaves) await db.insert("HrmLeaveRequest", row);

  const missions = [
    {
      Id: `hmo-${projectId}-01`, ProjectId: projectId, MissionNo: "MSN-1405-008",
      PersonnelNo: "EMP-1003", DestinationFa: "پالایشگاه و میدان نفتی آزادگان جنوبی — اهواز",
      PurposeFa: "عیب‌یابی ارتعاشی و راه‌اندازی کمپرسور گاز ترش واحد تقویت فشار",
      FromDate: "2026-10-05", ToDate: "2026-10-08", DaysCount: 4,
      MissionAllowanceRials: 48000000, TransportCostRials: 32000000,
      CmmsSiteRef: "SITE-DEMO", ApprovedBy: "u-pm", Status: "completed",
      NoteFa: "مأموریت فنی اضطراری برای رفع آلارم ارتعاشات گزارش‌شده از IIoT",
    },
    {
      Id: `hmo-${projectId}-02`, ProjectId: projectId, MissionNo: "MSN-1405-009",
      PersonnelNo: "EMP-1002", DestinationFa: "شهرک صنعتی مبارکه اصفهان",
      PurposeFa: "بازرسی فنی FAT ورق‌های آلیاژی و ابزارهای برشی کاربیدی سفارش خرید SCM",
      FromDate: "2026-10-16", ToDate: "2026-10-18", DaysCount: 3,
      MissionAllowanceRials: 36000000, TransportCostRials: 24000000,
      CmmsSiteRef: "PLANT-DEMO", ApprovedBy: "u-pm", Status: "approved",
      NoteFa: "هماهنگ‌شده با واحد تأمین و تدارکات (SCM) و تضمین کیفیت",
    },
  ];
  for (const row of missions) await db.insert("HrmMissionOrder", row);

  /* ── ۹. دوره حقوق و دستمزد، فیش حقوقی و سند هزینه مالی (HrmPayrollRun, HrmPayslip, HrmCostVoucher) ── */
  const payrollRuns = [
    {
      Id: `hpr-${projectId}-01`, ProjectId: projectId, RunNo: "PAY-1405-07",
      PeriodCode: "1405-07", TitleFa: "محاسبه حقوق و مزایای مهرماه ۱۴۰۵ (پرسنل ستاد، کارگاه MES، نت و دکل)",
      EmployeeCount: 4, TotalGrossRials: 2638000000,
      TotalEmployeeSsiRials: 184660000, TotalEmployerSsiRials: 606740000,
      TotalTaxRials: 218400000, TotalNetPayableRials: 2194940000,
      DirectLaborCostRials: 2480740000, IndirectLaborCostRials: 764000000,
      FinVoucherRef: "FIN-VCH-1405-071", ApprovedBy: "u-pm", Status: "posted-to-finance",
      NoteFa: "محاسبه بر اساس ضریب ۱.۴ اضافه‌کاری، ۷٪ بیمه سهم کارگر، ۲۰٪+۳٪ سهم کارفرما و جدول پلکانی مالیات ۱۴۰۵",
    },
  ];
  for (const row of payrollRuns) await db.insert("HrmPayrollRun", row);

  const payslips = [
    {
      Id: `hps-${projectId}-01`, ProjectId: projectId, SlipNo: "SLP-140507-1002",
      RunNo: "PAY-1405-07", PeriodCode: "1405-07", PersonnelNo: "EMP-1002",
      WorkedDays: 30, NormalHours: 176, OvertimeHours: 38,
      BasePayRials: 385000000, OvertimePayRials: 116380000,
      ShiftAndHardshipRials: 86620000, BenefitsAllowanceRials: 160000000,
      GrossPayRials: 748000000, EmployeeSsi7PctRials: 52360000,
      EmployerSsi23PctRials: 172040000, IncomeTaxRials: 64200000,
      OtherDeductionsRials: 10000000, NetPayRials: 621440000,
      CostType: "direct", FinCostCenterRef: "CC-210-MES", Status: "paid",
      NoteFa: "دستمزد مستقیم تولید (مرکز هزینه ماشین‌کاری CNC — سفارش MO-1405-001)",
    },
    {
      Id: `hps-${projectId}-02`, ProjectId: projectId, SlipNo: "SLP-140507-1003",
      RunNo: "PAY-1405-07", PeriodCode: "1405-07", PersonnelNo: "EMP-1003",
      WorkedDays: 30, NormalHours: 176, OvertimeHours: 32,
      BasePayRials: 360000000, OvertimePayRials: 91640000,
      ShiftAndHardshipRials: 81000000, BenefitsAllowanceRials: 140000000,
      GrossPayRials: 672640000, EmployeeSsi7PctRials: 47084800,
      EmployerSsi23PctRials: 154707200, IncomeTaxRials: 53800000,
      OtherDeductionsRials: 15000000, NetPayRials: 556755200,
      CostType: "direct", FinCostCenterRef: "CC-310-CMMS", Status: "paid",
      NoteFa: "دستمزد مستقیم نگهداری و تعمیرات (تسهیم‌شده روی دستورکارهای CMMS)",
    },
    {
      Id: `hps-${projectId}-03`, ProjectId: projectId, SlipNo: "SLP-140507-1004",
      RunNo: "PAY-1405-07", PeriodCode: "1405-07", PersonnelNo: "EMP-1004",
      WorkedDays: 30, NormalHours: 176, OvertimeHours: 56,
      BasePayRials: 440000000, OvertimePayRials: 196000000,
      ShiftAndHardshipRials: 110000000, BenefitsAllowanceRials: 167000000,
      GrossPayRials: 913000000, EmployeeSsi7PctRials: 63910000,
      EmployerSsi23PctRials: 209990000, IncomeTaxRials: 84400000,
      OtherDeductionsRials: 15000000, NetPayRials: 749690000,
      CostType: "direct", FinCostCenterRef: "CC-410-RIG", Status: "paid",
      NoteFa: "دستمزد عملیات حفاری اقماری دکل RIG-DEMO با فوق‌العاده بیابانی و نوبت‌کاری",
    },
    {
      Id: `hps-${projectId}-04`, ProjectId: projectId, SlipNo: "SLP-140507-1005",
      RunNo: "PAY-1405-07", PeriodCode: "1405-07", PersonnelNo: "EMP-1005",
      WorkedDays: 30, NormalHours: 176, OvertimeHours: 10,
      BasePayRials: 390000000, OvertimePayRials: 31020000,
      ShiftAndHardshipRials: 0, BenefitsAllowanceRials: 148000000,
      GrossPayRials: 569020000, EmployeeSsi7PctRials: 39831400,
      EmployerSsi23PctRials: 130874600, IncomeTaxRials: 42000000,
      OtherDeductionsRials: 0, NetPayRials: 487188600,
      CostType: "indirect", FinCostCenterRef: "CC-510-HRM", Status: "paid",
      NoteFa: "دستمزد غیرمستقیم و سربار اداری-ستادی مدیریت منابع انسانی",
    },
  ];
  for (const row of payslips) await db.insert("HrmPayslip", row);

  const costVouchers = [
    {
      Id: `hcv-${projectId}-01`, ProjectId: projectId, VoucherNo: "FIN-VCH-1405-071A",
      RunNo: "PAY-1405-07", PeriodCode: "1405-07",
      CostCategory: "direct-production", FinCostCenterRef: "CC-210-MES",
      MesOrderRef: "MO-1405-001", CmmsWorkOrderRef: null,
      DirectLaborRials: 748000000, IndirectLaborRials: 0,
      EmployerSsiRials: 172040000, TotalAllocatedRials: 920040000,
      PostedBy: "u-pm", Status: "posted",
      NoteFa: "تسهیم بهای تمام‌شده دستمزد مستقیم تولید روی سفارش ساخت MO-1405-001",
    },
    {
      Id: `hcv-${projectId}-02`, ProjectId: projectId, VoucherNo: "FIN-VCH-1405-071B",
      RunNo: "PAY-1405-07", PeriodCode: "1405-07",
      CostCategory: "direct-maintenance", FinCostCenterRef: "CC-310-CMMS",
      MesOrderRef: null, CmmsWorkOrderRef: "WO-1405-0102",
      DirectLaborRials: 672640000, IndirectLaborRials: 0,
      EmployerSsiRials: 154707200, TotalAllocatedRials: 827347200,
      PostedBy: "u-pm", Status: "posted",
      NoteFa: "تسهیم هزینه نفرساعت تعمیرات تخصصی روی دستورکارهای نت CMMS",
    },
    {
      Id: `hcv-${projectId}-03`, ProjectId: projectId, VoucherNo: "FIN-VCH-1405-071C",
      RunNo: "PAY-1405-07", PeriodCode: "1405-07",
      CostCategory: "admin-overhead", FinCostCenterRef: "CC-510-HRM",
      MesOrderRef: null, CmmsWorkOrderRef: null,
      DirectLaborRials: 0, IndirectLaborRials: 569020000,
      EmployerSsiRials: 130874600, TotalAllocatedRials: 699894600,
      PostedBy: "u-pm", Status: "reconciled",
      NoteFa: "سند هزینه سربار عمومی و اداری ارسال‌شده به سرفصل بهای تمام‌شده مالی",
    },
  ];
  for (const row of costVouchers) await db.insert("HrmCostVoucher", row);

  /* ── ۱۰. نیازسنجی آموزشی، دوره‌ها و ارزیابی اثربخشی (HrmTrainingNeed, HrmTrainingCourse, HrmTrainingRecord) ── */
  const trainingNeeds = [
    {
      Id: `htn-${projectId}-01`, ProjectId: projectId, TnaCode: "TNA-1405-01",
      OrgUnitCode: "ORG-CMMS-20", PersonnelNo: "EMP-1003",
      JobTitleFa: "کارشناس ارشد تعمیرات تجهیزات دوار",
      SkillGapFa: "تسلط بر تحلیل پیشرفته طیف фаз و ممیزی قابلیت اطمینان RCM منطبق با IEC 60300-3-11",
      RecommendedCourseFa: "دوره پیشرفته تحلیل ارتعاشات ISO 18436 Cat III و پیاده‌سازی RCM",
      Priority: "high", TargetPeriod: "1405-Q3",
      EstimatedCostRials: 85000000, Status: "scheduled",
      NoteFa: "نیازسنجی استخراج‌شده از ممیزی ماتریس مهارت CMMS",
    },
    {
      Id: `htn-${projectId}-02`, ProjectId: projectId, TnaCode: "TNA-1405-02",
      OrgUnitCode: "ORG-MES-10", PersonnelNo: "EMP-1006",
      JobTitleFa: "جوشکار ارشد مخازن تحت فشار",
      SkillGapFa: "آشنایی با دستورالعمل‌های جدید جوشکاری فولادهای زنگ‌نزن دوبلکس (Duplex UNS S31803)",
      RecommendedCourseFa: "کارگاه عملی متالورژی و جوشکاری لوله‌های سوپردوبلکس و کنترل کیفیت NDT",
      Priority: "critical", TargetPeriod: "1405-Q3",
      EstimatedCostRials: 62000000, Status: "approved",
      NoteFa: "پیشنیاز شروع ساخت مبدل‌های حرارتی پروژه فاز ۲",
    },
  ];
  for (const row of trainingNeeds) await db.insert("HrmTrainingNeed", row);

  const trainingCourses = [
    {
      Id: `htc-${projectId}-01`, ProjectId: projectId, CourseCode: "CRS-TECH-301",
      TitleFa: "تحلیل ارتعاشات پیشرفته و عیب‌یابی توربوکمپرسورها (ISO 18436 Cat III)",
      Category: "technical", ProviderFa: "انستیتو مهندسی قابلیت اطمینان و نت ایران",
      InstructorFa: "دکتر امیرابراهیم طاهری", DurationHours: 40,
      StartDate: "2026-09-10", EndDate: "2026-09-16", Capacity: 15,
      CostPerPersonRials: 85000000, SkillCodeGranted: "SK-VIB-ISO3", Status: "completed",
      NoteFa: "همراه با آزمون عملی روی تست‌بد روتور دینامیک",
    },
    {
      Id: `htc-${projectId}-02`, ProjectId: projectId, CourseCode: "CRS-MES-204",
      TitleFa: "برنامه‌نویسی پیشرفته CAD/CAM و بهینه‌سازی مسیر ابزار در فرز ۵ محور",
      Category: "mes-cmms", ProviderFa: "مرکز آموزش فنی و مهندسی پیشرو",
      InstructorFa: "مهندس آرش نیک‌پی", DurationHours: 32,
      StartDate: "2026-09-22", EndDate: "2026-09-26", Capacity: 12,
      CostPerPersonRials: 70000000, SkillCodeGranted: "SK-CAM-5AX", Status: "completed",
      NoteFa: "کاهش زمان چرخه ماشین‌کاری قطعات پیچیده در MES",
    },
    {
      Id: `htc-${projectId}-03`, ProjectId: projectId, CourseCode: "CRS-HSE-110",
      TitleFa: "مدیریت بحران، کنترل فوران چاه و ایمنی عملیات حفاری (IWCF & H2S)",
      Category: "safety-hse", ProviderFa: "آکادمی ملی حفاری و انرژی",
      InstructorFa: "مهندس شاهین بختیاری", DurationHours: 24,
      StartDate: "2026-10-18", EndDate: "2026-10-21", Capacity: 20,
      CostPerPersonRials: 55000000, SkillCodeGranted: "SK-HSE-RIG", Status: "planned",
      NoteFa: "دوره الزامی برای پرسنل اقماری دکل‌های حفاری",
    },
  ];
  for (const row of trainingCourses) await db.insert("HrmTrainingCourse", row);

  const trainingRecords = [
    {
      Id: `htr-${projectId}-01`, ProjectId: projectId, RecordNo: "TRN-REC-1001",
      CourseCode: "CRS-TECH-301", PersonnelNo: "EMP-1003",
      AttendancePct: 100, ExamScorePct: 94,
      CertificateNo: "CERT-ISO18436-9920", IssuedDate: "2026-09-18", ExpiryDate: "2029-09-18",
      EffectivenessScorePct: 92,
      KirkpatrickSummaryFa: "سطح ۱ (واکنش): عالی | سطح ۲ (یادگیری): ۹۴٪ | سطح ۳ (رفتار): کاهش زمان عیب‌یابی پمپ‌ها به نصف | سطح ۴ (نتایج): جلوگیری از ۲ توقف اضطراری خط",
      EvaluatedBy: "u-cmms-manager", Status: "certified",
      NoteFa: "ارزیابی اثربخشی سه‌ماهه کرک‌پاتریک با موفقیت کامل ثبت شد",
    },
    {
      Id: `htr-${projectId}-02`, ProjectId: projectId, RecordNo: "TRN-REC-1002",
      CourseCode: "CRS-MES-204", PersonnelNo: "EMP-1002",
      AttendancePct: 100, ExamScorePct: 91,
      CertificateNo: "CERT-CAM5X-4412", IssuedDate: "2026-09-28", ExpiryDate: "2029-09-28",
      EffectivenessScorePct: 89,
      KirkpatrickSummaryFa: "سطح ۱: ۹۵٪ | سطح ۲: ۹۱٪ | سطح ۳: پیاده‌سازی استراتژی Trochoidal Milling | سطح ۴: کاهش ۱۴٪ استهلاک ابزار برشی در MES",
      EvaluatedBy: "u-hr", Status: "certified",
      NoteFa: "ارتقای مستقیم سطح مهارت اپراتور در ماتریس مهارت به سطح ۵",
    },
  ];
  for (const row of trainingRecords) await db.insert("HrmTrainingRecord", row);

  /* ── ۱۱. شاخص‌های عملکرد (KPI/OKR) و ارزیابی ۳۶۰ درجه (HrmPerformanceKpi, HrmPerformanceReview) ── */
  const perfKpis = [
    {
      Id: `hpk-${projectId}-01`, ProjectId: projectId, KpiCode: "KPI-MES-OEE",
      TitleFa: "نرخ اثربخشی کلی مرکز کاری (OEE) و تحویل به‌موقع سفارش‌های تولید",
      OrgUnitCode: "ORG-MES-10", JobRoleFa: "سرپرست ارشد ماشین‌کاری CNC",
      Perspective: "operational", MetricUnit: "%", TargetValue: 88,
      WeightPct: 35, EvalFrequency: "quarterly", Status: "active",
      NoteFa: "متصل به شاخص‌های تحویل و کیفیت ماژول MES",
    },
    {
      Id: `hpk-${projectId}-02`, ProjectId: projectId, KpiCode: "KPI-CMMS-MTTR",
      TitleFa: "کاهش میانگین زمان تعمیر (MTTR) و انطباق اجرای برنامه PM بالای ۹۵٪",
      OrgUnitCode: "ORG-CMMS-20", JobRoleFa: "کارشناس ارشد تعمیرات تجهیزات دوار",
      Perspective: "quality", MetricUnit: "%", TargetValue: 95,
      WeightPct: 30, EvalFrequency: "quarterly", Status: "active",
      NoteFa: "متصل به شاخص‌های قابلیت اطمینان EN 15341 در CMMS",
    },
    {
      Id: `hpk-${projectId}-03`, ProjectId: projectId, KpiCode: "KPI-RIG-NPT",
      TitleFa: "کاهش زمان نامولّد حفاری (NPT) و پاسخ به هشدارهای تله‌متری زیر ۵ دقیقه",
      OrgUnitCode: "ORG-RIG-30", JobRoleFa: "سرپرست شیفت حفاری دکل",
      Perspective: "safety", MetricUnit: "%", TargetValue: 96,
      WeightPct: 35, EvalFrequency: "quarterly", Status: "active",
      NoteFa: "متصل به لاگ‌های NPT و هشدارهای بلادرنگ ماژول IIoT",
    },
  ];
  for (const row of perfKpis) await db.insert("HrmPerformanceKpi", row);

  const perfReviews = [
    {
      Id: `hpv-${projectId}-01`, ProjectId: projectId, ReviewNo: "REV-1405-Q2-1002",
      PeriodCode: "1405-Q2", PersonnelNo: "EMP-1002", ReviewerPersonNo: "EMP-1001",
      SelfScorePct: 90, ManagerScorePct: 94, PeerScorePct: 91, SubordinateScorePct: 93,
      KpiAchievementPct: 95, FinalScorePct: 93.2,
      PerformanceGrade: "A-Outstanding", BonusMultiplierPct: 125,
      StrengthsFa: "تسلط فنی بالا روی ماشین‌کاری ۵ محور، صفر بودن نرخ ضایعات در سفارش‌های بحرانی و مربی‌گری تیم کارگاه",
      ImprovementPlanFa: "مستندسازی تنظیمات فیکسچرهای خاص در پایگاه دانش KMS جهت انتقال تجربه به شیفت شب",
      ApprovedBy: "u-hr", Status: "finalized",
      NoteFa: "ارزیابی ۳۶۰ درجه تابستان ۱۴۰۵ — واجد شرایط پاداش بهره‌وری ۱۲۵٪",
    },
    {
      Id: `hpv-${projectId}-02`, ProjectId: projectId, ReviewNo: "REV-1405-Q2-1003",
      PeriodCode: "1405-Q2", PersonnelNo: "EMP-1003", ReviewerPersonNo: "EMP-1001",
      SelfScorePct: 88, ManagerScorePct: 91, PeerScorePct: 89, SubordinateScorePct: 87,
      KpiAchievementPct: 92, FinalScorePct: 90.1,
      PerformanceGrade: "A-Outstanding", BonusMultiplierPct: 120,
      StrengthsFa: "تشخیص زودهنگام عیوب یاتاقان کمپرسورها با تحلیل طیف ارتعاشی و کاهش ۱۸٪ توقفات اضطراری",
      ImprovementPlanFa: "تکمیل ثبت تحلیل‌های ریشه‌ای (RCFA) در سامانه CMMS بلافاصله پس از بستن دستورکار",
      ApprovedBy: "u-hr", Status: "finalized",
      NoteFa: "ارزیابی ۳۶۰ درجه تابستان ۱۴۰۵ — رتبه عالی",
    },
    {
      Id: `hpv-${projectId}-03`, ProjectId: projectId, ReviewNo: "REV-1405-Q2-1004",
      PeriodCode: "1405-Q2", PersonnelNo: "EMP-1004", ReviewerPersonNo: "EMP-1001",
      SelfScorePct: 86, ManagerScorePct: 88, PeerScorePct: 87, SubordinateScorePct: 85,
      KpiAchievementPct: 89, FinalScorePct: 87.6,
      PerformanceGrade: "B-Exceeds", BonusMultiplierPct: 110,
      StrengthsFa: "مدیریت ایمن شیفت اقماری دکل و واکنش سریع به هشدارهای فشار گل حفاری",
      ImprovementPlanFa: "افزایش هماهنگی در تحویل شیفت (Handover) میان گروه A و B دکل",
      ApprovedBy: "u-pm", Status: "finalized",
      NoteFa: "ارزیابی ۳۶۰ درجه تابستان ۱۴۰۵ — فراتر از انتظار",
    },
  ];
  for (const row of perfReviews) await db.insert("HrmPerformanceReview", row);

  return { seeded: true, projectId, orgUnits: orgUnits.length, profiles: profiles.length };
}

function registerCrudTable(app, { getDb, requirePerm, basePath, table, idPrefix, viewPerm, writePerm, codeField }) {
  app.get(`/api/hrm/:projectId/${basePath}`, requirePerm(viewPerm), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId } = req.params;
      await seedHrmWorkspaceData(db, projectId);
      const rows = await db.list(table, { ProjectId: projectId });
      res.json({ projectId, items: rows, count: rows.length });
    } catch (e) { next(e); }
  });

  app.post(`/api/hrm/:projectId/${basePath}`, requirePerm(writePerm), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId } = req.params;
      const body = req.body || {};
      if (codeField && (!body[codeField] || !String(body[codeField]).trim())) {
        return res.status(400).json({ error: "MISSING_CODE", messageFa: `فیلد «${codeField}» الزامی است.` });
      }
      const id = body.Id || `${idPrefix}-${projectId}-${Date.now().toString(36)}`;
      const row = { ...body, Id: id, ProjectId: projectId };
      const inserted = await db.insert(table, row);
      res.status(201).json(inserted);
    } catch (e) { next(e); }
  });

  app.put(`/api/hrm/:projectId/${basePath}/:id`, requirePerm(writePerm), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId, id } = req.params;
      const existing = await db.get(table, id);
      if (!existing || existing.ProjectId !== projectId) {
        return res.status(404).json({ error: "NOT_FOUND", messageFa: "رکورد مورد نظر یافت نشد." });
      }
      const patch = { ...req.body };
      delete patch.Id;
      delete patch.ProjectId;
      const updated = await db.update(table, id, patch);
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete(`/api/hrm/:projectId/${basePath}/:id`, requirePerm(writePerm), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId, id } = req.params;
      const existing = await db.get(table, id);
      if (!existing || existing.ProjectId !== projectId) {
        return res.status(404).json({ error: "NOT_FOUND", messageFa: "رکورد مورد نظر یافت نشد." });
      }
      await db.remove(table, id);
      res.json({ ok: true, id });
    } catch (e) { next(e); }
  });
}

export function registerHrmWorkspaceRoutes(app, { repo, subjects = [], evaluate }) {
  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);
  const getDb = async (req) => wrapRepo(await repo(), actor(req));
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const requirePerm = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-HRM-AUTH-REQUIRED", message: "شناسهٔ کاربر (x-user-id) الزامی است", permission } });
    }
    req.user = subject;
    const verdict = evaluate(subject, permission, { projectId: undefined });
    if (!verdict.allow && enforce) {
      return res.status(403).json({ ok: false, error: { code: "E-HRM-FORBIDDEN", message: "مجوز دسترسی به این عملیات منابع انسانی را ندارید", permission } });
    }
    return next();
  };

  /* ── خلاصهٔ جامع فضای کاری HRM (ISO 30414 & قوانین کار و تأمین اجتماعی) ── */
  app.get("/api/hrm/:projectId/workspace", requirePerm("hrm.org.view"), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId } = req.params;
      await seedHrmWorkspaceData(db, projectId);

      const [
        orgUnits,
        profiles,
        actions,
        contracts,
        skills,
        shifts,
        rosters,
        leaves,
        missions,
        payrollRuns,
        payslips,
        costVouchers,
        trainingNeeds,
        trainingCourses,
        trainingRecords,
        perfKpis,
        perfReviews,
      ] = await Promise.all([
        db.list("HrmOrgUnit", { ProjectId: projectId }),
        db.list("HrmPersonnelProfile", { ProjectId: projectId }),
        db.list("HrmPersonnelAction", { ProjectId: projectId }),
        db.list("HrmEmploymentContract", { ProjectId: projectId }),
        db.list("HrmSkillMatrixItem", { ProjectId: projectId }),
        db.list("HrmShiftPattern", { ProjectId: projectId }),
        db.list("HrmShiftRoster", { ProjectId: projectId }),
        db.list("HrmLeaveRequest", { ProjectId: projectId }),
        db.list("HrmMissionOrder", { ProjectId: projectId }),
        db.list("HrmPayrollRun", { ProjectId: projectId }),
        db.list("HrmPayslip", { ProjectId: projectId }),
        db.list("HrmCostVoucher", { ProjectId: projectId }),
        db.list("HrmTrainingNeed", { ProjectId: projectId }),
        db.list("HrmTrainingCourse", { ProjectId: projectId }),
        db.list("HrmTrainingRecord", { ProjectId: projectId }),
        db.list("HrmPerformanceKpi", { ProjectId: projectId }),
        db.list("HrmPerformanceReview", { ProjectId: projectId }),
      ]);

      const approvedHeadcount = orgUnits.reduce((s, u) => s + toNum(u.ApprovedHeadcount), 0);
      const currentHeadcount = orgUnits.reduce((s, u) => s + toNum(u.CurrentHeadcount), 0);
      const totalGrossPayroll = payslips.reduce((s, p) => s + toNum(p.GrossPayRials), 0);
      const totalNetPayroll = payslips.reduce((s, p) => s + toNum(p.NetPayRials), 0);
      const totalEmployerSsi = payslips.reduce((s, p) => s + toNum(p.EmployerSsi23PctRials), 0);
      const directLaborAllocated = costVouchers.reduce((s, v) => s + toNum(v.DirectLaborRials), 0);
      const indirectLaborAllocated = costVouchers.reduce((s, v) => s + toNum(v.IndirectLaborRials), 0);
      const avgEffectiveness = trainingRecords.length > 0
        ? Number((trainingRecords.reduce((s, r) => s + toNum(r.EffectivenessScorePct), 0) / trainingRecords.length).toFixed(1))
        : 0;
      const avg360Score = perfReviews.length > 0
        ? Number((perfReviews.reduce((s, r) => s + toNum(r.FinalScorePct), 0) / perfReviews.length).toFixed(1))
        : 0;

      res.json({
        projectId,
        standards: ["ISO 30414:2018 Human Capital Reporting", "Iran Labor Law (Arts. 51, 56, 58, 148)", "ISO 10015 Training & Competency"],
        kpis: {
          orgUnitsCount: orgUnits.length,
          approvedHeadcount,
          currentHeadcount,
          activeProfilesCount: profiles.filter((p) => p.Status === "active").length,
          activeContractsCount: contracts.filter((c) => c.Status === "active").length,
          validCertificatesCount: skills.filter((s) => s.Status === "valid").length,
          expiringCertificatesCount: skills.filter((s) => s.Status === "expiring-soon" || s.Status === "expired").length,
          cmmsLinkedSkillsCount: skills.filter((s) => Boolean(s.CmmsAssetFamilyRef)).length,
          mesLinkedSkillsCount: skills.filter((s) => Boolean(s.MesWorkCenterRef)).length,
          shiftPatternsCount: shifts.length,
          totalOvertimeHours: rosters.reduce((s, r) => s + toNum(r.OvertimeHours), 0),
          pendingLeavesCount: leaves.filter((l) => l.Status === "pending").length,
          activeMissionsCount: missions.filter((m) => m.Status === "approved" || m.Status === "completed").length,
          totalGrossPayrollRials: totalGrossPayroll,
          totalNetPayrollRials: totalNetPayroll,
          totalEmployerSsiRials: totalEmployerSsi,
          directLaborAllocatedRials: directLaborAllocated,
          indirectLaborAllocatedRials: indirectLaborAllocated,
          trainingCoursesCount: trainingCourses.length,
          avgTrainingEffectivenessPct: avgEffectiveness,
          avgPerformance360ScorePct: avg360Score,
        },
        crossModuleLinks: {
          cmmsWorkOrdersLinked: rosters.filter((r) => Boolean(r.CmmsWorkOrderRef)).map((r) => ({
            rosterCode: r.RosterCode,
            personnelNo: r.PersonnelNo,
            workOrderRef: r.CmmsWorkOrderRef,
            hours: toNum(r.NormalHours) + toNum(r.OvertimeHours),
          })),
          mesOrdersLinked: rosters.filter((r) => Boolean(r.MesOrderRef)).map((r) => ({
            rosterCode: r.RosterCode,
            personnelNo: r.PersonnelNo,
            mesOrderRef: r.MesOrderRef,
            operationCode: r.MesOperationCode,
            hours: toNum(r.NormalHours) + toNum(r.OvertimeHours),
          })),
          financeVouchersPosted: costVouchers.map((v) => ({
            voucherNo: v.VoucherNo,
            costCategory: v.CostCategory,
            finCostCenterRef: v.FinCostCenterRef,
            totalAllocatedRials: toNum(v.TotalAllocatedRials),
            status: v.Status,
          })),
        },
      });
    } catch (e) { next(e); }
  });

  /* ── اقدام محاسباتی ۱: اجرای خودکار محاسبه حقوق و دستمزد ماهانه و صدور فیش و سند هزینه ── */
  app.post("/api/hrm/:projectId/payroll-runs/calculate", requirePerm("hrm.payroll.run"), async (req, res, next) => {
    try {
      const db = await getDb(req);
      const { projectId } = req.params;
      await seedHrmWorkspaceData(db, projectId);
      const periodCode = String(req.body?.periodCode || "1405-08").trim();
      const titleFa = String(req.body?.titleFa || `محاسبه حقوق و مزایای دوره ${periodCode} (منطبق با قانون کار و تأمین اجتماعی)`).trim();

      const profiles = await db.list("HrmPersonnelProfile", { ProjectId: projectId });
      const contracts = await db.list("HrmEmploymentContract", { ProjectId: projectId });
      const rosters = await db.list("HrmShiftRoster", { ProjectId: projectId });
      const orgUnits = await db.list("HrmOrgUnit", { ProjectId: projectId });

      const activeProfiles = profiles.filter((p) => p.Status === "active");
      const runNo = `PAY-${periodCode}-${Date.now().toString(36).slice(-3).toUpperCase()}`;

      let totalGross = 0;
      let totalEmpSsi = 0;
      let totalEmployerSsi = 0;
      let totalTax = 0;
      let totalNet = 0;
      let directLabor = 0;
      let indirectLabor = 0;
      const generatedSlips = [];

      for (const person of activeProfiles) {
        const contract = contracts.find((c) => c.PersonnelNo === person.PersonnelNo);
        const orgUnit = orgUnits.find((u) => u.Code === person.OrgUnitCode);
        const personRosters = rosters.filter((r) => r.PersonnelNo === person.PersonnelNo);
        const overtimeHours = personRosters.reduce((s, r) => s + toNum(r.OvertimeHours), 0) || 24;
        const basePay = toNum(contract?.BaseMonthlyRials, 420000000);
        const hourlyRate = Math.round(basePay / 176);
        // ماده ۵۹ قانون کار: ضریب ۱.۴ برای اضافه‌کاری
        const overtimePay = Math.round(overtimeHours * hourlyRate * 1.4);
        const shiftBonus = person.EmploymentType === "rotational-rig" ? Math.round(basePay * 0.225) : Math.round(basePay * 0.1);
        const benefits = 145000000;
        const gross = basePay + overtimePay + shiftBonus + benefits;
        // ماده ۱۴۸ قانون کار: ۷٪ سهم کارگر، ۲۰٪ + ۳٪ بیمه بیکاری سهم کارفرما
        const empSsi = Math.round(gross * 0.07);
        const employerSsi = Math.round(gross * 0.23);
        // مالیات پلکانی حقوق (معافیت پایه + ۱۰٪ مازاد)
        const taxable = Math.max(0, gross - 240000000);
        const tax = Math.round(taxable * 0.1);
        const net = gross - empSsi - tax;

        const isDirect = person.OrgUnitCode === "ORG-MES-10" || person.OrgUnitCode === "ORG-CMMS-20" || person.OrgUnitCode === "ORG-RIG-30";
        if (isDirect) {
          directLabor += gross + employerSsi;
        } else {
          indirectLabor += gross + employerSsi;
        }

        totalGross += gross;
        totalEmpSsi += empSsi;
        totalEmployerSsi += employerSsi;
        totalTax += tax;
        totalNet += net;

        const slip = await db.insert("HrmPayslip", {
          Id: `hps-${projectId}-${Date.now().toString(36)}-${person.PersonnelNo}`,
          ProjectId: projectId,
          SlipNo: `SLP-${periodCode}-${person.PersonnelNo}`,
          RunNo: runNo,
          PeriodCode: periodCode,
          PersonnelNo: person.PersonnelNo,
          WorkedDays: 30,
          NormalHours: 176,
          OvertimeHours: overtimeHours,
          BasePayRials: basePay,
          OvertimePayRials: overtimePay,
          ShiftAndHardshipRials: shiftBonus,
          BenefitsAllowanceRials: benefits,
          GrossPayRials: gross,
          EmployeeSsi7PctRials: empSsi,
          EmployerSsi23PctRials: employerSsi,
          IncomeTaxRials: tax,
          OtherDeductionsRials: 0,
          NetPayRials: net,
          CostType: isDirect ? "direct" : "indirect",
          FinCostCenterRef: orgUnit?.CostCenterRef || "CC-100-EXEC",
          Status: "issued",
          NoteFa: `فیش صادره خودکار دوره ${periodCode} — ${person.FullNameFa}`,
        });
        generatedSlips.push(slip);
      }

      const voucherNo = `FIN-VCH-${periodCode}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
      const runRecord = await db.insert("HrmPayrollRun", {
        Id: `hpr-${projectId}-${Date.now().toString(36)}`,
        ProjectId: projectId,
        RunNo: runNo,
        PeriodCode: periodCode,
        TitleFa: titleFa,
        EmployeeCount: activeProfiles.length,
        TotalGrossRials: totalGross,
        TotalEmployeeSsiRials: totalEmpSsi,
        TotalEmployerSsiRials: totalEmployerSsi,
        TotalTaxRials: totalTax,
        TotalNetPayableRials: totalNet,
        DirectLaborCostRials: directLabor,
        IndirectLaborCostRials: indirectLabor,
        FinVoucherRef: voucherNo,
        ApprovedBy: req.user?.id || "u-hr",
        Status: "calculated",
        NoteFa: `محاسبه مکانیزه حقوق و دستمزد برای ${activeProfiles.length} نفر پرسنل فعال`,
      });

      const costVoucher = await db.insert("HrmCostVoucher", {
        Id: `hcv-${projectId}-${Date.now().toString(36)}`,
        ProjectId: projectId,
        VoucherNo: voucherNo,
        RunNo: runNo,
        PeriodCode: periodCode,
        CostCategory: "direct-production",
        FinCostCenterRef: "CC-210-MES / CC-310-CMMS",
        MesOrderRef: "MO-1405-001",
        CmmsWorkOrderRef: "WO-1405-0102",
        DirectLaborRials: directLabor,
        IndirectLaborRials: indirectLabor,
        EmployerSsiRials: totalEmployerSsi,
        TotalAllocatedRials: directLabor + indirectLabor,
        PostedBy: req.user?.id || "u-hr",
        Status: "posted",
        NoteFa: `سند تسهیم هزینه مستقیم و غیرمستقیم دوره ${periodCode} به حسابداری مالی و بهای تمام‌شده`,
      });

      res.status(201).json({
        ok: true,
        payrollRun: runRecord,
        payslipsCount: generatedSlips.length,
        costVoucher,
      });
    } catch (e) { next(e); }
  });

  /* ── ثبت CRUD کامل هر ۱۷ جدول بخش ۶ ── */
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "org-units", table: "HrmOrgUnit",
    idPrefix: "hou", viewPerm: "hrm.org.view", writePerm: "hrm.org.manage", codeField: "Code",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "personnel-profiles", table: "HrmPersonnelProfile",
    idPrefix: "hpp", viewPerm: "hrm.org.view", writePerm: "hrm.org.manage", codeField: "PersonnelNo",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "personnel-actions", table: "HrmPersonnelAction",
    idPrefix: "hpa", viewPerm: "hrm.org.view", writePerm: "hrm.org.manage", codeField: "ActionNo",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "contracts", table: "HrmEmploymentContract",
    idPrefix: "hec", viewPerm: "hrm.org.view", writePerm: "hrm.org.manage", codeField: "ContractNo",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "skill-matrix", table: "HrmSkillMatrixItem",
    idPrefix: "hsm", viewPerm: "hrm.skill.view", writePerm: "hrm.skill.manage", codeField: "MatrixCode",
  });

  registerCrudTable(app, {
    getDb, requirePerm, basePath: "shift-patterns", table: "HrmShiftPattern",
    idPrefix: "hsp", viewPerm: "hrm.attendance.view", writePerm: "hrm.attendance.manage", codeField: "ShiftCode",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "shift-rosters", table: "HrmShiftRoster",
    idPrefix: "hsr", viewPerm: "hrm.attendance.view", writePerm: "hrm.attendance.manage", codeField: "RosterCode",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "leaves", table: "HrmLeaveRequest",
    idPrefix: "hlr", viewPerm: "hrm.attendance.view", writePerm: "hrm.attendance.manage", codeField: "LeaveNo",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "missions", table: "HrmMissionOrder",
    idPrefix: "hmo", viewPerm: "hrm.attendance.view", writePerm: "hrm.attendance.manage", codeField: "MissionNo",
  });

  registerCrudTable(app, {
    getDb, requirePerm, basePath: "payroll-runs", table: "HrmPayrollRun",
    idPrefix: "hpr", viewPerm: "hrm.payroll.view", writePerm: "hrm.payroll.run", codeField: "RunNo",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "payslips", table: "HrmPayslip",
    idPrefix: "hps", viewPerm: "hrm.payroll.view", writePerm: "hrm.payroll.run", codeField: "SlipNo",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "cost-vouchers", table: "HrmCostVoucher",
    idPrefix: "hcv", viewPerm: "hrm.payroll.view", writePerm: "hrm.payroll.approve", codeField: "VoucherNo",
  });

  registerCrudTable(app, {
    getDb, requirePerm, basePath: "training-needs", table: "HrmTrainingNeed",
    idPrefix: "htn", viewPerm: "hrm.training.view", writePerm: "hrm.training.manage", codeField: "TnaCode",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "training-courses", table: "HrmTrainingCourse",
    idPrefix: "htc", viewPerm: "hrm.training.view", writePerm: "hrm.training.manage", codeField: "CourseCode",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "training-records", table: "HrmTrainingRecord",
    idPrefix: "htr", viewPerm: "hrm.training.view", writePerm: "hrm.training.manage", codeField: "RecordNo",
  });

  registerCrudTable(app, {
    getDb, requirePerm, basePath: "performance-kpis", table: "HrmPerformanceKpi",
    idPrefix: "hpk", viewPerm: "hrm.performance.view", writePerm: "hrm.performance.manage", codeField: "KpiCode",
  });
  registerCrudTable(app, {
    getDb, requirePerm, basePath: "performance-reviews", table: "HrmPerformanceReview",
    idPrefix: "hpv", viewPerm: "hrm.performance.view", writePerm: "hrm.performance.manage", codeField: "ReviewNo",
  });
}
