"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, type IChartApi } from "lightweight-charts";
import type { Candle } from "@/lib/market-data";

interface KeyLevel {
  label: string;
  price: number;
}

export function PriceChart({ candles, keyLevels = [] }: { candles: Candle[]; keyLevels?: KeyLevel[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9997A8",
        fontFamily: "var(--font-mono)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)" },
      crosshair: {
        vertLine: { color: "#7C5CFF", labelBackgroundColor: "#7C5CFF" },
        horzLine: { color: "#7C5CFF", labelBackgroundColor: "#7C5CFF" },
      },
      autoSize: true,
    });

    const series = chart.addCandlestickSeries({
      upColor: "#00E5C7",
      downColor: "#FF5C7A",
      borderVisible: false,
      wickUpColor: "#00E5C7",
      wickDownColor: "#FF5C7A",
    });

    // lightweight-charts requires strictly ascending, unique, valid-number
    // timestamps — it fails with a cryptic internal error otherwise (seen
    // in the wild with some API responses that return slightly out-of-order
    // or duplicate candle buckets). Clean the data defensively rather than
    // trusting the API's ordering.
    const cleaned = candles
      .filter(
        (c) =>
          Number.isFinite(c.time) &&
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close)
      )
      .sort((a, b) => a.time - b.time)
      .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time); // drop duplicate timestamps

    series.setData(
      cleaned.map((c) => ({
        time: c.time as unknown as never,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // AI-identified key levels rendered as glowing horizontal price lines
    keyLevels.forEach((level) => {
      series.createPriceLine({
        price: level.price,
        color: "#7C5CFF",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: level.label,
      });
    });

    chart.timeScale().fitContent();
    chartRef.current = chart;

    return () => chart.remove();
  }, [candles, keyLevels]);

  return <div ref={containerRef} className="h-[420px] w-full" />;
}