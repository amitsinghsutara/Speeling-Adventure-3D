export type RendererErrorCode = "unsupported" | "context-lost" | "init-failed";

/**
 * Typed renderer failure. The shell maps these to child-friendly copy; the
 * original technical detail is preserved for adults and bug reports.
 */
export class RendererError extends Error {
  readonly code: RendererErrorCode;

  constructor(code: RendererErrorCode, detail: string) {
    super(detail);
    this.name = "RendererError";
    this.code = code;
  }
}

export interface RendererErrorInfo {
  code: RendererErrorCode;
  title: string;
  message: string;
  detail: string;
}

const COPY: Record<RendererErrorCode, { title: string; message: string }> = {
  unsupported: {
    title: "This browser can't draw the forest yet",
    message:
      "Fern needs a browser with 3D graphics turned on. Try a different browser, or ask a grown-up to check the graphics settings.",
  },
  "context-lost": {
    title: "The forest took a little nap",
    message:
      "The picture stopped for a moment. Tap Try again to wake the meadow back up.",
  },
  "init-failed": {
    title: "Oops! The forest couldn't wake up",
    message:
      "Something went wrong while drawing the meadow. Tap Try again, and if it keeps happening, try closing other tabs or apps.",
  },
};

export function toRendererErrorInfo(error: unknown): RendererErrorInfo {
  if (error instanceof RendererError) {
    return { code: error.code, ...COPY[error.code], detail: error.message };
  }
  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "Unknown error";
  return { code: "init-failed", ...COPY["init-failed"], detail };
}
