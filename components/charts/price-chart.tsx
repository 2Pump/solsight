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

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // `autoSize: true` delegates sizing to lightweight-charts' internal
    // ResizeObserver, which — under React 18 Strict Mode's double-effect
    // plus Turbopack dev's Fast Refresh — doesn't reliably fire on first
    // mount, leaving the canvas at 0x0 until a real resize event happens.
    // Size explicitly instead, with our own observer keeping it in sync.
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

    // Defensive normalization of whatever the API actually sent us:
    //  1. Coerce every field with Number(...) — some APIs return numeric
    //     fields as strings, which Number.isFinite() silently rejects,
    //     quietly dropping every candle with no error.
    //  2. Detect millisecond-scale timestamps and convert to seconds.
    //     lightweight-charts expects UTCTimestamp in *seconds*; if a
    //     provider ever hands back milliseconds, every candle gets placed
    //     thousands of years apart, which visually collapses the whole
    //     series into an invisible sliver at one edge of the time axis —
    //     the chart frame/axes still render fine, but no candles are
    //     visible anywhere, which matches what we were seeing.
    //  3. Sort ascending and drop duplicate timestamps — lightweight-charts
    //     requires strictly ascending, unique times or it throws internally.
    const cleaned = candles
      .map((c) => {
        let time = Number(c.time);
        if (Number.isFinite(time) && time > 1e12) time = Math.floor(time / 1000); // ms -> s
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

    // The series defaults to priceFormat { precision: 2, minMove: 0.01 },
    // which is fine for a $150 SOL candle but silently breaks memecoins —
    // a $0.00073 token rounds every OHLC value to $0.00, every candle
    // becomes degenerate, and the autoscale ends up with no usable range.
    // Derive precision from the smallest nonzero price actually present.
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ink-faint">
          No chart data could be rendered for this token.
        </div>
      )}
    </div>
  );
}