"use client";

import { useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useItems, useSuppliers } from "@/lib/hooks";
import type { Supplier } from "@/lib/types";
import { Button, ErrorText, Field, Input, Modal, PageHeader, Td, Textarea, Th } from "@/components/ui";

export default function SuppliersPage() {
  const { data: suppliers } = useSuppliers();
  const { data: items } = useItems();
  const [edit, setEdit] = useState<Supplier | "new" | null>(null);
  return (
    <>
      <PageHeader title="Suppliers" sub="Seeded with placeholder vendors by category — rename them and add phone numbers so POs can be sent on WhatsApp." actions={<Button onClick={() => setEdit("new")}>Add supplier</Button>} />
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-100 bg-stone-50"><tr><Th>Supplier</Th><Th>Contact</Th><Th>GSTIN</Th><Th className="text-right">Lead time</Th><Th className="text-right">Items</Th><Th /></tr></thead>
          <tbody>
            {[...suppliers].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
              <tr key={s.id} className="border-b border-stone-50">
                <Td className="font-medium">{s.name}</Td>
                <Td className="text-xs">{[s.contactName, s.phone, s.email].filter(Boolean).join(" · ") || "—"}</Td>
                <Td className="text-xs">{s.gstin || "—"}</Td>
                <Td className="text-right">{s.leadTimeDays} d</Td>
                <Td className="text-right">{items.filter((i) => i.supplierId === s.id).length}</Td>
                <Td><Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <SupplierModal s={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function SupplierModal({ s, onClose }: { s: Supplier | null; onClose: () => void }) {
  const [f, setF] = useState<Partial<Supplier>>(s ?? { leadTimeDays: 1 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Supplier) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: k === "leadTimeDays" ? Number(e.target.value) || 0 : e.target.value });
  async function save() {
    if (!f.name) return setErr("Name is required");
    setBusy(true);
    try {
      const { id: _id, ...data } = f;
      if (s) await updateDoc(doc(db, "suppliers", s.id), data);
      else await addDoc(collection(db, "suppliers"), data);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={s ? `Edit ${s.name}` : "Add supplier"}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Name"><Input value={f.name ?? ""} onChange={set("name")} /></Field></div>
        <Field label="Contact person"><Input value={f.contactName ?? ""} onChange={set("contactName")} /></Field>
        <Field label="Phone (WhatsApp)"><Input value={f.phone ?? ""} onChange={set("phone")} /></Field>
        <Field label="Email"><Input value={f.email ?? ""} onChange={set("email")} /></Field>
        <Field label="GSTIN"><Input value={f.gstin ?? ""} onChange={set("gstin")} /></Field>
        <Field label="Lead time (days)"><Input type="number" value={f.leadTimeDays ?? 1} onChange={set("leadTimeDays")} /></Field>
        <div className="col-span-2"><Field label="Notes"><Textarea rows={2} value={f.notes ?? ""} onChange={set("notes")} /></Field></div>
        <div className="col-span-2"><ErrorText>{err}</ErrorText></div>
        <div className="col-span-2"><Button onClick={save} loading={busy}>Save</Button></div>
      </div>
    </Modal>
  );
}
