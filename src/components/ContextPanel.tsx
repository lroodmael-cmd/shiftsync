"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function ContextPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="shift-dialog"
      aria-labelledby="context-panel-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="editor-inner">
        <div className="editor-heading">
          <span className="eyebrow">YOUR WORK, IN ONE PLACE</span>
          <button
            type="button"
            className="iconbutton"
            aria-label="Close panel"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="context-panel-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
