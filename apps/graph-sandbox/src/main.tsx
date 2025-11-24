import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { GraphCanvas } from "@spatial-ui-kit/graph-three";
import {
  OrbitViewportController,
  type ViewportCommand,
} from "@spatial-ui-kit/control-core";
import type { Graph } from "@spatial-ui-kit/graph-core";
import {
  useGestureControl,
  type GestureDebugFrame,
  type GestureError,
} from "@spatial-ui-kit/gesture-react";
import {
  createTFJSHandModel,
  type HandModel,
} from "@spatial-ui-kit/handtracking-tfjs";

import "./style.css";

type NodeData = { label?: string };
type EdgeData = Record<string, never>;

type GestureClick = { xNorm: number; yNorm: number; token: number };
type CommandLogEntry = { id: number; at: number; command: ViewportCommand };
type GestureRuntime = "mediapipe" | "tfjs";
type TfjsModelType = "lite" | "full";

const COMMAND_LOG_LIMIT = 25;

const sampleGraph: Graph<NodeData, EdgeData> = {
  nodes: [
    { id: "a", position: [-4, 0, 0], data: { label: "Alpha" } },
    { id: "b", position: [4, 0, 0], data: { label: "Beta" } },
    { id: "c", position: [0, 4, 0], data: { label: "Gamma" } },
    { id: "d", position: [0, -4, 0], data: { label: "Delta" } },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", data: {} },
    { id: "ac", source: "a", target: "c", data: {} },
    { id: "ad", source: "a", target: "d", data: {} },
    { id: "bc", source: "b", target: "c", data: {} },
    { id: "bd", source: "b", target: "d", data: {} },
  ],
};

function useHandModel(enabled: boolean, runtime: GestureRuntime, modelType?: TfjsModelType) {
  const [model, setModel] = useState<HandModel | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setModel(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    createTFJSHandModel({ runtime, modelType })
      .then((m) => {
        if (!cancelled) {
          setModel(m);
          setStatus("ready");
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, runtime, modelType]);

  return { model, status };
}

function App() {
  const controller = useMemo(
    () =>
      new OrbitViewportController({
        inertia: {
          enabled: true,
          rotationFriction: 0.3,
          panFriction: 0.3,
          zoomFriction: 0.4,
        },
        clampVertical: false,
      }),
    []
  );
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [gestureRuntime, setGestureRuntime] = useState<GestureRuntime>("mediapipe");
  const [tfjsModelType, setTfjsModelType] = useState<TfjsModelType>("lite");
  const [showDebug, setShowDebug] = useState(false);
  const [debugFrame, setDebugFrame] = useState<GestureDebugFrame | null>(null);
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const { model, status } = useHandModel(
    gestureEnabled,
    gestureRuntime,
    gestureRuntime === "tfjs" ? tfjsModelType : undefined
  );
  const gestureTokenRef = useRef(0);
  const commandIdRef = useRef(0);
  const [gestureClick, setGestureClick] = useState<GestureClick | null>(null);
  const [lastNode, setLastNode] = useState<string | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const debugActive = gestureEnabled && showDebug;
  const gestureConfig = useMemo(
    () => ({
      rotationSensitivity: 400,
      panSensitivity: 220,
      zoomSensitivity: 8,
      moveDeadzone: 0.0008,
      zoomDeadzone: 0.0005,
    }),
    []
  );
  const gestureFps = gestureRuntime === "tfjs" && tfjsModelType === "lite" ? 12 : 20;

  const handleCommand = (cmd: ViewportCommand) => {
    if (cmd.type === "POINTER_CLICK") {
      const token = ++gestureTokenRef.current;
      setGestureClick({ xNorm: cmd.xNorm, yNorm: cmd.yNorm, token });
      return;
    }
    controller.handle(cmd);
  };

  const handleDebugFrame = (frame: GestureDebugFrame) => {
    setLastError(null);
    setDebugFrame(frame);
    if (frame.commands.length) {
      const now = Date.now();
      const entries = frame.commands.map((command) => ({
        id: ++commandIdRef.current,
        at: now,
        command,
      }));
      setCommandLog((prev) => {
        const next = [...entries, ...prev];
        return next.slice(0, COMMAND_LOG_LIMIT);
      });
    }
  };

  const handleError = (err: GestureError) => {
    setLastError(describeError(err));
    console.error("Gesture error", err);
  };

  useEffect(() => {
    if (!debugActive) {
      setDebugFrame(null);
      setCommandLog([]);
    }
  }, [debugActive]);

  useEffect(() => {
    if (!gestureEnabled) {
      setLastError(null);
    }
  }, [gestureEnabled]);

  const handCountLabel = debugActive ? debugFrame?.handCount ?? 0 : "—";
  const modeLabel = debugFrame?.debugState.mode ?? "—";
  const primaryHandLabel = debugFrame?.debugState.primaryHand ?? "—";

  const { videoRef, overlayRef } = useGestureControl({
    model,
    onCommand: handleCommand,
    mapCursorToViewport: (cursor) => cursor,
    fps: gestureFps,
    debug: debugActive,
    onDebugFrame: debugActive ? handleDebugFrame : undefined,
    onError: handleError,
    gestureOptions: gestureConfig,
  });

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    let dragging = false;
    let mode: "rotate" | "pan" = "rotate";
    let last = { x: 0, y: 0 };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0 && ev.button !== 2) return;
      dragging = true;
      mode = ev.ctrlKey || ev.button === 2 ? "pan" : "rotate";
      last = { x: ev.clientX, y: ev.clientY };
      el.setPointerCapture(ev.pointerId);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragging) return;
      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      last = { x: ev.clientX, y: ev.clientY };
      const scale = 0.005;
      if (mode === "rotate") {
        controller.handle({
          type: "ROTATE",
          dx: dx * scale * 50,
          dy: dy * scale * 50,
        });
      } else {
        controller.handle({
          type: "PAN",
          dx: dx * scale * 50,
          dy: -dy * scale * 50,
        });
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      dragging = false;
      el.releasePointerCapture(ev.pointerId);
    };

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const delta = -ev.deltaY * 0.001;
      controller.handle({ type: "ZOOM", delta });
    };

    const onContextMenu = (ev: MouseEvent) => ev.preventDefault();

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointerleave", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerleave", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [controller]);

  return (
    <div className="app">
      <header className="hud">
        <div>
          <strong>Graph Sandbox</strong>
          <div className="sub">
            Rotate/Pan/Zoom with mouse; enable gestures to tap nodes.
          </div>
        </div>
        <div className="controls">
          <button onClick={() => setGestureEnabled((v) => !v)}>
            {gestureEnabled ? "Disable gestures" : "Enable gestures"}
          </button>
          <button
            onClick={() => setShowDebug((v) => !v)}
            disabled={!gestureEnabled}
          >
            {debugActive ? "Hide gesture debug" : "Show gesture debug"}
          </button>
          <label className="badge select-badge">
            Runtime
            <select
              value={gestureRuntime}
              onChange={(e) =>
                setGestureRuntime(e.target.value as GestureRuntime)
              }
              disabled={gestureEnabled}
            >
              <option value="mediapipe">Mediapipe</option>
              <option value="tfjs">TFJS</option>
            </select>
          </label>
          {gestureRuntime === "tfjs" && (
            <label className="badge select-badge">
              TFJS model
              <select
                value={tfjsModelType}
                onChange={(e) => setTfjsModelType(e.target.value as TfjsModelType)}
                disabled={gestureEnabled}
              >
                <option value="lite">Lite (lower FPS)</option>
                <option value="full">Full</option>
              </select>
            </label>
          )}
          <span className={`badge status-badge status-${status}`}>
            Model: {status}
          </span>
          <span className="badge">Hands: {handCountLabel}</span>
          {lastError && <span className="badge error">Error: {lastError}</span>}
          {lastNode && <span className="badge">Last node: {lastNode}</span>}
        </div>
      </header>

      <div className="canvas-wrapper" ref={canvasContainerRef}>
        <GraphCanvas
          graph={sampleGraph}
          controller={controller}
          gestureClick={gestureClick ?? undefined}
          onNodeClick={(node) => setLastNode(node.id)}
          onNodeHover={() => undefined}
        />
        <div className="debug-panel" data-open={debugActive}>
          <div className="panel-row">
            <div className="card video-card">
              <div className="card-head">
                <span>Webcam</span>
                <span className="pill">{status}</span>
              </div>
              <div className="video-shell">
                <video
                  ref={videoRef}
                  className="video-feed"
                  muted
                  playsInline
                  data-visible={debugActive}
                />
                <canvas ref={overlayRef} className="video-overlay" />
              </div>
              <div className="legend">
                <span className="left">Left hand</span>
                <span className="right">Right hand</span>
              </div>
            </div>
            <div className="card metrics-card">
              <div className="card-head">
                <span>Gesture state</span>
                <span className="pill subtle">
                  {debugActive ? "live" : "paused"}
                </span>
              </div>
              <div className="metrics-grid">
                <div className="metric">
                  <div className="metric-label">Mode</div>
                  <div className="metric-value">{modeLabel}</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Primary hand</div>
                  <div className="metric-value">{primaryHandLabel}</div>
                </div>
                <div className="metric">
                  <div className="metric-label">FPS</div>
                  <div className="metric-value">
                    {formatNumber(debugFrame?.fps, 1)}
                  </div>
                </div>
                <div className="metric">
                  <div className="metric-label">Hands</div>
                  <div className="metric-value">{handCountLabel}</div>
                </div>
                <div className="metric">
                  <div className="metric-label">Estimate ms</div>
                  <div className="metric-value">
                    {formatNumber(debugFrame?.timings?.estimateMs, 1)}
                  </div>
                </div>
                <div className="metric">
                  <div className="metric-label">Update ms</div>
                  <div className="metric-value">
                    {formatNumber(debugFrame?.timings?.updateMs, 1)}
                  </div>
                </div>
              </div>
              {lastError && (
                <div className="error-callout">Last error: {lastError}</div>
              )}
            </div>
          </div>
          <div className="card log-card">
            <div className="card-head">
              <span>Command log (last {COMMAND_LOG_LIMIT})</span>
              <button
                className="ghost"
                onClick={() => setCommandLog([])}
                disabled={!commandLog.length}
              >
                Clear
              </button>
            </div>
            <div className="log-list">
              {commandLog.length === 0 && (
                <div className="log-empty">No commands yet.</div>
              )}
              {commandLog.map((entry) => (
                <div key={entry.id} className="log-row">
                  <span className="log-time">{formatTime(entry.at)}</span>
                  <span className="log-cmd">
                    {describeCommand(entry.command)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNumber(value?: number, digits = 1) {
  if (value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour12: false });
}

function describeCommand(cmd: ViewportCommand) {
  switch (cmd.type) {
    case "ROTATE":
      return `ROTATE dx=${cmd.dx.toFixed(2)} dy=${cmd.dy.toFixed(2)}`;
    case "PAN":
      return `PAN dx=${cmd.dx.toFixed(2)} dy=${cmd.dy.toFixed(2)}`;
    case "ZOOM":
      return `ZOOM Δ=${cmd.delta.toFixed(3)}`;
    case "POINTER_CLICK":
      return `CLICK x=${cmd.xNorm.toFixed(2)} y=${cmd.yNorm.toFixed(2)}`;
  }
}

function describeError(err: GestureError): string {
  if (err.type === "model-init-failed") {
    const message =
      (err as any)?.error?.message ?? String((err as any)?.error ?? "");
    return message ? `model-init-failed: ${message}` : "model-init-failed";
  }
  return err.type;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
