# Architectural Decisions & Technical Assumptions — Virtual Brain

This document records all architectural choices, API research discoveries, and design assumptions made during the design and implementation of the Virtual Brain personal memory graph system.

---

## 1. LLM Provider Adapter (`lib/llm.ts`)

### Command Code API Research Findings
- **Endpoint**: `POST https://api.commandcode.ai/alpha/generate`
- **Authentication**: `Authorization: Bearer <API_KEY>` (key format `user_...`)
- **Protocol**: Exclusively streaming over HTTP using `Accept: text/event-stream` with newline-delimited JSON (NDJSON) event lines (`text-delta`, `tool-call`, `tool-input-delta`, `finish-step`, `finish`, `error`).
- **Required Envelope**: Unlike OpenAI's `/v1/chat/completions`, Command Code requires an outer envelope wrapping `config`, `params`, `mode: "agent"`, `permissionMode: "standard"`, and a generated `threadId`.
- **System Prompt Rules**:
  - `role: "system"` is strictly rejected in `params.messages` (returns HTTP 400).
  - System prompts must be supplied in `params.system: [{ type: "text", text: "..." }]`.
  - If omitted, Command Code auto-injects ~7,500 tokens of CLI instructions; we pass `[{ type: "text", text: " " }]` when no system prompt is desired to suppress this.
- **Model Identifiers**:
  - `deepseek/deepseek-v4-flash` (aliases: `deepseek-v4-flash`, `deepseek-flash`)
  - `deepseek/deepseek-v4-pro` (aliases: `deepseek-v4-pro`, `deepseek-v4`, `deepseek-pro`)
- **Terms of Service (ToS) Consideration**:
  - Command Code API keys are officially intended for their terminal CLI. Using them directly from a hosted Next.js web application could violate terms or encounter rate/origin limits if their gateway enforces strict User-Agent or IP filtering in the future. We provide a full OpenAI-compatible adapter as a drop-in alternative.

### Direct DeepSeek API (`api.deepseek.com`)
- **Base URL**: `https://api.deepseek.com/v1`
- **Primary Model**: `deepseek-flash` (official identifier for DeepSeek-V4.1-Flash; legacy aliases `deepseek-v4-flash` route to it).
- **Tool Calling**: Standard OpenAI tool calling format with function declarations.
- **Strict JSON Mode**: Enabled via `response_format: { type: "json_object" }`. The system/user prompt **must contain the string "json"** explicitly to prevent the model from emitting infinite whitespace (an official DeepSeek API quirk).

### Tool Calling & Fallbacks
- Both native OpenAI tool calling and Command Code NDJSON tool stream parsing are implemented.
- If tool calling fails or is unsupported by an upstream model, a JSON prompt-based protocol (`{"tool": "...", "args": {...}}`) is executed and fed back into the conversation context.

---

## 2. Graph Storage & Layout Physics

- **Database**: Plain Postgres tables on Supabase Free Tier (`entries`, `entities`, `edges`, `facts`, `entry_entities`, `graph_layout`). No graph database or paid add-on is used.
- **Layout Math (`src/lib/graph/layout.ts`)**: `d3-force` is used strictly as a headless math engine to compute (x, y) coordinates upon node ingestion or relaxation. It is never used for DOM/SVG rendering.
- **Incremental Placement**: New entities are placed near their most-connected neighbor in `graph_layout` (or within the organic brain boundary if isolated) followed by 5–10 local simulation iterations with immediate neighbors. Full-graph re-layouts are avoided to ensure visual stability between sessions.

---

## 3. Explore Screen (Canvas 2D Rendering)

- **Single Full-Bleed Canvas**: All ambient particles (3,000 points) and entity nodes are drawn onto an HTML5 2D context at `devicePixelRatio` resolution.
- **Camera Cover-Fit (Preventing Black Bands)**:
  - Naive implementations use `contain-fit` (`scale = Math.min(...)`), which leaves empty black bands on tall phone viewports.
  - We strictly use cover-fit: `scale = Math.max(viewportWidth / worldWidth, viewportHeight / worldHeight) * 1.3`.
- **Viewport Drift Prevention**:
  - Mobile Safari address bar expansion/collapse changes `window.visualViewport.height` without triggering a standard window resize event.
  - The camera listens to `window.visualViewport.addEventListener('resize', ...)` and recomputes both canvas buffer dimensions and camera scale/centering simultaneously.
- **HUD Safe Areas**:
  - The HUD is a single unified floating card.
  - Safe-area insets (`env(safe-area-inset-top)`, etc.) are applied directly to the HUD element's padding rather than `:root`, preventing overlapping stats on notched mobile screens.

---

## 4. Hard Exclusion Recommendation Flow (`src/lib/recommendation.ts`)

- For recommendation queries ("suggest a movie I haven't watched", "recommend a restaurant I haven't visited"):
  1. The full consumed entity set is fetched via SQL.
  2. The LLM suggests 15 candidate recommendations matching the user's recorded taste.
  3. Candidates are strictly filtered in application code against normalized titles, aliases, and fuzzy matches.
  4. Only verified unvisited items are returned, explicitly stating how many candidate items were dropped.

---

## 5. Security, Auth, & Portability

- **Single User System**: Supabase Auth (Magic Link or Google OAuth). The README guides disabling public sign-ups once the owner account is created.
- **Row Level Security (RLS)**: Enabled across all tables with `auth.uid() = user_id`.
- **Storage & Secrets**: Service role keys and LLM keys remain strictly in server-side environment variables.
- **Database Portability**: Supabase-specific queries are isolated inside `src/lib/db/*` and `src/lib/auth.ts`. The schema consists of standard SQL migrations (`001_init.sql`, `002_reviews.sql`).
- **Supabase Free Pause Prevention**: `/api/keepalive` runs via Vercel Cron daily to execute `SELECT 1`.
- **Automated Backups**: `/api/backup` runs weekly via Vercel Cron, dumping all tables to JSON and committing them to a private GitHub repository via GitHub REST API.
