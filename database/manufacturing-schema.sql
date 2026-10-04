-- MFG · Standalone Operation-Based Production Planning & Control (MES)
-- تولیدشده از src/services/manufacturingSchema.ts و persistence.ts؛ ویرایش دستی نکنید.
-- دیتابیس کاملاً مستقل MES: بدون هیچ وابستگی یا کلید خارجی به جداول سامانهٔ کنترل پروژه.
-- PlantId دامنهٔ اجباری داده‌های تولید است؛ ارجاع به سامانه‌های دیگر فقط از طریق کلید نرم و REST API است.

-- MfgPart · قطعه و محصول
IF OBJECT_ID('dbo.MfgPart', 'U') IS NULL
CREATE TABLE [dbo].[MfgPart] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartNo] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [PartType] NVARCHAR(20) NOT NULL,
  [BaseUom] NVARCHAR(16) NOT NULL,
  [DescriptionFa] NVARCHAR(1200) NULL,
  [StandardUnitCost] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [IsLotTracked] BIT NOT NULL DEFAULT 0,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgPart] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_MfgPart_Type] CHECK (PartType IN ('manufactured','purchased','phantom','subcontract')),
  CONSTRAINT [CK_MfgPart_Cost] CHECK (StandardUnitCost IS NULL OR StandardUnitCost >= 0)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgPart_PlantNo' AND object_id = OBJECT_ID(N'dbo.MfgPart'))
  CREATE UNIQUE INDEX [UX_MfgPart_PlantNo] ON [dbo].[MfgPart] ([PlantId], [PartNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgPart_Type' AND object_id = OBJECT_ID(N'dbo.MfgPart'))
  CREATE INDEX [IX_MfgPart_Type] ON [dbo].[MfgPart] ([PlantId], [PartType], [IsActive]);
GO

-- MfgBomHeader · نسخهٔ BOM
IF OBJECT_ID('dbo.MfgBomHeader', 'U') IS NULL
CREATE TABLE [dbo].[MfgBomHeader] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [Revision] NVARCHAR(60) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [BaseQuantity] DECIMAL(18,4) NOT NULL DEFAULT 1,
  [BaseUom] NVARCHAR(16) NOT NULL,
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [IsDefault] BIT NOT NULL DEFAULT 0,
  [ReleasedAt] DATETIME2 NULL,
  [ReleasedBy] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgBomHeader] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgBomHeader_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgBomHeader_Status] CHECK (Status IN ('draft','released','obsolete')),
  CONSTRAINT [CK_MfgBomHeader_BaseQty] CHECK (BaseQuantity > 0),
  CONSTRAINT [CK_MfgBomHeader_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
  CONSTRAINT [CK_MfgBomHeader_Release] CHECK (Status <> 'released' OR (ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL))
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgBomHeader_Revision' AND object_id = OBJECT_ID(N'dbo.MfgBomHeader'))
  CREATE UNIQUE INDEX [UX_MfgBomHeader_Revision] ON [dbo].[MfgBomHeader] ([PlantId], [PartId], [Revision]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgBomHeader_Effective' AND object_id = OBJECT_ID(N'dbo.MfgBomHeader'))
  CREATE INDEX [IX_MfgBomHeader_Effective] ON [dbo].[MfgBomHeader] ([PlantId], [PartId], [Status], [EffectiveFrom]);
GO

-- MfgBomItem · ردیف BOM
IF OBJECT_ID('dbo.MfgBomItem', 'U') IS NULL
CREATE TABLE [dbo].[MfgBomItem] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [BomHeaderId] NVARCHAR(60) NOT NULL,
  [LineNo] INT NOT NULL,
  [ComponentPartId] NVARCHAR(60) NOT NULL,
  [QuantityPer] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [ScrapPct] DECIMAL(7,3) NOT NULL,
  [IssueAtOperationCode] NVARCHAR(40) NULL,
  [IssueMethod] NVARCHAR(16) NOT NULL DEFAULT 'manual',
  [IsPhantom] BIT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(600) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgBomItem] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgBomItem_BomHeaderId] FOREIGN KEY ([BomHeaderId]) REFERENCES [dbo].[MfgBomHeader] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgBomItem_ComponentPartId] FOREIGN KEY ([ComponentPartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgBomItem_Line] CHECK (LineNo > 0),
  CONSTRAINT [CK_MfgBomItem_Qty] CHECK (QuantityPer > 0),
  CONSTRAINT [CK_MfgBomItem_Scrap] CHECK (ScrapPct >= 0 AND ScrapPct <= 100),
  CONSTRAINT [CK_MfgBomItem_Issue] CHECK (IssueMethod IN ('manual','backflush','kit'))
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgBomItem_Line' AND object_id = OBJECT_ID(N'dbo.MfgBomItem'))
  CREATE UNIQUE INDEX [UX_MfgBomItem_Line] ON [dbo].[MfgBomItem] ([BomHeaderId], [LineNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgBomItem_Component' AND object_id = OBJECT_ID(N'dbo.MfgBomItem'))
  CREATE INDEX [IX_MfgBomItem_Component] ON [dbo].[MfgBomItem] ([PlantId], [ComponentPartId]);
GO

-- MfgCostCenter · مرکز هزینهٔ تولید
IF OBJECT_ID('dbo.MfgCostCenter', 'U') IS NULL
CREATE TABLE [dbo].[MfgCostCenter] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [CostElement] NVARCHAR(16) NOT NULL,
  [HourlyRate] DECIMAL(18,4) NOT NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [AllocationBasis] NVARCHAR(20) NOT NULL DEFAULT 'machine_hours',
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgCostCenter] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_MfgCostCenter_Element] CHECK (CostElement IN ('machine','labor','overhead')),
  CONSTRAINT [CK_MfgCostCenter_Rate] CHECK (HourlyRate >= 0),
  CONSTRAINT [CK_MfgCostCenter_Basis] CHECK (AllocationBasis IN ('machine_hours','labor_hours','units','percent')),
  CONSTRAINT [CK_MfgCostCenter_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgCostCenter_Rate' AND object_id = OBJECT_ID(N'dbo.MfgCostCenter'))
  CREATE UNIQUE INDEX [UX_MfgCostCenter_Rate] ON [dbo].[MfgCostCenter] ([PlantId], [Code], [EffectiveFrom]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgCostCenter_Element' AND object_id = OBJECT_ID(N'dbo.MfgCostCenter'))
  CREATE INDEX [IX_MfgCostCenter_Element] ON [dbo].[MfgCostCenter] ([PlantId], [CostElement], [IsActive]);
GO

-- MfgWorkCenter · مرکز کاری
IF OBJECT_ID('dbo.MfgWorkCenter', 'U') IS NULL
CREATE TABLE [dbo].[MfgWorkCenter] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [Code] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(240) NOT NULL,
  [NameEn] NVARCHAR(240) NULL,
  [Kind] NVARCHAR(20) NOT NULL,
  [NominalCapacityMinutesPerDay] INT NOT NULL DEFAULT 480,
  [EfficiencyPct] DECIMAL(7,3) NOT NULL,
  [CostCenterId] NVARCHAR(60) NULL,
  [TimeZoneId] NVARCHAR(80) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'active',
  [DescriptionFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgWorkCenter] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgWorkCenter_CostCenterId] FOREIGN KEY ([CostCenterId]) REFERENCES [dbo].[MfgCostCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgWorkCenter_Kind] CHECK (Kind IN ('machine','labor','assembly','inspection')),
  CONSTRAINT [CK_MfgWorkCenter_Capacity] CHECK (NominalCapacityMinutesPerDay > 0),
  CONSTRAINT [CK_MfgWorkCenter_Efficiency] CHECK (EfficiencyPct >= 0 AND EfficiencyPct <= 100),
  CONSTRAINT [CK_MfgWorkCenter_Status] CHECK (Status IN ('active','inactive','maintenance'))
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgWorkCenter_Code' AND object_id = OBJECT_ID(N'dbo.MfgWorkCenter'))
  CREATE UNIQUE INDEX [UX_MfgWorkCenter_Code] ON [dbo].[MfgWorkCenter] ([PlantId], [Code]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgWorkCenter_Status' AND object_id = OBJECT_ID(N'dbo.MfgWorkCenter'))
  CREATE INDEX [IX_MfgWorkCenter_Status] ON [dbo].[MfgWorkCenter] ([PlantId], [Status], [Kind]);
GO

-- MfgWorkCenterResource · منبع مرکز کاری
IF OBJECT_ID('dbo.MfgWorkCenterResource', 'U') IS NULL
CREATE TABLE [dbo].[MfgWorkCenterResource] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [ResourceCode] NVARCHAR(60) NOT NULL,
  [NameFa] NVARCHAR(200) NOT NULL,
  [ResourceKind] NVARCHAR(12) NOT NULL,
  [CapacityUnits] DECIMAL(18,4) NOT NULL,
  [AvailabilityPct] DECIMAL(7,3) NOT NULL,
  [EquipmentId] NVARCHAR(60) NULL,
  [CostCenterId] NVARCHAR(60) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [EffectiveFrom] DATE NULL,
  [EffectiveTo] DATE NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgWorkCenterResource] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgWorkCenterResource_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgWorkCenterResource_CostCenterId] FOREIGN KEY ([CostCenterId]) REFERENCES [dbo].[MfgCostCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgWcResource_Kind] CHECK (ResourceKind IN ('machine','labor')),
  CONSTRAINT [CK_MfgWcResource_Capacity] CHECK (CapacityUnits > 0),
  CONSTRAINT [CK_MfgWcResource_Availability] CHECK (AvailabilityPct >= 0 AND AvailabilityPct <= 100),
  CONSTRAINT [CK_MfgWcResource_Dates] CHECK (EffectiveTo IS NULL OR EffectiveFrom IS NULL OR EffectiveTo >= EffectiveFrom)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgWcResource_Code' AND object_id = OBJECT_ID(N'dbo.MfgWorkCenterResource'))
  CREATE UNIQUE INDEX [UX_MfgWcResource_Code] ON [dbo].[MfgWorkCenterResource] ([WorkCenterId], [ResourceCode]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgWcResource_Active' AND object_id = OBJECT_ID(N'dbo.MfgWorkCenterResource'))
  CREATE INDEX [IX_MfgWcResource_Active] ON [dbo].[MfgWorkCenterResource] ([PlantId], [WorkCenterId], [IsActive]);
GO

-- MfgWorkCenterCalendar · تقویم و شیفت مرکز کاری
IF OBJECT_ID('dbo.MfgWorkCenterCalendar', 'U') IS NULL
CREATE TABLE [dbo].[MfgWorkCenterCalendar] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [RuleType] NVARCHAR(16) NOT NULL,
  [RuleKey] NVARCHAR(100) NOT NULL,
  [WeekdayIso] INT NULL,
  [CalendarDate] DATE NULL,
  [ShiftCode] NVARCHAR(60) NOT NULL,
  [StartMinuteOfDay] INT NULL,
  [EndMinuteOfDay] INT NULL,
  [BreakMinutes] INT NOT NULL DEFAULT 0,
  [BreakStartMinuteOfDay] INT NULL,
  [IsWorking] BIT NOT NULL DEFAULT 1,
  [AvailabilityPct] DECIMAL(7,3) NOT NULL,
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgWorkCenterCalendar] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgWorkCenterCalendar_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgWcCalendar_Type] CHECK (RuleType IN ('weekly','date-override')),
  CONSTRAINT [CK_MfgWcCalendar_KeyShape] CHECK ((RuleType = 'weekly' AND WeekdayIso IS NOT NULL AND WeekdayIso BETWEEN 1 AND 7 AND CalendarDate IS NULL) OR (RuleType = 'date-override' AND WeekdayIso IS NULL AND CalendarDate IS NOT NULL)),
  CONSTRAINT [CK_MfgWcCalendar_Shift] CHECK ((IsWorking = 1 AND StartMinuteOfDay IS NOT NULL AND EndMinuteOfDay IS NOT NULL AND StartMinuteOfDay BETWEEN 0 AND 1439 AND EndMinuteOfDay > StartMinuteOfDay AND EndMinuteOfDay <= 2879 AND BreakMinutes >= 0 AND BreakMinutes <= EndMinuteOfDay - StartMinuteOfDay) OR (IsWorking = 0 AND StartMinuteOfDay IS NULL AND EndMinuteOfDay IS NULL)),
  CONSTRAINT [CK_MfgWcCalendar_BreakStart] CHECK (BreakStartMinuteOfDay IS NULL OR (IsWorking = 1 AND BreakMinutes > 0 AND BreakStartMinuteOfDay >= StartMinuteOfDay AND BreakStartMinuteOfDay + BreakMinutes <= EndMinuteOfDay)),
  CONSTRAINT [CK_MfgWcCalendar_Break] CHECK (BreakMinutes >= 0),
  CONSTRAINT [CK_MfgWcCalendar_Availability] CHECK (AvailabilityPct >= 0 AND AvailabilityPct <= 100),
  CONSTRAINT [CK_MfgWcCalendar_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgWcCalendar_Rule' AND object_id = OBJECT_ID(N'dbo.MfgWorkCenterCalendar'))
  CREATE UNIQUE INDEX [UX_MfgWcCalendar_Rule] ON [dbo].[MfgWorkCenterCalendar] ([WorkCenterId], [RuleKey]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgWcCalendar_Date' AND object_id = OBJECT_ID(N'dbo.MfgWorkCenterCalendar'))
  CREATE INDEX [IX_MfgWcCalendar_Date] ON [dbo].[MfgWorkCenterCalendar] ([PlantId], [WorkCenterId], [CalendarDate]);
GO

-- MfgRouting · مسیر تولید
IF OBJECT_ID('dbo.MfgRouting', 'U') IS NULL
CREATE TABLE [dbo].[MfgRouting] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [RoutingCode] NVARCHAR(60) NOT NULL,
  [Revision] NVARCHAR(60) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'draft',
  [BaseQuantity] DECIMAL(18,4) NOT NULL DEFAULT 1,
  [BaseUom] NVARCHAR(16) NOT NULL,
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [IsDefault] BIT NOT NULL DEFAULT 0,
  [ReleasedAt] DATETIME2 NULL,
  [ReleasedBy] NVARCHAR(60) NULL,
  [NoteFa] NVARCHAR(1000) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgRouting] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgRouting_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgRouting_Status] CHECK (Status IN ('draft','released','obsolete')),
  CONSTRAINT [CK_MfgRouting_BaseQty] CHECK (BaseQuantity > 0),
  CONSTRAINT [CK_MfgRouting_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom),
  CONSTRAINT [CK_MfgRouting_Release] CHECK (Status <> 'released' OR (ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL))
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgRouting_Revision' AND object_id = OBJECT_ID(N'dbo.MfgRouting'))
  CREATE UNIQUE INDEX [UX_MfgRouting_Revision] ON [dbo].[MfgRouting] ([PlantId], [PartId], [RoutingCode], [Revision]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgRouting_Effective' AND object_id = OBJECT_ID(N'dbo.MfgRouting'))
  CREATE INDEX [IX_MfgRouting_Effective] ON [dbo].[MfgRouting] ([PlantId], [PartId], [Status], [EffectiveFrom]);
GO

-- MfgRoutingOperation · عملیات مسیر تولید
IF OBJECT_ID('dbo.MfgRoutingOperation', 'U') IS NULL
CREATE TABLE [dbo].[MfgRoutingOperation] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [RoutingId] NVARCHAR(60) NOT NULL,
  [SequenceNo] INT NOT NULL,
  [OperationCode] NVARCHAR(60) NOT NULL,
  [OperationNameFa] NVARCHAR(240) NOT NULL,
  [OperationNameEn] NVARCHAR(240) NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [SetupMinutes] DECIMAL(12,3) NOT NULL,
  [RunMinutesPerUnit] DECIMAL(12,3) NOT NULL,
  [QueueMinutes] DECIMAL(12,3) NOT NULL,
  [MoveMinutes] DECIMAL(12,3) NOT NULL,
  [OverlapAllowed] BIT NOT NULL DEFAULT 0,
  [TransferBatchQty] DECIMAL(18,4) NULL,
  [PredecessorSequence] INT NULL,
  [InspectionRequired] BIT NOT NULL DEFAULT 0,
  [CostCenterId] NVARCHAR(60) NULL,
  [WorkInstructionRef] NVARCHAR(120) NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgRoutingOperation] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgRoutingOperation_RoutingId] FOREIGN KEY ([RoutingId]) REFERENCES [dbo].[MfgRouting] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgRoutingOperation_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgRoutingOperation_CostCenterId] FOREIGN KEY ([CostCenterId]) REFERENCES [dbo].[MfgCostCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgRoutingOp_Sequence] CHECK (SequenceNo > 0),
  CONSTRAINT [CK_MfgRoutingOp_Times] CHECK (SetupMinutes >= 0 AND RunMinutesPerUnit >= 0 AND QueueMinutes >= 0 AND MoveMinutes >= 0),
  CONSTRAINT [CK_MfgRoutingOp_Overlap] CHECK (OverlapAllowed = 0 OR (TransferBatchQty IS NOT NULL AND TransferBatchQty > 0)),
  CONSTRAINT [CK_MfgRoutingOp_Predecessor] CHECK (PredecessorSequence IS NULL OR (PredecessorSequence > 0 AND PredecessorSequence < SequenceNo))
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgRoutingOp_Seq' AND object_id = OBJECT_ID(N'dbo.MfgRoutingOperation'))
  CREATE UNIQUE INDEX [UX_MfgRoutingOp_Seq] ON [dbo].[MfgRoutingOperation] ([RoutingId], [SequenceNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgRoutingOp_WorkCenter' AND object_id = OBJECT_ID(N'dbo.MfgRoutingOperation'))
  CREATE INDEX [IX_MfgRoutingOp_WorkCenter] ON [dbo].[MfgRoutingOperation] ([PlantId], [WorkCenterId], [OperationCode]);
GO

-- MfgProductionOrder · سفارش تولید
IF OBJECT_ID('dbo.MfgProductionOrder', 'U') IS NULL
CREATE TABLE [dbo].[MfgProductionOrder] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [OrderNo] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [OrderQuantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [DueAt] DATETIME2 NOT NULL,
  [RequestedStartAt] DATETIME2 NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'created',
  [PriorityRule] NVARCHAR(12) NOT NULL DEFAULT 'EDD',
  [ManualRank] INT NULL,
  [DispatchWeight] DECIMAL(12,4) NOT NULL DEFAULT 1,
  [DemandSource] NVARCHAR(16) NOT NULL,
  [DemandRef] NVARCHAR(80) NULL,
  [CustomerRef] NVARCHAR(80) NULL,
  [CustomerNameSnapshot] NVARCHAR(240) NULL,
  [ContractId] NVARCHAR(60) NULL,
  [ProjectId] NVARCHAR(60) NULL,
  [BomHeaderId] NVARCHAR(60) NULL,
  [RoutingId] NVARCHAR(60) NULL,
  [BomRevisionSnapshot] NVARCHAR(40) NULL,
  [RoutingRevisionSnapshot] NVARCHAR(40) NULL,
  [ReleasedAt] DATETIME2 NULL,
  [ReleasedBy] NVARCHAR(60) NULL,
  [CompletedAt] DATETIME2 NULL,
  [ClosedAt] DATETIME2 NULL,
  [ClosedBy] NVARCHAR(60) NULL,
  [AllowOverrun] BIT NOT NULL DEFAULT 0,
  [NoteFa] NVARCHAR(1200) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgProductionOrder] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgProductionOrder_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionOrder_BomHeaderId] FOREIGN KEY ([BomHeaderId]) REFERENCES [dbo].[MfgBomHeader] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionOrder_RoutingId] FOREIGN KEY ([RoutingId]) REFERENCES [dbo].[MfgRouting] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgProdOrder_Qty] CHECK (OrderQuantity > 0),
  CONSTRAINT [CK_MfgProdOrder_Status] CHECK (Status IN ('created','released','in-progress','completed','closed')),
  CONSTRAINT [CK_MfgProdOrder_Priority] CHECK (PriorityRule IN ('EDD','CR','MANUAL')),
  CONSTRAINT [CK_MfgProdOrder_DispatchWeight] CHECK (DispatchWeight > 0),
  CONSTRAINT [CK_MfgProdOrder_Demand] CHECK (DemandSource IN ('sales-order','contract','forecast','manual')),
  CONSTRAINT [CK_MfgProdOrder_Rank] CHECK (ManualRank IS NULL OR ManualRank >= 0),
  CONSTRAINT [CK_MfgProdOrder_Release] CHECK (Status = 'created' OR (BomHeaderId IS NOT NULL AND RoutingId IS NOT NULL AND ReleasedAt IS NOT NULL AND ReleasedBy IS NOT NULL))
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgProdOrder_No' AND object_id = OBJECT_ID(N'dbo.MfgProductionOrder'))
  CREATE UNIQUE INDEX [UX_MfgProdOrder_No] ON [dbo].[MfgProductionOrder] ([PlantId], [OrderNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgProdOrder_Dispatch' AND object_id = OBJECT_ID(N'dbo.MfgProductionOrder'))
  CREATE INDEX [IX_MfgProdOrder_Dispatch] ON [dbo].[MfgProductionOrder] ([PlantId], [Status], [DueAt], [PriorityRule]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgProdOrder_Part' AND object_id = OBJECT_ID(N'dbo.MfgProductionOrder'))
  CREATE INDEX [IX_MfgProdOrder_Part] ON [dbo].[MfgProductionOrder] ([PlantId], [PartId], [Status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgProdOrder_Contract' AND object_id = OBJECT_ID(N'dbo.MfgProductionOrder'))
  CREATE INDEX [IX_MfgProdOrder_Contract] ON [dbo].[MfgProductionOrder] ([ContractId], [Status]);
GO

-- MfgProductionOrderOperation · عملیات سفارش تولید
IF OBJECT_ID('dbo.MfgProductionOrderOperation', 'U') IS NULL
CREATE TABLE [dbo].[MfgProductionOrderOperation] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderId] NVARCHAR(60) NOT NULL,
  [RoutingOperationId] NVARCHAR(60) NULL,
  [SequenceNo] INT NOT NULL,
  [OperationCode] NVARCHAR(60) NOT NULL,
  [OperationNameFa] NVARCHAR(240) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [PredecessorOperationId] NVARCHAR(60) NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'pending',
  [PlannedQuantity] DECIMAL(18,4) NOT NULL,
  [PlannedSetupMinutes] DECIMAL(12,3) NOT NULL,
  [PlannedRunMinutesPerUnit] DECIMAL(12,3) NOT NULL,
  [PlannedQueueMinutes] DECIMAL(12,3) NOT NULL,
  [PlannedMoveMinutes] DECIMAL(12,3) NOT NULL,
  [PlannedCapacityMinutes] DECIMAL(12,3) NOT NULL,
  [OverlapAllowed] BIT NOT NULL DEFAULT 0,
  [TransferBatchQty] DECIMAL(18,4) NULL,
  [InspectionRequired] BIT NOT NULL DEFAULT 0,
  [BlockedReasonFa] NVARCHAR(500) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgProductionOrderOperation] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgProductionOrderOperation_ProductionOrderId] FOREIGN KEY ([ProductionOrderId]) REFERENCES [dbo].[MfgProductionOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionOrderOperation_RoutingOperationId] FOREIGN KEY ([RoutingOperationId]) REFERENCES [dbo].[MfgRoutingOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionOrderOperation_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionOrderOperation_PredecessorOperationId] FOREIGN KEY ([PredecessorOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgOrderOp_Sequence] CHECK (SequenceNo > 0),
  CONSTRAINT [CK_MfgOrderOp_Status] CHECK (Status IN ('pending','queued','ready','setup','running','blocked','completed')),
  CONSTRAINT [CK_MfgOrderOp_Qty] CHECK (PlannedQuantity > 0),
  CONSTRAINT [CK_MfgOrderOp_Times] CHECK (PlannedSetupMinutes >= 0 AND PlannedRunMinutesPerUnit >= 0 AND PlannedQueueMinutes >= 0 AND PlannedMoveMinutes >= 0 AND PlannedCapacityMinutes >= 0),
  CONSTRAINT [CK_MfgOrderOp_Overlap] CHECK (OverlapAllowed = 0 OR (TransferBatchQty IS NOT NULL AND TransferBatchQty > 0))
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgOrderOp_Sequence' AND object_id = OBJECT_ID(N'dbo.MfgProductionOrderOperation'))
  CREATE UNIQUE INDEX [UX_MfgOrderOp_Sequence] ON [dbo].[MfgProductionOrderOperation] ([ProductionOrderId], [SequenceNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgOrderOp_Queue' AND object_id = OBJECT_ID(N'dbo.MfgProductionOrderOperation'))
  CREATE INDEX [IX_MfgOrderOp_Queue] ON [dbo].[MfgProductionOrderOperation] ([PlantId], [WorkCenterId], [Status], [SequenceNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgOrderOp_OrderStatus' AND object_id = OBJECT_ID(N'dbo.MfgProductionOrderOperation'))
  CREATE INDEX [IX_MfgOrderOp_OrderStatus] ON [dbo].[MfgProductionOrderOperation] ([ProductionOrderId], [Status]);
GO

-- MfgOperationSchedule · قطعهٔ زمان‌بندی عملیات
IF OBJECT_ID('dbo.MfgOperationSchedule', 'U') IS NULL
CREATE TABLE [dbo].[MfgOperationSchedule] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [ScheduleVersion] INT NOT NULL,
  [SegmentNo] INT NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [ResourceId] NVARCHAR(60) NULL,
  [PlannedStartAt] DATETIME2 NOT NULL,
  [PlannedEndAt] DATETIME2 NOT NULL,
  [PlannedCapacityMinutes] DECIMAL(12,3) NOT NULL,
  [QueueMinutes] DECIMAL(12,3) NOT NULL,
  [MoveMinutes] DECIMAL(12,3) NOT NULL,
  [CapacityMode] NVARCHAR(16) NOT NULL,
  [Direction] NVARCHAR(12) NOT NULL,
  [DispatchRule] NVARCHAR(12) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'tentative',
  [CommittedAt] DATETIME2 NULL,
  [CommittedBy] NVARCHAR(60) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgOperationSchedule] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgOperationSchedule_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgOperationSchedule_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgOperationSchedule_ResourceId] FOREIGN KEY ([ResourceId]) REFERENCES [dbo].[MfgWorkCenterResource] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgOpSchedule_Version] CHECK (ScheduleVersion > 0 AND SegmentNo > 0),
  CONSTRAINT [CK_MfgOpSchedule_Window] CHECK (PlannedEndAt > PlannedStartAt),
  CONSTRAINT [CK_MfgOpSchedule_Times] CHECK (PlannedCapacityMinutes >= 0 AND QueueMinutes >= 0 AND MoveMinutes >= 0),
  CONSTRAINT [CK_MfgOpSchedule_Mode] CHECK (CapacityMode IN ('finite','semi-finite')),
  CONSTRAINT [CK_MfgOpSchedule_Direction] CHECK (Direction IN ('forward','backward')),
  CONSTRAINT [CK_MfgOpSchedule_Status] CHECK (Status IN ('tentative','firm','cancelled'))
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgOpSchedule_Segment' AND object_id = OBJECT_ID(N'dbo.MfgOperationSchedule'))
  CREATE UNIQUE INDEX [UX_MfgOpSchedule_Segment] ON [dbo].[MfgOperationSchedule] ([ProductionOrderOperationId], [ScheduleVersion], [SegmentNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgOpSchedule_WcWindow' AND object_id = OBJECT_ID(N'dbo.MfgOperationSchedule'))
  CREATE INDEX [IX_MfgOpSchedule_WcWindow] ON [dbo].[MfgOperationSchedule] ([PlantId], [WorkCenterId], [PlannedStartAt], [PlannedEndAt], [Status]);
GO

-- MfgCapacityPlan · برنامهٔ ظرفیت مرکز کاری
IF OBJECT_ID('dbo.MfgCapacityPlan', 'U') IS NULL
CREATE TABLE [dbo].[MfgCapacityPlan] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [ScheduleVersion] INT NOT NULL,
  [PeriodStart] DATETIME2 NOT NULL,
  [PeriodEnd] DATETIME2 NOT NULL,
  [AvailableMinutes] DECIMAL(12,3) NOT NULL,
  [PlannedLoadMinutes] DECIMAL(12,3) NOT NULL,
  [ReservedMinutes] DECIMAL(12,3) NOT NULL,
  [UtilizationPct] DECIMAL(7,3) NULL,
  [OverloadMinutes] DECIMAL(12,3) NOT NULL,
  [IsBottleneck] BIT NOT NULL DEFAULT 0,
  [CalculatedAt] DATETIME2 NOT NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgCapacityPlan] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgCapacityPlan_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgCapacityPlan_Period] CHECK (PeriodEnd > PeriodStart),
  CONSTRAINT [CK_MfgCapacityPlan_Load] CHECK (ScheduleVersion > 0 AND AvailableMinutes >= 0 AND PlannedLoadMinutes >= 0 AND ReservedMinutes >= 0 AND OverloadMinutes >= 0 AND ((AvailableMinutes = 0 AND UtilizationPct IS NULL) OR (AvailableMinutes > 0 AND UtilizationPct IS NOT NULL AND UtilizationPct >= 0)))
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgCapacityPlan_Bucket' AND object_id = OBJECT_ID(N'dbo.MfgCapacityPlan'))
  CREATE UNIQUE INDEX [UX_MfgCapacityPlan_Bucket] ON [dbo].[MfgCapacityPlan] ([PlantId], [WorkCenterId], [ScheduleVersion], [PeriodStart], [PeriodEnd]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgCapacityPlan_Bottleneck' AND object_id = OBJECT_ID(N'dbo.MfgCapacityPlan'))
  CREATE INDEX [IX_MfgCapacityPlan_Bottleneck] ON [dbo].[MfgCapacityPlan] ([PlantId], [IsBottleneck], [PeriodStart]);
GO

-- MfgOperationExecution · اجرای واقعی عملیات
IF OBJECT_ID('dbo.MfgOperationExecution', 'U') IS NULL
CREATE TABLE [dbo].[MfgOperationExecution] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [ExecutionNo] INT NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'running',
  [ResourceId] NVARCHAR(60) NULL,
  [OperatorId] NVARCHAR(60) NULL,
  [StartedAt] DATETIME2 NOT NULL,
  [FinishedAt] DATETIME2 NULL,
  [SetupActualMinutes] DECIMAL(12,3) NOT NULL,
  [RunActualMinutes] DECIMAL(12,3) NOT NULL,
  [InputQuantity] DECIMAL(18,4) NOT NULL,
  [GoodQuantity] DECIMAL(18,4) NOT NULL,
  [ReworkQuantity] DECIMAL(18,4) NOT NULL,
  [ScrapQuantity] DECIMAL(18,4) NOT NULL,
  [IdempotencyKey] NVARCHAR(160) NOT NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgOperationExecution] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgOperationExecution_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgOperationExecution_ResourceId] FOREIGN KEY ([ResourceId]) REFERENCES [dbo].[MfgWorkCenterResource] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgExecution_No] CHECK (ExecutionNo > 0),
  CONSTRAINT [CK_MfgExecution_Status] CHECK (Status IN ('running','completed','cancelled')),
  CONSTRAINT [CK_MfgExecution_Times] CHECK (SetupActualMinutes >= 0 AND RunActualMinutes >= 0),
  CONSTRAINT [CK_MfgExecution_Qty] CHECK (InputQuantity >= 0 AND GoodQuantity >= 0 AND ReworkQuantity >= 0 AND ScrapQuantity >= 0 AND GoodQuantity + ReworkQuantity + ScrapQuantity <= InputQuantity),
  CONSTRAINT [CK_MfgExecution_Finish] CHECK (FinishedAt IS NULL OR FinishedAt >= StartedAt),
  CONSTRAINT [CK_MfgExecution_Completed] CHECK (Status <> 'completed' OR FinishedAt IS NOT NULL)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgExecution_No' AND object_id = OBJECT_ID(N'dbo.MfgOperationExecution'))
  CREATE UNIQUE INDEX [UX_MfgExecution_No] ON [dbo].[MfgOperationExecution] ([ProductionOrderOperationId], [ExecutionNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgExecution_Idempotency' AND object_id = OBJECT_ID(N'dbo.MfgOperationExecution'))
  CREATE UNIQUE INDEX [UX_MfgExecution_Idempotency] ON [dbo].[MfgOperationExecution] ([IdempotencyKey]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgExecution_Started' AND object_id = OBJECT_ID(N'dbo.MfgOperationExecution'))
  CREATE INDEX [IX_MfgExecution_Started] ON [dbo].[MfgOperationExecution] ([PlantId], [StartedAt], [Status]);
GO

-- MfgDowntimeLog · ثبت توقف
IF OBJECT_ID('dbo.MfgDowntimeLog', 'U') IS NULL
CREATE TABLE [dbo].[MfgDowntimeLog] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NULL,
  [ExecutionId] NVARCHAR(60) NULL,
  [ResourceId] NVARCHAR(60) NULL,
  [StartedAt] DATETIME2 NOT NULL,
  [FinishedAt] DATETIME2 NULL,
  [DurationMinutes] DECIMAL(12,3) NOT NULL,
  [DowntimeType] NVARCHAR(16) NOT NULL,
  [ReasonCode] NVARCHAR(60) NOT NULL,
  [RecordedBy] NVARCHAR(60) NOT NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgDowntimeLog] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgDowntimeLog_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgDowntimeLog_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgDowntimeLog_ExecutionId] FOREIGN KEY ([ExecutionId]) REFERENCES [dbo].[MfgOperationExecution] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgDowntimeLog_ResourceId] FOREIGN KEY ([ResourceId]) REFERENCES [dbo].[MfgWorkCenterResource] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgDowntime_Type] CHECK (DowntimeType IN ('planned','unplanned')),
  CONSTRAINT [CK_MfgDowntime_Duration] CHECK (DurationMinutes IS NULL OR DurationMinutes >= 0),
  CONSTRAINT [CK_MfgDowntime_Window] CHECK (FinishedAt IS NULL OR FinishedAt >= StartedAt)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgDowntime_WcTime' AND object_id = OBJECT_ID(N'dbo.MfgDowntimeLog'))
  CREATE INDEX [IX_MfgDowntime_WcTime] ON [dbo].[MfgDowntimeLog] ([PlantId], [WorkCenterId], [StartedAt]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgDowntime_Operation' AND object_id = OBJECT_ID(N'dbo.MfgDowntimeLog'))
  CREATE INDEX [IX_MfgDowntime_Operation] ON [dbo].[MfgDowntimeLog] ([ProductionOrderOperationId], [StartedAt]);
GO

-- MfgScrapRecord · ثبت ضایعات
IF OBJECT_ID('dbo.MfgScrapRecord', 'U') IS NULL
CREATE TABLE [dbo].[MfgScrapRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [ExecutionId] NVARCHAR(60) NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [ReasonCode] NVARCHAR(60) NOT NULL,
  [Disposition] NVARCHAR(20) NOT NULL,
  [CostAmount] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [RecordedAt] DATETIME2 NOT NULL,
  [RecordedBy] NVARCHAR(60) NOT NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgScrapRecord] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgScrapRecord_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgScrapRecord_ExecutionId] FOREIGN KEY ([ExecutionId]) REFERENCES [dbo].[MfgOperationExecution] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgScrap_Qty] CHECK (Quantity > 0),
  CONSTRAINT [CK_MfgScrap_Disposition] CHECK (Disposition IN ('scrapped','returned-to-stock','use-as-is')),
  CONSTRAINT [CK_MfgScrap_Cost] CHECK (CostAmount IS NULL OR CostAmount >= 0)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgScrap_Operation' AND object_id = OBJECT_ID(N'dbo.MfgScrapRecord'))
  CREATE INDEX [IX_MfgScrap_Operation] ON [dbo].[MfgScrapRecord] ([PlantId], [ProductionOrderOperationId], [RecordedAt]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgScrap_Reason' AND object_id = OBJECT_ID(N'dbo.MfgScrapRecord'))
  CREATE INDEX [IX_MfgScrap_Reason] ON [dbo].[MfgScrapRecord] ([PlantId], [ReasonCode], [RecordedAt]);
GO

-- MfgReworkRecord · ثبت دوباره‌کاری
IF OBJECT_ID('dbo.MfgReworkRecord', 'U') IS NULL
CREATE TABLE [dbo].[MfgReworkRecord] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ReworkNo] NVARCHAR(60) NOT NULL,
  [SourceOperationId] NVARCHAR(60) NOT NULL,
  [ExecutionId] NVARCHAR(60) NULL,
  [TargetOperationId] NVARCHAR(60) NULL,
  [ScrapRecordId] NVARCHAR(60) NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [ReasonCode] NVARCHAR(60) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'open',
  [StartedAt] DATETIME2 NULL,
  [FinishedAt] DATETIME2 NULL,
  [Disposition] NVARCHAR(20) NULL,
  [ActualCost] DECIMAL(18,2) NULL,
  [NoteFa] NVARCHAR(800) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgReworkRecord] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgReworkRecord_SourceOperationId] FOREIGN KEY ([SourceOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgReworkRecord_TargetOperationId] FOREIGN KEY ([TargetOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgReworkRecord_ExecutionId] FOREIGN KEY ([ExecutionId]) REFERENCES [dbo].[MfgOperationExecution] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgReworkRecord_ScrapRecordId] FOREIGN KEY ([ScrapRecordId]) REFERENCES [dbo].[MfgScrapRecord] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgRework_Qty] CHECK (Quantity > 0),
  CONSTRAINT [CK_MfgRework_Status] CHECK (Status IN ('open','in-progress','completed','cancelled')),
  CONSTRAINT [CK_MfgRework_Window] CHECK (FinishedAt IS NULL OR (StartedAt IS NOT NULL AND FinishedAt >= StartedAt)),
  CONSTRAINT [CK_MfgRework_Cost] CHECK (ActualCost IS NULL OR ActualCost >= 0)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgRework_No' AND object_id = OBJECT_ID(N'dbo.MfgReworkRecord'))
  CREATE UNIQUE INDEX [UX_MfgRework_No] ON [dbo].[MfgReworkRecord] ([PlantId], [ReworkNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgRework_Source' AND object_id = OBJECT_ID(N'dbo.MfgReworkRecord'))
  CREATE INDEX [IX_MfgRework_Source] ON [dbo].[MfgReworkRecord] ([PlantId], [SourceOperationId], [Status]);
GO

-- MfgMaterial · مادهٔ قابل برنامه‌ریزی
IF OBJECT_ID('dbo.MfgMaterial', 'U') IS NULL
CREATE TABLE [dbo].[MfgMaterial] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [PartId] NVARCHAR(60) NOT NULL,
  [ProcurementType] NVARCHAR(8) NOT NULL,
  [LeadTimeDays] INT NOT NULL DEFAULT 0,
  [SafetyStockQty] DECIMAL(18,4) NOT NULL,
  [LotSize] DECIMAL(18,4) NOT NULL,
  [OrderMultiple] DECIMAL(18,4) NOT NULL,
  [ShelfLifeDays] INT NULL,
  [StandardUnitCost] DECIMAL(18,2) NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [DefaultWarehouseCode] NVARCHAR(40) NULL,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgMaterial] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgMaterial_PartId] FOREIGN KEY ([PartId]) REFERENCES [dbo].[MfgPart] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgMaterial_Type] CHECK (ProcurementType IN ('make','buy')),
  CONSTRAINT [CK_MfgMaterial_Lead] CHECK (LeadTimeDays >= 0 AND (ShelfLifeDays IS NULL OR ShelfLifeDays >= 0)),
  CONSTRAINT [CK_MfgMaterial_Quantities] CHECK (SafetyStockQty >= 0 AND LotSize > 0 AND OrderMultiple > 0),
  CONSTRAINT [CK_MfgMaterial_Cost] CHECK (StandardUnitCost IS NULL OR StandardUnitCost >= 0)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgMaterial_Part' AND object_id = OBJECT_ID(N'dbo.MfgMaterial'))
  CREATE UNIQUE INDEX [UX_MfgMaterial_Part] ON [dbo].[MfgMaterial] ([PlantId], [PartId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgMaterial_Replenish' AND object_id = OBJECT_ID(N'dbo.MfgMaterial'))
  CREATE INDEX [IX_MfgMaterial_Replenish] ON [dbo].[MfgMaterial] ([PlantId], [ProcurementType], [IsActive]);
GO

-- MfgMaterialRequirement · نیاز مواد
IF OBJECT_ID('dbo.MfgMaterialRequirement', 'U') IS NULL
CREATE TABLE [dbo].[MfgMaterialRequirement] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NULL,
  [BomItemId] NVARCHAR(60) NOT NULL,
  [MaterialId] NVARCHAR(60) NOT NULL,
  [RequirementKey] NVARCHAR(180) NOT NULL,
  [RequiredAt] DATETIME2 NOT NULL,
  [GrossQuantity] DECIMAL(18,4) NOT NULL,
  [ScrapAllowanceQty] DECIMAL(18,4) NOT NULL,
  [NetQuantity] DECIMAL(18,4) NOT NULL,
  [AvailableQuantity] DECIMAL(18,4) NOT NULL,
  [ReservedQuantity] DECIMAL(18,4) NOT NULL,
  [ShortageQuantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'planned',
  [ScheduleVersion] INT NOT NULL DEFAULT 1,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgMaterialRequirement] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgMaterialRequirement_ProductionOrderId] FOREIGN KEY ([ProductionOrderId]) REFERENCES [dbo].[MfgProductionOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialRequirement_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialRequirement_BomItemId] FOREIGN KEY ([BomItemId]) REFERENCES [dbo].[MfgBomItem] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialRequirement_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [dbo].[MfgMaterial] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgMatReq_Status] CHECK (Status IN ('planned','shortage','reserved','issued','closed','cancelled')),
  CONSTRAINT [CK_MfgMatReq_Qty] CHECK (GrossQuantity >= 0 AND ScrapAllowanceQty >= 0 AND NetQuantity >= 0 AND AvailableQuantity >= 0 AND ReservedQuantity >= 0 AND ShortageQuantity >= 0),
  CONSTRAINT [CK_MfgMatReq_Version] CHECK (ScheduleVersion > 0)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgMatReq_Key' AND object_id = OBJECT_ID(N'dbo.MfgMaterialRequirement'))
  CREATE UNIQUE INDEX [UX_MfgMatReq_Key] ON [dbo].[MfgMaterialRequirement] ([PlantId], [RequirementKey]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgMatReq_Shortage' AND object_id = OBJECT_ID(N'dbo.MfgMaterialRequirement'))
  CREATE INDEX [IX_MfgMatReq_Shortage] ON [dbo].[MfgMaterialRequirement] ([PlantId], [Status], [RequiredAt], [MaterialId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgMatReq_Order' AND object_id = OBJECT_ID(N'dbo.MfgMaterialRequirement'))
  CREATE INDEX [IX_MfgMatReq_Order] ON [dbo].[MfgMaterialRequirement] ([ProductionOrderId], [RequiredAt]);
GO

-- MfgMaterialConsumption · مصرف واقعی مواد
IF OBJECT_ID('dbo.MfgMaterialConsumption', 'U') IS NULL
CREATE TABLE [dbo].[MfgMaterialConsumption] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [RequirementId] NVARCHAR(60) NULL,
  [ExecutionId] NVARCHAR(60) NULL,
  [MaterialId] NVARCHAR(60) NOT NULL,
  [Quantity] DECIMAL(18,4) NOT NULL,
  [Uom] NVARCHAR(16) NOT NULL,
  [LotNo] NVARCHAR(60) NULL,
  [UnitCost] DECIMAL(18,2) NOT NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [ConsumptionMethod] NVARCHAR(12) NOT NULL,
  [ConsumedAt] DATETIME2 NOT NULL,
  [IdempotencyKey] NVARCHAR(160) NOT NULL,
  [PostedBy] NVARCHAR(60) NOT NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgMaterialConsumption] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgMaterialConsumption_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialConsumption_RequirementId] FOREIGN KEY ([RequirementId]) REFERENCES [dbo].[MfgMaterialRequirement] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialConsumption_ExecutionId] FOREIGN KEY ([ExecutionId]) REFERENCES [dbo].[MfgOperationExecution] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgMaterialConsumption_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [dbo].[MfgMaterial] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgMatConsumption_Qty] CHECK (Quantity > 0),
  CONSTRAINT [CK_MfgMatConsumption_Cost] CHECK (UnitCost >= 0),
  CONSTRAINT [CK_MfgMatConsumption_Method] CHECK (ConsumptionMethod IN ('manual','backflush','issue'))
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgMatConsumption_Idem' AND object_id = OBJECT_ID(N'dbo.MfgMaterialConsumption'))
  CREATE UNIQUE INDEX [UX_MfgMatConsumption_Idem] ON [dbo].[MfgMaterialConsumption] ([IdempotencyKey]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgMatConsumption_Operation' AND object_id = OBJECT_ID(N'dbo.MfgMaterialConsumption'))
  CREATE INDEX [IX_MfgMatConsumption_Operation] ON [dbo].[MfgMaterialConsumption] ([PlantId], [ProductionOrderOperationId], [ConsumedAt]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgMatConsumption_Material' AND object_id = OBJECT_ID(N'dbo.MfgMaterialConsumption'))
  CREATE INDEX [IX_MfgMatConsumption_Material] ON [dbo].[MfgMaterialConsumption] ([PlantId], [MaterialId], [ConsumedAt]);
GO

-- MfgInventoryLevel · سطح موجودی مواد
IF OBJECT_ID('dbo.MfgInventoryLevel', 'U') IS NULL
CREATE TABLE [dbo].[MfgInventoryLevel] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [MaterialId] NVARCHAR(60) NOT NULL,
  [WarehouseCode] NVARCHAR(40) NOT NULL,
  [LocationCode] NVARCHAR(40) NOT NULL DEFAULT '',
  [LotNo] NVARCHAR(60) NOT NULL DEFAULT '',
  [InventoryKey] NVARCHAR(240) NOT NULL,
  [OnHandQty] DECIMAL(18,4) NOT NULL,
  [ReservedQty] DECIMAL(18,4) NOT NULL,
  [BlockedQty] DECIMAL(18,4) NOT NULL,
  [InTransitQty] DECIMAL(18,4) NOT NULL,
  [SafetyStockQty] DECIMAL(18,4) NOT NULL,
  [AsOfAt] DATETIME2 NOT NULL,
  [LastCountedAt] DATETIME2 NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgInventoryLevel] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgInventoryLevel_MaterialId] FOREIGN KEY ([MaterialId]) REFERENCES [dbo].[MfgMaterial] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgInventory_Qty] CHECK (OnHandQty >= 0 AND ReservedQty >= 0 AND BlockedQty >= 0 AND InTransitQty >= 0 AND SafetyStockQty >= 0 AND ReservedQty + BlockedQty <= OnHandQty)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgInventory_Key' AND object_id = OBJECT_ID(N'dbo.MfgInventoryLevel'))
  CREATE UNIQUE INDEX [UX_MfgInventory_Key] ON [dbo].[MfgInventoryLevel] ([PlantId], [InventoryKey]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgInventory_Material' AND object_id = OBJECT_ID(N'dbo.MfgInventoryLevel'))
  CREATE INDEX [IX_MfgInventory_Material] ON [dbo].[MfgInventoryLevel] ([PlantId], [MaterialId], [WarehouseCode]);
GO

-- MfgOperationCost · هزینهٔ عملیات
IF OBJECT_ID('dbo.MfgOperationCost', 'U') IS NULL
CREATE TABLE [dbo].[MfgOperationCost] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NOT NULL,
  [CostCenterId] NVARCHAR(60) NULL,
  [CostElement] NVARCHAR(16) NOT NULL,
  [CostVersion] INT NOT NULL,
  [StandardQuantity] DECIMAL(18,4) NOT NULL,
  [ActualQuantity] DECIMAL(18,4) NOT NULL,
  [StandardRate] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [ActualRate] DECIMAL(18,4) NOT NULL DEFAULT 0,
  [StandardAmount] DECIMAL(18,2) NOT NULL,
  [ActualAmount] DECIMAL(18,2) NOT NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [CalculatedAt] DATETIME2 NOT NULL,
  [SourceRef] NVARCHAR(100) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgOperationCost] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgOperationCost_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgOperationCost_CostCenterId] FOREIGN KEY ([CostCenterId]) REFERENCES [dbo].[MfgCostCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgOperationCost_Element] CHECK (CostElement IN ('material','machine','labor','overhead')),
  CONSTRAINT [CK_MfgOperationCost_Version] CHECK (CostVersion > 0),
  CONSTRAINT [CK_MfgOperationCost_Amounts] CHECK (StandardQuantity >= 0 AND ActualQuantity >= 0 AND StandardRate >= 0 AND ActualRate >= 0 AND StandardAmount >= 0 AND ActualAmount >= 0)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgOperationCost_Element' AND object_id = OBJECT_ID(N'dbo.MfgOperationCost'))
  CREATE UNIQUE INDEX [UX_MfgOperationCost_Element] ON [dbo].[MfgOperationCost] ([ProductionOrderOperationId], [CostElement], [CostVersion]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgOperationCost_Center' AND object_id = OBJECT_ID(N'dbo.MfgOperationCost'))
  CREATE INDEX [IX_MfgOperationCost_Center] ON [dbo].[MfgOperationCost] ([PlantId], [CostCenterId], [CalculatedAt]);
GO

-- MfgOrderCost · هزینهٔ تجمیعی سفارش
IF OBJECT_ID('dbo.MfgOrderCost', 'U') IS NULL
CREATE TABLE [dbo].[MfgOrderCost] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ProductionOrderId] NVARCHAR(60) NOT NULL,
  [CostVersion] INT NOT NULL,
  [Currency] NVARCHAR(8) NOT NULL DEFAULT 'IRR',
  [StandardMaterialCost] DECIMAL(18,2) NOT NULL,
  [ActualMaterialCost] DECIMAL(18,2) NOT NULL,
  [StandardMachineCost] DECIMAL(18,2) NOT NULL,
  [ActualMachineCost] DECIMAL(18,2) NOT NULL,
  [StandardLaborCost] DECIMAL(18,2) NOT NULL,
  [ActualLaborCost] DECIMAL(18,2) NOT NULL,
  [StandardOverheadCost] DECIMAL(18,2) NOT NULL,
  [ActualOverheadCost] DECIMAL(18,2) NOT NULL,
  [StandardTotalCost] DECIMAL(18,2) NOT NULL,
  [ActualTotalCost] DECIMAL(18,2) NOT NULL,
  [ContractRevenue] DECIMAL(18,2) NULL,
  [GrossMargin] DECIMAL(18,2) NULL,
  [Reconciled] BIT NOT NULL DEFAULT 0,
  [ReconciledAt] DATETIME2 NULL,
  [ModelVersion] NVARCHAR(40) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgOrderCost] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgOrderCost_ProductionOrderId] FOREIGN KEY ([ProductionOrderId]) REFERENCES [dbo].[MfgProductionOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgOrderCost_Version] CHECK (CostVersion > 0),
  CONSTRAINT [CK_MfgOrderCost_Amounts] CHECK (StandardMaterialCost >= 0 AND ActualMaterialCost >= 0 AND StandardMachineCost >= 0 AND ActualMachineCost >= 0 AND StandardLaborCost >= 0 AND ActualLaborCost >= 0 AND StandardOverheadCost >= 0 AND ActualOverheadCost >= 0 AND StandardTotalCost >= 0 AND ActualTotalCost >= 0),
  CONSTRAINT [CK_MfgOrderCost_Reconciled] CHECK (Reconciled = 0 OR ReconciledAt IS NOT NULL)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgOrderCost_Version' AND object_id = OBJECT_ID(N'dbo.MfgOrderCost'))
  CREATE UNIQUE INDEX [UX_MfgOrderCost_Version] ON [dbo].[MfgOrderCost] ([ProductionOrderId], [CostVersion]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgOrderCost_Reconcile' AND object_id = OBJECT_ID(N'dbo.MfgOrderCost'))
  CREATE INDEX [IX_MfgOrderCost_Reconcile] ON [dbo].[MfgOrderCost] ([PlantId], [Reconciled], [ReconciledAt]);
GO

-- MfgProductionAlert · هشدار تولید
IF OBJECT_ID('dbo.MfgProductionAlert', 'U') IS NULL
CREATE TABLE [dbo].[MfgProductionAlert] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [AlertKey] NVARCHAR(60) NOT NULL,
  [AlertCode] NVARCHAR(60) NOT NULL,
  [Severity] NVARCHAR(12) NOT NULL,
  [Status] NVARCHAR(24) NOT NULL DEFAULT 'open',
  [ProductionOrderId] NVARCHAR(60) NULL,
  [ProductionOrderOperationId] NVARCHAR(60) NULL,
  [WorkCenterId] NVARCHAR(60) NULL,
  [TitleFa] NVARCHAR(240) NOT NULL,
  [DetailFa] NVARCHAR(1200) NULL,
  [FirstRaisedAt] DATETIME2 NOT NULL,
  [LastRaisedAt] DATETIME2 NOT NULL,
  [AcknowledgedAt] DATETIME2 NULL,
  [AcknowledgedBy] NVARCHAR(60) NULL,
  [ResolvedAt] DATETIME2 NULL,
  [ResolvedBy] NVARCHAR(60) NULL,
  [OccurrenceCount] INT NOT NULL DEFAULT 1,
  [ThresholdValue] DECIMAL(18,4) NULL,
  [ActualValue] DECIMAL(18,4) NULL,
  [SourceEventKey] NVARCHAR(160) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgProductionAlert] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgProductionAlert_ProductionOrderId] FOREIGN KEY ([ProductionOrderId]) REFERENCES [dbo].[MfgProductionOrder] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionAlert_ProductionOrderOperationId] FOREIGN KEY ([ProductionOrderOperationId]) REFERENCES [dbo].[MfgProductionOrderOperation] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [FK_MfgProductionAlert_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgAlert_Severity] CHECK (Severity IN ('critical','high','medium','low')),
  CONSTRAINT [CK_MfgAlert_Status] CHECK (Status IN ('open','acknowledged','resolved','suppressed')),
  CONSTRAINT [CK_MfgAlert_Count] CHECK (OccurrenceCount > 0),
  CONSTRAINT [CK_MfgAlert_Resolved] CHECK (Status <> 'resolved' OR ResolvedAt IS NOT NULL)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgAlert_Dedup' AND object_id = OBJECT_ID(N'dbo.MfgProductionAlert'))
  CREATE UNIQUE INDEX [UX_MfgAlert_Dedup] ON [dbo].[MfgProductionAlert] ([PlantId], [AlertKey]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgAlert_Open' AND object_id = OBJECT_ID(N'dbo.MfgProductionAlert'))
  CREATE INDEX [IX_MfgAlert_Open] ON [dbo].[MfgProductionAlert] ([PlantId], [Status], [Severity], [LastRaisedAt]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgAlert_Order' AND object_id = OBJECT_ID(N'dbo.MfgProductionAlert'))
  CREATE INDEX [IX_MfgAlert_Order] ON [dbo].[MfgProductionAlert] ([ProductionOrderId], [Status]);
GO

-- MfgDispatchingRule · قاعدهٔ اعزام عملیات
IF OBJECT_ID('dbo.MfgDispatchingRule', 'U') IS NULL
CREATE TABLE [dbo].[MfgDispatchingRule] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ScopeType] NVARCHAR(12) NOT NULL,
  [RuleScopeKey] NVARCHAR(100) NOT NULL,
  [WorkCenterId] NVARCHAR(60) NULL,
  [RuleCode] NVARCHAR(12) NOT NULL,
  [PriorityOrder] INT NOT NULL DEFAULT 1,
  [PriorityWeight] DECIMAL(12,4) NOT NULL DEFAULT 1,
  [IsActive] BIT NOT NULL DEFAULT 1,
  [EffectiveFrom] DATE NOT NULL,
  [EffectiveTo] DATE NULL,
  [ParametersJson] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgDispatchingRule] PRIMARY KEY ([Id]),
  CONSTRAINT [FK_MfgDispatchingRule_WorkCenterId] FOREIGN KEY ([WorkCenterId]) REFERENCES [dbo].[MfgWorkCenter] ([Id]) ON DELETE NO ACTION,
  CONSTRAINT [CK_MfgDispatchRule_Scope] CHECK (ScopeType IN ('plant','work-center')),
  CONSTRAINT [CK_MfgDispatchRule_Rule] CHECK (RuleCode IN ('EDD','SPT','CR','WSPT','FIFO','MANUAL')),
  CONSTRAINT [CK_MfgDispatchRule_Order] CHECK (PriorityOrder > 0 AND PriorityWeight > 0),
  CONSTRAINT [CK_MfgDispatchRule_ScopeLink] CHECK ((ScopeType = 'plant' AND WorkCenterId IS NULL) OR (ScopeType = 'work-center' AND WorkCenterId IS NOT NULL)),
  CONSTRAINT [CK_MfgDispatchRule_Dates] CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgDispatchRule_Scope' AND object_id = OBJECT_ID(N'dbo.MfgDispatchingRule'))
  CREATE UNIQUE INDEX [UX_MfgDispatchRule_Scope] ON [dbo].[MfgDispatchingRule] ([PlantId], [RuleScopeKey], [PriorityOrder], [EffectiveFrom]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgDispatchRule_Active' AND object_id = OBJECT_ID(N'dbo.MfgDispatchingRule'))
  CREATE INDEX [IX_MfgDispatchRule_Active] ON [dbo].[MfgDispatchingRule] ([PlantId], [IsActive], [ScopeType], [RuleCode]);
GO

-- MfgScheduleRun · اجرای زمان‌بندی
IF OBJECT_ID('dbo.MfgScheduleRun', 'U') IS NULL
CREATE TABLE [dbo].[MfgScheduleRun] (
  [Id] NVARCHAR(60) NOT NULL,
  [PlantId] NVARCHAR(60) NOT NULL,
  [ScheduleVersion] INT NOT NULL,
  [Direction] NVARCHAR(12) NOT NULL,
  [CapacityMode] NVARCHAR(16) NOT NULL,
  [DispatchRule] NVARCHAR(12) NOT NULL,
  [WindowStart] DATETIME2 NOT NULL,
  [WindowEnd] DATETIME2 NOT NULL,
  [ExpectedScheduleVersion] INT NULL,
  [ScheduledOperationCount] INT NOT NULL DEFAULT 0,
  [UnscheduledOperationCount] INT NOT NULL DEFAULT 0,
  [CalculatedAt] DATETIME2 NOT NULL,
  [ModelVersion] NVARCHAR(40) NOT NULL DEFAULT 'mfg-scheduler-v1',
  [SummaryJson] NVARCHAR(MAX) NULL,
  [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  [CreatedBy] NVARCHAR(60) NULL,
  [UpdatedAt] DATETIME2 NULL,
  [UpdatedBy] NVARCHAR(60) NULL,
  [RowVersion] INT NOT NULL DEFAULT 1,
  CONSTRAINT [PK_MfgScheduleRun] PRIMARY KEY ([Id]),
  CONSTRAINT [CK_MfgScheduleRun_Version] CHECK (ScheduleVersion > 0 AND (ExpectedScheduleVersion IS NULL OR ExpectedScheduleVersion >= 0)),
  CONSTRAINT [CK_MfgScheduleRun_Window] CHECK (WindowEnd > WindowStart),
  CONSTRAINT [CK_MfgScheduleRun_Mode] CHECK (CapacityMode IN ('finite','semi-finite')),
  CONSTRAINT [CK_MfgScheduleRun_Direction] CHECK (Direction IN ('forward','backward')),
  CONSTRAINT [CK_MfgScheduleRun_Rule] CHECK (DispatchRule IN ('EDD','SPT','CR','WSPT','FIFO','MANUAL')),
  CONSTRAINT [CK_MfgScheduleRun_Counts] CHECK (ScheduledOperationCount >= 0 AND UnscheduledOperationCount >= 0)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_MfgScheduleRun_Version' AND object_id = OBJECT_ID(N'dbo.MfgScheduleRun'))
  CREATE UNIQUE INDEX [UX_MfgScheduleRun_Version] ON [dbo].[MfgScheduleRun] ([PlantId], [ScheduleVersion]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MfgScheduleRun_Created' AND object_id = OBJECT_ID(N'dbo.MfgScheduleRun'))
  CREATE INDEX [IX_MfgScheduleRun_Created] ON [dbo].[MfgScheduleRun] ([PlantId], [CreatedAt]);
GO
