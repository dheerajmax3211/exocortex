export class ServerTiming {
  private marks: Map<string, { start: number; end?: number; desc?: string }>;

  constructor() {
    this.marks = new Map();
  }

  start(name: string, desc?: string): void {
    this.marks.set(name, { start: performance.now(), desc });
  }

  end(name: string): number {
    const mark = this.marks.get(name);
    if (!mark) return 0;
    mark.end = performance.now();
    return mark.end - mark.start;
  }

  getHeader(): string {
    const metrics: string[] = [];
    for (const [name, mark] of this.marks.entries()) {
      if (mark.end !== undefined) {
        const duration = (mark.end - mark.start).toFixed(2);
        let metric = `${name};dur=${duration}`;
        if (mark.desc) metric += `;desc="${mark.desc}"`;
        metrics.push(metric);
      }
    }
    return metrics.join(', ');
  }

  toJSON(): Record<string, { elapsed_ms: number; desc?: string }> {
    const result: Record<string, { elapsed_ms: number; desc?: string }> = {};
    for (const [name, mark] of this.marks.entries()) {
      if (mark.end !== undefined) {
        result[name] = { elapsed_ms: Math.round(mark.end - mark.start) };
        if (mark.desc) result[name].desc = mark.desc;
      }
    }
    return result;
  }

  log(prefix: string): void {
    const timings = this.toJSON();
    const formatted = Object.entries(timings)
      .map(([name, data]) => `${name}: ${data.elapsed_ms}ms`)
      .join(', ');
    console.log(`[${prefix}] Timings - ${formatted}`);
  }
}
