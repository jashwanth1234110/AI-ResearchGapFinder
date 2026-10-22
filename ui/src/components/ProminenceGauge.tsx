import { useEffect, useState } from "react";
import { animate } from "framer-motion";

interface GaugeProps {
  score: number; // 0..100
  size?: number;
  strokeWidth?: number;
  label?: string;
  animateOnMount?: boolean;
}

// red -> amber -> green (cyan-tinted) based on opportunity size
function colorFor(score: number) {
  if (score >= 80) return "var(--cyan)";
  if (score >= 60) return "var(--amber)";
  return "var(--danger)";
}

export function ProminenceGauge({
  score,
  size = 92,
  strokeWidth = 8,
  label = "PROMINENCE",
  animateOnMount = true,
}: GaugeProps) {
  const [val, setVal] = useState(animateOnMount ? 0 : score);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const color = colorFor(score);

  useEffect(() => {
    if (!animateOnMount) {
      setVal(score);
      return;
    }
    const controls = animate(0, score, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: setVal,
    });
    return () => controls.stop();
  }, [score, animateOnMount]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (val / 100) * c}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke 0.3s" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-xl font-bold" style={{ color }}>
          {Math.round(val)}
        </span>
        <span className="font-mono text-[8px] tracking-widest text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
