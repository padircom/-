// src/services/claimLoss.ts
var LOSS_CATEGORIES = [
  { code: "site_running_costs", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0645\u0633\u062A\u0645\u0631 \u06A9\u0627\u0631\u06AF\u0627\u0647", en: "Site running costs" },
  { code: "overhead", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0628\u0627\u0644\u0627\u0633\u0631\u06CC \u0648 \u0633\u0631\u0628\u0627\u0631", en: "Overhead & head office" },
  { code: "payment_delay", fa: "\u062E\u0633\u0627\u0631\u0627\u062A \u062A\u0623\u062E\u06CC\u0631 \u067E\u0631\u062F\u0627\u062E\u062A \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A", en: "Late interim payment losses" },
  { code: "adjustment_delay", fa: "\u062E\u0633\u0627\u0631\u0627\u062A \u062A\u0623\u062E\u06CC\u0631 \u067E\u0631\u062F\u0627\u062E\u062A \u062A\u0639\u062F\u06CC\u0644", en: "Late adjustment payment losses" },
  { code: "change_work", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0648 \u06A9\u0627\u0631\u0647\u0627\u06CC \u062C\u062F\u06CC\u062F", en: "Variations & new works" },
  { code: "labor", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0646\u06CC\u0631\u0648\u06CC \u0627\u0646\u0633\u0627\u0646\u06CC", en: "Labour costs" },
  { code: "machinery", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A \u0648 \u062A\u062C\u0647\u06CC\u0632\u0627\u062A", en: "Plant & equipment costs" },
  { code: "suspension", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u062A\u0648\u0642\u0641 \u0648 \u062A\u0639\u0644\u06CC\u0642", en: "Suspension & stoppage" },
  { code: "remobilization", fa: "\u062A\u062C\u0647\u06CC\u0632 \u0648 \u0628\u0631\u0686\u06CC\u062F\u0646 \u0645\u062C\u062F\u062F \u06A9\u0627\u0631\u06AF\u0627\u0647", en: "Remobilisation" },
  { code: "site_access_delay", fa: "\u062A\u0623\u062E\u06CC\u0631 \u062F\u0631 \u062A\u062D\u0648\u06CC\u0644 \u062C\u0628\u0647\u0647\u0654 \u06A9\u0627\u0631", en: "Late site access" },
  { code: "approval_delay", fa: "\u062A\u0623\u062E\u06CC\u0631 \u062F\u0631 \u0627\u0631\u0627\u0626\u0647 \u0645\u062F\u0627\u0631\u06A9 \u06CC\u0627 \u062A\u0623\u06CC\u06CC\u062F\u06CC\u0647\u200C\u0647\u0627", en: "Late documents / approvals" },
  { code: "procurement_extra", fa: "\u0647\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0627\u0636\u0627\u0641\u06CC \u062A\u0623\u0645\u06CC\u0646 \u0648 \u062A\u062F\u0627\u0631\u06A9\u0627\u062A", en: "Extra procurement costs" },
  { code: "changed_conditions", fa: "\u062A\u063A\u06CC\u06CC\u0631 \u0634\u0631\u0627\u06CC\u0637 \u0627\u062C\u0631\u0627\u06CC\u06CC", en: "Changed conditions" },
  { code: "guarantee_extension", fa: "\u062A\u0645\u062F\u06CC\u062F \u0636\u0645\u0627\u0646\u062A\u200C\u0646\u0627\u0645\u0647\u200C\u0647\u0627", en: "Guarantee extension" },
  { code: "site_facilities", fa: "\u062A\u062C\u0647\u06CC\u0632 \u0648 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u06A9\u0627\u0631\u06AF\u0627\u0647", en: "Site facilities" },
  { code: "other", fa: "\u0633\u0627\u06CC\u0631 \u062E\u0633\u0627\u0631\u0627\u062A \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC", en: "Other contractual losses" }
];
var LOSS_CATEGORY_CODES = LOSS_CATEGORIES.map((c) => c.code);
var lossCategoryFa = (code) => LOSS_CATEGORIES.find((c) => c.code === String(code ?? ""))?.fa ?? "\u0633\u0627\u06CC\u0631 \u062E\u0633\u0627\u0631\u0627\u062A \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC";

// src/services/claimLossDocument.ts
var LOSS_DOC_CHAPTERS = [
  { no: 1, fa: "\u0635\u0641\u062D\u0647 \u0639\u0646\u0648\u0627\u0646", en: "Cover page" },
  { no: 2, fa: "\u0645\u0634\u062E\u0635\u0627\u062A \u067E\u0631\u0648\u0698\u0647 \u0648 \u0642\u0631\u0627\u0631\u062F\u0627\u062F", en: "Project & contract" },
  { no: 3, fa: "\u062E\u0644\u0627\u0635\u0647 \u0645\u062F\u06CC\u0631\u06CC\u062A\u06CC", en: "Executive summary" },
  { no: 4, fa: "\u0645\u0648\u0636\u0648\u0639 \u0648 \u0645\u0628\u0646\u0627\u06CC \u0627\u062F\u0639\u0627", en: "Subject & basis" },
  { no: 5, fa: "\u0634\u0631\u062D \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627\u06CC \u062E\u0633\u0627\u0631\u062A", en: "Loss events" },
  { no: 6, fa: "\u062E\u0637 \u0632\u0645\u0627\u0646\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627", en: "Timeline" },
  { no: 7, fa: "\u0645\u0628\u0627\u0646\u06CC \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC", en: "Contractual basis" },
  { no: 8, fa: "\u0631\u0648\u0634 \u0645\u062D\u0627\u0633\u0628\u0647 \u0647\u0631 \u062F\u0633\u062A\u0647 \u062E\u0633\u0627\u0631\u062A", en: "Method per category" },
  { no: 9, fa: "\u062C\u062F\u0627\u0648\u0644 \u062A\u0641\u0635\u06CC\u0644\u06CC \u0645\u062D\u0627\u0633\u0628\u0627\u062A", en: "Detailed calculations" },
  { no: 10, fa: "\u0627\u0633\u0646\u0627\u062F \u0648 \u0634\u0648\u0627\u0647\u062F \u067E\u0634\u062A\u06CC\u0628\u0627\u0646", en: "Evidence" },
  { no: 11, fa: "\u0627\u0631\u062A\u0628\u0627\u0637 \u062E\u0633\u0627\u0631\u062A \u0628\u0627 \u062A\u0623\u062E\u06CC\u0631\u0627\u062A", en: "Link to delays" },
  { no: 12, fa: "\u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u0635\u0648\u0631\u062A\u200C\u0648\u0636\u0639\u06CC\u062A\u200C\u0647\u0627", en: "Statement calculations" },
  { no: 13, fa: "\u06A9\u0646\u062A\u0631\u0644 \u0647\u0645\u200C\u067E\u0648\u0634\u0627\u0646\u06CC \u0648 \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u0645\u0637\u0627\u0644\u0628\u0647 \u062A\u06A9\u0631\u0627\u0631\u06CC", en: "Overlap control" },
  { no: 14, fa: "\u062C\u0645\u0639\u200C\u0628\u0646\u062F\u06CC \u0645\u0628\u0627\u0644\u063A", en: "Amounts summary" },
  { no: 15, fa: "\u0645\u062D\u062F\u0648\u062F\u06CC\u062A\u200C\u0647\u0627 \u0648 \u0641\u0631\u0636\u06CC\u0627\u062A", en: "Limitations & assumptions" },
  { no: 16, fa: "\u0645\u0628\u0644\u063A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0645\u0637\u0627\u0644\u0628\u0647", en: "Proposed amount" },
  { no: 17, fa: "\u0646\u062A\u06CC\u062C\u0647 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC", en: "Expert review" },
  { no: 18, fa: "\u0641\u0647\u0631\u0633\u062A \u067E\u06CC\u0648\u0633\u062A\u200C\u0647\u0627", en: "Annexes" }
];
var LOSS_DOC_TABLES = [
  { no: 1, chapter: 1, fa: "\u0645\u0634\u062E\u0635\u0627\u062A \u0633\u0646\u062F", dataset: "docMeta" },
  { no: 2, chapter: 1, fa: "\u0645\u0634\u062E\u0635\u0627\u062A \u067E\u0631\u0648\u0646\u062F\u0647", dataset: "claim" },
  { no: 3, chapter: 2, fa: "\u067E\u0631\u0648\u0698\u0647 \u0648 \u0642\u0631\u0627\u0631\u062F\u0627\u062F", dataset: "project" },
  { no: 4, chapter: 2, fa: "\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u0648\u0646\u062F\u0647 \u0648 \u0637\u0631\u0641\u06CC\u0646", dataset: "caseStatus" },
  { no: 5, chapter: 2, fa: "\u0627\u0633\u0646\u0627\u062F \u0645\u0628\u0646\u0627\u06CC \u067E\u0631\u0648\u0646\u062F\u0647", dataset: "basisDocs" },
  { no: 6, chapter: 3, fa: "\u062E\u0644\u0627\u0635\u0647\u0654 \u0645\u0628\u0627\u0644\u063A", dataset: "amounts" },
  { no: 7, chapter: 3, fa: "\u0634\u0627\u062E\u0635\u200C\u0647\u0627\u06CC \u067E\u0631\u0648\u0646\u062F\u0647", dataset: "caseIndex" },
  { no: 8, chapter: 3, fa: "\u0648\u0636\u0639\u06CC\u062A \u0622\u0645\u0627\u062F\u0647\u200C\u0633\u0627\u0632\u06CC \u0644\u0627\u06CC\u062D\u0647", dataset: "readiness" },
  { no: 9, chapter: 4, fa: "\u0645\u0648\u0636\u0648\u0639 \u0627\u062F\u0639\u0627", dataset: "subject" },
  { no: 10, chapter: 4, fa: "\u0645\u0628\u0646\u0627\u06CC \u0627\u0633\u062A\u062D\u0642\u0627\u0642", dataset: "entitlement" },
  { no: 11, chapter: 4, fa: "\u0631\u0627\u0628\u0637\u0647\u0654 \u0633\u0628\u0628\u06CC\u062A", dataset: "causation" },
  { no: 12, chapter: 5, fa: "\u0641\u0647\u0631\u0633\u062A \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627\u06CC \u062E\u0633\u0627\u0631\u062A", dataset: "events" },
  { no: 13, chapter: 5, fa: "\u0634\u0631\u062D \u0648\u0642\u0627\u06CC\u0639 \u0648 \u0639\u0644\u062A \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC", dataset: "eventsDetail" },
  { no: 14, chapter: 5, fa: "\u0637\u0628\u0642\u0647\u200C\u0628\u0646\u062F\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627", dataset: "eventClasses" },
  { no: 15, chapter: 6, fa: "\u062E\u0637 \u0632\u0645\u0627\u0646\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627", dataset: "timeline" },
  { no: 16, chapter: 6, fa: "\u062E\u0637 \u0632\u0645\u0627\u0646\u06CC \u0627\u0642\u0644\u0627\u0645 \u062E\u0633\u0627\u0631\u062A", dataset: "itemTimeline" },
  { no: 17, chapter: 7, fa: "\u0628\u0646\u062F\u0647\u0627\u06CC \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC \u0645\u0648\u0631\u062F \u0627\u0633\u062A\u0646\u0627\u062F", dataset: "clauses" },
  { no: 18, chapter: 7, fa: "\u0642\u0648\u0627\u0639\u062F \u0648 \u0645\u0646\u0627\u0628\u0639 \u0645\u062D\u0627\u0633\u0628\u0627\u062A\u06CC", dataset: "rules" },
  { no: 19, chapter: 7, fa: "\u0634\u0631\u0627\u06CC\u0637 \u0634\u0645\u0648\u0644 \u0648 \u0627\u0633\u062A\u062B\u0646\u0627\u0647\u0627", dataset: "ruleScope" },
  { no: 20, chapter: 8, fa: "\u062F\u0633\u062A\u0647\u200C\u0647\u0627\u06CC \u062E\u0633\u0627\u0631\u062A \u0648 \u0631\u0648\u0634 \u0645\u062D\u0627\u0633\u0628\u0647", dataset: "categories" },
  { no: 21, chapter: 8, fa: "\u0641\u0631\u0645\u0648\u0644 \u0642\u0648\u0627\u0639\u062F", dataset: "formulas" },
  { no: 22, chapter: 8, fa: "\u0646\u0633\u062E\u0647 \u0648 \u0627\u0639\u062A\u0628\u0627\u0631 \u0642\u0648\u0627\u0639\u062F", dataset: "ruleVersions" },
  { no: 23, chapter: 9, fa: "\u0631\u06CC\u0632 \u0627\u0642\u0644\u0627\u0645 \u062E\u0633\u0627\u0631\u062A", dataset: "items" },
  { no: 24, chapter: 9, fa: "\u0627\u062C\u0631\u0627\u0647\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647", dataset: "runs" },
  { no: 25, chapter: 9, fa: "\u0648\u0631\u0648\u062F\u06CC\u200C\u0647\u0627\u06CC \u0627\u062C\u0631\u0627\u0647\u0627", dataset: "runInputs" },
  { no: 26, chapter: 9, fa: "\u0627\u0635\u0644\u0627\u062D\u0627\u062A \u062F\u0633\u062A\u06CC \u0648 \u0633\u0648\u0627\u0628\u0642 \u0622\u0646", dataset: "adjustments" },
  { no: 27, chapter: 9, fa: "\u0645\u0646\u0627\u0628\u0639 \u0646\u06CC\u0631\u0648\u06CC \u0627\u0646\u0633\u0627\u0646\u06CC \u0648 \u0645\u0627\u0634\u06CC\u0646\u200C\u0622\u0644\u0627\u062A", dataset: "resources" },
  { no: 28, chapter: 10, fa: "\u0641\u0647\u0631\u0633\u062A \u0627\u0633\u0646\u0627\u062F \u067E\u0634\u062A\u06CC\u0628\u0627\u0646", dataset: "docs" },
  { no: 29, chapter: 10, fa: "\u0627\u0633\u0646\u0627\u062F \u0628\u0647 \u062A\u0641\u06A9\u06CC\u06A9 \u0642\u0644\u0645", dataset: "docsByItem" },
  { no: 30, chapter: 10, fa: "\u0645\u062F\u0627\u0631\u06A9 \u0646\u0627\u0642\u0635", dataset: "missingDocs" },
  { no: 31, chapter: 11, fa: "\u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627\u06CC \u062A\u0623\u062E\u06CC\u0631 \u067E\u06CC\u0648\u0646\u062F\u0634\u062F\u0647", dataset: "linkedEvents" },
  { no: 32, chapter: 11, fa: "\u0627\u062B\u0631 \u0628\u0631 \u062A\u0627\u0631\u06CC\u062E \u0627\u062A\u0645\u0627\u0645", dataset: "completionImpact" },
  { no: 33, chapter: 11, fa: "\u0647\u0645\u200C\u067E\u0648\u0634\u0627\u0646\u06CC \u062F\u0648\u0631\u0647\u200C\u0627\u06CC \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627", dataset: "overlapsPeriod" },
  { no: 34, chapter: 12, fa: "\u0646\u062A\u0627\u06CC\u062C \u062A\u0623\u062E\u06CC\u0631 \u067E\u0631\u062F\u0627\u062E\u062A (\u0632\u0645\u0627\u0646\u06CC)", dataset: "paymentCalcs" },
  { no: 35, chapter: 12, fa: "\u0642\u0648\u0627\u0639\u062F \u0645\u0627\u0644\u06CC \u0648 \u0646\u0631\u062E\u200C\u0647\u0627\u06CC \u0645\u0633\u062A\u0646\u062F", dataset: "financialRules" },
  { no: 36, chapter: 12, fa: "\u062A\u0641\u06A9\u06CC\u06A9 \u0645\u062F\u062A \u062A\u0623\u062E\u06CC\u0631 \u0648 \u0645\u0628\u0644\u063A \u062E\u0633\u0627\u0631\u062A", dataset: "dayVsMoney" },
  { no: 37, chapter: 13, fa: "\u0647\u0634\u062F\u0627\u0631\u0647\u0627\u06CC \u0647\u0645\u200C\u067E\u0648\u0634\u0627\u0646\u06CC", dataset: "overlapWarnings" },
  { no: 38, chapter: 13, fa: "\u062A\u062E\u0635\u06CC\u0635 \u0647\u0632\u06CC\u0646\u0647 \u0645\u06CC\u0627\u0646 \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627", dataset: "allocations" },
  { no: 39, chapter: 13, fa: "\u06A9\u0646\u062A\u0631\u0644 \u0633\u0642\u0641 \u062A\u062E\u0635\u06CC\u0635 \u06F1\u06F0\u06F0\u066A", dataset: "allocControl" },
  { no: 40, chapter: 14, fa: "\u062A\u0641\u06A9\u06CC\u06A9 \u0645\u0628\u0627\u0644\u063A \u067E\u0631\u0648\u0646\u062F\u0647", dataset: "amounts" },
  { no: 41, chapter: 14, fa: "\u062C\u0645\u0639 \u0645\u0628\u0627\u0644\u063A \u0628\u0647 \u062A\u0641\u06A9\u06CC\u06A9 \u062F\u0633\u062A\u0647", dataset: "amountsByCategory" },
  { no: 42, chapter: 14, fa: "\u062C\u0645\u0639 \u0645\u0628\u0627\u0644\u063A \u0628\u0647 \u062A\u0641\u06A9\u06CC\u06A9 \u0631\u0648\u06CC\u062F\u0627\u062F", dataset: "amountsByEvent" },
  { no: 43, chapter: 15, fa: "\u0641\u0631\u0636\u06CC\u0627\u062A \u0645\u062D\u0627\u0633\u0628\u0627\u062A", dataset: "assumptions" },
  { no: 44, chapter: 15, fa: "\u0645\u062D\u062F\u0648\u062F\u06CC\u062A\u200C\u0647\u0627", dataset: "limitations" },
  { no: 45, chapter: 16, fa: "\u0645\u0628\u0644\u063A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0645\u0637\u0627\u0644\u0628\u0647", dataset: "proposed" },
  { no: 46, chapter: 16, fa: "\u0645\u0628\u0646\u0627\u06CC \u0645\u0628\u0644\u063A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC", dataset: "proposedBasis" },
  { no: 47, chapter: 17, fa: "\u0648\u0636\u0639\u06CC\u062A \u0628\u0631\u0631\u0633\u06CC \u0627\u0642\u0644\u0627\u0645", dataset: "reviewStatus" },
  { no: 48, chapter: 17, fa: "\u0642\u0648\u0627\u0639\u062F \u062A\u0623\u06CC\u06CC\u062F\u0646\u0634\u062F\u0647 \u0648 \u0627\u0642\u0644\u0627\u0645 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC", dataset: "unapprovedRules" },
  { no: 49, chapter: 17, fa: "\u062A\u0635\u0645\u06CC\u0645\u200C\u0647\u0627\u06CC \u0644\u0627\u0632\u0645", dataset: "decisions" },
  { no: 50, chapter: 18, fa: "\u067E\u06CC\u0648\u0633\u062A\u200C\u0647\u0627\u06CC \u0627\u0633\u0646\u0627\u062F\u06CC", dataset: "annexDocs" },
  { no: 51, chapter: 18, fa: "\u0633\u0648\u0627\u0628\u0642 \u0646\u0633\u062E\u0647\u200C\u0647\u0627\u06CC \u0644\u0627\u06CC\u062D\u0647", dataset: "docVersions" }
];
var LOSS_DOC_TEMPLATE = { chapters: LOSS_DOC_CHAPTERS, tables: LOSS_DOC_TABLES };
function sanitizeLossDocumentHtml(html) {
  return html.replace(/<div class="internal-guide"[\s\S]*?<\/div>/g, "").replace(/<section[^>]*data-internal="true"[\s\S]*?<\/section>/g, "").replace(/<p[^>]*>[^<]*(?:راهنمای داخلی|Internal guide)[^<]*<\/p>/g, "").replace(/\s*[\[(【](الزامی|اختیاری|Required|Optional)[\])】]/g, "").replace(/background(?:-color)?\s*:\s*(?:#ff0(?:000)?|#ffff00|yellow)\s*;?/gi, "").replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, "$1").replace(/\sclass="hl"/g, "");
}
var esc = (v) => String(v ?? "\u2014").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var faNum = (v) => {
  const n = Number(v);
  if (v === null || v === void 0 || v === "" || !Number.isFinite(n)) return "\u2014";
  return n.toLocaleString("fa-IR", { maximumFractionDigits: 2 });
};
var faDate = (v) => {
  const s = String(v ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "\u2014";
  try {
    return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date(s + "T00:00:00"));
  } catch {
    return s;
  }
};
var table = (heads, rows) => `<table><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${heads.length}">\u2014</td></tr>`}</tbody></table>`;
function buildClaimLossDocument(input) {
  const issues = [];
  const claim = input.claim;
  if (!claim?.Code) issues.push("\u0627\u062F\u0639\u0627\u06CC \u0645\u0639\u062A\u0628\u0631 \u0628\u0631\u0627\u06CC \u062A\u0647\u06CC\u0647\u0654 \u0644\u0627\u06CC\u062D\u0647 \u0627\u0646\u062A\u062E\u0627\u0628 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A");
  if (!input.costItems.length) issues.push("\u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u067E\u0631\u0648\u0646\u062F\u0647 \u0647\u06CC\u0686 \u0642\u0644\u0645 \u062E\u0633\u0627\u0631\u062A\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0644\u0627\u06CC\u062D\u0647 \u0628\u062F\u0648\u0646 \u062C\u062F\u0648\u0644 \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0635\u0627\u062F\u0631 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F");
  const caseAmounts = input.lossSummary?.cases.find((c) => c.claimCode === String(claim?.Code ?? ""));
  const latestRunByItem = /* @__PURE__ */ new Map();
  for (const run of [...input.runs].sort((a, b) => String(a.CalculatedAt ?? "").localeCompare(String(b.CalculatedAt ?? "")))) latestRunByItem.set(String(run.ClaimCostItemId), run);
  const eventById = new Map(input.delayEvents.map((e) => [String(e.Id), e]));
  const docLabel = (id) => {
    const d = input.documentById.get(String(id));
    return d ? `${esc(d.DocNo)}@${esc(d.Revision)}` : esc(id);
  };
  const itemDocs = (item) => Array.isArray(item.DocumentRefs) ? item.DocumentRefs : [];
  const calcOf = (item) => {
    const run = latestRunByItem.get(String(item.Id));
    return run && run.FinalAmount !== null && run.FinalAmount !== void 0 ? faNum(run.FinalAmount) : "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC";
  };
  const D = {
    docMeta: { heads: ["\u0645\u0648\u0631\u062F", "\u0645\u0642\u062F\u0627\u0631"], rows: [["\u0639\u0646\u0648\u0627\u0646 \u0633\u0646\u062F", "\u0644\u0627\u06CC\u062D\u0647\u0654 \u0636\u0631\u0631 \u0648 \u0632\u06CC\u0627\u0646 \u067E\u06CC\u0645\u0627\u0646"], ["\u0648\u0636\u0639\u06CC\u062A \u0633\u0646\u062F", "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633 \u2014 \u062A\u0627 \u062A\u0623\u06CC\u06CC\u062F \u0645\u0633\u0626\u0648\u0644 \u0645\u0631\u0628\u0648\u0637 \u0633\u0646\u062F \u0646\u0647\u0627\u06CC\u06CC \u0646\u06CC\u0633\u062A"], ["\u0646\u0633\u062E\u0647\u0654 \u0644\u0627\u06CC\u062D\u0647", faNum(input.version)], ["\u062A\u0627\u0631\u06CC\u062E \u062A\u0648\u0644\u06CC\u062F", faDate(input.generatedAt)], ["\u062A\u0648\u0644\u06CC\u062F\u06A9\u0646\u0646\u062F\u0647", esc(input.generatedBy ?? "\u2014")]] },
    claim: { heads: ["\u0645\u0648\u0631\u062F", "\u0645\u0642\u062F\u0627\u0631"], rows: [["\u06A9\u062F \u067E\u0631\u0648\u0646\u062F\u0647", esc(claim.Code)], ["\u0639\u0646\u0648\u0627\u0646", esc(claim.TitleFa)], ["\u0648\u0636\u0639\u06CC\u062A \u067E\u0631\u0648\u0646\u062F\u0647", esc(claim.Status)], ["\u062A\u0627\u0631\u06CC\u062E \u0631\u0648\u06CC\u062F\u0627\u062F", faDate(claim.EventDate)], ["\u0628\u0646\u062F \u0642\u0631\u0627\u0631\u062F\u0627\u062F\u06CC", esc(claim.Clause)]] },
    project: { heads: ["\u0645\u0648\u0631\u062F", "\u0645\u0642\u062F\u0627\u0631"], rows: [["\u067E\u0631\u0648\u0698\u0647", esc(input.projectId)], ["\u06A9\u062F \u0627\u062F\u0639\u0627", esc(claim.Code)], ["\u0645\u0631\u062C\u0639 \u0645\u0633\u062A\u0646\u062F\u0627\u062A \u067E\u0631\u0648\u0646\u062F\u0647", esc(claim.EvidenceRef ?? "\u2014")]] },
    caseStatus: { heads: ["\u0634\u0627\u062E\u0635", "\u0645\u0642\u062F\u0627\u0631"], rows: [["\u0648\u0636\u0639\u06CC\u062A", esc(claim.Status)], ["\u062A\u0639\u062F\u0627\u062F \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627\u06CC \u067E\u06CC\u0648\u0646\u062F\u0634\u062F\u0647", faNum(input.delayEvents.length)], ["\u062A\u0639\u062F\u0627\u062F \u0627\u0642\u0644\u0627\u0645 \u062E\u0633\u0627\u0631\u062A", faNum(input.costItems.length)], ["\u062A\u0639\u062F\u0627\u062F \u0627\u062C\u0631\u0627\u0647\u0627\u06CC \u0645\u062D\u0627\u0633\u0628\u0647", faNum(input.runs.length)]] },
    basisDocs: { heads: ["#", "\u0633\u0646\u062F", "\u0646\u0633\u062E\u0647", "\u0639\u0646\u0648\u0627\u0646", "\u0648\u0636\u0639\u06CC\u062A"], rows: [...input.documentById.values()].slice(0, 200).map((d, i) => [String(i + 1), esc(d.DocNo), esc(d.Revision), esc(d.TitleFa), esc(d.Status)]) },
    amounts: { heads: ["\u0645\u0628\u0644\u063A", "\u0645\u0642\u062F\u0627\u0631"], rows: caseAmounts ? [["\u0628\u0631\u0622\u0648\u0631\u062F \u0627\u0648\u0644\u06CC\u0647", faNum(caseAmounts.estimated)], ["\u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647", faNum(caseAmounts.calculated)], ["\u0645\u0633\u062A\u0646\u062F\u0634\u062F\u0647", faNum(caseAmounts.documented)], ["\u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0645\u0637\u0627\u0644\u0628\u0647", faNum(caseAmounts.proposed)], ["\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u0654 \u062F\u0627\u062E\u0644\u06CC", faNum(caseAmounts.approvedInternal)], ["\u067E\u0630\u06CC\u0631\u0641\u062A\u0647\u200C\u0634\u062F\u0647\u0654 \u0637\u0631\u0641 \u0645\u0642\u0627\u0628\u0644", faNum(caseAmounts.accepted)], ["\u0646\u0647\u0627\u06CC\u06CC \u062A\u0639\u06CC\u06CC\u0646\u200C\u0634\u062F\u0647", faNum(caseAmounts.finalDetermined)]] : [] },
    caseIndex: { heads: ["\u0634\u0627\u062E\u0635", "\u062A\u0639\u062F\u0627\u062F"], rows: [["\u0627\u0642\u0644\u0627\u0645 \u062E\u0633\u0627\u0631\u062A", faNum(caseAmounts?.itemsCount)], ["\u0627\u0642\u0644\u0627\u0645 \u0628\u062F\u0648\u0646 \u0633\u0646\u062F", faNum(caseAmounts?.itemsWithoutDocs)], ["\u0627\u0642\u0644\u0627\u0645 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC", faNum(caseAmounts?.itemsNeedingReview)], ["\u0622\u0645\u0627\u062F\u0647\u0654 \u062A\u0647\u06CC\u0647\u0654 \u0644\u0627\u06CC\u062D\u0647", caseAmounts?.readyForDocument ? "\u0628\u0644\u0647" : "\u062E\u06CC\u0631"]] },
    readiness: { heads: ["\u06A9\u0646\u062A\u0631\u0644", "\u0648\u0636\u0639\u06CC\u062A"], rows: [["\u0642\u0644\u0645 \u062E\u0633\u0627\u0631\u062A \u062B\u0628\u062A \u0634\u062F\u0647", input.costItems.length ? "\u0628\u0644\u0647" : "\u062E\u06CC\u0631"], ["\u0647\u0645\u0647\u0654 \u0627\u0642\u0644\u0627\u0645 \u0645\u062D\u0627\u0633\u0628\u0647\u0654 \u0646\u0647\u0627\u06CC\u06CC \u062F\u0627\u0631\u0646\u062F", caseAmounts && caseAmounts.itemsNeedingReview === 0 ? "\u0628\u0644\u0647" : "\u062E\u06CC\u0631"], ["\u0648\u0636\u0639\u06CC\u062A \u0633\u0646\u062F", "\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633"]] },
    subject: { heads: ["\u0645\u0648\u0631\u062F", "\u0634\u0631\u062D"], rows: [["\u0639\u0646\u0648\u0627\u0646 \u067E\u0631\u0648\u0646\u062F\u0647", esc(claim.TitleFa)], ["\u0645\u0648\u0636\u0648\u0639", esc(claim.Entitlement ?? "\u2014")]] },
    entitlement: { heads: ["\u0645\u0628\u0646\u0627\u06CC \u0627\u0633\u062A\u062D\u0642\u0627\u0642"], rows: [[esc(claim.Entitlement ?? "\u2014")]] },
    causation: { heads: ["\u0631\u0627\u0628\u0637\u0647\u0654 \u0633\u0628\u0628\u06CC\u062A"], rows: [[esc(claim.Causation ?? "\u2014")]] },
    events: { heads: ["#", "\u06A9\u062F", "\u0639\u0646\u0648\u0627\u0646", "\u0634\u0631\u0648\u0639", "\u067E\u0627\u06CC\u0627\u0646", "\u0648\u0636\u0639\u06CC\u062A"], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), esc(e.TitleFa), faDate(e.StartDate), faDate(e.FinishDate), esc(e.Status)]) },
    eventsDetail: { heads: ["#", "\u06A9\u062F", "\u0639\u0644\u062A \u0631\u06CC\u0634\u0647\u200C\u0627\u06CC", "\u0628\u0646\u062F"], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), esc(e.RootCauseFa ?? "\u2014"), esc(e.ClauseRef ?? "\u2014")]) },
    eventClasses: { heads: ["#", "\u06A9\u062F", "\u0637\u0628\u0642\u0647\u200C\u0628\u0646\u062F\u06CC", "\u0637\u0631\u0641 \u0627\u06CC\u062C\u0627\u062F\u06A9\u0646\u0646\u062F\u0647", "\u0628\u062D\u0631\u0627\u0646\u06CC"], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), esc(e.Category), esc(e.SourceParty ?? "\u2014"), e.IsCritical ? "\u0628\u0644\u0647" : "\u062E\u06CC\u0631"]) },
    timeline: { heads: ["#", "\u0631\u0648\u06CC\u062F\u0627\u062F", "\u0627\u0632", "\u062A\u0627"], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code) + " \u2014 " + esc(e.TitleFa), faDate(e.StartDate), faDate(e.FinishDate)]) },
    itemTimeline: { heads: ["#", "\u0642\u0644\u0645", "\u0627\u0632", "\u062A\u0627"], rows: input.costItems.map((item, i) => [String(i + 1), esc(item.TitleFa), faDate(item.PeriodFrom), faDate(item.PeriodTo)]) },
    clauses: { heads: ["\u0628\u0646\u062F", "\u0645\u0631\u062C\u0639"], rows: [[esc(claim.Clause ?? "\u2014"), esc(claim.EvidenceRef ?? "\u2014")], ...input.delayEvents.map((e) => [esc(e.ClauseRef ?? "\u2014"), esc(e.Code)])] },
    rules: { heads: ["\u06A9\u062F", "\u0646\u0627\u0645", "\u062F\u0633\u062A\u0647", "\u0645\u0646\u0628\u0639", "\u0648\u0636\u0639\u06CC\u062A"], rows: input.rules.map((r) => [esc(r.Code), esc(r.NameFa), esc(lossCategoryFa(r.Category)), esc(r.SourceFa ?? "\u2014"), esc(r.Status)]) },
    ruleScope: { heads: ["\u06A9\u062F \u0642\u0627\u0639\u062F\u0647", "\u0634\u0631\u062D \u0641\u0631\u0645\u0648\u0644", "\u0634\u0631\u0627\u06CC\u0637 \u0634\u0645\u0648\u0644"], rows: input.rules.map((r) => [esc(r.Code), esc(r.FormulaFa ?? "\u2014"), r.Status === "approved" ? "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0648 \u0642\u0627\u0628\u0644 \u0627\u0639\u0645\u0627\u0644" : "\u062A\u0623\u06CC\u06CC\u062F\u0646\u0634\u062F\u0647\u061B \u0645\u0628\u0646\u0627\u06CC \u0642\u0637\u0639\u06CC \u0646\u06CC\u0633\u062A"]) },
    categories: { heads: ["\u062F\u0633\u062A\u0647", "\u062A\u0639\u062F\u0627\u062F \u0627\u0642\u0644\u0627\u0645", "\u0631\u0648\u0634"], rows: [...new Set(input.costItems.map((i) => String(i.LossCategory ?? i.CostType)))].map((code) => [esc(lossCategoryFa(code)), faNum(input.costItems.filter((i) => String(i.LossCategory ?? i.CostType) === code).length), "\u0637\u0628\u0642 \u0642\u0627\u0639\u062F\u0647\u0654 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u0654 \u062C\u062F\u0648\u0644 \u0641\u0631\u0645\u0648\u0644\u200C\u0647\u0627"]) },
    formulas: { heads: ["\u06A9\u062F \u0642\u0627\u0639\u062F\u0647", "\u0646\u0648\u0639 \u0641\u0631\u0645\u0648\u0644", "\u0634\u0631\u062D"], rows: input.rules.map((r) => [esc(r.Code), esc(r.Kind), esc(r.FormulaFa ?? "\u2014")]) },
    ruleVersions: { heads: ["\u06A9\u062F", "\u0646\u0633\u062E\u0647", "\u0627\u0639\u062A\u0628\u0627\u0631 \u0627\u0632", "\u062A\u0623\u06CC\u06CC\u062F\u06A9\u0646\u0646\u062F\u0647"], rows: input.rules.map((r) => [esc(r.Code), esc(r.Version ?? "1.0"), faDate(r.EffectiveFrom), esc(r.ApprovedBy ?? "\u2014")]) },
    items: { heads: ["#", "\u0642\u0644\u0645", "\u062F\u0633\u062A\u0647", "\u0645\u0627\u0647\u06CC\u062A", "\u062F\u0648\u0631\u0647", "\u062B\u0628\u062A\u200C\u0634\u062F\u0647", "\u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647", "\u0645\u0633\u062A\u0646\u062F", "\u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647", "\u0627\u0633\u0646\u0627\u062F"], rows: input.costItems.map((item, i) => [String(i + 1), esc(item.TitleFa), esc(lossCategoryFa(item.LossCategory ?? item.CostType)), esc(item.CostNature === "direct" ? "\u0645\u0633\u062A\u0642\u06CC\u0645" : item.CostNature === "indirect" ? "\u063A\u06CC\u0631\u0645\u0633\u062A\u0642\u06CC\u0645" : "\u2014"), faDate(item.PeriodFrom) + " \u062A\u0627 " + faDate(item.PeriodTo), faNum(item.Amount), calcOf(item), faNum(item.DocumentedAmount), faNum(item.ApprovedAmount), itemDocs(item).map(docLabel).join("\u060C ") || "\u2014"]) },
    runs: { heads: ["#", "\u0642\u0644\u0645", "\u0642\u0627\u0639\u062F\u0647 \u0648 \u0646\u0633\u062E\u0647", "\u0648\u0636\u0639\u06CC\u062A", "\u062E\u0627\u0645", "\u0646\u0647\u0627\u06CC\u06CC", "\u0645\u062D\u0627\u0633\u0628\u0647\u200C\u06A9\u0646\u0646\u062F\u0647"], rows: input.costItems.map((item, i) => {
      const run = latestRunByItem.get(String(item.Id));
      return run ? [String(i + 1), esc(item.TitleFa), esc(run.RuleCode ?? "\u2014") + " v" + esc(run.RuleVersion ?? "\u2014"), run.Status === "calculated" ? "\u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647" : "\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC", faNum(run.RawAmount), faNum(run.FinalAmount), esc(run.CalculatedBy ?? "\u2014")] : [String(i + 1), esc(item.TitleFa), "\u2014", "\u0627\u062C\u0631\u0627 \u0646\u0634\u062F\u0647", "\u2014", "\u2014", "\u2014"];
    }) },
    runInputs: { heads: ["#", "\u0642\u0644\u0645", "\u0648\u0631\u0648\u062F\u06CC\u200C\u0647\u0627\u06CC \u062B\u0628\u062A\u200C\u0634\u062F\u0647"], rows: input.costItems.map((item, i) => {
      const run = latestRunByItem.get(String(item.Id));
      let inputs = "\u2014";
      try {
        inputs = esc(typeof run?.Inputs === "string" ? run.Inputs : JSON.stringify(run?.Inputs ?? "\u2014"));
      } catch {
        inputs = "\u2014";
      }
      return [String(i + 1), esc(item.TitleFa), inputs];
    }) },
    adjustments: { heads: ["#", "\u0642\u0644\u0645", "\u0627\u0635\u0644\u0627\u062D \u062F\u0633\u062A\u06CC", "\u062F\u0644\u06CC\u0644", "\u06A9\u0627\u0631\u0628\u0631"], rows: input.costItems.map((item, i) => {
      const run = latestRunByItem.get(String(item.Id));
      return [String(i + 1), esc(item.TitleFa), faNum(run?.ManualAdjustment), esc(run?.ManualReason ?? "\u2014"), esc(run?.CalculatedBy ?? "\u2014")];
    }) },
    resources: { heads: ["#", "\u0642\u0644\u0645", "\u0646\u0648\u0639 \u0645\u0646\u0628\u0639", "\u0646\u0627\u0645 \u0645\u0646\u0628\u0639", "\u06A9\u0627\u0631\u06A9\u0631\u062F", "\u062A\u0648\u0642\u0641", "\u0645\u0642\u062F\u0627\u0631 \xD7 \u0646\u0631\u062E"], rows: input.costItems.map((item, i) => [String(i + 1), esc(item.TitleFa), esc(item.ResourceKind ?? "\u2014"), esc(item.ResourceNameFa ?? "\u2014"), faNum(item.WorkedUnits), faNum(item.IdleUnits), faNum(item.Quantity) + " \xD7 " + faNum(item.Rate) + (item.UnitFa ? " (" + esc(item.UnitFa) + ")" : "")]) },
    docs: { heads: ["\u067E\u06CC\u0648\u0633\u062A", "\u0634\u0645\u0627\u0631\u0647", "\u0646\u0633\u062E\u0647", "\u0639\u0646\u0648\u0627\u0646", "\u0648\u0636\u0639\u06CC\u062A", "\u0642\u0644\u0645 \u0645\u0631\u062A\u0628\u0637"], rows: input.costItems.flatMap((item) => itemDocs(item).map((id) => {
      const d = input.documentById.get(String(id));
      return [esc(d?.DocNo ?? id), esc(d?.Revision ?? "\u2014"), esc(d?.TitleFa ?? "\u2014"), esc(d?.Status ?? "\u2014"), esc(item.TitleFa)];
    })).map((r, i) => [String(i + 1), ...r]) },
    docsByItem: { heads: ["#", "\u0642\u0644\u0645", "\u062A\u0639\u062F\u0627\u062F \u0627\u0633\u0646\u0627\u062F", "\u0627\u0633\u0646\u0627\u062F"], rows: input.costItems.map((item, i) => [String(i + 1), esc(item.TitleFa), faNum(itemDocs(item).length), itemDocs(item).map(docLabel).join("\u060C ") || "\u2014"]) },
    missingDocs: { heads: ["#", "\u0642\u0644\u0645 \u0641\u0627\u0642\u062F \u0633\u0646\u062F", "\u0645\u0628\u0644\u063A \u062B\u0628\u062A\u200C\u0634\u062F\u0647"], rows: input.costItems.filter((item) => !itemDocs(item).length).map((item, i) => [String(i + 1), esc(item.TitleFa), faNum(item.Amount)]) },
    linkedEvents: { heads: ["#", "\u0631\u0648\u06CC\u062F\u0627\u062F", "\u0627\u062F\u0639\u0627\u06CC \u0645\u0631\u062A\u0628\u0637", "\u0648\u0636\u0639\u06CC\u062A \u0628\u0631\u0631\u0633\u06CC"], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code) + " \u2014 " + esc(e.TitleFa), esc(e.ClaimCode ?? "\u2014"), esc(e.Status)]) },
    completionImpact: { heads: ["#", "\u0631\u0648\u06CC\u062F\u0627\u062F", "\u0627\u062B\u0631 \u0628\u0631 \u0627\u062A\u0645\u0627\u0645 (\u0631\u0648\u0632)", "\u0628\u0631\u0622\u0648\u0631\u062F \u062A\u0623\u062E\u06CC\u0631 (\u0631\u0648\u0632)"], rows: input.delayEvents.map((e, i) => [String(i + 1), esc(e.Code), faNum(e.CompletionImpactDays), faNum(e.EstimatedDelayDays)]) },
    overlapsPeriod: { heads: ["#", "\u0647\u0634\u062F\u0627\u0631 \u062F\u0648\u0631\u0647\u200C\u0627\u06CC"], rows: input.overlapWarnings.filter((w) => w.kind === "duplicate_amount_period" || w.kind === "overhead_overlap").map((w, i) => [String(i + 1), esc(w.messageFa)]) },
    paymentCalcs: { heads: ["#", "\u0642\u0644\u0645 \u0645\u0631\u062A\u0628\u0637 \u0628\u0627 \u067E\u0631\u062F\u0627\u062E\u062A", "\u0627\u062C\u0631\u0627", "\u0648\u0636\u0639\u06CC\u062A", "\u0645\u0628\u0644\u063A"], rows: input.costItems.filter((item) => ["payment_delay", "adjustment_delay"].includes(String(item.LossCategory ?? item.CostType))).map((item, i) => {
      const run = latestRunByItem.get(String(item.Id));
      return [String(i + 1), esc(item.TitleFa), esc(run?.RuleCode ?? "\u2014"), esc(run?.Status ?? "\u2014"), faNum(run?.FinalAmount)];
    }) },
    financialRules: { heads: ["\u06A9\u062F \u0642\u0627\u0639\u062F\u0647", "\u0646\u0648\u0639", "\u0645\u0646\u0628\u0639", "\u0648\u0636\u0639\u06CC\u062A"], rows: input.rules.filter((r) => String(r.Kind) === "daily_rate_days" || ["payment_delay", "adjustment_delay"].includes(String(r.Category))).map((r) => [esc(r.Code), esc(r.Kind), esc(r.SourceFa ?? "\u2014"), esc(r.Status)]) },
    dayVsMoney: { heads: ["\u0627\u0635\u0644 \u06A9\u0646\u062A\u0631\u0644", "\u062A\u0648\u0636\u06CC\u062D"], rows: [["\u0645\u062F\u062A \u062A\u0623\u062E\u06CC\u0631 (\u0631\u0648\u0632)", "\u0627\u0632 \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u0654 \u0645\u0627\u0698\u0648\u0644 \u062A\u0623\u062E\u06CC\u0631\u0627\u062A \u062E\u0648\u0627\u0646\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062F\u0631 \u062C\u062F\u0648\u0644 \u0627\u062B\u0631 \u0628\u0631 \u0627\u062A\u0645\u0627\u0645 \u0622\u0645\u062F\u0647 \u0627\u0633\u062A"], ["\u0645\u0628\u0644\u063A \u062E\u0633\u0627\u0631\u062A (\u067E\u0648\u0644)", "\u0641\u0642\u0637 \u0628\u0627 \u0642\u0627\u0639\u062F\u0647\u0654 \u0645\u0627\u0644\u06CC \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0648 \u0646\u0631\u062E \u0645\u0633\u062A\u0646\u062F \u0645\u062D\u0627\u0633\u0628\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F"], ["\u0646\u062A\u06CC\u062C\u0647", "\u0627\u06CC\u0646 \u062F\u0648 \u062E\u0631\u0648\u062C\u06CC \u0647\u0631\u06AF\u0632 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0645\u0639\u0627\u062F\u0644 \u06CC\u06A9\u062F\u06CC\u06AF\u0631 \u0641\u0631\u0636 \u0646\u0634\u062F\u0647\u200C\u0627\u0646\u062F"]] },
    overlapWarnings: { heads: ["#", "\u0634\u062F\u062A", "\u0647\u0634\u062F\u0627\u0631"], rows: input.overlapWarnings.map((w, i) => [String(i + 1), w.severity === "violation" ? "\u0646\u0642\u0636" : "\u0647\u0634\u062F\u0627\u0631", esc(w.messageFa)]) },
    allocations: { heads: ["#", "\u0642\u0644\u0645", "\u0631\u0648\u06CC\u062F\u0627\u062F \u0645\u0642\u0635\u062F", "\u062F\u0631\u0635\u062F", "\u0645\u0628\u0646\u0627"], rows: input.allocations.map((a, i) => [String(i + 1), esc(input.costItems.find((x) => String(x.Id) === String(a.ClaimCostItemId))?.TitleFa ?? a.ClaimCostItemId), esc(eventById.get(String(a.DelayEventId))?.Code ?? a.DelayEventId), faNum(a.AllocationPct) + "\u066A", esc(a.Basis ?? "\u2014")]) },
    allocControl: { heads: ["#", "\u0642\u0644\u0645", "\u0645\u062C\u0645\u0648\u0639 \u062A\u062E\u0635\u06CC\u0635"], rows: input.costItems.map((item, i) => [String(i + 1), esc(item.TitleFa), faNum(input.allocations.filter((a) => String(a.ClaimCostItemId) === String(item.Id)).reduce((s, a) => s + (Number(a.AllocationPct) || 0), 0)) + "\u066A"]) },
    amountsByCategory: { heads: ["\u062F\u0633\u062A\u0647", "\u062B\u0628\u062A\u200C\u0634\u062F\u0647", "\u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647"], rows: [...new Set(input.costItems.map((i) => String(i.LossCategory ?? i.CostType)))].map((code) => {
      const list = input.costItems.filter((i) => String(i.LossCategory ?? i.CostType) === code);
      return [esc(lossCategoryFa(code)), faNum(list.reduce((s, i) => s + (Number(i.Amount) || 0), 0)), faNum(list.reduce((s, i) => {
        const run = latestRunByItem.get(String(i.Id));
        return s + (run && run.FinalAmount !== null && run.FinalAmount !== void 0 ? Number(run.FinalAmount) : 0);
      }, 0))];
    }) },
    amountsByEvent: { heads: ["\u0631\u0648\u06CC\u062F\u0627\u062F", "\u062B\u0628\u062A\u200C\u0634\u062F\u0647", "\u0645\u062D\u0627\u0633\u0628\u0647\u200C\u0634\u062F\u0647"], rows: input.delayEvents.map((e) => {
      const list = input.costItems.filter((i) => String(i.DelayEventId) === String(e.Id));
      return [esc(e.Code), faNum(list.reduce((s, i) => s + (Number(i.Amount) || 0), 0)), faNum(list.reduce((s, i) => {
        const run = latestRunByItem.get(String(i.Id));
        return s + (run && run.FinalAmount !== null && run.FinalAmount !== void 0 ? Number(run.FinalAmount) : 0);
      }, 0))];
    }) },
    assumptions: { heads: ["#", "\u0642\u0644\u0645", "\u0641\u0631\u0636\u06CC\u0627\u062A/\u0648\u0631\u0648\u062F\u06CC \u0627\u062C\u0631\u0627"], rows: input.costItems.map((item, i) => {
      const run = latestRunByItem.get(String(item.Id));
      let v = "\u2014";
      try {
        v = esc(typeof run?.Inputs === "string" ? run.Inputs : JSON.stringify(run?.Inputs ?? "\u2014"));
      } catch {
        v = "\u2014";
      }
      return [String(i + 1), esc(item.TitleFa), v];
    }) },
    limitations: { heads: ["\u0645\u062D\u062F\u0648\u062F\u06CC\u062A"], rows: [["\u0642\u0648\u0627\u0639\u062F \u062A\u0623\u06CC\u06CC\u062F\u0646\u0634\u062F\u0647 \u0645\u0628\u0646\u0627\u06CC \u0642\u0637\u0639\u06CC \u0645\u0637\u0627\u0644\u0628\u0647 \u0646\u06CC\u0633\u062A\u0646\u062F \u0648 \u062E\u0631\u0648\u062C\u06CC \u0622\u0646\u200C\u0647\u0627 \xAB\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC\xBB \u0627\u0633\u062A"], ["\u0645\u062F\u062A \u062A\u0623\u062E\u06CC\u0631 \u0648 \u0645\u0628\u0644\u063A \u062E\u0633\u0627\u0631\u062A \u062F\u0648 \u062E\u0631\u0648\u062C\u06CC \u0645\u062A\u0641\u0627\u0648\u062A\u200C\u0627\u0646\u062F \u0648 \u0645\u0639\u0627\u062F\u0644\u200C\u0633\u0627\u0632\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A"], ["\u0627\u0642\u0644\u0627\u0645 \u0641\u0627\u0642\u062F \u0633\u0646\u062F \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u060C \u0645\u0633\u062A\u0646\u062F \u0645\u062D\u0633\u0648\u0628 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F"]] },
    proposed: { heads: ["\u0645\u0628\u0644\u063A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u0645\u0637\u0627\u0644\u0628\u0647"], rows: [[caseAmounts ? "<mark>" + faNum(caseAmounts.proposed) + "</mark>" : "\u2014"]] },
    proposedBasis: { heads: ["\u0645\u0628\u0646\u0627\u06CC \u067E\u06CC\u0634\u0646\u0647\u0627\u062F"], rows: [[esc(claim.QuantumNote ?? "\u0645\u0628\u0644\u063A \u067E\u06CC\u0634\u0646\u0647\u0627\u062F\u06CC \u062C\u062F\u0627 \u0627\u0632 \u0628\u0631\u0622\u0648\u0631\u062F \u0627\u0648\u0644\u06CC\u0647 \u0648 \u0645\u0628\u0627\u0644\u063A \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0628\u062F\u0648\u0646 \u0633\u0627\u0628\u0642\u0647 \u0628\u0647 \u0622\u0646\u200C\u0647\u0627 \u062A\u0628\u062F\u06CC\u0644 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A")]] },
    reviewStatus: { heads: ["#", "\u0642\u0644\u0645", "\u0648\u0636\u0639\u06CC\u062A \u0642\u0644\u0645", "\u0648\u0636\u0639\u06CC\u062A \u0622\u062E\u0631\u06CC\u0646 \u0627\u062C\u0631\u0627"], rows: input.costItems.map((item, i) => {
      const run = latestRunByItem.get(String(item.Id));
      return [String(i + 1), esc(item.TitleFa), esc(item.Status), esc(run?.Status ?? "\u0627\u062C\u0631\u0627 \u0646\u0634\u062F\u0647")];
    }) },
    unapprovedRules: { heads: ["\u06A9\u062F", "\u0646\u0627\u0645", "\u0648\u0636\u0639\u06CC\u062A"], rows: input.rules.filter((r) => r.Status !== "approved").map((r) => [esc(r.Code), esc(r.NameFa), esc(r.Status)]) },
    decisions: { heads: ["\u062A\u0635\u0645\u06CC\u0645 \u0644\u0627\u0632\u0645"], rows: [["\u062A\u0623\u06CC\u06CC\u062F \u06CC\u0627 \u0631\u062F \u0642\u0648\u0627\u0639\u062F \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u062A\u0648\u0633\u0637 \u06A9\u0627\u0631\u0634\u0646\u0627\u0633 \u0645\u0633\u062A\u0642\u0644"], ["\u062A\u0639\u06CC\u06CC\u0646 \u062A\u06A9\u0644\u06CC\u0641 \u0627\u0642\u0644\u0627\u0645 \u0641\u0627\u0642\u062F \u0633\u0646\u062F \u06CC\u0627 \u0645\u062D\u0627\u0633\u0628\u0647\u0654 \u0646\u0647\u0627\u06CC\u06CC"], ["\u062A\u0623\u06CC\u06CC\u062F \u0646\u0647\u0627\u06CC\u06CC \u0627\u06CC\u0646 \u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633 \u062A\u0648\u0633\u0637 \u0645\u0633\u0626\u0648\u0644 \u0645\u0631\u0628\u0648\u0637 \u067E\u06CC\u0634 \u0627\u0632 \u0635\u062F\u0648\u0631 \u0631\u0633\u0645\u06CC"]] },
    annexDocs: { heads: ["\u067E\u06CC\u0648\u0633\u062A", "\u0634\u0645\u0627\u0631\u0647", "\u0646\u0633\u062E\u0647", "\u0639\u0646\u0648\u0627\u0646"], rows: input.costItems.flatMap((item) => itemDocs(item).map((id) => {
      const d = input.documentById.get(String(id));
      return [esc(d?.DocNo ?? id), esc(d?.Revision ?? "\u2014"), esc(d?.TitleFa ?? "\u2014")];
    })).map((r, i) => [String(i + 1), ...r]) },
    docVersions: { heads: ["\u0646\u0633\u062E\u0647", "\u0642\u0627\u0644\u0628", "\u0648\u0636\u0639\u06CC\u062A", "\u062A\u0648\u0644\u06CC\u062F\u06A9\u0646\u0646\u062F\u0647", "\u062A\u0627\u0631\u06CC\u062E"], rows: (input.documentVersions ?? []).map((v) => [faNum(v.Version), esc(v.Format), esc(v.Status), esc(v.GeneratedBy ?? "\u2014"), faDate(v.GeneratedAt)]) }
  };
  const chapterIntro = {
    3: "\u0627\u06CC\u0646 \u0644\u0627\u06CC\u062D\u0647 \u0628\u0631 \u0645\u0628\u0646\u0627\u06CC \u062F\u0627\u062F\u0647\u200C\u0647\u0627\u06CC \u0648\u0627\u0642\u0639\u06CC \u067E\u0631\u0648\u0646\u062F\u0647\u060C \u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0646\u0633\u062E\u0647\u200C\u062F\u0627\u0631 \u0648 \u0627\u0633\u0646\u0627\u062F EDMS \u067E\u06CC\u0648\u0646\u062F\u0634\u062F\u0647 \u062A\u0648\u0644\u06CC\u062F \u0634\u062F\u0647 \u0627\u0633\u062A\u061B \u0647\u0631\u062C\u0627 \u0645\u062D\u0627\u0633\u0628\u0647\u0654 \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u06CC\u0627 \u0645\u062F\u0631\u06A9 \u06A9\u0627\u0641\u06CC \u0646\u06CC\u0633\u062A\u060C \xAB\u2014\xBB \u0648 \xAB\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC\xBB \u062F\u0631\u062C \u0634\u062F\u0647 \u0627\u0633\u062A.",
    11: "\u0645\u062F\u062A \u062A\u0623\u062E\u06CC\u0631\u060C \u0645\u062F\u062A \u062A\u0645\u062F\u06CC\u062F \u0642\u0627\u0628\u0644 \u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0648 \u0645\u0628\u0644\u063A \u062E\u0633\u0627\u0631\u062A \u0633\u0647 \u062E\u0631\u0648\u062C\u06CC \u0645\u062A\u0641\u0627\u0648\u062A\u200C\u0627\u0646\u062F \u0648 \u062C\u062F\u0627\u06AF\u0627\u0646\u0647 \u06AF\u0632\u0627\u0631\u0634 \u0634\u062F\u0647\u200C\u0627\u0646\u062F.",
    12: "\u0645\u062D\u0627\u0633\u0628\u0627\u062A \u0632\u0645\u0627\u0646\u06CC \u0627\u0632 \u0646\u062A\u0627\u06CC\u062C \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647\u0654 \u0628\u062E\u0634\u0646\u0627\u0645\u0647\u200C\u0647\u0627\u06CC \u06F1\u06F3\u06F0\u06F0/\u06F5\u06F0\u06F9\u06F0 \u0645\u0627\u0698\u0648\u0644 \u062A\u0623\u062E\u06CC\u0631\u0627\u062A \u062E\u0648\u0627\u0646\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0641\u0631\u0645\u0648\u0644 \u062F\u0631 \u062F\u0648 \u0645\u0627\u0698\u0648\u0644 \u062A\u06A9\u0631\u0627\u0631 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.",
    15: "\u0641\u0631\u0636\u06CC\u0627\u062A \u0647\u0631 \u0645\u062D\u0627\u0633\u0628\u0647 \u062F\u0631 \u0627\u062C\u0631\u0627\u06CC \u0645\u0631\u0628\u0648\u0637 \u062B\u0628\u062A \u0648 \u0642\u0627\u0628\u0644 \u0628\u0627\u0632\u062A\u0648\u0644\u06CC\u062F \u0627\u0633\u062A.",
    17: "\u0646\u062A\u06CC\u062C\u0647\u0654 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0627\u0631\u0634\u0646\u0627\u0633\u06CC \u067E\u0633 \u0627\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0645\u0633\u0626\u0648\u0644 \u0645\u0631\u0628\u0648\u0637 \u062F\u0631 \u0633\u0627\u0645\u0627\u0646\u0647 \u062B\u0628\u062A \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0627\u06CC\u0646 \u0633\u0646\u062F \u062A\u0627 \u0622\u0646 \u0632\u0645\u0627\u0646 \u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633 \u0627\u0633\u062A."
  };
  const parts = [];
  for (const chapter of LOSS_DOC_CHAPTERS) {
    const tables = LOSS_DOC_TABLES.filter((t) => t.chapter === chapter.no);
    const body = [
      chapter.no === 1 ? `<div class="cover"><h1>\u0644\u0627\u06CC\u062D\u0647\u0654 \u0636\u0631\u0631 \u0648 \u0632\u06CC\u0627\u0646 \u067E\u06CC\u0645\u0627\u0646</h1><p>\u067E\u0631\u0648\u0646\u062F\u0647: <b>${esc(claim.Code)}</b> \u2014 ${esc(claim.TitleFa)}</p><p>\u0648\u0636\u0639\u06CC\u062A \u0633\u0646\u062F: <b>\u067E\u06CC\u0634\u200C\u0646\u0648\u06CC\u0633</b></p></div>` : "",
      chapterIntro[chapter.no] ? `<p>${esc(chapterIntro[chapter.no])}</p>` : "",
      ...tables.map((t) => `<h3>\u062C\u062F\u0648\u0644 ${t.no} \u0640 ${esc(t.fa)} [\u0627\u0644\u0632\u0627\u0645\u06CC]</h3>` + table(D[t.dataset]?.heads ?? ["\u0645\u0648\u0631\u062F"], D[t.dataset]?.rows ?? []))
    ].join("\n");
    parts.push(`<h2>\u0641\u0635\u0644 ${chapter.no} \u0640 ${esc(chapter.fa)}</h2>${body}`);
  }
  parts.push('<section data-internal="true"><h2>\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u062F\u0627\u062E\u0644\u06CC \u062A\u0646\u0638\u06CC\u0645 \u0644\u0627\u06CC\u062D\u0647</h2><p>\u0631\u0627\u0647\u0646\u0645\u0627\u06CC \u062F\u0627\u062E\u0644\u06CC: \u0627\u06CC\u0646 \u0628\u062E\u0634 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u062A\u0646\u0638\u06CC\u0645\u200C\u06A9\u0646\u0646\u062F\u0647 \u0627\u0633\u062A \u0648 \u0646\u0628\u0627\u06CC\u062F \u062F\u0631 \u0646\u0633\u062E\u0647\u0654 \u0635\u0627\u062F\u0631\u0634\u062F\u0647 \u0628\u0645\u0627\u0646\u062F. [\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC]</p></section>');
  const rawBody = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" dir="rtl" lang="fa">
<head><meta charset="utf-8"><title>\u0644\u0627\u06CC\u062D\u0647 \u0636\u0631\u0631 \u0648 \u0632\u06CC\u0627\u0646 ${esc(claim.Code)}</title>
<style>@page{size:A4;margin:18mm}body{font-family:'B Nazanin',Tahoma,sans-serif;font-size:12pt;line-height:1.9;color:#111}h1{font-size:19pt}h2{font-size:14pt;border-bottom:2px solid #1f4e79;padding-bottom:4px;margin-top:22px}h3{font-size:12pt;color:#1f4e79}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #666;padding:5px 7px;font-size:10.5pt;text-align:right;vertical-align:top}th{background:#dbe7f3}.cover{border:2px solid #1f4e79;padding:24px;text-align:center;margin-top:60px}</style></head>
<body>${parts.join("\n")}</body></html>`;
  const finalize = (html) => sanitizeLossDocumentHtml(
    html.replace("</head>", `<style>body{font-family:'B Nazanin',Tahoma,sans-serif}table td,table th{font-family:inherit}</style></head>`)
  );
  return { body: finalize(rawBody), issues, filename: `LossClaim-${String(claim.Code ?? "claim")}-v${input.version}.${input.format === "pdf" ? "html" : "doc"}`, contentType: "application/msword; charset=utf-8" };
}
export {
  LOSS_DOC_CHAPTERS,
  LOSS_DOC_TABLES,
  LOSS_DOC_TEMPLATE,
  buildClaimLossDocument,
  sanitizeLossDocumentHtml
};
