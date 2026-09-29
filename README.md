# 🧠 Virtual Brain — A Personal Memory Graph Web App

Virtual Brain is a single-user personal memory system: a "virtual you". You type free-form text about your life (daily events, school memories, restaurants, dishes, movies, people). An LLM extracts entities, relationships, facts, and dates into a structured knowledge graph stored in plain PostgreSQL. The graph renders as a dense, dark, living brain-shaped neural map directly on your home screen. Later, you can ask natural-language questions and receive precise, source-cited answers with zero hallucinations.

Hosted **100% free** on **Vercel Hobby** and **Supabase Free Tier**.

---

## 🌟 Key Features

1. **Flagship Explore Screen (The Graph IS the App)**
   - Dark, dense canvas with two layers: an organic ambient field (~3,000 dim particles inside a lobed brain silhouette) and bright glowing real entity nodes.
   - **Cover-fit camera**: Fills phone screens edge-to-edge without black letterbox bands.
   - **VisualViewport-aware**: Recomputes camera offsets whenever mobile browser toolbars collapse or expand.
   - Interactive zoom/pan (touch pinch + drag) and grounded fact cards on node tap or hover.
   - Floating Safe-Area HUD with live counts and Cmd+K search to jump to nodes.

2. **Ingestion Pipeline ("Add Memory" Omnibox)**
   - Floating Action Button (FAB) accessible on every screen.
   - Omnibox with Web Speech API dictation (`en-IN`) and textarea.
   - Trigram candidate entity retrieval + LLM extraction in one fast pass.
   - Interactive review sheet (colored entity chips, relationship tags, ambiguity picker).
   - Incremental layout update: Places new nodes near their most-connected neighbor using local `d3-force` relaxation.

3. **Grounded Retrieval & Ask Flow ("Virtual Me")**
   - Read-only tool-calling loop (entity search, neighborhood traversal, timelines, and FTS).
   - Direct citations linking to the exact entry date.
   - **Recommendations with Hard Exclusion**: Strict code-level filtering of candidate recommendations against your full recorded consumption history.

4. **Phase 2 & Phase 3 Capabilities**
   - **Import**: Bulk paste or CSV upload for movies, restaurants, books, with LLM deduplication.
   - **Timeline**: Chronological day-by-day feed with "On This Day" historical recall.
   - **Browse**: Categorized grid (People, Places, Restaurants, Movies, Periods) with full entity detail views.
   - **Backfill Mode**: Structured life-period memory prompts (classmates, teachers, events).
   - **Recall Quiz**: Spaced-repetition memory quiz with SM-2 scheduling.
   - **Weekly Reflection & Briefings**: Automated summaries and dossier generator.
   - **Automated Backups & Anti-Pause**: Daily Supabase keep-alive cron and weekly GitHub JSON backup cron.

---

## 🚀 Click-by-Click Setup Guide

### Step 1: Create a Free Supabase Project
1. Log in to [supabase.com](https://supabase.com) and click **"New Project"**.
2. Name your project (e.g. `virtual-brain`) and choose the region closest to you (e.g. `Mumbai (ap-south-1)`).
3. Once provisioned, go to **Project Settings** → **API**:
   - Copy **Project URL** (used as `NEXT_PUBLIC_SUPABASE_URL`)
   - Copy **anon public key** (used as `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Copy **service_role key** (used as `SUPABASE_SERVICE_ROLE_KEY`) — *keep this private!*

### Step 2: Run the SQL Migrations
1. In the Supabase dashboard, click **SQL Editor** on the left menu.
2. Open [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) in this repository, copy its entire contents, paste it into the SQL Editor, and click **Run**.
3. Open [`supabase/migrations/002_reviews.sql`](supabase/migrations/002_reviews.sql), copy its contents, paste, and click **Run**.
4. Check **Table Editor** on the left to verify all tables (`entries`, `entities`, `edges`, `facts`, `entry_entities`, `graph_layout`, `reviews`) were created.

### Step 3: Configure Authentication
1. Go to **Authentication** → **Providers** in Supabase:
   - Ensure **Email** is enabled (supports magic link login).
   - *(Optional)* Enable **Google** provider if you want one-click OAuth login.
2. In **Authentication** → **URL Configuration**:
   - Set **Site URL** to `http://localhost:3000` (or your Vercel domain once deployed).
   - Add `http://localhost:3000/auth/callback` and `https://<your-vercel-domain>.vercel.app/auth/callback` to **Redirect URLs**.
3. **Single-User Lockout**: After you sign in the very first time, go to **Authentication** → **Settings** and toggle **Disable new user signups**.

### Step 4: Configure Local Environment
1. In the project folder, copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and paste your Supabase keys and LLM configuration:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

   # LLM Provider Choice (Option A: Command Code, Option B: Direct DeepSeek)
   LLM_PROVIDER=commandcode
   LLM_BASE_URL=https://api.commandcode.ai
   LLM_API_KEY=user_xxxxxxxxxxxx
   LLM_MODEL=deepseek/deepseek-v4-flash

   # Timezone
   TZ=Asia/Kolkata
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Free Deployment to Vercel

1. Push your repository to GitHub (make it a **Private** repository).
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Select your GitHub repository.
4. In the **Environment Variables** section, paste all values from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `LLM_PROVIDER`
   - `LLM_BASE_URL`
   - `LLM_API_KEY`
   - `LLM_MODEL`
   - `TZ`
   - *(Optional for GitHub Backup Cron)*: `GITHUB_TOKEN` and `GITHUB_BACKUP_REPO`
5. Click **Deploy**.
6. The cron jobs in [`vercel.json`](vercel.json) are automatically scheduled:
   - `/api/keepalive` runs daily at 18:30 UTC (midnight IST) to prevent Supabase free tier pausing.
   - `/api/backup` runs weekly on Sundays at 20:30 UTC (2 AM IST) to commit your database to GitHub.

---

## 🔄 Backup & Disaster Recovery

Your memories are irreplaceable. Virtual Brain includes two backup mechanisms:

1. **Automated Weekly GitHub Backups**:
   - Provide a GitHub Personal Access Token (PAT) with `repo` permissions as `GITHUB_TOKEN` and target repository `your-username/virtual-brain-backup`.
   - Vercel automatically dumps all tables to JSON and commits them weekly.
2. **Manual Instant Export**:
   - Go to **Settings** → click **Export Data**.
   - Downloads a complete JSON archive of all tables plus a readable Markdown timeline.
3. **Restoring Data**:
   - You can re-insert JSON records directly into Supabase via the SQL Editor or use **Settings** → **Reprocess All** to re-extract graph nodes and topology from your immutable raw entries.
