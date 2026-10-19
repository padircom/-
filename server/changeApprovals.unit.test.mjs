import test from "node:test";
import assert from "node:assert/strict";
import { sortChangeApprovals } from "./changeMgmtLogic.js";

test("فاز ۹: sortChangeApprovals — زمانی واقعی، بدون تاریخ آخر، تساوی با Code", () => {
  const rows = [
    { Code: "STEP-3", StepCode: "approved", DecidedAt: "2026-10-19T12:00:00Z" },
    { Code: "STEP-1", StepCode: "submitted", DecidedAt: "2026-10-19T08:00:00Z" },
    { Code: "STEP-NOTIME", StepCode: "draft", DecidedAt: null },
    { Code: "STEP-2", StepCode: "pending_decision", DecidedAt: "2026-10-19T08:00:00Z" }, /* تساوی زمان با STEP-1 */
  ];
  const out = sortChangeApprovals(rows);
  assert.deepEqual(out.map((x) => x.Code), ["STEP-1", "STEP-2", "STEP-3", "STEP-NOTIME"]);
  /* ورودی دست‌نخورده می‌ماند */
  assert.equal(rows[0].Code, "STEP-3");
  /* آرایهٔ خالی/تکی پایدار */
  assert.deepEqual(sortChangeApprovals([]), []);
  const single = [{ Code: "A", DecidedAt: "2026-10-19T00:00:00Z" }];
  assert.equal(sortChangeApprovals(single)[0].Code, "A");
});
