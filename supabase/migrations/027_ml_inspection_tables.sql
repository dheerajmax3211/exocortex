-- Migration 027: ML Inspection and Grounding Tables
-- Additive tables for inspectable on-device NER, sentiment scores, and graph community detection.

CREATE TABLE IF NOT EXISTS entry_ner_spans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES entries(id) ON DELETE CASCADE,
  text text NOT NULL,
  type text NOT NULL,
  score double precision NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entry_ner_spans_entry_id ON entry_ner_spans(entry_id);

CREATE TABLE IF NOT EXISTS entry_sentiment_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES entries(id) ON DELETE CASCADE,
  clause text NOT NULL,
  label text NOT NULL,
  score double precision NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entry_sentiment_scores_entry_id ON entry_sentiment_scores(entry_id);

CREATE TABLE IF NOT EXISTS entity_communities (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  community_id int NOT NULL,
  modularity double precision NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_communities_community ON entity_communities(community_id);

-- Enable RLS
ALTER TABLE entry_ner_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_sentiment_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_communities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own entry ner spans" ON entry_ner_spans;
CREATE POLICY "Users can view own entry ner spans" ON entry_ner_spans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entries WHERE entries.id = entry_ner_spans.entry_id AND entries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own entry sentiment scores" ON entry_sentiment_scores;
CREATE POLICY "Users can view own entry sentiment scores" ON entry_sentiment_scores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entries WHERE entries.id = entry_sentiment_scores.entry_id AND entries.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own entity communities" ON entity_communities;
CREATE POLICY "Users can view own entity communities" ON entity_communities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entities WHERE entities.id = entity_communities.entity_id AND entities.user_id = auth.uid()
    )
  );
