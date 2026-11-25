// web/components/admin/PhotoManager.tsx
// Upload, describe, reorder and remove photos for a room, a menu item or the gallery.
"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import type { Photo } from "@/types/api";
import { attachPhoto, deletePhoto, reorderPhotos, updatePhotoAlt, uploadFile, type PhotoTarget } from "@/lib/admin-api";
import { errorMessage } from "@/lib/use-load";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button, ErrorBox, Field, inputClass, Spinner } from "./ui";

const MAX_BYTES = 5 * 1024 * 1024; // same limit as the API
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  photos: Photo[];
  target: PhotoTarget;
  single?: boolean;          // menu items have one photo only
  onChanged: () => void;     // ask the screen to reload
};

export function PhotoManager({ photos, target, single, onChanged }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [altError, setAltError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Photo[]>(photos);
  const [dragId, setDragId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<Photo | null>(null);

  // Keep local order in step when the screen reloads the photos.
  const [lastPhotos, setLastPhotos] = useState(photos);
  if (photos !== lastPhotos) { setLastPhotos(photos); setOrder(photos); }

  function pickFile(f: File | undefined) {
    setError("");
    if (!f) return setFile(null);
    if (!ALLOWED.includes(f.type)) return setError("Please choose a JPEG, PNG or WebP photo.");
    if (f.size > MAX_BYTES) return setError("This photo is bigger than 5 MB. Please choose a smaller one.");
    setFile(f);
  }

  async function upload() {
    if (!file) return setError("Choose a photo first.");
    if (!alt.trim()) return setAltError("Please describe the photo.");
    setAltError("");
    setUploading(true);
    setError("");
    try {
      const up = await uploadFile(file);               // step 1: upload the file
      await attachPhoto(up.url, alt.trim(), target);   // step 2: attach the URL
      setFile(null);
      setAlt("");
      if (fileInput.current) fileInput.current.value = "";
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function saveOrder(next: Photo[]) {
    setOrder(next);
    try {
      await reorderPhotos(next.map((p) => p.id));
    } catch (e) {
      setError(errorMessage(e));
      onChanged();
    }
  }

  function move(index: number, by: number) {
    const next = [...order];
    const [p] = next.splice(index, 1);
    next.splice(index + by, 0, p);
    saveOrder(next);
  }

  function dropOn(targetId: number) {
    if (dragId === null || dragId === targetId) return;
    const next = [...order];
    const from = next.findIndex((p) => p.id === dragId);
    const [p] = next.splice(from, 1);
    next.splice(next.findIndex((x) => x.id === targetId), 0, p);
    setDragId(null);
    saveOrder(next);
  }

  async function saveAlt(photo: Photo, newAlt: string) {
    if (newAlt.trim() === photo.alt) return;
    if (!newAlt.trim()) return setError("A photo description can't be empty.");
    try {
      await updatePhotoAlt(photo.id, newAlt.trim());
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}

      {order.length > 0 && (
        <ul className="space-y-2">
          {order.map((p, i) => (
            <li
              key={p.id}
              draggable={!single}
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(p.id)}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-2"
            >
              {!single && <span className="cursor-grab select-none text-stone-400" title="Drag to reorder">⠿</span>}
              <img src={p.url} alt={p.alt} className="h-16 w-24 rounded object-cover" />
              <input
                className={`${inputClass} min-w-40 flex-1`}
                defaultValue={p.alt}
                aria-label="Describe this photo"
                onBlur={(e) => saveAlt(p, e.target.value)}
              />
              {!single && (
                <span className="flex gap-1">
                  <Button variant="secondary" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
                  <Button variant="secondary" onClick={() => move(i, 1)} disabled={i === order.length - 1}>↓</Button>
                </span>
              )}
              <Button variant="secondary" onClick={() => setToDelete(p)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-lg border border-dashed border-stone-300 p-4">
        <p className="font-medium">{single && order.length > 0 ? "Replace the photo" : "Add a photo"}</p>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => pickFile(e.target.files?.[0])}
          className="block w-full text-sm"
        />
        <Field label="Describe this photo (for blind visitors and Google)" error={altError}>
          <input className={inputClass} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="For example: Type I room with two beds" />
        </Field>
        <Button onClick={upload} busy={uploading}>{uploading ? "Uploading…" : "Upload photo"}</Button>
        {uploading && <p className="flex items-center gap-2 text-sm text-stone-600"><Spinner /> This can take a few seconds on mobile data.</p>}
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Remove this photo?"
          text="It will disappear from the website."
          confirmLabel="Remove photo"
          danger
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            try { await deletePhoto(toDelete.id); onChanged(); } catch (e) { setError(errorMessage(e)); }
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}
