import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRepository, JsonFileDriver, MssqlDriver } from "./persistence/driver.mjs";

function tempRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arena-mfg-uow-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, repo: createRepository(new JsonFileDriver(dir)) };
}

function partData(partNo = "P-UOW-01") {
  return {
    PlantId: "PLANT-DEMO",
    PartNo: partNo,
    NameFa: "قطعهٔ آزمون تراکنش",
    PartType: "manufactured",
    BaseUom: "ea",
    StandardUnitCost: 120,
    Currency: "IRR",
    IsLotTracked: false,
    IsActive: true,
  };
}

function orderData(partId, orderNo = "MO-UOW-01") {
  return {
    PlantId: "PLANT-DEMO",
    OrderNo: orderNo,
    PartId: partId,
    OrderQuantity: 10,
    Uom: "ea",
    DueAt: "2026-11-10T12:00:00.000Z",
    Status: "created",
    PriorityRule: "EDD",
    DemandSource: "manual",
    AllowOverrun: false,
  };
}

test("Unit of Work JSON: exception همهٔ تغییرات چندجدولی را rollback می‌کند", async (t) => {
  const { dir, repo } = tempRepo(t);
  await assert.rejects(repo.transaction(async (tx) => {
    const part = await tx.create("MfgPart", partData(), "u-mfg-eng");
    await tx.create("MfgProductionOrder", orderData(part.Id), "u-mfg-plan");
    throw new Error("force rollback");
  }), /force rollback/);

  assert.equal(await repo.count("MfgPart", []), 0);
  assert.equal(await repo.count("MfgProductionOrder", []), 0);
  const reopened = createRepository(new JsonFileDriver(dir));
  assert.equal(await reopened.count("MfgPart", []), 0);
  assert.equal(await reopened.count("MfgProductionOrder", []), 0);
  assert.equal(fs.existsSync(path.join(dir, ".transaction-journal.json")), false);
});

test("Unit of Work JSON: commit چندجدولی پس از reopen قابل مشاهده است", async (t) => {
  const { dir, repo } = tempRepo(t);
  const result = await repo.transaction(async (tx) => {
    const part = await tx.create("MfgPart", partData("P-UOW-COMMIT"), "u-mfg-eng");
    const order = await tx.create("MfgProductionOrder", orderData(part.Id, "MO-UOW-COMMIT"), "u-mfg-plan");
    return { partId: part.Id, orderId: order.Id };
  });

  const reopened = createRepository(new JsonFileDriver(dir));
  const part = await reopened.get("MfgPart", result.partId);
  const order = await reopened.get("MfgProductionOrder", result.orderId);
  assert.equal(part.PartNo, "P-UOW-COMMIT");
  assert.equal(part.IsActive, true);
  assert.equal(order.PartId, part.Id);
  assert.equal(order.Status, "created");
  assert.equal(fs.existsSync(path.join(dir, ".transaction-journal.json")), false);
});

test("Unit of Work JSON: استفاده از repository بیرونی داخل callback بدون deadlock رد می‌شود", async (t) => {
  const { repo } = tempRepo(t);
  await assert.rejects(repo.transaction(async (tx) => {
    await tx.create("MfgPart", partData("P-UOW-OUTER"), "u-mfg-eng");
    await repo.list("MfgPart");
  }), { code: "TRANSACTION_OUTER_REPO_ACCESS" });
  assert.equal(await repo.count("MfgPart", []), 0);
});

test("Unit of Work JSON: تراکنش تو‌در‌تو صریحاً رد می‌شود", async (t) => {
  const { repo } = tempRepo(t);
  await assert.rejects(repo.transaction((tx) => tx.transaction(async () => undefined)), { code: "NESTED_TRANSACTION_UNSUPPORTED" });
  assert.equal(await repo.count("MfgPart", []), 0);
});

test("Unit of Work JSON: بعد از قطع بین‌جدولی، journal قبل از read با after-image بازیابی می‌شود", async (t) => {
  const { dir, repo } = tempRepo(t);
  const txId = "12345678-1234-1234-1234-123456789abc";
  const image = `.txn-${txId}-MfgPart.after.json`;
  const storedRows = [{
    Id: "mfgpart-recovered",
    PlantId: "PLANT-DEMO",
    PartNo: "P-UOW-RECOVERED",
    NameFa: "بازیابی پس از قطع",
    NameEn: null,
    PartType: "manufactured",
    BaseUom: "ea",
    DescriptionFa: null,
    StandardUnitCost: 120,
    Currency: "IRR",
    IsLotTracked: 0,
    IsActive: 1,
    CreatedAt: "2026-10-03T12:00:00.000Z",
    CreatedBy: "u-mfg-eng",
    UpdatedAt: null,
    UpdatedBy: null,
    RowVersion: 1,
  }];
  fs.writeFileSync(path.join(dir, image), JSON.stringify(storedRows));
  fs.writeFileSync(path.join(dir, ".transaction-journal.json"), JSON.stringify({ version: 1, txId, tables: [{ table: "MfgPart", image }] }));

  const recovered = await repo.list("MfgPart", { where: [{ column: "PartNo", op: "eq", value: "P-UOW-RECOVERED" }] });
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].IsActive, true);
  assert.equal(fs.existsSync(path.join(dir, ".transaction-journal.json")), false);
  assert.equal(fs.existsSync(path.join(dir, image)), false);
});

test("Unit of Work JSON: شرط‌های bool در خواندن بیرونی و snapshot تراکنش با نوع منطقی تطبیق می‌یابند", async (t) => {
  const { repo } = tempRepo(t);
  await repo.create("MfgPart", partData("P-UOW-ACTIVE"), "u-mfg-eng");
  await repo.create("MfgPart", { ...partData("P-UOW-INACTIVE"), IsActive: false }, "u-mfg-eng");

  const activeWhere = [{ column: "IsActive", op: "eq", value: true }];
  assert.equal((await repo.list("MfgPart", { where: activeWhere })).length, 1);
  assert.equal(await repo.count("MfgPart", activeWhere), 1);
  await repo.transaction(async (tx) => {
    assert.equal((await tx.list("MfgPart", { where: activeWhere })).length, 1);
    assert.equal(await tx.count("MfgPart", activeWhere), 1);
    const inactiveWhere = [{ column: "IsActive", op: "eq", value: false }];
    assert.equal((await tx.list("MfgPart", { where: inactiveWhere })).length, 1);
    assert.equal(await tx.count("MfgPart", inactiveWhere), 1);
  });
});

function fakeSqlHarness(options = {}) {
  const events = [];
  const queryContexts = [];
  const makeRequest = (context) => ({
    input() { return this; },
    async query(sqlText) {
      events.push(`query:${context}`);
      queryContexts.push(context);
      return { rowsAffected: [1], recordset: [], sqlText };
    },
  });
  const pool = { request: () => makeRequest("pool") };
  class FakeTransaction {
    constructor(parentPool) { this.parentPool = parentPool; }
    async begin() { events.push("begin"); if (Object.hasOwn(options, "beginError")) throw options.beginError; }
    request() { return makeRequest("transaction"); }
    async commit() { events.push("commit"); if (Object.hasOwn(options, "commitError")) throw options.commitError; }
    async rollback() { events.push("rollback"); if (Object.hasOwn(options, "rollbackError")) throw options.rollbackError; }
  }
  return { events, queryContexts, pool, sql: { Transaction: FakeTransaction } };
}

test("Unit of Work SQL: همهٔ queryها از Transaction می‌گذرند و commit می‌شود", async () => {
  const fake = fakeSqlHarness();
  const repo = createRepository(new MssqlDriver(fake.pool, fake.sql));
  const result = await repo.transaction(async (tx) => {
    const part = await tx.create("MfgPart", partData("P-UOW-SQL"), "u-mfg-eng");
    await tx.create("MfgProductionOrder", orderData(part.Id, "MO-UOW-SQL"), "u-mfg-plan");
    return part.Id;
  });

  assert.match(result, /^mfgpart-/);
  assert.deepEqual(fake.events.filter((event) => ["begin", "commit", "rollback"].includes(event)), ["begin", "commit"]);
  assert.equal(fake.queryContexts.length, 2);
  assert.ok(fake.queryContexts.every((context) => context === "transaction"));
});

test("Unit of Work SQL: خطای callback rollback می‌کند و commit نمی‌کند", async () => {
  const fake = fakeSqlHarness();
  const repo = createRepository(new MssqlDriver(fake.pool, fake.sql));
  await assert.rejects(repo.transaction(async (tx) => {
    await tx.create("MfgPart", partData("P-UOW-SQL-ROLLBACK"), "u-mfg-eng");
    throw new Error("rollback sql uow");
  }), /rollback sql uow/);
  assert.deepEqual(fake.events.filter((event) => ["begin", "commit", "rollback"].includes(event)), ["begin", "rollback"]);
  assert.ok(fake.queryContexts.every((context) => context === "transaction"));
});

test("Unit of Work SQL: خطای دامنه از callback بدون تغییر identity و جزئیات برمی‌گردد", async () => {
  const fake = fakeSqlHarness();
  const repo = createRepository(new MssqlDriver(fake.pool, fake.sql));
  const domainError = Object.assign(new Error("BOM cycle"), { status: 422, code: "MFG_BOM_CYCLE", details: { partId: "P-1" } });
  await assert.rejects(repo.transaction(async () => { throw domainError; }), (error) => {
    assert.strictEqual(error, domainError);
    assert.equal(error.status, 422);
    assert.equal(error.details.partId, "P-1");
    return true;
  });
  assert.deepEqual(fake.events.filter((event) => ["begin", "commit", "rollback"].includes(event)), ["begin", "rollback"]);
});

test("Unit of Work SQL: repository اصلی داخل callback به connection بیرونی نمی‌نویسد", async () => {
  const fake = fakeSqlHarness();
  const repo = createRepository(new MssqlDriver(fake.pool, fake.sql));
  await assert.rejects(repo.transaction(async (tx) => {
    await tx.create("MfgPart", partData("P-UOW-SQL-OUTER"), "u-mfg-eng");
    await repo.list("MfgPart");
  }), { code: "TRANSACTION_OUTER_REPO_ACCESS" });
  assert.deepEqual(fake.events.filter((event) => ["begin", "commit", "rollback"].includes(event)), ["begin", "rollback"]);
  assert.ok(fake.queryContexts.every((context) => context === "transaction"));
});

test("Unit of Work SQL: non-Error commit rejection حفظ می‌شود و نتیجه uncertain اعلام می‌شود", async () => {
  const rejected = "driver rejected commit";
  const fake = fakeSqlHarness({ commitError: rejected });
  const repo = createRepository(new MssqlDriver(fake.pool, fake.sql));
  await assert.rejects(repo.transaction(async () => "result"), (error) => {
    assert.equal(error.name, "NonErrorRejection");
    assert.equal(error.message, rejected);
    assert.equal(error.cause, rejected);
    assert.equal(error.code, "MSSQL_TRANSACTION_COMMIT_UNCERTAIN");
    return true;
  });
  assert.deepEqual(fake.events.filter((event) => ["begin", "commit", "rollback"].includes(event)), ["begin", "commit", "rollback"]);
});

test("Unit of Work SQL: خطای commit منجمد هم با کد uncertainty و کد اصلی قابل‌ردیابی است", async () => {
  const rejected = Object.freeze(Object.assign(new Error("frozen commit failure"), { code: "E_COMMIT" }));
  const fake = fakeSqlHarness({ commitError: rejected });
  const repo = createRepository(new MssqlDriver(fake.pool, fake.sql));
  await assert.rejects(repo.transaction(async () => undefined), (error) => {
    assert.equal(error.message, "frozen commit failure");
    assert.equal(error.cause, rejected);
    assert.equal(error.code, "MSSQL_TRANSACTION_COMMIT_UNCERTAIN");
    assert.equal(error.originalCode, "E_COMMIT");
    return true;
  });
  assert.deepEqual(fake.events.filter((event) => ["begin", "commit", "rollback"].includes(event)), ["begin", "commit", "rollback"]);
});

test("Unit of Work SQL: rejection غیر Error در callback و rollback همچنان علّیت را نگه می‌دارند", async () => {
  const rejected = { reason: "not an Error instance" };
  const fake = fakeSqlHarness({ rollbackError: "rollback rejected" });
  const repo = createRepository(new MssqlDriver(fake.pool, fake.sql));
  await assert.rejects(repo.transaction(async () => { throw rejected; }), (error) => {
    assert.equal(error.name, "NonErrorRejection");
    assert.equal(error.cause, rejected);
    assert.equal(error.rollbackError.name, "NonErrorRejection");
    assert.equal(error.rollbackError.cause, "rollback rejected");
    return true;
  });
  assert.deepEqual(fake.events.filter((event) => ["begin", "commit", "rollback"].includes(event)), ["begin", "rollback"]);
});
