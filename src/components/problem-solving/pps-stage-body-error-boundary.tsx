"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import {
  createPlatformBoundaryReference,
  logPlatformBoundaryError,
  sanitizeBoundaryMessage,
} from "@/platform/observability/platform-boundary";

type PpsStageBodyErrorBoundaryProps = {
  children: React.ReactNode;
  stageKey: string | null;
};

type PpsStageBodyErrorBoundaryState = {
  error: Error | null;
  reference: string;
  remountKey: number;
};

export class PpsStageBodyErrorBoundary extends React.Component<
  PpsStageBodyErrorBoundaryProps,
  PpsStageBodyErrorBoundaryState
> {
  override state: PpsStageBodyErrorBoundaryState = {
    error: null,
    reference: "",
    remountKey: 0,
  };

  static getDerivedStateFromError(
    error: Error,
  ): Partial<PpsStageBodyErrorBoundaryState> {
    return {
      error,
      reference: createPlatformBoundaryReference(),
    };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const reference =
      this.state.reference.length > 0
        ? this.state.reference
        : createPlatformBoundaryReference();
    logPlatformBoundaryError({
      category: "request",
      operation: "pps_stage_body_render",
      reference,
      supabaseMessage: sanitizeBoundaryMessage(error.message),
      renderSource:
        errorInfo.componentStack?.split("\n").slice(0, 3).join(" | ") ?? null,
      route: this.props.stageKey,
    });
  }

  private handleRetry = () => {
    this.setState((prev) => ({
      error: null,
      reference: "",
      remountKey: prev.remountKey + 1,
    }));
  };

  override render() {
    if (this.state.error) {
      return (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3"
          data-testid="pps-stage-body-error"
          role="alert"
        >
          <p className="text-sm font-medium text-foreground">
            This section couldn&apos;t load.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            data-testid="pps-stage-body-error-retry"
            onClick={this.handleRetry}
          >
            Retry
          </Button>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.remountKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
