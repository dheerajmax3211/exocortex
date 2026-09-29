export class Camera {
  scale: number = 1;
  offsetX: number = 0;
  offsetY: number = 0;
  viewportWidth: number = 1000;
  viewportHeight: number = 1000;

  worldToScreen(wx: number, wy: number) {
    return {
      x: wx * this.scale + this.offsetX,
      y: wy * this.scale + this.offsetY,
    };
  }

  screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale,
    };
  }

  coverFit(worldWidth: number, worldHeight: number, viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.scale = Math.max(viewportWidth / worldWidth, viewportHeight / worldHeight) * 1.3;
    
    this.offsetX = viewportWidth / 2;
    this.offsetY = viewportHeight / 2;
  }

  pan(dx: number, dy: number) {
    this.offsetX += dx;
    this.offsetY += dy;
  }

  zoom(factor: number, cx: number, cy: number) {
    const minScale = 0.1;
    const maxScale = 10.0;
    
    const newScale = Math.max(minScale, Math.min(maxScale, this.scale * factor));
    const actualFactor = newScale / this.scale;
    
    this.scale = newScale;
    this.offsetX = cx - (cx - this.offsetX) * actualFactor;
    this.offsetY = cy - (cy - this.offsetY) * actualFactor;
  }

  isVisible(wx: number, wy: number, margin: number = 0) {
    const screen = this.worldToScreen(wx, wy);
    return screen.x >= -margin && screen.x <= this.viewportWidth + margin &&
           screen.y >= -margin && screen.y <= this.viewportHeight + margin;
  }
}
