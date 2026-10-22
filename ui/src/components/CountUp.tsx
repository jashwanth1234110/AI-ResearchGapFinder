import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

interface CountUpProps {
  to: number;
  duration?: number;
  className?: string;
  suffix?: string;
  immediate?: boolean;
}

/** Animated number counter. Runs on view, or immediately when `immediate`. */
export function CountUp({ to, duration = 1.6, className, suffix = "", immediate = false }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!immediate && !inView) return;
    const controls = animate(0, to, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, to, duration, immediate]);

  return (
    <span ref={ref} className={className}>
      {Math.round(val).toLocaleString()}
      {suffix}
    </span>
  );
}

