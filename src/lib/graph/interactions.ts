import { Camera } from './camera';
import { GraphNode } from './renderer';

export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private nodes: GraphNode[];
  
  private isDragging: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  
  private initialPinchDist: number = 0;
  private initialScale: number = 1;
  private touchDownTime: number = 0;

  public onHover: (nodeId: string | null) => void = () => {};
  public onTap: (nodeId: string | null, clientX: number, clientY: number) => void = () => {};
  
  constructor(canvas: HTMLCanvasElement, camera: Camera, nodes: GraphNode[]) {
    this.canvas = canvas;
    this.camera = camera;
    this.nodes = nodes;
    this.setupListeners();
  }

  public updateNodes(nodes: GraphNode[]) {
    this.nodes = nodes;
  }

  private setupListeners() {
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });

    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd);
  }

  public cleanup() {
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('wheel', this.onWheel);

    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
  }

  private findNodeAt(sx: number, sy: number): string | null {
    const wx = this.camera.screenToWorld(sx, sy).x;
    const wy = this.camera.screenToWorld(sx, sy).y;
    
    const searchRadiusScreen = 15;
    const searchRadiusWorld = searchRadiusScreen / this.camera.scale;

    let closest = null;
    let minDist = searchRadiusWorld * searchRadiusWorld;

    for (const node of this.nodes) {
      if (!this.camera.isVisible(node.x, node.y, 20)) continue;
      const dx = node.x - wx;
      const dy = node.y - wy;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDist) {
        minDist = distSq;
        closest = node.id;
      }
    }
    return closest;
  }

  private onMouseDown = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isDragging) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.camera.pan(dx, dy);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    } else {
      const hovered = this.findNodeAt(x, y);
      this.onHover(hovered);
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (this.isDragging) {
      this.isDragging = false;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hovered = this.findNodeAt(x, y);
      this.onTap(hovered, e.clientX, e.clientY);
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    this.camera.zoom(factor, x, y);
  };

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    this.touchDownTime = Date.now();
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      this.isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.initialPinchDist = Math.sqrt(dx * dx + dy * dy);
      this.initialScale = this.camera.scale;
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && this.isDragging) {
      const dx = e.touches[0].clientX - this.lastX;
      const dy = e.touches[0].clientY - this.lastY;
      this.camera.pan(dx, dy);
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      const factor = dist / this.initialPinchDist;
      this.camera.scale = this.initialScale;
      this.camera.zoom(factor, cx, cy);
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      this.isDragging = false;
      if (Date.now() - this.touchDownTime < 300) {
        const rect = this.canvas.getBoundingClientRect();
        const x = this.lastX - rect.left;
        const y = this.lastY - rect.top;
        const tapped = this.findNodeAt(x, y);
        this.onTap(tapped, this.lastX, this.lastY);
      }
    } else if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    }
  };
}
