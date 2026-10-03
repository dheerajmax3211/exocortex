-- UPGRADE 3: FRACTAL NODES (HYPERGRAPHS)
-- Allow entities and edges to belong inside a parent node's "macro-context"
ALTER TABLE entities ADD COLUMN IF NOT EXISTS parent_context_id UUID REFERENCES entities(id) ON DELETE CASCADE;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS parent_context_id UUID REFERENCES entities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_entities_parent_context ON entities(parent_context_id);
CREATE INDEX IF NOT EXISTS idx_edges_parent_context ON edges(parent_context_id);

-- UPGRADE 4: 4D EVENT SOURCING (TEMPORAL STATE LEDGER)
-- Non-destructive history of all property mutations over time
CREATE TABLE IF NOT EXISTS entity_state_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    props JSONB NOT NULL DEFAULT '{}'::jsonb,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to TIMESTAMPTZ, -- NULL means it is the current active state
    entry_id UUID REFERENCES entries(id) ON DELETE SET NULL, -- The memory entry that triggered this mutation
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_state_ledger_entity ON entity_state_ledger(entity_id);
CREATE INDEX IF NOT EXISTS idx_state_ledger_temporal ON entity_state_ledger(valid_from, valid_to);

-- Function to safely mutate state non-destructively
CREATE OR REPLACE FUNCTION mutate_entity_state(
    p_entity_id UUID,
    p_new_props JSONB,
    p_entry_id UUID DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_user_id UUID;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT user_id INTO v_user_id FROM entities WHERE id = p_entity_id;
    
    -- Cap the valid_to of the currently active state
    UPDATE entity_state_ledger 
    SET valid_to = v_now 
    WHERE entity_id = p_entity_id AND valid_to IS NULL;

    -- Insert the new active state
    INSERT INTO entity_state_ledger (user_id, entity_id, props, valid_from, valid_to, entry_id)
    VALUES (v_user_id, p_entity_id, p_new_props, v_now, NULL, p_entry_id);
    
    -- Update the fast-access props on the entity itself (for simple querying)
    UPDATE entities SET props = p_new_props WHERE id = p_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
