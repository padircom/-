-- PIM/EDMS V003 — Portfolio / Program / Project
CREATE TABLE IF NOT EXISTS portfolio (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          varchar(32)  NOT NULL,
  name_fa       varchar(256) NOT NULL,
  name_en       varchar(256) NOT NULL,
  status        pim_org_status NOT NULL DEFAULT 'active',
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_portfolio_code UNIQUE (code)
);
COMMENT ON TABLE  portfolio IS 'پورتفولیو سازمانی';
COMMENT ON COLUMN portfolio.code IS 'کد یکتای پورتفولیو';
COMMENT ON COLUMN portfolio.meta IS 'ویژگی‌های آزاد JSONB';

CREATE TABLE IF NOT EXISTS program (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id  uuid NOT NULL REFERENCES portfolio(id),
  code          varchar(32)  NOT NULL,
  name_fa       varchar(256) NOT NULL,
  name_en       varchar(256) NOT NULL,
  status        pim_org_status NOT NULL DEFAULT 'active',
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_program_code UNIQUE (code)
);
COMMENT ON TABLE program IS 'برنامه (Program) زیر پورتفولیو';

CREATE TABLE IF NOT EXISTS project (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid REFERENCES program(id),
  portfolio_id  uuid REFERENCES portfolio(id),
  parent_id     uuid REFERENCES project(id),
  code          varchar(32)  NOT NULL,
  name_fa       varchar(256) NOT NULL,
  name_en       varchar(256) NOT NULL,
  client_fa     varchar(256),
  client_en     varchar(256),
  location_fa   varchar(256),
  location_en   varchar(256),
  status        pim_org_status NOT NULL DEFAULT 'active',
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_code UNIQUE (code),
  CONSTRAINT ck_project_parent CHECK (parent_id IS DISTINCT FROM id)
);
COMMENT ON TABLE  project IS 'پروژه — ریشه اسناد PIM';
COMMENT ON COLUMN project.code IS 'مثال: OG-2401';
