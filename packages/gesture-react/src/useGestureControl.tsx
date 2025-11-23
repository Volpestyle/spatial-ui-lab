import { useEffect, useMemo, useRef } from "react";
import { GestureEngine } from "@spatial-ui-kit/gesture-core";
import type { GestureEngineOptions, HandFrame } from "@spatial-ui-kit/gesture-core";
import type { ViewportCommand } from "@spatial-ui-kit/control-core";
import type { HandModel } from "@spatial-ui-kit/handtracking-tfjs";

type Cursor = { x: number; y: number };

export type UseGestureControlOptions = {
  model: HandModel | null;
  onCommand: (cmd: ViewportCommand) => void;
  mapCursorToViewport?: (cursor: Cursor) => Cursor;
  fps?: number;
  debug?: boolean;
  gestureOptions?: GestureEngineOptions;
};

export function useGestureControl(options: UseGestureControlOptions) {
  const { model, onCommand, mapCursorToViewport, fps, gestureOptions } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const engine = useMemo(() => new GestureEngine(gestureOptions), [gestureOptions]);
  const lastFrameTs = useRef<number>(0);

  useEffect(() => {
    let rafId: number | null = null;
    let cancelled = false;

    const mapCursor = mapCursorToViewport ?? ((cursor: Cursor) => cursor);

    const tick = async () => {
      if (cancelled) return;
      rafId = requestAnimationFrame(tick);

      if (!model || !videoRef.current) return;

      const now = performance.now();
      if (fps && lastFrameTs.current && now - lastFrameTs.current < 1000 / fps) {
        return;
      }
      lastFrameTs.current = now;

      const hands = await model.estimateHands(videoRef.current);
      const frame: HandFrame = { hands, timestamp: now };
      const commands = engine.update(frame);

      for (const cmd of commands) {
        if (cmd.type === "POINTER_CLICK") {
          const mapped = mapCursor({ x: cmd.xNorm, y: cmd.yNorm });
          onCommand({ ...cmd, xNorm: mapped.x, yNorm: mapped.y });
          continue;
        }
        onCommand(cmd);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [engine, fps, mapCursorToViewport, model, onCommand]);

  return { videoRef, overlayRef } as const;
}
