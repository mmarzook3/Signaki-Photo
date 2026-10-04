import { useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ImageStage({ src, label }: { src: string; label: string }) {
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
        className={`image-stage ${zoom > 1 ? "is-zoomed" : ""}`}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
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
        <img
          key={src}
          src={src}
          alt={label}
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        />
      </div>
    </div>
  );
}
