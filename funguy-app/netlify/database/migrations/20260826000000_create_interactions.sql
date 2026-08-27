CREATE TABLE interactions (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  session_id  TEXT
);

CREATE INDEX interactions_created_at_idx ON interactions (created_at DESC);
