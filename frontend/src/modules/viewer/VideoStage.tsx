import { useState, type RefObject } from "react";
import type { Version } from "@/api/types";

export function VideoStage({ version, player, onTime, onReady }: {
  version: Version;
  player: RefObject<HTMLVideoElement | null>;
  onTime: (time: number) => void;
  onReady: (video: HTMLVideoElement) => void;
}) {
  const [failed, setFailed] = useState(false);
  if (version.processing !== "ready") {
    return <div className="video-message" role="status">
      {version.processing === "failed" ? version.processing_error : "Preparing your watermarked video preview…"}
    </div>;
  }
  return <div className="video-stage">
    <video ref={player} src={version.image_url} poster={version.thumb_url}
      controls controlsList="nodownload" playsInline preload="metadata"
      aria-label={version.label}
      onTimeUpdate={event => onTime(event.currentTarget.currentTime)}
      onLoadedMetadata={event => onReady(event.currentTarget)}
      onError={() => setFailed(true)} />
    {failed && <p role="alert">The preview could not load. Refresh the page to try again.</p>}
  </div>;
}
