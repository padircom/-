-- PIM/EDMS V004 — types, files, documents, revisions
CREATE TABLE IF NOT EXISTS document_type (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     varchar(16) NOT NULL,
  name_fa                  varchar(256) NOT NULL,
  name_en                  varchar(256) NOT NULL,
  pmbok_area               pim_pmbok_area NOT NULL,
  confidentiality_default  pim_confidentiality NOT NULL DEFAULT 'Internal',
  number_rule_id           uuid,
  extra                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_document_type_code UNIQUE (code)
);
COMMENT ON TABLE document_type IS 'انواع سند شامل حداقل ۳۳ سند PMBOK';

CREATE TABLE IF NOT EXISTS file_object (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path       text NOT NULL,
  mime               varchar(128) NOT NULL,
  bytes              bigint NOT NULL CHECK (bytes >= 0),
  checksum_sha256    char(64) NOT NULL,
  virus_scan_status  pim_file_virus NOT NULL DEFAULT 'Pending',
  original_name      varchar(512) NOT NULL,
  uploaded_by        uuid,
  uploaded_at        timestamptz NOT NULL DEFAULT now(),
  meta               jsonb NOT NULL DEFAULT '{}'::jsonb
);
COMMENT ON TABLE  file_object IS 'فایل Evidence — خارج از جداول مدرک';
COMMENT ON COLUMN file_object.checksum_sha256 IS 'SHA-256 فایل اصلی';

CREATE TABLE IF NOT EXISTS document (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES project(id),
  type_id           uuid NOT NULL REFERENCES document_type(id),
  doc_number        varchar(64) NOT NULL,
  title_fa          varchar(512) NOT NULL,
  title_en          varchar(512) NOT NULL,
  discipline        varchar(32) NOT NULL,
  confidentiality   pim_confidentiality NOT NULL DEFAULT 'Internal',
  status            pim_doc_status NOT NULL DEFAULT 'Draft',
  current_rev_id    uuid,
  baseline_id       uuid,
  wbs_id            varchar(64),
  is_offline_pending boolean NOT NULL DEFAULT false,
  search            tsvector,
  attrs             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_document_project_number UNIQUE (project_id, doc_number)
);
COMMENT ON TABLE  document IS 'مستر مدرک — منبع حقیقت';
COMMENT ON COLUMN document.doc_number IS 'شماره یکتا در پروژه';
COMMENT ON COLUMN document.attrs IS 'فیلدهای اضافی فرم JSONB';
COMMENT ON COLUMN document.search IS 'بردار Full-Text عنوان و ویژگی';

CREATE TABLE IF NOT EXISTS document_revision (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  rev_code         varchar(16) NOT NULL,
  state            pim_doc_status NOT NULL DEFAULT 'Draft',
  issued_at        timestamptz,
  checksum_sha256  char(64),
  file_id          uuid REFERENCES file_object(id),
  change_note      text,
  review_code      pim_review_code,
  supersedes_rev_id uuid REFERENCES document_revision(id),
  meta             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_revision_doc_rev UNIQUE (document_id, rev_code)
);
COMMENT ON TABLE document_revision IS 'نسخه مدرک — فایل اصلی Evidence';

ALTER TABLE document
  DROP CONSTRAINT IF EXISTS fk_document_current_rev;
ALTER TABLE document
  ADD CONSTRAINT fk_document_current_rev
  FOREIGN KEY (current_rev_id) REFERENCES document_revision(id) DEFERRABLE INITIALLY DEFERRED;
