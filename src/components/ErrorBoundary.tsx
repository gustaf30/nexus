import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "var(--bg-void)",
            fontFamily: "var(--font-data)",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              padding: "var(--sp-6, 24px)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-mid)",
              borderRadius: "var(--radius-lg)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: 12,
              }}
            >
              Something went wrong
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: 16,
                wordBreak: "break-word",
              }}
            >
              {this.state.error?.message ?? "An unexpected error occurred."}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "8px 20px",
                fontSize: 12,
                fontFamily: "var(--font-data)",
                fontWeight: 600,
                color: "var(--bg-void)",
                background: "var(--accent-primary)",
                border: "none",
                borderRadius: "var(--radius-md, 6px)",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
