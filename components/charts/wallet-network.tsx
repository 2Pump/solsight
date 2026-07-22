"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { shortenAddress } from "@/lib/utils";

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
}

const WIDTH = 640;
const HEIGHT = 420;

/**
 * Deterministic radial layout: the tracked wallet sits at the center,
 * connected wallets are placed on a ring sized by their balance share.
 * A real deployment can swap this for a force-directed layout (d3-force)
 * once the graph gets large — kept simple/static here for reliability
 * and to avoid layout thrashing on every render.
 */
export function WalletNetwork({ nodes, edges }: { nodes: WalletNode[]; edges: WalletEdge[] }) {
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

  return (
    <div className="glass overflow-hidden p-4">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full">
        <defs>
          <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* edges */}
        {edges.map((edge, i) => {
          const a = positioned.get(edge.from);
          const b = positioned.get(edge.to);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#7C5CFF"
              strokeOpacity={0.15 + edge.strength * 0.35}
              strokeWidth={1 + edge.strength * 2}
            />
          );
        })}

        {/* nodes */}
        {nodes.map((node, i) => {
          const pos = positioned.get(node.address);
          if (!pos) return null;
          const color = node.flagged ? "#FF5C7A" : node.isCenter ? "#7C5CFF" : "#00E5C7";

          return (
            <motion.g
              key={node.address}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.03 }}
            >
              <circle cx={pos.x} cy={pos.y} r={pos.r + 10} fill="url(#node-glow)" />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={pos.r}
                fill={node.isCenter ? "#15141F" : "#0E0D16"}
                stroke={color}
                strokeWidth={node.isCenter ? 2 : 1.5}
              />
              <text
                x={pos.x}
                y={pos.y + pos.r + 14}
                textAnchor="middle"
                fontSize="9"
                fontFamily="var(--font-mono)"
                fill="#9997A8"
              >
                {node.label ?? shortenAddress(node.address)}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
