---
name: frontend-craft
description: Guidelines and design system tokens for 2026 high-end luxury dark-mode interfaces, Three.js WebGL knowledge graphs, and glassmorphic micro-interactions.
---

# 2026 Frontend Craft & Visual Excellence Guide

## Core Aesthetic: Cybernetic Obsidian & Crystalline Luminescence
The interface embodies a personal digital consciousness ("Exocortex") — sleek, high-tech, deeply aesthetic, and distraction-free.

### 1. Palette & Surface Tokens
* **Void Background**: `#020307` / `#050711` with subtle radial vignette mesh.
* **Surface Glass**: `rgba(10, 12, 22, 0.72)` with `backdrop-filter: blur(24px) saturate(180%)`.
* **Specular Borders**: `1px solid rgba(255, 255, 255, 0.08)` with top-edge highlight `linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.4), transparent)`.
* **Quantum Core (User)**: `#ffffff` diamond core with `#38bdf8` electric cyan aura and Saturnian orbital ring.
* **Domain Hubs (Level 1)**: `#00f0ff` (Cyber Cyan) with additive glowing field.
* **Categories (Level 2)**: `#818cf8` (Celestial Indigo) with jewel-like clarity.
* **Semantic Tones**:
  - Rose Quartz (`#f472b6`) for human connections & relationships.
  - Bio-Emerald (`#10b981`) for travel, geography & nature.
  - Solar Topaz (`#fbbf24`) for milestones & events.
  - Nebula Violet (`#a855f7`) for creative output & media.
  - Titanium Silver (`#94a3b8`) for hardware & tools.

### 2. 3D WebGL Graph Craft Rules
1. **Interactive Spotlight Dimming**:
   - When hovering or selecting a node, connected links flare up into bright glowing energy beams (`rgba(56, 189, 248, 0.9)`).
   - Unconnected nodes and edges smoothly dim to 15% opacity so the active subgraph commands immediate visual focus.
2. **Volumetric Cognitive Nebulae**:
   - Soft, low-opacity colored particle clusters or gradient halos behind domain clusters to visually group thoughts into brain lobes.
3. **Clean Floating Typography**:
   - Never draw solid dark rectangular boxes behind labels.
   - Text floats cleanly in 3D space (`JetBrains Mono` / `Inter`), scaled by hierarchy.
   - Low-tier leaf labels fade in on proximity or hover to avoid visual clutter.
4. **Cinematic Depth**:
   - Ambient deep space dust and twinkling starfield (`THREE.Points`) with parallax.
   - Smooth orbital damping (`dampingFactor: 0.1`) and graceful camera transitions.

### 3. Interface Component Standards
1. **Floating Island Dock**:
   - Floating pill navigation centered at the bottom of the viewport with frosted glass and glowing active pills.
2. **Cockpit Status Visor (HUD)**:
   - High-tech telemetry readout: status indicator, node counts, live tension monitors, and quick glass capsules.
3. **Interactive Dossier Cards**:
   - Specular glass surfaces with subtle inner gradient glow, monospace metadata tags, and smooth entrance transforms.
