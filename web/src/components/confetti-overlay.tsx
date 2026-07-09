import { useEffect, useRef } from "react";
import type { CreateTypes, Options } from "canvas-confetti";

export function ConfettiOverlay({ onClose, kind = "realistic" }: { onClose: () => void; kind?: "realistic" | "stars" }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let disposed = false;
    let confetti: CreateTypes | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = (animation: ReturnType<CreateTypes>) => {
      void Promise.resolve(animation).then(() => { if (!disposed) onClose(); });
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    void import("canvas-confetti").then(({ default: createConfetti }) => {
      if (disposed) return;
      confetti = createConfetti.create(canvas.current!, { resize: true });
      if (kind === "stars") {
        const shoot = () => {
          const defaults: Options = {
            spread: 360, ticks: reduced ? 24 : 240, gravity: 0, decay: reduced ? 0.94 : 0.965,
            startVelocity: reduced ? 15 : 20,
            colors: ["FFE400", "FFBD00", "E89400", "FFCA6C", "FDFFB8"],
          };
          void confetti!({ ...defaults, particleCount: reduced ? 12 : 40, scalar: 1.2, shapes: ["star"] });
          return confetti!({ ...defaults, particleCount: reduced ? 3 : 10, scalar: 0.75, shapes: ["circle"] });
        };
        if (reduced) finish(shoot());
        else {
          void shoot();
          timers.push(setTimeout(shoot, 200), setTimeout(() => finish(shoot()), 400));
        }
        return;
      }
      // Let all five Realistic Look bursts finish before removing the canvas.
      const count = reduced ? 40 : window.innerWidth < 640 ? 550 : 750;
      const fire = (ratio: number, options: Options) => confetti!({
        origin: { y: 0.7 }, ticks: reduced ? 35 : 200,
        ...options, particleCount: Math.floor(count * ratio),
      });
      void fire(0.25, { spread: 26, startVelocity: 55 });
      void fire(0.2, { spread: 60 });
      void fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      void fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      finish(fire(0.1, { spread: 120, startVelocity: 45 }));
    }).catch(() => { if (!disposed) onClose(); });
    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
      confetti?.reset();
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, kind]);

  return <canvas ref={canvas} className="celebration-canvas" data-testid="celebration-canvas" data-effect={kind} aria-hidden="true" />;
}
