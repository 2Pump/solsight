"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, type IChartApi } from "lightweight-charts";
import type { Candle } from "@/lib/market-data";

interface KeyLevel {
  label: string;
  price: number;
}

export function PriceChart({ candles, keyLevels = [] }: { candles: Candle[]; keyLevels?: KeyLevel[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [emptyDebugInfo, setEmptyDebugInfo] = useState<{ raw: number; cleaned: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const rect = container.getBoundingClientRect();

    const chart = createChart(container, {
      width: rect.width || 600,
      height: rect.height || 420,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9997A8",
        fontFamily: "var(--font-mono)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)" },
      crosshair: {
        vertLine: { color: "#7C5CFF", labelBackgroundColor: "#7C5CFF" },
        horzLine: { color: "#7C5CFF", labelBackgroundColor: "#7C5CFF" },
      },
    });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) chart.resize(width, height);
    });
    resizeObserver.observe(container);

    const series = chart.addCandlestickSeries({
      upColor: "#00E5C7",
      downColor: "#FF5C7A",
      borderVisible: false,
      wickUpColor: "#00E5C7",
      wickDownColor: "#FF5C7A",
    });

    const cleaned = candles
      .map((c) => {
        let time = Number(c.time);
        if (Number.isFinite(time) && time > 1e12) time = Math.floor(time / 1000);
        return {
          time,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
        };
      })
      .filter(
        (c) =>
          Number.isFinite(c.time) &&
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close)
      )
      .sort((a, b) => a.time - b.time)
      .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);

    const smallestPrice = cleaned.reduce((min, c) => {
      const candidates = [c.open, c.high, c.low, c.close].filter((v) => v > 0);
      return candidates.length ? Math.min(min, ...candidates) : min;
    }, Infinity);

    if (Number.isFinite(smallestPrice)) {
      const magnitude = Math.floor(Math.log10(smallestPrice));
      const precision = Math.min(10, Math.max(2, -magnitude + 3));
      series.applyOptions({
        priceFormat: { type: "price", precision, minMove: 1 / 10 ** precision },
      });
    }

    // TEMP DIAGNOSTIC — shows in the UI itself so we can see exactly where
    // candles are being lost without needing devtools. Remove once resolved.
    setEmptyDebugInfo({ raw: candles.length, cleaned: cleaned.length });

    setIsEmpty(cleaned.length === 0);

    series.setData(
      cleaned.map((c) => ({
        time: c.time as unknown as never,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

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

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [candles, keyLevels]);

  return (
    <div className="relative h-[420px] w-full">
      <div ref={containerRef} className="h-full w-full" />
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-sm text-ink-faint">
          <span>No chart data could be rendered for this token.</span>
          {emptyDebugInfo && (
            <span className="font-mono text-xs opacity-70">
              (received {emptyDebugInfo.raw} candles from the server, {emptyDebugInfo.cleaned} passed validation)
            </span>
          )}
        </div>
      )}
    </div>
  );
}