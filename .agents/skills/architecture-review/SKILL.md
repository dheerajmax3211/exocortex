---
name: architecture-review
description: Comprehensive codebase architecture review, performance profiling, and product viability analysis for Virtual Brain. Use to audit Next.js 16, Supabase, GraphRAG, 3D WebGL, and LLM pipelines.
---

# Architecture Review Skill: Virtual Brain

This skill provides an automated, rigorous architectural and code quality audit protocol for the **Virtual Brain** project.

## Review Protocol

### 1. Static Code Health
Run Knip to detect dead code, unused exports, and unlisted dependencies:
```bash
npx knip
```

### 2. Type & Build Verification
Verify strict TypeScript compilation and production bundling:
```bash
npx tsc --noEmit
npm run build
```

### 3. Graph & AI Pipeline Audit
Check:
- `src/lib/llm.ts`: Timeout settings, streaming handlers, DSML sanitization.
- `src/lib/entity-resolution.ts`: Multi-stage blocking, fuzzy matching, and deduplication thresholds.
- `src/lib/graphrag.ts`: Sub-50ms hybrid vector and 1-hop topology retrieval.
- `src/lib/subconscious-engine.ts`: Multi-domain Life Vector calculations and tension detection.
- `src/lib/decision-simulator.ts`: Scenario simulation grounding and accuracy.

### 4. 3D WebGL Rendering Performance
Check:
- `src/components/explore/ExploreCanvas.tsx`: Geometry caching, warmup ticks, cooldown ticks, OrbitControls damping.
- Link curvature and particle counts for GPU memory optimization.

### 5. Security & Auth Guardrails
Verify:
- Every API route validates `supabase.auth.getUser()`.
- RLS policies exist on all tables.
- Service role key is only used in trusted server-side scripts, never leaked to the client bundle.
