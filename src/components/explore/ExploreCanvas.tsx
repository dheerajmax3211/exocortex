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

// ---- Category Colors ----
const CATEGORY_COLORS: Record<string, string> = {
  person:     '#6366f1',
  place:      '#22c55e',
  restaurant: '#f59e0b',
  dish:       '#ef4444',
  movie:      '#8b5cf6',
  show:       '#a855f7',
  book:       '#eab308',
  event:      '#06b6d4',
  period:     '#ec4899',
  school:     '#14b8a6',
  org:        '#3b82f6',
  item:       '#f97316',
  other:      '#94a3b8',
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

  // Configure physics and controls after graph mounts
  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return;

    const fg = fgRef.current;

    // OrbitControls
    const controls = fg.controls?.();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableDamping = true;
      controls.dampingFactor = 0.12;
      controls.minDistance = 40;
      controls.maxDistance = 600;
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
  }, [graphData]);

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

  // ---- Custom 3D Node Rendering ----
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
    if (isDomainHub) colorHex = '#06b6d4'; // Cyan for Level 1 Domain Hubs
    else if (isCategory) colorHex = '#a855f7'; // Violet for Level 2 Categories

    let baseRadius = Math.max(2.4, Math.min(4.8, 2.3 + (node.connectionCount || 0) * 0.3));
    if (isUser) baseRadius = 7.0;
    else if (isDomainHub) baseRadius = 5.2;
    else if (isCategory) baseRadius = 4.0;

    // 1. Core sphere with emissive glow
    const coreGeoKey = `core-${baseRadius}`;
    if (!geoCache.has(coreGeoKey)) {
      geoCache.set(coreGeoKey, new THREE.SphereGeometry(baseRadius, (isUser || isDomainHub || isCategory) ? 32 : 20, (isUser || isDomainHub || isCategory) ? 32 : 20));
    }
    const coreMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: isUser ? 0.9 : (isDomainHub ? 0.75 : (isCategory ? 0.6 : 0.45)),
      roughness: 0.15,
      metalness: 0.85,
    });
    const coreMesh = new THREE.Mesh(geoCache.get(coreGeoKey)!, coreMat);
    group.add(coreMesh);

    // 2. Outer glow halo (additive blended, slightly larger)
    const glowRadius = baseRadius * (isUser ? 1.6 : (isDomainHub ? 1.45 : (isCategory ? 1.35 : 1.25)));
    const glowGeoKey = `glow-${glowRadius}`;
    if (!geoCache.has(glowGeoKey)) {
      geoCache.set(glowGeoKey, new THREE.SphereGeometry(glowRadius, 16, 16));
    }
    const glowMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: isUser ? 0.22 : (isDomainHub ? 0.2 : (isCategory ? 0.16 : 0.1)),
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const glowMesh = new THREE.Mesh(geoCache.get(glowGeoKey)!, glowMat);
    group.add(glowMesh);

    // 3. Second, larger glow layer for user node or domain hubs
    if (isUser || isDomainHub) {
      const outerGlowRadius = baseRadius * (isUser ? 2.2 : 1.9);
      const outerGeoKey = `outerGlow-${outerGlowRadius}`;
      if (!geoCache.has(outerGeoKey)) {
        geoCache.set(outerGeoKey, new THREE.SphereGeometry(outerGlowRadius, 12, 12));
      }
      const outerGlowMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: isUser ? 0.08 : 0.05,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      group.add(new THREE.Mesh(geoCache.get(outerGeoKey)!, outerGlowMat));
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
      
      const tensionMesh = new THREE.Mesh(geoCache.get(tensionGeoKey)!, tensionMat);
      
      // Simple static shell (ideally this would pulse in an animation loop)
      group.add(tensionMesh);
    }

    // 5. Text label (camera-facing sprite)
    const sprite = new SpriteText(node.name || node.id);
    sprite.color = isDomainHub ? '#38bdf8' : (isCategory ? '#c084fc' : '#ffffff');
    sprite.textHeight = isUser ? 4 : (isDomainHub ? 3.2 : (isCategory ? 2.7 : 2.2));
    sprite.fontSize = 90;
    sprite.fontFace = 'Inter, system-ui, sans-serif';
    sprite.backgroundColor = 'rgba(10, 10, 15, 0.75)';
    sprite.padding = 1.5;
    sprite.borderRadius = 3;
    sprite.position.set(0, baseRadius + (isUser ? 5 : (isDomainHub ? 4 : (isCategory ? 3.5 : 3.0))), 0);
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

  // ---- Link styling ----
  const linkColor = useCallback((link: any) => {
    if (!selectedNode) return 'rgba(255, 255, 255, 0.08)';
    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
    if (srcId === selectedNode.id || tgtId === selectedNode.id) {
      return 'rgba(99, 102, 241, 0.6)';
    }
    return 'rgba(255, 255, 255, 0.04)';
  }, [selectedNode]);

  const linkWidth = useCallback((link: any) => {
    if (!selectedNode) return 0.5;
    const srcId = typeof link.source === 'object' ? link.source.id : link.source;
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
    if (srcId === selectedNode.id || tgtId === selectedNode.id) return 2;
    return 0.3;
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

  if (!mounted) return <div className="fixed inset-0 bg-[#0a0a0f]" />;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0f]">
      {threeLib && spriteTextLib && (
        <ForceGraph3D
          ref={fgRef}
          graphData={graphData}
          backgroundColor="#0a0a0f"
          
          // Custom 3D node rendering
          nodeThreeObject={renderNode}
          nodeThreeObjectExtend={false}
          
          // Links
          linkCurvature={0.15}
          linkWidth={linkWidth}
          linkColor={linkColor}
          linkOpacity={1}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={1.2}
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleColor={() => '#6366f1'}
          
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

      {/* Floating 3D Navigation & Zoom Controls */}
      <div className="fixed bottom-24 left-5 z-20 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={resetCamera}
          className="p-2.5 rounded-xl bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-all shadow-lg flex items-center gap-1.5 text-xs font-mono"
          title="Recenter Galaxy View"
          aria-label="Recenter view"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span className="hidden sm:inline">Recenter</span>
        </button>
        <div className="flex bg-black/60 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-lg">
          <button
            onClick={zoomIn}
            className="p-2.5 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            title="Zoom In"
            aria-label="Zoom in"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <div className="w-[1px] bg-white/10" />
          <button
            onClick={zoomOut}
            className="p-2.5 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
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
