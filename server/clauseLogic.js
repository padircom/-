// src/services/integration.ts
var FA_DIGITS = "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9";
var AR_DIGITS = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
function normalizeDigits(value) {
  return String(value ?? "").replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/\u200c/g, "").trim();
}
var f = (key, fa, en, kind, sample, extra = {}) => ({
  key,
  title: { fa, en },
  kind,
  aliases: [key, fa, en, key.toLowerCase()],
  sample,
  ...extra
});
var TEMPLATE_CATALOG = [
  {
    code: "TPL-ACT",
    title: { fa: "\u0641\u0639\u0627\u0644\u06CC\u062A\u200C\u0647\u0627\u06CC \u0628\u0631\u0646\u0627\u0645\u0647", en: "Schedule activities" },
    targetTable: "Activity",
    module: "d2",
    keyFields: ["Code"],
    fields: [
      f("Code", "\u06A9\u062F \u0641\u0639\u0627\u0644\u06CC\u062A", "Activity ID", "text", "A-1010", { required: true, maxLen: 60, aliases: ["Code", "\u06A9\u062F \u0641\u0639\u0627\u0644\u06CC\u062A", "Activity ID", "ActivityID", "task_code", "activity_id"] }),
      f("NameFa", "\u0634\u0631\u062D \u0641\u0639\u0627\u0644\u06CC\u062A", "Activity Name", "text", "\u0628\u062A\u0646\u200C\u0631\u06CC\u0632\u06CC \u0641\u0648\u0646\u062F\u0627\u0633\u06CC\u0648\u0646 \u0648\u0627\u062D\u062F \u06F1", { required: true, maxLen: 400, aliases: ["NameFa", "\u0634\u0631\u062D \u0641\u0639\u0627\u0644\u06CC\u062A", "\u0646\u0627\u0645 \u0641\u0639\u0627\u0644\u06CC\u062A", "Activity Name", "task_name", "Name"] }),
      f("Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "Discipline", "text", "civil", { maxLen: 40, aliases: ["Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "\u0631\u0634\u062A\u0647"] }),
      f("PlannedStart", "\u0634\u0631\u0648\u0639 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0627\u06CC", "Planned Start", "date", "2026-09-01", { required: true, aliases: ["PlannedStart", "\u0634\u0631\u0648\u0639 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0627\u06CC", "\u0634\u0631\u0648\u0639", "Planned Start", "Start", "target_start_date"] }),
      f("PlannedFinish", "\u067E\u0627\u06CC\u0627\u0646 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0627\u06CC", "Planned Finish", "date", "2026-09-20", { required: true, aliases: ["PlannedFinish", "\u067E\u0627\u06CC\u0627\u0646 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0627\u06CC", "\u067E\u0627\u06CC\u0627\u0646", "Planned Finish", "Finish", "target_end_date"] }),
      f("DurationDays", "\u0645\u062F\u062A (\u0631\u0648\u0632)", "Duration (days)", "int", "20", { min: 0, max: 3650, aliases: ["DurationDays", "\u0645\u062F\u062A", "\u0645\u062F\u062A (\u0631\u0648\u0632)", "Duration", "Original Duration"] }),
      f("TotalFloat", "\u0634\u0646\u0627\u0648\u0631\u06CC \u06A9\u0644 (\u0631\u0648\u0632)", "Total float (days)", "int", "5", { aliases: ["TotalFloat", "\u0634\u0646\u0627\u0648\u0631\u06CC \u06A9\u0644", "\u0634\u0646\u0627\u0648\u0631\u06CC", "Total Float", "TF"] }),
      f("PhysicalPct", "\u062F\u0631\u0635\u062F \u067E\u06CC\u0634\u0631\u0641\u062A", "Progress %", "number", "35.5", { min: 0, max: 100, aliases: ["PhysicalPct", "\u062F\u0631\u0635\u062F \u067E\u06CC\u0634\u0631\u0641\u062A", "\u067E\u06CC\u0634\u0631\u0641\u062A", "Progress", "% Complete", "Physical % Complete"] }),
      f("BudgetCost", "\u0647\u0632\u06CC\u0646\u0647 \u0628\u0648\u062F\u062C\u0647\u200C\u0627\u06CC", "Budget cost", "number", "1250000000", { min: 0, aliases: ["BudgetCost", "\u0647\u0632\u06CC\u0646\u0647 \u0628\u0648\u062F\u062C\u0647\u200C\u0627\u06CC", "\u0628\u0648\u062F\u062C\u0647", "Budget", "BAC"] })
    ]
  },
  {
    code: "TPL-PRG",
    title: { fa: "\u062B\u0628\u062A \u067E\u06CC\u0634\u0631\u0641\u062A \u062F\u0648\u0631\u0647\u200C\u0627\u06CC", en: "Periodic progress" },
    targetTable: "ProgressEntry",
    module: "d2",
    keyFields: ["ActivityId", "EntryDate"],
    fields: [
      f("ActivityId", "\u06A9\u062F \u0641\u0639\u0627\u0644\u06CC\u062A", "Activity ID", "text", "A-1010", { required: true, maxLen: 60, aliases: ["ActivityId", "\u06A9\u062F \u0641\u0639\u0627\u0644\u06CC\u062A", "Activity ID", "activity_id"] }),
      f("EntryDate", "\u062A\u0627\u0631\u06CC\u062E \u062B\u0628\u062A", "Entry date", "date", "2026-09-08", { required: true, aliases: ["EntryDate", "\u062A\u0627\u0631\u06CC\u062E \u062B\u0628\u062A", "\u062A\u0627\u0631\u06CC\u062E", "Date"] }),
      f("PeriodCode", "\u06A9\u062F \u062F\u0648\u0631\u0647", "Period", "text", "1405-06", { required: true, maxLen: 20, aliases: ["PeriodCode", "\u06A9\u062F \u062F\u0648\u0631\u0647", "\u062F\u0648\u0631\u0647", "Period"] }),
      f("PhysicalPct", "\u062F\u0631\u0635\u062F \u067E\u06CC\u0634\u0631\u0641\u062A", "Progress %", "number", "42", { required: true, min: 0, max: 100, aliases: ["PhysicalPct", "\u062F\u0631\u0635\u062F \u067E\u06CC\u0634\u0631\u0641\u062A", "\u067E\u06CC\u0634\u0631\u0641\u062A", "Progress"] }),
      f("EnteredBy", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647", "Entered by", "text", "u-site", { required: true, maxLen: 60, aliases: ["EnteredBy", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647", "Entered By"] }),
      f("Note", "\u062A\u0648\u0636\u06CC\u062D", "Note", "text", "\u062F\u0648 \u062A\u06CC\u0645 \u0641\u0639\u0627\u0644", { maxLen: 500, aliases: ["Note", "\u062A\u0648\u0636\u06CC\u062D", "\u0634\u0631\u062D", "Remarks"] })
    ]
  },
  {
    code: "TPL-TMS",
    title: { fa: "\u062A\u0627\u06CC\u0645\u200C\u0634\u06CC\u062A \u0646\u06CC\u0631\u0648\u06CC \u06A9\u0627\u0631", en: "Workforce timesheet" },
    targetTable: "Timesheet",
    module: "d10",
    keyFields: ["MemberId", "WorkDate"],
    fields: [
      f("MemberId", "\u0634\u0645\u0627\u0631\u0647 \u067E\u0631\u0633\u0646\u0644\u06CC", "Personnel no", "text", "P-10432", { required: true, maxLen: 60, aliases: ["MemberId", "\u0634\u0645\u0627\u0631\u0647 \u067E\u0631\u0633\u0646\u0644\u06CC", "\u067E\u0631\u0633\u0646\u0644\u06CC", "Personnel", "Personnel No"] }),
      f("WorkDate", "\u062A\u0627\u0631\u06CC\u062E \u06A9\u0627\u0631\u06A9\u0631\u062F", "Work date", "date", "2026-09-08", { required: true, aliases: ["WorkDate", "\u062A\u0627\u0631\u06CC\u062E \u06A9\u0627\u0631\u06A9\u0631\u062F", "\u062A\u0627\u0631\u06CC\u062E", "Date"] }),
      f("NormalHours", "\u0633\u0627\u0639\u062A \u0639\u0627\u062F\u06CC", "Normal hours", "number", "8.5", { required: true, min: 0, max: 24, aliases: ["NormalHours", "\u0633\u0627\u0639\u062A \u0639\u0627\u062F\u06CC", "\u0639\u0627\u062F\u06CC", "Normal"] }),
      f("OvertimeHours", "\u0627\u0636\u0627\u0641\u0647\u200C\u06A9\u0627\u0631\u06CC", "Overtime hours", "number", "2", { min: 0, max: 16, aliases: ["OvertimeHours", "\u0627\u0636\u0627\u0641\u0647\u200C\u06A9\u0627\u0631\u06CC", "\u0627\u0636\u0627\u0641\u0647 \u06A9\u0627\u0631\u06CC", "Overtime", "OT"] }),
      f("HolidayHours", "\u06A9\u0627\u0631 \u062F\u0631 \u062A\u0639\u0637\u06CC\u0644\u0627\u062A", "Holiday hours", "number", "0", { min: 0, max: 24, aliases: ["HolidayHours", "\u06A9\u0627\u0631 \u062F\u0631 \u062A\u0639\u0637\u06CC\u0644\u0627\u062A", "\u062A\u0639\u0637\u06CC\u0644\u200C\u06A9\u0627\u0631\u06CC", "Holiday"] }),
      f("ActivityId", "\u06A9\u062F \u0641\u0639\u0627\u0644\u06CC\u062A", "Activity ID", "text", "A-1010", { maxLen: 60, aliases: ["ActivityId", "\u06A9\u062F \u0641\u0639\u0627\u0644\u06CC\u062A", "Activity ID"] }),
      f("EnteredBy", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647", "Entered by", "text", "u-site", { required: true, maxLen: 60, aliases: ["EnteredBy", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647"] })
    ]
  },
  {
    code: "TPL-NCR",
    title: { fa: "\u0639\u062F\u0645 \u0627\u0646\u0637\u0628\u0627\u0642", en: "Non-conformance" },
    targetTable: "Ncr",
    module: "d8",
    keyFields: ["Code"],
    fields: [
      f("Code", "\u0634\u0645\u0627\u0631\u0647 NCR", "NCR no", "text", "NCR-0042", { required: true, maxLen: 40, aliases: ["Code", "\u0634\u0645\u0627\u0631\u0647 NCR", "\u0634\u0645\u0627\u0631\u0647", "NCR No"] }),
      f("TitleFa", "\u0634\u0631\u062D \u0639\u062F\u0645 \u0627\u0646\u0637\u0628\u0627\u0642", "Description", "text", "\u0627\u0646\u062D\u0631\u0627\u0641 \u0627\u0628\u0639\u0627\u062F\u06CC \u0642\u0627\u0644\u0628\u200C\u0628\u0646\u062F\u06CC", { required: true, maxLen: 400, aliases: ["TitleFa", "\u0634\u0631\u062D \u0639\u062F\u0645 \u0627\u0646\u0637\u0628\u0627\u0642", "\u0634\u0631\u062D", "Description", "Title"] }),
      f("Severity", "\u0634\u062F\u062A", "Severity", "enum", "major", { required: true, enumValues: ["minor", "major", "critical"], aliases: ["Severity", "\u0634\u062F\u062A", "\u062F\u0631\u062C\u0647"] }),
      f("Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "Discipline", "text", "civil", { required: true, maxLen: 40, aliases: ["Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "\u0631\u0634\u062A\u0647"] }),
      f("RaisedBy", "\u0635\u0627\u062F\u0631\u06A9\u0646\u0646\u062F\u0647", "Raised by", "text", "u-qc", { required: true, maxLen: 60, aliases: ["RaisedBy", "\u0635\u0627\u062F\u0631\u06A9\u0646\u0646\u062F\u0647", "Raised By"] }),
      f("RaisedAt", "\u062A\u0627\u0631\u06CC\u062E \u0635\u062F\u0648\u0631", "Raised at", "date", "2026-09-02", { required: true, aliases: ["RaisedAt", "\u062A\u0627\u0631\u06CC\u062E \u0635\u062F\u0648\u0631", "\u062A\u0627\u0631\u06CC\u062E", "Date"] }),
      f("DueAt", "\u0645\u0647\u0644\u062A \u0631\u0641\u0639", "Due at", "date", "2026-09-16", { aliases: ["DueAt", "\u0645\u0647\u0644\u062A \u0631\u0641\u0639", "\u0645\u0647\u0644\u062A", "Due"] }),
      f("Status", "\u0648\u0636\u0639\u06CC\u062A", "Status", "enum", "open", { required: true, enumValues: ["open", "in_progress", "closed", "void"], aliases: ["Status", "\u0648\u0636\u0639\u06CC\u062A"] })
    ]
  },
  {
    code: "TPL-COR",
    title: { fa: "\u0645\u06A9\u0627\u062A\u0628\u0627\u062A", en: "Correspondence" },
    targetTable: "Correspondence",
    module: "d11",
    keyFields: ["LetterNo"],
    fields: [
      f("LetterNo", "\u0634\u0645\u0627\u0631\u0647 \u0646\u0627\u0645\u0647", "Letter no", "text", "ARN-OUT-1405-0231", { required: true, maxLen: 80, aliases: ["LetterNo", "\u0634\u0645\u0627\u0631\u0647 \u0646\u0627\u0645\u0647", "\u0634\u0645\u0627\u0631\u0647", "Letter No"] }),
      f("Direction", "\u062C\u0647\u062A", "Direction", "enum", "outgoing", { required: true, enumValues: ["incoming", "outgoing", "internal"], aliases: ["Direction", "\u062C\u0647\u062A", "\u0646\u0648\u0639"] }),
      f("Kind", "\u062F\u0633\u062A\u0647", "Kind", "enum", "general", { required: true, enumValues: ["general", "instruction", "notice", "claim_notice", "submittal", "rfi", "ncr_related"], aliases: ["Kind", "\u062F\u0633\u062A\u0647", "\u0637\u0628\u0642\u0647"] }),
      f("SubjectFa", "\u0645\u0648\u0636\u0648\u0639", "Subject", "text", "\u0627\u0639\u0644\u0627\u0645 \u062A\u0623\u062E\u06CC\u0631 \u062F\u0631 \u062A\u062D\u0648\u06CC\u0644 \u0632\u0645\u06CC\u0646", { required: true, maxLen: 500, aliases: ["SubjectFa", "\u0645\u0648\u0636\u0648\u0639", "Subject"] }),
      f("IssuedAt", "\u062A\u0627\u0631\u06CC\u062E \u0635\u062F\u0648\u0631", "Issued at", "date", "2026-09-03", { required: true, aliases: ["IssuedAt", "\u062A\u0627\u0631\u06CC\u062E \u0635\u062F\u0648\u0631", "\u062A\u0627\u0631\u06CC\u062E", "Date"] }),
      f("DueAt", "\u0645\u0647\u0644\u062A \u067E\u0627\u0633\u062E", "Due at", "date", "2026-09-17", { aliases: ["DueAt", "\u0645\u0647\u0644\u062A \u067E\u0627\u0633\u062E", "\u0645\u0647\u0644\u062A", "Due"] }),
      f("Status", "\u0648\u0636\u0639\u06CC\u062A", "Status", "enum", "open", { required: true, enumValues: ["draft", "open", "answered", "closed"], aliases: ["Status", "\u0648\u0636\u0639\u06CC\u062A"] })
    ]
  },
  {
    code: "TPL-CST",
    title: { fa: "\u062D\u0633\u0627\u0628\u200C\u0647\u0627\u06CC \u0647\u0632\u06CC\u0646\u0647", en: "Cost accounts" },
    targetTable: "CostAccount",
    module: "d5",
    keyFields: ["Code"],
    fields: [
      f("Code", "\u06A9\u062F \u062D\u0633\u0627\u0628", "Account code", "text", "CA-01-100", { required: true, maxLen: 40, aliases: ["Code", "\u06A9\u062F \u062D\u0633\u0627\u0628", "\u06A9\u062F", "Account Code"] }),
      f("TitleFa", "\u0639\u0646\u0648\u0627\u0646 \u062D\u0633\u0627\u0628", "Account title", "text", "\u0639\u0645\u0644\u06CC\u0627\u062A \u062E\u0627\u06A9\u06CC", { required: true, maxLen: 300, aliases: ["TitleFa", "\u0639\u0646\u0648\u0627\u0646 \u062D\u0633\u0627\u0628", "\u0639\u0646\u0648\u0627\u0646", "Title"] }),
      f("Budget", "\u0628\u0648\u062F\u062C\u0647", "Budget", "number", "8500000000", { required: true, min: 0, aliases: ["Budget", "\u0628\u0648\u062F\u062C\u0647", "\u0645\u0628\u0644\u063A \u0628\u0648\u062F\u062C\u0647"] }),
      f("Committed", "\u062A\u0639\u0647\u062F \u0634\u062F\u0647", "Committed", "number", "3200000000", { min: 0, aliases: ["Committed", "\u062A\u0639\u0647\u062F \u0634\u062F\u0647", "\u062A\u0639\u0647\u062F\u0627\u062A"] }),
      f("Actual", "\u0647\u0632\u06CC\u0646\u0647 \u0648\u0627\u0642\u0639\u06CC", "Actual", "number", "2750000000", { min: 0, aliases: ["Actual", "\u0647\u0632\u06CC\u0646\u0647 \u0648\u0627\u0642\u0639\u06CC", "\u0648\u0627\u0642\u0639\u06CC"] })
    ]
  },
  /* ── قالب‌های ماشین‌آلات و تجهیزات (d9) — تحویلی ۱۲ پراممپت EQP ── */
  {
    code: "TPL-EQP",
    title: { fa: "\u0634\u0646\u0627\u0633\u0646\u0627\u0645\u0647 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A", en: "Equipment asset register" },
    targetTable: "Equipment",
    module: "d9",
    keyFields: ["Code"],
    fields: [
      f("Code", "\u06A9\u062F \u0645\u0627\u0634\u06CC\u0646", "Equipment code", "text", "EQ-001", { required: true, maxLen: 40, aliases: ["Code", "\u06A9\u062F \u0645\u0627\u0634\u06CC\u0646", "\u06A9\u062F", "Equipment Code", "Asset No"] }),
      f("NameFa", "\u0646\u0627\u0645 \u0645\u0627\u0634\u06CC\u0646", "Equipment name", "text", "\u0628\u06CC\u0644 \u0645\u06A9\u0627\u0646\u06CC\u06A9\u06CC \u06A9\u0648\u0645\u0627\u062A\u0633\u0648 PC220", { required: true, maxLen: 200, aliases: ["NameFa", "\u0646\u0627\u0645 \u0645\u0627\u0634\u06CC\u0646", "\u0646\u0627\u0645", "Name", "Description"] }),
      f("Category", "\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC", "Category", "enum", "EXC", { required: true, enumValues: ["EXC", "LDR", "BLD", "GDR", "RLR", "BHO", "CRN-TOW", "CRN-MOB", "FLT", "MNF", "TRK", "MXR", "PMP", "GEN", "CMP", "WLD", "DRL", "OTH"], aliases: ["Category", "\u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC", "\u062F\u0633\u062A\u0647", "\u0646\u0648\u0639 \u0645\u0627\u0634\u06CC\u0646", "Type"] }),
      f("Ownership", "\u0646\u0648\u0639 \u0645\u0627\u0644\u06A9\u06CC\u062A", "Ownership", "enum", "owned", { required: true, enumValues: ["owned", "rented", "leased"], aliases: ["Ownership", "\u0646\u0648\u0639 \u0645\u0627\u0644\u06A9\u06CC\u062A", "\u0645\u0627\u0644\u06A9\u06CC\u062A"] }),
      f("Status", "\u0648\u0636\u0639\u06CC\u062A", "Status", "enum", "active", { required: true, enumValues: ["active", "idle", "repair", "disposed"], aliases: ["Status", "\u0648\u0636\u0639\u06CC\u062A"] }),
      f("BrandFa", "\u0633\u0627\u0632\u0646\u062F\u0647", "Brand", "text", "\u06A9\u0648\u0645\u0627\u062A\u0633\u0648", { maxLen: 120, aliases: ["BrandFa", "\u0633\u0627\u0632\u0646\u062F\u0647", "\u0628\u0631\u0646\u062F", "Brand", "Manufacturer", "Make"] }),
      f("Model", "\u0645\u062F\u0644", "Model", "text", "PC220", { maxLen: 80, aliases: ["Model", "\u0645\u062F\u0644"] }),
      f("Year", "\u0633\u0627\u0644 \u0633\u0627\u062E\u062A", "Year", "int", "2023", { min: 1900, max: 2100, aliases: ["Year", "\u0633\u0627\u0644 \u0633\u0627\u062E\u062A", "\u0633\u0627\u0644", "Model Year"] }),
      f("Capacity", "\u0638\u0631\u0641\u06CC\u062A", "Capacity", "number", "22", { min: 0, aliases: ["Capacity", "\u0638\u0631\u0641\u06CC\u062A", "\u062A\u0648\u0627\u0646"] }),
      f("CapacityUom", "\u0648\u0627\u062D\u062F \u0638\u0631\u0641\u06CC\u062A", "Capacity UoM", "text", "\u062A\u0646", { maxLen: 20, aliases: ["CapacityUom", "\u0648\u0627\u062D\u062F \u0638\u0631\u0641\u06CC\u062A", "\u0648\u0627\u062D\u062F"] }),
      f("CommissionedAt", "\u062A\u0627\u0631\u06CC\u062E \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC", "Commissioned at", "date", "2024-03-01", { aliases: ["CommissionedAt", "\u062A\u0627\u0631\u06CC\u062E \u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC", "\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC", "In-Service Date"] }),
      f("PurchaseValue", "\u0627\u0631\u0632\u0634 \u062E\u0631\u06CC\u062F", "Purchase value", "number", "28000000000", { min: 0, aliases: ["PurchaseValue", "\u0627\u0631\u0632\u0634 \u062E\u0631\u06CC\u062F", "\u0628\u0647\u0627\u06CC \u062A\u0645\u0627\u0645\u200C\u0634\u062F\u0647"] }),
      f("SalvageValue", "\u0627\u0631\u0632\u0634 \u0627\u0633\u0642\u0627\u0637", "Salvage value", "number", "2800000000", { min: 0, aliases: ["SalvageValue", "\u0627\u0631\u0632\u0634 \u0627\u0633\u0642\u0627\u0637", "\u0627\u0631\u0632\u0634 \u0628\u0627\u0642\u06CC\u200C\u0645\u0627\u0646\u062F\u0647"] })
    ]
  },
  {
    code: "TPL-DSP",
    title: { fa: "\u0628\u0631\u06AF\u0647 \u062F\u06CC\u0633\u067E\u0686 \u0631\u0648\u0632\u0627\u0646\u0647", en: "Daily dispatch sheet" },
    targetTable: "EquipmentDispatch",
    module: "d9",
    keyFields: ["EquipmentId", "DispatchDate", "Shift"],
    fields: [
      f("EquipmentId", "\u06A9\u062F \u0645\u0627\u0634\u06CC\u0646", "Equipment", "text", "EQ-001", { required: true, maxLen: 60, aliases: ["EquipmentId", "\u06A9\u062F \u0645\u0627\u0634\u06CC\u0646", "\u0645\u0627\u0634\u06CC\u0646", "Equipment"] }),
      f("DispatchDate", "\u062A\u0627\u0631\u06CC\u062E \u062F\u06CC\u0633\u067E\u0686", "Dispatch date", "date", "2026-09-09", { required: true, aliases: ["DispatchDate", "\u062A\u0627\u0631\u06CC\u062E \u062F\u06CC\u0633\u067E\u0686", "\u062A\u0627\u0631\u06CC\u062E", "Date"] }),
      f("Shift", "\u0634\u06CC\u0641\u062A", "Shift", "enum", "day", { required: true, enumValues: ["day", "night", "full"], aliases: ["Shift", "\u0634\u06CC\u0641\u062A", "\u0646\u0648\u0628\u062A \u06A9\u0627\u0631\u06CC"] }),
      f("OperatorId", "\u06A9\u062F \u0627\u067E\u0631\u0627\u062A\u0648\u0631", "Operator", "text", "OP-101", { maxLen: 60, aliases: ["OperatorId", "\u06A9\u062F \u0627\u067E\u0631\u0627\u062A\u0648\u0631", "\u0627\u067E\u0631\u0627\u062A\u0648\u0631", "Operator", "Driver"] }),
      f("ActivityId", "\u06A9\u062F \u0641\u0639\u0627\u0644\u06CC\u062A", "Activity", "text", "A-1240", { maxLen: 60, aliases: ["ActivityId", "\u06A9\u062F \u0641\u0639\u0627\u0644\u06CC\u062A", "\u0641\u0639\u0627\u0644\u06CC\u062A", "Activity"] }),
      f("CostAccountId", "\u062D\u0633\u0627\u0628 \u0647\u0632\u06CC\u0646\u0647", "Cost account", "text", "CA-EQ-01", { maxLen: 60, aliases: ["CostAccountId", "\u062D\u0633\u0627\u0628 \u0647\u0632\u06CC\u0646\u0647", "\u06A9\u062F \u0647\u0632\u06CC\u0646\u0647", "Cost Account"] }),
      f("SiteFa", "\u0645\u062D\u0644 \u06A9\u0627\u0631", "Site", "text", "\u06A9\u0627\u0631\u06AF\u0627\u0647 \u0634\u0645\u0627\u0644\u06CC \u2014 \u0628\u0644\u0648\u06A9 B", { maxLen: 200, aliases: ["SiteFa", "\u0645\u062D\u0644 \u06A9\u0627\u0631", "\u0645\u062D\u0644", "Site", "Location"] }),
      f("PlannedHours", "\u0633\u0627\u0639\u062A \u0628\u0631\u0646\u0627\u0645\u0647", "Planned hours", "number", "8", { required: true, min: 0, max: 24, aliases: ["PlannedHours", "\u0633\u0627\u0639\u062A \u0628\u0631\u0646\u0627\u0645\u0647", "\u0633\u0627\u0639\u062A", "Hours"] }),
      f("PlannedQty", "\u062D\u062C\u0645 \u0628\u0631\u0646\u0627\u0645\u0647", "Planned quantity", "number", "450", { min: 0, aliases: ["PlannedQty", "\u062D\u062C\u0645 \u0628\u0631\u0646\u0627\u0645\u0647", "\u062D\u062C\u0645", "Quantity"] }),
      f("QtyUom", "\u0648\u0627\u062D\u062F \u062D\u062C\u0645", "Quantity UoM", "text", "\u0645\u062A\u0631\u0645\u06A9\u0639\u0628", { maxLen: 20, aliases: ["QtyUom", "\u0648\u0627\u062D\u062F \u062D\u062C\u0645", "\u0648\u0627\u062D\u062F"] }),
      f("SafetyCheck", "\u0686\u06A9\u200C\u0644\u06CC\u0633\u062A \u0627\u06CC\u0645\u0646\u06CC", "Safety check", "bool", "true", { aliases: ["SafetyCheck", "\u0686\u06A9\u200C\u0644\u06CC\u0633\u062A \u0627\u06CC\u0645\u0646\u06CC", "\u0627\u06CC\u0645\u0646\u06CC", "Pre-Start Check"] }),
      f("Status", "\u0648\u0636\u0639\u06CC\u062A", "Status", "enum", "draft", { required: true, enumValues: ["draft", "submitted", "approved", "rejected", "executed", "cancelled"], aliases: ["Status", "\u0648\u0636\u0639\u06CC\u062A"] })
    ]
  },
  {
    code: "TPL-SMH",
    title: { fa: "\u0644\u0627\u06AF \u06A9\u0627\u0631\u06A9\u0631\u062F \u0648 \u0633\u0627\u0639\u062A\u200C\u0634\u0645\u0627\u0631", en: "Working hours & meter log" },
    targetTable: "EquipmentMeter",
    module: "d9",
    keyFields: ["EquipmentId", "ReadAt"],
    fields: [
      f("EquipmentId", "\u06A9\u062F \u0645\u0627\u0634\u06CC\u0646", "Equipment", "text", "EQ-001", { required: true, maxLen: 60, aliases: ["EquipmentId", "\u06A9\u062F \u0645\u0627\u0634\u06CC\u0646", "\u0645\u0627\u0634\u06CC\u0646", "Equipment"] }),
      f("ReadAt", "\u062A\u0627\u0631\u06CC\u062E \u0642\u0631\u0627\u0626\u062A", "Read date", "date", "2026-09-08", { required: true, aliases: ["ReadAt", "\u062A\u0627\u0631\u06CC\u062E \u0642\u0631\u0627\u0626\u062A", "\u062A\u0627\u0631\u06CC\u062E", "Date"] }),
      f("HourMeter", "\u0633\u0627\u0639\u062A\u200C\u0634\u0645\u0627\u0631", "Hour meter", "number", "1286", { required: true, min: 0, aliases: ["HourMeter", "\u0633\u0627\u0639\u062A\u200C\u0634\u0645\u0627\u0631", "\u06A9\u0627\u0631\u06A9\u0631\u062F \u062A\u062C\u0645\u0639\u06CC", "Hour Meter", "SMU"] }),
      f("WorkHours", "\u06A9\u0627\u0631\u06A9\u0631\u062F \u062F\u0648\u0631\u0647", "Period work hours", "number", "96", { required: true, min: 0, max: 744, aliases: ["WorkHours", "\u06A9\u0627\u0631\u06A9\u0631\u062F \u062F\u0648\u0631\u0647", "\u0633\u0627\u0639\u062A \u06A9\u0627\u0631\u06A9\u0631\u062F", "Work Hours"] }),
      f("Source", "\u0645\u0646\u0628\u0639 \u0642\u0631\u0627\u0626\u062A", "Source", "enum", "manual", { required: true, enumValues: ["manual", "telemetry"], aliases: ["Source", "\u0645\u0646\u0628\u0639 \u0642\u0631\u0627\u0626\u062A", "\u0645\u0646\u0628\u0639"] }),
      f("EnteredBy", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647", "Entered by", "text", "u-site", { maxLen: 60, aliases: ["EnteredBy", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647", "Entered By"] })
    ]
  },
  {
    code: "TPL-PMS",
    title: { fa: "\u0628\u0631\u0646\u0627\u0645\u0647 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u067E\u06CC\u0634\u06AF\u06CC\u0631\u0627\u0646\u0647", en: "Preventive maintenance schedule" },
    targetTable: "PmSchedule",
    module: "d9",
    keyFields: ["Code"],
    fields: [
      f("Code", "\u06A9\u062F \u0628\u0631\u0646\u0627\u0645\u0647", "Schedule code", "text", "PM-EQ001-250", { required: true, maxLen: 40, aliases: ["Code", "\u06A9\u062F \u0628\u0631\u0646\u0627\u0645\u0647", "\u06A9\u062F"] }),
      f("EquipmentId", "\u06A9\u062F \u0645\u0627\u0634\u06CC\u0646", "Equipment", "text", "EQ-001", { required: true, maxLen: 60, aliases: ["EquipmentId", "\u06A9\u062F \u0645\u0627\u0634\u06CC\u0646", "\u0645\u0627\u0634\u06CC\u0646", "Equipment"] }),
      f("TitleFa", "\u0639\u0646\u0648\u0627\u0646 \u0633\u0631\u0648\u06CC\u0633", "Service title", "text", "\u062A\u0639\u0648\u06CC\u0636 \u0631\u0648\u063A\u0646 \u0648 \u0641\u06CC\u0644\u062A\u0631 \u2014 \u0647\u0631 \u06F2\u06F5\u06F0 \u0633\u0627\u0639\u062A", { required: true, maxLen: 300, aliases: ["TitleFa", "\u0639\u0646\u0648\u0627\u0646 \u0633\u0631\u0648\u06CC\u0633", "\u0639\u0646\u0648\u0627\u0646", "Title"] }),
      f("Basis", "\u067E\u0627\u06CC\u0647 \u062F\u0648\u0631\u0647", "Interval basis", "enum", "run_hours", { required: true, enumValues: ["run_hours", "kilometers", "calendar_days", "cycles"], aliases: ["Basis", "\u067E\u0627\u06CC\u0647 \u062F\u0648\u0631\u0647", "\u067E\u0627\u06CC\u0647", "Basis"] }),
      f("IntervalValue", "\u0628\u0627\u0632\u0647 \u062F\u0648\u0631\u0647", "Interval value", "number", "250", { required: true, min: 1, aliases: ["IntervalValue", "\u0628\u0627\u0632\u0647 \u062F\u0648\u0631\u0647", "\u0628\u0627\u0632\u0647", "Interval"] }),
      f("LastDoneAt", "\u0622\u062E\u0631\u06CC\u0646 \u0627\u0646\u062C\u0627\u0645 (\u062A\u0627\u0631\u06CC\u062E)", "Last done date", "date", "2026-08-20", { aliases: ["LastDoneAt", "\u0622\u062E\u0631\u06CC\u0646 \u0627\u0646\u062C\u0627\u0645", "\u062A\u0627\u0631\u06CC\u062E \u0622\u062E\u0631\u06CC\u0646 \u0633\u0631\u0648\u06CC\u0633"] }),
      f("LastDoneReading", "\u0622\u062E\u0631\u06CC\u0646 \u0627\u0646\u062C\u0627\u0645 (\u0634\u0645\u0627\u0631\u0646\u062F\u0647)", "Last done reading", "number", "1040", { min: 0, aliases: ["LastDoneReading", "\u0634\u0645\u0627\u0631\u0646\u062F\u0647 \u0622\u062E\u0631\u06CC\u0646 \u0633\u0631\u0648\u06CC\u0633", "\u06A9\u0627\u0631\u06A9\u0631\u062F \u0622\u062E\u0631\u06CC\u0646 \u0633\u0631\u0648\u06CC\u0633"] }),
      f("ChecklistFa", "\u0686\u06A9\u200C\u0644\u06CC\u0633\u062A", "Checklist", "text", "\u0631\u0648\u063A\u0646 \u0645\u0648\u062A\u0648\u0631\u060C \u0641\u06CC\u0644\u062A\u0631 \u0631\u0648\u063A\u0646\u060C \u0641\u06CC\u0644\u062A\u0631 \u0633\u0648\u062E\u062A\u060C \u0641\u06CC\u0644\u062A\u0631 \u0647\u0648\u0627", { maxLen: 2e3, aliases: ["ChecklistFa", "\u0686\u06A9\u200C\u0644\u06CC\u0633\u062A", "\u0634\u0631\u062D \u0627\u0642\u062F\u0627\u0645\u0627\u062A"] })
    ]
  },
  {
    code: "TPL-SPR",
    title: { fa: "\u0627\u0646\u0628\u0627\u0631 \u0642\u0637\u0639\u0627\u062A \u06CC\u062F\u06A9\u06CC", en: "Spare parts inventory" },
    targetTable: "SparePart",
    module: "d9",
    keyFields: ["PartNo"],
    fields: [
      f("PartNo", "\u06A9\u062F \u0642\u0637\u0639\u0647", "Part number", "text", "CAT-1R-0750", { required: true, maxLen: 60, aliases: ["PartNo", "\u06A9\u062F \u0642\u0637\u0639\u0647", "\u06A9\u062F", "Part No", "OEM Code"] }),
      f("NameFa", "\u0646\u0627\u0645 \u0642\u0637\u0639\u0647", "Part name", "text", "\u0641\u06CC\u0644\u062A\u0631 \u0633\u0648\u062E\u062A \u06A9\u0627\u062A\u0631\u067E\u06CC\u0644\u0627\u0631", { required: true, maxLen: 300, aliases: ["NameFa", "\u0646\u0627\u0645 \u0642\u0637\u0639\u0647", "\u0646\u0627\u0645", "Description"] }),
      f("Uom", "\u0648\u0627\u062D\u062F", "Unit of measure", "text", "\u0639\u062F\u062F", { maxLen: 20, aliases: ["Uom", "\u0648\u0627\u062D\u062F", "UoM", "Unit"] }),
      f("OnHand", "\u0645\u0648\u062C\u0648\u062F\u06CC", "On hand", "number", "4", { required: true, min: 0, aliases: ["OnHand", "\u0645\u0648\u062C\u0648\u062F\u06CC", "\u0645\u0648\u062C\u0648\u062F\u06CC \u0627\u0646\u0628\u0627\u0631", "Stock"] }),
      f("MinLevel", "\u062D\u062F\u0627\u0642\u0644 \u0645\u0648\u062C\u0648\u062F\u06CC", "Minimum level", "number", "10", { required: true, min: 0, aliases: ["MinLevel", "\u062D\u062F\u0627\u0642\u0644 \u0645\u0648\u062C\u0648\u062F\u06CC", "\u062D\u062F\u0627\u0642\u0644", "Min Stock"] }),
      f("LeadTimeDays", "\u0632\u0645\u0627\u0646 \u062A\u0623\u0645\u06CC\u0646 (\u0631\u0648\u0632)", "Lead time (days)", "int", "21", { min: 0, max: 3650, aliases: ["LeadTimeDays", "\u0632\u0645\u0627\u0646 \u062A\u0623\u0645\u06CC\u0646", "\u0644\u06CC\u062F \u062A\u0627\u06CC\u0645", "Lead Time"] }),
      f("AvgDailyUsage", "\u0645\u0635\u0631\u0641 \u0631\u0648\u0632\u0627\u0646\u0647", "Average daily usage", "number", "0.4", { min: 0, aliases: ["AvgDailyUsage", "\u0645\u0635\u0631\u0641 \u0631\u0648\u0632\u0627\u0646\u0647", "\u0645\u0635\u0631\u0641"] }),
      f("UnitCost", "\u0628\u0647\u0627\u06CC \u0648\u0627\u062D\u062F", "Unit cost", "number", "4200000", { min: 0, aliases: ["UnitCost", "\u0628\u0647\u0627\u06CC \u0648\u0627\u062D\u062F", "\u0642\u06CC\u0645\u062A \u0648\u0627\u062D\u062F", "Price"] }),
      f("Critical", "\u0642\u0637\u0639\u0647 \u0628\u062D\u0631\u0627\u0646\u06CC", "Critical part", "bool", "true", { aliases: ["Critical", "\u0642\u0637\u0639\u0647 \u0628\u062D\u0631\u0627\u0646\u06CC", "\u0628\u062D\u0631\u0627\u0646\u06CC"] }),
      f("EquipmentCategory", "\u062F\u0633\u062A\u0647 \u0645\u0627\u0634\u06CC\u0646 \u0645\u0631\u062A\u0628\u0637", "Related category", "text", "EXC", { maxLen: 30, aliases: ["EquipmentCategory", "\u062F\u0633\u062A\u0647 \u0645\u0627\u0634\u06CC\u0646", "\u062F\u0633\u062A\u0647"] })
    ]
  },
  /* ── d12 مهندسی و طراحی ── */
  {
    code: "TPL-MDR",
    title: { fa: "\u0641\u0647\u0631\u0633\u062A \u0645\u062F\u0627\u0631\u06A9 \u0645\u0647\u0646\u062F\u0633\u06CC", en: "Master document register" },
    targetTable: "MdrDeliverable",
    module: "d12",
    keyFields: ["DocNo"],
    fields: [
      f("DocNo", "\u0634\u0645\u0627\u0631\u0647 \u0645\u062F\u0631\u06A9", "Document number", "text", "PR-PID-001", { required: true, maxLen: 80, aliases: ["DocNo", "\u0634\u0645\u0627\u0631\u0647 \u0645\u062F\u0631\u06A9", "\u0634\u0645\u0627\u0631\u0647", "Doc No", "Document No", "drawing_no"] }),
      f("TitleFa", "\u0639\u0646\u0648\u0627\u0646 \u0645\u062F\u0631\u06A9", "Document title", "text", "\u0646\u0642\u0634\u0647 \u062C\u0631\u06CC\u0627\u0646 \u0641\u0631\u0622\u06CC\u0646\u062F \u0648\u0627\u062D\u062F \u06F1", { required: true, maxLen: 400, aliases: ["TitleFa", "\u0639\u0646\u0648\u0627\u0646 \u0645\u062F\u0631\u06A9", "\u0639\u0646\u0648\u0627\u0646", "\u0634\u0631\u062D", "Title", "Description"] }),
      f("Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "Discipline", "text", "process", { required: true, maxLen: 40, aliases: ["Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "\u0631\u0634\u062A\u0647", "Disc"] }),
      f("DocType", "\u0646\u0648\u0639 \u0645\u062F\u0631\u06A9", "Document type", "text", "pid", { required: true, maxLen: 40, aliases: ["DocType", "\u0646\u0648\u0639 \u0645\u062F\u0631\u06A9", "\u0646\u0648\u0639", "Type", "Doc Type"] }),
      f("PlannedWeight", "\u0648\u0632\u0646 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0627\u06CC", "Planned weight %", "number", "3.5", { required: true, min: 0, max: 100, aliases: ["PlannedWeight", "\u0648\u0632\u0646 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0627\u06CC", "\u0648\u0632\u0646", "Weight", "Weight %"] }),
      f("EstimatedManhours", "\u0646\u0641\u0631\u0633\u0627\u0639\u062A \u0628\u0631\u0622\u0648\u0631\u062F\u06CC", "Estimated manhours", "number", "420", { min: 0, aliases: ["EstimatedManhours", "\u0646\u0641\u0631\u0633\u0627\u0639\u062A \u0628\u0631\u0622\u0648\u0631\u062F\u06CC", "\u0646\u0641\u0631\u0633\u0627\u0639\u062A", "Manhours", "MH"] }),
      f("WbsId", "\u06AF\u0631\u0647 WBS", "WBS node", "text", "W-100", { maxLen: 60, aliases: ["WbsId", "\u06AF\u0631\u0647 WBS", "WBS", "WBS Code"] }),
      f("TargetIfaDate", "\u062A\u0627\u0631\u06CC\u062E \u0647\u062F\u0641 IFA", "Target IFA date", "date", "2026-03-01", { aliases: ["TargetIfaDate", "\u062A\u0627\u0631\u06CC\u062E \u0647\u062F\u0641 IFA", "IFA", "IFA Date", "Target IFA"] }),
      f("TargetIfcDate", "\u062A\u0627\u0631\u06CC\u062E \u0647\u062F\u0641 IFC", "Target IFC date", "date", "2026-05-01", { aliases: ["TargetIfcDate", "\u062A\u0627\u0631\u06CC\u062E \u0647\u062F\u0641 IFC", "IFC", "IFC Date", "Target IFC"] }),
      f("Status", "\u0648\u0636\u0639\u06CC\u062A", "Status", "text", "in_progress", { required: true, maxLen: 30, aliases: ["Status", "\u0648\u0636\u0639\u06CC\u062A"] }),
      f("CriticalityLevel", "\u0633\u0637\u062D \u0628\u062D\u0631\u0627\u0646\u06CC\u062A", "Criticality", "text", "high", { maxLen: 20, aliases: ["CriticalityLevel", "\u0633\u0637\u062D \u0628\u062D\u0631\u0627\u0646\u06CC\u062A", "\u0628\u062D\u0631\u0627\u0646\u06CC\u062A", "Criticality"] }),
      f("ContractReviewDays", "\u0645\u0647\u0644\u062A \u0628\u0631\u0631\u0633\u06CC (\u0631\u0648\u0632)", "Review days", "int", "14", { min: 0, max: 365, aliases: ["ContractReviewDays", "\u0645\u0647\u0644\u062A \u0628\u0631\u0631\u0633\u06CC (\u0631\u0648\u0632)", "\u0645\u0647\u0644\u062A \u0628\u0631\u0631\u0633\u06CC", "\u0645\u0647\u0644\u062A", "Review Days"] })
    ]
  },
  {
    code: "TPL-CRS",
    title: { fa: "\u0634\u06CC\u062A \u062B\u0628\u062A \u0648 \u067E\u0627\u0633\u062E \u0646\u0638\u0631\u0627\u062A", en: "Comment resolution sheet" },
    targetTable: "CrsComment",
    module: "d12",
    keyFields: ["RevisionId", "CommentNo"],
    fields: [
      f("RevisionId", "\u0634\u0646\u0627\u0633\u0647 \u0631\u06CC\u0648\u06CC\u0698\u0646", "Revision ID", "text", "ENG-R1", { required: true, maxLen: 60, aliases: ["RevisionId", "\u0634\u0646\u0627\u0633\u0647 \u0631\u06CC\u0648\u06CC\u0698\u0646", "\u0631\u06CC\u0648\u06CC\u0698\u0646", "Revision", "Rev ID"] }),
      f("CommentNo", "\u0634\u0645\u0627\u0631\u0647 \u0646\u0638\u0631", "Comment number", "int", "1", { required: true, min: 1, aliases: ["CommentNo", "\u0634\u0645\u0627\u0631\u0647 \u0646\u0638\u0631", "\u0631\u062F\u06CC\u0641", "No", "Item"] }),
      f("RaisedBy", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647 \u0646\u0638\u0631", "Raised by", "text", "client1", { required: true, maxLen: 60, aliases: ["RaisedBy", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647 \u0646\u0638\u0631", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647", "Reviewer", "By"] }),
      f("RaisedAt", "\u062A\u0627\u0631\u06CC\u062E \u0646\u0638\u0631", "Raised at", "date", "2026-02-20", { required: true, aliases: ["RaisedAt", "\u062A\u0627\u0631\u06CC\u062E \u0646\u0638\u0631", "\u062A\u0627\u0631\u06CC\u062E", "Date"] }),
      f("Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "Discipline", "text", "civil", { maxLen: 40, aliases: ["Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "\u0631\u0634\u062A\u0647"] }),
      f("SheetRef", "\u0645\u0631\u062C\u0639 \u0634\u06CC\u062A", "Sheet reference", "text", "Sheet 2", { maxLen: 80, aliases: ["SheetRef", "\u0645\u0631\u062C\u0639 \u0634\u06CC\u062A", "\u0634\u06CC\u062A", "Sheet", "Ref"] }),
      f("Severity", "\u0634\u062F\u062A", "Severity", "text", "major", { required: true, maxLen: 20, aliases: ["Severity", "\u0634\u062F\u062A", "\u0627\u0647\u0645\u06CC\u062A"] }),
      f("CommentText", "\u0645\u062A\u0646 \u0646\u0638\u0631", "Comment", "text", "\u0636\u062E\u0627\u0645\u062A \u0641\u0648\u0646\u062F\u0627\u0633\u06CC\u0648\u0646 \u0628\u0627 \u0628\u0627\u0631 \u0645\u062D\u0627\u0633\u0628\u0627\u062A\u06CC \u0647\u0645\u062E\u0648\u0627\u0646 \u0646\u06CC\u0633\u062A", { required: true, maxLen: 2e3, aliases: ["CommentText", "\u0645\u062A\u0646 \u0646\u0638\u0631", "\u0646\u0638\u0631", "Comment", "Remark"] }),
      f("ResponseText", "\u067E\u0627\u0633\u062E \u0637\u0631\u0627\u062D", "Designer response", "text", "\u0636\u062E\u0627\u0645\u062A \u0628\u0647 \u06F9\u06F0 \u0633\u0627\u0646\u062A\u06CC\u200C\u0645\u062A\u0631 \u0627\u0641\u0632\u0627\u06CC\u0634 \u06CC\u0627\u0641\u062A", { maxLen: 2e3, aliases: ["ResponseText", "\u067E\u0627\u0633\u062E \u0637\u0631\u0627\u062D", "\u067E\u0627\u0633\u062E", "Response", "Reply"] }),
      f("ResponseStatus", "\u0648\u0636\u0639\u06CC\u062A \u067E\u0627\u0633\u062E", "Response status", "text", "agreed", { required: true, maxLen: 20, aliases: ["ResponseStatus", "\u0648\u0636\u0639\u06CC\u062A \u067E\u0627\u0633\u062E", "\u0648\u0636\u0639\u06CC\u062A", "Status"] }),
      f("VerifiedBy", "\u0635\u062D\u0647\u200C\u06AF\u0630\u0627\u0631", "Verified by", "text", "sup1", { maxLen: 60, aliases: ["VerifiedBy", "\u0635\u062D\u0647\u200C\u06AF\u0630\u0627\u0631", "\u0646\u0627\u0638\u0631", "Verified By"] }),
      f("ClosedInRevCode", "\u0628\u0633\u062A\u0647 \u062F\u0631 \u0631\u06CC\u0648\u06CC\u0698\u0646", "Closed in revision", "text", "B", { maxLen: 10, aliases: ["ClosedInRevCode", "\u0628\u0633\u062A\u0647 \u062F\u0631 \u0631\u06CC\u0648\u06CC\u0698\u0646", "Closed In"] })
    ]
  },
  {
    code: "TPL-EPR",
    title: { fa: "\u062B\u0628\u062A \u067E\u06CC\u0634\u0631\u0641\u062A \u0645\u062F\u0627\u0631\u06A9 \u0645\u0647\u0646\u062F\u0633\u06CC", en: "Engineering progress update" },
    targetTable: "EngineeringRevision",
    module: "d12",
    keyFields: ["DeliverableId", "RevCode"],
    fields: [
      f("DeliverableId", "\u0634\u0646\u0627\u0633\u0647 \u0645\u062F\u0631\u06A9", "Deliverable ID", "text", "ENG-D1", { required: true, maxLen: 60, aliases: ["DeliverableId", "\u0634\u0646\u0627\u0633\u0647 \u0645\u062F\u0631\u06A9", "\u0645\u062F\u0631\u06A9", "Deliverable", "Doc ID"] }),
      f("RevCode", "\u06A9\u062F \u0631\u06CC\u0648\u06CC\u0698\u0646", "Revision code", "text", "A", { required: true, maxLen: 10, aliases: ["RevCode", "\u06A9\u062F \u0631\u06CC\u0648\u06CC\u0698\u0646", "\u0631\u06CC\u0648\u06CC\u0698\u0646", "Rev", "Revision"] }),
      f("Purpose", "\u0647\u062F\u0641 \u0635\u062F\u0648\u0631", "Issue purpose", "text", "IFA", { required: true, maxLen: 20, aliases: ["Purpose", "\u0647\u062F\u0641 \u0635\u062F\u0648\u0631", "\u0647\u062F\u0641", "Issue Purpose", "Issued For"] }),
      f("IssuedAt", "\u062A\u0627\u0631\u06CC\u062E \u0635\u062F\u0648\u0631", "Issued at", "date", "2026-02-10", { required: true, aliases: ["IssuedAt", "\u062A\u0627\u0631\u06CC\u062E \u0635\u062F\u0648\u0631", "\u062A\u0627\u0631\u06CC\u062E", "Issue Date", "Date"] }),
      f("IssuedBy", "\u0635\u0627\u062F\u0631\u06A9\u0646\u0646\u062F\u0647", "Issued by", "text", "des1", { maxLen: 60, aliases: ["IssuedBy", "\u0635\u0627\u062F\u0631\u06A9\u0646\u0646\u062F\u0647", "\u0637\u0631\u0627\u062D", "Issued By"] }),
      f("TransmittalId", "\u0634\u0645\u0627\u0631\u0647 \u062A\u0631\u0627\u0646\u0633\u0645\u06CC\u062A\u0627\u0644", "Transmittal", "text", "TRN-001", { maxLen: 60, aliases: ["TransmittalId", "\u0634\u0645\u0627\u0631\u0647 \u062A\u0631\u0627\u0646\u0633\u0645\u06CC\u062A\u0627\u0644", "\u062A\u0631\u0627\u0646\u0633\u0645\u06CC\u062A\u0627\u0644", "Transmittal", "TRN"] }),
      f("ReviewCode", "\u06A9\u062F \u0628\u0631\u0631\u0633\u06CC", "Review code", "text", "2", { maxLen: 10, aliases: ["ReviewCode", "\u06A9\u062F \u0628\u0631\u0631\u0633\u06CC", "\u06A9\u062F", "Review Code", "Code"] }),
      f("ReviewedAt", "\u062A\u0627\u0631\u06CC\u062E \u0628\u0631\u0631\u0633\u06CC", "Reviewed at", "date", "2026-02-22", { aliases: ["ReviewedAt", "\u062A\u0627\u0631\u06CC\u062E \u0628\u0631\u0631\u0633\u06CC", "Review Date"] }),
      f("IdcCompletedAt", "\u062A\u0627\u0631\u06CC\u062E \u0627\u062A\u0645\u0627\u0645 IDC", "IDC completed", "date", "2026-02-05", { aliases: ["IdcCompletedAt", "\u062A\u0627\u0631\u06CC\u062E \u0627\u062A\u0645\u0627\u0645 IDC", "IDC", "IDC Date"] }),
      f("Status", "\u0648\u0636\u0639\u06CC\u062A", "Status", "text", "coded", { required: true, maxLen: 30, aliases: ["Status", "\u0648\u0636\u0639\u06CC\u062A"] })
    ]
  },
  {
    code: "TPL-TQR",
    title: { fa: "\u062F\u0641\u062A\u0631 \u0627\u0633\u062A\u0639\u0644\u0627\u0645 \u0648 \u062A\u063A\u06CC\u06CC\u0631 \u0641\u0646\u06CC", en: "TQ / FCR register" },
    targetTable: "TechnicalQuery",
    module: "d12",
    keyFields: ["Code"],
    fields: [
      f("Code", "\u0634\u0645\u0627\u0631\u0647 \u0627\u0633\u062A\u0639\u0644\u0627\u0645", "Query code", "text", "TQ-2026-011", { required: true, maxLen: 40, aliases: ["Code", "\u0634\u0645\u0627\u0631\u0647 \u0627\u0633\u062A\u0639\u0644\u0627\u0645", "\u0634\u0645\u0627\u0631\u0647", "TQ No", "FCR No"] }),
      f("Kind", "\u0646\u0648\u0639", "Kind", "text", "TQ", { required: true, maxLen: 10, aliases: ["Kind", "\u0646\u0648\u0639", "Type"] }),
      f("TitleFa", "\u0645\u0648\u0636\u0648\u0639", "Title", "text", "\u0627\u0628\u0647\u0627\u0645 \u062F\u0631 \u062A\u0631\u0627\u0632 \u0646\u0635\u0628 \u067E\u0645\u067E", { required: true, maxLen: 400, aliases: ["TitleFa", "\u0645\u0648\u0636\u0648\u0639", "\u0639\u0646\u0648\u0627\u0646", "\u0634\u0631\u062D", "Title", "Subject"] }),
      f("Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "Discipline", "text", "mechanical", { required: true, maxLen: 40, aliases: ["Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "\u0631\u0634\u062A\u0647"] }),
      f("RaisedBy", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647", "Raised by", "text", "site1", { required: true, maxLen: 60, aliases: ["RaisedBy", "\u062B\u0628\u062A\u200C\u06A9\u0646\u0646\u062F\u0647", "By"] }),
      f("RaisedAt", "\u062A\u0627\u0631\u06CC\u062E \u062B\u0628\u062A", "Raised at", "date", "2026-04-10", { required: true, aliases: ["RaisedAt", "\u062A\u0627\u0631\u06CC\u062E \u062B\u0628\u062A", "\u062A\u0627\u0631\u06CC\u062E", "Date"] }),
      f("DeliverableId", "\u0645\u062F\u0631\u06A9 \u0645\u0631\u062A\u0628\u0637", "Related deliverable", "text", "ENG-D1", { maxLen: 60, aliases: ["DeliverableId", "\u0645\u062F\u0631\u06A9 \u0645\u0631\u062A\u0628\u0637", "\u0645\u062F\u0631\u06A9", "Deliverable"] }),
      f("DueAt", "\u0645\u0647\u0644\u062A \u067E\u0627\u0633\u062E", "Due date", "date", "2026-04-24", { aliases: ["DueAt", "\u0645\u0647\u0644\u062A \u067E\u0627\u0633\u062E", "\u0645\u0647\u0644\u062A", "Due", "Due Date"] }),
      f("Status", "\u0648\u0636\u0639\u06CC\u062A", "Status", "text", "open", { required: true, maxLen: 30, aliases: ["Status", "\u0648\u0636\u0639\u06CC\u062A"] }),
      f("CostImpact", "\u0627\u062B\u0631 \u0647\u0632\u06CC\u0646\u0647\u200C\u0627\u06CC", "Cost impact", "number", "185000000", { aliases: ["CostImpact", "\u0627\u062B\u0631 \u0647\u0632\u06CC\u0646\u0647\u200C\u0627\u06CC", "\u0627\u062B\u0631 \u0647\u0632\u06CC\u0646\u0647", "Cost Impact", "Cost"] }),
      f("TimeImpactDays", "\u0627\u062B\u0631 \u0632\u0645\u0627\u0646\u06CC (\u0631\u0648\u0632)", "Time impact (days)", "int", "6", { aliases: ["TimeImpactDays", "\u0627\u062B\u0631 \u0632\u0645\u0627\u0646\u06CC (\u0631\u0648\u0632)", "\u0627\u062B\u0631 \u0632\u0645\u0627\u0646\u06CC", "\u0627\u062B\u0631 \u0632\u0645\u0627\u0646", "Time Impact", "Delay"] }),
      f("AsBuiltStatus", "\u0648\u0636\u0639\u06CC\u062A \u0686\u0648\u0646\u200C\u0633\u0627\u062E\u062A", "As-built status", "text", "pending", { maxLen: 20, aliases: ["AsBuiltStatus", "\u0648\u0636\u0639\u06CC\u062A \u0686\u0648\u0646\u200C\u0633\u0627\u062E\u062A", "\u0686\u0648\u0646\u200C\u0633\u0627\u062E\u062A", "As-Built"] })
    ]
  },
  {
    code: "TPL-VPR",
    title: { fa: "\u062F\u0641\u062A\u0631 \u0645\u062F\u0627\u0631\u06A9 \u0633\u0627\u0632\u0646\u062F\u06AF\u0627\u0646", en: "Vendor print register" },
    targetTable: "VendorPrintReview",
    module: "d12",
    keyFields: ["VendorDocNo", "RevCode"],
    fields: [
      f("VendorDocNo", "\u0634\u0645\u0627\u0631\u0647 \u0645\u062F\u0631\u06A9 \u0633\u0627\u0632\u0646\u062F\u0647", "Vendor doc number", "text", "VD-PMP-001", { required: true, maxLen: 80, aliases: ["VendorDocNo", "\u0634\u0645\u0627\u0631\u0647 \u0645\u062F\u0631\u06A9 \u0633\u0627\u0632\u0646\u062F\u0647", "\u0634\u0645\u0627\u0631\u0647 \u0645\u062F\u0631\u06A9", "Vendor Doc", "Doc No"] }),
      f("VendorName", "\u0646\u0627\u0645 \u0633\u0627\u0632\u0646\u062F\u0647", "Vendor name", "text", "\u067E\u0645\u067E\u200C\u0633\u0627\u0632\u0627\u0646 \u0627\u06CC\u0631\u0627\u0646", { required: true, maxLen: 200, aliases: ["VendorName", "\u0646\u0627\u0645 \u0633\u0627\u0632\u0646\u062F\u0647", "\u0633\u0627\u0632\u0646\u062F\u0647", "Vendor", "Supplier"] }),
      f("TitleFa", "\u0639\u0646\u0648\u0627\u0646 \u0645\u062F\u0631\u06A9", "Title", "text", "\u0646\u0642\u0634\u0647 \u0627\u0628\u0639\u0627\u062F\u06CC \u067E\u0645\u067E \u06AF\u0631\u06CC\u0632 \u0627\u0632 \u0645\u0631\u06A9\u0632", { required: true, maxLen: 400, aliases: ["TitleFa", "\u0639\u0646\u0648\u0627\u0646 \u0645\u062F\u0631\u06A9", "\u0639\u0646\u0648\u0627\u0646", "\u0634\u0631\u062D", "Title"] }),
      f("PoNo", "\u0634\u0645\u0627\u0631\u0647 \u0633\u0641\u0627\u0631\u0634 \u062E\u0631\u06CC\u062F", "PO number", "text", "PO-2026-088", { maxLen: 60, aliases: ["PoNo", "\u0634\u0645\u0627\u0631\u0647 \u0633\u0641\u0627\u0631\u0634 \u062E\u0631\u06CC\u062F", "\u0633\u0641\u0627\u0631\u0634 \u062E\u0631\u06CC\u062F", "PO", "PO No", "Purchase Order"] }),
      f("TagNo", "\u062A\u06AF \u062A\u062C\u0647\u06CC\u0632", "Tag number", "text", "P-101A", { maxLen: 80, aliases: ["TagNo", "\u062A\u06AF \u062A\u062C\u0647\u06CC\u0632", "\u062A\u06AF", "Tag", "Tag No"] }),
      f("Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "Discipline", "text", "mechanical", { required: true, maxLen: 40, aliases: ["Discipline", "\u062F\u06CC\u0633\u06CC\u067E\u0644\u06CC\u0646", "\u0631\u0634\u062A\u0647"] }),
      f("RevCode", "\u06A9\u062F \u0631\u06CC\u0648\u06CC\u0698\u0646", "Revision", "text", "0", { required: true, maxLen: 10, aliases: ["RevCode", "\u06A9\u062F \u0631\u06CC\u0648\u06CC\u0698\u0646", "\u0631\u06CC\u0648\u06CC\u0698\u0646", "Rev"] }),
      f("ReceivedAt", "\u062A\u0627\u0631\u06CC\u062E \u062F\u0631\u06CC\u0627\u0641\u062A", "Received at", "date", "2026-03-20", { required: true, aliases: ["ReceivedAt", "\u062A\u0627\u0631\u06CC\u062E \u062F\u0631\u06CC\u0627\u0641\u062A", "\u062F\u0631\u06CC\u0627\u0641\u062A", "Received", "Date"] }),
      f("DueAt", "\u0645\u0647\u0644\u062A \u0628\u0631\u0631\u0633\u06CC", "Due date", "date", "2026-04-03", { aliases: ["DueAt", "\u0645\u0647\u0644\u062A \u0628\u0631\u0631\u0633\u06CC", "\u0645\u0647\u0644\u062A", "Due"] }),
      f("ReviewCode", "\u06A9\u062F \u0628\u0631\u0631\u0633\u06CC", "Review code", "text", "2", { maxLen: 10, aliases: ["ReviewCode", "\u06A9\u062F \u0628\u0631\u0631\u0633\u06CC", "\u06A9\u062F", "Code"] }),
      f("Status", "\u0648\u0636\u0639\u06CC\u062A", "Status", "text", "under_review", { required: true, maxLen: 30, aliases: ["Status", "\u0648\u0636\u0639\u06CC\u062A"] })
    ]
  }
];
var TPL_BY_CODE = new Map(TEMPLATE_CATALOG.map((t) => [t.code, t]));
var CONNECTORS = [
  {
    code: "CN-P6-XER",
    title: { fa: "\u067E\u0631\u06CC\u0645\u0627\u0648\u0631\u0627 P6 \u2014 \u0641\u0627\u06CC\u0644 XER", en: "Primavera P6 \u2014 XER file" },
    direction: "inbound",
    format: "XER",
    targetTables: ["WbsNode", "Activity", "ActivityRelation"],
    status: "ready",
    note: { fa: "\u062A\u062C\u0632\u06CC\u0647\u0654 \u06A9\u0627\u0645\u0644 TASK\u060C TASKPRED\u060C PROJWBS \u0648 CALENDAR \u0628\u0627 \u062A\u0641\u0627\u0648\u062A\u200C\u06AF\u06CC\u0631\u06CC \u067E\u06CC\u0634 \u0627\u0632 \u0646\u0648\u0634\u062A\u0646", en: "Full TASK, TASKPRED, PROJWBS and CALENDAR parsing with pre-write diff" }
  },
  {
    code: "CN-XLS-TPL",
    title: { fa: "\u0642\u0627\u0644\u0628\u200C\u0647\u0627\u06CC Excel \u0648 CSV", en: "Excel & CSV templates" },
    direction: "both",
    format: "CSV / XLSX",
    targetTables: TEMPLATE_CATALOG.map((t) => t.targetTable),
    status: "ready",
    note: { fa: "\u0634\u0634 \u0642\u0627\u0644\u0628 \u0628\u0627 \u0646\u06AF\u0627\u0634\u062A \u0633\u0631\u0633\u062A\u0648\u0646 \u0641\u0627\u0631\u0633\u06CC/\u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC \u0648 \u0627\u0639\u062A\u0628\u0627\u0631\u0633\u0646\u062C\u06CC \u0633\u0644\u0648\u0644\u06CC", en: "Six templates with FA/EN header mapping and per-cell validation" }
  },
  {
    code: "CN-OPENAPI",
    title: { fa: "OpenAPI 3.0", en: "OpenAPI 3.0" },
    direction: "outbound",
    format: "JSON / YAML",
    targetTables: [],
    status: "ready",
    note: { fa: "\u0627\u0632 \u0627\u0633\u06A9\u06CC\u0645\u0627\u06CC \u0642\u0627\u0646\u0648\u0646\u06CC sql-v1 \u062A\u0648\u0644\u06CC\u062F \u0645\u06CC\u200C\u0634\u0648\u062F\u060C \u067E\u0633 \u0647\u0631\u06AF\u0632 \u0628\u0627 \u06A9\u062F \u0648\u0627\u06AF\u0631\u0627 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F", en: "Generated from the canonical sql-v1 schema so it cannot drift" }
  },
  {
    code: "CN-MSP",
    title: { fa: "Microsoft Project", en: "Microsoft Project" },
    direction: "inbound",
    format: "MPP / XML",
    targetTables: ["Activity"],
    status: "planned",
    note: { fa: "MPP \u0642\u0627\u0644\u0628 \u0628\u0627\u06CC\u0646\u0631\u06CC \u0628\u0633\u062A\u0647 \u0627\u0633\u062A\u061B \u0645\u0633\u06CC\u0631 \u0639\u0645\u0644\u06CC\u060C \u0635\u0627\u062F\u0631\u0627\u062A XML \u067E\u0631\u0648\u0698\u0647 \u0627\u0633\u062A", en: "MPP is a closed binary; the practical route is Project XML export" }
  },
  {
    code: "CN-MAIL",
    title: { fa: "\u0627\u06CC\u0645\u06CC\u0644 \u0648 \u067E\u06CC\u0627\u0645\u06A9", en: "Email & SMS" },
    direction: "outbound",
    format: "SMTP / HTTP",
    targetTables: [],
    status: "partial",
    note: { fa: "\u06A9\u062F \u0627\u0631\u0633\u0627\u0644 \u0647\u0633\u062A \u0648\u0644\u06CC \u0633\u0631\u0648\u06CC\u0633\u200C\u062F\u0647\u0646\u062F\u0647 \u067E\u06CC\u06A9\u0631\u0628\u0646\u062F\u06CC \u0646\u0634\u062F\u0647", en: "Sending code exists but no provider configured" }
  },
  {
    code: "CN-ERP",
    title: { fa: "\u0633\u0627\u0645\u0627\u0646\u0647 \u0645\u0627\u0644\u06CC \u0633\u0627\u0632\u0645\u0627\u0646", en: "Corporate ERP" },
    direction: "both",
    format: "REST",
    targetTables: ["CostAccount", "PaymentCertificate", "IntegrationEvent"],
    /* «جزئی» نه «آماده»: سمت **خروجی** قرارداد دارد (رویداد
     * `hrm.labor.posted` با کلید ایدمپوتنسی و صندوق تحویل — HRM D13)،
     * ولی سمت ورودی هنوز نه. اعلام «آماده» وقتی نیمی از مسیر ساخته
     * شده، همان ادعایی است که در جلسهٔ تحویل می‌شکند. */
    status: "partial",
    note: {
      fa: "\u0642\u0631\u0627\u0631\u062F\u0627\u062F \u062E\u0631\u0648\u062C\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F \u0622\u0645\u0627\u062F\u0647 \u0627\u0633\u062A (hrm.labor.posted\u060C \u0646\u0633\u062E\u0647\u0654 \u06F1.\u06F0) \u0648 \u062A\u062D\u0648\u06CC\u0644 \u0627\u0632 \u0635\u0646\u062F\u0648\u0642 `/api/events/outbox` \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0633\u0645\u062A \u0648\u0631\u0648\u062F\u06CC \u0627\u0632 ERP \u0647\u0646\u0648\u0632 \u062A\u0639\u0631\u06CC\u0641 \u0646\u0634\u062F\u0647",
      en: "Outbound event contract ready (hrm.labor.posted v1.0) via the outbox; inbound from ERP not yet defined"
    }
  }
];

// src/services/clauseParser.ts
var CLAUSE_VERSION = "clause-v1";
function latinizeDigitsKeepLength(line) {
  return line.replace(/[۰-۹]/g, (d) => String(FA_DIGITS_LOCAL.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR_DIGITS_LOCAL.indexOf(d)));
}
var FA_DIGITS_LOCAL = "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9";
var AR_DIGITS_LOCAL = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
var PATTERNS = [
  {
    style: "note",
    /* تبصره — همیشه فرزند بند پیشین است. */
    re: /^[ \t]*(?<no>تبصره[ \t]*\d*)[ \t]*[:.\-–)]?[ \t]*/,
    depthOf: () => 9
  },
  {
    style: "article",
    re: /^[ \t]*(?<no>ماده[ \t]*\d+)[ \t]*[:.\-–)]?[ \t]*/,
    depthOf: () => 1
  },
  {
    style: "paragraph",
    /* بند الف / بند ۲
     *
     * سقف حرف‌ها ۳ است نه ۲: نشانه‌های ترتیبی فارسی «الف» سه حرفی است
     * و با سقف ۲ به «ال» بریده می‌شد — شمارهٔ بند خراب و درخت غلط. */
    re: /^[ \t]*(?<no>بند[ \t]*(?:الف|[ب-ی]{1,2}|\d+))[ \t]*[:.\-–)]?[ \t]*/,
    depthOf: () => 2
  },
  {
    /* کد گام رویه‌ای: C.P3.1 · CP.3.9 · Cp.3.9.B
     *
     * این الگو از سند واقعی کاربر (Scope of Work حفاری) آمد. سندهای
     * رویه‌ای به‌جای بند شماره‌دار، گام‌های اجرایی با کد حرفی-عددی
     * دارند و هر گام یک واحد کار است — یعنی مستقیماً نامزد گرهٔ WBS.
     *
     * پیش از الگوهای عددی می‌آید وگرنه «3.1» از دل «C.P3.1» بیرون
     * کشیده می‌شود و حرف‌ها گم می‌شوند.
     */
    style: "step_code",
    re: /^[ \t]*(?<no>[A-Za-z](?:\.?[A-Za-z])*\.?\d+(?:\.\d+)+(?:\.?[A-Za-z])?)[ \t]+(?=\S)/,
    depthOf: () => 2
  },
  {
    style: "section_en",
    re: /^[ \t]*(?<no>(?:Article|Section|Clause)[ \t]+\d+(?:\.\d+)*)[ \t]*[:.\-–)]?[ \t]*/i,
    depthOf: (no) => (no.match(/\./g)?.length ?? 0) + 1
  },
  {
    style: "numeric_dash",
    /* دو شکل رایج فارسی:
     *   «۱- موضوع»      عدد تنها با خط تیرهٔ پایانی
     *   «۱-۱- شرح کار»  سلسله‌مراتبی
     * خط تیرهٔ پایانی اجباری است تا «۱۴ نفر» سرِ بند شمرده نشود. */
    re: /^[ \t]*(?<no>\d+(?:-\d+)*)[ \t]*-[ \t]+/,
    depthOf: (no) => no.split("-").length
  },
  {
    style: "numeric_dot",
    /* ۵.۲.۳ — دست‌کم یک نقطه لازم است تا با شمارهٔ صفحه اشتباه نشود */
    re: /^[ \t]*(?<no>\d+(?:\.\d+)+)[ \t]*[:.\-–)]?[ \t]+/,
    depthOf: (no) => no.split(".").length
  },
  {
    style: "clause_en",
    /* عدد تنها در ابتدای خط: «7. Payment» — پرخطرترین الگو، آخر می‌آید */
    re: /^[ \t]*(?<no>\d{1,2})[.)][ \t]+(?=[^\d])/,
    depthOf: () => 1
  }
];
function canonicalStepCode(raw) {
  const s = normalizeDigits(raw).toUpperCase().replace(/\s+/g, "");
  const m = /^([A-Z.]+?)\.?(\d.*)$/.exec(s);
  if (!m) return s;
  const letters = m[1].replace(/\./g, "");
  return `${letters}${m[2]}`;
}
function normalizeClauseNo(raw) {
  return normalizeDigits(raw).replace(/[–—]/g, "-").replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").replace(/\s*\.\s*/g, ".").trim();
}
function parentOf(clauseNo) {
  const s = normalizeClauseNo(clauseNo);
  const sep = s.includes("-") ? "-" : s.includes(".") ? "." : null;
  if (!sep) return null;
  const parts = s.split(sep);
  if (parts.length < 2) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  return parts.slice(0, -1).join(sep);
}
function matchHead(line) {
  const probe = latinizeDigitsKeepLength(line);
  for (const p of PATTERNS) {
    const m = p.re.exec(probe);
    if (!m?.groups?.no) continue;
    const no = p.style === "step_code" ? canonicalStepCode(m.groups.no) : normalizeClauseNo(m.groups.no);
    return {
      style: p.style,
      no,
      rest: line.slice(m[0].length),
      depth: p.depthOf(no)
    };
  }
  return null;
}
function guessTitle(firstLine) {
  const s = firstLine.trim();
  if (!s) return null;
  if (s.length > 80) return null;
  if (/[.،؛]$/.test(s)) return null;
  return s;
}
var PAGE_BREAK = /\f/;
function buildPageIndex(text) {
  const bounds = [];
  let at = 0;
  for (const part of text.split(PAGE_BREAK)) {
    at += part.length + 1;
    bounds.push(at);
  }
  return bounds;
}
function pageOf(charIndex, bounds) {
  for (let i = 0; i < bounds.length; i += 1) {
    if (charIndex < bounds[i]) return i + 1;
  }
  return Math.max(1, bounds.length);
}
function parseClauses(rawText) {
  const warningsFa = [];
  const text = String(rawText ?? "");
  if (!text.trim()) {
    return {
      clauses: [],
      dominantStyle: null,
      preamble: "",
      warningsFa: ["\u0645\u062A\u0646\u06CC \u0628\u0631\u0627\u06CC \u062A\u062C\u0632\u06CC\u0647 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F. \u0627\u06AF\u0631 \u0641\u0627\u06CC\u0644 PDF \u0627\u0633\u06A9\u0646\u200C\u0634\u062F\u0647 \u0627\u0633\u062A\u060C \u0646\u06CC\u0627\u0632 \u0628\u0647 OCR \u062F\u0627\u0631\u062F."]
    };
  }
  const pageBounds = buildPageIndex(text);
  const lines = text.split(/\r?\n/);
  const acc = [];
  let preambleLines = [];
  let cursor = 0;
  for (const line of lines) {
    const lineStart = cursor;
    cursor += line.length + 1;
    const head = matchHead(line);
    if (head) {
      acc.push({ head, start: lineStart, lines: head.rest ? [head.rest] : [] });
    } else if (acc.length === 0) {
      preambleLines.push(line);
    } else {
      acc[acc.length - 1].lines.push(line);
    }
  }
  if (acc.length === 0) {
    return {
      clauses: [],
      dominantStyle: null,
      preamble: text.trim(),
      warningsFa: ["\u0647\u06CC\u0686 \u0634\u0645\u0627\u0631\u0647\u0654 \u0628\u0646\u062F\u06CC \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0646\u0634\u062F. \u0627\u0644\u06AF\u0648\u06CC \u0634\u0645\u0627\u0631\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u0627\u06CC\u0646 \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0646\u0645\u06CC\u200C\u0634\u0648\u062F."]
    };
  }
  const styleCount = /* @__PURE__ */ new Map();
  for (const a of acc) styleCount.set(a.head.style, (styleCount.get(a.head.style) ?? 0) + 1);
  const dominantStyle = [...styleCount.entries()].sort((x, y) => y[1] - x[1])[0][0];
  if (styleCount.size > 2) {
    warningsFa.push(`\u0686\u0646\u062F \u0633\u0628\u06A9 \u0634\u0645\u0627\u0631\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC \u0647\u0645\u200C\u0632\u0645\u0627\u0646 \u062F\u06CC\u062F\u0647 \u0634\u062F (${styleCount.size} \u0633\u0628\u06A9). \u0645\u0631\u0632 \u0628\u0646\u062F\u0647\u0627 \u0631\u0627 \u0628\u0627\u0632\u0628\u06CC\u0646\u06CC \u06A9\u0646\u06CC\u062F.`);
  }
  const clauses = [];
  const seen = /* @__PURE__ */ new Set();
  const numberedSoFar = /* @__PURE__ */ new Set();
  let lastAny = null;
  let lastTopLevel = null;
  let lastSection = null;
  acc.forEach((a, i) => {
    const end = i + 1 < acc.length ? acc[i + 1].start : text.length;
    const body = a.lines.join("\n").trim();
    let no = a.head.no;
    if (seen.has(no)) {
      warningsFa.push(`\u0634\u0645\u0627\u0631\u0647\u0654 \u0628\u0646\u062F \xAB${no}\xBB \u0628\u06CC\u0634 \u0627\u0632 \u06CC\u06A9 \u0628\u0627\u0631 \u0622\u0645\u062F\u0647 \u0627\u0633\u062A.`);
      let n = 2;
      while (seen.has(`${no}#${n}`)) n += 1;
      no = `${no}#${n}`;
    }
    seen.add(no);
    let parent = parentOf(no);
    if (a.head.style === "note") {
      parent = lastAny;
    } else if (a.head.style === "step_code") {
      parent = lastSection;
    } else if (parent) {
      if (!numberedSoFar.has(parent) && lastTopLevel) {
        parent = lastTopLevel;
      }
    }
    if (a.head.style !== "note") {
      lastAny = no;
      if (a.head.depth === 1) lastTopLevel = no;
    }
    if (a.head.style !== "step_code" && a.head.style !== "note") lastSection = no;
    numberedSoFar.add(no);
    const depth = a.head.style === "note" ? 2 : a.head.depth;
    clauses.push({
      clauseNo: no,
      parentClauseNo: parent,
      depth,
      titleFa: guessTitle(a.lines[0] ?? ""),
      bodyText: body,
      style: a.head.style,
      charStart: a.start,
      charEnd: end,
      pageNo: pageOf(a.start, pageBounds),
      ordinal: i + 1
    });
  });
  const numbers = new Set(clauses.map((c) => c.clauseNo));
  const orphans = clauses.filter((c) => c.parentClauseNo && !numbers.has(c.parentClauseNo));
  if (orphans.length) {
    warningsFa.push(`${orphans.length} \u0628\u0646\u062F \u0648\u0627\u0644\u062F\u0650 \u062B\u0628\u062A\u200C\u0646\u0634\u062F\u0647 \u062F\u0627\u0631\u0646\u062F (\u0646\u0645\u0648\u0646\u0647: ${orphans[0].clauseNo}).`);
  }
  return {
    clauses,
    dominantStyle,
    preamble: preambleLines.join("\n").trim(),
    warningsFa
  };
}
function buildClauseTree(clauses) {
  const byNo = /* @__PURE__ */ new Map();
  for (const c of clauses) byNo.set(c.clauseNo, { ...c, children: [] });
  const roots = [];
  for (const node of byNo.values()) {
    const parent = node.parentClauseNo ? byNo.get(node.parentClauseNo) : void 0;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
function sourceRefFa(clause) {
  const page = clause.pageNo > 0 ? `\u0635 ${clause.pageNo}` : "\u0635 \u0646\u0627\u0645\u0634\u062E\u0635";
  return `${page} / \u0628\u0646\u062F ${clause.clauseNo}`;
}
export {
  CLAUSE_VERSION,
  buildClauseTree,
  buildPageIndex,
  canonicalStepCode,
  guessTitle,
  normalizeClauseNo,
  pageOf,
  parentOf,
  parseClauses,
  sourceRefFa
};
