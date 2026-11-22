import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export function AnimatedCounter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = display;
    const end = Number.isFinite(value) ? value : 0;
    if (start === end) return;

    const duration = 380;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplay(end);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const formatted = display.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className="font-mono-tabular">
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
