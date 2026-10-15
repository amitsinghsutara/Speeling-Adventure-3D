"use client";

import { useEffect, useRef } from "react";

export interface NoticeDialogProps {
  icon: string;
  title: string;
  message: string;
  /** Optional action button (e.g. "Go through") shown beside the close button. */
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

/** Small child-facing notice (gate locked / open), closable with Escape. */
export function NoticeDialog({ icon, title, message, actionLabel, onAction, onClose }: NoticeDialogProps) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current?.focus();
  }, []);
  return (
    <div className="overlay overlay--dialog">
      <div
        ref={dialog}
        className="card"
        role="alertdialog"
        aria-labelledby="notice-title"
        aria-modal="true"
        tabIndex={-1}
        data-testid="notice"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <div className="card__icon" aria-hidden="true">
          {icon}
        </div>
        <h1 id="notice-title">{title}</h1>
        <p>{message}</p>
        <div className="challenge__actions">
          {actionLabel && onAction ? (
            <button type="button" className="button" onClick={onAction} autoFocus>
              {actionLabel}
            </button>
          ) : null}
          <button type="button" className={`button ${actionLabel ? "button--secondary" : ""}`} onClick={onClose}>
            {actionLabel ? "Not yet" : "Okay"}
          </button>
        </div>
      </div>
    </div>
  );
}
