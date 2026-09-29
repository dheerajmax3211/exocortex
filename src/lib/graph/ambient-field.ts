import { randomPointInBrain } from './brain-silhouette';

export interface AmbientPoint {
  x: number;
  y: number;
  alpha: number;
  size: number;
  pulsePhase: number;
  pulseSpeed: number;
}

export function generateAmbientField(count: number, cx: number, cy: number, radius: number): AmbientPoint[] {
  const points: AmbientPoint[] = [];
  for (let i = 0; i < count; i++) {
    const pt = randomPointInBrain(cx, cy, radius);
    points.push({
      x: pt.x,
      y: pt.y,
      alpha: 0.15 + Math.random() * 0.15,
      size: 0.5 + Math.random() * 1.5,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.5 + Math.random() * 2,
    });
  }
  return points;
}
