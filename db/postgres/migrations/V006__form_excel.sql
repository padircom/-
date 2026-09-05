-- PIM/EDMS V006 — form engine + excel interop (Excel is a vessel)
CREATE TABLE IF NOT EXISTS form_template (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        varchar(64) NOT NULL UNIQUE,
  name_fa     varchar(256) NOT NULL,
  name_en     varchar(256) NOT NULL,
  version     integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  schema      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE form_template IS 'قالب فرم وب متناظر با ستون‌های Excel';

CREATE TABLE IF NOT EXISTS form_field (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    uuid NOT NULL REFERENCES form_template(id) ON DELETE CASCADE,
  name           varchar(64) NOT NULL,
  data_type      varchar(32) NOT NULL,
  required       boolean NOT NULL DEFAULT false,
  validation     jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order     integer NOT NULL DEFAULT 0,
  CONSTRAINT uq_form_field UNIQUE (template_id, name)
);
COMMENT ON COLUMN form_field.validation IS 'قواعد سلول‌محور JSONB';

CREATE TABLE IF NOT EXISTS form_instance (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES form_template(id),
  document_id  uuid REFERENCES document(id),
  project_id   uuid NOT NULL REFERENCES project(id),
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_value (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid NOT NULL REFERENCES form_instance(id) ON DELETE CASCADE,
  field_id     uuid NOT NULL REFERENCES form_field(id),
  value        jsonb,
  CONSTRAINT uq_field_value UNIQUE (instance_id, field_id)
);
COMMENT ON COLUMN field_value.value IS 'مقدار فیلد JSONB';

CREATE TABLE IF NOT EXISTS excel_template (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id uuid REFERENCES form_template(id),
  file_id          uuid REFERENCES file_object(id),
  version          integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  mapping_schema   jsonb NOT NULL,
  partial_allowed  boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_excel_template_ver UNIQUE (form_template_id, version)
);
COMMENT ON TABLE  excel_template IS 'قالب Excel — ظرف بازتولید نه منبع حقیقت';
COMMENT ON COLUMN excel_template.mapping_schema IS 'MappingSchema شامل ستون‌ها و _META';

CREATE TABLE IF NOT EXISTS excel_column_map (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES excel_template(id) ON DELETE CASCADE,
  sheet         varchar(64) NOT NULL DEFAULT 'MDR',
  cell_or_header varchar(64) NOT NULL,
  field_id      uuid REFERENCES form_field(id),
  field_path    varchar(128),
  transform     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS import_batch (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   uuid NOT NULL REFERENCES excel_template(id),
  file_id       uuid NOT NULL REFERENCES file_object(id),
  project_id    uuid NOT NULL REFERENCES project(id),
  status        pim_batch_status NOT NULL DEFAULT 'Validated',
  row_count     integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  error_count   integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE import_batch IS 'دسته ورود Excel';

CREATE TABLE IF NOT EXISTS import_error (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    uuid NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
  row_no      integer NOT NULL CHECK (row_no >= 1),
  col_key     varchar(64) NOT NULL,
  code        varchar(32) NOT NULL,
  message_fa  text NOT NULL,
  message_en  text NOT NULL,
  cell_raw    jsonb
);
COMMENT ON TABLE import_error IS 'خطای سلول‌محور ورود';
