-- PIM/EDMS V005 — numbering engine (race-safe sequence)
CREATE TABLE IF NOT EXISTS number_rule (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES project(id),
  type_id     uuid REFERENCES document_type(id),
  name        varchar(128) NOT NULL,
  pattern     varchar(128) NOT NULL,
  scope       pim_number_scope NOT NULL DEFAULT 'Type',
  pad         smallint NOT NULL DEFAULT 3 CHECK (pad BETWEEN 1 AND 8),
  is_active   boolean NOT NULL DEFAULT true,
  extra       jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ck_number_pattern CHECK (pattern LIKE '%{%')
);
COMMENT ON TABLE  number_rule IS 'قانون شماره‌گذاری توکن‌محور';
COMMENT ON COLUMN number_rule.pattern IS 'مثال: {PROJ}-{DISC}-{TYPE}-{SEQ:3}';

ALTER TABLE document_type
  DROP CONSTRAINT IF EXISTS fk_document_type_rule;
ALTER TABLE document_type
  ADD CONSTRAINT fk_document_type_rule
  FOREIGN KEY (number_rule_id) REFERENCES number_rule(id);

CREATE TABLE IF NOT EXISTS number_sequence (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     uuid NOT NULL REFERENCES number_rule(id),
  scope_key   varchar(128) NOT NULL,
  next_value  integer NOT NULL DEFAULT 1 CHECK (next_value >= 1),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_number_sequence UNIQUE (rule_id, scope_key)
);
COMMENT ON TABLE number_sequence IS 'شمارنده — UPDATE باید با قفل ردیف انجام شود';

CREATE TABLE IF NOT EXISTS number_reservation (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id                  uuid NOT NULL REFERENCES number_rule(id),
  project_id               uuid NOT NULL REFERENCES project(id),
  number                   varchar(64) NOT NULL,
  validity                 tstzrange NOT NULL DEFAULT tstzrange(now(), now() + interval '48 hours', '[)'),
  consumed_by_document_id  uuid REFERENCES document(id),
  created_by               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reservation_number UNIQUE (project_id, number),
  CONSTRAINT ck_reservation_consume CHECK (
    consumed_by_document_id IS NULL OR upper(validity) IS NOT NULL
  )
);
COMMENT ON TABLE number_reservation IS 'رزرو شماره؛ SEQ پس از انقضا عقب نمی‌رود';
COMMENT ON COLUMN number_reservation.validity IS 'بازه اعتبار رزرو برای GiST Exclusion اختیاری';
