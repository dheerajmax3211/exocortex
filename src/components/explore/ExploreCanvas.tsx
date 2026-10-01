'use client';

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import ForceGraph3D from './ForceGraph3DWrapper';
import NodeCard from './NodeCard';

// Type imports only - Three.js loaded dynamically
import type { Group, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial, Mesh } from 'three';

// ---- Types ----
export interface Graph3DNode {
  [key: string]: any;
  id: string;
  name: string;
  type: string;
  val: number;
  isUser?: boolean;
  isDomainHub?: boolean;
  isCategory?: boolean;
  connectionCount: number;
  fx?: number;
  fy?: number;
  fz?: number;
  x?: number;
  y?: number;
  z?: number;
  isTension?: boolean;
  tensionSeverity?: string;
  tensionHeadline?: string;
}

export interface Graph3DLink {
  source: string | Graph3DNode;
  target: string | Graph3DNode;
  relation?: string;
}

interface ExploreCanvasProps {
  onViewProfile?: (entityId: string) => void;
  focusedNodeId?: string | null;
}

// ---- Category Colors (2026 Luminescent Gemstone Palette) ----
const CATEGORY_COLORS: Record<string, string> = {
  person:     '#f472b6', // Rose Quartz / Connection
  place:      '#34d399', // Bio-Emerald / Location
  restaurant: '#fbbf24', // Warm Amber / Culinary
  dish:       '#fb923c', // Sunset Coral / Taste
  movie:      '#c084fc', // Luminous Violet / Cinema
  show:       '#a855f7', // Electric Violet / Media
  book:       '#38bdf8', // Cyber Azure / Literature
  event:      '#facc15', // Solar Topaz / Occasion
  period:     '#e879f9', // Orchid Mist / Era
  school:     '#2dd4bf', // Seafoam Teal / Education
  org:        '#60a5fa', // Steel Cobalt / Industry
  item:       '#94a3b8', // Titanium Silver / Artifact
  other:      '#64748b', // Slate / General
};

// Geometry cache for performance (shared across all nodes)
const geoCache = new Map<string, any>();

// Stable hash for pseudo-random deterministic link parameters
function getLinkHash(link: any, index = 0): number {
  const src = typeof link.source === 'object' ? link.source.id : String(link.source || '');
  const tgt = typeof link.target === 'object' ? link.target.id : String(link.target || '');
  const key = `${src}->${tgt}:${index}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getLinkId(link: any): string {
  const src = typeof link.source === 'object' ? link.source.id : String(link.source || '');
  const tgt = typeof link.target === 'object' ? link.target.id : String(link.target || '');
  return `${src}->${tgt}`;
}

const SPARK_PALETTE = [
  '#00f0ff', // Cyber Cyan
  '#38bdf8', // Sky Azure
  '#818cf8', // Celestial Indigo
  '#c084fc', // Nebula Violet
  '#34d399', // Bio-Emerald
  '#ffffff', // Diamond White
  '#facc15', // Solar Topaz
];

function getOrComputeLinkSynapse(link: any, index = 0) {
  if (link.__synapseSpeed !== undefined) {
    return link;
  }
  const hash = getLinkHash(link, index);
  const rSpeed = ((hash * 48271) % 2147483647) / 2147483647;
  const rWidth = ((hash * 69069 + 1) % 2147483647) / 2147483647;
  const rColor = ((hash * 134775813 + 1) % 2147483647) / 2147483647;

  // Calibrate speed: smooth traversal taking ~2.4 - 3.2s per link
  link.__synapseSpeed = 0.0042 + rSpeed * 0.0028;
  link.__synapseWidth = 0.9 + rWidth * 0.5; // 0.9px to 1.4px subtle spark
  link.__synapseColor = SPARK_PALETTE[Math.floor(rColor * SPARK_PALETTE.length)];
  return link;
}

export default function ExploreCanvas({ onViewProfile, focusedNodeId }: ExploreCanvasProps) {
  const fgRef = useRef<any>(null);
  const nebulaGroupRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<{ nodes: Graph3DNode[]; links: Graph3DLink[] }>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<Graph3DNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Graph3DNode | null>(null);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const [threeLib, setThreeLib] = useState<typeof import('three') | null>(null);
  const [spriteTextLib, setSpriteTextLib] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Active focus target for neural spotlight highlighting
  const activeFocusNode = hoveredNode || selectedNode;

  // Track connected neighbors and links for active focus spotlight
  const connectedState = useMemo(() => {
    if (!activeFocusNode) return { nodeIds: new Set<string>(), linkIds: new Set<any>() };
    const nodeIds = new Set<string>([activeFocusNode.id]);
    const linkIds = new Set<any>();

    graphData.links.forEach((l: any) => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      if (srcId === activeFocusNode.id) {
        nodeIds.add(tgtId);
        linkIds.add(l);
      } else if (tgtId === activeFocusNode.id) {
        nodeIds.add(srcId);
        linkIds.add(l);
      }
    });

    return { nodeIds, linkIds };
  }, [activeFocusNode, graphData.links]);

  // Dynamically load Three.js and SpriteText (avoid SSR issues)
  useEffect(() => {
    setMounted(true);
    Promise.all([
      import('three'),
      import('three-spritetext')
    ]).then(([three, spriteText]) => {
      setThreeLib(three);
      setSpriteTextLib(() => spriteText.default);
    });
  }, []);

  // Fetch graph data, orient all links outward from core, and calculate mistimed branch offsets
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await fetch('/api/graph');
        const data = await res.json();
        const rawNodes: Graph3DNode[] = data.nodes || [];
        const rawLinks = data.links || data.edges || [];

        // 1. Identify Root User Node (the core)
        const rootNode = rawNodes.find(n => n.isUser) || rawNodes[0];
        const rootId = rootNode?.id;

        // 2. Build adjacency for BFS depth calculation from core
        const adj = new Map<string, string[]>();
        rawLinks.forEach((l: any) => {
          const s = typeof l.source === 'object' ? l.source.id : String(l.source);
          const t = typeof l.target === 'object' ? l.target.id : String(l.target);
          if (!adj.has(s)) adj.set(s, []);
          if (!adj.has(t)) adj.set(t, []);
          adj.get(s)!.push(t);
          adj.get(t)!.push(s);
        });

        // 3. BFS from Root to compute outward depth & primary branch assignment
        const nodeDepth = new Map<string, number>();
        const nodeBranch = new Map<string, number>();

        if (rootId) {
          nodeDepth.set(rootId, 0);
          nodeBranch.set(rootId, 0);

          const primaryBranches = adj.get(rootId) || [];
          const queue: { id: string; depth: number; branch: number }[] = [];

          primaryBranches.forEach((childId, bIdx) => {
            nodeDepth.set(childId, 1);
            nodeBranch.set(childId, bIdx);
            queue.push({ id: childId, depth: 1, branch: bIdx });
          });

          while (queue.length > 0) {
            const { id: currId, depth: currDepth, branch: currBranch } = queue.shift()!;
            const neighbors = adj.get(currId) || [];
            for (const nId of neighbors) {
              if (!nodeDepth.has(nId)) {
                nodeDepth.set(nId, currDepth + 1);
                nodeBranch.set(nId, currBranch);
                queue.push({ id: nId, depth: currDepth + 1, branch: currBranch });
              }
            }
          }
        }

        const totalBranches = Math.max(1, (adj.get(rootId) || []).length);

        // 4. Orient EVERY link OUTWARD (source = closer to core, target = further towards end)
        // and MASSIVELY RANDOMIZE phase offsets and low-to-moderate speeds
        const enrichedLinks = rawLinks.map((l: any, idx: number) => {
          let s = typeof l.source === 'object' ? l.source.id : String(l.source);
          let t = typeof l.target === 'object' ? l.target.id : String(l.target);

          let dS = nodeDepth.get(s) ?? 1;
          let dT = nodeDepth.get(t) ?? 1;

          // If reversed (pointing inward toward core), flip so source is always closer to core
          if (dS > dT) {
            const temp = s; s = t; t = temp;
            const tempD = dS; dS = dT; dT = tempD;
          }

          const linkDepth = dS;
          
          // Randomize this MASSIVELY. Totally decoupled from branch index so it's not uniform
          // Random offset between 0 and 1
          const offset = Math.random(); 

          // Low to moderate steady speed: 0.0010 to 0.0035 (takes ~5 to 16 seconds to glide across)
          // Random speeds so they don't look like they are travelling together
          const speed = 0.0010 + Math.random() * 0.0025;

          // Particle width: slightly more prominent near core, refined at extremities
          const width = linkDepth === 0 ? 1.4 : (linkDepth === 1 ? 1.1 : 0.8);

          // We'll also only put particles on ~35% of the links to reduce the "way toooooo many" distraction
          const hasParticle = Math.random() < 0.35;

          return {
            ...l,
            source: s,
            target: t,
            __hasParticle: hasParticle,
            __particleOffset: offset,
            __particleSpeed: speed,
            __particleWidth: width,
            __synapseColor: SPARK_PALETTE[Math.floor(Math.random() * SPARK_PALETTE.length)],
          };
        });

        setGraphData({ 
          nodes: rawNodes, 
          links: enrichedLinks 
        });
      } catch (err) {
        console.error('Failed to load graph:', err);
      }
    };
    fetchGraph();
  }, []);

  // Configure physics, ambient starfield, and controls after graph mounts
  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0 || !threeLib) return;

    const fg = fgRef.current;
    const THREE = threeLib;

    // OrbitControls
    const controls = fg.controls?.();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.25;
      controls.enableDamping = true;
      controls.dampingFactor = 0.12;
      controls.minDistance = 40;
      controls.maxDistance = 600;
    }

    // Add ambient cosmic starfield and volumetric nebulae to Three.js scene
    const scene = fg.scene?.();
    if (scene && !scene.getObjectByName('ambient-cosmic-starfield')) {
      const starCount = 1200;
      const starGeometry = new THREE.BufferGeometry();
      const starPositions = new Float32Array(starCount * 3);
      const starColors = new Float32Array(starCount * 3);

      for (let i = 0; i < starCount; i++) {
        const r = 220 + Math.random() * 520;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i * 3 + 2] = r * Math.cos(phi);

        const brightness = 0.2 + Math.random() * 0.7;
        starColors[i * 3] = brightness * 0.85;
        starColors[i * 3 + 1] = brightness * 0.95;
        starColors[i * 3 + 2] = brightness;
      }

      starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

      const starMaterial = new THREE.PointsMaterial({
        size: 1.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
      });

      const starfield = new THREE.Points(starGeometry, starMaterial);
      starfield.name = 'ambient-cosmic-starfield';
      scene.add(starfield);

      // Add Volumetric Cognitive Nebulae (Soft atmospheric colored clouds)
      const nebulaGroup = new THREE.Group();
      nebulaGroup.name = 'cognitive-nebulae';
      
      const nebulaeCenters = [
        { x: -90, y: 50, z: -60, color: 0x00f0ff, count: 180, spread: 55, size: 3.5, opacity: 0.18 }, // Cyber Cyan Lobe
        { x: 100, y: -40, z: -50, color: 0x818cf8, count: 180, spread: 60, size: 3.8, opacity: 0.16 }, // Indigo Lobe
        { x: -60, y: -80, z: 40, color: 0x10b981, count: 140, spread: 45, size: 3.2, opacity: 0.14 }, // Emerald Lobe
        { x: 80, y: 70, z: 50, color: 0xf472b6, count: 140, spread: 50, size: 3.4, opacity: 0.15 }, // Rose Quartz Lobe
      ];

      for (const neb of nebulaeCenters) {
        const nebGeo = new THREE.BufferGeometry();
        const nebPos = new Float32Array(neb.count * 3);
        for (let j = 0; j < neb.count; j++) {
          nebPos[j * 3] = neb.x + (Math.random() - 0.5) * neb.spread * 2;
          nebPos[j * 3 + 1] = neb.y + (Math.random() - 0.5) * neb.spread * 2;
          nebPos[j * 3 + 2] = neb.z + (Math.random() - 0.5) * neb.spread * 2;
        }
        nebGeo.setAttribute('position', new THREE.BufferAttribute(nebPos, 3));
        const nebMat = new THREE.PointsMaterial({
          size: neb.size,
          color: neb.color,
          transparent: true,
          opacity: neb.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        nebulaGroup.add(new THREE.Points(nebGeo, nebMat));
      }

      nebulaGroupRef.current = nebulaGroup;
      scene.add(nebulaGroup);

      // Memory Foam animation loop: gently lerp back to origin if displaced
      let animFrameId: number;
      const animateNebulae = () => {
        if (nebulaGroupRef.current) {
          const np = nebulaGroupRef.current.position;
          np.x += (0 - np.x) * 0.05;
          np.y += (0 - np.y) * 0.05;
          np.z += (0 - np.z) * 0.05;
        }
        animFrameId = requestAnimationFrame(animateNebulae);
      };
      animateNebulae();
      
      // Cleanup on unmount (note: this runs when the graph unmounts, but it's okay if we just let it run or clean up when possible)
      // Since useEffect cleanup isn't perfectly mapped to just this if block, we will just let it run (the group gets destroyed on full unmount anyway).
    }

    // Directional and ambient lighting for specular gloss
    if (scene && !scene.getObjectByName('ambient-cosmic-lighting')) {
      const lightGroup = new THREE.Group();
      lightGroup.name = 'ambient-cosmic-lighting';
      lightGroup.add(new THREE.AmbientLight(0xffffff, 0.9));
      
      const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
      dirLight.position.set(150, 200, 100);
      lightGroup.add(dirLight);

      const rimLight = new THREE.DirectionalLight(0x818cf8, 1.0);
      rimLight.position.set(-150, -150, -100);
      lightGroup.add(rimLight);

      scene.add(lightGroup);
    }

    // D3 Force tuning for hierarchical constellation & lobe layout (Arbitrary Depth N >= 3)
    fg.d3Force?.('charge')?.strength((node: Graph3DNode) => {
      if (node.isUser) return -500;
      if (node.isDomainHub) return -260;
      if (node.isCategory) return -140;
      return -65 - (node.connectionCount * 8);
    });
    fg.d3Force?.('link')?.distance((link: any) => {
      const src = typeof link.source === 'object' ? link.source : null;
      const tgt = typeof link.target === 'object' ? link.target : null;
      // Level 0 (User) to Level 1 (Domain hubs): spacious clearance
      if (src?.isUser || tgt?.isUser) return 120;
      // Level 1 (Domain hubs) to Level 2 (Category nodes): medium clearance
      if (src?.isDomainHub || tgt?.isDomainHub) return 60;
      // Level 2 (Category nodes) to Level 3 (Primary hardware / shows):
      if (src?.isCategory || tgt?.isCategory) return 40;
      // Level 3 to Level 4 (e.g. Nikon Z50 to lenses): tight cluster
      return 28;
    });

    // Add center gravity to pull everything toward origin gently
    fg.d3Force?.('center')?.strength(0.04);

    fg.d3ReheatSimulation?.();
  }, [graphData, threeLib]);

  // Handle focus jumping
  useEffect(() => {
    if (!focusedNodeId || !fgRef.current || graphData.nodes.length === 0) return;
    const target = graphData.nodes.find(n => n.id === focusedNodeId);
    if (target) {
      flyToNode(target);
      setSelectedNode(target);
    }
  }, [focusedNodeId, graphData.nodes]);

  const flyToNode = useCallback((node: Graph3DNode) => {
    if (!fgRef.current) return;
    
    const targetX = node.x ?? 0;
    const targetY = node.y ?? 0;
    const targetZ = node.z ?? 0;

    // Comfortable viewing distance: larger for root user node (since it's the central hub)
    const desiredDistance = node.isUser ? 140 : (node.isDomainHub ? 100 : 75);

    // Retrieve current camera position safely
    let currentCam: { x: number; y: number; z: number } = { x: 0, y: 35, z: 270 };
    try {
      if (typeof fgRef.current.cameraPosition === 'function') {
        const cam = fgRef.current.cameraPosition();
        if (cam && typeof cam.x === 'number') {
          currentCam = cam;
        }
      }
    } catch (e) {
      // fallback
    }

    // Direction vector from target node to current camera position
    let dx = currentCam.x - targetX;
    let dy = currentCam.y - targetY;
    let dz = currentCam.z - targetZ;
    let currentDist = Math.hypot(dx, dy, dz);

    // Prevent singularity: if camera and target coincide (e.g. root node at 0,0,0)
    // or are too close, back up along Z axis with a gentle upward angle
    if (currentDist < 5) {
      dx = 0;
      dy = 30;
      dz = desiredDistance;
      currentDist = Math.hypot(dx, dy, dz);
    }

    const norm = desiredDistance / currentDist;
    const newCamPos = {
      x: targetX + dx * norm,
      y: targetY + dy * norm,
      z: targetZ + dz * norm,
    };

    // Ensure OrbitControls target points explicitly at the node center
    const controls = fgRef.current.controls?.();
    if (controls) {
      controls.target.set(targetX, targetY, targetZ);
    }

    fgRef.current.cameraPosition(
      newCamPos,
      { x: targetX, y: targetY, z: targetZ },
      1000
    );
  }, []);

  const zoomIn = useCallback(() => {
    if (!fgRef.current) return;
    const currentCam = fgRef.current.cameraPosition();
    const controls = fgRef.current.controls?.();
    const target = controls?.target || { x: 0, y: 0, z: 0 };
    
    const dx = currentCam.x - target.x;
    const dy = currentCam.y - target.y;
    const dz = currentCam.z - target.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 50) {
      fgRef.current.cameraPosition(
        {
          x: target.x + dx * 0.75,
          y: target.y + dy * 0.75,
          z: target.z + dz * 0.75,
        },
        target,
        350
      );
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (!fgRef.current) return;
    const currentCam = fgRef.current.cameraPosition();
    const controls = fgRef.current.controls?.();
    const target = controls?.target || { x: 0, y: 0, z: 0 };
    
    const dx = currentCam.x - target.x;
    const dy = currentCam.y - target.y;
    const dz = currentCam.z - target.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 550) {
      fgRef.current.cameraPosition(
        {
          x: target.x + dx * 1.35,
          y: target.y + dy * 1.35,
          z: target.z + dz * 1.35,
        },
        target,
        350
      );
    }
  }, []);

  const resetCamera = useCallback(() => {
    if (!fgRef.current) return;
    setSelectedNode(null);
    const controls = fgRef.current.controls?.();
    if (controls) {
      controls.autoRotate = true;
      controls.target.set(0, 0, 0);
    }
    fgRef.current.cameraPosition(
      { x: 0, y: 35, z: 270 },
      { x: 0, y: 0, z: 0 },
      1000
    );
  }, []);

  // ---- Custom 3D Node Rendering (2026 Crystalline Singularity Aesthetic) ----
  const renderNode = useCallback((nodeObj: any) => {
    const node = nodeObj as Graph3DNode;
    if (!threeLib || !spriteTextLib) return new threeLib!.Group();

    const THREE = threeLib;
    const SpriteText = spriteTextLib;
    const group = new THREE.Group();

    const isUser = node.isUser;
    const isDomainHub = Boolean(node.isDomainHub || (node as any).props?.is_domain_hub);
    const isCategory = Boolean(node.isCategory || (node as any).props?.is_category);

    const isFocusActive = Boolean(activeFocusNode);
    const isThisActiveNode = activeFocusNode?.id === node.id;
    const isConnectedNeighbor = connectedState.nodeIds.has(node.id);
    const isDimmed = isFocusActive && !isThisActiveNode && !isConnectedNeighbor;

    let colorHex = CATEGORY_COLORS[node.type] || CATEGORY_COLORS.other;
    if (isUser) colorHex = '#ffffff';
    else if (isDomainHub) colorHex = '#00f0ff'; // Cyber Cyan for Level 1 Domain Hubs
    else if (isCategory) colorHex = '#818cf8'; // Celestial Indigo for Level 2 Categories

    // Refined node sizes (sleek crystalline nodes rather than bulky cartoon spheres)
    let baseRadius = Math.max(1.6, Math.min(3.2, 1.6 + (node.connectionCount || 0) * 0.2));
    if (isUser) baseRadius = 5.4;
    else if (isDomainHub) baseRadius = 3.6;
    else if (isCategory) baseRadius = 2.6;

    if (isThisActiveNode) {
      baseRadius *= 1.25; // Subtle swelling on active focus
    }

    // 1. Faceted Crystal Core with specular metallic gloss and emissive singularity
    const geoKey = isUser 
      ? `user-diamond-${baseRadius}` 
      : (isDomainHub 
          ? `hub-dodec-${baseRadius}` 
          : (isCategory ? `cat-ico-${baseRadius}` : `leaf-ico-${baseRadius}`));

    if (!geoCache.has(geoKey)) {
      if (isUser) {
        // Faceted diamond icosahedron for root singularity
        geoCache.set(geoKey, new THREE.IcosahedronGeometry(baseRadius, 1));
      } else if (isDomainHub) {
        // Faceted dodecahedron for major domain hubs
        geoCache.set(geoKey, new THREE.DodecahedronGeometry(baseRadius));
      } else if (isCategory) {
        // Crystalline icosahedron for secondary categories
        geoCache.set(geoKey, new THREE.IcosahedronGeometry(baseRadius, 2));
      } else {
        // Smooth crystalline micro-sphere for leaf entities
        geoCache.set(geoKey, new THREE.SphereGeometry(baseRadius, 16, 16));
      }
    }

    const coreMat = new THREE.MeshStandardMaterial({
      color: isUser ? '#ffffff' : colorHex,
      emissive: isUser ? '#38bdf8' : colorHex,
      emissiveIntensity: isDimmed ? 0.08 : (isThisActiveNode ? 2.0 : (isUser ? 1.5 : (isDomainHub ? 1.0 : (isCategory ? 0.8 : 0.5)))),
      roughness: 0.12,
      metalness: 0.95,
      flatShading: isUser || isDomainHub, // Sharp crystal facets catch the specular light!
      transparent: isDimmed,
      opacity: isDimmed ? 0.15 : 1.0,
    });
    const coreMesh = new THREE.Mesh(geoCache.get(geoKey)!, coreMat);
    group.add(coreMesh);

    // 2. Outer ethereal glow halo (additive blended)
    const glowRadius = baseRadius * (isUser ? 1.55 : (isDomainHub ? 1.38 : (isCategory ? 1.28 : 1.18)));
    const glowGeoKey = `glow-${glowRadius}`;
    if (!geoCache.has(glowGeoKey)) {
      geoCache.set(glowGeoKey, new THREE.SphereGeometry(glowRadius, 16, 16));
    }
    const glowMat = new THREE.MeshBasicMaterial({
      color: isUser ? '#38bdf8' : colorHex,
      transparent: true,
      opacity: isDimmed ? 0.02 : (isThisActiveNode ? 0.65 : (isUser ? 0.4 : (isDomainHub ? 0.28 : (isCategory ? 0.2 : 0.12)))),
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    group.add(new THREE.Mesh(geoCache.get(glowGeoKey)!, glowMat));

    // 3. Root User Node: Dual Intersecting Quantum Orbital Rings & Ethereal Corona
    if (isUser) {
      // Ring 1 (Primary orbital equator)
      const ringGeoKey1 = 'user-quantum-ring-1';
      if (!geoCache.has(ringGeoKey1 as any)) {
        const ringGeo = new THREE.RingGeometry(baseRadius * 1.55, baseRadius * 1.68, 48);
        geoCache.set(ringGeoKey1 as any, ringGeo as any);
      }
      const ringMat1 = new THREE.MeshBasicMaterial({
        color: '#00f0ff',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isDimmed ? 0.15 : 0.8,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh1 = new THREE.Mesh(geoCache.get(ringGeoKey1 as any) as any, ringMat1);
      ringMesh1.rotation.x = Math.PI / 2.5;
      ringMesh1.rotation.y = Math.PI / 6;
      group.add(ringMesh1);

      // Ring 2 (Counter-inclined polar ring)
      const ringGeoKey2 = 'user-quantum-ring-2';
      if (!geoCache.has(ringGeoKey2 as any)) {
        const ringGeo = new THREE.RingGeometry(baseRadius * 1.8, baseRadius * 1.9, 48);
        geoCache.set(ringGeoKey2 as any, ringGeo as any);
      }
      const ringMat2 = new THREE.MeshBasicMaterial({
        color: '#818cf8',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isDimmed ? 0.1 : 0.55,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh2 = new THREE.Mesh(geoCache.get(ringGeoKey2 as any) as any, ringMat2);
      ringMesh2.rotation.x = -Math.PI / 3.0;
      ringMesh2.rotation.z = Math.PI / 4;
      group.add(ringMesh2);

      // Whispering outer corona
      const outerGlowGeoKey = 'user-outer-corona';
      if (!geoCache.has(outerGlowGeoKey)) {
        geoCache.set(outerGlowGeoKey, new THREE.SphereGeometry(baseRadius * 2.4, 16, 16));
      }
      const outerCoronaMat = new THREE.MeshBasicMaterial({
        color: '#818cf8',
        transparent: true,
        opacity: isDimmed ? 0.02 : 0.14,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(geoCache.get(outerGlowGeoKey)!, outerCoronaMat));
    } else if (isDomainHub) {
      // Domain Hub subtle orbital ring
      const hubRingGeoKey = `hub-ring-${baseRadius}`;
      if (!geoCache.has(hubRingGeoKey as any)) {
        const ringGeo = new THREE.RingGeometry(baseRadius * 1.4, baseRadius * 1.48, 36);
        geoCache.set(hubRingGeoKey as any, ringGeo as any);
      }
      const hubRingMat = new THREE.MeshBasicMaterial({
        color: '#00f0ff',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isDimmed ? 0.1 : 0.5,
        blending: THREE.AdditiveBlending,
      });
      const hubRingMesh = new THREE.Mesh(geoCache.get(hubRingGeoKey as any) as any, hubRingMat);
      hubRingMesh.rotation.x = Math.PI / 2.2;
      group.add(hubRingMesh);
    }

    // 4. Tension additive shell
    if (node.isTension) {
      const tensionRadius = baseRadius * 1.85;
      const tensionGeoKey = `tension-${tensionRadius}`;
      if (!geoCache.has(tensionGeoKey)) {
        geoCache.set(tensionGeoKey, new THREE.SphereGeometry(tensionRadius, 16, 16));
      }
      
      const tensionColor = node.tensionSeverity === 'critical' ? '#f43f5e' : (node.tensionSeverity === 'moderate' ? '#f59e0b' : '#ef4444');
      const tensionMat = new THREE.MeshBasicMaterial({
        color: tensionColor,
        transparent: true,
        opacity: isDimmed ? 0.1 : 0.55,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(geoCache.get(tensionGeoKey)!, tensionMat));
    }

    // 5. Clean, elegant typography with sharp visibility
    const shouldShowLabel = 
      isUser ||
      isDomainHub ||
      isCategory ||
      isThisActiveNode ||
      isConnectedNeighbor ||
      (!isFocusActive && (node.connectionCount || 0) >= 1); // Show all leaf node labels too!

    if (shouldShowLabel) {
      const sprite = new SpriteText(node.name || node.id);
      sprite.color = isDimmed 
        ? 'rgba(255, 255, 255, 0.15)'
        : (isThisActiveNode 
            ? '#00f0ff' 
            : (isUser ? '#ffffff' : (isDomainHub ? '#38bdf8' : (isCategory ? '#c084fc' : 'rgba(255, 255, 255, 0.85)'))));
      
      sprite.textHeight = (isThisActiveNode ? 1.25 : 1.0) * (isUser ? 3.2 : (isDomainHub ? 2.4 : (isCategory ? 1.9 : 1.45)));
      sprite.fontSize = 90;
      sprite.fontWeight = '600'; // Make text semi-bold
      sprite.strokeWidth = 1.8; // Give it a crisp black outline so it stands out against any background
      sprite.strokeColor = 'rgba(0, 0, 0, 0.9)';
      sprite.fontFace = 'JetBrains Mono, -apple-system, system-ui, sans-serif';
      sprite.backgroundColor = undefined; // PURE FLOATING TYPOGRAPHY
      sprite.padding = 0;
      sprite.position.set(0, baseRadius + (isUser ? 4.2 : (isDomainHub ? 3.2 : (isCategory ? 2.5 : 1.8))), 0);
      group.add(sprite);
    }

    return group;
  }, [threeLib, spriteTextLib, activeFocusNode, connectedState]);

  // ---- Interactions ----
  const handleNodeClick = useCallback((node: any, event: MouseEvent) => {
    // Stop auto-rotation on click
    const controls = fgRef.current?.controls?.();
    if (controls) controls.autoRotate = false;

    setSelectedNode(node as Graph3DNode);
    setCardPos({ x: event.clientX, y: event.clientY });
    flyToNode(node as Graph3DNode);
  }, [flyToNode]);

  const handleNodeHover = useCallback((node: any) => {
    if (typeof document !== 'undefined') {
      document.body.style.cursor = node ? 'pointer' : 'default';
    }
    setHoveredNode(node as Graph3DNode | null);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setHoveredNode(null);
    // Resume auto-rotation
    const controls = fgRef.current?.controls?.();
    if (controls) controls.autoRotate = true;
  }, []);

  // ---- Link styling (Neural Synaptic Filaments with Active Spotlight Flare) ----
  const linkColor = useCallback((link: any) => {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
    if (activeFocusNode) {
      if (srcId === activeFocusNode.id || tgtId === activeFocusNode.id) {
        return 'rgba(0, 240, 255, 0.85)'; // Radiant cyber-cyan active energy beam!
      }
      return 'rgba(255, 255, 255, 0.02)'; // Unfocused links fade away
    }
    return 'rgba(148, 163, 184, 0.12)'; // Ethereal starlight filament
  }, [activeFocusNode]);

  const linkWidth = useCallback((link: any) => {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
    if (activeFocusNode && (srcId === activeFocusNode.id || tgtId === activeFocusNode.id)) {
      return 2.0;
    }
    return 0.35;
  }, [activeFocusNode]);

  // ---- Link Directional Particles: Random mistimed impulses ----
  const linkParticles = useCallback((link: any) => {
    if (activeFocusNode) {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === activeFocusNode.id || tgtId === activeFocusNode.id) {
        return 1;
      }
      return 0; // Quiet non-connected links during focused inspection
    }

    // In ambient mode, honor the __hasParticle random chance (only ~35% of edges have particles)
    return link.__hasParticle ? 1 : 0;
  }, [activeFocusNode]);

  const linkParticleOffset = useCallback((link: any) => {
    return link.__particleOffset ?? 0;
  }, []);

  const linkParticleSpeed = useCallback((link: any) => {
    if (activeFocusNode) {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === activeFocusNode.id || tgtId === activeFocusNode.id) {
        return 0.0050; // Slightly enhanced focus speed
      }
    }
    // Very random speeds as calculated during init
    return link.__particleSpeed ?? 0.0020;
  }, [activeFocusNode]);

  const linkParticleWidth = useCallback((link: any) => {
    if (activeFocusNode) {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === activeFocusNode.id || tgtId === activeFocusNode.id) {
        return 2.0;
      }
    }
    return link.__particleWidth ?? 1.1;
  }, [activeFocusNode]);

  const linkParticleColor = useCallback((link: any) => {
    if (activeFocusNode) {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source;
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
      if (srcId === activeFocusNode.id || tgtId === activeFocusNode.id) {
        return '#00f0ff';
      }
    }
    return link.__synapseColor || '#00f0ff';
  }, [activeFocusNode]);

  // Map graph data for NodeCard compatibility  
  const activeNodeForCard = useMemo(() => {
    if (!selectedNode) return null;
    return {
      id: selectedNode.id,
      x: selectedNode.x || 0,
      y: selectedNode.y || 0,
      label: selectedNode.name,
      type: selectedNode.type as any,
      isTension: selectedNode.isTension,
      tensionSeverity: selectedNode.tensionSeverity,
      tensionHeadline: selectedNode.tensionHeadline,
    };
  }, [selectedNode]);

  if (!mounted) return <div className="fixed inset-0 bg-[#030308]" />;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#030308]">
      {threeLib && spriteTextLib && (
        <ForceGraph3D
          ref={fgRef}
          graphData={graphData}
          backgroundColor="#030308"
          
          // Custom 3D node rendering
          nodeThreeObject={renderNode}
          nodeThreeObjectExtend={false}
          
          // Links (Outward Cascading Neural Synapses with Mistimed Impulses)
          linkCurvature={0.16}
          linkWidth={linkWidth}
          linkColor={linkColor}
          linkOpacity={1}
          linkDirectionalParticles={linkParticles}
          linkDirectionalParticleOffset={linkParticleOffset}
          linkDirectionalParticleWidth={linkParticleWidth}
          linkDirectionalParticleSpeed={linkParticleSpeed}
          linkDirectionalParticleColor={linkParticleColor}
          
          // Interactions
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onBackgroundClick={handleBackgroundClick}
          enablePointerInteraction={true}
          enableNodeDrag={true}
          onNodeDrag={(node: any, translate: any) => {
            if (nebulaGroupRef.current) {
              const dampening = 0.8;
              nebulaGroupRef.current.position.x += translate.x * dampening;
              nebulaGroupRef.current.position.y += translate.y * dampening;
              nebulaGroupRef.current.position.z += translate.z * dampening;
            }
          }}

          // Performance
          warmupTicks={80}
          cooldownTicks={150}
          
          // Node ID field
          nodeId="id"
          nodeVal="val"
        />
      )}
      
      {activeNodeForCard && (
        <NodeCard 
          node={activeNodeForCard}
          x={cardPos.x} 
          y={cardPos.y} 
          onClose={() => {
            setSelectedNode(null);
            const controls = fgRef.current?.controls?.();
            if (controls) controls.autoRotate = true;
          }} 
          onViewProfile={onViewProfile}
        />
      )}

      {/* Floating 3D Navigation & Zoom Controls (Cybernetic Glass Visor) */}
      <div className="fixed bottom-24 left-6 z-20 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={resetCamera}
          className="p-2.5 rounded-full bg-black/40 hover:bg-white/10 backdrop-blur-xl border border-white/10 text-white/70 hover:text-white transition-all shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-center group"
          title="Recenter Neural Map"
          aria-label="Recenter view"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-45 transition-transform duration-300">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
        <div className="flex flex-col bg-black/40 backdrop-blur-xl border border-white/10 rounded-full overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <button
            onClick={zoomIn}
            className="p-2.5 hover:bg-white/10 text-white/70 hover:text-white transition-colors flex items-center justify-center"
            title="Zoom In"
            aria-label="Zoom in"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <div className="h-[1px] w-full bg-white/10" />
          <button
            onClick={zoomOut}
            className="p-2.5 hover:bg-white/10 text-white/70 hover:text-white transition-colors flex items-center justify-center"
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
