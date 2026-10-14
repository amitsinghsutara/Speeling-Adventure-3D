import { toRendererErrorInfo } from "@/game/graphics/errors";

export interface RenderErrorScreenProps {
  error: unknown;
  onRetry: () => void;
}

/**
 * Child-friendly, recoverable error state shown when the 3D renderer cannot
 * start or stops working. Correctness is conveyed with text and an icon, not
 * colour alone, and the retry control is a large touch target.
 */
export function RenderErrorScreen({ error, onRetry }: RenderErrorScreenProps) {
  const info = toRendererErrorInfo(error);
  return (
    <div className="overlay overlay--error">
      <div className="card" role="alert">
        <div className="card__icon" aria-hidden="true">
          🦊
        </div>
        <h1>{info.title}</h1>
        <p>{info.message}</p>
        <button type="button" className="button" onClick={onRetry}>
          Try again
        </button>
        <details>
          <summary>Details for grown-ups</summary>
          <code>{info.detail}</code>
        </details>
      </div>
    </div>
  );
}
