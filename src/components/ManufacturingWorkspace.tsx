import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import {
  canMfgAccess,
  DEFAULT_PLANT_ID,
  defaultMfgTimeWindow,
  MFG_DEMO_USERS,
  MfgClient,
  MfgRequestError,
  type MfgAtpBucket,
  type MfgAtpCheck,
  type MfgBomHeader,
  type MfgBomItem,
  type MfgCapacityBucket,
  type MfgCrpReport,
  type MfgDemandForecast,
  type MfgDemandType,
  type MfgLotSizingPolicy,
  type MfgLotSizingRule,
  type MfgIsa95Conformance,
  type MfgLeadTimeOffsetReport,
  type MfgMasterScheduleLine,
  type MfgMasterScheduleRun,
  type MfgPeggingReport,
  type MfgPlannedOrder,
  type MfgProductionVersion,

  type MfgGanttResponse,
  type MfgMaterial,
  type MfgMaterialRequirement,
  type MfgOperationCost,
  type MfgOperationStatus,
  type MfgOperationVariance,
  type MfgOrderCost,
  type MfgOrderDetail,
  type MfgOperationSplitLot,
  type MfgOrderOperation,
  type MfgPart,
  type MfgProductionAlert,
  type MfgProductionOrder,
  type MfgRouting,
  type MfgRoutingOperation,
  type MfgWorkCenter,
  type MfgWorkCenterResource,
} from "../services/manufacturingApi";
import type { DispatchRule } from "../services/manufacturingModel";

export type MfgTab =
  | "overview"
  | "engineering"
  | "planning"
  | "orders"
  | "scheduling"
  | "execution"
  | "mrp"
  | "cost";

export interface ManufacturingWorkspaceProps {
  lang: Lang;
  plantId?: string;
  initialTab?: MfgTab;
  onTabChange?: (tab: MfgTab) => void;
  standalone?: boolean;
  onExitStandalone?: () => void;
}

const TABS: Array<{
  id: MfgTab;
  fa: string;
  en: string;
  defaultUser: string;
  permission: string;
}> = [
  { id: "overview", fa: "داشبورد، OEE و هشدارها", en: "Overview, OEE & Alerts", defaultUser: "u-mfg-manager", permission: "mfg.dashboard.view" },
  { id: "engineering", fa: "مهندسی ساخت (قطعه/BOM/مسیر/مرکز کاری)", en: "Engineering Master", defaultUser: "u-mfg-eng", permission: "mfg.part.view" },
  { id: "planning", fa: "برنامه‌ریزی پیشرفته (MPS، لات، ATP، تقسیم)", en: "Advanced Planning (MPS, Lot Sizing, ATP, Splitting)", defaultUser: "u-mfg-plan", permission: "mfg.mps.view" },
  { id: "orders", fa: "سفارش‌های تولید", en: "Production Orders", defaultUser: "u-mfg-plan", permission: "mfg.order.view" },
  { id: "scheduling", fa: "زمان‌بندی ظرفیت، گانت و گلوگاه", en: "Scheduling, Gantt & Capacity", defaultUser: "u-mfg-plan", permission: "mfg.schedule.view" },
  { id: "execution", fa: "اجرای کارگاهی، توقف و ضایعات", en: "Shop-Floor Execution", defaultUser: "u-mfg-supervisor", permission: "mfg.execution.view" },
  { id: "mrp", fa: "مواد، MRP، کمبود و مصرف", en: "Materials & MRP", defaultUser: "u-mfg-material", permission: "mfg.material.view" },
  { id: "cost", fa: "رول‌آپ هزینه و تطبیق مالی", en: "Cost Roll-up & Reconcile", defaultUser: "u-mfg-cost", permission: "mfg.cost.view" },
];

export default function ManufacturingWorkspace({
  lang,
  plantId: initialPlantId = DEFAULT_PLANT_ID,
  initialTab = "overview",
  onTabChange,
  standalone = false,
  onExitStandalone,
}: ManufacturingWorkspaceProps) {
  const { user: authUser } = useAuth();
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);

  const [plantId, setPlantId] = useState<string>(initialPlantId);
  const [tab, setTab] = useState<MfgTab>(initialTab);
  const [autoRoleFollow, setAutoRoleFollow] = useState<boolean>(true);
  const [mfgUserId, setMfgUserId] = useState<string>(() => {
    if (authUser?.id && MFG_DEMO_USERS.some((u) => u.id === authUser.id)) {
      return authUser.id;
    }
    return "u-mfg-manager";
  });

  const [fromIso, setFromIso] = useState<string>(() => defaultMfgTimeWindow().from);
  const [toIso, setToIso] = useState<string>(() => defaultMfgTimeWindow().to);

  const [loading, setLoading] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  // Overview state
  const [overviewData, setOverviewData] = useState<any>(null);
  const [oeeData, setOeeData] = useState<any>(null);
  const [alerts, setAlerts] = useState<MfgProductionAlert[]>([]);

  // Engineering state
  const [parts, setParts] = useState<MfgPart[]>([]);
  const [bomHeaders, setBomHeaders] = useState<MfgBomHeader[]>([]);
  const [selectedBomId, setSelectedBomId] = useState<string>("");
  const [bomItems, setBomItems] = useState<MfgBomItem[]>([]);
  const [explosionLines, setExplosionLines] = useState<any[]>([]);
  const [routings, setRoutings] = useState<MfgRouting[]>([]);
  const [selectedRoutingId, setSelectedRoutingId] = useState<string>("");
  const [routingOps, setRoutingOps] = useState<MfgRoutingOperation[]>([]);
  const [workCenters, setWorkCenters] = useState<MfgWorkCenter[]>([]);
  const [newPartForm, setNewPartForm] = useState({
    PartNo: "",
    NameFa: "",
    PartType: "manufactured" as MfgPart["PartType"],
    BaseUom: "ea",
    StandardUnitCost: 500000,
    WarehouseCode: "WH-MAIN",
    OnHandQty: 100,
  });

  // Orders state
  const [orders, setOrders] = useState<MfgProductionOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MfgOrderDetail | null>(null);
  const [newOrderForm, setNewOrderForm] = useState({
    OrderNo: "",
    PartId: "",
    OrderQuantity: 10,
    Uom: "ea",
    DueAt: "2026-10-25T12:00:00.000Z",
    PriorityRule: "EDD" as "EDD" | "CR" | "MANUAL",
    DispatchWeight: 1,
    DemandSource: "manual" as "sales-order" | "contract" | "forecast" | "manual",
    DemandRef: "",
  });

  // Scheduling state (Phase 2: Finite Scheduling + Selective Rescheduling)
  const [gantt, setGantt] = useState<MfgGanttResponse | null>(null);
  const [capacityBuckets, setCapacityBuckets] = useState<MfgCapacityBucket[]>([]);
  const [bottlenecks, setBottlenecks] = useState<Array<MfgCapacityBucket & { OverloadMinutes: number }>>([]);
  const [scheduleForm, setScheduleForm] = useState<{
    Direction: "forward" | "backward";
    CapacityMode: "finite" | "semi-finite";
    DispatchRule: DispatchRule;
  }>({
    Direction: "forward",
    CapacityMode: "finite",
    DispatchRule: "WSPT",
  });
  const [schedFilterWorkCenterId, setSchedFilterWorkCenterId] = useState<string>("");
  const [schedFilterOrderId, setSchedFilterOrderId] = useState<string>("");
  const [capacityBucketMode, setCapacityBucketMode] = useState<"day" | "week">("day");
  const [bottleneckThreshold, setBottleneckThreshold] = useState<number>(80);
  const [selectedRescheduleOpIds, setSelectedRescheduleOpIds] = useState<string[]>([]);
  const [rescheduleReason, setRescheduleReason] = useState<string>("جبران توقف ناگهانی مرکز کاری و بهینه‌سازی زنجیرهٔ پس‌نیاز");
  const [rescheduleDispatchRule, setRescheduleDispatchRule] = useState<DispatchRule>("WSPT");
  const [lastScheduleResult, setLastScheduleResult] = useState<any>(null);
  const [lastRescheduleResult, setLastRescheduleResult] = useState<any>(null);

  // Execution state (Phase 2: Operation Control + Cumulative Progress Logging + Quality/Downtime)
  const [queueOps, setQueueOps] = useState<MfgOrderOperation[]>([]);
  const [selectedOpId, setSelectedOpId] = useState<string>("");
  const [opVariance, setOpVariance] = useState<MfgOperationVariance | null>(null);
  const [execFilterWorkCenterId, setExecFilterWorkCenterId] = useState<string>("");
  const [execFilterStatus, setExecFilterStatus] = useState<string>("");
  const [execFilterShiftDate, setExecFilterShiftDate] = useState<string>("");
  const [wcResources, setWcResources] = useState<MfgWorkCenterResource[]>([]);
  const [startExecForm, setStartExecForm] = useState({
    ResourceId: "",
    OperatorId: "u-mfg-operator",
    NoteFa: "شروع اجرای عملیات طبق برنامهٔ ظرفیت محدود",
  });
  const [progressForm, setProgressForm] = useState({
    InputQuantity: 1,
    GoodQuantity: 1,
    ScrapQuantity: 0,
    ReworkQuantity: 0,
    SetupActualMinutes: 15,
    RunActualMinutes: 45,
    NoteFa: "ثبت پیشرفت تجمعی شیفت کاری",
  });
  const [finishExecForm, setFinishExecForm] = useState({
    InspectionApproved: true,
    NoteFa: "تکمیل عملیات و تحویل به ایستگاه بعدی",
  });
  const [execEventSubTab, setExecEventSubTab] = useState<"downtime" | "scrap" | "rework">("downtime");
  const [downtimeForm, setDowntimeForm] = useState({
    WorkCenterId: "",
    DowntimeType: "unplanned" as "planned" | "unplanned",
    ReasonCode: "TOOL-WEAR",
    StartedAt: "2026-10-06T08:00:00.000Z",
    FinishedAt: "2026-10-06T08:30:00.000Z",
    NoteFa: "تعویض ابزار برش در شیفت صبح",
  });
  const [scrapForm, setScrapForm] = useState({
    Quantity: 0.5,
    Uom: "ea",
    ReasonCode: "DIM-TOL",
    Disposition: "scrapped" as "scrapped" | "returned-to-stock" | "use-as-is",
    CostAmount: 150000,
    NoteFa: "انحراف ابعادی خارج از تلرانس نقشه",
  });
  const [reworkForm, setReworkForm] = useState({
    TargetOperationId: "",
    Quantity: 0.5,
    Uom: "ea",
    ReasonCode: "SURF-BURR",
    Disposition: "rework-in-place" as "rework-in-place" | "return-to-operation" | "scrap",
    NoteFa: "پلیسه‌گیری مجدد سطح ماشین‌کاری‌شده",
  });

  // MRP, Materials & Alerts state (Phase 3)
  const [materials, setMaterials] = useState<MfgMaterial[]>([]);
  const [shortages, setShortages] = useState<MfgMaterialRequirement[]>([]);
  const [mrpResult, setMrpResult] = useState<any>(null);
  const [proposalResult, setProposalResult] = useState<any>(null);
  const [matFilterQuery, setMatFilterQuery] = useState<string>("");
  const [matFilterProcurement, setMatFilterProcurement] = useState<"" | "buy" | "make">("");
  const [shortageFilterOrderId, setShortageFilterOrderId] = useState<string>("");
  const [shortageFilterMaterialId, setShortageFilterMaterialId] = useState<string>("");
  const [mrpHorizonIso, setMrpHorizonIso] = useState<string>("2026-12-31T23:59:59.000Z");
  const [mrpTargetOrderId, setMrpTargetOrderId] = useState<string>("");
  const [selectedShortageIds, setSelectedShortageIds] = useState<string[]>([]);
  const [proposalNoteFa, setProposalNoteFa] = useState<string>("پیشنهاد تأمین ناشی از کمبود MRP کارخانه");
  const [consumeForm, setConsumeForm] = useState({
    OperationId: "",
    RequirementId: "",
    MaterialId: "",
    Quantity: 1,
    Uom: "ea",
    LotNo: "",
    WarehouseCode: "WH-MAIN",
    UnitCost: 500000,
    ConsumptionMethod: "manual" as "manual" | "backflush" | "issue",
  });
  const [alertFilterStatus, setAlertFilterStatus] = useState<string>("");
  const [alertFilterSeverity, setAlertFilterSeverity] = useState<string>("");
  const [ackNotesByAlertId, setAckNotesByAlertId] = useState<Record<string, string>>({});

  // Cost state
  const [costOrderId, setCostOrderId] = useState<string>("");
  const [orderCost, setOrderCost] = useState<MfgOrderCost | null>(null);
  const [costOpId, setCostOpId] = useState<string>("");
  const [opCosts, setOpCosts] = useState<{ items: MfgOperationCost[]; derived: boolean } | null>(null);

  /* Phase 5 state — Advanced MES: MPS, lot sizing, ATP and operation splitting.
   * The default horizon starts on Monday 2026-10-05 so the planning grid lines
   * up with the demo orders and with the seeded demand/supply of that week. */
  const PLANNING_HORIZON_START = "2026-10-05";
  const [demandRows, setDemandRows] = useState<MfgDemandForecast[]>([]);
  const [timePhased, setTimePhased] = useState<any>(null);
  const [lotPolicies, setLotPolicies] = useState<MfgLotSizingPolicy[]>([]);
  const [lotEvaluation, setLotEvaluation] = useState<any>(null);
  const [mpsRuns, setMpsRuns] = useState<MfgMasterScheduleRun[]>([]);
  const [mpsResult, setMpsResult] = useState<any>(null);
  const [mpsLines, setMpsLines] = useState<MfgMasterScheduleLine[]>([]);
  const [atpChecks, setAtpChecks] = useState<MfgAtpCheck[]>([]);
  const [atpResult, setAtpResult] = useState<any>(null);
  const [atpBuckets, setAtpBuckets] = useState<MfgAtpBucket[]>([]);
  const [splitView, setSplitView] = useState<any>(null);
  const [leadTime, setLeadTime] = useState<any>(null);
  /* فاز ۵ بخش ۱۱ — سفارش برنامه‌ریزی‌شده، CRP، نسخهٔ تولید، pegging و انطباق. */
  const [plannedOrders, setPlannedOrders] = useState<MfgPlannedOrder[]>([]);
  const [crpReport, setCrpReport] = useState<MfgCrpReport | null>(null);
  const [leadTimeOffset, setLeadTimeOffset] = useState<MfgLeadTimeOffsetReport | null>(null);
  const [peggingReport, setPeggingReport] = useState<MfgPeggingReport | null>(null);
  const [productionVersions, setProductionVersions] = useState<MfgProductionVersion[]>([]);
  const [conformance, setConformance] = useState<MfgIsa95Conformance | null>(null);
  const [versionForm, setVersionForm] = useState({ PartId: "" });
  const [planSubTab, setPlanSubTab] = useState<
    "mps" | "demand" | "lotsize" | "atp" | "split" | "planned" | "crp" | "pegging" | "version" | "conformance"
  >("mps");
  const [mpsForm, setMpsForm] = useState({
    TimeBucket: "week" as "day" | "week" | "month",
    BucketCount: 4,
    HorizonStart: PLANNING_HORIZON_START,
    DemandTimeFenceBuckets: 1,
    FirmPlannedTimeFenceBuckets: 2,
    IncludeOpenOrdersAsReceipts: true,
    ConsumeForecast: true,
    PartIds: "" as string,
  });
  const [demandForm, setDemandForm] = useState({
    PartId: "",
    DemandType: "sales-order" as MfgDemandType,
    DemandRef: "SO-DEMO-101",
    RequiredAt: "2026-10-06",
    Quantity: "50",
    ConfidencePct: "",
  });
  const [lotForm, setLotForm] = useState({
    PartId: "",
    RuleCode: "EOQ" as MfgLotSizingRule,
    OrderingCost: "500000",
    HoldingCostPerUnitPerYear: "25000",
    AnnualDemandQty: "12000",
    PeriodDays: "30",
    EffectiveFrom: PLANNING_HORIZON_START,
  });
  const [atpForm, setAtpForm] = useState({
    PartId: "",
    RequestedQty: "30",
    RequestedAt: "2026-10-08",
    Mode: "cumulative" as "discrete" | "cumulative",
    IncludeForecast: false,
  });
  const [splitForm, setSplitForm] = useState({
    OrderId: "",
    OperationId: "",
    SplitLotCount: "2",
    TransferBatchQty: "",
    OverlapPct: "",
    OverlapAllowed: true,
  });

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Switch active demo user automatically when tab changes if autoRoleFollow is enabled
  useEffect(() => {
    if (!autoRoleFollow) return;
    const tabMeta = TABS.find((t) => t.id === tab);
    if (tabMeta && !canMfgAccess(mfgUserId, tabMeta.permission, plantId)) {
      setMfgUserId(tabMeta.defaultUser);
    }
  }, [tab, autoRoleFollow, mfgUserId, plantId]);

  const formatError = (err: unknown): string => {
    if (err instanceof MfgRequestError) {
      return `${err.code} (${err.status}): ${err.message}`;
    }
    if (err instanceof Error) return err.message;
    return tr("خطای ناشناخته در ارتباط با سرور تولید", "Unknown MES server error");
  };

  const loadActiveTab = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "overview") {
        const alertQuery: { status?: string; severity?: string; limit?: number } = { limit: 50 };
        if (alertFilterStatus) alertQuery.status = alertFilterStatus;
        if (alertFilterSeverity) alertQuery.severity = alertFilterSeverity;
        const [ov, oee, al] = await Promise.all([
          MfgClient.getDashboardOverview(plantId, mfgUserId, { from: fromIso, to: toIso }),
          MfgClient.getDashboardOee(plantId, mfgUserId, { from: fromIso, to: toIso }),
          canMfgAccess(mfgUserId, "mfg.alert.view", plantId)
            ? MfgClient.listAlerts(plantId, mfgUserId, alertQuery)
            : Promise.resolve({ items: [], page: { limit: 50, offset: 0, total: 0 } }),
        ]);
        if (!aliveRef.current) return;
        setOverviewData(ov);
        setOeeData(oee);
        setAlerts(al.items ?? []);
      } else if (tab === "engineering") {
        const [pRes, bRes, rRes, wcRes] = await Promise.all([
          MfgClient.listParts(plantId, mfgUserId, { limit: 100 }),
          MfgClient.listBomHeaders(plantId, mfgUserId, { limit: 100 }),
          MfgClient.listRoutings(plantId, mfgUserId, { limit: 100 }),
          MfgClient.listWorkCenters(plantId, mfgUserId, { limit: 100 }),
        ]);
        if (!aliveRef.current) return;
        setParts(pRes.items ?? []);
        setBomHeaders(bRes.items ?? []);
        setRoutings(rRes.items ?? []);
        setWorkCenters(wcRes.items ?? []);
        if (bRes.items?.length && !selectedBomId) {
          const firstBom = bRes.items[0].Id;
          setSelectedBomId(firstBom);
          const itemsRes = await MfgClient.listBomItems(plantId, mfgUserId, firstBom);
          if (aliveRef.current) setBomItems(itemsRes.items ?? []);
        }
        if (rRes.items?.length && !selectedRoutingId) {
          const firstRouting = rRes.items[0].Id;
          setSelectedRoutingId(firstRouting);
          const opsRes = await MfgClient.listRoutingOperations(plantId, mfgUserId, firstRouting);
          if (aliveRef.current) setRoutingOps(opsRes.items ?? []);
        }
      } else if (tab === "orders") {
        const [oRes, pRes] = await Promise.all([
          MfgClient.listOrders(plantId, mfgUserId, { limit: 100 }),
          canMfgAccess(mfgUserId, "mfg.part.view", plantId)
            ? MfgClient.listParts(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
        ]);
        if (!aliveRef.current) return;
        setOrders(oRes.items ?? []);
        if (pRes.items?.length) setParts(pRes.items);
        if (oRes.items?.length) {
          const targetId = selectedOrder?.Id && oRes.items.some((o) => o.Id === selectedOrder.Id)
            ? selectedOrder.Id
            : oRes.items[0].Id;
          const detail = await MfgClient.getOrder(plantId, mfgUserId, targetId);
          if (aliveRef.current) setSelectedOrder(detail);
        }
      } else if (tab === "scheduling") {
        const ganttQuery: { from: string; to: string; workCenterId?: string; orderId?: string } = {
          from: fromIso,
          to: toIso,
        };
        if (schedFilterWorkCenterId) ganttQuery.workCenterId = schedFilterWorkCenterId;
        if (schedFilterOrderId) ganttQuery.orderId = schedFilterOrderId;

        const capQuery: { from: string; to: string; bucket?: "day" | "week"; workCenterId?: string } = {
          from: fromIso,
          to: toIso,
          bucket: capacityBucketMode,
        };
        if (schedFilterWorkCenterId) capQuery.workCenterId = schedFilterWorkCenterId;

        const [gRes, cRes, bRes, wcRes, oRes, qRes] = await Promise.all([
          MfgClient.getGantt(plantId, mfgUserId, ganttQuery),
          MfgClient.getCapacityLoad(plantId, mfgUserId, capQuery),
          MfgClient.getCapacityBottlenecks(plantId, mfgUserId, {
            from: fromIso,
            to: toIso,
            minUtilizationPct: bottleneckThreshold,
          }),
          canMfgAccess(mfgUserId, "mfg.workcenter.view", plantId)
            ? MfgClient.listWorkCenters(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
          canMfgAccess(mfgUserId, "mfg.order.view", plantId)
            ? MfgClient.listOrders(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
          canMfgAccess(mfgUserId, "mfg.execution.view", plantId)
            ? MfgClient.getOperationQueue(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
        ]);
        if (!aliveRef.current) return;
        setGantt(gRes);
        setCapacityBuckets(cRes.buckets ?? []);
        setBottlenecks(bRes.items ?? []);
        if (wcRes.items?.length) setWorkCenters(wcRes.items);
        if (oRes.items?.length) setOrders(oRes.items);
        if (qRes.items?.length) setQueueOps(qRes.items);
      } else if (tab === "execution") {
        const queueQuery: { workCenterId?: string; status?: MfgOperationStatus; shiftDate?: string; limit?: number } = {
          limit: 100,
        };
        if (execFilterWorkCenterId) queueQuery.workCenterId = execFilterWorkCenterId;
        if (execFilterStatus) queueQuery.status = execFilterStatus as MfgOperationStatus;
        if (execFilterShiftDate) queueQuery.shiftDate = execFilterShiftDate;

        const [qRes, wcRes] = await Promise.all([
          MfgClient.getOperationQueue(plantId, mfgUserId, queueQuery),
          canMfgAccess(mfgUserId, "mfg.workcenter.view", plantId)
            ? MfgClient.listWorkCenters(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
        ]);
        if (!aliveRef.current) return;
        const items = qRes.items ?? [];
        setQueueOps(items);
        if (wcRes.items?.length) {
          setWorkCenters(wcRes.items);
          if (!downtimeForm.WorkCenterId) {
            setDowntimeForm((f) => ({ ...f, WorkCenterId: wcRes.items[0].Id }));
          }
        }
        if (items.length) {
          const targetOp = items.find((o) => o.Id === selectedOpId) ?? items[0];
          const opId = targetOp.Id;
          setSelectedOpId(opId);
          const [vRes, resList] = await Promise.all([
            MfgClient.getOperationVariance(plantId, mfgUserId, opId),
            canMfgAccess(mfgUserId, "mfg.workcenter.view", plantId) && targetOp.WorkCenterId
              ? MfgClient.listWorkCenterResources(plantId, mfgUserId, targetOp.WorkCenterId, { activeOnly: true, limit: 50 })
              : Promise.resolve({ items: [], page: { limit: 50, offset: 0, total: 0 } }),
          ]);
          if (aliveRef.current) {
            setOpVariance(vRes);
            setWcResources(resList.items ?? []);
            if (resList.items?.length && !startExecForm.ResourceId) {
              setStartExecForm((f) => ({ ...f, ResourceId: resList.items[0].Id }));
            }
          }
        } else {
          setOpVariance(null);
        }
      } else if (tab === "mrp") {
        const matQuery: { q?: string; procurementType?: "make" | "buy"; limit?: number } = { limit: 100 };
        if (matFilterQuery.trim()) matQuery.q = matFilterQuery.trim();
        if (matFilterProcurement) matQuery.procurementType = matFilterProcurement;

        const shQuery: { orderId?: string; materialId?: string; limit?: number } = { limit: 100 };
        if (shortageFilterOrderId) shQuery.orderId = shortageFilterOrderId;
        if (shortageFilterMaterialId) shQuery.materialId = shortageFilterMaterialId;

        const [mRes, sRes, oRes, qRes, alRes] = await Promise.all([
          MfgClient.listMaterials(plantId, mfgUserId, matQuery),
          canMfgAccess(mfgUserId, "mfg.mrp.view", plantId)
            ? MfgClient.listShortages(plantId, mfgUserId, shQuery)
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
          canMfgAccess(mfgUserId, "mfg.order.view", plantId)
            ? MfgClient.listOrders(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
          canMfgAccess(mfgUserId, "mfg.execution.view", plantId)
            ? MfgClient.getOperationQueue(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
          canMfgAccess(mfgUserId, "mfg.alert.view", plantId)
            ? MfgClient.listAlerts(plantId, mfgUserId, { limit: 50 })
            : Promise.resolve({ items: [], page: { limit: 50, offset: 0, total: 0 } }),
        ]);
        if (!aliveRef.current) return;
        const matItems = mRes.items ?? [];
        const shItems = sRes.items ?? [];
        setMaterials(matItems);
        setShortages(shItems);
        if (oRes.items?.length) setOrders(oRes.items);
        if (qRes.items?.length) {
          setQueueOps(qRes.items);
          if (!consumeForm.OperationId) {
            setConsumeForm((f) => ({ ...f, OperationId: qRes.items[0].Id }));
          }
        }
        if (alRes.items) setAlerts(alRes.items);
        if (matItems.length && !consumeForm.MaterialId) {
          const firstMat = matItems[0];
          const firstLoc = firstMat.InventoryLocations?.[0];
          setConsumeForm((f) => ({
            ...f,
            MaterialId: firstMat.Id,
            Uom: firstMat.BaseUom || "ea",
            UnitCost: firstMat.StandardUnitCost ?? 500000,
            WarehouseCode: firstLoc?.WarehouseCode || firstMat.DefaultWarehouseCode || "WH-MAIN",
            LotNo: firstLoc?.LotNo || "",
          }));
        }
      } else if (tab === "planning") {
        /* Master data comes first: every Phase-5 picker is keyed by part or order.
         * Each list is gated by its own permission so a cost analyst who lands
         * here by mistake sees an empty grid instead of a 403 wall. */
        const [pRes, oRes] = await Promise.all([
          canMfgAccess(mfgUserId, "mfg.part.view", plantId)
            ? MfgClient.listParts(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
          canMfgAccess(mfgUserId, "mfg.order.view", plantId)
            ? MfgClient.listOrders(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
        ]);
        if (!aliveRef.current) return;
        setParts(pRes.items ?? []);
        setOrders(oRes.items ?? []);
        const defaultPartId = pRes.items?.[0]?.Id ?? "";
        if (defaultPartId && !atpForm.PartId) setAtpForm((f) => ({ ...f, PartId: defaultPartId }));
        if (defaultPartId && !lotForm.PartId) setLotForm((f) => ({ ...f, PartId: defaultPartId }));
        if (defaultPartId && !demandForm.PartId) setDemandForm((f) => ({ ...f, PartId: defaultPartId }));
        if (oRes.items?.length && !splitForm.OrderId) setSplitForm((f) => ({ ...f, OrderId: oRes.items[0].Id }));

        const [dRes, lRes, rRes, aRes] = await Promise.all([
          canMfgAccess(mfgUserId, "mfg.demand.view", plantId)
            ? MfgClient.listDemandForecasts(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
          canMfgAccess(mfgUserId, "mfg.lotsize.view", plantId)
            ? MfgClient.listLotSizingPolicies(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
          canMfgAccess(mfgUserId, "mfg.mps.view", plantId)
            ? MfgClient.listMasterScheduleRuns(plantId, mfgUserId, { limit: 20 })
            : Promise.resolve({ items: [], page: { limit: 20, offset: 0, total: 0 } }),
          canMfgAccess(mfgUserId, "mfg.atp.view", plantId)
            ? MfgClient.listAtpChecks(plantId, mfgUserId, { limit: 50 })
            : Promise.resolve({ items: [], page: { limit: 50, offset: 0, total: 0 } }),
        ]);
        if (!aliveRef.current) return;
        setDemandRows(dRes.items ?? []);
        setLotPolicies(lRes.items ?? []);
        setMpsRuns(rRes.items ?? []);
        setAtpChecks(aRes.items ?? []);

        /* فاز ۵ بخش ۱۱ — فهرست‌های تازه با مجوز خودشان بارگذاری می‌شوند تا نقش
         * بدون دسترسی، دیوار ۴۰۳ نبیند. */
        const [poRes, pvRes] = await Promise.all([
          canMfgAccess(mfgUserId, "mfg.plannedorder.view", plantId)
            ? MfgClient.listPlannedOrders(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
          canMfgAccess(mfgUserId, "mfg.version.view", plantId)
            ? MfgClient.listProductionVersions(plantId, mfgUserId, { limit: 100 })
            : Promise.resolve({ items: [], page: { limit: 100, offset: 0, total: 0 } }),
        ]);
        if (!aliveRef.current) return;
        setPlannedOrders(poRes.items ?? []);
        setProductionVersions(pvRes.items ?? []);
        if (defaultPartId && !versionForm.PartId) setVersionForm((f) => ({ ...f, PartId: defaultPartId }));

        if (rRes.items?.length && canMfgAccess(mfgUserId, "mfg.mps.view", plantId)) {
          const lineRes = await MfgClient.listMasterScheduleLines(plantId, mfgUserId, rRes.items[0].Id, { limit: 200 });
          if (aliveRef.current) setMpsLines(lineRes.items ?? []);
        }
      } else if (tab === "cost") {
        const oRes = await MfgClient.listOrders(plantId, mfgUserId, { limit: 100 });
        if (!aliveRef.current) return;
        setOrders(oRes.items ?? []);
        if (oRes.items?.length) {
          const targetOrderId = costOrderId || oRes.items[0].Id;
          setCostOrderId(targetOrderId);
          const [cRes, detail] = await Promise.all([
            MfgClient.getOrderCost(plantId, mfgUserId, targetOrderId),
            MfgClient.getOrder(plantId, mfgUserId, targetOrderId),
          ]);
          if (!aliveRef.current) return;
          setOrderCost(cRes);
          setSelectedOrder(detail);
          if (detail.Operations?.length) {
            const firstOpId = detail.Operations[0].Id;
            setCostOpId(firstOpId);
            const opCostRes = await MfgClient.getOperationCost(plantId, mfgUserId, firstOpId);
            if (aliveRef.current) setOpCosts(opCostRes);
          }
        }
      }
    } catch (err) {
      if (aliveRef.current) setError(formatError(err));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [
    tab,
    plantId,
    mfgUserId,
    fromIso,
    toIso,
    selectedBomId,
    selectedRoutingId,
    selectedOrder?.Id,
    selectedOpId,
    costOrderId,
    downtimeForm.WorkCenterId,
    schedFilterWorkCenterId,
    schedFilterOrderId,
    capacityBucketMode,
    bottleneckThreshold,
    execFilterWorkCenterId,
    execFilterStatus,
    execFilterShiftDate,
    matFilterQuery,
    matFilterProcurement,
    shortageFilterOrderId,
    shortageFilterMaterialId,
    alertFilterStatus,
    alertFilterSeverity,
  ]);

  useEffect(() => {
    void loadActiveTab();
  }, [loadActiveTab]);

  const inputCls = "w-full rounded-lg border b-line-soft bg-[var(--row)] p-2 text-xs tx1";
  const btnCls = "rounded-lg border b-line-soft px-3 py-1.5 text-xs tx1 transition hover:toggle-on disabled:opacity-40";
  const activeUserMeta = MFG_DEMO_USERS.find((u) => u.id === mfgUserId);

  /* ── Handlers ── */
  async function handleAckAlert(alert: MfgProductionAlert) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const customNote = ackNotesByAlertId[alert.Id]?.trim();
      await MfgClient.acknowledgeAlert(plantId, mfgUserId, alert.Id, alert.RowVersion, {
        NoteFa: customNote || "بررسی و ثبت دریافت توسط مسئول تولید در میز کار MES",
      });
      setNotice(tr(`هشدار ${alert.AlertCode} تأیید دریافت شد (v${alert.RowVersion + 1}).`, `Alert ${alert.AlertCode} acknowledged.`));
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  /* ── Phase 5 handlers: MPS, demand, lot sizing, ATP and splitting ── */
  function mpsBody(previewOnly: boolean) {
    const partIds = mpsForm.PartIds.split(",").map((v) => v.trim()).filter(Boolean);
    return {
      TimeBucket: mpsForm.TimeBucket,
      BucketCount: mpsForm.BucketCount,
      HorizonStart: mpsForm.HorizonStart || undefined,
      DemandTimeFenceBuckets: mpsForm.DemandTimeFenceBuckets,
      FirmPlannedTimeFenceBuckets: mpsForm.FirmPlannedTimeFenceBuckets,
      IncludeOpenOrdersAsReceipts: mpsForm.IncludeOpenOrdersAsReceipts,
      ConsumeForecast: mpsForm.ConsumeForecast,
      PreviewOnly: previewOnly,
      ...(partIds.length ? { PartIds: partIds } : {}),
    };
  }

  async function handleRunMps(previewOnly: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.runMasterSchedule(plantId, mfgUserId, mpsBody(previewOnly));
      setMpsResult(res);
      setMpsLines(res.lines ?? []);
      const count = res.lines?.length ?? 0;
      setNotice(
        previewOnly
          ? tr(`پیش‌نمایش MPS: ${count} سطر، بدون نوشتن در پایگاه‌داده.`, `MPS preview: ${count} lines, nothing persisted.`)
          : tr(`اجرای MPS شمارهٔ ${res.run?.RunNo ?? "?"} با ${count} سطر ثبت شد.`, `MPS run #${res.run?.RunNo ?? "?"} saved with ${count} lines.`),
      );
      if (!previewOnly) {
        const runRes = await MfgClient.listMasterScheduleRuns(plantId, mfgUserId, { limit: 20 });
        setMpsRuns(runRes.items ?? []);
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleFirmMps() {
    const run = mpsResult?.run ?? mpsRuns[0];
    if (!run) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.firmMasterScheduleLines(plantId, mfgUserId, run.Id, run.RowVersion, {});
      setNotice(tr(`${res.firmedLineCount} سطر تا سطل ${res.throughBucketIndex} قطعی شد.`, `${res.firmedLineCount} lines firmed through bucket ${res.throughBucketIndex}.`));
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  /* ── فاز ۵ بخش ۱۱: هندلرهای سفارش برنامه‌ریزی‌شده، CRP، pegging، نسخه و انطباق ── */

  /** بارگذاری فهرست سفارش‌های برنامه‌ریزی‌شده؛ مجوزش جدا از MPS است. */
  async function loadPlannedOrders() {
    if (!canMfgAccess(mfgUserId, "mfg.plannedorder.view", plantId)) {
      setPlannedOrders([]);
      return;
    }
    try {
      const res = await MfgClient.listPlannedOrders(plantId, mfgUserId, { limit: 100 });
      setPlannedOrders(res.items ?? []);
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleTransitionPlannedOrder(row: MfgPlannedOrder, action: "approve" | "reject") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = action === "approve"
        ? await MfgClient.approvePlannedOrder(plantId, mfgUserId, row.Id, row.RowVersion, {})
        : await MfgClient.rejectPlannedOrder(plantId, mfgUserId, row.Id, row.RowVersion, {
          RejectReasonFa: tr("برنامه‌ریز نیاز را تأیید نکرد", "Planner did not confirm the requirement"),
        });
      setNotice(tr(
        `سفارش ${row.PlannedOrderNo} به وضعیت «${updated.Status}» رفت.`,
        `Planned order ${row.PlannedOrderNo} moved to "${updated.Status}".`,
      ));
      await loadPlannedOrders();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleConvertPlannedOrder(row: MfgPlannedOrder) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.convertPlannedOrder(plantId, mfgUserId, row.Id, row.RowVersion, {});
      setNotice(tr(
        `سفارش تولید ${res.productionOrder.OrderNo} با ${res.operationCount} عملیات ساخته شد؛ هنوز آزاد نشده است.`,
        `Production order ${res.productionOrder.OrderNo} created with ${res.operationCount} operations; release is still pending.`,
      ));
      await Promise.all([loadPlannedOrders(), loadActiveTab()]);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCalculateCrp() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.calculateCapacityRequirements(plantId, mfgUserId, {
        Bucket: "week", BucketCount: 4, HorizonStart: PLANNING_HORIZON_START,
      });
      setCrpReport(res);
      const overloaded = res.totals.overloadBucketCount;
      setNotice(tr(
        `بار ${res.workCenters.length} مرکز کاری محاسبه شد؛ ${overloaded} سطل پربار و ${res.levelingSuggestions.length} پیشنهاد تسطیح.`,
        `Loaded ${res.workCenters.length} work centers; ${overloaded} overloaded buckets and ${res.levelingSuggestions.length} leveling suggestions.`,
      ));
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadLeadTimeAndPegging() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const [offset, pegging] = await Promise.all([
        MfgClient.getMrpLeadTimeOffset(plantId, mfgUserId),
        MfgClient.getMrpPegging(plantId, mfgUserId, { level: "multi" }),
      ]);
      setLeadTimeOffset(offset);
      setPeggingReport(pegging);
      setNotice(tr(
        `زمان تحویل تجمیعی محصول نهایی ${offset.finishedGoodsLeadTimeDays} روز؛ ${pegging.items.length} ردیف pegging.`,
        `Finished-goods cumulative lead time is ${offset.finishedGoodsLeadTimeDays} days; ${pegging.items.length} pegging rows.`,
      ));
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadProductionVersions() {
    if (!canMfgAccess(mfgUserId, "mfg.version.view", plantId)) {
      setProductionVersions([]);
      return;
    }
    try {
      const res = await MfgClient.listProductionVersions(plantId, mfgUserId, { limit: 100 });
      setProductionVersions(res.items ?? []);
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleCreateProductionVersion(partId: string) {
    if (!partId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await MfgClient.createProductionVersion(plantId, mfgUserId, {
        PartId: partId,
        VersionCode: `V${productionVersions.filter((row) => row.PartId === partId).length + 1}`,
        BomRevision: "A",
        RoutingRevision: "A",
        Priority: 1,
      });
      setNotice(tr(
        `نسخهٔ ${created.VersionCode} ساخته شد؛ BOM و Routing باید آزادشده باشند.`,
        `Version ${created.VersionCode} created; BOM and routing must be released.`,
      ));
      await loadProductionVersions();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadConformance() {
    if (!canMfgAccess(mfgUserId, "mfg.conformance.view", plantId)) {
      setConformance(null);
      return;
    }
    try {
      setConformance(await MfgClient.getIsa95Conformance(plantId, mfgUserId));
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleCreateDemand() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await MfgClient.createDemandForecast(plantId, mfgUserId, {
        PartId: demandForm.PartId,
        DemandType: demandForm.DemandType,
        DemandRef: demandForm.DemandRef,
        RequiredAt: demandForm.RequiredAt,
        Quantity: Number(demandForm.Quantity),
        ...(demandForm.ConfidencePct.trim() === "" ? {} : { ConfidencePct: Number(demandForm.ConfidencePct) }),
      });
      setNotice(tr(`تقاضای ${row.DemandRef} با مقدار ${row.Quantity} ثبت شد.`, `Demand ${row.DemandRef} for ${row.Quantity} created.`));
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDemand(demand: MfgDemandForecast) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await MfgClient.deleteDemandForecast(plantId, mfgUserId, demand.Id);
      setNotice(tr(`تقاضای ${demand.DemandRef} حذف شد.`, `Demand ${demand.DemandRef} deleted.`));
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadTimePhased() {
    setBusy(true);
    setError("");
    try {
      const res = await MfgClient.getTimePhasedDemand(plantId, mfgUserId, {
        ...(demandForm.PartId ? { partIds: demandForm.PartId } : {}),
        bucket: mpsForm.TimeBucket,
        bucketCount: mpsForm.BucketCount,
        horizonStart: mpsForm.HorizonStart || undefined,
      });
      setTimePhased(res);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLotPolicy() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const row = await MfgClient.createLotSizingPolicy(plantId, mfgUserId, {
        PartId: lotForm.PartId,
        RuleCode: lotForm.RuleCode,
        OrderingCost: lotForm.OrderingCost.trim() === "" ? null : Number(lotForm.OrderingCost),
        HoldingCostPerUnitPerYear: lotForm.HoldingCostPerUnitPerYear.trim() === "" ? null : Number(lotForm.HoldingCostPerUnitPerYear),
        AnnualDemandQty: lotForm.AnnualDemandQty.trim() === "" ? null : Number(lotForm.AnnualDemandQty),
        PeriodDays: lotForm.PeriodDays.trim() === "" ? null : Number(lotForm.PeriodDays),
        EffectiveFrom: lotForm.EffectiveFrom,
      });
      setNotice(tr(`سیاست ${row.RuleCode} ثبت شد${row.eoq ? ` (EOQ = ${row.eoq})` : ""}.`, `Policy ${row.RuleCode} saved${row.eoq ? ` (EOQ = ${row.eoq})` : ""}.`));
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleEvaluateLot() {
    setBusy(true);
    setError("");
    try {
      /* Dry run: the API computes the plan but writes nothing, so the grid can
       * be compared against the live MPS run without polluting history. */
      const res = await MfgClient.evaluateLotSizing(plantId, mfgUserId, {
        PartId: lotForm.PartId,
        Policy: {
          RuleCode: lotForm.RuleCode,
          OrderingCost: lotForm.OrderingCost.trim() === "" ? null : Number(lotForm.OrderingCost),
          HoldingCostPerUnitPerYear: lotForm.HoldingCostPerUnitPerYear.trim() === "" ? null : Number(lotForm.HoldingCostPerUnitPerYear),
          AnnualDemandQty: lotForm.AnnualDemandQty.trim() === "" ? null : Number(lotForm.AnnualDemandQty),
          PeriodDays: lotForm.PeriodDays.trim() === "" ? null : Number(lotForm.PeriodDays),
        },
        BucketUnit: mpsForm.TimeBucket,
        BucketCount: mpsForm.BucketCount,
        HorizonStart: mpsForm.HorizonStart || undefined,
      });
      setLotEvaluation(res);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAtpCheck() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.checkAtp(plantId, mfgUserId, {
        PartId: atpForm.PartId,
        RequestedQty: Number(atpForm.RequestedQty),
        RequestedAt: atpForm.RequestedAt,
        Mode: atpForm.Mode,
        IncludeForecast: atpForm.IncludeForecast,
        BucketUnit: mpsForm.TimeBucket,
        BucketCount: mpsForm.BucketCount,
        HorizonStart: mpsForm.HorizonStart || undefined,
      });
      setAtpResult(res);
      setAtpBuckets(res.buckets ?? []);
      const c = res.check;
      setNotice(
        c.status === "available"
          ? tr(`قابل تعهد: ${c.promisedQty} تا ${c.promisedAt}.`, `Available: ${c.promisedQty} by ${c.promisedAt}.`)
          : c.status === "delayed"
            ? tr(`با تأخیر: ${c.promisedQty} تا ${c.promisedAt} (${c.delayBuckets} سطل دیرتر).`, `Delayed: ${c.promisedQty} by ${c.promisedAt} (${c.delayBuckets} buckets later).`)
            : tr(`غیرقابل تعهد: کمبود ${c.shortageQty}.`, `Unavailable: shortage ${c.shortageQty}.`),
      );
      const history = await MfgClient.listAtpChecks(plantId, mfgUserId, { limit: 50 });
      setAtpChecks(history.items ?? []);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadSplits() {
    if (!splitForm.OrderId || !splitForm.OperationId) return;
    setBusy(true);
    setError("");
    try {
      const res = await MfgClient.listOperationSplits(plantId, mfgUserId, splitForm.OrderId, splitForm.OperationId);
      setSplitView(res);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReplaceSplits() {
    if (!splitForm.OrderId || !splitForm.OperationId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.replaceOperationSplits(plantId, mfgUserId, splitForm.OrderId, splitForm.OperationId, {
        SplitLotCount: Number(splitForm.SplitLotCount),
        ...(splitForm.TransferBatchQty.trim() === "" ? {} : { TransferBatchQty: Number(splitForm.TransferBatchQty) }),
        ...(splitForm.OverlapPct.trim() === "" ? {} : { OverlapPct: Number(splitForm.OverlapPct) }),
        OverlapAllowed: splitForm.OverlapAllowed,
        NoteFa: "تقسیم عملیات به لات‌های متوالی برای هم‌پوشانی با عملیات بعدی",
      });
      setNotice(tr(`${res.created} لات ثبت و ${res.deleted} لات قبلی حذف شد.`, `${res.created} lots created, ${res.deleted} replaced.`));
      await handleLoadSplits();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSplit(splitLotId: string) {
    setBusy(true);
    setError("");
    try {
      await MfgClient.deleteOperationSplit(plantId, mfgUserId, splitLotId);
      await handleLoadSplits();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLeadTimeAnalysis(orderId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await MfgClient.getLeadTimeAnalysis(plantId, mfgUserId, orderId);
      setLeadTime(res);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectBom(bomId: string) {
    setSelectedBomId(bomId);
    setExplosionLines([]);
    try {
      const res = await MfgClient.listBomItems(plantId, mfgUserId, bomId);
      setBomItems(res.items ?? []);
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleExplodeBom(bomId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await MfgClient.explodeBom(plantId, mfgUserId, bomId, { Quantity: 10 });
      setExplosionLines(res.lines ?? []);
      setNotice(tr(`انفجار چندسطحی BOM برای ضریب ۱۰ انجام شد (${res.lines?.length ?? 0} ردیف).`, `BOM exploded (${res.lines?.length ?? 0} lines).`));
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePartWithPlanning(e: React.FormEvent) {
    e.preventDefault();
    if (!newPartForm.PartNo.trim() || !newPartForm.NameFa.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await MfgClient.createPart(plantId, mfgUserId, {
        PartNo: newPartForm.PartNo.trim(),
        NameFa: newPartForm.NameFa.trim(),
        PartType: newPartForm.PartType,
        BaseUom: newPartForm.BaseUom.trim() || "ea",
        StandardUnitCost: Number(newPartForm.StandardUnitCost) || 0,
        Currency: "IRR",
        IsLotTracked: false,
        Planning: {
          ProcurementType: newPartForm.PartType === "purchased" ? "buy" : "make",
          LeadTimeDays: 3,
          SafetyStockQty: 5,
          LotSize: 10,
          OrderMultiple: 1,
          StandardUnitCost: Number(newPartForm.StandardUnitCost) || 0,
          Currency: "IRR",
          DefaultWarehouseCode: newPartForm.WarehouseCode || "WH-MAIN",
          OpeningInventory: {
            WarehouseCode: newPartForm.WarehouseCode || "WH-MAIN",
            OnHandQty: Number(newPartForm.OnHandQty) || 1,
            ReservedQty: 0,
            BlockedQty: 0,
          },
        },
      });
      setNotice(
        tr(
          `قطعه ${created.PartNo} همراه با مادهٔ برنامه‌ریزی و موجودی افتتاحیه در یک تراکنش ثبت شد.`,
          `Part ${created.PartNo} created atomically with planning material & opening inventory.`,
        ),
      );
      setNewPartForm((f) => ({ ...f, PartNo: "", NameFa: "" }));
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleInspectOrder(orderId: string) {
    setBusy(true);
    setError("");
    try {
      const detail = await MfgClient.getOrder(plantId, mfgUserId, orderId);
      setSelectedOrder(detail);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrderForm.OrderNo.trim() || !newOrderForm.PartId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await MfgClient.createOrder(plantId, mfgUserId, {
        OrderNo: newOrderForm.OrderNo.trim(),
        PartId: newOrderForm.PartId,
        OrderQuantity: Number(newOrderForm.OrderQuantity) || 10,
        Uom: newOrderForm.Uom || "ea",
        DueAt: newOrderForm.DueAt,
        PriorityRule: newOrderForm.PriorityRule,
        DispatchWeight: Number(newOrderForm.DispatchWeight) || 1,
        DemandSource: newOrderForm.DemandSource,
        ...(newOrderForm.DemandSource !== "manual" ? { DemandRef: newOrderForm.DemandRef || "SO-MES-01" } : {}),
      });
      setNotice(tr(`سفارش تولید ${created.OrderNo} با وضعیت ${created.Status} ایجاد شد.`, `Order ${created.OrderNo} created.`));
      setNewOrderForm((f) => ({ ...f, OrderNo: "" }));
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReprioritizeOrder(order: MfgOrderDetail, weightDelta: number) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const fresh = await MfgClient.getOrder(plantId, mfgUserId, order.Id);
      const nextWeight = Math.max(0.25, Number((fresh.DispatchWeight + weightDelta).toFixed(2)));
      const updated = await MfgClient.reprioritizeOrder(plantId, mfgUserId, fresh.Id, fresh.RowVersion, {
        PriorityRule: fresh.PriorityRule,
        DispatchWeight: nextWeight,
      });
      setNotice(tr(`وزن اعزام سفارش ${updated.OrderNo} به ${updated.DispatchWeight} تغییر یافت (v${updated.RowVersion}).`, `Order ${updated.OrderNo} DispatchWeight updated to ${updated.DispatchWeight}.`));
      await handleInspectOrder(fresh.Id);
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRunSchedule() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.runSchedule(plantId, mfgUserId, {
        Direction: scheduleForm.Direction,
        CapacityMode: scheduleForm.CapacityMode,
        DispatchRule: scheduleForm.DispatchRule,
        From: fromIso,
        To: toIso,
      });
      setLastScheduleResult(res);
      setNotice(
        tr(
          `زمان‌بندی نسخهٔ v${res.ScheduleVersion} ثبت شد (${res.assignments?.length ?? 0} قطعه تخصیص، ${res.unscheduled?.length ?? 0} زمان‌بندی‌نشده).`,
          `Schedule v${res.ScheduleVersion} saved (${res.assignments?.length ?? 0} segments).`,
        ),
      );
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleToggleRescheduleOp(opId: string) {
    setSelectedRescheduleOpIds((prev) =>
      prev.includes(opId) ? prev.filter((id) => id !== opId) : [...prev, opId],
    );
  }

  async function handleRescheduleSelected(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRescheduleOpIds.length) {
      setError(tr("حداقل یک عملیات قابل‌اعزام (pending / queued / ready) را برای باززمان‌بندی انتخاب کنید.", "Select at least one dispatchable operation to reschedule."));
      return;
    }
    const expectedVersion = gantt?.scheduleVersion ?? lastScheduleResult?.ScheduleVersion ?? 0;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.reschedule(plantId, mfgUserId, {
        ExpectedScheduleVersion: expectedVersion,
        OperationIds: selectedRescheduleOpIds,
        Reason: rescheduleReason.trim() || "باززمان‌بندی انتخابی از میز کار تولید",
        DispatchRule: rescheduleDispatchRule,
      });
      setLastRescheduleResult(res);
      setNotice(
        tr(
          `باززمان‌بندی از نسخهٔ v${res.PreviousScheduleVersion} به v${res.ScheduleVersion} ثبت شد (${res.diff?.changedOperationCount ?? 0} عملیات تغییریافته، ${res.diff?.movedCount ?? 0} قطعه جابه‌جاشده).`,
          `Rescheduled v${res.PreviousScheduleVersion} -> v${res.ScheduleVersion} (${res.diff?.changedOperationCount ?? 0} changed).`,
        ),
      );
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleInspectOpVariance(opId: string) {
    setSelectedOpId(opId);
    setBusy(true);
    setError("");
    try {
      const targetOp = queueOps.find((o) => o.Id === opId);
      const [vRes, resList] = await Promise.all([
        MfgClient.getOperationVariance(plantId, mfgUserId, opId),
        canMfgAccess(mfgUserId, "mfg.workcenter.view", plantId) && targetOp?.WorkCenterId
          ? MfgClient.listWorkCenterResources(plantId, mfgUserId, targetOp.WorkCenterId, { activeOnly: true, limit: 50 })
          : Promise.resolve({ items: [], page: { limit: 50, offset: 0, total: 0 } }),
      ]);
      setOpVariance(vRes);
      if (targetOp?.WorkCenterId) {
        setWcResources(resList.items ?? []);
        if (resList.items?.length) {
          setStartExecForm((f) => ({ ...f, ResourceId: resList.items[0].Id }));
        }
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartExecution(op: MfgOrderOperation) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const exec = await MfgClient.startExecution(plantId, mfgUserId, op.Id, {
        ...(startExecForm.ResourceId ? { ResourceId: startExecForm.ResourceId } : {}),
        ...(startExecForm.OperatorId ? { OperatorId: startExecForm.OperatorId } : {}),
        NoteFa: startExecForm.NoteFa || undefined,
      });
      setNotice(
        tr(
          `نشست اجرای #${exec.ExecutionNo} برای عملیات ${op.OperationCode} آغاز شد (Status: ${exec.Status}).`,
          `Execution #${exec.ExecutionNo} started for ${op.OperationCode}.`,
        ),
      );
      setSelectedOpId(op.Id);
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReportExecution(e: React.FormEvent, op: MfgOrderOperation) {
    e.preventDefault();
    const activeExec = op.ActiveExecution ?? opVariance?.Executions?.find((ex) => ex.Status === "running");
    if (!activeExec) {
      setError(tr("نشست اجرای فعالی (running) برای این عملیات یافت نشد؛ ابتدا نشست اجرا را آغاز کنید.", "No running execution session found."));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await MfgClient.reportExecution(plantId, mfgUserId, activeExec.Id, activeExec.RowVersion, {
        InputQuantity: Number(progressForm.InputQuantity) || 0,
        GoodQuantity: Number(progressForm.GoodQuantity) || 0,
        ScrapQuantity: Number(progressForm.ScrapQuantity) || 0,
        ReworkQuantity: Number(progressForm.ReworkQuantity) || 0,
        SetupActualMinutes: Number(progressForm.SetupActualMinutes) || 0,
        RunActualMinutes: Number(progressForm.RunActualMinutes) || 0,
        NoteFa: progressForm.NoteFa || undefined,
      });
      setNotice(
        tr(
          `گزارش پیشرفت روی نشست #${updated.ExecutionNo} ثبت شد (مجموع سالم: ${updated.GoodQuantity}، ورودی: ${updated.InputQuantity}، نسخه: v${updated.RowVersion}).`,
          `Progress reported on execution #${updated.ExecutionNo} (Good: ${updated.GoodQuantity}, v${updated.RowVersion}).`,
        ),
      );
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleFinishExecution(op: MfgOrderOperation) {
    const activeExec = op.ActiveExecution ?? opVariance?.Executions?.find((ex) => ex.Status === "running");
    if (!activeExec) {
      setError(tr("نشست در حال اجرا برای اتمام یافت نشد.", "No running execution session to finish."));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const finished = await MfgClient.finishExecution(plantId, mfgUserId, activeExec.Id, activeExec.RowVersion, {
        InspectionApproved: finishExecForm.InspectionApproved,
        NoteFa: finishExecForm.NoteFa || undefined,
      });
      setNotice(
        tr(
          `نشست اجرای #${finished.ExecutionNo} پایان یافت؛ وضعیت عملیات: ${finished.OperationStatus ?? finished.operation?.Status ?? "completed"}.`,
          `Execution #${finished.ExecutionNo} finished.`,
        ),
      );
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReportDowntime(e: React.FormEvent) {
    e.preventDefault();
    if (!downtimeForm.WorkCenterId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.reportDowntime(plantId, mfgUserId, {
        WorkCenterId: downtimeForm.WorkCenterId,
        ...(selectedOpId ? { OperationId: selectedOpId } : {}),
        DowntimeType: downtimeForm.DowntimeType,
        ReasonCode: downtimeForm.ReasonCode,
        StartedAt: downtimeForm.StartedAt,
        FinishedAt: downtimeForm.FinishedAt,
        NoteFa: downtimeForm.NoteFa,
      });
      setNotice(tr(`توقف مرکز کاری با مدت ${res.DurationMinutes ?? "—"} دقیقه ثبت شد.`, `Downtime recorded.`));
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReportScrap(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOpId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const activeOp = queueOps.find((o) => o.Id === selectedOpId);
      const res = await MfgClient.reportScrap(plantId, mfgUserId, {
        OperationId: selectedOpId,
        ...(activeOp?.ActiveExecution?.Id ? { ExecutionId: activeOp.ActiveExecution.Id } : {}),
        Quantity: Number(scrapForm.Quantity) || 0.1,
        Uom: scrapForm.Uom || "ea",
        ReasonCode: scrapForm.ReasonCode.trim() || "DIM-TOL",
        Disposition: scrapForm.Disposition,
        CostAmount: Number(scrapForm.CostAmount) || 0,
        Currency: "IRR",
        NoteFa: scrapForm.NoteFa || undefined,
      });
      setNotice(
        tr(
          `ضایعات به مقدار ${res.Quantity} ${res.Uom} با کد علت ${res.ReasonCode} ثبت شد.`,
          `Scrap (${res.Quantity} ${res.Uom}) recorded.`,
        ),
      );
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReportRework(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOpId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const activeOp = queueOps.find((o) => o.Id === selectedOpId);
      const res = await MfgClient.reportRework(plantId, mfgUserId, {
        SourceOperationId: selectedOpId,
        ...(reworkForm.TargetOperationId ? { TargetOperationId: reworkForm.TargetOperationId } : {}),
        ...(activeOp?.ActiveExecution?.Id ? { ExecutionId: activeOp.ActiveExecution.Id } : {}),
        Quantity: Number(reworkForm.Quantity) || 0.1,
        Uom: reworkForm.Uom || "ea",
        ReasonCode: reworkForm.ReasonCode.trim() || "SURF-BURR",
        Disposition: reworkForm.Disposition,
        NoteFa: reworkForm.NoteFa || undefined,
      });
      setNotice(
        tr(
          `دستور دوباره‌کاری ${res.ReworkNo} برای مقدار ${res.Quantity} ${res.Uom} صادر شد (وضعیت: ${res.Status}).`,
          `Rework order ${res.ReworkNo} created.`,
        ),
      );
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRunMrp(previewOnly: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.calculateMrp(plantId, mfgUserId, {
        ThroughDate: mrpHorizonIso || "2026-12-31T23:59:59.000Z",
        ...(mrpTargetOrderId ? { OrderIds: [mrpTargetOrderId] } : {}),
        PreviewOnly: previewOnly,
      });
      setMrpResult(res);
      setNotice(
        tr(
          `محاسبهٔ MRP (${previewOnly ? "پیش‌نمایش" : "ثبت اتمیک + صدور خودکار هشدار کمبود"}): ${res.requirements?.length ?? 0} نیازمندی، ${res.shortages?.length ?? 0} کمبود.`,
          `MRP (${previewOnly ? "preview" : "committed"}): ${res.requirements?.length ?? 0} requirements, ${res.shortages?.length ?? 0} shortages.`,
        ),
      );
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleToggleShortage(reqId: string) {
    setSelectedShortageIds((prev) =>
      prev.includes(reqId) ? prev.filter((id) => id !== reqId) : [...prev, reqId],
    );
  }

  async function handleCreateProposal() {
    const targetIds = selectedShortageIds.length ? selectedShortageIds : shortages.map((s) => s.Id);
    if (!targetIds.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.createProcurementProposal(plantId, mfgUserId, {
        ThroughDate: mrpHorizonIso || "2026-12-31T23:59:59.000Z",
        RequirementIds: targetIds,
        NoteFa: proposalNoteFa.trim() || "پیشنهاد تأمین صادرشده از فضای کاری مستقل MES",
      });
      setProposalResult(res);
      setNotice(
        tr(
          `پیشنهاد تأمین برای ${targetIds.length} ردیف کمبود (${res.proposalsCount ?? res.proposals?.length ?? 0} محمولهٔ تجمیعی) صادر شد.`,
          `Procurement proposal created for ${targetIds.length} shortages.`,
        ),
      );
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleSelectMaterialForConsume(mat: MfgMaterial) {
    const firstLoc = mat.InventoryLocations?.[0];
    setConsumeForm((f) => ({
      ...f,
      MaterialId: mat.Id,
      Uom: mat.BaseUom || "ea",
      UnitCost: mat.StandardUnitCost ?? f.UnitCost,
      WarehouseCode: firstLoc?.WarehouseCode || mat.DefaultWarehouseCode || "WH-MAIN",
      LotNo: firstLoc?.LotNo || "",
    }));
  }

  function handleSelectShortageForConsume(sh: MfgMaterialRequirement) {
    const mat = materials.find((m) => m.Id === sh.MaterialId);
    const firstLoc = mat?.InventoryLocations?.[0];
    setConsumeForm((f) => ({
      ...f,
      RequirementId: sh.Id,
      OperationId: sh.ProductionOrderOperationId || f.OperationId,
      MaterialId: sh.MaterialId,
      Quantity: Math.max(0.1, sh.AvailableQuantity > 0 ? sh.AvailableQuantity : 1),
      Uom: sh.Uom || mat?.BaseUom || "ea",
      UnitCost: sh.StandardUnitCost ?? mat?.StandardUnitCost ?? f.UnitCost,
      WarehouseCode: firstLoc?.WarehouseCode || mat?.DefaultWarehouseCode || "WH-MAIN",
      LotNo: firstLoc?.LotNo || "",
    }));
  }

  async function handleConsumeMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!consumeForm.OperationId || !consumeForm.MaterialId) {
      setError(tr("انتخاب عملیات و ماده برای ثبت مصرف الزامی است.", "Operation and Material are required."));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await MfgClient.consumeMaterial(plantId, mfgUserId, {
        OperationId: consumeForm.OperationId,
        ...(consumeForm.RequirementId ? { RequirementId: consumeForm.RequirementId } : {}),
        MaterialId: consumeForm.MaterialId,
        Quantity: Number(consumeForm.Quantity) || 1,
        Uom: consumeForm.Uom || "ea",
        ...(consumeForm.LotNo.trim() ? { LotNo: consumeForm.LotNo.trim() } : {}),
        ...(consumeForm.WarehouseCode.trim() ? { WarehouseCode: consumeForm.WarehouseCode.trim() } : {}),
        UnitCost: Number(consumeForm.UnitCost) || 0,
        Currency: "IRR",
        ConsumptionMethod: consumeForm.ConsumptionMethod,
      });
      setNotice(
        tr(
          `مصرف واقعی ماده (${res.Quantity} ${res.Uom}) با موفقیت ثبت و از موجودی انبار کسر شد.`,
          `Material consumption (${res.Quantity} ${res.Uom}) recorded and deducted from inventory.`,
        ),
      );
      await loadActiveTab();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectCostOrder(orderId: string) {
    setCostOrderId(orderId);
    setBusy(true);
    setError("");
    try {
      const [cRes, detail] = await Promise.all([
        MfgClient.getOrderCost(plantId, mfgUserId, orderId),
        MfgClient.getOrder(plantId, mfgUserId, orderId),
      ]);
      setOrderCost(cRes);
      setSelectedOrder(detail);
      if (detail.Operations?.length) {
        const opId = detail.Operations[0].Id;
        setCostOpId(opId);
        const opRes = await MfgClient.getOperationCost(plantId, mfgUserId, opId);
        setOpCosts(opRes);
      } else {
        setOpCosts(null);
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectCostOp(opId: string) {
    setCostOpId(opId);
    setBusy(true);
    setError("");
    try {
      const opRes = await MfgClient.getOperationCost(plantId, mfgUserId, opId);
      setOpCosts(opRes);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReconcileOrderCost() {
    if (!costOrderId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const freshOrder = await MfgClient.getOrder(plantId, mfgUserId, costOrderId);
      const reconciled = await MfgClient.reconcileOrderCost(plantId, mfgUserId, costOrderId, freshOrder.RowVersion, {
        CostVersion: orderCost?.CostVersion ?? 1,
        ReconcileThrough: new Date().toISOString(),
      });
      setOrderCost(reconciled);
      setNotice(tr(`تطبیق نهایی هزینهٔ سفارش ${freshOrder.OrderNo} با موفقیت ثبت شد.`, `Order ${freshOrder.OrderNo} cost reconciled.`));
      await handleSelectCostOrder(costOrderId);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir={fa ? "rtl" : "ltr"} className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto ${standalone ? "h-screen w-screen p-4 bg-[var(--bg)]" : "p-1"}`}>
      {/* ── نوار فرمان سامانهٔ مستقل برنامه‌ریزی و کنترل تولید (Standalone MES) ── */}
      <header className="glass-dark rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border b-line-soft text-base">🏭</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="tx1 font-semibold">
                {tr("سامانهٔ مستقل برنامه‌ریزی و کنترل تولید (Standalone MES)", "Standalone Manufacturing Execution System (MES)")}
              </h3>
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300" dir="ltr">
                mfg-api-v1 · 65 REST Routes
              </span>
            </div>
            <p className="tx3 text-xs mt-0.5">
              {tr(
                "دیتابیس مستقل (۲۶ جدول Mfg*) · بک‌اند مستقل کارخانه‌محور · فرانت‌اند مستقل · ارتباط با سامانه‌های دیگر فقط از طریق REST API",
                "Independent DB (26 Mfg* tables) · Plant-scoped backend · Standalone frontend · External integration via REST API only",
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="tx3 text-xs flex items-center gap-1.5">
            <span>{tr("کارخانه:", "Plant:")}</span>
            <input
              aria-label="Plant ID"
              className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1 text-xs tx1 w-28"
              dir="ltr"
              value={plantId}
              onChange={(e) => setPlantId(e.target.value.trim() || DEFAULT_PLANT_ID)}
            />
          </label>

          <label className="tx3 text-xs flex items-center gap-1.5">
            <span>{tr("نقش کارگاهی (RBAC):", "MES Role:")}</span>
            <select
              aria-label="MES User"
              className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1 text-xs tx1"
              value={mfgUserId}
              onChange={(e) => {
                setAutoRoleFollow(false);
                setMfgUserId(e.target.value);
              }}
            >
              {MFG_DEMO_USERS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id} — {fa ? u.fa : u.en}
                </option>
              ))}
            </select>
          </label>

          <label className="tx3 text-xs flex items-center gap-1 cursor-pointer" title={tr("تطبیق خودکار نقش با تب فعال", "Auto-switch role per tab")}>
            <input
              type="checkbox"
              checked={autoRoleFollow}
              onChange={(e) => setAutoRoleFollow(e.target.checked)}
            />
            <span>{tr("نقش خودکار", "Auto-role")}</span>
          </label>

          <button className={btnCls} disabled={loading || busy} onClick={() => void loadActiveTab()}>
            {tr("تازه‌سازی", "Refresh")}
          </button>

          {standalone ? (
            onExitStandalone && (
              <button className={btnCls} onClick={onExitStandalone}>
                {tr("بازگشت به پورتال", "Exit standalone")}
              </button>
            )
          ) : (
            <a
              href="?app=mes"
              target="_blank"
              rel="noreferrer"
              className={btnCls}
              title={tr("باز کردن در پنجرهٔ کاملاً مستقل MES", "Open in standalone MES window")}
            >
              {tr("پنجرهٔ مستقل MES ↗", "Standalone MES ↗")}
            </a>
          )}
        </div>
      </header>

      {/* ── نوار تب‌های ۷گانهٔ MES ── */}
      <nav className="flex flex-wrap gap-1.5">
        {TABS.map((tItem) => {
          const allowed = canMfgAccess(mfgUserId, tItem.permission, plantId);
          return (
            <button
              key={tItem.id}
              type="button"
              onClick={() => {
                setTab(tItem.id);
                onTabChange?.(tItem.id);
              }}
              className={`${btnCls} flex items-center gap-1.5 ${tab === tItem.id ? "toggle-on tx1" : "tx2"}`}
            >
              <span>{fa ? tItem.fa : tItem.en}</span>
              <span
                className={`h-2 w-2 rounded-full ${allowed ? "bg-emerald-400" : "bg-amber-400"}`}
                title={allowed ? tr("مجوز فعال", "Permitted") : tr(`نیازمند ${tItem.permission}`, `Requires ${tItem.permission}`)}
              />
            </button>
          );
        })}
      </nav>

      {/* ── وضعیت نقش فعال و بازهٔ زمانی ── */}
      <div className="glass rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs tx3">
        <div>
          <span>{tr("کاربر فعال MES:", "Active MES Subject:")} </span>
          <strong className="tx1" dir="ltr">{mfgUserId}</strong>
          {activeUserMeta && <span> — {fa ? activeUserMeta.fa : activeUserMeta.en}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2" dir="ltr">
          <span>Window:</span>
          <input
            type="text"
            aria-label="From ISO"
            className="rounded border b-line-soft bg-[var(--row)] px-2 py-0.5 text-xs tx1 w-44"
            value={fromIso}
            onChange={(e) => setFromIso(e.target.value)}
          />
          <span>→</span>
          <input
            type="text"
            aria-label="To ISO"
            className="rounded border b-line-soft bg-[var(--row)] px-2 py-0.5 text-xs tx1 w-44"
            value={toIso}
            onChange={(e) => setToIso(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button className={btnCls} onClick={() => setError("")}>{tr("بستن", "Dismiss")}</button>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button className={btnCls} onClick={() => setNotice("")}>{tr("بستن", "Dismiss")}</button>
        </div>
      )}

      {loading && <p className="tx3 text-xs p-2">{tr("در حال دریافت دادهٔ زنده از سرور MES…", "Loading live MES data…")}</p>}

      {/* ══════════════════════ ۱) تب داشبورد، OEE و هشدارها ══════════════════════ */}
      {!loading && tab === "overview" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-dark rounded-xl p-3">
              <div className="tx3 text-xs">{tr("سفارش‌های باز / کل", "Open / Total Orders")}</div>
              <div className="tx1 text-base font-semibold mt-1" dir="ltr">
                {overviewData?.orders?.openCount ?? overviewData?.openOrdersCount ?? "—"} / {overviewData?.orders?.totalCount ?? overviewData?.totalOrdersCount ?? "—"}
              </div>
              <div className="tx3 text-xs mt-1">
                {tr("بسته‌شده:", "Closed:")} {overviewData?.orders?.closedCount ?? "—"}
              </div>
            </div>
            <div className="glass-dark rounded-xl p-3">
              <div className="tx3 text-xs">{tr("شاخص کل اثربخشی تجهیزات (OEE)", "Overall Equipment Effectiveness (OEE)")}</div>
              <div className="tx1 text-base font-semibold mt-1" dir="ltr">
                {oeeData?.oeePct != null ? `${oeeData.oeePct}%` : "—"}
              </div>
              <div className="tx3 text-xs mt-1" dir="ltr">
                A: {oeeData?.availability?.pct ?? "—"}% · P: {oeeData?.performance?.pct ?? "—"}% · Q: {oeeData?.quality?.pct ?? "—"}%
              </div>
            </div>
            <div className="glass-dark rounded-xl p-3">
              <div className="tx3 text-xs">{tr("توقف برنامه‌ریزی‌شده / ناخواسته (دقیقه)", "Planned / Unplanned Downtime (min)")}</div>
              <div className="tx1 text-base font-semibold mt-1" dir="ltr">
                {oeeData?.downtime?.plannedMinutes ?? 0} / {oeeData?.downtime?.unplannedMinutes ?? 0}
              </div>
              <div className="tx3 text-xs mt-1">
                {tr("خروجی سالم:", "Good Qty:")} {overviewData?.production?.goodQuantity ?? oeeData?.quality?.goodQuantity ?? "—"}
              </div>
            </div>
            <div className="glass-dark rounded-xl p-3">
              <div className="tx3 text-xs">{tr("هشدارهای فعال کارگاه", "Active Plant Alerts")}</div>
              <div className="tx1 text-base font-semibold mt-1" dir="ltr">
                {alerts.filter((a) => a.Status === "open").length} / {alerts.length}
              </div>
              <div className="tx3 text-xs mt-1">
                {tr("شدت باز:", "Open by severity:")} C {overviewData?.alerts?.bySeverity?.critical ?? 0} · H {overviewData?.alerts?.bySeverity?.high ?? 0} · M {overviewData?.alerts?.bySeverity?.medium ?? 0} · L {overviewData?.alerts?.bySeverity?.low ?? 0}
              </div>
              <div className="tx3 text-xs mt-1">
                {tr("ضایعات ثبت‌شده:", "Scrap Qty:")} {overviewData?.production?.scrapQuantity ?? oeeData?.quality?.scrapQuantity ?? "—"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="glass-dark rounded-xl p-3">
              <div className="tx3 text-xs">{tr("تحویل به‌موقع (OTD) سفارش‌های موعددار", "On-Time Delivery (OTD) for Due Orders")}</div>
              <div className="tx1 text-base font-semibold mt-1" dir="ltr">
                {overviewData?.onTimeDeliveryPct == null ? "—" : `${overviewData.onTimeDeliveryPct}%`}
              </div>
              <div className="tx3 text-xs mt-1">
                {tr("موعد این بازه:", "Due this window:")} {overviewData?.orders?.dueInWindowCount ?? 0}
                {" · "}{tr("عقب‌افتادهٔ باز:", "Open late:")} {overviewData?.orders?.openLateCount ?? 0}
              </div>
            </div>
            <div className="glass-dark rounded-xl p-3">
              <div className="tx3 text-xs">{tr("کمبودهای باز MRP", "Open MRP Shortages")}</div>
              <div className="tx1 text-base font-semibold mt-1" dir="ltr">
                {overviewData?.shortages?.openCount ?? overviewData?.openShortagesCount ?? 0}
              </div>
              <div className="tx3 text-xs mt-1" dir="ltr">
                {tr("مقدار کمبود:", "Short quantity:")} {overviewData?.shortages?.totalQuantity ?? overviewData?.totalShortageQuantity ?? 0}
                {" · "}{tr("در بازه:", "Due in window:")} {overviewData?.shortages?.dueInWindowCount ?? 0}
              </div>
            </div>
            <div className="glass-dark rounded-xl p-3">
              <div className="tx3 text-xs">{tr("انحراف هزینهٔ سفارش‌ها", "Production Order Cost Variance")}</div>
              <div className="tx1 text-base font-semibold mt-1" dir="ltr">
                {overviewData?.costSummary?.available && overviewData?.costSummary?.currency
                  ? `${overviewData.costSummary.costVariance?.toLocaleString() ?? 0} ${overviewData.costSummary.currency}`
                  : "—"}
                {overviewData?.costSummary?.available && overviewData?.costSummary?.costVariancePct != null
                  ? ` (${overviewData.costSummary.costVariancePct}%)`
                  : ""}
              </div>
              <div className="tx3 text-xs mt-1" dir="ltr">
                {overviewData?.costSummary?.available
                  ? `${tr("Actual:", "Actual:")} ${overviewData.costSummary.actualTotalCost?.toLocaleString() ?? 0} ${overviewData.costSummary.currency ?? ""}`
                  : tr("برای نقش فعلی در دسترس نیست", "Not available to this role")}
              </div>
            </div>
          </div>

          <section className="glass-dark rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="tx1 font-semibold">{tr("OEE کارخانه به تفکیک Work Center", "Plant OEE by Work Center")}</h4>
              <span className="tx3 text-xs" dir="ltr">
                {tr("وضعیت سفارش:", "Order status:")} {overviewData?.statusCounts?.created ?? 0} {tr("ایجادشده", "created")} · {overviewData?.statusCounts?.released ?? 0} {tr("آزادشده", "released")} · {overviewData?.statusCounts?.["in-progress"] ?? 0} {tr("در اجرا", "in progress")} · {overviewData?.statusCounts?.completed ?? 0} {tr("تکمیل", "completed")}
              </span>
            </div>
            {!oeeData?.workCenters?.length ? (
              <p className="tx3 text-xs">{tr("دادهٔ تقویم یا مرکز کاری برای این بازه در دسترس نیست.", "No work-center calendar data in this window.")}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {oeeData.workCenters.map((center: any) => (
                  <article key={center.workCenterId} className="rounded-lg border b-line-soft p-2.5 text-xs tx2">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="tx1">{center.workCenterCode} — {center.workCenterNameFa}</strong>
                      <strong dir="ltr">{center.oeePct == null ? "—" : `${center.oeePct}%`}</strong>
                    </div>
                    <div className="tx3 mt-1" dir="ltr">
                      A {center.availability.pct ?? "—"}% · P {center.performance.pct ?? "—"}% · Q {center.quality.pct ?? "—"}%
                    </div>
                    <div className="tx3 mt-1" dir="ltr">
                      {tr("تقویم:", "Calendar:")} {center.calendar.availableMinutes} {tr("دقیقه", "min")} · {tr("توقف ناخواسته:", "Unplanned:")} {center.downtime.unplannedMinutes} {tr("دقیقه", "min")}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {!!oeeData?.bottlenecks?.length && (
              <p className="tx3 text-[11px]">
                {tr("پایین‌ترین OEE:", "Lowest OEE:")} {oeeData.bottlenecks.map((item: any) => `${item.workCenterCode} (${item.oeePct}%)`).join(" · ")}
              </p>
            )}
          </section>

          <section className="glass-dark rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="tx1 font-semibold">{tr("فهرست هشدارهای کارگاه و کمبودهای مواد (GET /alerts)", "Plant & Shortage Alerts")}</h4>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  aria-label="Alert Status Filter"
                  className="rounded border b-line-soft bg-[var(--row)] px-2 py-1 text-xs tx1"
                  value={alertFilterStatus}
                  onChange={(e) => setAlertFilterStatus(e.target.value)}
                >
                  <option value="">{tr("همهٔ وضعیت‌ها", "All Statuses")}</option>
                  <option value="open">open (باز)</option>
                  <option value="acknowledged">acknowledged (رسیدگی‌شده)</option>
                  <option value="resolved">resolved (برطرف‌شده)</option>
                  <option value="suppressed">suppressed (مسکوت)</option>
                </select>
                <select
                  aria-label="Alert Severity Filter"
                  className="rounded border b-line-soft bg-[var(--row)] px-2 py-1 text-xs tx1"
                  value={alertFilterSeverity}
                  onChange={(e) => setAlertFilterSeverity(e.target.value)}
                >
                  <option value="">{tr("همهٔ شدت‌ها", "All Severities")}</option>
                  <option value="critical">critical (بحرانی)</option>
                  <option value="high">high (بالا)</option>
                  <option value="medium">medium (متوسط)</option>
                  <option value="low">low (پایین)</option>
                </select>
              </div>
            </div>
            {!alerts.length ? (
              <p className="tx3 text-xs">{tr("هشداری مطابق فیلترهای انتخابی در این کارخانه یافت نشد.", "No alerts recorded.")}</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((al) => (
                  <article key={al.Id} className="rounded-lg border b-line-soft p-2.5 space-y-1.5 text-xs tx2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong className="tx1">{al.TitleFa}</strong>
                        <span className="mx-2 tx3" dir="ltr">
                          [{al.AlertCode} · {al.Severity} · {al.Status} · Occurrences: {al.OccurrenceCount} · v{al.RowVersion}]
                        </span>
                      </div>
                      <span className="tx3 text-[11px]" dir="ltr">
                        {al.OrderNo ? `Order: ${al.OrderNo} ` : ""}
                        {al.OperationCode ? `· Op: ${al.OperationCode} ` : ""}
                        {al.WorkCenterCode ? `· WC: ${al.WorkCenterCode}` : ""}
                      </span>
                    </div>
                    {al.DetailFa && <p className="tx3 text-xs">{al.DetailFa}</p>}
                    {(al.ActualValue != null || al.ThresholdValue != null || al.AcknowledgedBy || al.ResolvedAt) && (
                      <div className="flex flex-wrap gap-3 text-[11px] tx3" dir="ltr">
                        {al.ActualValue != null && <span>Actual: <strong>{al.ActualValue}</strong></span>}
                        {al.ThresholdValue != null && <span>Threshold/Net: <strong>{al.ThresholdValue}</strong></span>}
                        {al.AcknowledgedBy && <span>Ack By: <strong>{al.AcknowledgedBy}</strong> ({al.AcknowledgedAt?.slice(0, 16).replace("T", " ")})</span>}
                        {al.ResolvedAt && <span className="text-emerald-300">Resolved: {al.ResolvedAt.slice(0, 16).replace("T", " ")}</span>}
                      </div>
                    )}
                    {al.Status === "open" && canMfgAccess(mfgUserId, "mfg.alert.ack", plantId) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          className="flex-1 rounded border b-line-soft bg-[var(--row)] px-2 py-1 text-xs tx1"
                          placeholder={tr("یادداشت رسیدگی به هشدار (NoteFa)...", "Acknowledgement note...")}
                          value={ackNotesByAlertId[al.Id] ?? ""}
                          onChange={(e) => setAckNotesByAlertId((prev) => ({ ...prev, [al.Id]: e.target.value }))}
                        />
                        <button className={btnCls} disabled={busy} onClick={() => void handleAckAlert(al)}>
                          {tr("تأیید دریافت با If-Match (POST /alerts/:id/acknowledgements)", "Acknowledge")}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ══════════════════════ ۲) تب مهندسی ساخت ══════════════════════ */}
      {!loading && tab === "engineering" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* فهرست قطعات + فرم ساخت قطعه با بلوک Planning */}
            <section className="glass-dark rounded-xl p-3 space-y-3">
              <h4 className="tx1 font-semibold">{tr("قطعات و محصولات (MfgPart + Planning)", "Parts & Master Planning")}</h4>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {parts.map((p) => (
                  <div key={p.Id} className="rounded-lg border b-line-soft p-2 flex flex-wrap items-center justify-between gap-2 text-xs tx2">
                    <div>
                      <strong className="tx1" dir="ltr">{p.PartNo}</strong> — <span>{p.NameFa}</span>
                    </div>
                    <span className="tx3" dir="ltr">
                      {p.PartType} · {p.BaseUom} · {p.StandardUnitCost?.toLocaleString() ?? 0} {p.Currency} · v{p.RowVersion}
                    </span>
                  </div>
                ))}
              </div>

              {canMfgAccess(mfgUserId, "mfg.part.edit", plantId) && (
                <form onSubmit={handleCreatePartWithPlanning} className="border-t b-line-soft pt-3 space-y-2">
                  <div className="tx1 text-xs font-medium">
                    {tr("ثبت قطعهٔ جدید همراه با بلوک اتمیک Planning و موجودی افتتاحیه", "Create Part + Atomic Planning & Opening Inventory")}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <input
                      placeholder={tr("کد قطعه (مثلاً RM-ROD-20)", "PartNo")}
                      className={inputCls}
                      dir="ltr"
                      value={newPartForm.PartNo}
                      onChange={(e) => setNewPartForm((f) => ({ ...f, PartNo: e.target.value }))}
                    />
                    <input
                      placeholder={tr("نام فارسی قطعه", "NameFa")}
                      className={inputCls}
                      value={newPartForm.NameFa}
                      onChange={(e) => setNewPartForm((f) => ({ ...f, NameFa: e.target.value }))}
                    />
                    <select
                      aria-label="PartType"
                      className={inputCls}
                      value={newPartForm.PartType}
                      onChange={(e) => setNewPartForm((f) => ({ ...f, PartType: e.target.value as MfgPart["PartType"] }))}
                    >
                      <option value="manufactured">manufactured</option>
                      <option value="purchased">purchased</option>
                      <option value="phantom">phantom</option>
                      <option value="subcontract">subcontract</option>
                    </select>
                    <input
                      type="number"
                      placeholder={tr("بهای استاندارد", "StandardUnitCost")}
                      className={inputCls}
                      value={newPartForm.StandardUnitCost}
                      onChange={(e) => setNewPartForm((f) => ({ ...f, StandardUnitCost: Number(e.target.value) }))}
                    />
                    <input
                      placeholder={tr("کد انبار", "WarehouseCode")}
                      className={inputCls}
                      dir="ltr"
                      value={newPartForm.WarehouseCode}
                      onChange={(e) => setNewPartForm((f) => ({ ...f, WarehouseCode: e.target.value }))}
                    />
                    <input
                      type="number"
                      placeholder={tr("موجودی افتتاحیه", "OnHandQty")}
                      className={inputCls}
                      value={newPartForm.OnHandQty}
                      onChange={(e) => setNewPartForm((f) => ({ ...f, OnHandQty: Number(e.target.value) }))}
                    />
                  </div>
                  <button type="submit" className={btnCls} disabled={busy}>
                    {tr("ثبت قطعه + ماده + موجودی افتتاحیه", "Create Part + Planning")}
                  </button>
                </form>
              )}
            </section>

            {/* مراکز کاری */}
            <section className="glass-dark rounded-xl p-3 space-y-2">
              <h4 className="tx1 font-semibold">{tr("مراکز کاری کارخانه (MfgWorkCenter)", "Work Centers")}</h4>
              <div className="space-y-1.5">
                {workCenters.map((wc) => (
                  <div key={wc.Id} className="rounded-lg border b-line-soft p-2 flex flex-wrap items-center justify-between gap-2 text-xs tx2">
                    <div>
                      <strong className="tx1" dir="ltr">{wc.Code}</strong> — <span>{wc.NameFa}</span>
                    </div>
                    <span className="tx3" dir="ltr">
                      {wc.Kind} · {wc.NominalCapacityMinutesPerDay} min/day · Eff {wc.EfficiencyPct}% · {wc.Status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* BOM و انفجار چندسطحی */}
            <section className="glass-dark rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="tx1 font-semibold">{tr("ساختار محصول (BOM) و انفجار چندسطحی", "BOM & Multi-level Explosion")}</h4>
                {selectedBomId && (
                  <button className={btnCls} disabled={busy} onClick={() => void handleExplodeBom(selectedBomId)}>
                    {tr("انفجار BOM (ضریب ۱۰)", "Explode BOM (×10)")}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bomHeaders.map((b) => (
                  <button
                    key={b.Id}
                    className={`${btnCls} ${selectedBomId === b.Id ? "toggle-on" : ""}`}
                    onClick={() => void handleSelectBom(b.Id)}
                  >
                    {parts.find((p) => p.Id === b.PartId)?.PartNo ?? b.PartId} · Rev {b.Revision} ({b.Status})
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                {bomItems.map((item) => (
                  <div key={item.Id} className="rounded border b-line-soft p-2 text-xs tx2 flex justify-between">
                    <span>
                      #{item.LineNo} — {parts.find((p) => p.Id === item.ComponentPartId)?.NameFa ?? item.ComponentPartId}
                    </span>
                    <span dir="ltr">
                      QtyPer: {item.QuantityPer} {item.Uom} · Scrap: {item.ScrapPct}% · Op: {item.IssueAtOperationCode ?? "—"} ({item.IssueMethod})
                    </span>
                  </div>
                ))}
              </div>
              {explosionLines.length > 0 && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-2 space-y-1 text-xs tx2">
                  <div className="tx1 font-medium">{tr("نتیجهٔ انفجار چندسطحی (POST /bom-headers/:id/explosions):", "Explosion Result:")}</div>
                  {explosionLines.map((line, idx) => (
                    <div key={idx} className="flex justify-between" dir="ltr">
                      <span>L{line.Depth} · {parts.find((p) => p.Id === line.PartId)?.PartNo ?? line.PartId}</span>
                      <span>Gross: {line.GrossQuantity} · Scrap: {line.ScrapAllowanceQty} · Net: {line.NetQuantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* مسیر ساخت و عملیات */}
            <section className="glass-dark rounded-xl p-3 space-y-2">
              <h4 className="tx1 font-semibold">{tr("مسیر ساخت و توالی عملیات (MfgRouting)", "Routings & Operations")}</h4>
              <div className="flex flex-wrap gap-1.5">
                {routings.map((r) => (
                  <button
                    key={r.Id}
                    className={`${btnCls} ${selectedRoutingId === r.Id ? "toggle-on" : ""}`}
                    onClick={async () => {
                      setSelectedRoutingId(r.Id);
                      const ops = await MfgClient.listRoutingOperations(plantId, mfgUserId, r.Id);
                      setRoutingOps(ops.items ?? []);
                    }}
                  >
                    {r.RoutingCode} · Rev {r.Revision} ({r.Status})
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                {routingOps.map((op) => (
                  <div key={op.Id} className="rounded border b-line-soft p-2 text-xs tx2 flex justify-between">
                    <span>
                      <strong className="tx1" dir="ltr">{op.SequenceNo} · {op.OperationCode}</strong> — {op.OperationNameFa}
                    </span>
                    <span dir="ltr">
                      Setup: {op.SetupMinutes}m · Run/u: {op.RunMinutesPerUnit}m · QC: {op.InspectionRequired ? "Yes" : "No"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ══════════════════════ ۳) تب سفارش‌های تولید ══════════════════════ */}
      {!loading && tab === "orders" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <section className="glass-dark rounded-xl p-3 space-y-3">
            <h4 className="tx1 font-semibold">{tr("فهرست سفارش‌های تولید کارخانه (MfgProductionOrder)", "Plant Production Orders")}</h4>
            <div className="space-y-2">
              {orders.map((ord) => (
                <article
                  key={ord.Id}
                  className={`rounded-lg border b-line-soft p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs tx2 ${
                    selectedOrder?.Id === ord.Id ? "toggle-on" : ""
                  }`}
                >
                  <div>
                    <strong className="tx1" dir="ltr">{ord.OrderNo}</strong>
                    <span className="mx-2">({ord.Status})</span>
                    <span className="tx3" dir="ltr">
                      Qty: {ord.OrderQuantity} {ord.Uom} · Weight: {ord.DispatchWeight} · Rule: {ord.PriorityRule} · v{ord.RowVersion}
                    </span>
                  </div>
                  <button className={btnCls} onClick={() => void handleInspectOrder(ord.Id)}>
                    {tr("مشاهدهٔ عملیات", "Inspect Operations")}
                  </button>
                </article>
              ))}
            </div>

            {canMfgAccess(mfgUserId, "mfg.order.create", plantId) && (
              <form onSubmit={handleCreateOrder} className="border-t b-line-soft pt-3 space-y-2">
                <div className="tx1 text-xs font-medium">{tr("ایجاد سفارش تولید جدید (POST /orders)", "Create Production Order")}</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder={tr("شماره سفارش (مثلاً MO-DEMO-0003)", "OrderNo")}
                    className={inputCls}
                    dir="ltr"
                    value={newOrderForm.OrderNo}
                    onChange={(e) => setNewOrderForm((f) => ({ ...f, OrderNo: e.target.value }))}
                  />
                  <select
                    aria-label="Order Part"
                    className={inputCls}
                    value={newOrderForm.PartId}
                    onChange={(e) => setNewOrderForm((f) => ({ ...f, PartId: e.target.value }))}
                  >
                    <option value="">{tr("انتخاب محصول...", "Select Part...")}</option>
                    {parts
                      .filter((p) => p.PartType === "manufactured")
                      .map((p) => (
                        <option key={p.Id} value={p.Id}>
                          {p.PartNo} — {p.NameFa}
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    placeholder={tr("مقدار سفارش", "OrderQuantity")}
                    className={inputCls}
                    value={newOrderForm.OrderQuantity}
                    onChange={(e) => setNewOrderForm((f) => ({ ...f, OrderQuantity: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    step="0.25"
                    placeholder={tr("وزن اعزام (DispatchWeight)", "DispatchWeight")}
                    className={inputCls}
                    value={newOrderForm.DispatchWeight}
                    onChange={(e) => setNewOrderForm((f) => ({ ...f, DispatchWeight: Number(e.target.value) }))}
                  />
                </div>
                <button type="submit" className={btnCls} disabled={busy}>
                  {tr("ثبت سفارش تولید", "Create Order")}
                </button>
              </form>
            )}
          </section>

          <section className="glass-dark rounded-xl p-3 space-y-3">
            <h4 className="tx1 font-semibold">
              {selectedOrder
                ? tr(`جزئیات سفارش ${selectedOrder.OrderNo} و عملیات وابسته (Operations)`, `Order ${selectedOrder.OrderNo} & Operations`)
                : tr("انتخاب سفارش", "Select an order")}
            </h4>
            {selectedOrder && (
              <>
                <div className="rounded-lg border b-line-soft p-2.5 text-xs tx2 space-y-1">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      <strong>{tr("وضعیت:", "Status:")}</strong> {selectedOrder.Status}
                    </span>
                    <span dir="ltr">
                      RowVersion: {selectedOrder.RowVersion} · DispatchWeight: {selectedOrder.DispatchWeight}
                    </span>
                  </div>
                  <div className="tx3" dir="ltr">
                    DueAt: {selectedOrder.DueAt} · Demand: {selectedOrder.DemandSource} {selectedOrder.DemandRef ?? ""}
                  </div>
                  {selectedOrder.ClosedAt && (
                    <div className="text-emerald-300" dir="ltr">
                      ClosedAt: {selectedOrder.ClosedAt} · ClosedBy: {selectedOrder.ClosedBy ?? "—"}
                    </div>
                  )}
                  {selectedOrder.Status !== "closed" && canMfgAccess(mfgUserId, "mfg.order.reprioritize", plantId) && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button className={btnCls} disabled={busy} onClick={() => void handleReprioritizeOrder(selectedOrder, 0.25)}>
                        {tr("افزایش وزن اعزام (+۰.۲۵)", "DispatchWeight +0.25")}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="tx1 text-xs font-medium">
                    {tr(`عملیات سفارش (${selectedOrder.Operations?.length ?? 0} مورد):`, `Order Operations (${selectedOrder.Operations?.length ?? 0}):`)}
                  </div>
                  {(selectedOrder.Operations ?? []).map((op) => (
                    <div key={op.Id} className="rounded border b-line-soft p-2 text-xs tx2 flex flex-wrap justify-between gap-2">
                      <span>
                        <strong className="tx1" dir="ltr">#{op.SequenceNo} {op.OperationCode}</strong> — {op.OperationNameFa}
                      </span>
                      <span dir="ltr">
                        Status: <strong>{op.Status}</strong> · Cap: {op.PlannedCapacityMinutes}m · Qty: {op.PlannedQuantity}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* ══════════════════════ ۴) تب زمان‌بندی، گانت و ظرفیت (Phase 2: Finite Scheduling) ══════════════════════ */}
      {!loading && tab === "scheduling" && (
        <div className="space-y-3">
          {/* نوار اجرای موتور زمان‌بندی ظرفیت محدود */}
          <section className="glass-dark rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <strong className="tx1">{tr("موتور زمان‌بندی ظرفیت محدود (Finite Capacity Scheduler):", "Finite Capacity Scheduler:")}</strong>
                <select
                  aria-label="Direction"
                  className="rounded border b-line-soft bg-[var(--row)] px-2 py-1 text-xs tx1"
                  value={scheduleForm.Direction}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, Direction: e.target.value as "forward" | "backward" }))}
                >
                  <option value="forward">forward (رو به جلو)</option>
                  <option value="backward">backward (رو به عقب از DueAt)</option>
                </select>
                <select
                  aria-label="CapacityMode"
                  className="rounded border b-line-soft bg-[var(--row)] px-2 py-1 text-xs tx1"
                  value={scheduleForm.CapacityMode}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, CapacityMode: e.target.value as "finite" | "semi-finite" }))}
                >
                  <option value="finite">finite (ظرفیت محدود بدون هم‌پوشانی)</option>
                  <option value="semi-finite">semi-finite (ثبت اضافه‌بار)</option>
                </select>
                <select
                  aria-label="DispatchRule"
                  className="rounded border b-line-soft bg-[var(--row)] px-2 py-1 text-xs tx1"
                  value={scheduleForm.DispatchRule}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, DispatchRule: e.target.value as DispatchRule }))}
                >
                  <option value="WSPT">WSPT (نسبت DispatchWeight به زمان)</option>
                  <option value="EDD">EDD (زودترین سررسید)</option>
                  <option value="SPT">SPT (کوتاه‌ترین زمان پردازش)</option>
                  <option value="CR">CR (نسبت بحرانی)</option>
                  <option value="FIFO">FIFO (نوبت ورود)</option>
                  <option value="MANUAL">MANUAL (رتبهٔ دستی)</option>
                </select>
                {canMfgAccess(mfgUserId, "mfg.schedule.run", plantId) && (
                  <button className={btnCls} disabled={busy} onClick={() => void handleRunSchedule()}>
                    {tr("اجرای زمان‌بندی جدید (POST /scheduling/runs)", "Run Schedule")}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs" dir="ltr">
                <span className="rounded bg-sky-500/15 border border-sky-500/40 px-2 py-0.5 text-sky-200 font-semibold">
                  ScheduleVersion: v{gantt?.scheduleVersion ?? lastScheduleResult?.ScheduleVersion ?? 0}
                </span>
              </div>
            </div>

            {/* فیلترهای گانت، سطل ظرفیت و آستانهٔ گلوگاه */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t b-line-soft text-xs">
              <div>
                <label className="tx3 block mb-1">{tr("فیلتر مرکز کاری (workCenterId)", "Filter Work Center")}</label>
                <select
                  className={inputCls}
                  value={schedFilterWorkCenterId}
                  onChange={(e) => setSchedFilterWorkCenterId(e.target.value)}
                >
                  <option value="">{tr("همهٔ مراکز کاری کارخانه", "All Work Centers")}</option>
                  {workCenters.map((wc) => (
                    <option key={wc.Id} value={wc.Id}>
                      {wc.Code} — {wc.NameFa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tx3 block mb-1">{tr("فیلتر سفارش تولید (orderId)", "Filter Order")}</label>
                <select
                  className={inputCls}
                  value={schedFilterOrderId}
                  onChange={(e) => setSchedFilterOrderId(e.target.value)}
                >
                  <option value="">{tr("همهٔ سفارش‌های فعال", "All Orders")}</option>
                  {orders.map((ord) => (
                    <option key={ord.Id} value={ord.Id}>
                      {ord.OrderNo} ({ord.Status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="tx3 block mb-1">{tr("سطل گزارش ظرفیت (bucket)", "Capacity Bucket")}</label>
                <select
                  className={inputCls}
                  value={capacityBucketMode}
                  onChange={(e) => setCapacityBucketMode(e.target.value as "day" | "week")}
                >
                  <option value="day">{tr("روزانه (day)", "Daily (day)")}</option>
                  <option value="week">{tr("هفتگی (week)", "Weekly (week)")}</option>
                </select>
              </div>
              <div>
                <label className="tx3 block mb-1">{tr("آستانهٔ گلوگاه ظرفیت (%)", "Bottleneck Threshold (%)")}</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={inputCls}
                  dir="ltr"
                  value={bottleneckThreshold}
                  onChange={(e) => setBottleneckThreshold(Math.max(1, Math.min(100, Number(e.target.value) || 80)))}
                />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* گانت خطوط مراکز کاری همراه با نوار زمانی نسبی و انتخاب عملیات برای باززمان‌بندی */}
            <section className="glass-dark rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="tx1 font-semibold">{tr("نمای گانت مراکز کاری و قطعات چندتکه (GET /scheduling/gantt)", "Work Center Gantt Lanes")}</h4>
                <span className="tx3 text-[11px]">
                  {tr("شکست خودکار روی استراحت صریح (BreakStartMinuteOfDay) و توقف‌ها", "Splits across explicit breaks & downtime")}
                </span>
              </div>
              {!gantt?.lanes?.length ? (
                <p className="tx3 text-xs">{tr("قطعه‌ای در این پنجرهٔ زمانی یافت نشد.", "No segments in this window.")}</p>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto">
                  {gantt.lanes.map((lane) => {
                    const winStart = Date.parse(gantt.from || fromIso);
                    const winEnd = Date.parse(gantt.to || toIso);
                    const winSpan = Math.max(1, winEnd - winStart);
                    return (
                      <div key={lane.workCenter.Id} className="rounded-lg border b-line-soft p-2.5 space-y-2 text-xs">
                        <div className="flex flex-wrap justify-between gap-2 tx1 font-medium">
                          <span>
                            {lane.workCenter.Code} — {lane.workCenter.NameFa}
                            <span className="tx3 mx-1.5 text-[11px]">({lane.workCenter.Kind})</span>
                          </span>
                          <span className="tx3" dir="ltr">
                            TZ: {lane.workCenter.TimeZoneId} · Cap: {lane.workCenter.NominalCapacityMinutesPerDay}m/d · Eff: {lane.workCenter.EfficiencyPct}%
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {lane.segments.map((seg) => {
                            const segStart = Date.parse(seg.PlannedStartAt);
                            const segEnd = Date.parse(seg.PlannedEndAt);
                            const leftPct = Number.isFinite(segStart)
                              ? Math.max(0, Math.min(95, ((segStart - winStart) / winSpan) * 100))
                              : 0;
                            const widthPct = Number.isFinite(segStart) && Number.isFinite(segEnd)
                              ? Math.max(4, Math.min(100 - leftPct, ((segEnd - segStart) / winSpan) * 100))
                              : 12;
                            const isSelectedForResched = selectedRescheduleOpIds.includes(seg.ProductionOrderOperationId);
                            const queueOp = queueOps.find((o) => o.Id === seg.ProductionOrderOperationId);
                            const canRescheduleOp = !queueOp || ["pending", "queued", "ready"].includes(queueOp.Status);
                            return (
                              <div
                                key={seg.Id}
                                className={`rounded border px-2.5 py-1.5 space-y-1 tx2 ${
                                  seg.Status === "firm"
                                    ? "bg-emerald-500/10 border-emerald-500/40"
                                    : "bg-sky-500/10 border-sky-500/30"
                                }`}
                                dir="ltr"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    {canRescheduleOp && (
                                      <input
                                        type="checkbox"
                                        checked={isSelectedForResched}
                                        onChange={() => handleToggleRescheduleOp(seg.ProductionOrderOperationId)}
                                      />
                                    )}
                                    <strong>{seg.OrderNo}</strong> · #{seg.SequenceNo} {seg.OperationCode}
                                    <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px]">
                                      Seg #{seg.SegmentNo}
                                    </span>
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                                        seg.Status === "firm"
                                          ? "bg-emerald-500/20 text-emerald-200"
                                          : "bg-sky-500/20 text-sky-200"
                                      }`}
                                    >
                                      {seg.Status}
                                    </span>
                                  </label>
                                  <span className="text-[11px]">
                                    {seg.PlannedStartAt.slice(0, 16).replace("T", " ")} → {seg.PlannedEndAt.slice(0, 16).replace("T", " ")} ({seg.PlannedCapacityMinutes}m · {seg.DispatchRule})
                                  </span>
                                </div>
                                {/* نوار موقعیت زمانی در پنجره */}
                                <div className="h-1.5 w-full rounded bg-black/30 overflow-hidden relative">
                                  <div
                                    className={`h-full rounded ${seg.Status === "firm" ? "bg-emerald-400" : "bg-sky-400"}`}
                                    style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* بار ظرفیت و گلوگاه‌ها */}
            <section className="glass-dark rounded-xl p-3 space-y-2.5">
              <h4 className="tx1 font-semibold">{tr("بار ظرفیت و گلوگاه‌ها (GET /capacity/load & bottlenecks)", "Capacity Load & Bottlenecks")}</h4>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {capacityBuckets.map((b, i) => {
                  const util = b.UtilizationPct ?? 0;
                  const barColor =
                    util > 100 ? "bg-rose-500" : util >= bottleneckThreshold ? "bg-amber-400" : "bg-emerald-400";
                  const wcName = workCenters.find((w) => w.Id === b.WorkCenterId)?.Code ?? b.WorkCenterId;
                  return (
                    <div key={i} className="rounded border b-line-soft p-2 text-xs tx2 space-y-1" dir="ltr">
                      <div className="flex justify-between">
                        <span>
                          <strong>{wcName}</strong> · {b.PeriodStart.slice(0, 10)}
                        </span>
                        <span>
                          Load: <strong>{b.PlannedLoadMinutes}</strong> / Avail: {b.AvailableMinutes}m ({util}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded bg-black/30 overflow-hidden">
                        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, util))}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {bottlenecks.length > 0 ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200 space-y-1">
                  <div className="font-semibold">
                    {tr(`گلوگاه‌های شناسایی‌شده با بهره‌وری ≥ ${bottleneckThreshold}% (${bottlenecks.length} مورد):`, `Bottlenecks (${bottlenecks.length}):`)}
                  </div>
                  {bottlenecks.map((bn, idx) => {
                    const wcName = workCenters.find((w) => w.Id === bn.WorkCenterId)?.Code ?? bn.WorkCenterId;
                    return (
                      <div key={idx} className="flex justify-between" dir="ltr">
                        <span>{wcName} · {bn.PeriodStart.slice(0, 10)}</span>
                        <span>Util: {bn.UtilizationPct}% · Overload: {bn.OverloadMinutes}m</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded border b-line-soft p-2 text-xs tx3">
                  {tr(`هیچ گلوگاهی بالای آستانهٔ ${bottleneckThreshold}% در این پنجره وجود ندارد.`, `No bottlenecks above ${bottleneckThreshold}%.`)}
                </div>
              )}
            </section>
          </div>

          {/* پنل باززمان‌بندی انتخابی (POST /scheduling/reschedules) و گزارش Diff */}
          <section className="glass-dark rounded-xl p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="tx1 font-semibold">
                {tr(
                  "باززمان‌بندی انتخابی عملیات و زنجیرهٔ پس‌نیاز با حفظ بلوک‌های Firm (POST /scheduling/reschedules)",
                  "Selective Operation Rescheduling & Schedule Diff",
                )}
              </h4>
              <span className="tx3 text-xs" dir="ltr">
                ExpectedScheduleVersion: v{gantt?.scheduleVersion ?? lastScheduleResult?.ScheduleVersion ?? 0} · Selected: {selectedRescheduleOpIds.length}
              </span>
            </div>

            {/* انتخاب سریع عملیات قابل اعزام */}
            <div className="flex flex-wrap gap-1.5">
              {queueOps
                .filter((op) => ["pending", "queued", "ready"].includes(op.Status))
                .map((op) => {
                  const checked = selectedRescheduleOpIds.includes(op.Id);
                  return (
                    <button
                      key={op.Id}
                      type="button"
                      className={`${btnCls} ${checked ? "toggle-on" : ""}`}
                      onClick={() => handleToggleRescheduleOp(op.Id)}
                    >
                      <span dir="ltr">
                        {checked ? "☑ " : "☐ "}
                        {op.OrderNo ?? op.ProductionOrderId} · #{op.SequenceNo} {op.OperationCode} ({op.Status})
                      </span>
                    </button>
                  );
                })}
            </div>

            {canMfgAccess(mfgUserId, "mfg.schedule.resequence", plantId) && (
              <form onSubmit={handleRescheduleSelected} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <div className="md:col-span-2">
                  <label className="tx3 text-xs block mb-1">{tr("علت باززمان‌بندی (Reason)", "Reschedule Reason")}</label>
                  <input
                    className={inputCls}
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder={tr("علت باززمان‌بندی زنجیرهٔ عملیات...", "Reason for rescheduling...")}
                  />
                </div>
                <div>
                  <label className="tx3 text-xs block mb-1">{tr("قاعدهٔ اعزام جدید (DispatchRule)", "New DispatchRule")}</label>
                  <select
                    className={inputCls}
                    value={rescheduleDispatchRule}
                    onChange={(e) => setRescheduleDispatchRule(e.target.value as DispatchRule)}
                  >
                    <option value="WSPT">WSPT</option>
                    <option value="EDD">EDD</option>
                    <option value="SPT">SPT</option>
                    <option value="CR">CR</option>
                    <option value="FIFO">FIFO</option>
                    <option value="MANUAL">MANUAL</option>
                  </select>
                </div>
                <button type="submit" className={btnCls} disabled={busy || !selectedRescheduleOpIds.length}>
                  {tr("اجرای باززمان‌بندی انتخابی (Reschedule)", "Run Selective Reschedule")}
                </button>
              </form>
            )}

            {lastRescheduleResult?.diff && (
              <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-2.5 text-xs tx2 space-y-1.5" dir="ltr">
                <div className="flex flex-wrap justify-between font-semibold text-sky-200">
                  <span>
                    Schedule Diff: v{lastRescheduleResult.diff.fromScheduleVersion} → v{lastRescheduleResult.diff.toScheduleVersion}
                  </span>
                  <span>
                    Changed Ops: {lastRescheduleResult.diff.changedOperationCount} · Moved: {lastRescheduleResult.diff.movedCount} · Unchanged (Firm/Frozen): {lastRescheduleResult.diff.unchangedOperationCount}
                  </span>
                </div>
                {(lastRescheduleResult.diff.changedOperations ?? []).map((ch: any, idx: number) => (
                  <div key={idx} className="rounded bg-black/25 px-2 py-1 flex flex-wrap justify-between gap-2">
                    <span>Op: <strong>{ch.operationId}</strong> ({ch.changeType ?? "rescheduled"})</span>
                    <span>
                      {ch.previousStartAt ? `${ch.previousStartAt.slice(0, 16).replace("T", " ")} → ` : ""}
                      <strong>{ch.newStartAt?.slice(0, 16).replace("T", " ") ?? "—"}</strong> .. <strong>{ch.newEndAt?.slice(0, 16).replace("T", " ") ?? "—"}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ══════════════════════ ۵) تب اجرای کارگاهی و کنترل عملیات (Phase 2: Operation Control & Progress Logging) ══════════════════════ */}
      {!loading && tab === "execution" && (
        <div className="space-y-3">
          {/* فیلترهای صف اعزام کارگاهی */}
          <section className="glass-dark rounded-xl p-3 grid grid-cols-1 md:grid-cols-4 gap-2 items-end text-xs">
            <div>
              <label className="tx3 block mb-1">{tr("فیلتر مرکز کاری (workCenterId)", "Work Center Filter")}</label>
              <select
                className={inputCls}
                value={execFilterWorkCenterId}
                onChange={(e) => setExecFilterWorkCenterId(e.target.value)}
              >
                <option value="">{tr("همهٔ مراکز کاری", "All Work Centers")}</option>
                {workCenters.map((wc) => (
                  <option key={wc.Id} value={wc.Id}>
                    {wc.Code} — {wc.NameFa}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="tx3 block mb-1">{tr("فیلتر وضعیت عملیات (status)", "Operation Status")}</label>
              <select
                className={inputCls}
                value={execFilterStatus}
                onChange={(e) => setExecFilterStatus(e.target.value)}
              >
                <option value="">{tr("همهٔ وضعیت‌ها", "All Statuses")}</option>
                <option value="pending">pending (در انتظار)</option>
                <option value="queued">queued (در صف)</option>
                <option value="ready">ready (آماده اعزام)</option>
                <option value="running">running (در حال اجرا)</option>
                <option value="paused">paused (متوقف موقت)</option>
                <option value="completed">completed (تکمیل‌شده)</option>
                <option value="blocked">blocked (مسدود)</option>
              </select>
            </div>
            <div>
              <label className="tx3 block mb-1">{tr("فیلتر تاریخ شیفت (shiftDate)", "Shift Date (YYYY-MM-DD)")}</label>
              <input
                type="date"
                className={inputCls}
                dir="ltr"
                value={execFilterShiftDate}
                onChange={(e) => setExecFilterShiftDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={btnCls}
                onClick={() => {
                  setExecFilterWorkCenterId("");
                  setExecFilterStatus("");
                  setExecFilterShiftDate("");
                }}
              >
                {tr("پاک‌سازی فیلترها", "Clear Filters")}
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* ستون راست: صف اعزام عملیات کارگاهی و کنترل نشست اجرا */}
            <section className="glass-dark rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="tx1 font-semibold">{tr("صف اعزام عملیات کارگاهی (GET /operation-queue)", "Shop-Floor Operation Queue")}</h4>
                <span className="tx3 text-xs">{tr(`${queueOps.length} عملیات فعال`, `${queueOps.length} operations`)}</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {queueOps.map((op) => {
                  const isSelected = selectedOpId === op.Id;
                  return (
                    <div
                      key={op.Id}
                      className={`rounded-lg border b-line-soft p-2.5 space-y-1.5 text-xs tx2 ${
                        isSelected ? "toggle-on" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong className="tx1" dir="ltr">
                            {op.OrderNo ?? op.ProductionOrderId} · #{op.SequenceNo} {op.OperationCode}
                          </strong>{" "}
                          — {op.OperationNameFa}
                          <span className="tx3 mx-1.5" dir="ltr">
                            [{op.WorkCenterCode ?? op.WorkCenterId}]
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {op.InspectionRequired && (
                            <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-200">
                              QC Gate
                            </span>
                          )}
                          {op.OverlapAllowed && (
                            <span className="rounded bg-purple-500/20 border border-purple-500/40 px-1.5 py-0.5 text-[10px] text-purple-200" dir="ltr">
                              Overlap ({op.TransferBatchQty ?? 0})
                            </span>
                          )}
                          <button className={btnCls} onClick={() => void handleInspectOpVariance(op.Id)}>
                            {tr("انتخاب و کنترل عملیات", "Select & Control")}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 tx3 text-[11px]" dir="ltr">
                        <span>
                          Status: <strong className="tx1">{op.Status}</strong> · Good: <strong>{op.CumulativeGoodQuantity ?? 0}</strong> / {op.PlannedQuantity} · Cap: {op.PlannedCapacityMinutes}m
                        </span>
                        <span>
                          {op.PlannedStartAt ? `${op.PlannedStartAt.slice(0, 16).replace("T", " ")} → ${op.PlannedEndAt?.slice(0, 16).replace("T", " ") ?? ""}` : "Unscheduled"}
                        </span>
                      </div>
                      {op.ActiveExecution && (
                        <div className="rounded bg-emerald-500/15 border border-emerald-500/40 px-2 py-1 text-[11px] text-emerald-200 flex justify-between" dir="ltr">
                          <span>
                            ▶ Active Execution #{op.ActiveExecution.ExecutionNo} (Id: {op.ActiveExecution.Id} · v{op.ActiveExecution.RowVersion})
                          </span>
                          <span>
                            In: {op.ActiveExecution.InputQuantity} · Good: {op.ActiveExecution.GoodQuantity} · Scrap: {op.ActiveExecution.ScrapQuantity} · Rework: {op.ActiveExecution.ReworkQuantity}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* پنل کنترل اجرای عملیات انتخاب‌شده: ۱) شروع نشست ۲) ثبت پیشرفت تجمعی ۳) اتمام و گیت QC */}
              {(() => {
                const currentOp = queueOps.find((o) => o.Id === selectedOpId);
                if (!currentOp) return null;
                const activeExec =
                  currentOp.ActiveExecution ??
                  opVariance?.Executions?.find((ex) => ex.Status === "running") ??
                  null;
                const inputBalanced =
                  Number(progressForm.InputQuantity) > 0 &&
                  Math.abs(
                    Number(progressForm.InputQuantity) -
                      (Number(progressForm.GoodQuantity) +
                        Number(progressForm.ScrapQuantity) +
                        Number(progressForm.ReworkQuantity)),
                  ) < 1e-6;

                return (
                  <div className="border-t b-line-soft pt-3 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="tx1">
                        {tr(
                          `کنترل اجرای عملیات ${currentOp.OperationCode} (${currentOp.OrderNo ?? currentOp.ProductionOrderId})`,
                          `Execution Control: ${currentOp.OperationCode}`,
                        )}
                      </strong>
                      <span className="tx3" dir="ltr">
                        Op Status: {currentOp.Status} · RowVersion: v{currentOp.RowVersion}
                      </span>
                    </div>

                    {/* گام ۱: شروع نشست اجرای جدید */}
                    {currentOp.Status !== "completed" &&
                      currentOp.Status !== "blocked" &&
                      !activeExec &&
                      canMfgAccess(mfgUserId, "mfg.execution.start", plantId) && (
                        <div className="rounded-lg border b-line-soft p-2.5 space-y-2">
                          <div className="tx1 font-medium">
                            {tr("۱. شروع نشست اجرای عملیات (POST /operations/:id/executions)", "1. Start Execution Session")}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <select
                              aria-label="Execution Resource"
                              className={inputCls}
                              value={startExecForm.ResourceId}
                              onChange={(e) => setStartExecForm((f) => ({ ...f, ResourceId: e.target.value }))}
                            >
                              <option value="">{tr("انتخاب منبع مرکز کاری...", "Select Resource...")}</option>
                              {wcResources.map((res) => (
                                <option key={res.Id} value={res.Id}>
                                  {res.ResourceCode} — {res.NameFa} ({res.ResourceKind})
                                </option>
                              ))}
                            </select>
                            <input
                              className={inputCls}
                              dir="ltr"
                              placeholder="OperatorId"
                              value={startExecForm.OperatorId}
                              onChange={(e) => setStartExecForm((f) => ({ ...f, OperatorId: e.target.value }))}
                            />
                            <input
                              className={inputCls}
                              placeholder={tr("یادداشت شروع نشست", "Start Note")}
                              value={startExecForm.NoteFa}
                              onChange={(e) => setStartExecForm((f) => ({ ...f, NoteFa: e.target.value }))}
                            />
                          </div>
                          <button
                            type="button"
                            className={btnCls}
                            disabled={busy}
                            onClick={() => void handleStartExecution(currentOp)}
                          >
                            {tr("شروع نشست اجرای عملیات (Idempotent)", "Start Execution Session")}
                          </button>
                        </div>
                      )}

                    {/* گام ۲: ثبت پیشرفت تجمعی روی نشست فعال */}
                    {activeExec && canMfgAccess(mfgUserId, "mfg.execution.report", plantId) && (
                      <form
                        onSubmit={(e) => void handleReportExecution(e, currentOp)}
                        className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-2.5 space-y-2"
                      >
                        <div className="flex flex-wrap justify-between gap-2 tx1 font-medium">
                          <span>
                            {tr(
                              `۲. ثبت پیشرفت تجمعی روی نشست فعال #${activeExec.ExecutionNo} (POST /executions/:id/reports)`,
                              `2. Log Cumulative Progress (Execution #${activeExec.ExecutionNo})`,
                            )}
                          </span>
                          <span dir="ltr" className="text-sky-300">
                            If-Match: v{activeExec.RowVersion}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <div>
                            <label className="tx3 block mb-0.5">{tr("ورودی افزوده (InputQty)", "InputQty")}</label>
                            <input
                              type="number"
                              step="0.1"
                              className={inputCls}
                              dir="ltr"
                              value={progressForm.InputQuantity}
                              onChange={(e) => setProgressForm((f) => ({ ...f, InputQuantity: Number(e.target.value) }))}
                            />
                          </div>
                          <div>
                            <label className="tx3 block mb-0.5">{tr("سالم افزوده (GoodQty)", "GoodQty")}</label>
                            <input
                              type="number"
                              step="0.1"
                              className={inputCls}
                              dir="ltr"
                              value={progressForm.GoodQuantity}
                              onChange={(e) => setProgressForm((f) => ({ ...f, GoodQuantity: Number(e.target.value) }))}
                            />
                          </div>
                          <div>
                            <label className="tx3 block mb-0.5">{tr("ضایعات افزوده (ScrapQty)", "ScrapQty")}</label>
                            <input
                              type="number"
                              step="0.1"
                              className={inputCls}
                              dir="ltr"
                              value={progressForm.ScrapQuantity}
                              onChange={(e) => setProgressForm((f) => ({ ...f, ScrapQuantity: Number(e.target.value) }))}
                            />
                          </div>
                          <div>
                            <label className="tx3 block mb-0.5">{tr("دوباره‌کاری (ReworkQty)", "ReworkQty")}</label>
                            <input
                              type="number"
                              step="0.1"
                              className={inputCls}
                              dir="ltr"
                              value={progressForm.ReworkQuantity}
                              onChange={(e) => setProgressForm((f) => ({ ...f, ReworkQuantity: Number(e.target.value) }))}
                            />
                          </div>
                          <div>
                            <label className="tx3 block mb-0.5">{tr("زمان واقعی Setup (دقیقه)", "SetupActualMinutes")}</label>
                            <input
                              type="number"
                              className={inputCls}
                              dir="ltr"
                              value={progressForm.SetupActualMinutes}
                              onChange={(e) => setProgressForm((f) => ({ ...f, SetupActualMinutes: Number(e.target.value) }))}
                            />
                          </div>
                          <div>
                            <label className="tx3 block mb-0.5">{tr("زمان واقعی Run (دقیقه)", "RunActualMinutes")}</label>
                            <input
                              type="number"
                              className={inputCls}
                              dir="ltr"
                              value={progressForm.RunActualMinutes}
                              onChange={(e) => setProgressForm((f) => ({ ...f, RunActualMinutes: Number(e.target.value) }))}
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={inputBalanced ? "text-emerald-300 text-[11px]" : "text-amber-300 text-[11px]"} dir="ltr">
                            {inputBalanced
                              ? "✓ Quantity Balanced (Input = Good + Scrap + Rework)"
                              : "⚠ Input != Good + Scrap + Rework (Required before Finish)"}
                          </span>
                          <button type="submit" className={btnCls} disabled={busy}>
                            {tr("ثبت گزارش پیشرفت تجمعی", "Submit Progress Report")}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* گام ۳: اتمام نشست و گیت بازرسی کیفی */}
                    {activeExec && canMfgAccess(mfgUserId, "mfg.execution.finish", plantId) && (
                      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5 space-y-2">
                        <div className="flex flex-wrap justify-between gap-2 tx1 font-medium">
                          <span>
                            {tr(
                              `۳. اتمام نشست #${activeExec.ExecutionNo} و گیت بازرسی کیفی (POST /executions/:id/finish)`,
                              `3. Finish Execution #${activeExec.ExecutionNo} & QC Gate`,
                            )}
                          </span>
                          <span dir="ltr" className="text-emerald-300">
                            If-Match: v{activeExec.RowVersion}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer tx2">
                            <input
                              type="checkbox"
                              checked={finishExecForm.InspectionApproved}
                              onChange={(e) => setFinishExecForm((f) => ({ ...f, InspectionApproved: e.target.checked }))}
                            />
                            <span>
                              {tr("تأیید بازرسی کیفی (InspectionApproved)", "Quality Inspection Approved")}
                              {currentOp.InspectionRequired && (
                                <strong className="text-amber-300 mx-1">
                                  {tr("(الزامی برای این عملیات)", "(Required)")}
                                </strong>
                              )}
                            </span>
                          </label>
                          <button
                            type="button"
                            className={btnCls}
                            disabled={busy}
                            onClick={() => void handleFinishExecution(currentOp)}
                          >
                            {tr("اتمام نشست و تکمیل عملیات", "Finish Execution")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>

            {/* ستون چپ: تحلیل جامع انحراف عملیات و ثبت رویدادهای توقف / ضایعات / دوباره‌کاری */}
            <section className="glass-dark rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="tx1 font-semibold">
                  {tr("تحلیل انحراف عملیات و رویدادهای کارگاهی (GET /operations/:id/variance)", "Operation Variance & Shop-Floor Logs")}
                </h4>
                {opVariance?.OperationCode && (
                  <span className="rounded border b-line-soft px-2 py-0.5 text-xs tx2" dir="ltr">
                    {opVariance.OperationCode} ({opVariance.Status})
                  </span>
                )}
              </div>

              {opVariance && (
                <div className="rounded-lg border b-line-soft p-2.5 text-xs tx2 space-y-2.5">
                  <div className="tx1 font-medium">{tr("توازن مقادیر تولید عملیات (Quantities):", "Operation Quantities:")}</div>
                  <div className="grid grid-cols-5 gap-2 text-center" dir="ltr">
                    <div className="rounded bg-black/25 p-1.5">
                      Planned<br />
                      <strong>{opVariance.Quantities?.PlannedQuantity ?? opVariance.Quantities?.Planned ?? 0}</strong>
                    </div>
                    <div className="rounded bg-black/25 p-1.5">
                      Input<br />
                      <strong>{opVariance.Quantities?.InputQuantity ?? opVariance.Quantities?.Input ?? 0}</strong>
                    </div>
                    <div className="rounded bg-black/25 p-1.5 text-emerald-300">
                      Good<br />
                      <strong>{opVariance.Quantities?.GoodQuantity ?? opVariance.Quantities?.Good ?? 0}</strong>
                    </div>
                    <div className="rounded bg-black/25 p-1.5 text-rose-300">
                      Scrap<br />
                      <strong>{opVariance.Quantities?.ScrapQuantity ?? opVariance.Quantities?.Scrap ?? 0}</strong>
                    </div>
                    <div className="rounded bg-black/25 p-1.5 text-amber-300">
                      Rework<br />
                      <strong>{opVariance.Quantities?.ReworkQuantity ?? opVariance.Quantities?.Rework ?? 0}</strong>
                    </div>
                  </div>

                  {/* جدول انحراف زمان Setup / Run / Total / Downtime */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center pt-1" dir="ltr">
                    <div className="rounded border b-line-soft p-1.5">
                      <div className="tx3 text-[10px]">Setup (Std / Act / Var)</div>
                      <strong>
                        {opVariance.TimeMinutes?.StandardSetupMinutes ?? 0} / {opVariance.TimeMinutes?.ActualSetupMinutes ?? 0} ({opVariance.TimeMinutes?.SetupVarianceMinutes ?? 0}m)
                      </strong>
                    </div>
                    <div className="rounded border b-line-soft p-1.5">
                      <div className="tx3 text-[10px]">Run (Std / Act / Var)</div>
                      <strong>
                        {opVariance.TimeMinutes?.StandardRunMinutes ?? 0} / {opVariance.TimeMinutes?.ActualRunMinutes ?? 0} ({opVariance.TimeMinutes?.RunVarianceMinutes ?? 0}m)
                      </strong>
                    </div>
                    <div className="rounded border b-line-soft p-1.5">
                      <div className="tx3 text-[10px]">Total Variance</div>
                      <strong>
                        {opVariance.TimeMinutes?.TotalTimeVarianceMinutes ?? opVariance.TimeMinutes?.TotalVarianceMinutes ?? 0} min
                      </strong>
                    </div>
                    <div className="rounded border b-line-soft p-1.5 text-amber-300">
                      <div className="tx3 text-[10px]">Downtime</div>
                      <strong>{opVariance.TimeMinutes?.DowntimeMinutes ?? 0} min</strong>
                    </div>
                  </div>

                  {/* خلاصهٔ نشست‌ها، ضایعات و دوباره‌کاری‌های ثبت‌شده */}
                  <div className="flex flex-wrap gap-2 text-[11px] tx3 pt-1" dir="ltr">
                    <span>Executions: <strong>{opVariance.Executions?.length ?? 0}</strong></span>
                    <span>· Scrap Logs: <strong>{opVariance.ScrapRecords?.length ?? 0}</strong></span>
                    <span>· Rework Orders: <strong>{opVariance.ReworkRecords?.length ?? 0}</strong></span>
                    <span>· Downtime Logs: <strong>{opVariance.DowntimeLogs?.length ?? 0}</strong></span>
                  </div>
                </div>
              )}

              {/* تب‌های فرعی ثبت توقف، ضایعات و دوباره‌کاری */}
              <div className="border-t b-line-soft pt-3 space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className={`${btnCls} ${execEventSubTab === "downtime" ? "toggle-on" : ""}`}
                    onClick={() => setExecEventSubTab("downtime")}
                  >
                    {tr("ثبت توقف (POST /downtime)", "Downtime Log")}
                  </button>
                  <button
                    type="button"
                    className={`${btnCls} ${execEventSubTab === "scrap" ? "toggle-on" : ""}`}
                    onClick={() => setExecEventSubTab("scrap")}
                  >
                    {tr("ثبت ضایعات (POST /scrap)", "Scrap Log")}
                  </button>
                  <button
                    type="button"
                    className={`${btnCls} ${execEventSubTab === "rework" ? "toggle-on" : ""}`}
                    onClick={() => setExecEventSubTab("rework")}
                  >
                    {tr("دستور دوباره‌کاری (POST /rework)", "Rework Order")}
                  </button>
                </div>

                {execEventSubTab === "downtime" && canMfgAccess(mfgUserId, "mfg.downtime.report", plantId) && (
                  <form onSubmit={handleReportDowntime} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        aria-label="Downtime WorkCenter"
                        className={inputCls}
                        value={downtimeForm.WorkCenterId}
                        onChange={(e) => setDowntimeForm((f) => ({ ...f, WorkCenterId: e.target.value }))}
                      >
                        {workCenters.map((wc) => (
                          <option key={wc.Id} value={wc.Id}>{wc.Code} — {wc.NameFa}</option>
                        ))}
                      </select>
                      <select
                        aria-label="DowntimeType"
                        className={inputCls}
                        value={downtimeForm.DowntimeType}
                        onChange={(e) => setDowntimeForm((f) => ({ ...f, DowntimeType: e.target.value as "planned" | "unplanned" }))}
                      >
                        <option value="unplanned">unplanned (توقف ناخواسته)</option>
                        <option value="planned">planned (توقف برنامه‌ریزی‌شده)</option>
                      </select>
                      <input
                        placeholder="ReasonCode"
                        className={inputCls}
                        dir="ltr"
                        value={downtimeForm.ReasonCode}
                        onChange={(e) => setDowntimeForm((f) => ({ ...f, ReasonCode: e.target.value }))}
                      />
                      <input
                        placeholder={tr("شرح فارسی", "NoteFa")}
                        className={inputCls}
                        value={downtimeForm.NoteFa}
                        onChange={(e) => setDowntimeForm((f) => ({ ...f, NoteFa: e.target.value }))}
                      />
                    </div>
                    <button type="submit" className={btnCls} disabled={busy}>
                      {tr("ثبت توقف با Idempotency-Key", "Submit Downtime")}
                    </button>
                  </form>
                )}

                {execEventSubTab === "scrap" && canMfgAccess(mfgUserId, "mfg.scrap.report", plantId) && (
                  <form onSubmit={handleReportScrap} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.1"
                        placeholder={tr("مقدار ضایعات", "Quantity")}
                        className={inputCls}
                        dir="ltr"
                        value={scrapForm.Quantity}
                        onChange={(e) => setScrapForm((f) => ({ ...f, Quantity: Number(e.target.value) }))}
                      />
                      <select
                        aria-label="Scrap Disposition"
                        className={inputCls}
                        value={scrapForm.Disposition}
                        onChange={(e) =>
                          setScrapForm((f) => ({
                            ...f,
                            Disposition: e.target.value as "scrapped" | "returned-to-stock" | "use-as-is",
                          }))
                        }
                      >
                        <option value="scrapped">scrapped (اسقاط قطعی)</option>
                        <option value="returned-to-stock">returned-to-stock (برگشت به انبار)</option>
                        <option value="use-as-is">use-as-is (مصرف با ارفاق)</option>
                      </select>
                      <input
                        placeholder="ReasonCode (مثلاً DIM-TOL)"
                        className={inputCls}
                        dir="ltr"
                        value={scrapForm.ReasonCode}
                        onChange={(e) => setScrapForm((f) => ({ ...f, ReasonCode: e.target.value }))}
                      />
                      <input
                        type="number"
                        placeholder={tr("هزینهٔ برآوردی ضایعات (IRR)", "CostAmount")}
                        className={inputCls}
                        dir="ltr"
                        value={scrapForm.CostAmount}
                        onChange={(e) => setScrapForm((f) => ({ ...f, CostAmount: Number(e.target.value) }))}
                      />
                    </div>
                    <button type="submit" className={btnCls} disabled={busy || !selectedOpId}>
                      {tr("ثبت ضایعات روی عملیات انتخابی (POST /scrap)", "Submit Scrap Record")}
                    </button>
                  </form>
                )}

                {execEventSubTab === "rework" && canMfgAccess(mfgUserId, "mfg.rework.report", plantId) && (
                  <form onSubmit={handleReportRework} className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="0.1"
                        placeholder={tr("مقدار دوباره‌کاری", "Quantity")}
                        className={inputCls}
                        dir="ltr"
                        value={reworkForm.Quantity}
                        onChange={(e) => setReworkForm((f) => ({ ...f, Quantity: Number(e.target.value) }))}
                      />
                      <select
                        aria-label="Rework Disposition"
                        className={inputCls}
                        value={reworkForm.Disposition}
                        onChange={(e) =>
                          setReworkForm((f) => ({
                            ...f,
                            Disposition: e.target.value as "rework-in-place" | "return-to-operation" | "scrap",
                          }))
                        }
                      >
                        <option value="rework-in-place">rework-in-place (اصلاح در همان ایستگاه)</option>
                        <option value="return-to-operation">return-to-operation (بازگشت به عملیات مقصد)</option>
                        <option value="scrap">scrap (تبدیل به ضایعات)</option>
                      </select>
                      <select
                        aria-label="Target Operation"
                        className={inputCls}
                        value={reworkForm.TargetOperationId}
                        onChange={(e) => setReworkForm((f) => ({ ...f, TargetOperationId: e.target.value }))}
                      >
                        <option value="">{tr("عملیات مقصد (اختیاری - همان سفارش)...", "Target Operation (same order)...")}</option>
                        {queueOps
                          .filter(
                            (o) =>
                              o.ProductionOrderId ===
                              queueOps.find((cur) => cur.Id === selectedOpId)?.ProductionOrderId,
                          )
                          .map((o) => (
                            <option key={o.Id} value={o.Id}>
                              #{o.SequenceNo} {o.OperationCode} — {o.OperationNameFa}
                            </option>
                          ))}
                      </select>
                      <input
                        placeholder="ReasonCode (مثلاً SURF-BURR)"
                        className={inputCls}
                        dir="ltr"
                        value={reworkForm.ReasonCode}
                        onChange={(e) => setReworkForm((f) => ({ ...f, ReasonCode: e.target.value }))}
                      />
                    </div>
                    <button type="submit" className={btnCls} disabled={busy || !selectedOpId}>
                      {tr("صدور دستور دوباره‌کاری (POST /rework)", "Create Rework Order")}
                    </button>
                  </form>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ══════════════════════ ۶) تب مواد، MRP، کمبود، مصرف و هشدارها (Phase 3) ══════════════════════ */}
      {!loading && tab === "mrp" && (
        <div className="space-y-3">
          {/* نوار فرمان اجرای MRP و صدور پیشنهاد تأمین */}
          <section className="glass-dark rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs tx1 font-semibold">
                {tr(
                  "برنامه‌ریزی نیازمندی‌های مواد (MRP)، مدیریت موجودی/بچ، پیشنهاد تأمین و هشدارهای کمبود",
                  "Material Requirements Planning (MRP), Inventory/Lot, Proposals & Alerts",
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canMfgAccess(mfgUserId, "mfg.mrp.run", plantId) && (
                  <>
                    <button className={btnCls} disabled={busy} onClick={() => void handleRunMrp(true)}>
                      {tr("اجرای پیش‌نمایش MRP (PreviewOnly)", "Run MRP Preview")}
                    </button>
                    <button className={btnCls} disabled={busy} onClick={() => void handleRunMrp(false)}>
                      {tr("محاسبه و ثبت اتمیک MRP + صدور هشدار کمبود", "Commit MRP + Auto Alerts")}
                    </button>
                  </>
                )}
                {canMfgAccess(mfgUserId, "mfg.requisition.create", plantId) && shortages.length > 0 && (
                  <button className={btnCls} disabled={busy} onClick={() => void handleCreateProposal()}>
                    {tr(
                      `صدور پیشنهاد تأمین (${selectedShortageIds.length || shortages.length} کمبود)`,
                      `Create Procurement Proposal (${selectedShortageIds.length || shortages.length})`,
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* پارامترهای افق زمانی MRP، سفارش هدف و یادداشت پیشنهاد تأمین */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t b-line-soft text-xs">
              <div>
                <label className="tx3 block mb-1">{tr("افق زمانی محاسبهٔ MRP (ThroughDate)", "MRP Horizon (ThroughDate)")}</label>
                <input
                  className={inputCls}
                  dir="ltr"
                  value={mrpHorizonIso}
                  onChange={(e) => setMrpHorizonIso(e.target.value)}
                />
              </div>
              <div>
                <label className="tx3 block mb-1">{tr("محدودسازی MRP به سفارش خاص (اختیاری)", "Target Order (Optional)")}</label>
                <select
                  className={inputCls}
                  value={mrpTargetOrderId}
                  onChange={(e) => setMrpTargetOrderId(e.target.value)}
                >
                  <option value="">{tr("همهٔ سفارش‌های آزادشده و در حال اجرا", "All Released / In-Progress Orders")}</option>
                  {orders
                    .filter((o) => ["released", "in-progress"].includes(o.Status))
                    .map((o) => (
                      <option key={o.Id} value={o.Id}>
                        {o.OrderNo} ({o.Status} · Qty: {o.OrderQuantity})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="tx3 block mb-1">{tr("یادداشت پیشنهاد تأمین (NoteFa)", "Proposal Note")}</label>
                <input
                  className={inputCls}
                  value={proposalNoteFa}
                  onChange={(e) => setProposalNoteFa(e.target.value)}
                />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* ستون راست: مواد برنامه‌ریزی‌شده، موجودی آزاد انبار و جزئیات بچ/لات */}
            <section className="glass-dark rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="tx1 font-semibold">{tr("مواد برنامه‌ریزی‌شده و موجودی انبار (GET /materials)", "Planned Materials & Live Inventory")}</h4>
                <span className="tx3 text-xs">{tr(`${materials.length} ماده`, `${materials.length} materials`)}</span>
              </div>

              {/* فیلتر جستجو و نوع تأمین */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <input
                  className={inputCls}
                  placeholder={tr("جستجوی کد/نام قطعه یا انبار (q)...", "Search PartNo / Name / Warehouse...")}
                  value={matFilterQuery}
                  onChange={(e) => setMatFilterQuery(e.target.value)}
                />
                <select
                  aria-label="Material Procurement Filter"
                  className={inputCls}
                  value={matFilterProcurement}
                  onChange={(e) => setMatFilterProcurement(e.target.value as "" | "buy" | "make")}
                >
                  <option value="">{tr("همهٔ انواع تأمین (buy & make)", "All Procurement Types")}</option>
                  <option value="buy">buy (خریدنی)</option>
                  <option value="make">make (ساختنی)</option>
                </select>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {materials.map((m) => (
                  <div key={m.Id} className="rounded-lg border b-line-soft p-2.5 text-xs tx2 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong className="tx1" dir="ltr">{m.PartNo ?? m.Id}</strong>
                        {m.PartNameFa && <span> — {m.PartNameFa}</span>}
                        <span className="mx-1.5 rounded bg-black/30 px-1.5 py-0.5 text-[10px] uppercase" dir="ltr">
                          {m.ProcurementType}
                        </span>
                        {m.IsLotTracked && (
                          <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[10px] text-amber-200" dir="ltr">
                            Lot-Tracked
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className={btnCls}
                        onClick={() => handleSelectMaterialForConsume(m)}
                      >
                        {tr("انتخاب برای مصرف", "Select to Consume")}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 text-center" dir="ltr">
                      <div className="rounded bg-black/25 p-1">
                        <span className="tx3 text-[10px] block">OnHand</span>
                        <strong>{m.OnHandQty ?? 0} {m.BaseUom ?? ""}</strong>
                      </div>
                      <div className="rounded bg-black/25 p-1">
                        <span className="tx3 text-[10px] block">Reserved</span>
                        <strong>{m.ReservedQty ?? 0}</strong>
                      </div>
                      <div className="rounded bg-black/25 p-1">
                        <span className="tx3 text-[10px] block">Safety</span>
                        <strong>{m.SafetyStockQty}</strong>
                      </div>
                      <div className="rounded bg-black/25 p-1 text-emerald-300">
                        <span className="tx3 text-[10px] block">Free Avail</span>
                        <strong>{m.FreeAvailableQty ?? 0}</strong>
                      </div>
                      <div className="rounded bg-black/25 p-1 text-sky-300">
                        <span className="tx3 text-[10px] block">Consumed</span>
                        <strong>{m.TotalConsumedQty ?? 0}</strong>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between gap-2 tx3 text-[11px]" dir="ltr">
                      <span>
                        Lead: {m.LeadTimeDays}d · LotSize: {m.LotSize} · Mult: {m.OrderMultiple}
                      </span>
                      <span>
                        Std Cost: {m.StandardUnitCost?.toLocaleString() ?? 0} {m.Currency}
                      </span>
                    </div>

                    {m.InventoryLocations && m.InventoryLocations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5" dir="ltr">
                        {m.InventoryLocations.map((loc) => (
                          <span key={loc.Id} className="rounded border b-line-soft bg-black/20 px-2 py-0.5 text-[10px] tx3">
                            {loc.WarehouseCode}
                            {loc.LocationCode ? `/${loc.LocationCode}` : ""}
                            {loc.LotNo ? ` · Lot: ${loc.LotNo}` : ""} — OnHand: <strong className="tx2">{loc.OnHandQty}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ستون چپ: کمبودهای مواد (GET /mrp/shortages)، خروجی اجرای MRP و پیشنهادهای تأمین */}
            <section className="glass-dark rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="tx1 font-semibold">{tr("کمبودهای باز مواد (GET /mrp/shortages)", "Open Material Shortages")}</h4>
                <span className="tx3 text-xs">
                  {tr(`${shortages.length} کمبود فعال`, `${shortages.length} shortages`)}
                </span>
              </div>

              {/* فیلتر کمبود بر اساس سفارش و ماده */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <select
                  aria-label="Shortage Order Filter"
                  className={inputCls}
                  value={shortageFilterOrderId}
                  onChange={(e) => setShortageFilterOrderId(e.target.value)}
                >
                  <option value="">{tr("همهٔ سفارش‌ها", "All Orders")}</option>
                  {orders.map((o) => (
                    <option key={o.Id} value={o.Id}>
                      {o.OrderNo} ({o.Status})
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Shortage Material Filter"
                  className={inputCls}
                  value={shortageFilterMaterialId}
                  onChange={(e) => setShortageFilterMaterialId(e.target.value)}
                >
                  <option value="">{tr("همهٔ مواد", "All Materials")}</option>
                  {materials.map((m) => (
                    <option key={m.Id} value={m.Id}>
                      {m.PartNo ?? m.Id} — {m.PartNameFa ?? ""}
                    </option>
                  ))}
                </select>
              </div>

              {!shortages.length ? (
                <p className="tx3 text-xs">{tr("کمبودی مطابق فیلترها ثبت نشده است.", "No shortages found.")}</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {shortages.map((s) => {
                    const checked = selectedShortageIds.includes(s.Id);
                    return (
                      <div
                        key={s.Id}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2 text-xs tx2 space-y-1"
                        dir="ltr"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleShortage(s.Id)}
                            />
                            <strong className="tx1">{s.PartNo ?? s.MaterialId}</strong>
                            {s.OrderNo && <span className="tx3">· Order: {s.OrderNo}</span>}
                            {s.OperationCode && <span className="tx3">· Op: {s.OperationCode}</span>}
                          </label>
                          <button
                            type="button"
                            className={btnCls}
                            onClick={() => handleSelectShortageForConsume(s)}
                          >
                            {tr("تخصیص به فرم مصرف", "Prefill Consume")}
                          </button>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2 text-[11px]">
                          <span className="tx3">
                            Gross: {s.GrossQuantity} + Scrap: {s.ScrapAllowanceQty} = Net: <strong>{s.NetQuantity}</strong> · Avail: {s.AvailableQuantity}
                          </span>
                          <span className="text-rose-300">
                            Shortage: <strong>{s.ShortageQuantity} {s.Uom}</strong> (Need: {s.RequiredAt.slice(0, 10)})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {mrpResult && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs text-sky-200 space-y-1" dir="ltr">
                  <div className="font-semibold">
                    MRP Calculation @ {mrpResult.calculationAt?.slice(0, 19).replace("T", " ")} · PreviewOnly: {String(mrpResult.previewOnly)} · Schedule: v{mrpResult.scheduleVersion ?? 1}
                  </div>
                  <div>
                    Total Requirements: <strong>{mrpResult.requirements?.length ?? 0}</strong> · Shortages: <strong>{mrpResult.shortages?.length ?? 0}</strong> · Auto-Suggested Proposals: <strong>{mrpResult.proposals?.length ?? 0}</strong>
                  </div>
                </div>
              )}

              {proposalResult?.proposals && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-200 space-y-1.5" dir="ltr">
                  <div className="font-semibold">
                    Procurement Proposals Created ({proposalResult.proposalsCount ?? proposalResult.proposals.length}):
                  </div>
                  {proposalResult.proposals.map((prp: any, idx: number) => (
                    <div key={idx} className="rounded bg-black/25 px-2 py-1 flex flex-wrap justify-between gap-2">
                      <span>
                        <strong>{prp.ProposalNo}</strong> · {prp.PartNo ?? prp.MaterialId} ({prp.ProcurementType})
                      </span>
                      <span>
                        Shortage: {prp.ShortageQuantity} → Suggested: <strong>{prp.SuggestedQuantity} {prp.Uom}</strong> · OrderBy: {prp.OrderBy?.slice(0, 10)} · Est: {prp.EstimatedTotalCost?.toLocaleString() ?? "—"} {prp.Currency}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* فرم ثبت مصرف واقعی مواد با کسر اتمیک موجودی انبار و کنترل LotNo */}
            <section className="glass-dark rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="tx1 font-semibold">
                  {tr(
                    "ثبت مصرف واقعی مواد و کسر اتمیک موجودی انبار (POST /material-consumptions)",
                    "Record Actual Material Consumption (Atomic Inventory Deduction)",
                  )}
                </h4>
                <span className="tx3 text-[11px]" dir="ltr">Idempotency-Key + LotNo Check</span>
              </div>

              {canMfgAccess(mfgUserId, "mfg.material.consume", plantId) ? (
                <form onSubmit={handleConsumeMaterial} className="space-y-2 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="tx3 block mb-1">{tr("عملیات سفارش (OperationId)", "Operation")}</label>
                      <select
                        aria-label="Consumption Operation"
                        className={inputCls}
                        value={consumeForm.OperationId}
                        onChange={(e) => setConsumeForm((f) => ({ ...f, OperationId: e.target.value }))}
                      >
                        <option value="">{tr("انتخاب عملیات...", "Select Operation...")}</option>
                        {queueOps.map((op) => (
                          <option key={op.Id} value={op.Id}>
                            {op.OrderNo ?? op.ProductionOrderId} · #{op.SequenceNo} {op.OperationCode} ({op.Status})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="tx3 block mb-1">{tr("مادهٔ مصرفی (MaterialId)", "Material")}</label>
                      <select
                        aria-label="Consumption Material"
                        className={inputCls}
                        value={consumeForm.MaterialId}
                        onChange={(e) => {
                          const mat = materials.find((m) => m.Id === e.target.value);
                          if (mat) handleSelectMaterialForConsume(mat);
                          else setConsumeForm((f) => ({ ...f, MaterialId: e.target.value }));
                        }}
                      >
                        <option value="">{tr("انتخاب ماده...", "Select Material...")}</option>
                        {materials.map((m) => (
                          <option key={m.Id} value={m.Id}>
                            {m.PartNo ?? m.Id} — {m.PartNameFa ?? ""} (OnHand: {m.OnHandQty ?? 0} {m.BaseUom ?? ""})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="tx3 block mb-1">{tr("مقدار مصرف (Quantity)", "Quantity")}</label>
                      <input
                        type="number"
                        step="0.1"
                        className={inputCls}
                        dir="ltr"
                        value={consumeForm.Quantity}
                        onChange={(e) => setConsumeForm((f) => ({ ...f, Quantity: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="tx3 block mb-1">{tr("روش ثبت مصرف (ConsumptionMethod)", "Consumption Method")}</label>
                      <select
                        aria-label="Consumption Method"
                        className={inputCls}
                        value={consumeForm.ConsumptionMethod}
                        onChange={(e) =>
                          setConsumeForm((f) => ({
                            ...f,
                            ConsumptionMethod: e.target.value as "manual" | "backflush" | "issue",
                          }))
                        }
                      >
                        <option value="manual">manual (ثبت دستی کارگاهی)</option>
                        <option value="issue">issue (حوالهٔ انبار)</option>
                        <option value="backflush">backflush (کسر خودکار پسینی)</option>
                      </select>
                    </div>
                    <div>
                      <label className="tx3 block mb-1">
                        {tr("شماره بچ / لات (LotNo)", "LotNo")}
                        {materials.find((m) => m.Id === consumeForm.MaterialId)?.IsLotTracked && (
                          <strong className="text-amber-300 mx-1">{tr("(الزامی)", "(Required)")}</strong>
                        )}
                      </label>
                      <input
                        className={inputCls}
                        dir="ltr"
                        placeholder="LOT-..."
                        value={consumeForm.LotNo}
                        onChange={(e) => setConsumeForm((f) => ({ ...f, LotNo: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="tx3 block mb-1">{tr("بهای واحد مصرف (UnitCost - IRR)", "Unit Cost (IRR)")}</label>
                      <input
                        type="number"
                        className={inputCls}
                        dir="ltr"
                        value={consumeForm.UnitCost}
                        onChange={(e) => setConsumeForm((f) => ({ ...f, UnitCost: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="tx3 text-[11px]" dir="ltr">
                      Warehouse: {consumeForm.WarehouseCode} · UoM: {consumeForm.Uom}
                      {consumeForm.RequirementId ? ` · Linked Req: ${consumeForm.RequirementId}` : ""}
                    </span>
                    <button type="submit" className={btnCls} disabled={busy}>
                      {tr("ثبت مصرف واقعی و کسر موجودی انبار", "Post Material Consumption")}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="tx3 text-xs">{tr("نقش فعلی مجوز mfg.material.consume ندارد.", "Requires mfg.material.consume permission.")}</p>
              )}
            </section>

            {/* پنل هشدارهای کمبود مواد و تولید در تب MRP */}
            <section className="glass-dark rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="tx1 font-semibold">
                  {tr("هشدارهای کمبود مواد و کارگاه (GET /alerts)", "Material Shortage & Plant Alerts")}
                </h4>
                <span className="tx3 text-xs" dir="ltr">
                  Open: {alerts.filter((a) => a.Status === "open").length} / Total: {alerts.length}
                </span>
              </div>
              {!alerts.length ? (
                <p className="tx3 text-xs">{tr("هشداری ثبت نشده است.", "No alerts found.")}</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {alerts.map((al) => (
                    <div key={al.Id} className="rounded-lg border b-line-soft p-2 text-xs tx2 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong className="tx1">{al.TitleFa}</strong>
                          <span className="mx-1.5 tx3" dir="ltr">
                            [{al.AlertCode} · {al.Severity} · {al.Status} · v{al.RowVersion}]
                          </span>
                        </div>
                        {al.Status === "open" && canMfgAccess(mfgUserId, "mfg.alert.ack", plantId) && (
                          <button className={btnCls} disabled={busy} onClick={() => void handleAckAlert(al)}>
                            {tr("تأیید دریافت (Ack)", "Acknowledge")}
                          </button>
                        )}
                      </div>
                      {al.DetailFa && <p className="tx3 text-[11px]">{al.DetailFa}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ══════════════════════ ۷) تب بهای تمام‌شده و تطبیق مالی ══════════════════════ */}
      {!loading && tab === "planning" && (
        <div className="space-y-3">
          <section className="glass-dark rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="tx1 font-semibold">{tr("زیربخش برنامه‌ریزی:", "Planning area:")}</span>
            {([
              ["mps", "برنامهٔ اصلی تولید (MPS)", "Master Production Schedule"],
              ["demand", "تقاضا و پیش‌بینی", "Demand & Forecast"],
              ["lotsize", "اندازه‌گذاری لات (EOQ/POQ/L4L/FOQ)", "Lot Sizing (EOQ/POQ/L4L/FOQ)"],
              ["atp", "قابل‌تعهد بودن (ATP)", "Available-to-Promise"],
              ["split", "تقسیم و هم‌پوشانی عملیات", "Splitting & Overlap"],
              ["planned", "سفارش برنامه‌ریزی‌شده", "Planned Orders"],
              ["crp", "ظرفیت و بار (CRP)", "Capacity Requirements"],
              ["pegging", "Lead Time و Pegging", "Lead Time & Pegging"],
              ["version", "نسخهٔ تولید", "Production Versions"],
              ["conformance", "انطباق ISA-95", "ISA-95 Conformance"],
            ] as const).map(([id, fa, en]) => (
              <button key={id} className={`${btnCls} ${planSubTab === id ? "toggle-on" : ""}`} onClick={() => setPlanSubTab(id)}>
                {tr(fa, en)}
              </button>
            ))}
          </section>

          {/* ═══ MPS ═══ */}
          {planSubTab === "mps" && (
            <div className="space-y-3">
              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("پارامترهای افق برنامه‌ریزی", "Planning Horizon Parameters")}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  <select aria-label="TimeBucket" className={inputCls} value={mpsForm.TimeBucket} onChange={(e) => setMpsForm((f) => ({ ...f, TimeBucket: e.target.value as "day" | "week" | "month" }))}>
                    <option value="day">day</option>
                    <option value="week">week</option>
                    <option value="month">month</option>
                  </select>
                  <input type="number" min={1} max={52} title="BucketCount" className={inputCls} value={mpsForm.BucketCount} onChange={(e) => setMpsForm((f) => ({ ...f, BucketCount: Number(e.target.value) }))} />
                  <input type="date" title="HorizonStart" className={inputCls} dir="ltr" value={mpsForm.HorizonStart} onChange={(e) => setMpsForm((f) => ({ ...f, HorizonStart: e.target.value }))} />
                  <input type="number" min={0} title="DemandTimeFenceBuckets" placeholder="DTF" className={inputCls} value={mpsForm.DemandTimeFenceBuckets} onChange={(e) => setMpsForm((f) => ({ ...f, DemandTimeFenceBuckets: Number(e.target.value) }))} />
                  <input type="number" min={0} title="FirmPlannedTimeFenceBuckets" placeholder="FPTF" className={inputCls} value={mpsForm.FirmPlannedTimeFenceBuckets} onChange={(e) => setMpsForm((f) => ({ ...f, FirmPlannedTimeFenceBuckets: Number(e.target.value) }))} />
                  <input placeholder={tr("شناسهٔ قطعه‌ها (اختیاری، با کاما)", "PartIds (optional, csv)")} className={inputCls} dir="ltr" value={mpsForm.PartIds} onChange={(e) => setMpsForm((f) => ({ ...f, PartIds: e.target.value }))} />
                  <div className="flex items-center gap-2 text-[11px] tx2">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={mpsForm.IncludeOpenOrdersAsReceipts} onChange={(e) => setMpsForm((f) => ({ ...f, IncludeOpenOrdersAsReceipts: e.target.checked }))} />
                      {tr("رسید سفارش باز", "Open-order receipts")}
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={mpsForm.ConsumeForecast} onChange={(e) => setMpsForm((f) => ({ ...f, ConsumeForecast: e.target.checked }))} />
                      {tr("مصرف پیش‌بینی با سفارش", "Forecast consumption")}
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={btnCls} disabled={busy || !canMfgAccess(mfgUserId, "mfg.mps.run", plantId)} onClick={() => void handleRunMps(true)}>
                    {tr("پیش‌نمایش (بدون ذخیره)", "Preview (no write)")}
                  </button>
                  <button className={btnCls} disabled={busy || !canMfgAccess(mfgUserId, "mfg.mps.run", plantId)} onClick={() => void handleRunMps(false)}>
                    {tr("اجرا و ثبت MPS (POST /mps/runs)", "Run & Persist MPS")}
                  </button>
                  <button className={btnCls} disabled={busy || !canMfgAccess(mfgUserId, "mfg.mps.firm", plantId) || !(mpsResult?.run ?? mpsRuns[0])} onClick={() => void handleFirmMps()}>
                    {tr("قطعی‌کردن سطرهای درون حصار", "Firm Lines Inside Fence")}
                  </button>
                </div>
                {mpsResult?.run && (
                  <div className="text-[11px] tx3 flex flex-wrap gap-3" dir="ltr">
                    <span>RunNo: <strong>{mpsResult.run.RunNo}</strong></span>
                    <span>Lines: <strong>{mpsResult.run.LineCount}</strong></span>
                    <span>PlannedQty: <strong>{mpsResult.run.TotalPlannedOrderQty}</strong></span>
                    <span>Horizon: {mpsResult.horizonStart} → {mpsResult.horizonEnd}</span>
                  </div>
                )}
              </section>

              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("سطرهای زمان‌بندی‌شده", "Time-Phased Schedule Lines")}</h4>
                <div className="overflow-x-auto">
                  <div className="min-w-[900px] space-y-1" dir="ltr">
                    <div className="grid grid-cols-11 gap-1 text-[10px] tx3 font-semibold">
                      {["Bucket", "Start", "Gross", "Sched.Rcpt", "Proj.Before", "Net", "Planned Rcpt", "Release", "Release At", "Proj.After", "Rule / Firm"].map((h) => (
                        <div key={h} className="rounded border b-line-soft p-1 text-center">{h}</div>
                      ))}
                    </div>
                    {mpsLines.map((line, idx) => (
                      <div key={line.Id ?? `${line.PartId}-${line.BucketIndex}-${idx}`} className={`grid grid-cols-11 gap-1 text-[11px] tx2 ${line.IsFirm ? "toggle-on" : ""}`}>
                        <div className="rounded border b-line-soft p-1 text-center">{line.BucketIndex}</div>
                        <div className="rounded border b-line-soft p-1 text-center">{line.BucketStart}</div>
                        <div className="rounded border b-line-soft p-1 text-center">{line.GrossRequirementQty}</div>
                        <div className="rounded border b-line-soft p-1 text-center">{line.ScheduledReceiptQty}</div>
                        <div className="rounded border b-line-soft p-1 text-center">{line.ProjectedOnHandBefore}</div>
                        <div className="rounded border b-line-soft p-1 text-center">{line.NetRequirementQty}</div>
                        <div className="rounded border b-line-soft p-1 text-center font-semibold">{line.PlannedOrderReceiptQty}</div>
                        <div className="rounded border b-line-soft p-1 text-center">{line.PlannedOrderReleaseQty}</div>
                        <div className="rounded border b-line-soft p-1 text-center">{line.PlannedOrderReleaseAt ?? "—"}</div>
                        <div className="rounded border b-line-soft p-1 text-center">{line.ProjectedOnHandAfter}</div>
                        <div className="rounded border b-line-soft p-1 text-center">{line.LotSizingRule}{line.IsFirm ? " · FIRM" : line.InsideDemandTimeFence ? " · DTF" : ""}</div>
                      </div>
                    ))}
                    {mpsLines.length === 0 && <div className="text-[11px] tx3">{tr("هنوز سطری محاسبه نشده است؛ ابتدا MPS را اجرا کنید.", "No lines yet — run the MPS first.")}</div>}
                  </div>
                </div>
              </section>

              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("تاریخچهٔ اجراهای MPS", "MPS Run History")}</h4>
                <div className="space-y-1.5">
                  {mpsRuns.map((run) => (
                    <div key={run.Id} className="rounded border b-line-soft p-2 text-[11px] tx2 flex flex-wrap justify-between gap-2" dir="ltr">
                      <span>#{run.RunNo} · {run.TimeBucket} × {run.BucketCount} · DTF {run.DemandTimeFenceBuckets} / FPTF {run.FirmPlannedTimeFenceBuckets}</span>
                      <span>{run.HorizonStart} → {run.HorizonEnd} · Lines <strong>{run.LineCount}</strong> · Qty <strong>{run.TotalPlannedOrderQty}</strong> · v{run.RowVersion}</span>
                    </div>
                  ))}
                  {mpsRuns.length === 0 && <div className="text-[11px] tx3">{tr("اجرایی ثبت نشده است.", "No runs recorded.")}</div>}
                </div>
              </section>
            </div>
          )}

          {/* ═══ Demand & Forecast ═══ */}
          {planSubTab === "demand" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("ثبت تقاضا / پیش‌بینی", "Create Demand / Forecast")}</h4>
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void handleCreateDemand(); }}>
                  <select aria-label="PartId" className={inputCls} value={demandForm.PartId} onChange={(e) => setDemandForm((f) => ({ ...f, PartId: e.target.value }))}>
                    <option value="">{tr("— انتخاب قطعه —", "— select part —")}</option>
                    {parts.map((part) => (
                      <option key={part.Id} value={part.Id}>{part.PartNo} · {part.NameFa}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select aria-label="DemandType" className={inputCls} value={demandForm.DemandType} onChange={(e) => setDemandForm((f) => ({ ...f, DemandType: e.target.value as MfgDemandType }))}>
                      <option value="sales-order">sales-order</option>
                      <option value="forecast">forecast</option>
                      <option value="contract">contract</option>
                      <option value="manual">manual</option>
                    </select>
                    <input placeholder="DemandRef" className={inputCls} dir="ltr" value={demandForm.DemandRef} onChange={(e) => setDemandForm((f) => ({ ...f, DemandRef: e.target.value }))} />
                    <input type="date" className={inputCls} dir="ltr" value={demandForm.RequiredAt} onChange={(e) => setDemandForm((f) => ({ ...f, RequiredAt: e.target.value }))} />
                    <input type="number" min={0} placeholder="Quantity" className={inputCls} value={demandForm.Quantity} onChange={(e) => setDemandForm((f) => ({ ...f, Quantity: e.target.value }))} />
                  </div>
                  <input type="number" min={0} max={100} placeholder={tr("درصد اطمینان (برای forecast الزامی)", "ConfidencePct (required for forecast)")} className={inputCls} value={demandForm.ConfidencePct} onChange={(e) => setDemandForm((f) => ({ ...f, ConfidencePct: e.target.value }))} />
                  <button type="submit" className={btnCls} disabled={busy || !demandForm.PartId || !canMfgAccess(mfgUserId, "mfg.demand.edit", plantId)}>
                    {tr("ثبت تقاضا (POST /demand-forecasts)", "Create Demand")}
                  </button>
                </form>
                <button className={btnCls} disabled={busy} onClick={() => void handleLoadTimePhased()}>
                  {tr("نمایش زمان‌بندی‌شدهٔ تقاضا", "Show Time-Phased Demand")}
                </button>
                {timePhased && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] tx3" dir="ltr">
                      {timePhased.bucketUnit} × {timePhased.bucketCount} · {timePhased.horizonStart} → {timePhased.horizonEnd}
                      {timePhased.outsideHorizonQty > 0 ? ` · ${tr("خارج از افق", "outside horizon")}: ${timePhased.outsideHorizonQty}` : ""}
                    </div>
                    {(timePhased.parts ?? []).map((part: any) => (
                      <div key={part.partId} className="rounded border b-line-soft p-2 text-[11px] tx2" dir="ltr">
                        <strong>{part.partNo ?? part.partId}</strong> · total {part.totalQty} {part.uom ?? ""}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(part.lines ?? []).map((line: any, idx: number) => (
                            <span key={idx} className="rounded border b-line-soft px-1.5 py-0.5">{line.bucketStart}: {line.totalQty}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("فهرست تقاضا", "Demand Register")}</h4>
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                  {demandRows.map((row) => (
                    <div key={row.Id} className="rounded border b-line-soft p-2 text-[11px] tx2 flex flex-wrap items-center justify-between gap-2">
                      <span dir="ltr">
                        <strong>{row.DemandRef}</strong> · {row.DemandType} · {row.RequiredAt} · <strong>{row.Quantity}</strong> {row.Uom}
                        {row.ConfidencePct != null ? ` · ${row.ConfidencePct}%` : ""} · {row.Status}
                      </span>
                      {canMfgAccess(mfgUserId, "mfg.demand.edit", plantId) && row.Status !== "consumed" && (
                        <button className={btnCls} disabled={busy} onClick={() => void handleDeleteDemand(row)}>
                          {tr("حذف", "Delete")}
                        </button>
                      )}
                    </div>
                  ))}
                  {demandRows.length === 0 && <div className="text-[11px] tx3">{tr("تقاضایی ثبت نشده است.", "No demand rows.")}</div>}
                </div>
              </section>
            </div>
          )}

          {/* ═══ Lot Sizing ═══ */}
          {planSubTab === "lotsize" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("سیاست اندازه‌گذاری لات", "Lot Sizing Policy")}</h4>
                <div className="space-y-2">
                  <select aria-label="PartId" className={inputCls} value={lotForm.PartId} onChange={(e) => setLotForm((f) => ({ ...f, PartId: e.target.value }))}>
                    <option value="">{tr("— انتخاب قطعه —", "— select part —")}</option>
                    {parts.map((part) => (
                      <option key={part.Id} value={part.Id}>{part.PartNo} · {part.NameFa}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <select aria-label="RuleCode" className={inputCls} value={lotForm.RuleCode} onChange={(e) => setLotForm((f) => ({ ...f, RuleCode: e.target.value as MfgLotSizingRule }))}>
                      <option value="L4L">L4L</option>
                      <option value="FOQ">FOQ</option>
                      <option value="EOQ">EOQ</option>
                      <option value="POQ">POQ</option>
                    </select>
                    <input type="date" className={inputCls} dir="ltr" value={lotForm.EffectiveFrom} onChange={(e) => setLotForm((f) => ({ ...f, EffectiveFrom: e.target.value }))} />
                    <input type="number" min={0} placeholder="OrderingCost" className={inputCls} value={lotForm.OrderingCost} onChange={(e) => setLotForm((f) => ({ ...f, OrderingCost: e.target.value }))} />
                    <input type="number" min={0} placeholder="HoldingCost/Unit/Year" className={inputCls} value={lotForm.HoldingCostPerUnitPerYear} onChange={(e) => setLotForm((f) => ({ ...f, HoldingCostPerUnitPerYear: e.target.value }))} />
                    <input type="number" min={0} placeholder="AnnualDemandQty" className={inputCls} value={lotForm.AnnualDemandQty} onChange={(e) => setLotForm((f) => ({ ...f, AnnualDemandQty: e.target.value }))} />
                    <input type="number" min={1} placeholder="PeriodDays" className={inputCls} value={lotForm.PeriodDays} onChange={(e) => setLotForm((f) => ({ ...f, PeriodDays: e.target.value }))} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className={btnCls} disabled={busy || !lotForm.PartId || !canMfgAccess(mfgUserId, "mfg.lotsize.edit", plantId)} onClick={() => void handleCreateLotPolicy()}>
                      {tr("ثبت سیاست (POST /lot-sizing-policies)", "Save Policy")}
                    </button>
                    <button className={btnCls} disabled={busy || !lotForm.PartId} onClick={() => void handleEvaluateLot()}>
                      {tr("ارزیابی خشک (بدون ذخیره)", "Dry-Run Evaluate")}
                    </button>
                  </div>
                </div>
                {lotEvaluation && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] tx3" dir="ltr">
                      {lotEvaluation.lotSizingRule} · source {lotEvaluation.policySource}
                      {lotEvaluation.eoq ? ` · EOQ ${lotEvaluation.eoq.eoq ?? "—"} (raw ${lotEvaluation.eoq.rawEoq ?? "—"}, ${lotEvaluation.eoq.ordersPerYear ?? "—"} orders/yr)` : ""}
                      {lotEvaluation.periodOrderQuantity != null ? ` · POQ ${lotEvaluation.periodOrderQuantity}` : ""}
                    </div>
                    <div className="space-y-1" dir="ltr">
                      {(lotEvaluation.lines ?? []).map((line: MfgMasterScheduleLine, idx: number) => (
                        <div key={idx} className="rounded border b-line-soft p-1.5 text-[11px] tx2 flex justify-between">
                          <span>{line.BucketStart}</span>
                          <span>gross {line.GrossRequirementQty} → receipt <strong>{line.PlannedOrderReceiptQty}</strong> · on-hand {line.ProjectedOnHandAfter}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("سیاست‌های ثبت‌شده", "Saved Policies")}</h4>
                <div className="space-y-1.5">
                  {lotPolicies.map((policy) => (
                    <div key={policy.Id} className="rounded border b-line-soft p-2 text-[11px] tx2 flex flex-wrap justify-between gap-2" dir="ltr">
                      <span><strong>{policy.RuleCode}</strong> {policy.PolicyCode ?? ""} · from {policy.EffectiveFrom}</span>
                      <span>
                        {policy.eoq ? `EOQ ${policy.eoq}` : ""}
                        {policy.PeriodOrderQuantity ? ` · POQ ${policy.PeriodOrderQuantity}` : ""}
                        {policy.FixedLotQty ? ` · FOQ ${policy.FixedLotQty}` : ""}
                        {policy.OrderMultiple ? ` · mult ${policy.OrderMultiple}` : ""}
                        {policy.MinOrderQty ? ` · min ${policy.MinOrderQty}` : ""}
                        {policy.MaxOrderQty ? ` · max ${policy.MaxOrderQty}` : ""}
                        {!policy.IsActive ? " · inactive" : ""}
                      </span>
                    </div>
                  ))}
                  {lotPolicies.length === 0 && <div className="text-[11px] tx3">{tr("سیاستی ثبت نشده؛ از پارامترهای قطعه استفاده می‌شود.", "No policies — part planning parameters apply.")}</div>}
                </div>
              </section>
            </div>
          )}

          {/* ═══ ATP ═══ */}
          {planSubTab === "atp" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("بررسی تعهد تحویل", "Delivery Promise Check")}</h4>
                <select aria-label="PartId" className={inputCls} value={atpForm.PartId} onChange={(e) => setAtpForm((f) => ({ ...f, PartId: e.target.value }))}>
                  <option value="">{tr("— انتخاب قطعه —", "— select part —")}</option>
                  {parts.map((part) => (
                    <option key={part.Id} value={part.Id}>{part.PartNo} · {part.NameFa}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min={0} placeholder="RequestedQty" className={inputCls} value={atpForm.RequestedQty} onChange={(e) => setAtpForm((f) => ({ ...f, RequestedQty: e.target.value }))} />
                  <input type="date" className={inputCls} dir="ltr" value={atpForm.RequestedAt} onChange={(e) => setAtpForm((f) => ({ ...f, RequestedAt: e.target.value }))} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] tx2">
                  <select aria-label="Mode" className={inputCls} value={atpForm.Mode} onChange={(e) => setAtpForm((f) => ({ ...f, Mode: e.target.value as "discrete" | "cumulative" }))}>
                    <option value="cumulative">cumulative</option>
                    <option value="discrete">discrete</option>
                  </select>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={atpForm.IncludeForecast} onChange={(e) => setAtpForm((f) => ({ ...f, IncludeForecast: e.target.checked }))} />
                    {tr("پیش‌بینی هم کسر شود", "Consume forecast too")}
                  </label>
                </div>
                <button className={btnCls} disabled={busy || !atpForm.PartId || !canMfgAccess(mfgUserId, "mfg.atp.check", plantId)} onClick={() => void handleAtpCheck()}>
                  {tr("بررسی ATP (POST /atp/checks)", "Check ATP")}
                </button>
                {atpResult?.check && (
                  <div className={`rounded border b-line-soft p-2 text-[11px] tx2 space-y-1 ${atpResult.check.status === "available" ? "toggle-on" : ""}`} dir="ltr">
                    <div>Status: <strong>{atpResult.check.status}</strong> · promised {atpResult.check.promisedQty} · opening ATP {atpResult.openingAvailableQty}</div>
                    <div>Promised at: {atpResult.check.promisedAt ?? "—"}{atpResult.check.delayBuckets ? ` (${atpResult.check.delayBuckets} buckets late)` : ""}</div>
                    {atpResult.check.shortageQty > 0 && <div className="text-amber-300">Shortage: {atpResult.check.shortageQty}</div>}
                  </div>
                )}
                {atpBuckets.length > 0 && (
                  <div className="space-y-1 pt-1" dir="ltr">
                    {atpBuckets.map((bucket) => (
                      <div key={bucket.bucketIndex} className="rounded border b-line-soft p-1.5 text-[11px] tx2 flex justify-between">
                        <span>{bucket.bucketStart}</span>
                        <span>demand {bucket.demandQty} · supply {bucket.supplyQty} · ATP <strong>{bucket.availableToPromise}</strong> · cum {bucket.cumulativeAtp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("تاریخچهٔ تعهدها", "Promise History")}</h4>
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                  {atpChecks.map((row) => (
                    <div key={row.Id} className="rounded border b-line-soft p-2 text-[11px] tx2 flex flex-wrap justify-between gap-2" dir="ltr">
                      <span>{row.RequestedAt} · qty <strong>{row.RequestedQty}</strong> · {row.Mode}</span>
                      <span className={row.Result === "unavailable" ? "text-amber-300" : ""}>
                        {row.Result} · promised {row.PromisedQty}{row.PromisedAt ? ` by ${row.PromisedAt}` : ""}{row.ShortageQty ? ` · short ${row.ShortageQty}` : ""}
                      </span>
                    </div>
                  ))}
                  {atpChecks.length === 0 && <div className="text-[11px] tx3">{tr("بررسی‌ای ثبت نشده است.", "No checks recorded.")}</div>}
                </div>
              </section>
            </div>
          )}

          {/* ═══ Splitting & Overlap ═══ */}
          {planSubTab === "split" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("تقسیم لات و هم‌پوشانی عملیات", "Operation Splitting & Overlap")}</h4>
                <select aria-label="OrderId" className={inputCls} value={splitForm.OrderId} onChange={(e) => { setSplitForm((f) => ({ ...f, OrderId: e.target.value, OperationId: "" })); setSplitView(null); }}>
                  <option value="">{tr("— انتخاب سفارش —", "— select order —")}</option>
                  {orders.map((ord) => (
                    <option key={ord.Id} value={ord.Id}>{ord.OrderNo} · {ord.Status}</option>
                  ))}
                </select>
                <select aria-label="OperationId" className={inputCls} value={splitForm.OperationId} onChange={(e) => setSplitForm((f) => ({ ...f, OperationId: e.target.value }))}>
                  <option value="">{tr("— انتخاب عملیات —", "— select operation —")}</option>
                  {(selectedOrder?.Operations ?? []).map((op) => (
                    <option key={op.Id} value={op.Id}>{op.OperationCode} · seq {op.SequenceNo} · {op.Status}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" min={1} placeholder="SplitLotCount" className={inputCls} value={splitForm.SplitLotCount} onChange={(e) => setSplitForm((f) => ({ ...f, SplitLotCount: e.target.value }))} />
                  <input type="number" min={1} placeholder="TransferBatchQty" className={inputCls} value={splitForm.TransferBatchQty} onChange={(e) => setSplitForm((f) => ({ ...f, TransferBatchQty: e.target.value }))} />
                  <input type="number" min={1} max={99} placeholder="OverlapPct" className={inputCls} value={splitForm.OverlapPct} onChange={(e) => setSplitForm((f) => ({ ...f, OverlapPct: e.target.value }))} />
                  <label className="flex items-center gap-1 text-[11px] tx2">
                    <input type="checkbox" checked={splitForm.OverlapAllowed} onChange={(e) => setSplitForm((f) => ({ ...f, OverlapAllowed: e.target.checked }))} />
                    {tr("هم‌پوشانی مجاز", "Overlap allowed")}
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className={btnCls} disabled={busy || !splitForm.OrderId || !splitForm.OperationId} onClick={() => void handleLoadSplits()}>
                    {tr("بارگذاری لات‌ها", "Load Lots")}
                  </button>
                  <button className={btnCls} disabled={busy || !splitForm.OrderId || !splitForm.OperationId || !canMfgAccess(mfgUserId, "mfg.split.edit", plantId)} onClick={() => void handleReplaceSplits()}>
                    {tr("اعمال تقسیم", "Apply Split")}
                  </button>
                  <button className={btnCls} disabled={busy || !splitForm.OrderId} onClick={() => void handleLeadTimeAnalysis(splitForm.OrderId)}>
                    {tr("تحلیل زمان تحویل", "Lead-Time Analysis")}
                  </button>
                </div>
                {splitView?.operation && (
                  <div className="text-[11px] tx3" dir="ltr">
                    {splitView.operation.OperationCode} · qty {splitView.operation.PlannedQuantity} · transfer batch {splitView.operation.effectiveTransferBatchQty ?? "—"}
                    {splitView.operation.SplitLotCount ? ` · split ${splitView.operation.SplitLotCount}` : ""}
                  </div>
                )}
              </section>

              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("لات‌ها و اثر هم‌پوشانی", "Lots & Overlap Effect")}</h4>
                <div className="space-y-1.5">
                  {(splitView?.lots ?? []).map((lot: MfgOperationSplitLot) => (
                    <div key={lot.Id} className={`rounded border b-line-soft p-2 text-[11px] tx2 flex flex-wrap justify-between gap-2 ${lot.IsTransferBatch ? "toggle-on" : ""}`} dir="ltr">
                      <span>
                        Lot {lot.SplitNo} · qty <strong>{lot.Quantity}</strong> · cum {lot.CumulativeQuantity ?? "—"}
                        {lot.IsTransferBatch ? ` · ${tr("لات انتقال", "transfer batch")}` : ""}
                      </span>
                      <span>
                        {lot.StartedAt ? `${lot.StartedAt} → ${lot.CompletedAt ?? "…"}` : tr("شروع نشده", "not started")}
                        {canMfgAccess(mfgUserId, "mfg.split.edit", plantId) && (
                          <button className={`${btnCls} ms-2`} disabled={busy} onClick={() => void handleDeleteSplit(lot.Id)}>{tr("حذف", "Delete")}</button>
                        )}
                      </span>
                    </div>
                  ))}
                  {(!splitView?.lots || splitView.lots.length === 0) && <div className="text-[11px] tx3">{tr("لاتی ثبت نشده است.", "No split lots.")}</div>}
                </div>
                {leadTime?.analysis && (
                  <div className="rounded border b-line-soft p-2 text-[11px] tx2 space-y-1 pt-2" dir="ltr">
                    <div className="tx1 font-semibold">{tr("تحلیل زمان تحویل سفارش", "Order Lead-Time Analysis")} · {leadTime.order.OrderNo}</div>
                    <div>Operations: {leadTime.operationCount} (scheduled {leadTime.scheduledOperationCount})</div>
                    <div>Baseline capacity: {leadTime.analysis.baselineCapacityMinutes ?? "—"} min · overlapped {leadTime.analysis.overlappedCapacityMinutes ?? "—"} min</div>
                    <div>Baseline lead time: {leadTime.analysis.baselineLeadTimeMinutes ?? "—"} min · overlapped {leadTime.analysis.overlappedLeadTimeMinutes ?? "—"} min</div>
                    <div>Saving: <strong>{leadTime.analysis.savedLeadTimeMinutes ?? 0}</strong> min{leadTime.analysis.scheduledSpanMinutes != null ? ` · measured span ${leadTime.analysis.scheduledSpanMinutes} min` : ""}</div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ═══ ۱۱.۳ سفارش برنامه‌ریزی‌شده ═══ */}
          {planSubTab === "planned" && (
            <div className="space-y-3">
              <section className="glass-dark rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="tx1 font-semibold">{tr("سفارش‌های برنامه‌ریزی‌شدهٔ MRP", "MRP Planned Orders")}</h4>
                  <button className={btnCls} disabled={busy} onClick={() => void loadPlannedOrders()}>
                    {tr("بارگذاری مجدد", "Reload")}
                  </button>
                </div>
                <p className="text-[11px] tx3">
                  {tr(
                    "خروجی MRP پیشنهاد است نه تعهد: بازبینی و تأیید کنید، سپس به سفارش تولید تبدیل کنید. آزادسازی همچنان گیت جداست.",
                    "MRP output is a suggestion, not a commitment: review and approve, then convert to a production order. Release remains a separate gate.",
                  )}
                </p>
                <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
                  {plannedOrders.map((row) => (
                    <div key={row.Id} className="rounded border b-line-soft p-2 text-[11px] tx2 flex flex-wrap items-center justify-between gap-2" dir="ltr">
                      <div className="space-y-0.5">
                        <div><strong>{row.PlannedOrderNo}</strong> · {row.Source} · LLC {row.LowLevelCode}</div>
                        <div>
                          qty <strong>{row.Quantity}</strong>{row.Quantity !== row.OriginalQuantity ? ` (was ${row.OriginalQuantity})` : ""} · {row.Uom}
                          {" · "}lead {row.CumulativeLeadTimeDays}d · {row.LotSizingRule}
                        </div>
                        <div>release {row.PlannedReleaseAt?.slice(0, 10) ?? "—"} → due {row.PlannedDueAt?.slice(0, 10) ?? "—"}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded border b-line-soft ${row.Status === "converted" ? "toggle-on" : row.Status === "rejected" ? "text-amber-300" : ""}`}>
                          {row.Status}
                        </span>
                        {row.Status === "proposed" && (
                          <>
                            <button
                              className={btnCls}
                              disabled={busy || !canMfgAccess(mfgUserId, "mfg.plannedorder.approve", plantId)}
                              onClick={() => void handleTransitionPlannedOrder(row, "approve")}
                            >
                              {tr("تأیید", "Approve")}
                            </button>
                            <button
                              className={btnCls}
                              disabled={busy || !canMfgAccess(mfgUserId, "mfg.plannedorder.approve", plantId)}
                              onClick={() => void handleTransitionPlannedOrder(row, "reject")}
                            >
                              {tr("رد", "Reject")}
                            </button>
                          </>
                        )}
                        {row.Status === "approved" && (
                          <button
                            className={btnCls}
                            disabled={busy || !canMfgAccess(mfgUserId, "mfg.plannedorder.convert", plantId)}
                            onClick={() => void handleConvertPlannedOrder(row)}
                          >
                            {tr("تبدیل به سفارش تولید", "Convert to production order")}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {plannedOrders.length === 0 && (
                    <div className="text-[11px] tx3">{tr("سفارش برنامه‌ریزی‌شده‌ای نیست؛ ابتدا MRP را اجرا کنید.", "No planned orders; run MRP first.")}</div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ═══ ۱۱.۷ CRP ═══ */}
          {planSubTab === "crp" && (
            <div className="space-y-3">
              <section className="glass-dark rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="tx1 font-semibold">{tr("بار در برابر ظرفیت مراکز کاری", "Work Center Load vs Capacity")}</h4>
                  <button
                    className={btnCls}
                    disabled={busy || !canMfgAccess(mfgUserId, "mfg.crp.view", plantId)}
                    onClick={() => void handleCalculateCrp()}
                  >
                    {tr("محاسبهٔ CRP", "Calculate CRP")}
                  </button>
                </div>
                {crpReport && (
                  <>
                    <div className="text-[11px] tx2" dir="ltr">
                      {tr("افق:", "Horizon:")} {crpReport.horizonStart} → {crpReport.horizonEnd} ·{" "}
                      {tr("بار کل:", "total load:")} {crpReport.totals.loadMinutes} / {crpReport.totals.capacityMinutes} min ·{" "}
                      {tr("بهره‌وری:", "utilization:")} {crpReport.totals.utilizationPct}%
                    </div>
                    <div className="space-y-2 max-h-[420px] overflow-y-auto">
                      {crpReport.workCenters.map((center) => (
                        <div key={center.workCenterId} className="rounded border b-line-soft p-2 space-y-1">
                          <div className="text-[11px] tx1 font-semibold" dir="ltr">
                            {center.code ?? center.workCenterId} · {center.utilizationPct}% ·{" "}
                            {tr("پربار:", "overload:")} {center.overloadBucketCount} · {tr("کم‌بار:", "underload:")} {center.underloadBucketCount}
                          </div>
                          {/* نمودار میله‌ای بار/ظرفیت: سطل‌های پربار قرمز و کم‌بار کهربایی. */}
                          <div className="flex items-end gap-1 h-16" dir="ltr">
                            {(center.buckets ?? []).map((bucket) => {
                              const pct = bucket.capacityMinutes > 0 ? Math.min(160, (bucket.loadMinutes / bucket.capacityMinutes) * 100) : 0;
                              const tone = bucket.status === "overload" ? "bg-rose-400" : bucket.status === "underload" ? "bg-amber-300" : "bg-emerald-300";
                              return (
                                <div key={bucket.bucketIndex} className="flex-1 flex flex-col items-center gap-0.5" title={`${bucket.bucketStart}: ${bucket.loadMinutes}/${bucket.capacityMinutes} min`}>
                                  <div className="w-full rounded-t" style={{ height: `${Math.max(2, pct * 0.35)}px` }}>
                                    <div className={`w-full h-full rounded-t ${tone} opacity-80`} />
                                  </div>
                                  <span className="text-[9px] tx3">{bucket.bucketStart.slice(5)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {crpReport.levelingSuggestions.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <h5 className="tx1 text-[11px] font-semibold">{tr("پیشنهاد تسطیح بار", "Load Leveling Suggestions")}</h5>
                        {crpReport.levelingSuggestions.map((suggestion, index) => (
                          <div key={index} className="rounded border b-line-soft p-1.5 text-[11px] tx2" dir="ltr">
                            {JSON.stringify(suggestion)}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {!crpReport && <div className="text-[11px] tx3">{tr("هنوز محاسبه‌ای انجام نشده است.", "No calculation yet.")}</div>}
              </section>
            </div>
          )}

          {/* ═══ ۱۱.۵/۱۱.۶ Lead Time Offset و Pegging ═══ */}
          {planSubTab === "pegging" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <section className="glass-dark rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="tx1 font-semibold">{tr("زمان تحویل تجمیعی و Offset", "Cumulative Lead Time & Offset")}</h4>
                  <button
                    className={btnCls}
                    disabled={busy || !canMfgAccess(mfgUserId, "mfg.mrp.view", plantId)}
                    onClick={() => void handleLoadLeadTimeAndPegging()}
                  >
                    {tr("محاسبه", "Calculate")}
                  </button>
                </div>
                {leadTimeOffset && (
                  <>
                    <div className="text-[11px] tx2" dir="ltr">
                      {tr("محصول نهایی:", "Finished goods:")} <strong>{leadTimeOffset.finishedGoodsLeadTimeDays}</strong> {tr("روز", "days")} ·{" "}
                      {tr("بیشترین سطح BOM:", "max BOM level:")} {leadTimeOffset.maxLowLevelCode}
                    </div>
                    <div className="space-y-1 max-h-[420px] overflow-y-auto">
                      {leadTimeOffset.parts.map((row) => (
                        <div key={row.partId} className="rounded border b-line-soft p-1.5 text-[11px] tx2 flex flex-wrap justify-between gap-2" dir="ltr">
                          <span>{row.partNo ?? row.partId} · L{row.lowLevelCode}</span>
                          <span>own {row.ownLeadTimeDays}d · cum <strong>{row.cumulativeLeadTimeDays}d</strong> · avail offset {row.availabilityOffsetDays}d</span>
                        </div>
                      ))}
                      {leadTimeOffset.parts.length === 0 && <div className="text-[11px] tx3">{tr("BOM آزادشده‌ای نیست.", "No released BOM.")}</div>}
                    </div>
                  </>
                )}
              </section>

              <section className="glass-dark rounded-xl p-3 space-y-2">
                <h4 className="tx1 font-semibold">{tr("Pegging چندسطحی", "Multi-level Pegging")}</h4>
                {peggingReport && (
                  <>
                    <div className="text-[11px] tx2" dir="ltr">
                      {tr("نیازها:", "Requirements:")} {peggingReport.requirementCount} · {tr("ریشه‌ها:", "roots:")} {peggingReport.rootSupplyRefs.length}
                    </div>
                    <div className="space-y-1 max-h-[420px] overflow-y-auto">
                      {peggingReport.items.map((item) => (
                        <div key={item.supplyRef} className="rounded border b-line-soft p-1.5 text-[11px] tx2 space-y-0.5" dir="ltr">
                          <div><strong>{item.partNo ?? item.partId}</strong> · {item.paths.length} {tr("مسیر", "path(s)")}</div>
                          {item.paths.slice(0, 3).map((path, index) => (
                            <div key={index} className="tx3">
                              {path.map((step) => step.partNo ?? step.partId).join(" ← ")}
                            </div>
                          ))}
                        </div>
                      ))}
                      {peggingReport.items.length === 0 && <div className="text-[11px] tx3">{tr("نیازی برای pegging نیست.", "Nothing to peg.")}</div>}
                    </div>
                  </>
                )}
                {!peggingReport && <div className="text-[11px] tx3">{tr("هنوز محاسبه‌ای انجام نشده است.", "No calculation yet.")}</div>}
              </section>
            </div>
          )}

          {/* ═══ ۱۱.۹ نسخهٔ تولید ═══ */}
          {planSubTab === "version" && (
            <div className="space-y-3">
              <section className="glass-dark rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="tx1 font-semibold">{tr("نسخه‌های تولید (BOM/Routing چندگانه)", "Production Versions (multiple BOM/Routing)")}</h4>
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="PartId"
                      className={inputCls}
                      value={versionForm.PartId}
                      onChange={(e) => setVersionForm((f) => ({ ...f, PartId: e.target.value }))}
                    >
                      <option value="">{tr("— انتخاب قطعه —", "— select part —")}</option>
                      {parts.map((part) => (
                        <option key={part.Id} value={part.Id}>{part.PartNo} · {part.NameFa}</option>
                      ))}
                    </select>
                    <button
                      className={btnCls}
                      disabled={busy || !versionForm.PartId || !canMfgAccess(mfgUserId, "mfg.version.edit", plantId)}
                      onClick={() => void handleCreateProductionVersion(versionForm.PartId)}
                    >
                      {tr("نسخهٔ تازه", "New version")}
                    </button>
                    <button className={btnCls} disabled={busy} onClick={() => void loadProductionVersions()}>
                      {tr("بارگذاری مجدد", "Reload")}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                  {productionVersions.map((row) => (
                    <div key={row.Id} className="rounded border b-line-soft p-2 text-[11px] tx2 flex flex-wrap items-center justify-between gap-2" dir="ltr">
                      <span>
                        <strong>{row.VersionCode}</strong> · BOM {row.BomRevision} · Routing {row.RoutingRevision}
                        {row.WorkCenterId ? ` · line ${row.WorkCenterId.slice(-6)}` : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {row.IsDefault && <span className="px-1.5 py-0.5 rounded border b-line-soft toggle-on">{tr("پیش‌فرض", "default")}</span>}
                        {!row.IsActive && <span className="px-1.5 py-0.5 rounded border b-line-soft text-amber-300">{tr("غیرفعال", "inactive")}</span>}
                        {row.Priority !== null && <span className="tx3">priority {row.Priority}</span>}
                      </span>
                    </div>
                  ))}
                  {productionVersions.length === 0 && (
                    <div className="text-[11px] tx3">{tr("نسخه‌ای تعریف نشده است.", "No versions defined.")}</div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ═══ ۱۱.۱۱ انطباق ISA-95 / MESA-11 ═══ */}
          {planSubTab === "conformance" && (
            <div className="space-y-3">
              <section className="glass-dark rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="tx1 font-semibold">{tr("انطباق ISA-95 و یازده عملکرد MESA", "ISA-95 & MESA-11 Conformance")}</h4>
                  <button
                    className={btnCls}
                    disabled={busy || !canMfgAccess(mfgUserId, "mfg.conformance.view", plantId)}
                    onClick={() => void loadConformance()}
                  >
                    {tr("بررسی انطباق", "Check conformance")}
                  </button>
                </div>
                {conformance && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] tx2">
                      <div className="rounded border b-line-soft p-2 space-y-1">
                        <div className="tx1 font-semibold">{tr("سطح ۳ — این MES", "Level 3 — this MES")}</div>
                        <div dir="ltr">{conformance.isa95.level3.roleEn}</div>
                        <div dir="ltr">{tr("مسیرهای پیاده‌شده:", "implemented routes:")} <strong>{conformance.isa95.level3.implementedRouteCount}</strong></div>
                      </div>
                      <div className="rounded border b-line-soft p-2 space-y-1">
                        <div className="tx1 font-semibold">{tr("سطح ۴ — ERP", "Level 4 — ERP")}</div>
                        <div dir="ltr">{conformance.isa95.level4.roleEn}</div>
                        <div dir="ltr">
                          {tr("کلید خارجی به سطح ۴:", "foreign keys to level 4:")} <strong>{conformance.isa95.level4.foreignKeysToLevel4}</strong>
                        </div>
                        <div className="tx3">{conformance.isa95.boundary}</div>
                      </div>
                    </div>
                    <div className="text-[11px] tx2" dir="ltr">
                      {tr("عملکردهای MESA:", "MESA functions:")} <strong>{conformance.mesa11.fullyCovered}/{conformance.mesa11.functionCount}</strong> ·{" "}
                      {tr("میانگین پوشش:", "average coverage:")} {conformance.mesa11.averageCoveragePct}%
                    </div>
                    <div className="space-y-1 max-h-[420px] overflow-y-auto">
                      {conformance.mesa11.functions.map((fn) => (
                        <div key={fn.id} className="rounded border b-line-soft p-1.5 text-[11px] tx2 flex flex-wrap justify-between gap-2" dir="ltr">
                          <span>{fn.id}. {fn.titleEn} <span className="tx3">/ {fn.titleFa}</span></span>
                          <span className={fn.coveragePct === 100 ? "toggle-on" : "text-amber-300"}>
                            {fn.coveredRouteCount}/{fn.totalRouteCount} · {fn.coveragePct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {!conformance && <div className="text-[11px] tx3">{tr("هنوز بررسی نشده است.", "Not checked yet.")}</div>}
              </section>
            </div>
          )}
        </div>
      )}

      {!loading && tab === "cost" && (
        <div className="space-y-3">
          <section className="glass-dark rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="tx1 font-semibold">{tr("انتخاب سفارش تولید:", "Select Order:")}</span>
              {orders.map((ord) => (
                <button
                  key={ord.Id}
                  className={`${btnCls} ${costOrderId === ord.Id ? "toggle-on" : ""}`}
                  onClick={() => void handleSelectCostOrder(ord.Id)}
                >
                  {ord.OrderNo} ({ord.Status})
                </button>
              ))}
            </div>
            {costOrderId && orderCost && !orderCost.Reconciled && canMfgAccess(mfgUserId, "mfg.cost.reconcile", plantId) && (
              <button className={btnCls} disabled={busy} onClick={() => void handleReconcileOrderCost()}>
                {tr("تطبیق نهایی هزینهٔ سفارش (POST /cost/orders/:id/reconcile)", "Reconcile Order Cost")}
              </button>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <section className="glass-dark rounded-xl p-3 space-y-2">
              <h4 className="tx1 font-semibold">{tr("خلاصهٔ استاندارد، برنامه‌ریزی‌شده و واقعی سفارش", "Standard, Planned & Actual Order Cost")}</h4>
              {orderCost ? (
                <div className="space-y-2 text-xs tx2">
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-2" dir="ltr">
                    {[
                      ["Standard", orderCost.StandardTotalCost],
                      ["Planned", orderCost.PlannedTotalCost ?? orderCost.StandardTotalCost],
                      ["Actual", orderCost.ActualTotalCost],
                      ["Actual − Standard", orderCost.CostVariance ?? orderCost.Variance ?? 0],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="rounded border b-line-soft p-2">
                        <div className="tx3">{label}</div>
                        <strong className="tx1">{Number(value ?? 0).toLocaleString()} {orderCost.Currency}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 rounded border b-line-soft p-2">
                    <span dir="ltr">
                      {tr("انحراف از استاندارد:", "Variance vs standard:")} {orderCost.CostVariance?.toLocaleString() ?? orderCost.Variance?.toLocaleString() ?? 0} ({orderCost.CostVariancePct == null ? "—" : `${orderCost.CostVariancePct}%`})
                      {" · "}{tr("از برنامه:", "vs planned:")} {orderCost.PlannedCostVariance?.toLocaleString() ?? 0} ({orderCost.PlannedCostVariancePct == null ? "—" : `${orderCost.PlannedCostVariancePct}%`})
                    </span>
                    <span className={orderCost.Reconciled ? "text-emerald-300" : "text-amber-300"}>
                      {orderCost.Reconciled ? "✓ Reconciled" : tr("در انتظار تطبیق", "Pending reconcile")}
                      {orderCost.ReconcileThrough ? ` · ${orderCost.ReconcileThrough.slice(0, 16).replace("T", " ")}` : ""}
                    </span>
                  </div>
                  {orderCost.ByElement && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" dir="ltr">
                      {(["material", "machine", "labor", "overhead", "scrap"] as const).map((el) => {
                        const values = orderCost.ByElement?.[el];
                        return (
                          <div key={el} className="rounded border b-line-soft p-2">
                            <div className="tx1 font-medium uppercase">{el}</div>
                            <div className="tx3">Std: {values?.standard?.toLocaleString() ?? 0}</div>
                            <div className="tx3">Plan: {values?.planned?.toLocaleString() ?? 0}</div>
                            <div className="tx2">Act: {values?.actual?.toLocaleString() ?? 0} {orderCost.Currency}</div>
                            <div className="tx3">
                              Δ Std: {values?.costVariance?.toLocaleString() ?? 0}
                              {values?.costVariancePct == null ? "" : ` (${values.costVariancePct}%)`}
                            </div>
                            <div className="tx3">
                              Δ Plan: {values?.plannedCostVariance?.toLocaleString() ?? 0}
                              {values?.plannedCostVariancePct == null ? "" : ` (${values.plannedCostVariancePct}%)`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!!orderCost.OperationBreakdown?.length && (
                    <div className="space-y-1 border-t b-line-soft pt-2">
                      <h5 className="tx1 font-medium">{tr("تفکیک عملیات", "Operation breakdown")}</h5>
                      {orderCost.OperationBreakdown.map((operation) => (
                        <div key={operation.OperationId} className="flex flex-wrap justify-between gap-2 rounded border b-line-soft p-2" dir="ltr">
                          <span>{operation.SequenceNo} · {operation.OperationCode} · {operation.WorkCenterId}</span>
                          <span>Std {operation.StandardTotalCost.toLocaleString()} · Plan {operation.PlannedTotalCost.toLocaleString()} · Act <strong>{operation.ActualTotalCost.toLocaleString()} {operation.Currency ?? orderCost.Currency}</strong></span>
                          <span className="tx3">Δ Std {operation.CostVariance.toLocaleString()} ({operation.CostVariancePct == null ? "—" : `${operation.CostVariancePct}%`}) · Δ Plan {operation.PlannedCostVariance.toLocaleString()} ({operation.PlannedCostVariancePct == null ? "—" : `${operation.PlannedCostVariancePct}%`})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="tx3 text-xs">{tr("سفارشی انتخاب نشده است.", "No order selected.")}</p>
              )}
            </section>

            <section className="glass-dark rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="tx1 font-semibold">{tr("رول‌آپ هزینهٔ عملیات (GET /cost/operations/:operationId)", "Operation Cost Roll-up")}</h4>
                {opCosts && (
                  <span className="rounded border b-line-soft px-2 py-0.5 text-[10px] tx3" dir="ltr">
                    derived: {String(opCosts.derived)}
                  </span>
                )}
              </div>
              {selectedOrder?.Operations && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedOrder.Operations.map((op) => (
                    <button
                      key={op.Id}
                      className={`${btnCls} ${costOpId === op.Id ? "toggle-on" : ""}`}
                      onClick={() => void handleSelectCostOp(op.Id)}
                    >
                      #{op.SequenceNo} {op.OperationCode}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-1.5">
                {(opCosts?.items ?? []).map((row, idx) => (
                  <div key={idx} className="rounded border b-line-soft p-2 text-xs tx2 flex justify-between" dir="ltr">
                    <span>
                      <strong>{row.CostElement}</strong> ({row.SourceRef ?? "stored"})
                    </span>
                    <span>
                      Std: {row.StandardAmount?.toLocaleString()} · Plan: {row.PlannedAmount?.toLocaleString() ?? row.StandardAmount?.toLocaleString()} · Act: <strong>{row.ActualAmount?.toLocaleString()} {row.Currency}</strong>
                      {" · Δ "}{row.CostVariance?.toLocaleString() ?? "—"}{row.CostVariancePct == null ? "" : ` (${row.CostVariancePct}%)`}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
