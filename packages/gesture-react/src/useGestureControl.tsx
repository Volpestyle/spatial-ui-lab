import { useEffect, useMemo, useRef } from "react";
import { GestureEngine } from "@spatial-ui-kit/gesture-core";
import type { GestureDebugState, GestureEngineOptions, HandFrame } from "@spatial-ui-kit/gesture-core";
import type { ViewportCommand } from "@spatial-ui-kit/control-core";
import type { HandModel } from "@spatial-ui-kit/handtracking-tfjs";

type Cursor = { x: number; y: number };

export type GestureError =
  | { type: "webcam-permission-denied" }
  | { type: "no-webcam" }
  | { type: "model-init-failed"; error: unknown };

export type GestureDebugFrame = {
  timestamp: number;
  fps?: number;
  handCount: number;
  hands?: HandFrame["hands"];
  cursor: { raw: Cursor; mapped: Cursor };
  debugState: GestureDebugState;
  commands: ViewportCommand[];
  timings?: { estimateMs: number; updateMs: number; totalMs: number };
};

export type UseGestureControlOptions = {
  model: HandModel | null;
  onCommand: (cmd: ViewportCommand) => void;
  mapCursorToViewport?: (cursor: Cursor) => Cursor;
  fps?: number;
  debug?: boolean;
  onError?: (err: GestureError) => void;
  gestureOptions?: GestureEngineOptions;
  onDebugFrame?: (frame: GestureDebugFrame) => void;
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

  const onDebugFrameRef = useRef(options.onDebugFrame);
  useEffect(() => {
    onDebugFrameRef.current = options.onDebugFrame;
  }, [options.onDebugFrame]);

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
          try {
            await videoRef.current.play();
          } catch (err: any) {
            if (err?.name !== "AbortError") {
              throw err;
            }
          }
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
        const modelReady = model;
        const videoEl = videoRef.current;
        const scheduleNext = () => {
          if (cancelled) return;
          rafRef.current = requestAnimationFrame(tick);
        };

        if (!modelReady || !videoEl) {
          scheduleNext();
          return;
        }

        const now = performance.now();
        const sinceLast = lastFrameTs.current ? now - lastFrameTs.current : undefined;
        if (fps && sinceLast && sinceLast < 1000 / fps) {
          scheduleNext();
          return;
        }
        lastFrameTs.current = now;

        try {
          const estimateStart = performance.now();
          const hands = await modelReady.estimateHands(videoEl);
          const estimateMs = performance.now() - estimateStart;
          const frame: HandFrame = { hands, timestamp: now };

          const updateStart = performance.now();
          const commands = engineRef.current.update(frame);
          const updateMs = performance.now() - updateStart;
          const rawCursor = engineRef.current.getCursor();
          const cursor = mapCursorRef.current(rawCursor);
          const debugState = engineRef.current.getDebugState();

          const mappedCommands = commands.map((cmd) =>
            cmd.type === "POINTER_CLICK" ? { ...cmd, xNorm: cursor.x, yNorm: cursor.y } : cmd
          );

          drawOverlay({
            canvas: overlayRef.current,
            cursor,
            hands: debug ? hands : undefined,
            debugState: debug ? debugState : undefined,
          });

          for (const cmd of mappedCommands) {
            onCommandRef.current(cmd);
          }

          const debugCallback = onDebugFrameRef.current;
          if (debugCallback) {
            const timings = debug ? { estimateMs, updateMs, totalMs: estimateMs + updateMs } : undefined;
            debugCallback({
              timestamp: now,
              fps: sinceLast ? 1000 / sinceLast : undefined,
              handCount: hands.length,
              hands: debug ? hands : undefined,
              cursor: { raw: rawCursor, mapped: cursor },
              debugState,
              commands: mappedCommands,
              timings,
            });
          }
        } catch (err) {
          handleError({ type: "model-init-failed", error: err });
        }

        scheduleNext();
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

function drawOverlay({
  canvas,
  cursor,
  hands,
  debugState,
}: {
  canvas: HTMLCanvasElement | null;
  cursor: Cursor;
  hands?: HandFrame["hands"];
  debugState?: GestureDebugState;
}) {
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

  if (hands && hands.length) {
    hands.forEach((hand) => {
      const color = hand.handedness === "Left" ? "#7c5dff" : "#46e6a5";
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      hand.landmarks.forEach((lm) => {
        ctx.beginPath();
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      const chain = [5, 6, 7, 8];
      ctx.beginPath();
      chain.forEach((idx, i) => {
        const lm = hand.landmarks[idx];
        if (!lm) return;
        const lx = lm.x * canvas.width;
        const ly = lm.y * canvas.height;
        if (i === 0) ctx.moveTo(lx, ly);
        else ctx.lineTo(lx, ly);
      });
      ctx.stroke();
    });
  }

  if (debugState) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px sans-serif";
    ctx.fillText(
      `mode: ${debugState.mode}${debugState.primaryHand ? ` (${debugState.primaryHand})` : ""}`,
      10,
      20
    );
  }
}
