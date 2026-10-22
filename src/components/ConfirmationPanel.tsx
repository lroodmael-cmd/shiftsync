"use client";
import { ContextPanel } from "./ContextPanel";
export function ConfirmationPanel({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  onClose = onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onClose?: () => void;
}) {
  return (
    <ContextPanel title={title} onClose={onClose}>
      <p className="sub">{message}</p>
      <div className="editor-actions">
        <button type="button" className="primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </ContextPanel>
  );
}
