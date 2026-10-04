import { useRef, useState } from "react";
import type { Annotation } from "./types";
export type DrawTool = Annotation["kind"] | null;
export function AnnotationLayer({
  saved,
  draft,
  tool,
  color,
  onChange,
}: {
  saved: Annotation[];
  draft: Annotation[];
  tool: DrawTool;
  color: Annotation["color"];
  onChange: (shapes: Annotation[]) => void;
}) {
  const drawing = useRef<Annotation | null>(null);
  const [active, setActive] = useState<Annotation | null>(null);
  const point = (e: React.PointerEvent<SVGSVGElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };
  return (
    <svg
      className={`annotation-layer ${tool ? "is-drawing" : ""}`}
      aria-label="Photo annotations"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      onPointerDown={(e) => {
        if (!tool || draft.length >= 8) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = point(e);
        drawing.current = {
          kind: tool,
          color,
          points: tool === "pin" ? [p] : [p, p],
        };
        setActive(drawing.current);
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        e.stopPropagation();
        const d = drawing.current;
        d.points =
          d.kind === "pen"
            ? [...d.points.slice(0, 499), point(e)]
            : d.kind === "pin"
              ? [point(e)]
              : [d.points[0], point(e)];
        setActive({ ...d });
      }}
      onPointerUp={(e) => {
        if (!drawing.current) return;
        e.stopPropagation();
        onChange([...draft, drawing.current]);
        drawing.current = null;
        setActive(null);
      }}
      onPointerCancel={() => {
        drawing.current = null;
        setActive(null);
      }}
    >
      {[...saved, ...draft, ...(active ? [active] : [])].map((s, i) => (
        <Shape key={i} shape={s} index={i + 1} />
      ))}
    </svg>
  );
}
function Shape({ shape: s, index }: { shape: Annotation; index: number }) {
  const [x, y] = s.points[0].map((v) => v * 1000);
  const [x2, y2] = (s.points.at(-1) || s.points[0]).map((v) => v * 1000);
  const attrs = {
    stroke: s.color,
    strokeWidth: 4,
    fill: "none",
    vectorEffect: "non-scaling-stroke" as const,
  };
  if (s.kind === "pin")
    return (
      <g>
        <circle cx={x} cy={y} r={16} fill={s.color} />
        <text x={x} y={y + 5} textAnchor="middle" fill="#151515" fontSize={15}>
          {index}
        </text>
      </g>
    );
  if (s.kind === "rectangle")
    return (
      <rect
        {...attrs}
        x={Math.min(x, x2)}
        y={Math.min(y, y2)}
        width={Math.abs(x2 - x)}
        height={Math.abs(y2 - y)}
      />
    );
  if (s.kind === "ellipse")
    return (
      <ellipse
        {...attrs}
        cx={(x + x2) / 2}
        cy={(y + y2) / 2}
        rx={Math.abs(x2 - x) / 2}
        ry={Math.abs(y2 - y) / 2}
      />
    );
  if (s.kind === "arrow") {
    const a = Math.atan2(y2 - y, x2 - x);
    return (
      <path
        {...attrs}
        d={`M ${x} ${y} L ${x2} ${y2} M ${x2 - 22 * Math.cos(a - 0.5)} ${y2 - 22 * Math.sin(a - 0.5)} L ${x2} ${y2} L ${x2 - 22 * Math.cos(a + 0.5)} ${y2 - 22 * Math.sin(a + 0.5)}`}
      />
    );
  }
  return (
    <polyline
      {...attrs}
      strokeLinejoin="round"
      strokeLinecap="round"
      points={s.points.map(([a, b]) => `${a * 1000},${b * 1000}`).join(" ")}
    />
  );
}
