import { Camera } from './camera';
import { AmbientPoint } from './ambient-field';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label: string;
  type: 'person' | 'place' | 'restaurant' | 'dish' | 'movie' | 'event' | 'period' | 'other';
}

export interface GraphEdge {
  source: string;
  target: string;
}

const CATEGORY_COLORS: Record<GraphNode['type'], string> = {
  person: '#6366f1',
  place: '#22c55e',
  restaurant: '#f59e0b',
  dish: '#ef4444',
  movie: '#8b5cf6',
  event: '#06b6d4',
  period: '#ec4899',
  other: '#94a3b8',
};

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  ambientField: AmbientPoint[],
  realNodes: GraphNode[],
  realEdges: GraphEdge[],
  hoveredNodeId: string | null,
  selectedNodeId: string | null,
  frameTime: number
) {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  for (const point of ambientField) {
    if (!camera.isVisible(point.x, point.y, 10)) continue;
    const screenPos = camera.worldToScreen(point.x, point.y);
    const alphaPulse = point.alpha + Math.sin(frameTime / 1000 * point.pulseSpeed + point.pulsePhase) * 0.1;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, alphaPulse))})`;
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, point.size * camera.scale * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const nodeMap = new Map(realNodes.map(n => [n.id, n]));

  ctx.save();
  ctx.lineWidth = 1;
  for (const edge of realEdges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    if (!camera.isVisible(source.x, source.y, 50) && !camera.isVisible(target.x, target.y, 50)) continue;

    const sPos = camera.worldToScreen(source.x, source.y);
    const tPos = camera.worldToScreen(target.x, target.y);

    const isHovered = hoveredNodeId === source.id || hoveredNodeId === target.id;
    const isSelected = selectedNodeId === source.id || selectedNodeId === target.id;

    if (isHovered || isSelected) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
    }

    ctx.beginPath();
    ctx.moveTo(sPos.x, sPos.y);
    ctx.lineTo(tPos.x, tPos.y);
    ctx.stroke();
  }
  ctx.restore();

  const zoomThreshold = 1.5;
  const showLabelsGlobally = camera.scale > zoomThreshold;

  ctx.save();
  for (const node of realNodes) {
    if (!camera.isVisible(node.x, node.y, 20)) continue;

    const screenPos = camera.worldToScreen(node.x, node.y);
    const isHovered = hoveredNodeId === node.id;
    const isSelected = selectedNodeId === node.id;
    const color = CATEGORY_COLORS[node.type] || CATEGORY_COLORS.other;

    ctx.shadowBlur = isHovered || isSelected ? 20 : 10;
    ctx.shadowColor = color;

    ctx.fillStyle = color;
    ctx.beginPath();
    const radius = isHovered || isSelected ? 6 : 4;
    ctx.arc(screenPos.x, screenPos.y, radius * Math.max(0.5, Math.min(2, camera.scale)), 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    if (showLabelsGlobally || isHovered || isSelected) {
      ctx.fillStyle = isHovered || isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
      ctx.font = `${isHovered || isSelected ? 'bold' : ''} ${12 * Math.max(0.8, Math.min(1.5, camera.scale))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.label, screenPos.x, screenPos.y + radius * camera.scale + 4);
    }
  }
  ctx.restore();
}
