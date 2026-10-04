import { useEffect, useRef } from "react";
import lottie from "lottie-web/build/player/lottie_light";
// Original minimal animation, authored for Signaki. No external artwork or service.
const animation = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 30,
  w: 80,
  h: 80,
  nm: "Signaki success",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Check",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [40, 40, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "sh",
          ks: {
            a: 0,
            k: {
              i: [
                [0, 0],
                [0, 0],
                [0, 0],
              ],
              o: [
                [0, 0],
                [0, 0],
                [0, 0],
              ],
              v: [
                [-18, 0],
                [-4, 14],
                [20, -14],
              ],
              c: false,
            },
          },
          nm: "Path",
        },
        {
          ty: "st",
          c: { a: 0, k: [0.18, 0.65, 0.43, 1] },
          o: { a: 0, k: 100 },
          w: { a: 0, k: 5 },
          lc: 2,
          lj: 2,
          nm: "Stroke",
        },
        {
          ty: "tm",
          s: { a: 0, k: 0 },
          e: {
            a: 1,
            k: [
              {
                t: 0,
                s: [0],
                e: [100],
                i: { x: [0.5], y: [1] },
                o: { x: [0.5], y: [0] },
              },
              { t: 20, s: [100] },
            ],
          },
          o: { a: 0, k: 0 },
          m: 1,
          nm: "Draw",
        },
      ],
      ip: 0,
      op: 30,
      st: 0,
      bm: 0,
    },
  ],
};
export default function UploadSuccess() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const player = lottie.loadAnimation({
      container: ref.current,
      renderer: "svg",
      loop: false,
      autoplay: true,
      animationData: animation,
    });
    return () => player.destroy();
  }, []);
  return (
    <div className="upload-success" role="status">
      <div ref={ref} aria-hidden="true" />
      Upload complete
    </div>
  );
}
