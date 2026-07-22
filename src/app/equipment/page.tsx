"use client";

import { useEffect, useState, type FormEvent } from "react";
import { addEquipment, deleteEquipment, subscribeEquipment, updateEquipment } from "@/lib/equipment";
import { getActiveReservationCounts } from "@/lib/reservations";
import type { Equipment } from "@/lib/types";

type FormState = {
  name: string;
  category: string;
  quantity: string;
  note: string;
};

const EMPTY_FORM: FormState = { name: "", category: "", quantity: "1", note: "" };
const ACTIVE_COUNT_REFRESH_MS = 60_000;

export default function EquipmentPage() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => subscribeEquipment(setEquipmentList), []);

  useEffect(() => {
    let cancelled = false;
    async function loadCounts() {
      const counts = await getActiveReservationCounts();
      if (!cancelled) setActiveCounts(counts);
    }
    loadCounts();
    const interval = setInterval(loadCounts, ACTIVE_COUNT_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function startEdit(item: Equipment) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category ?? "",
      quantity: String(item.quantity),
      note: item.note ?? "",
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const quantity = Number(form.quantity);
    if (!form.name.trim()) {
      setError("機器名を入力してください");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("保有台数は1以上の整数で入力してください");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        quantity,
        note: form.note.trim() || undefined,
      };
      if (editingId) {
        await updateEquipment(editingId, payload);
      } else {
        await addEquipment(payload);
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("この機器を削除しますか?関連する予約情報は残ります。")) return;
    await deleteEquipment(id);
    if (editingId === id) resetForm();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-ink">機器一覧</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-line bg-paper p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">機器名</span>
          <input
            className="rounded-md border border-line px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">カテゴリ(任意)</span>
          <input
            className="rounded-md border border-line px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">保有台数</span>
          <input
            type="number"
            min={1}
            className="w-24 rounded-md border border-line px-3 py-2 text-sm"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium text-ink">メモ(任意)</span>
          <input
            className="rounded-md border border-line px-3 py-2 text-sm"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {editingId ? "更新" : "追加"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-surface"
            >
              キャンセル
            </button>
          )}
        </div>
        {error && <p className="w-full text-sm text-rust">{error}</p>}
      </form>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">機器名</th>
              <th className="px-4 py-3 font-medium">カテゴリ</th>
              <th className="px-4 py-3 font-medium">保有台数</th>
              <th className="px-4 py-3 font-medium">貸出可能な残り台数</th>
              <th className="px-4 py-3 font-medium">メモ</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {equipmentList.map((item) => {
              const activeCount = activeCounts[item.id] ?? 0;
              const remaining = Math.max(item.quantity - activeCount, 0);
              return (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-3 text-ink">{item.name}</td>
                  <td className="px-4 py-3 text-muted">{item.category || "-"}</td>
                  <td className="px-4 py-3 text-ink">{item.quantity}台</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        remaining === 0 ? "bg-rust/10 text-rust" : "bg-brand/10 text-brand"
                      }`}
                    >
                      {`${remaining}/${item.quantity}台 貸出可能`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{item.note || "-"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="mr-3 text-brand hover:underline"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="text-rust hover:underline"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              );
            })}
            {equipmentList.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  登録された機器がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
