import { useEffect, useMemo, useRef } from "react";
import { GestureEngine } from "@spatial-ui-kit/gesture-core";
import type { GestureEngineOptions, HandFrame } from "@spatial-ui-kit/gesture-core";
import type { ViewportCommand } from "@spatial-ui-kit/control-core";
import type { HandModel } from "@spatial-ui-kit/handtracking-tfjs";

type Cursor = { x: number; y: number };

export type GestureError =
  | { type: "webcam-permission-denied" }
  | { type: "no-webcam" }
  | { type: "model-init-failed"; error: unknown };

export type UseGestureControlOptions = {
  model: HandModel | null;
  onCommand: (cmd: ViewportCommand) => void;
  mapCursorToViewport?: (cursor: Cursor) => Cursor;
  fps?: number;
  debug?: boolean;
  onError?: (err: GestureError) => void;
  gestureOptions?: GestureEngineOptions;
};

export function useGestureControl(options: UseGestureControlOptions) {
  const { model, mapCursorToViewport, fps, debug, gestureOptions } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const engineRef = useRef(new GestureEngine(gestureOptions));
  useEffect(() => {
    engineRef.current = new GestureEngine(gestureOptions);
  }, [gestureOptions]);

  const onCommandRef = useRef(options.onCommand);
  useEffect(() => {
    onCommandRef.current = options.onCommand;
  }, [options.onCommand]);

  const mapCursorRef = useRef(mapCursorToViewport ?? ((cursor: Cursor) => cursor));
  useEffect(() => {
    mapCursorRef.current = mapCursorToViewport ?? ((cursor: Cursor) => cursor);
  }, [mapCursorToViewport]);

  const onErrorRef = useRef(options.onError);
  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  const lastFrameTs = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startWebcam() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        handleError({ type: "no-webcam" });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        startLoop();
      } catch (err: unknown) {
        const name = (err as any)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          handleError({ type: "webcam-permission-denied" });
          return;
        }
        handleError({ type: "model-init-failed", error: err });
      }
    }

    function stopWebcam() {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const ctx = overlayRef.current?.getContext("2d");
      if (ctx && overlayRef.current) {
        ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      }
    }

    const startLoop = () => {
      const tick = async () => {
        if (cancelled) return;
        rafRef.current = requestAnimationFrame(tick);
        const modelReady = model;
        const videoEl = videoRef.current;
        if (!modelReady || !videoEl) return;

        const now = performance.now();
        if (fps && lastFrameTs.current && now - lastFrameTs.current < 1000 / fps) {
          return;
        }
        lastFrameTs.current = now;

        try {
          const hands = await modelReady.estimateHands(videoEl);
          const frame: HandFrame = { hands, timestamp: now };
          const commands = engineRef.current.update(frame);
          const rawCursor = engineRef.current.getCursor();
          const cursor = mapCursorRef.current(rawCursor);

          drawOverlay(cursor, overlayRef.current, debug ? engineRef.current.getDebugState() : undefined);

          for (const cmd of commands) {
            if (cmd.type === "POINTER_CLICK") {
              onCommandRef.current({ ...cmd, xNorm: cursor.x, yNorm: cursor.y });
            } else {
              onCommandRef.current(cmd);
            }
          }
        } catch (err) {
          handleError({ type: "model-init-failed", error: err });
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (model) {
      startWebcam();
    } else {
      stopWebcam();
    }

    return () => {
      cancelled = true;
      stopWebcam();
    };
  }, [model, fps, debug]);

  return { videoRef, overlayRef } as const;

  function handleError(err: GestureError) {
    onErrorRef.current?.(err);
    // Keep console fallback for visibility during development
    console.error(err);
  }
}

function drawOverlay(
  cursor: Cursor,
  canvas: HTMLCanvasElement | null,
  debugState?: { mode: string; primaryHand?: string }
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const x = cursor.x * canvas.width;
  const y = cursor.y * canvas.height;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#00c2ff";
  ctx.globalAlpha = 0.8;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (debugState) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(`mode: ${debugState.mode}${debugState.primaryHand ? ` (${debugState.primaryHand})` : ""}`, 10, 20);
  }
}
