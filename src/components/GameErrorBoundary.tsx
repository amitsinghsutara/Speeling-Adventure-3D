"use client";

import { Component, type ReactNode } from "react";

interface GameErrorBoundaryProps {
  children: ReactNode;
  onError: (error: unknown) => void;
}

interface GameErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time failures from the 3D scene (for example a renderer that
 * fails to initialise) and reports them to the shell so it can show a
 * recoverable error state instead of a blank page.
 */
export class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  override state: GameErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GameErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}
