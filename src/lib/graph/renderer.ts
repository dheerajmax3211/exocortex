/**
 * Legacy graph type exports - kept for backward compatibility with NodeCard and other components.
 * The 3D graph no longer uses the 2D renderer, but these types are still referenced.
 */

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

export interface ClusterHalo {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  color?: string;
}

export const CATEGORY_COLORS: Record<string, string> = {
  person: '#6366f1',
  place: '#22c55e',
  restaurant: '#f59e0b',
  dish: '#ef4444',
  movie: '#8b5cf6',
  show: '#a855f7',
  book: '#eab308',
  event: '#06b6d4',
  period: '#ec4899',
  school: '#14b8a6',
  org: '#3b82f6',
  item: '#f97316',
  other: '#94a3b8',
};
