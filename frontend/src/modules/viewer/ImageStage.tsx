import type { ReactNode } from "react";
import type { Comment } from "@/api/types";
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
  threads = [],
  activeThread = null,
  onThread = () => {},
  composer = null,
  anchor = null,
}: {
  threads?: Comment[];
  activeThread?: string | null;
  onThread?: (id: string) => void;
  composer?: ReactNode;
  anchor?: [number, number] | null;
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
  const position = (point: [number, number]) => ({
    x: box.width / 2 + (point[0] - 0.5) * width * zoom + pan.x,
    y: box.height / 2 + (((point[1] - 0.5) * width) / ratio) * zoom + pan.y,
  });
  const at = anchor ? position(anchor) : null;
  const cardWidth = Math.min(410, Math.max(220, box.width - 24));
  const left = at
    ? Math.max(12, Math.min(box.width - cardWidth - 12, at.x + 24))
    : 12;
  const top = at
    ? Math.max(12, Math.min(Math.max(12, box.height - 280), at.y - 16))
    : 12;
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
          if (
            zoom <= 1 ||
            tool ||
            (e.target as HTMLElement).closest("button,textarea,.anchor-card")
          )
            return;
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
        {threads.map((c, i) => {
          const point = c.annotations.at(-1)?.points.at(-1);
          if (!point) return null;
          const p = position(point);
          return (
            <button
              className="annotation-marker"
              key={c.id}
              aria-label={`Open photo comment ${i + 1}`}
              aria-pressed={activeThread === c.id}
              onClick={() => onThread(c.id)}
              style={{ left: p.x, top: p.y }}
            >
              {(c.author.first_name || c.author.username)
                .slice(0, 2)
                .toUpperCase()}
            </button>
          );
        })}
        {draft.length > 0 &&
          (() => {
            const point = draft.at(-1)?.points.at(-1);
            if (!point) return null;
            const p = position(point);
            return (
              <button
                className="annotation-marker draft-marker"
                aria-label="Resume draft comment"
                onClick={() => onThread("draft")}
                style={{ left: p.x, top: p.y }}
              >
                You
              </button>
            );
          })()}
        {composer && at && (
          <div
            className="anchor-position"
            style={{
              left,
              top,
              width: cardWidth,
              maxHeight: Math.max(140, box.height - top - 12),
            }}
          >
            {composer}
          </div>
        )}
      </div>
    </div>
  );
}
