import {
  Undo2,
  Brush,
  ArrowUpRight,
  Square,
  Circle,
  MapPin,
  X,
  Trash2,
} from "lucide-react";
import type { Annotation } from "@/modules/review/types";
import type { DrawTool } from "@/modules/review/AnnotationLayer";
const tools = [
  ["pen", "Brush", Brush],
  ["arrow", "Arrow", ArrowUpRight],
  ["ellipse", "Ellipse", Circle],
  ["rectangle", "Rectangle", Square],
  ["pin", "Pin", MapPin],
] as const;
const colors = [
  ["#70b7ff", "Blue"],
  ["#ffcc45", "Yellow"],
  ["#ff7185", "Pink"],
] as const;
export function DrawingToolbar({
  tool,
  color,
  count,
  onTool,
  onColor,
  onUndo,
  onClear,
  onClose,
}: {
  tool: DrawTool;
  color: Annotation["color"];
  count: number;
  onTool: (v: DrawTool) => void;
  onColor: (v: Annotation["color"]) => void;
  onUndo: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="review-drawing" aria-label="Drawing tools">
      <button
        className="review-pill icon"
        aria-label="Undo drawing"
        disabled={!count}
        onClick={onUndo}
      >
        <Undo2 />
      </button>
      <div className="review-segment" aria-label="Drawing colors">
        {colors.map(([value, name]) => (
          <button
            key={value}
            aria-label={`${name} drawing color`}
            aria-pressed={color === value}
            onClick={() => onColor(value)}
          >
            <span className="color-swatch" style={{ color: value }} />
          </button>
        ))}
      </div>
      <div className="review-segment" aria-label="Drawing shapes">
        {tools.map(([value, name, Icon]) => (
          <button
            key={value}
            aria-label={name}
            aria-pressed={tool === value}
            onClick={() => onTool(value)}
          >
            <Icon />
          </button>
        ))}
      </div>
      <button
        className="review-pill icon"
        aria-label="Clear draft"
        disabled={!count}
        onClick={onClear}
      >
        <Trash2 />
      </button>
      <button
        className="review-pill icon"
        aria-label="Done drawing"
        onClick={onClose}
      >
        <X />
      </button>
    </div>
  );
}
