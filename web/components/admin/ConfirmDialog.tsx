// web/components/admin/ConfirmDialog.tsx
// "Are you sure?" box. With withMessage, it also offers a text box for a note to the guest.
"use client";
import { useState } from "react";
import { Button, inputClass } from "./ui";

type Props = {
  title: string;
  text: string;
  confirmLabel: string;
  withMessage?: boolean;
  danger?: boolean;
  onConfirm: (message: string) => Promise<void> | void;
  onClose: () => void;
};

export function ConfirmDialog({ title, text, confirmLabel, withMessage, danger, onConfirm, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm(message.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-stone-700">{text}</p>
        {withMessage && (
          <label className="block space-y-1">
            <span className="font-medium">Message to the guest (optional)</span>
            <textarea
              className={inputClass}
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="For example: Sorry, we are fully booked for those dates."
            />
            <span className="block text-right text-sm text-stone-500">{message.length}/500</span>
          </label>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Go back</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={confirm} busy={busy}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
