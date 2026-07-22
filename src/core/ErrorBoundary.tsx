'use client';
import { Component, type ReactNode } from 'react';

/**
 * The app must never white-screen in front of a judge. Used at the app root
 * and around each chapter's DOM beats; a chapter crash offers a way home.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void; label?: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[eow] boundary caught:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-950 text-center text-stone-200">
        <div className="text-lg">The record here is damaged.</div>
        <div className="mt-1 text-sm text-stone-400">
          {this.props.label ?? 'Something went wrong.'}
        </div>
        <button
          className="mt-6 rounded border border-stone-500 px-4 py-2 text-sm hover:bg-stone-800"
          onClick={() => {
            this.setState({ hasError: false });
            this.props.onReset?.();
          }}
        >
          Return to the map
        </button>
      </div>
    );
  }
}
