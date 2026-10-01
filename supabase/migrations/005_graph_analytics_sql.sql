CREATE OR REPLACE FUNCTION compute_graph_centrality(
    p_user_id uuid,
    p_damping_factor float8 DEFAULT 0.85,
    p_max_iterations integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    page_rank float8,
    normalized_score float8,
    degree_centrality integer,
    is_bridge boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_nodes integer;
    v_base_val float8;
    v_iter integer;
    v_min_pr float8;
    v_max_pr float8;
    v_dangling_sum float8;
BEGIN
    -- 1. Create a temporary table to hold graph metrics
    CREATE TEMP TABLE IF NOT EXISTS tmp_centrality (
        node_id uuid PRIMARY KEY,
        pr float8,
        next_pr float8,
        out_degree integer,
        deg_centrality integer,
        bridge boolean
    ) ON COMMIT DROP;
    
    -- Clear in case it already exists in the same session
    TRUNCATE tmp_centrality;
    
    -- Initialize nodes
    INSERT INTO tmp_centrality (node_id, pr, next_pr, out_degree, deg_centrality, bridge)
    SELECT 
        e.id, 
        0, 
        0, 
        0, 
        0, 
        false
    FROM entities e
    WHERE e.user_id = p_user_id AND e.deleted_at IS NULL;
    
    SELECT count(*) INTO v_total_nodes FROM tmp_centrality;
    IF v_total_nodes = 0 THEN
        RETURN;
    END IF;
    
    -- Set initial PR
    UPDATE tmp_centrality SET pr = 1.0 / v_total_nodes;
    
    -- Calculate degrees and types
    -- Out-degree
    WITH out_deg AS (
        SELECT src, count(*) as c
        FROM edges
        WHERE user_id = p_user_id AND deleted_at IS NULL
        GROUP BY src
    )
    UPDATE tmp_centrality t SET out_degree = d.c
    FROM out_deg d WHERE t.node_id = d.src;
    
    -- Degree centrality (in + out)
    WITH all_edges AS (
        SELECT src as node FROM edges WHERE user_id = p_user_id AND deleted_at IS NULL
        UNION ALL
        SELECT dst as node FROM edges WHERE user_id = p_user_id AND deleted_at IS NULL
    ),
    tot_deg AS (
        SELECT node, count(*) as c FROM all_edges GROUP BY node
    )
    UPDATE tmp_centrality t SET deg_centrality = d.c
    FROM tot_deg d WHERE t.node_id = d.node;
    
    -- Bridge nodes (>= 3 distinct neighbor types)
    WITH neighbor_types AS (
        SELECT e.src as node, ent.type
        FROM edges e
        JOIN entities ent ON e.dst = ent.id
        WHERE e.user_id = p_user_id AND e.deleted_at IS NULL
        UNION
        SELECT e.dst as node, ent.type
        FROM edges e
        JOIN entities ent ON e.src = ent.id
        WHERE e.user_id = p_user_id AND e.deleted_at IS NULL
    ),
    type_counts AS (
        SELECT node, count(DISTINCT type) as type_count
        FROM neighbor_types
        GROUP BY node
    )
    UPDATE tmp_centrality t SET bridge = true
    FROM type_counts c WHERE t.node_id = c.node AND c.type_count >= 3;
    
    -- PageRank Iterations
    FOR v_iter IN 1..p_max_iterations LOOP
        -- Compute dangling sum (nodes with out_degree = 0 or null)
        SELECT COALESCE(sum(pr), 0) INTO v_dangling_sum 
        FROM tmp_centrality WHERE out_degree = 0 OR out_degree IS NULL;
        
        v_base_val := (1.0 - p_damping_factor) / v_total_nodes + (p_damping_factor * v_dangling_sum) / v_total_nodes;
        
        -- Calculate incoming PR sums
        WITH incoming AS (
            SELECT e.dst as node, sum(t.pr / NULLIF(t.out_degree, 0)) as pr_sum
            FROM edges e
            JOIN tmp_centrality t ON e.src = t.node_id
            WHERE e.user_id = p_user_id AND e.deleted_at IS NULL
            GROUP BY e.dst
        )
        UPDATE tmp_centrality t
        SET next_pr = v_base_val + p_damping_factor * COALESCE(i.pr_sum, 0)
        FROM incoming i
        WHERE t.node_id = i.node;
        
        -- Set next_pr for nodes with no incoming edges
        UPDATE tmp_centrality t
        SET next_pr = v_base_val
        WHERE NOT EXISTS (
            SELECT 1 FROM edges e WHERE e.dst = t.node_id AND e.user_id = p_user_id AND e.deleted_at IS NULL
        );
        
        UPDATE tmp_centrality SET pr = next_pr;
    END LOOP;
    
    -- Normalization
    SELECT min(pr), max(pr) INTO v_min_pr, v_max_pr FROM tmp_centrality;
    IF v_max_pr = v_min_pr OR v_max_pr IS NULL THEN
        v_max_pr := COALESCE(v_min_pr, 0) + 1;
    END IF;
    
    RETURN QUERY
    SELECT 
        node_id,
        pr,
        1.5 + ((pr - v_min_pr) / (v_max_pr - v_min_pr)) * 7.5 AS normalized_score,
        deg_centrality,
        bridge
    FROM tmp_centrality;
END;
$$;
