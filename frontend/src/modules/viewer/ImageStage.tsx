import type { Annotation } from "@/modules/review/types";
import {
  AnnotationLayer,
  type DrawTool,
} from "@/modules/review/AnnotationLayer";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ImageStage({
  src,
  label,
  saved = [],
  draft = [],
  tool = null,
  color = "#ffcc45",
  onChange = () => {},
}: {
  src: string;
  label: string;
  saved?: Annotation[];
  draft?: Annotation[];
  tool?: DrawTool;
  color?: Annotation["color"];
  onChange?: (s: Annotation[]) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 1, height: 1 });
  const [ratio, setRatio] = useState(1.5);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setBox({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const width = Math.min(box.width, box.height * ratio);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  return (
    <div className="stage-wrapper">
      <div className="zoom-toolbar">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Zoom out"
          disabled={zoom <= 1}
          onClick={() => {
            setZoom((z) => Math.max(1, z - 0.25));
            setPan({ x: 0, y: 0 });
          }}
        >
          <Minus size={16} />
        </Button>
        <span>{zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Zoom in"
          disabled={zoom >= 3}
          onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
        >
          <Plus size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Reset zoom"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw size={14} />
        </Button>
      </div>
      <div
        ref={container}
        className={`image-stage ${zoom > 1 ? "is-zoomed" : ""}`}
        onPointerDown={(e) => {
          if (zoom <= 1 || tool) return;
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current)
            setPan({
              x: drag.current.px + e.clientX - drag.current.x,
              y: drag.current.py + e.clientY - drag.current.y,
            });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div
          className="image-plane"
          style={{
            width,
            height: width / ratio,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <img
            key={src}
            src={src}
            alt={label}
            draggable={false}
            onLoad={(e) =>
              setRatio(
                e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
              )
            }
          />
          <AnnotationLayer
            saved={saved}
            draft={draft}
            tool={tool}
            color={color}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
}
