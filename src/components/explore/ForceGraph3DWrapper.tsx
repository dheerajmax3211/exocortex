'use client';

import dynamic from 'next/dynamic';

// react-force-graph-3d uses window/document/WebGL immediately on import,
// so it MUST be loaded with ssr: false in Next.js
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full w-full bg-[#0a0a0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-white/40 text-xs font-mono tracking-wider">LOADING NEURAL MAP</span>
      </div>
    </div>
  ),
});

export default ForceGraph3D;
