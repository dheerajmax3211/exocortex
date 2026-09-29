export function generateBrainBoundary(cx: number, cy: number, radius: number, numPoints: number = 100): {x: number, y: number}[] {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const lobeRadius = radius * (0.8 + 0.2 * Math.sin(angle * 2) + 0.1 * Math.cos(angle * 3) + 0.15 * Math.sin(angle * 5));
    points.push({
      x: cx + Math.cos(angle) * lobeRadius,
      y: cy + Math.sin(angle) * lobeRadius * 1.2,
    });
  }
  return points;
}

export function isInsideBrain(x: number, y: number, cx: number, cy: number, radius: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  const normalizedY = dy / 1.2;
  const angle = Math.atan2(normalizedY, dx);
  const normalizedDist = Math.sqrt(dx*dx + normalizedY*normalizedY);
  
  const expectedRadius = radius * (0.8 + 0.2 * Math.sin(angle * 2) + 0.1 * Math.cos(angle * 3) + 0.15 * Math.sin(angle * 5));
  return normalizedDist <= expectedRadius;
}

export function randomPointInBrain(cx: number, cy: number, radius: number): {x: number, y: number} {
  let x, y;
  do {
    x = cx + (Math.random() * 2 - 1) * radius * 1.5;
    y = cy + (Math.random() * 2 - 1) * radius * 1.5 * 1.2;
  } while (!isInsideBrain(x, y, cx, cy, radius));
  return { x, y };
}
