import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { forceSimulation, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum } from "d3-force";
import type { Gap, Topic } from "@/lib/api";
import { gapKey, truncate } from "@/lib/gap";

const VB = 1000;
// Inset from the canvas edge so topics normalized to exactly 0 or 1 by UMAP
// don't clip under the header/legend overlays.
const PAD = 90;
const toCanvas = (n: number) => PAD + n * (VB - 2 * PAD);

const radiusFor = (t: Topic) => 20 + Math.sqrt(t.size) * 3;

interface SimNode extends SimulationNodeDatum {
  id: string;
  r: number;
}

interface NodeLayout {
  pos: Record<string, { x: number; y: number }>;
  fitZoom: number;
}

/** Settles the backend's UMAP layout into a denser constellation: mild
 * repulsion (charge) keeps nodes from stacking, a centering force pulls the
 * whole cluster toward the middle instead of drifting toward a corner, and
 * collision (sized off the real node radii) prevents overlap. Runs
 * synchronously to a fixed tick count — no visible animation, just a better
 * resting layout than raw UMAP coordinates give. */
function computeLayout(topics: Topic[]): NodeLayout {
  if (topics.length === 0) return { pos: {}, fitZoom: 1 };

  const nodes: SimNode[] = topics.map((t) => ({
    id: t.label,
    x: toCanvas(t.x),
    y: toCanvas(t.y),
    r: radiusFor(t),
  }));

  forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-25))
    .force("center", forceCenter(VB / 2, VB / 2).strength(0.08))
    .force("collide", forceCollide<SimNode>((d) => d.r + 6))
    .stop()
    .tick(300);

  const pos: Record<string, { x: number; y: number }> = {};
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    pos[n.id] = { x: n.x!, y: n.y! };
    minX = Math.min(minX, n.x! - n.r);
    maxX = Math.max(maxX, n.x! + n.r);
    minY = Math.min(minY, n.y! - n.r);
    maxY = Math.max(maxY, n.y! + n.r);
  }
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const fitZoom = Math.min(2.5, Math.max(0.8, VB / (span * 1.25)));

  return { pos, fitZoom };
}

interface Props {
  topics: Topic[];
  gaps: Gap[];
  onGapClick?: (key: string) => void;
  highlightTopics?: string[];
  activeGapId?: string | null;
  compact?: boolean;
}

/** Knowledge map: nodes are real topic clusters, laid out by settling the
 * backend's UMAP positions through a light force simulation; dashed zones
 * mark CONFIRMED/WEAK gaps at the midpoint of their two parent topics. No
 * mock clusters, edges, or gap regions. */
export function KnowledgeMap({ topics, gaps, onGapClick, highlightTopics, activeGapId, compact }: Props) {
  const layout = useMemo(() => computeLayout(topics), [topics]);
  const [pos, setPos] = useState(() => layout.pos);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(() => layout.fitZoom);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const maxSize = useMemo(() => Math.max(1, ...topics.map((t) => t.size)), [topics]);

  const zones = useMemo(
    () =>
      gaps
        .filter((g) => g.verdict === "CONFIRMED" || g.verdict === "WEAK")
        .map((g) => {
          const a = topics.find((t) => t.label === g.topic_a);
          const b = topics.find((t) => t.label === g.topic_b);
          if (!a || !b) return null;
          return {
            gap: g,
            key: gapKey(g),
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
            r: 0.05 + g.confidence * 0.06,
          };
        })
        .filter((z): z is NonNullable<typeof z> => z !== null),
    [gaps, topics],
  );

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * VB, y: ((clientY - rect.top) / rect.height) * VB };
  };

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toSvg(e.clientX, e.clientY);
    drag.current = { id, ox: p.x - pos[id].x, oy: p.y - pos[id].y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toSvg(e.clientX, e.clientY);
    const { id, ox, oy } = drag.current;
    setPos((prev) => ({ ...prev, [id]: { x: p.x - ox, y: p.y - oy } }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      {!compact && (
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            className="glass glass-hover flex h-8 w-8 items-center justify-center rounded-md font-mono text-sm"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            className="glass glass-hover flex h-8 w-8 items-center justify-center rounded-md font-mono text-sm"
          >
            −
          </button>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        className="h-full w-full grid-bg"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <radialGradient id="gapGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.28" />
            <stop offset="70%" stopColor="var(--violet)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--violet)" stopOpacity="0" />
          </radialGradient>
          <filter id="soft">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <g style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
          {/* Gap zones — midpoint of the two parent topics, CONFIRMED/WEAK only */}
          {zones.map((z) => {
            const active = activeGapId === z.key;
            return (
              <g
                key={z.key}
                className="cursor-pointer"
                onClick={() => onGapClick?.(z.key)}
                onMouseEnter={() => setHover(z.key)}
                onMouseLeave={() => setHover(null)}
              >
                <circle cx={toCanvas(z.x)} cy={toCanvas(z.y)} r={z.r * VB} fill="url(#gapGrad)" />
                <circle
                  cx={toCanvas(z.x)}
                  cy={toCanvas(z.y)}
                  r={z.r * VB}
                  fill="none"
                  stroke="var(--violet)"
                  strokeWidth={active || hover === z.key ? 3 : 1.5}
                  strokeDasharray="10 8"
                  opacity={active || hover === z.key ? 1 : 0.6}
                  style={{ animation: "dash-rotate 40s linear infinite", filter: "drop-shadow(0 0 6px var(--violet))" }}
                />
                <text
                  x={toCanvas(z.x)}
                  y={toCanvas(z.y) + 4}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize="20"
                  fill="var(--violet)"
                  style={{ pointerEvents: "none" }}
                >
                  GAP
                </text>
                {(hover === z.key || active) && (
                  <text
                    x={toCanvas(z.x)}
                    y={toCanvas(z.y) + z.r * VB + 22}
                    textAnchor="middle"
                    fontSize="14"
                    fill="var(--foreground)"
                    style={{ pointerEvents: "none" }}
                  >
                    {truncate(`${z.gap.topic_a} × ${z.gap.topic_b}`, 36)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Topic nodes */}
          {topics.map((t) => {
            const p = pos[t.label];
            if (!p) return null;
            const r = radiusFor(t);
            const hl = highlightTopics?.includes(t.label);
            const dim = highlightTopics && !hl;
            return (
              <g
                key={t.label}
                transform={`translate(${p.x} ${p.y})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => onPointerDown(e, t.label)}
                onMouseEnter={() => setHover(t.label)}
                onMouseLeave={() => setHover(null)}
                opacity={dim ? 0.28 : 1}
              >
                <circle r={r + 8} fill="var(--cyan)" opacity={hover === t.label || hl ? 0.18 : 0.08} filter="url(#soft)" />
                <motion.circle
                  r={r}
                  fill="oklch(0.24 0.05 265)"
                  stroke={hl ? "var(--violet)" : "var(--cyan)"}
                  strokeWidth={hl ? 3 : 2}
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 3 + (t.size / maxSize) * 2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ filter: `drop-shadow(0 0 ${6 + (t.size / maxSize) * 8}px ${hl ? "var(--violet)" : "var(--cyan)"})` }}
                />
                <text textAnchor="middle" y="4" fontSize="15" fill="var(--foreground)" style={{ pointerEvents: "none" }}>
                  {t.size}
                </text>
                <text
                  textAnchor="middle"
                  y={r + 18}
                  fontSize="15"
                  fill="var(--muted-foreground)"
                  style={{ pointerEvents: "none" }}
                >
                  {truncate(t.label)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
