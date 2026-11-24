// web/app/admin/(panel)/content/page.tsx  ->  /admin/content  (Website text and gallery)
"use client";
import { useState } from "react";
import type { PageContent, PageSection } from "@/types/api";
import { getContent, getGallery, saveContent } from "@/lib/admin-api";
import { errorMessage, fieldErrors, useLoad } from "@/lib/use-load";
import { windhoekTime } from "@/lib/format";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { Button, Card, ErrorBox, Field, inputClass, Loading, PageTitle, SuccessBox } from "@/components/admin/ui";

// Plain names and the website address for each page key (spec v1.1 has six).
const PAGES: Record<PageContent["key"], { name: string; path: string }> = {
  home: { name: "Home page", path: "/" },
  about: { name: "About page", path: "/about" },
  rooms: { name: "Rooms page", path: "/rooms" },
  restaurant: { name: "Restaurant page", path: "/restaurant" },
  events: { name: "Meetings and events page", path: "/events" },
  contact: { name: "Contact page", path: "/contact" },
};
const MAX_SECTIONS = 12;
const MAX_BODY = 3000;

export default function ContentPage() {
  const pages = useLoad(getContent);
  const gallery = useLoad(getGallery);
  const [open, setOpen] = useState<PageContent["key"]>("home");

  return (
    <div className="max-w-3xl space-y-6">
      <PageTitle>Website text and photos</PageTitle>
      {pages.loading && <Loading />}
      {pages.error && <ErrorBox message={pages.error} onRetry={pages.reload} />}

      {pages.data && (
        <>
          {/* One page at a time, so the screen stays short on a phone. */}
          <Field label="Which page do you want to edit?">
            <select className={inputClass} value={open} onChange={(e) => setOpen(e.target.value as PageContent["key"])}>
              {pages.data.map((p) => <option key={p.key} value={p.key}>{PAGES[p.key]?.name ?? p.key}</option>)}
            </select>
          </Field>
          {pages.data.filter((p) => p.key === open).map((p) => <PageEditor key={p.key} page={p} onSaved={pages.reload} />)}
        </>
      )}

      <Card>
        <h2 className="mb-1 text-lg font-bold">Gallery photos</h2>
        <p className="mb-3 text-sm text-stone-600">These show in the website&apos;s gallery, in this order.</p>
        {gallery.loading && <Loading />}
        {gallery.error && <ErrorBox message={gallery.error} onRetry={gallery.reload} />}
        {gallery.data && <PhotoManager photos={gallery.data} target={{ isGallery: true }} onChanged={gallery.reload} />}
      </Card>
    </div>
  );
}

function PageEditor({ page, onSaved }: { page: PageContent; onSaved: () => void }) {
  const [title, setTitle] = useState(page.title);
  const [subtitle, setSubtitle] = useState(page.subtitle);
  const [sections, setSections] = useState<PageSection[]>(page.sections);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const info = PAGES[page.key];

  const edit = (i: number, changes: Partial<PageSection>) => {
    setSections(sections.map((s, n) => (n === i ? { ...s, ...changes } : s)));
    setSaved(false);
  };
  const move = (i: number, by: number) => {
    const next = [...sections];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s);
    setSections(next);
    setSaved(false);
  };
  const remove = (i: number) => {
    if (!window.confirm("Remove this section? It is only gone for good once you press Save.")) return;
    setSections(sections.filter((_, n) => n !== i));
    setSaved(false);
  };

  async function save() {
    setBusy(true); setError(""); setSaved(false);
    try {
      await saveContent(page.key, { title: title.trim(), subtitle: subtitle.trim(), sections }); // PUT replaces the whole page
      setSaved(true);
      onSaved();
    } catch (e) {
      const fe = Object.values(fieldErrors(e));
      setError(fe.length ? fe.join(" ") : errorMessage(e));
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{info.name}</h2>
          <a href={info.path} target="_blank" rel="noreferrer" className="text-sm underline">View on website ↗</a>
        </div>
        {error && <ErrorBox message={error} />}
        {saved && <SuccessBox message="Saved. The website will show it within 5 minutes." />}
        <Field label="Big heading at the top">
          <input className={inputClass} value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} />
        </Field>
        <Field label="Line under the heading">
          <textarea className={inputClass} rows={2} value={subtitle} onChange={(e) => { setSubtitle(e.target.value); setSaved(false); }} />
        </Field>

        {sections.map((s, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">Section {i + 1}</span>
              <span className="flex gap-1">
                <Button variant="secondary" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
                <Button variant="secondary" onClick={() => move(i, 1)} disabled={i === sections.length - 1}>↓</Button>
                <Button variant="secondary" onClick={() => remove(i)}>Remove</Button>
              </span>
            </div>
            <Field label="Section heading">
              <input className={inputClass} value={s.heading} onChange={(e) => edit(i, { heading: e.target.value })} />
            </Field>
            <Field label="Text" hint={`Leave an empty line to start a new paragraph. ${s.body.length} / ${MAX_BODY} characters.`}>
              <textarea className={inputClass} rows={6} maxLength={MAX_BODY} value={s.body} onChange={(e) => edit(i, { body: e.target.value })} />
            </Field>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" disabled={sections.length >= MAX_SECTIONS}
            onClick={() => { setSections([...sections, { heading: "", body: "" }]); setSaved(false); }}>
            Add a section
          </Button>
          <Button onClick={save} busy={busy}>Save {info.name.toLowerCase()}</Button>
        </div>
        <p className="text-sm text-stone-500">Last saved {windhoekTime(page.updatedAt)}</p>
      </div>
    </Card>
  );
}
