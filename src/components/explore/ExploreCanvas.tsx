'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera } from '@/lib/graph/camera';
import { generateAmbientField, AmbientPoint } from '@/lib/graph/ambient-field';
import { renderFrame, GraphNode, GraphEdge } from '@/lib/graph/renderer';
import { InteractionManager } from '@/lib/graph/interactions';
import NodeCard from './NodeCard';

export default function ExploreCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  
  const cameraRef = useRef(new Camera());
  const ambientRef = useRef<AmbientPoint[]>([]);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const interactionRef = useRef<InteractionManager | null>(null);
  const hoverRef = useRef<string | null>(null);
  const selectRef = useRef<string | null>(null);

  useEffect(() => {
    hoverRef.current = hoveredNode;
  }, [hoveredNode]);

  useEffect(() => {
    selectRef.current = selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    ambientRef.current = generateAmbientField(3000, 0, 0, 1000);
    
    const fetchGraph = async () => {
      try {
        const res = await fetch('/api/graph');
        const data = await res.json();
        
        const fetchedNodes = data.nodes || [];
        const fetchedEdges = data.edges || [];
        
        setNodes(fetchedNodes);
        nodesRef.current = fetchedNodes;
        edgesRef.current = fetchedEdges;
        
        // Ensure camera cover-fit after nodes load if possible
        if (canvasRef.current) {
          const width = window.visualViewport?.width || window.innerWidth;
          const height = window.visualViewport?.height || window.innerHeight;
          cameraRef.current.coverFit(2000, 2000, width, height);
        }
      } catch (err) {
        console.error('Failed to load graph:', err);
      }
    };
    
    fetchGraph();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    interactionRef.current = new InteractionManager(canvas, cameraRef.current, nodesRef.current);
    
    interactionRef.current.onHover = (id) => {
      setHoveredNode(id);
    };

    interactionRef.current.onTap = (id, clientX, clientY) => {
      setSelectedNode(id);
      if (id) {
        setCardPos({ x: clientX, y: clientY });
      }
    };

    const handleResize = () => {
      if (!canvas || !containerRef.current) return;
      const width = window.visualViewport?.width || window.innerWidth;
      const height = window.visualViewport?.height || window.innerHeight;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      cameraRef.current.coverFit(2000, 2000, width, height);
    };

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    handleResize();

    let animationId: number;
    const loop = (time: number) => {
      renderFrame(
        ctx,
        cameraRef.current,
        ambientRef.current,
        nodesRef.current,
        edgesRef.current,
        hoverRef.current,
        selectRef.current,
        time
      );
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      interactionRef.current?.cleanup();
    };
  }, []);

  useEffect(() => {
    if (interactionRef.current) {
      interactionRef.current.updateNodes(nodes);
    }
  }, [nodes]);

  const activeNode = nodes.find(n => n.id === selectedNode) || nodes.find(n => n.id === hoveredNode);

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden bg-[#0a0a0f]">
      <canvas
        ref={canvasRef}
        className="block touch-none"
      />
      
      {activeNode && (
        <NodeCard 
          node={activeNode} 
          x={cardPos.x} 
          y={cardPos.y} 
          onClose={() => setSelectedNode(null)} 
        />
      )}
    </div>
  );
}
