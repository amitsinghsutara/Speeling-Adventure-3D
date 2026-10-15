/**
 * Live renderer numbers, mutated by the render loop every frame and read on
 * demand (grown-ups screen, device profiling). Deliberately not React state.
 */
export interface PerfStats {
  averageFps: number;
  drawCalls: number;
  triangles: number;
}

const stats: PerfStats = { averageFps: 0, drawCalls: 0, triangles: 0 };

export function getPerfStats(): PerfStats {
  return stats;
}
