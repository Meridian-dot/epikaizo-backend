// web/components/admin/BookingActions.tsx
// Confirm / Decline / Cancel buttons. Shows only the buttons the status allows (spec section 6).
"use client";
import { useState } from "react";
import type { BookingAction, BookingStatus } from "@/types/api";
import { allowedActions } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/use-load";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button, ErrorBox } from "./ui";

type Props = {
  status: BookingStatus;
  guestName: string;
  decide: (action: BookingAction, message?: string) => Promise<unknown>;
  onDone: () => void;      // reload the booking (and the sidebar counts)
};

const LABEL: Record<BookingAction, string> = { confirm: "Confirm", decline: "Decline", cancel: "Cancel booking" };

export function BookingActions({ status, guestName, decide, onDone }: Props) {
  const [busy, setBusy] = useState<BookingAction | null>(null);
  const [asking, setAsking] = useState<BookingAction | null>(null);
  const [error, setError] = useState("");
  const actions = allowedActions[status];

  async function run(action: BookingAction, message?: string) {
    setBusy(action);
    setError("");
    try {
      await decide(action, message);
    } catch (e) {
      setError(errorMessage(e));
      // 404 / 409: someone else changed it, or no room is free. Reload instead of retrying.
      if (!(e instanceof ApiError && [404, 409].includes(e.status))) { setBusy(null); return; }
    }
    setBusy(null);
    setAsking(null);
    onDone();
  }

  if (actions.length === 0) return error ? <ErrorBox message={error} /> : null;

  return (
    <div className="space-y-2">
      {error && <ErrorBox message={error} />}
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a}
            variant={a === "confirm" ? "primary" : "danger"}
            busy={busy === a}
            disabled={busy !== null}
            onClick={() => (a === "confirm" ? run(a) : setAsking(a))}
          >
            {LABEL[a]}
          </Button>
        ))}
      </div>
      {asking && (
        <ConfirmDialog
          title={asking === "decline" ? "Decline this request?" : "Cancel this booking?"}
          text={`${guestName} will get an email straight away. This can't be undone.`}
          confirmLabel={asking === "decline" ? "Yes, decline" : "Yes, cancel"}
          withMessage
          danger
          onClose={() => setAsking(null)}
          onConfirm={(message) => run(asking, message)}
        />
      )}
    </div>
  );
}
