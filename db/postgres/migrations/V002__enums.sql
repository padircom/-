-- PIM/EDMS V002 — enums aligned with Deliverable 2
DO $$ BEGIN
  CREATE TYPE pim_org_status AS ENUM ('active', 'tender', 'stopped', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_doc_status AS ENUM (
    'Draft', 'Reserved', 'Issued', 'C1', 'C2', 'C3', 'C4',
    'Approved', 'IFC', 'Superseded', 'Void', 'Archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_review_code AS ENUM ('C1', 'C2', 'C3', 'C4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_confidentiality AS ENUM ('Public', 'Internal', 'Restricted', 'Secret');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_pmbok_area AS ENUM (
    'Integration', 'Scope', 'Schedule', 'Cost', 'Quality',
    'Resource', 'Communications', 'Risk', 'Procurement', 'Stakeholder'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_file_virus AS ENUM ('Pending', 'Clean', 'Blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_batch_status AS ENUM ('Validated', 'Committed', 'Failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_task_status AS ENUM ('Open', 'Done', 'Cancelled', 'Escalated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_step_mode AS ENUM ('Sequential', 'Parallel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_raci AS ENUM ('R', 'A', 'C', 'I');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_join_mode AS ENUM ('All', 'Any');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_tr_status AS ENUM ('Draft', 'Sent', 'Ack', 'Overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pim_number_scope AS ENUM ('Project', 'Disc', 'Type');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
