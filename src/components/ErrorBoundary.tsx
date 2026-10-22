import { Component, type ReactNode } from 'react';

/** If a screen crashes, show a friendly message with a way back instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error(err); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="stack" style={{ minHeight: '100dvh', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: 24 }}>
        <h1 className="h1" style={{ fontSize: 26 }}>Something went wrong</h1>
        <p className="lead">Sorry about that. Reloading the app usually fixes it.</p>
        <button className="btn" style={{ width: 'auto', padding: '0 28px' }} onClick={() => { location.href = import.meta.env.BASE_URL; }}>Reload the app</button>
      </div>
    );
  }
}
