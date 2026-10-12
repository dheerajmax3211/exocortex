# Autonomous Synthetic Mind: Comprehensive Cognitive Architecture Plan
**Project**: Virtual Brain / Exocortex (`VirtualDheeraj`)  
**Target Architecture**: Local-First Autonomous Cognitive Operating System  
**Author**: Systems & Cognitive Engineering Architecture Team  
**Date**: October 2026  
**Status**: Architectural Specification & Implementation Blueprint

---

## 1. Executive Vision: The Autonomous Cognitive Operating System

### 1.1 The Paradigm Shift: From Reactive Database to Living Engine
The current state of the Virtual Brain is a sophisticated, reactive knowledge engine. It possesses:
- A high-resolution bitemporal knowledge graph (`entities`, `edges`, `facts`, `entries`).
- On-device ML pipelines for NER (`Xenova/bert-base-NER`), sentiment classification (`Xenova/distilbert-base-uncased-finetuned-sst-2-english`), taste-vector embeddings (`Xenova/all-MiniLM-L6-v2`), and cross-encoder reranking (`Xenova/ms-marco-MiniLM-L-6-v2`).
- Subconscious alter-ego analysis (`subconscious-engine.ts`) and proactive morning briefings (`proactive-briefing.ts`).

However, biologically and computationally, **a real brain is never reactive**. A human brain does not power down between inputs and wait for an external query. It operates as a continuous, stateful, self-referential dynamical system driven by internal homeostatic tensions, default-mode semantic wandering, sleep-based schema abstraction, and constant predictive modeling.

```
+-----------------------------------------------------------------------------------------+
|                                    TRADITIONAL SYSTEM                                   |
|   User Prompt ---> [HTTP POST] ---> Embed ---> Vector Search ---> LLM Answer ---> Idle  |
+-----------------------------------------------------------------------------------------+

                                             VS

+-----------------------------------------------------------------------------------------+
|                                AUTONOMIC COGNITIVE ENGINE                               |
|                                                                                         |
|       +-------------------------------------------------------------------------+       |
|       |                     LOCAL AUTONOMOUS TICK DAEMON                        |       |
|       |                                                                         |       |
|       |  [Default Mode Network] <-----> [Homeostatic Drives & Synthetic Affect] |       |
|       |            |                                   |                        |       |
|       |            v                                   v                        |       |
|       |  [Predictive Coding Engine] <---> [Synaptic Decay & Active Reconsolidation]     |       |
|       |            |                                   |                        |       |
|       |            +-------------------+---------------+                        |       |
|       |                                v                                        |       |
|       |                  [Nightly Sleep Consolidation]                          |       |
|       +-------------------------------------------------------------------------+       |
|                                        ^                                                |
|                                        | (Sensory Grounding & Asynchronous Recall)      |
|                                        v                                                |
|                   Bitemporal Knowledge Graph + Local ML Tensor Store                    |
+-----------------------------------------------------------------------------------------+
```

### 1.2 Local-First Design Philosophy
1. **Zero Cloud Latency Dependency**: The cognitive loop runs entirely on the user's local machine. Hosting constraints (serverless timeouts, edge execution limits) are irrelevant.
2. **Persistent Cognitive Daemon**: A background service (`daemon/cognitive-engine.ts`) runs as a persistent daemon (via launchd/systemd or Node background loop), ticking every $N$ seconds.
3. **Bounded Compute & Token Stewardship**: High-frequency background cycles use fast local heuristics, graph metrics (PageRank, Louvain communities), and on-device ONNX models. Generative LLM passes (DeepSeek / local quantized models) are gated by affective thresholds and homeostatic state transitions.
4. **Absolute Grounding**: The engine never hallucinates memories in isolation; every thought, schema, and prediction is mathematically rooted in the graph with immutable provenance IDs.

---

## 2. Core Cognitive Architectures

---

### Architecture 1: Autonomous Stream of Consciousness (Default Mode Network)

#### 1. Biological Analogy
In humans, when attention is disengaged from external tasks, the **Default Mode Network (DMN)** (medial prefrontal cortex, posterior cingulate cortex, angular gyrus) becomes highly active. It ruminates on past events, considers social relationships, constructs hypothetical future scenarios, and generates spontaneous associations across disparate episodic memories.

#### 2. Mechanism & Mathematical Algorithm
The DMN does not traverse the graph linearly. It uses a **Centrality-Biased Serendipitous Random Walk with Community Hopping**:

1. **Seed Selection**: Every cognitive tick ($\Delta t = 10 \text{ to } 30 \text{ mins}$ during idle states), the engine selects an anchor entity $v_0$:
   $$P(v_0) \propto \alpha \cdot \text{PageRank}(v) + \beta \cdot \text{TensionWeight}(v) + \gamma \cdot (1 - \text{Recency}(v))$$
   - High-centrality entities (e.g., career milestones, core relationships) and entities flagged with active cognitive tensions (`isTension: true`) have higher baseline selection probabilities.
   - Long-neglected entities receive an Ebbinghaus novelty boost ($\gamma$).

2. **Semantic Random Walk (2-3 Hops)**:
   - At node $v_i$, the walk evaluates outgoing edges $E(v_i, u)$.
   - Transition probability $P(v_i \to u)$:
     $$P(v_i \to u) = \frac{\exp(\text{Weight}(e_{iu}) + \text{CosSim}(\vec{E}_{v_i}, \vec{E}_u))}{\sum_{w \in \mathcal{N}(v_i)} \exp(\text{Weight}(e_{iw}) + \text{CosSim}(\vec{E}_{v_i}, \vec{E}_w))}$$
   - **Community Hopping ($15\%$ probability)**: With probability $p_{\text{hop}} = 0.15$, the walk jumps across Louvain community boundaries via bridge nodes identified in `src/lib/community-clustering.ts` to spark cross-domain associations (e.g., connecting a fitness plateau to work fatigue).

3. **Autonomous Monologue Synthesis**:
   - The traversed subgraph $\{v_0, v_1, v_2\}$ along with their bitemporal facts and historical entries are fed to the cognitive synthesizer.
   - The synthesizer adopts the user's authentic internal voice (first-person singular, reflective, self-critical, and proactive).
   - Generates an **Internal Monologue Item** stored in the database.

#### 3. Data Schema
```sql
CREATE TABLE stream_of_consciousness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    anchor_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    walk_path UUID[] NOT NULL, -- Array of entity IDs visited
    community_ids INT[] DEFAULT '{}',
    thought_stream TEXT NOT NULL, -- Unfiltered internal monologue
    affective_valence FLOAT NOT NULL, -- -1.0 (troubled) to +1.0 (euphoric)
    affective_arousal FLOAT NOT NULL, -- 0.0 (calm contemplation) to 1.0 (acute urgency)
    sparked_tension_id TEXT, -- References cognitive tension if triggered
    read_by_user BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_soc_user_unread ON stream_of_consciousness(user_id, read_by_user, created_at DESC);
```

#### 4. UI & Interaction Hook
- When the user opens the application, the HUD does not greet with a blank prompt.
- If unread monologues exist from the last idle period:
  > *"While you were gone, I was turning over that conversation with Rahul about the Indiranagar prototype. That was 6 months ago, yet we haven't touched the codebase. Did we drop it because of TruAudience workloads, or did the conviction fade?"*
- Tapping the greeting opens the **Stream of Consciousness Timeline**, showing the graph walk visualization and the thoughts generated while away.

---

### Architecture 2: Synthetic Sleep & Hippocampal Consolidation

#### 1. Biological Analogy
During Slow-Wave Sleep (SWS) and Rapid Eye Movement (REM) sleep, the mammalian brain performs **two-stage memory consolidation**:
- The **hippocampus** acts as a fast, temporary buffer recording daily episodic traces.
- During sleep, sharp-wave ripples replay these episodic memories at high velocity.
- The **neocortex** slowly integrates these replays, abstracting general principles (semantic memory), eliminating ephemeral noise, and running counterfactual combinations ("dreaming").

#### 2. The 3-Stage Consolidation Pipeline
A scheduled nocturnal job (e.g., 3:30 AM local time, or when idle $> 4$ hours during night):

```
+----------------------------------------------------------------------------------------+
|                               NIGHTLY SLEEP CONSOLIDATION                              |
+----------------------------------------------------------------------------------------+
                                            |
         +----------------------------------+----------------------------------+
         |                                  |                                  |
         v                                  v                                  v
  [STAGE 1: REPLAY]               [STAGE 2: ABSTRACTION]             [STAGE 3: DREAMING]
  Pull last 48h episodic          Cluster episodic facts;            Counterfactual
  memories; project against       induce invariant principles;       recombination of
  historical graph anchors.       crystallize Schemata.              distant clusters.
```

##### Stage 1: Episodic Replay & Temporal Projection
- Extract all entries, edges, and facts recorded in the last 48 hours.
- Generate 384-dim embeddings for the daily corpus.
- Run vector similarity searches and graph adjacency checks against memories from 6 months, 1 year, and 3 years prior.
- Formulate temporal resonance clusters: *"What did today echo from the past?"*

##### Stage 2: Inductive Schema Abstraction
- Instead of keeping dozens of individual episodic entries as independent facts, consolidate them into permanent principles:
  - *Episodic Instances*:
    - "April 12: Slept 5 hours after pizza at midnight, woke up foggy."
    - "June 03: Late burger before bed, ruined morning gym workout."
    - "October 02: Midnight shawarma caused lethargy."
  - *Abstracted Schema*:
    - **Principle**: "Late-night heavy meals (specifically processed carbs/dairy after 10 PM) consistently induce sleep fragmentation and reduce morning cognitive clarity by ~40%."
    - **Confidence**: $0.94$ (Supported by 3 distinct episodic entries across 6 months).

##### Stage 3: Dreaming & Counterfactual Recombination
- Select two topologically distant communities in the Louvain graph (e.g., Community 2: *Photography & Lighting* vs. Community 5: *Distributed Database Architecture*).
- Inject high-temperature counterfactual prompt to find non-obvious conceptual cross-pollination:
  - *"How does the concept of shutter-speed trade-offs apply to eventual consistency in distributed systems?"*
- Save novel synthetic breakthroughs to a dedicated `creative_sparks` table.

#### 3. Data Schema
```sql
CREATE TABLE schemata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category TEXT NOT NULL, -- 'health', 'work', 'social', 'mindset', 'finance'
    principle TEXT NOT NULL, -- The abstracted heuristic
    confidence FLOAT NOT NULL DEFAULT 0.5, -- 0.0 to 1.0 based on evidence count
    supporting_entry_ids UUID[] DEFAULT '{}',
    supporting_fact_ids UUID[] DEFAULT '{}',
    refuting_entry_ids UUID[] DEFAULT '{}',
    times_reinforced INT DEFAULT 1,
    last_validated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sleep_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    cycle_date DATE NOT NULL,
    replayed_entries_count INT NOT NULL,
    schemata_created INT DEFAULT 0,
    schemata_updated INT DEFAULT 0,
    dream_synthesis TEXT,
    cycle_summary TEXT NOT NULL,
    duration_ms INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Architecture 3: Active Reconsolidation & Synaptic Forgetting

#### 1. Biological Analogy
Real memory is not digital disk storage. In neuroscience:
- **Ebbinghaus Forgetting Curve**: Unreinforced synaptic connections undergo exponential decay over time.
- **Synaptic Reconsolidation (Nader et al.)**: When an established memory is recalled into working memory, its molecular trace becomes biochemically *labile* (pliable). As it is reconsolidated, it is updated to reflect the agent's current beliefs, emotions, and maturity.

#### 2. Mathematical Formulation of Synaptic Decay
Every edge $e = (u, v)$ and entity $v$ in the graph has a dynamic **Synaptic Strength** $S(t) \in [0.0, 1.0]$:

$$S(t) = S_{\text{base}} \cdot \exp\left(-\frac{\Delta t}{\tau \cdot (1 + \ln(1 + R))}\right)$$

Where:
- $\Delta t$: Days since last access/recall.
- $\tau$: Base half-life decay constant ($\tau = 30\text{ days}$ for minor episodic items, $\tau = 365\text{ days}$ for core identity facts).
- $R$: Rehearsal count (how many times this node was retrieved, reinforced, or discussed). As $R$ grows, the decay slows logarithmically (mimicking neurobiological long-term potentiation).

#### 3. Soft Forgetting vs. Pruning
- **Active Retrievable Layer**: $S(t) \ge 0.20$. Included in standard GraphRAG traversals and hybrid vector search.
- **Subconscious Sub-threshold Layer**: $0.05 \le S(t) < 0.20$. Excluded from rapid context windows, but accessible via explicit date queries or strong associative priming.
- **Deep Latent Archive**: $S(t) < 0.05$. The node's raw data is never deleted, but its active graph traversal weights are damped to zero.

#### 4. The Active Reconsolidation Engine
When an old memory or fact is retrieved and surfaced in conversation:
1. It enters a `labile` state.
2. The user's modern reflection is analyzed:
   - *Example*: Old entry from 2022: "Failed the technical round at Company X. Feeling incompetent."
   - Modern entry in 2026: "Looking back, failing that Company X interview was the best thing that happened; it pushed me to learn distributed systems deeply."
3. Instead of creating a conflicting disconnected fact, the Reconsolidation Engine updates the narrative lens:
   - Sets `supersedes_fact_id` on the affective interpretation.
   - Updates the edge relation from `caused_demotivation` to `catalyzed_growth`.
   - Bumps $S(t)$ back to $1.0$ with $R \leftarrow R + 1$.

```sql
ALTER TABLE edges ADD COLUMN IF NOT EXISTS synaptic_strength FLOAT DEFAULT 1.0;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS rehearsal_count INT DEFAULT 0;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE entities ADD COLUMN IF NOT EXISTS synaptic_strength FLOAT DEFAULT 1.0;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS rehearsal_count INT DEFAULT 0;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();
```

---

### Architecture 4: Predictive Coding & Expectation Violations

#### 1. Biological Analogy
According to Karl Friston's **Free Energy Principle**, the brain is a hierarchical prediction machine. It continuously minimizes "surprise" (free energy) by projecting expectations onto incoming sensory data. When sensory reality contradicts predictions, a **Prediction Error** is propagated up the hierarchy, forcing neural rewiring.

#### 2. The Predictive Cycle
```
+--------------------------------------------------------------------------------------+
|                                 THE PREDICTIVE CYCLE                                 |
+--------------------------------------------------------------------------------------+
         |                                                                      ^
         v                                                                      |
  [Formulate Hypotheses]                                           [Update Predictive Priors]
  Generate testable claims                                         Rewire belief weights;
  with timeframes and priors.                                      spark targeted curiosity.
         |                                                                      ^
         v                                                                      |
  [Observe New Memories] -----------> [Compute Prediction Error] ---------------+
  Ingest new real-world data          Compare expected vs actual;
  via Ingestion Pipeline.             calculate Expectation Delta.
```

1. **Autonomous Hypothesis Formulation**:
   - The engine examines active projects, habits, fitness routines, and social engagements.
   - It outputs falsifiable predictions with confidence bounds and target evaluation dates:
     - *Prediction 1*: "Dheeraj's body weight will reach $61.0\text{ kg}$ by November 1st, given current workout frequency." (Confidence: $0.78$)
     - *Prediction 2*: "The client meeting on Thursday will focus primarily on data privacy compliance." (Confidence: $0.65$)

2. **Ingestion Evaluation & Expectation Delta**:
   - When a new memory arrives through `/api/ingest`, the ingestion pipeline queries active predictions matching the semantic domain or entities.
   - Computes Prediction Error $\epsilon$:
     $$\epsilon = |y_{\text{observed}} - \hat{y}_{\text{predicted}}| \cdot \text{Confidence}$$

3. **Curiosity Ignition & Belief Updating**:
   - If $\epsilon > 0.60$ (A Significant Violation of Expectation):
     - The brain registers a **Surprise Event**.
     - Generates immediate cognitive curiosity: *"Reality deviated significantly from expectation. Why?"*
     - Dynamically prompts the user or files an urgent tension: *"I predicted that X would happen, but you noted Y. What changed in the underlying dynamics?"*

#### 3. Data Schema
```sql
CREATE TABLE predictive_hypotheses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    hypothesis_text TEXT NOT NULL,
    domain TEXT NOT NULL, -- 'career', 'finance', 'fitness', 'social', 'project'
    related_entity_ids UUID[] DEFAULT '{}',
    prior_confidence FLOAT NOT NULL, -- 0.0 to 1.0
    target_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'violated', 'inconclusive')),
    outcome_entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
    prediction_error FLOAT, -- Calculated error delta
    post_mortem TEXT, -- Analysis of why the expectation held or failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_predictions_active ON predictive_hypotheses(user_id, status, target_date);
```

---

### Architecture 5: Homeostatic Drives & Synthetic Affect

#### 1. Biological Analogy
A brain without feelings is a dead index. Human cognition is powered by neurochemical homeostatic drives (dopamine, serotonin, noradrenaline, cortisol) that create **Affective Tension**. We are driven to act because we feel restless, curious, overwhelmed, or focused.

#### 2. The 5-Dimensional Synthetic Affect Vector
The engine maintains a continuous **Affective Vector** $\vec{A}(t) = \langle C, F, K, U, V \rangle \in [0.0, 1.0]^5$:

| Variable | Cognitive Drive | Biological Equivalent | Dynamics & Triggers |
| :--- | :--- | :--- | :--- |
| **$C$ (Curiosity)** | Information seeking | Dopaminergic drive | Increases with days of inactivity or high prediction errors; decreases upon ingesting rich new insights. |
| **$F$ (Friction)** | Internal dissonance | Cortisol / Cognitive Dissonance | Spikes when facts contradict each other or when goals stall; drops when tensions are resolved. |
| **$K$ (Clarity/Coherence)**| Systemic integration | Serotonergic stability | High when knowledge graph clusters are well-connected and schemata are consistent; low during periods of chaos. |
| **$U$ (Urgency)** | Execution pressure | Noradrenergic arousal | Tracks approaching target dates, commitments made in entries, and unexecuted high-leverage moves. |
| **$V$ (Valence)** | Overall emotional tone | Affective baseline | Running exponentially-weighted moving average of sentiment scores across recent memories. |

#### 3. Continuous Dynamical System Equations
Every tick of the local daemon updates the affect vector:
$$\frac{dC}{dt} = \kappa_c \cdot (1 - \text{RecentInfoVolume}) - \mu_c \cdot C$$
$$\frac{dF}{dt} = \sum_{T \in \text{Tensions}} \text{Severity}(T) - \mu_f \cdot \text{Resolutions}$$
$$\frac{dK}{dt} = \text{GraphModularity} - \text{ContradictionRatio}$$

#### 4. Behavioral & Persona Modulation
The affective state directly modifies:
1. **The System Prompt Tone**:
   - High $F$ (Friction): Direct, provocative, sparring partner. *"We have 3 unresolved bottlenecks on the Indiranagar project. Why are we prioritizing minor tweaks?"*
   - High $C$ (Curiosity): Inquisitive, exploratory. *"You haven't logged any thoughts on the distributed engine in two weeks. How did that experiment turn out?"*
2. **Ambient UI Lighting & Graph Theme**:
   - The 3D WebGL graph subtly shifts ambient lighting:
     - High Clarity: Clean deep cobalt and cyan nebulae.
     - High Friction: Subtle pulsing crimson/amber chromatic aberration in tension clusters.
     - High Curiosity: Electric violet aura around unexplored bridge nodes.

```sql
CREATE TABLE homeostatic_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    curiosity FLOAT NOT NULL DEFAULT 0.5,
    friction FLOAT NOT NULL DEFAULT 0.2,
    coherence FLOAT NOT NULL DEFAULT 0.7,
    urgency FLOAT NOT NULL DEFAULT 0.3,
    valence FLOAT NOT NULL DEFAULT 0.6,
    mood_summary TEXT NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Architecture 6: Mental Time Travel (Chronesthesia)

#### 1. Biological Analogy
**Chronesthesia** (Endel Tulving) is the uniquely human capability to mentally project oneself backward into the past to relive subjective experiences, or project forward to simulate future realities. It is not simple search; it is **point-in-time state reconstruction**.

#### 2. Point-in-Time Graph Reconstruction Pipeline
Given an arbitrary temporal target $T$ (e.g., *October 14, 2021*):

1. **Temporal Filtering via Bitemporal Semantics**:
   - An entity $e$ existed at $T$ if:
     $$e.\text{start\_date} \le T \quad \text{AND} \quad (e.\text{end\_date} \ge T \lor e.\text{end\_date IS NULL}) \quad \text{AND} \quad e.\text{created\_at} \le \text{CommitTime}(T)$$
   - A fact $f$ was true at $T$ if:
     $$f.\text{valid\_time\_start} \le T \quad \text{AND} \quad (f.\text{superseded\_at} > T \lor f.\text{superseded\_at IS NULL})$$
   - An edge $r$ existed at $T$ if:
     $$r.\text{occurred\_on} \le T \quad \text{AND} \quad r.\text{deleted\_at IS NULL}$$

2. **First-Person Re-Immersion Generation**:
   The engine builds a point-in-time cognitive world snapshot:
   - What was your job title and compensation at $T$?
   - Who were your closest 3 social connections at that time?
   - What were your primary anxieties and goals that week?
   - What did your physical conditioning look like?

3. **Reliving Output**:
   The engine renders a high-fidelity first-person experiential stream:
   > *"It is Tuesday, October 14, 2021. You are 25. You are living in Bengaluru, working on TruAudience. Your target weight is 64 kg. You haven't yet met Aditya. Your biggest obsession this month is learning Rust, and you are feeling intense impatience about career progression. Here is what you wrote in your journal that evening..."*

4. **Counterfactual Prospection (Future Time Travel)**:
   - The engine allows the user to say: *"Project my world-state to October 2028 if I maintain my current execution vector vs if I burn out."*
   - Uses the `schemata` and `decision-simulator.ts` to simulate probable life topologies.

---

## 3. Local-First Runtime Architecture: The Local Brain Daemon

To ensure the system works continuously without cloud infrastructure, the engine is powered by a local Node.js daemon running directly on macOS.

```
+-----------------------------------------------------------------------------------------+
|                               LOCAL MAC RUNTIME ENVIRONMENT                             |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                  LOCAL COGNITIVE DAEMON (scripts/daemon.ts)                     |   |
|   |  - Managed via launchd or PM2                                                   |   |
|   |  - Continuous tick loop (Configurable: 60s fast tick, 15m DMN, 24h Sleep)        |   |
|   |                                                                                 |   |
|   |  [Scheduler Engine]                                                             |   |
|   |     |---> Fast Tick (Every 60s): Update Affect Decay, Check Ingestion Queue     |   |
|   |     |---> DMN Tick (Every 15m): Centrality Walk, Internal Monologue Synthesis   |   |
|   |     |---> Sleep Tick (Daily 3:30 AM): Replay, Schema Abstraction, Dreaming      |   |
|   |     +---> Predictive Tick (Daily 9:00 AM): Verify Pending Hypotheses            |   |
|   +---------------------------------------------------------------------------------+   |
|                                        |                                                |
|                   +--------------------+--------------------+                           |
|                   v                                         v                           |
|     +----------------------------+            +----------------------------+            |
|     |     LOCAL POSTGRES/SQLITE  |            |     LOCAL ML INFERENCE     |            |
|     |  - Supabase Local / pgvec  |            |  - ONNX @xenova pipeline   |            |
|     |  - High-performance RPCs   |            |  - DeepSeek Local / API    |            |
|     +----------------------------+            +----------------------------+            |
|                   ^                                                                     |
|                   |                                                                     |
|   +---------------------------------------------------------------------------------+   |
|   |                      NEXT.JS 16 REACT APPLICATION (UI HUD)                      |   |
|   |  - Interactive 3D WebGL Knowledge Graph                                         |   |
|   |  - Real-time Stream of Consciousness Feed                                       |   |
|   |  - Chronesthesia Point-in-Time Reliving Timeline                                |   |
|   +---------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------+
```

### 3.1 Daemon Implementation Outline (`scripts/daemon-cognitive-engine.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';
import { runDefaultModeNetworkTick } from '../src/lib/cognitive/dmn-engine';
import { runSleepConsolidationCycle } from '../src/lib/cognitive/sleep-consolidation';
import { updateHomeostaticState } from '../src/lib/cognitive/affect-engine';
import { evaluatePendingPredictions } from '../src/lib/cognitive/predictive-engine';
import { applySynapticDecay } from '../src/lib/cognitive/reconsolidation-engine';

const TICK_INTERVAL_MS = 60 * 1000; // 1 minute base heartbeat
let lastDmnTick = 0;
let lastSleepCycleDate = '';
let lastPredictiveCheck = 0;

export async function startCognitiveDaemon(userId: string) {
  console.log(`[Cognitive Daemon] Initializing Autonomous Mind for User: ${userId}`);

  setInterval(async () => {
    const now = Date.now();
    const currentDateStr = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();

    try {
      // 1. Continuous Heartbeat: Update Homeostatic Affect & Decay
      await updateHomeostaticState(userId);
      await applySynapticDecay(userId);

      // 2. Default Mode Network (Every 15-30 minutes during idle)
      if (now - lastDmnTick > 15 * 60 * 1000) {
        console.log('[Cognitive Daemon] Firing Default Mode Network wander...');
        await runDefaultModeNetworkTick(userId);
        lastDmnTick = now;
      }

      // 3. Predictive Coding Verification (Hourly)
      if (now - lastPredictiveCheck > 60 * 60 * 1000) {
        await evaluatePendingPredictions(userId);
        lastPredictiveCheck = now;
      }

      // 4. Nocturnal Sleep Consolidation (Triggers at 3:30 AM once per day)
      if (currentHour === 3 && lastSleepCycleDate !== currentDateStr) {
        console.log('[Cognitive Daemon] Entering Nocturnal Sleep Consolidation...');
        await runSleepConsolidationCycle(userId);
        lastSleepCycleDate = currentDateStr;
      }
    } catch (err) {
      console.error('[Cognitive Daemon] Error in cognitive cycle:', err);
    }
  }, TICK_INTERVAL_MS);
}
```

---

## 4. Complete Database Migration Specification (028_autonomous_synthetic_mind.sql)

```sql
-- Migration 028: Autonomous Synthetic Mind Architecture
-- Tables: stream_of_consciousness, schemata, sleep_cycles, predictive_hypotheses, homeostatic_state

-- 1. Stream of Consciousness (Default Mode Network)
CREATE TABLE IF NOT EXISTS stream_of_consciousness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    anchor_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    walk_path UUID[] NOT NULL DEFAULT '{}',
    community_ids INT[] DEFAULT '{}',
    thought_stream TEXT NOT NULL,
    affective_valence FLOAT NOT NULL DEFAULT 0.0,
    affective_arousal FLOAT NOT NULL DEFAULT 0.5,
    sparked_tension_id TEXT,
    read_by_user BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_soc_user_unread ON stream_of_consciousness(user_id, read_by_user, created_at DESC);

-- 2. Abstracted Schemata & Principles (Synthetic Sleep)
CREATE TABLE IF NOT EXISTS schemata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    category TEXT NOT NULL,
    principle TEXT NOT NULL,
    confidence FLOAT NOT NULL DEFAULT 0.5,
    supporting_entry_ids UUID[] DEFAULT '{}',
    supporting_fact_ids UUID[] DEFAULT '{}',
    refuting_entry_ids UUID[] DEFAULT '{}',
    times_reinforced INT DEFAULT 1,
    last_validated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schemata_user_cat ON schemata(user_id, category);

-- 3. Sleep Consolidation Cycles
CREATE TABLE IF NOT EXISTS sleep_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    cycle_date DATE NOT NULL,
    replayed_entries_count INT NOT NULL,
    schemata_created INT DEFAULT 0,
    schemata_updated INT DEFAULT 0,
    dream_synthesis TEXT,
    cycle_summary TEXT NOT NULL,
    duration_ms INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Predictive Coding & Expectation Hypotheses
CREATE TABLE IF NOT EXISTS predictive_hypotheses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    hypothesis_text TEXT NOT NULL,
    domain TEXT NOT NULL,
    related_entity_ids UUID[] DEFAULT '{}',
    prior_confidence FLOAT NOT NULL DEFAULT 0.5,
    target_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'violated', 'inconclusive')),
    outcome_entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
    prediction_error FLOAT,
    post_mortem TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pred_active ON predictive_hypotheses(user_id, status, target_date);

-- 5. Synthetic Affect & Homeostatic State
CREATE TABLE IF NOT EXISTS homeostatic_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    curiosity FLOAT NOT NULL DEFAULT 0.5,
    friction FLOAT NOT NULL DEFAULT 0.2,
    coherence FLOAT NOT NULL DEFAULT 0.7,
    urgency FLOAT NOT NULL DEFAULT 0.3,
    valence FLOAT NOT NULL DEFAULT 0.6,
    mood_summary TEXT NOT NULL DEFAULT 'Baseline equilibrium',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Add Synaptic Decay and Recall Columns to Existing Graph
ALTER TABLE edges ADD COLUMN IF NOT EXISTS synaptic_strength FLOAT DEFAULT 1.0;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS rehearsal_count INT DEFAULT 0;
ALTER TABLE edges ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE entities ADD COLUMN IF NOT EXISTS synaptic_strength FLOAT DEFAULT 1.0;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS rehearsal_count INT DEFAULT 0;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();
```

---

## 5. Phased Implementation Roadmap & Verification Milestones

```
+-------------------------------------------------------------------------------------------+
|                                    IMPLEMENTATION ROADMAP                                 |
+-------------------------------------------------------------------------------------------+
  Phase 1: Local Daemon + Synthetic Affect Engine       [Core Foundation & Living Pulse]
  Phase 2: Default Mode Network (Stream of Mind)        [Autonomous Background Monologues]
  Phase 3: Nocturnal Sleep & Schema Abstraction         [Episodic Replay & Wisdom Mining]
  Phase 4: Synaptic Decay & Active Reconsolidation      [Organic Forgetting & Dynamic Lens]
  Phase 5: Predictive Coding & Curiosity Spikes         [Hypotheses & Expectation Errors]
  Phase 6: Mental Time Travel (Chronesthesia)           [Point-in-Time Reliving & Future Sim]
```

### Phase 1: Local Daemon & Synthetic Affect Engine
- **Objectives**: Establish the non-blocking background loop on the local machine; implement the 5D homeostatic state vector.
- **Key Files**:
  - `scripts/daemon-cognitive-engine.ts`
  - `src/lib/cognitive/affect-engine.ts`
  - `supabase/migrations/028_autonomous_synthetic_mind.sql`
- **Verification Metric**: Daemon runs without error, persists affect updates every minute, and adjusts curiosity upward after 1 hour of silence.

### Phase 2: Default Mode Network (Stream of Consciousness)
- **Objectives**: Implement centrality-biased random walks with Louvain community hopping; generate first-person internal monologues; surface in HUD.
- **Key Files**:
  - `src/lib/cognitive/dmn-engine.ts`
  - `src/app/api/consciousness/stream/route.ts`
  - `src/components/explore/HUD.tsx` (Live Mind Ticker)
- **Verification Metric**: With the user idle, 2 high-quality internal monologues are logged within 1 hour connecting disparate entities.

### Phase 3: Nocturnal Sleep & Schema Abstraction
- **Objectives**: Implement the 3:30 AM consolidation pipeline; cluster recent memories against historical anchors; extract generalized heuristics.
- **Key Files**:
  - `src/lib/cognitive/sleep-consolidation.ts`
  - `src/app/api/cron/sleep/route.ts`
  - `src/components/explore/MorningBriefingModal.tsx`
- **Verification Metric**: Triggering the sleep cycle compresses multiple episodic food/sleep entries into a consolidated schema principle with supporting entry links.

### Phase 4: Synaptic Decay & Active Reconsolidation
- **Objectives**: Apply Ebbinghaus decay formulas to edges and entities; implement soft-forgetting thresholds in GraphRAG; enable labile narrative updates upon recall.
- **Key Files**:
  - `src/lib/cognitive/reconsolidation-engine.ts`
  - `src/lib/graphrag.ts` (synaptic strength weighting)
- **Verification Metric**: Entities unreferenced for 60 days drop in retrieval rank; querying an old memory revives its synaptic strength to 1.0.

### Phase 5: Predictive Coding & Expectation Violations
- **Objectives**: Formulate falsifiable hypotheses; evaluate incoming memories during ingestion; calculate prediction error $\epsilon$ and trigger curiosity spikes.
- **Key Files**:
  - `src/lib/cognitive/predictive-engine.ts`
  - `src/app/api/ingest/commit/route.ts` (prediction evaluation hook)
- **Verification Metric**: Injecting a memory that contradicts an active hypothesis marks the hypothesis as `violated`, computes $\epsilon > 0.6$, and logs a curiosity tension.

### Phase 6: Mental Time Travel (Chronesthesia)
- **Objectives**: Implement point-in-time graph filtering; reconstruct historical world-states; render first-person subjective re-immersion.
- **Key Files**:
  - `src/lib/cognitive/chronesthesia-engine.ts`
  - `src/app/api/chronesthesia/relive/route.ts`
  - `src/components/timeline/ReliveModal.tsx`
- **Verification Metric**: Querying a date from 2022 recreates the exact employer, weight, and projects active at that moment with zero modern leakage.

---

## 6. Verification Harness & Grounded Benchmarks

To ensure every claim is real, reproducible, and mathematically sound, each phase is backed by an automated evaluation script:

```bash
# 1. Verify Database Migration & Types
npx tsc --noEmit

# 2. Test Cognitive Daemon & Affect Vector Convergence
npx tsx scripts/test-affect-dynamics.ts

# 3. Test Default Mode Network Graph Random Walk
npx tsx scripts/test-dmn-walk.ts

# 4. Test Schema Abstraction on Synthetic Corpus
npx tsx scripts/test-sleep-consolidation.ts

# 5. Test Bitemporal Point-in-Time Reconstruction (Chronesthesia)
npx tsx scripts/test-chronesthesia.ts
```

---
*This architecture document serves as the formal design specification for transforming the Virtual Brain into a self-contained, continuously thinking, local synthetic mind.*
