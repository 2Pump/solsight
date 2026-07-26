"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { shortenAddress, formatRelativeTime } from "@/lib/utils";

export interface WalletNode {
  address: string;
  label?: string;
  balancePct: number; // 0-100, drives bubble size
  isCenter?: boolean;
  flagged?: boolean;
}

export interface WalletEdge {
  from: string;
  to: string;
  strength: number; // 0-1, drives line opacity/width
  /** Net real direction from Helius tx data — drives arrow color/direction, not a guess. */
  direction: "inflow" | "outflow" | "balanced";
  txCount: number;
  lastTxAt: number;
}

const WIDTH = 640;
const HEIGHT = 420;
// Tooltip sizing, kept in sync with the actual rendered tooltip box below,
// used to clamp its position so it can never render partially outside the
// map (previously it could float up past the card entirely for top-row
// nodes, overlapping unrelated page content above the map).
const TOOLTIP_WIDTH_PCT = 30; // approx % of WIDTH the 192px-wide tooltip occupies
const TOOLTIP_HEIGHT_PX = 118; // approx rendered height, for vertical clamping

/**
 * Deterministic radial layout: the tracked wallet sits at the center,
 * connected wallets are placed on a ring sized by their balance share.
 * A real deployment can swap this for a force-directed layout (d3-force)
 * once the graph gets large — kept simple/static here for reliability
 * and to avoid layout thrashing on every render.
 */
export function WalletNetwork({ nodes, edges }: { nodes: WalletNode[]; edges: WalletEdge[] }) {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);

  const positioned = useMemo(() => {
    const center = nodes.find((n) => n.isCenter) ?? nodes[0];
    const others = nodes.filter((n) => n !== center);
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    const positions = new Map<string, { x: number; y: number; r: number }>();
    positions.set(center.address, { x: cx, y: cy, r: 22 });

    others.forEach((node, i) => {
      const angle = (i / others.length) * Math.PI * 2;
      const radius = 130 + (1 - node.balancePct / 100) * 60;
      const r = 8 + (node.balancePct / 100) * 26;
      positions.set(node.address, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        r,
      });
    });

    return positions;
  }, [nodes]);

  const centerAddress = (nodes.find((n) => n.isCenter) ?? nodes[0])?.address;
  const hoveredEdge = hovered ? edges.find((e) => e.from === hovered || e.to === hovered) : null;
  const hoveredNode = hovered ? nodes.find((n) => n.address === hovered) : null;
  const hoveredPos = hovered ? positioned.get(hovered) : null;

  // Clamp tooltip position so it always stays fully inside the map card:
  // flips below the node if there isn't enough room above, and keeps it
  // away from the left/right edges instead of centering blindly.
  let tooltipLeftPct = 50;
  let tooltipPlacement: "above" | "below" = "above";
  if (hoveredPos) {
    tooltipLeftPct = Math.min(
      Math.max((hoveredPos.x / WIDTH) * 100, TOOLTIP_WIDTH_PCT / 2 + 2),
      100 - TOOLTIP_WIDTH_PCT / 2 - 2
    );
    const spaceAbovePx = hoveredPos.y - hoveredPos.r; // viewBox units, close enough to rendered px for this clamp
    tooltipPlacement = spaceAbovePx < TOOLTIP_HEIGHT_PX + 20 ? "below" : "above";
  }

  return (
    <div className="glass p-4">
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full">
          <defs>
            <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
            </radialGradient>
            <marker id="arrow-in" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#00E5C7" />
            </marker>
            <marker id="arrow-out" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#FFB454" />
            </marker>
          </defs>

          {/* edges — animated dash flow shows real fund direction in
              motion: dashes travel toward the center for inflow, away from
              it for outflow, and sit still for balanced edges. This is
              tied to real data, not decoration for its own sake. */}
          {edges.map((edge, i) => {
            const a = positioned.get(edge.from);
            const b = positioned.get(edge.to);
            if (!a || !b) return null;
            const [start, end] = edge.direction === "outflow" ? [a, b] : [b, a];
            const dimmed = hovered && edge.from !== hovered && edge.to !== hovered;
            const color = edge.direction === "inflow" ? "#00E5C7" : edge.direction === "outflow" ? "#FFB454" : "#7C5CFF";
            return (
              <motion.line
                key={i}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={color}
                strokeOpacity={dimmed ? 0.08 : 0.18 + edge.strength * 0.4}
                strokeWidth={1 + edge.strength * 2}
                strokeDasharray={edge.direction === "balanced" ? undefined : "4 5"}
                animate={
                  edge.direction === "balanced"
                    ? undefined
                    : { strokeDashoffset: [0, -18] }
                }
                transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                markerEnd={edge.direction !== "balanced" ? `url(#arrow-${edge.direction === "inflow" ? "in" : "out"})` : undefined}
              />
            );
          })}

          {/* nodes — every non-center node is clickable, navigating to that
              wallet's own deep-dive page. Each also gets a slow, staggered
              "breathing" glow so the whole map reads as live rather than
              static, plus a distinct pulse ring specifically on the
              currently-hovered node for direct feedback. */}
          {nodes.map((node, i) => {
            const pos = positioned.get(node.address);
            if (!pos) return null;
            const color = node.flagged ? "#FF5C7A" : node.isCenter ? "#7C5CFF" : "#00E5C7";
            const dimmed = hovered && hovered !== node.address;

            return (
              <motion.g
                key={node.address}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: dimmed ? 0.4 : 1, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
                onMouseEnter={() => setHovered(node.address)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => !node.isCenter && router.push(`/wallet/${node.address}`)}
                style={{ cursor: node.isCenter ? "default" : "pointer" }}
              >
                <motion.circle
                  cx={pos.x}
                  cy={pos.y}
                  r={pos.r + 10}
                  fill="url(#node-glow)"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.85, 0.55] }}
                  transition={{
                    duration: 3 + (i % 3),
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.25,
                  }}
                />
                {hovered === node.address && (
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    r={pos.r}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
                  />
                )}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={pos.r}
                  fill={node.isCenter ? "#15141F" : "#0E0D16"}
                  stroke={color}
                  strokeWidth={node.isCenter ? 2 : hovered === node.address ? 2.5 : 1.5}
                />
                <text
                  x={pos.x}
                  y={pos.y + pos.r + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                  fill={hovered === node.address ? "#F3F2F8" : "#9997A8"}
                >
                  {node.label ?? shortenAddress(node.address)}
                </text>
              </motion.g>
            );
          })}
        </svg>

        {/* Hover tooltip — clamped horizontally and flips below the node
            when there isn't room above, so it can never render partially
            outside the map card (previously it could float up past the
            card entirely for top-row nodes). */}
        {hoveredNode && !hoveredNode.isCenter && hoveredEdge && hoveredPos && (
          <div
            className="pointer-events-none absolute z-10 w-48 rounded-xl border border-border-strong bg-surface p-3 text-xs shadow-2xl"
            style={{
              left: `${tooltipLeftPct}%`,
              top:
                tooltipPlacement === "above"
                  ? `${((hoveredPos.y - hoveredPos.r - 12) / HEIGHT) * 100}%`
                  : `${((hoveredPos.y + hoveredPos.r + 12) / HEIGHT) * 100}%`,
              transform:
                tooltipPlacement === "above" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
            }}
          >
            <div className="font-mono font-medium text-ink">{shortenAddress(hoveredNode.address, 6)}</div>
            <div className="mt-1.5 flex justify-between text-ink-muted">
              <span>Direction</span>
              <span
                className={
                  hoveredEdge.direction === "inflow"
                    ? "text-pulse"
                    : hoveredEdge.direction === "outflow"
                      ? "text-amber"
                      : "text-signal-soft"
                }
              >
                {hoveredEdge.direction === "inflow"
                  ? "Mostly sends to this wallet"
                  : hoveredEdge.direction === "outflow"
                    ? "Mostly receives from this wallet"
                    : "Balanced flow"}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-ink-muted">
              <span>Transactions</span>
              <span className="font-mono text-ink">{hoveredEdge.txCount}</span>
            </div>
            <div className="mt-1 flex justify-between text-ink-muted">
              <span>Last activity</span>
              <span className="font-mono text-ink">{formatRelativeTime(hoveredEdge.lastTxAt)}</span>
            </div>
            <div className="mt-2 border-t border-border pt-1.5 text-ink-faint">Click to explore this wallet</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-pulse bg-pulse/20" /> Mostly sends to wallet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-amber bg-amber/20" /> Mostly receives from wallet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-signal bg-signal/20" /> Balanced flow
        </span>
        <span className="ml-auto">Bubble size = relative volume · Click a node to explore it</span>
      </div>
    </div>
  );
}