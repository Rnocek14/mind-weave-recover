/**
 * AppErrorBoundary — global crash guard.
 *
 * Without this, any render throw unmounts the entire React tree and leaves an
 * empty #root: a silent white screen, which for an aphasia patient is a dead
 * end with no words to describe what happened. The fallback is deliberately
 * aphasia-friendly: minimal text, large tap targets, one obvious action.
 *
 * Errors are logged to console (visible in dev / device inspection) and kept
 * in sessionStorage so a caregiver or support can retrieve the last crash.
 * Wire a reporting service (e.g. Sentry) inside `recordCrash` when one is
 * added — this is the single funnel for render crashes.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

const LAST_CRASH_KEY = "last_render_crash_v1";

function recordCrash(source: string, message: string, detail?: string) {
  console.error(`[AppErrorBoundary] ${source}:`, message, detail ?? "");
  try {
    sessionStorage.setItem(
      LAST_CRASH_KEY,
      JSON.stringify({
        source,
        message,
        detail: detail?.slice(0, 4000),
        at: new Date().toISOString(),
        url: window.location.pathname,
      })
    );
  } catch {
    // Storage unavailable — console is the best we can do.
  }
}

/** Global handlers for errors that never reach the React tree. */
export function installGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    recordCrash("window.onerror", event.message, event.error?.stack);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    recordCrash(
      "unhandledrejection",
      reason instanceof Error ? reason.message : String(reason),
      reason instanceof Error ? reason.stack : undefined
    );
  });
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordCrash("render", error.message, `${error.stack ?? ""}\n${info.componentStack ?? ""}`);
  }

  private handleReload = () => {
    window.location.href = "/today";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // Inline styles only: index.css may not have loaded if the crash was early.
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#F8FAF9",
          color: "#1A2B2C",
        }}
      >
        <div style={{ fontSize: "3rem" }} aria-hidden="true">
          ⚠️
        </div>
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: "1.1rem", margin: 0, maxWidth: "26rem" }}>
          Your practice is saved. Tap the button to go back.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            fontSize: "1.25rem",
            padding: "1rem 2.5rem",
            minHeight: "56px",
            borderRadius: "12px",
            border: "none",
            background: "#0F6B66",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Go back home
        </button>
      </div>
    );
  }
}
