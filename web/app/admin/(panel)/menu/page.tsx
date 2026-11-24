// web/app/admin/(panel)/menu/page.tsx  ->  /admin/menu
"use client";
import { useState } from "react";
import type { DietaryTag, MenuCategory, MenuItem } from "@/types/api";
import {
  createCategory, createMenuItem, deleteCategory, deleteMenuItem, getCategories, getMenuItems,
  renameCategory, updateMenuItem, type MenuItemInput,
} from "@/lib/admin-api";
import { errorMessage, fieldErrors, useLoad } from "@/lib/use-load";
import { money } from "@/lib/format";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { PhotoManager } from "@/components/admin/PhotoManager";
import { Button, Card, ErrorBox, Field, inputClass, Loading, PageTitle, Toggle } from "@/components/admin/ui";

const TAGS: { value: DietaryTag; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" }, { value: "vegan", label: "Vegan" }, { value: "halal", label: "Halal" },
  { value: "gluten-free", label: "Gluten-free" }, { value: "contains-nuts", label: "Contains nuts" }, { value: "spicy", label: "Spicy" },
];

export default function MenuPage() {
  const categories = useLoad(getCategories);
  const items = useLoad(() => getMenuItems());
  const [editing, setEditing] = useState<MenuItem | "new" | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<{ kind: "category"; c: MenuCategory } | { kind: "item"; i: MenuItem } | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const reloadAll = () => { categories.reload(); items.reload(); };

  // The one-click "Not available today" switch.
  async function toggleAvailable(item: MenuItem) {
    setBusyId(item.id);
    try {
      const updated = await updateMenuItem(item.id, { isAvailable: !item.isAvailable });
      items.setData(items.data!.map((i) => (i.id === item.id ? updated : i)));
    } catch (e) { setError(errorMessage(e)); items.reload(); } finally { setBusyId(null); }
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    try { await createCategory(newCategory.trim()); setNewCategory(""); categories.reload(); } catch (e) { setError(errorMessage(e)); }
  }

  async function rename(c: MenuCategory) {
    const name = window.prompt("New name for this section", c.name); // a simple box is fine here
    if (!name || name.trim() === c.name) return;
    try { await renameCategory(c.id, name.trim()); categories.reload(); } catch (e) { setError(errorMessage(e)); }
  }

  if (categories.loading || items.loading) return <Loading />;
  if (categories.error) return <ErrorBox message={categories.error} onRetry={reloadAll} />;
  if (items.error) return <ErrorBox message={items.error} onRetry={reloadAll} />;

  return (
    <div className="max-w-4xl space-y-6">
      <PageTitle action={<Button onClick={() => setEditing("new")}>Add a dish</Button>}>Menu</PageTitle>
      {error && <ErrorBox message={error} />}

      {categories.data!.map((c) => (
        <Card key={c.id}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{c.name}</h2>
            <span className="flex gap-2">
              <Button variant="secondary" onClick={() => rename(c)}>Rename</Button>
              <Button variant="secondary" onClick={() => setToDelete({ kind: "category", c })}>Delete section</Button>
            </span>
          </div>
          <ul className="divide-y divide-stone-200">
            {items.data!.filter((i) => i.categoryId === c.id).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-48 flex-1">
                  <p className={`font-medium ${i.isAvailable ? "" : "text-stone-400 line-through"}`}>{i.name}</p>
                  <p className="text-sm text-stone-600">{money(i.price)}{i.sideOptions.length ? ` · choice of ${i.sideOptions.length} sides` : ""}{i.dietaryTags.length ? " · " + i.dietaryTags.map((t) => TAGS.find((x) => x.value === t)?.label).join(", ") : ""}</p>
                </div>
                <Toggle checked={!i.isAvailable} busy={busyId === i.id} onChange={() => toggleAvailable(i)} label="Not available today" />
                <Button variant="secondary" onClick={() => setEditing(i)}>Edit</Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <Card>
        <h2 className="mb-2 font-bold">Add a menu section</h2>
        <div className="flex gap-2">
          <input className={inputClass} placeholder="For example: Desserts" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          <Button variant="secondary" onClick={addCategory}>Add</Button>
        </div>
      </Card>

      {editing && (
        <ItemEditor
          item={editing === "new" ? null : editing}
          categories={categories.data!}
          onClose={() => setEditing(null)}
          onSaved={() => { reloadAll(); }}
          onDelete={(i) => { setEditing(null); setToDelete({ kind: "item", i }); }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title={toDelete.kind === "category" ? `Delete the section "${toDelete.c.name}"?` : `Delete "${toDelete.i.name}"?`}
          text={toDelete.kind === "category" ? "You can only delete an empty section." : "If it is only off for today, use \"Not available today\" instead."}
          confirmLabel="Delete"
          danger
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            try {
              if (toDelete.kind === "category") await deleteCategory(toDelete.c.id); else await deleteMenuItem(toDelete.i.id);
              reloadAll();
            } catch (e) { setError(errorMessage(e)); }   // 409 not_empty shows its message here
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}

function ItemEditor({ item, categories, onClose, onSaved, onDelete }: {
  item: MenuItem | null; categories: MenuCategory[]; onClose: () => void; onSaved: () => void; onDelete: (i: MenuItem) => void;
}) {
  const [current, setCurrent] = useState<MenuItem | null>(item);
  const [form, setForm] = useState({
    categoryId: String(item?.categoryId ?? categories[0]?.id ?? ""),
    name: item?.name ?? "", description: item?.description ?? "", price: item ? String(item.price) : "",
    dietaryTags: item?.dietaryTags ?? ([] as DietaryTag[]), isAvailable: item?.isAvailable ?? true,
    sides: (item?.sideOptions ?? []).join(", "),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Please give the dish a name.";
    if (!(Number(form.price) > 0)) e.price = "Enter a price greater than 0.";
    // "Chips, Rice, Pap" -> ["Chips", "Rice", "Pap"]
    const sideOptions = form.sides.split(",").map((x) => x.trim()).filter(Boolean);
    if (sideOptions.length > 12) e.sideOptions = "Up to 12 sides.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const body: MenuItemInput = {
      categoryId: Number(form.categoryId), name: form.name.trim(), description: form.description.trim(),
      price: Number(form.price), dietaryTags: form.dietaryTags, isAvailable: form.isAvailable, sideOptions,
      sortOrder: current?.sortOrder ?? 99,
    };
    setBusy(true);
    try {
      const saved = current ? await updateMenuItem(current.id, body) : await createMenuItem(body);
      setCurrent(saved);   // after creating, the photo box appears
      onSaved();
      if (current) onClose();
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  const toggleTag = (t: DietaryTag) =>
    setForm({ ...form, dietaryTags: form.dietaryTags.includes(t) ? form.dietaryTags.filter((x) => x !== t) : [...form.dietaryTags, t] });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-lg space-y-4 overflow-y-auto bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{current ? `Edit ${current.name}` : "Add a dish"}</h2>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
        {error && <ErrorBox message={error} />}
        <Field label="Menu section">
          <select className={inputClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Dish name" error={errors.name}>
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Price (N$)" error={errors.price}>
          <input className={inputClass} inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </Field>
        <Field label="Sides the guest chooses from (optional)" error={errors.sideOptions}
          hint="Separate with commas, e.g. Chips, Rice, Pap. Leave empty if there is no choice. The guest picks exactly one.">
          <input className={inputClass} value={form.sides} onChange={(e) => setForm({ ...form, sides: e.target.value })} />
        </Field>
        <fieldset>
          <legend className="mb-1 font-medium">Dietary labels</legend>
          <div className="grid grid-cols-2 gap-2">
            {TAGS.map((t) => (
              <label key={t.value} className="flex min-h-11 items-center gap-2">
                <input type="checkbox" className="h-5 w-5" checked={form.dietaryTags.includes(t.value)} onChange={() => toggleTag(t.value)} /> {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Button onClick={save} busy={busy}>{current ? "Save dish" : "Create dish"}</Button>

        {current && (
          <>
            <hr />
            <h3 className="font-bold">Photo (one per dish)</h3>
            <PhotoManager photos={current.photo ? [current.photo] : []} target={{ menuItemId: current.id }} single
              onChanged={async () => { const fresh = (await getMenuItems()).find((i) => i.id === current.id); if (fresh) setCurrent(fresh); onSaved(); }} />
            <hr />
            <Button variant="danger" onClick={() => onDelete(current)}>Delete this dish</Button>
          </>
        )}
      </div>
    </div>
  );
}
