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
const geoCache = new Map<string, SphereGeometry>();

export default function ExploreCanvas({ onViewProfile, focusedNodeId }: ExploreCanvasProps) {
  const fgRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<{ nodes: Graph3DNode[]; links: Graph3DLink[] }>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<Graph3DNode | null>(null);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const [threeLib, setThreeLib] = useState<typeof import('three') | null>(null);
  const [spriteTextLib, setSpriteTextLib] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

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

  // Fetch graph data
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await fetch('/api/graph');
        const data = await res.json();
        if (data.nodes && data.links) {
          setGraphData({ nodes: data.nodes, links: data.links });
        } else if (data.nodes && data.edges) {
          // Backward compat with old API format
          setGraphData({ nodes: data.nodes, links: data.edges });
        }
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

    // Add ambient cosmic starfield to Three.js scene for depth & parallax
    const scene = fg.scene?.();
    if (scene && !scene.getObjectByName('ambient-cosmic-starfield')) {
      const starCount = 1000;
      const starGeometry = new THREE.BufferGeometry();
      const starPositions = new Float32Array(starCount * 3);
      const starColors = new Float32Array(starCount * 3);

      for (let i = 0; i < starCount; i++) {
        const r = 220 + Math.random() * 480;
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
    }

    // Directional and ambient lighting for specular gloss
    if (scene && !scene.getObjectByName('ambient-cosmic-lighting')) {
      const lightGroup = new THREE.Group();
      lightGroup.name = 'ambient-cosmic-lighting';
      lightGroup.add(new THREE.AmbientLight(0xffffff, 0.9));
      
      const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
      dirLight.position.set(150, 200, 100);
      lightGroup.add(dirLight);

      const rimLight = new THREE.DirectionalLight(0x818cf8, 0.8);
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

    let colorHex = CATEGORY_COLORS[node.type] || CATEGORY_COLORS.other;
    if (isUser) colorHex = '#ffffff';
    else if (isDomainHub) colorHex = '#00f0ff'; // Cyber Cyan for Level 1 Domain Hubs
    else if (isCategory) colorHex = '#818cf8'; // Celestial Indigo for Level 2 Categories

    // Refined node sizes (sleek crystalline nodes rather than bulky cartoon spheres)
    let baseRadius = Math.max(1.7, Math.min(3.4, 1.7 + (node.connectionCount || 0) * 0.22));
    if (isUser) baseRadius = 5.6;
    else if (isDomainHub) baseRadius = 3.8;
    else if (isCategory) baseRadius = 2.8;

    // 1. Core sphere with specular gloss and emissive singularity
    const coreGeoKey = `core-${baseRadius}`;
    if (!geoCache.has(coreGeoKey)) {
      geoCache.set(coreGeoKey, new THREE.SphereGeometry(baseRadius, (isUser || isDomainHub || isCategory) ? 32 : 18, (isUser || isDomainHub || isCategory) ? 32 : 18));
    }
    const coreMat = new THREE.MeshStandardMaterial({
      color: isUser ? '#ffffff' : colorHex,
      emissive: isUser ? '#38bdf8' : colorHex,
      emissiveIntensity: isUser ? 1.4 : (isDomainHub ? 0.95 : (isCategory ? 0.75 : 0.45)),
      roughness: 0.1,
      metalness: 0.92,
    });
    const coreMesh = new THREE.Mesh(geoCache.get(coreGeoKey)!, coreMat);
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
      opacity: isUser ? 0.38 : (isDomainHub ? 0.26 : (isCategory ? 0.18 : 0.1)),
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    group.add(new THREE.Mesh(geoCache.get(glowGeoKey)!, glowMat));

    // 3. Root User Node: Quantum Orbital Ring & Ethereal Corona
    if (isUser) {
      const ringGeoKey = 'user-quantum-ring';
      if (!geoCache.has(ringGeoKey as any)) {
        const ringGeo = new THREE.RingGeometry(baseRadius * 1.6, baseRadius * 1.7, 48);
        geoCache.set(ringGeoKey as any, ringGeo as any);
      }
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
      });
      const ringMesh = new THREE.Mesh(geoCache.get(ringGeoKey as any) as any, ringMat);
      ringMesh.rotation.x = Math.PI / 2.6;
      group.add(ringMesh);

      // Whispering outer corona
      const outerGlowGeoKey = 'user-outer-corona';
      if (!geoCache.has(outerGlowGeoKey)) {
        geoCache.set(outerGlowGeoKey, new THREE.SphereGeometry(baseRadius * 2.3, 16, 16));
      }
      const outerGlowMat = new THREE.MeshBasicMaterial({
        color: '#818cf8',
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(geoCache.get(outerGlowGeoKey)!, outerGlowMat));
    }

    // 4. Tension additive shell
    if (node.isTension) {
      const tensionRadius = baseRadius * 1.8;
      const tensionGeoKey = `tension-${tensionRadius}`;
      if (!geoCache.has(tensionGeoKey)) {
        geoCache.set(tensionGeoKey, new THREE.SphereGeometry(tensionRadius, 16, 16));
      }
      
      const tensionColor = node.tensionSeverity === 'critical' ? '#f43f5e' : (node.tensionSeverity === 'moderate' ? '#f59e0b' : '#ef4444');
      const tensionMat = new THREE.MeshBasicMaterial({
        color: tensionColor,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(geoCache.get(tensionGeoKey)!, tensionMat));
    }

    // 5. Clean, elegant typography (NO CLUNKY BOXES!)
    const sprite = new SpriteText(node.name || node.id);
    sprite.color = isUser ? '#ffffff' : (isDomainHub ? '#38bdf8' : (isCategory ? '#c084fc' : 'rgba(255, 255, 255, 0.85)'));
    sprite.textHeight = isUser ? 3.2 : (isDomainHub ? 2.4 : (isCategory ? 1.9 : 1.5));
    sprite.fontSize = 80;
    sprite.fontFace = 'JetBrains Mono, -apple-system, system-ui, sans-serif';
    sprite.backgroundColor = undefined; // PURE FLOATING TYPOGRAPHY - NO DARK BOX!
    sprite.padding = 0;
    sprite.position.set(0, baseRadius + (isUser ? 4.0 : (isDomainHub ? 3.0 : (isCategory ? 2.4 : 1.8))), 0);
    group.add(sprite);

    return group;
  }, [threeLib, spriteTextLib]);

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
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    // Resume auto-rotation
    const controls = fgRef.current?.controls?.();
    if (controls) controls.autoRotate = true;
  }, []);

  // ---- Link styling (Neural Synaptic Filaments) ----
  const linkColor = useCallback((link: any) => {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
    if (selectedNode && (srcId === selectedNode.id || tgtId === selectedNode.id)) {
      return 'rgba(56, 189, 248, 0.85)'; // Radiant cyber-cyan active energy beam
    }
    return 'rgba(148, 163, 184, 0.12)'; // Ethereal starlight filament
  }, [selectedNode]);

  const linkWidth = useCallback((link: any) => {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
    if (selectedNode && (srcId === selectedNode.id || tgtId === selectedNode.id)) return 1.8;
    return 0.4;
  }, [selectedNode]);

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
          
          // Links (Neural Synapses)
          linkCurvature={0.12}
          linkWidth={linkWidth}
          linkColor={linkColor}
          linkOpacity={1}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={1.4}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleColor={() => '#38bdf8'}
          
          // Interactions
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onBackgroundClick={handleBackgroundClick}
          enablePointerInteraction={true}
          enableNodeDrag={true}

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
