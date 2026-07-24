"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getUserLabel, useAuth } from "@/lib/auth-context";
import {
  addReservation,
  checkAvailability,
  deleteReservation,
  updateReservation,
  type AvailabilityResult,
} from "@/lib/reservations";
import { endOfDayISO, startOfDayISO, toDateInputValue } from "@/lib/datetime";
import type { Equipment, Reservation } from "@/lib/types";

export type ReservationModalState =
  | { mode: "create"; start: string; end: string }
  | { mode: "edit"; reservation: Reservation };

type Props = {
  equipmentList: Equipment[];
  initial: ReservationModalState;
  onClose: () => void;
};

const DEFAULT_COLOR = "#2563eb";

type EquipmentRow = {
  equipmentId: string;
  quantity: number;
};

export function ReservationModal({ equipmentList, initial, onClose }: Props) {
  const { user } = useAuth();
  const isEdit = initial.mode === "edit";
  const editingReservation = initial.mode === "edit" ? initial.reservation : null;

  const [customerName, setCustomerName] = useState(editingReservation?.customerName ?? "");
  const [color, setColor] = useState(editingReservation?.color ?? DEFAULT_COLOR);
  const [rows, setRows] = useState<EquipmentRow[]>(() => {
    const initialRows = editingReservation?.items?.map((item) => ({
      equipmentId: item.equipmentId,
      quantity: item.quantity,
    }));
    return initialRows && initialRows.length > 0
      ? initialRows
      : [{ equipmentId: equipmentList[0]?.id ?? "", quantity: 1 }];
  });
  const [start, setStart] = useState(
    editingReservation
      ? toDateInputValue(editingReservation.start)
      : initial.mode === "create"
        ? initial.start
        : ""
  );
  const [end, setEnd] = useState(
    editingReservation
      ? toDateInputValue(editingReservation.end)
      : initial.mode === "create"
        ? initial.end
        : ""
  );
  const [note, setNote] = useState(editingReservation?.note ?? "");
  const [availabilityByEquipmentId, setAvailabilityByEquipmentId] = useState<
    Record<string, AvailabilityResult>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRows = useMemo(
    () =>
      rows
        .map((row) => {
          const equipment = equipmentList.find((item) => item.id === row.equipmentId);
          return equipment ? { equipment, quantity: row.quantity } : null;
        })
        .filter((row): row is { equipment: Equipment; quantity: number } => Boolean(row)),
    [equipmentList, rows]
  );

  const reservedByName = editingReservation?.reservedByName ?? (user ? getUserLabel(user) : "");
  const reservedByEmail = editingReservation?.reservedByEmail ?? user?.email ?? "";

  const startISO = start ? startOfDayISO(start) : null;
  const endISO = end ? endOfDayISO(end) : null;
  const isRangeValid = Boolean(
    rows.every((row) => row.equipmentId) &&
      rows.every((row) => Number.isInteger(row.quantity) && row.quantity >= 1) &&
      selectedRows.length === rows.length &&
      startISO &&
      endISO &&
      end >= start
  );

  useEffect(() => {
    if (!isRangeValid || !startISO || !endISO) {
      return;
    }
    let cancelled = false;
    Promise.all(
      selectedRows.map(({ equipment, quantity }) =>
        checkAvailability(
          equipment.id,
          equipment.quantity,
          quantity,
          startISO,
          endISO,
          editingReservation?.id
        ).then((result) => [equipment.id, result] as const)
      )
    ).then((results) => {
      if (!cancelled) setAvailabilityByEquipmentId(Object.fromEntries(results));
    });
    return () => {
      cancelled = true;
    };
  }, [isRangeValid, selectedRows, startISO, endISO, editingReservation?.id]);

  const displayedAvailability = isRangeValid ? availabilityByEquipmentId : {};
  const isFull = Object.values(displayedAvailability).some((result) => !result.isAvailable);

  function updateEquipmentAt(index: number, value: string) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, equipmentId: value } : row)));
  }

  function updateQuantityAt(index: number, value: number) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, quantity: Math.max(1, value) } : row))
    );
  }

  function addEquipmentRow() {
    const nextDefault = equipmentList.find((item) => !rows.some((row) => row.equipmentId === item.id))?.id ?? "";
    setRows((prev) => [...prev, { equipmentId: nextDefault, quantity: 1 }]);
  }

  function removeEquipmentAt(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !isRangeValid) return;

    const submitStartISO = startOfDayISO(start);
    const submitEndISO = endOfDayISO(end);
    if (end < start) {
      setError("終了日は開始日以降にしてください");
      return;
    }

    const items = selectedRows.map(({ equipment, quantity }) => ({
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      quantity,
    }));
    const quantities = Object.fromEntries(
      selectedRows.map(({ equipment }) => [equipment.id, equipment.quantity])
    );

    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && editingReservation) {
        await updateReservation(
          editingReservation.id,
          {
            customerName: customerName.trim(),
            color,
            items,
            equipmentIds: items.map((item) => item.equipmentId),
            start: submitStartISO,
            end: submitEndISO,
            reservedByUid: editingReservation.reservedByUid,
            reservedByName: editingReservation.reservedByName,
            reservedByEmail: editingReservation.reservedByEmail,
            note: note.trim() || undefined,
          },
          quantities
        );
      } else {
        await addReservation(
          {
            customerName: customerName.trim(),
            color,
            items,
            equipmentIds: items.map((item) => item.equipmentId),
            start: submitStartISO,
            end: submitEndISO,
            reservedByUid: user.uid,
            reservedByName: getUserLabel(user),
            reservedByEmail: user.email ?? "",
            note: note.trim() || undefined,
          },
          quantities
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "予約の保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingReservation) return;
    if (!window.confirm("この予約を削除しますか?")) return;
    setSubmitting(true);
    try {
      await deleteReservation(editingReservation.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "予約の削除に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-8">
      <div className="flex min-h-full items-center justify-center">
        <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-paper p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-ink">{isEdit ? "予約の編集" : "新規予約"}</h2>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">顧客名</span>
              <input
                type="text"
                className="rounded-md border border-line px-3 py-2 text-sm"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </label>

            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-ink">機器</span>
              {rows.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
                    value={row.equipmentId}
                    onChange={(e) => updateEquipmentAt(index, e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      選択してください
                    </option>
                    {equipmentList.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={
                          item.id !== row.equipmentId && rows.some((r) => r.equipmentId === item.id)
                        }
                      >
                        {`${item.name}(保有${item.quantity}台)`}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    aria-label="数量"
                    className="w-20 rounded-md border border-line px-3 py-2 text-sm"
                    value={row.quantity}
                    onChange={(e) => updateQuantityAt(index, Number(e.target.value))}
                    required
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEquipmentAt(index)}
                      aria-label="この機器を削除"
                      className="rounded-md px-2 py-2 text-sm text-muted hover:bg-surface"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addEquipmentRow}
                disabled={rows.length >= equipmentList.length}
                className="self-start rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                + 機器を追加
              </button>
            </div>

            <label className="flex items-center gap-3 text-sm">
              <span className="font-medium text-ink">色</span>
              <input
                type="color"
                className="h-9 w-16 rounded-md border border-line p-1"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">開始日</span>
                <input
                  type="date"
                  className="rounded-md border border-line px-3 py-2 text-sm"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">終了日</span>
                <input
                  type="date"
                  className="rounded-md border border-line px-3 py-2 text-sm"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </label>
            </div>

            {isRangeValid && selectedRows.length > 0 && (
              <div className="flex flex-col gap-2">
                {selectedRows.map(({ equipment, quantity }) => {
                  const result = displayedAvailability[equipment.id];
                  if (!result) return null;
                  const full = !result.isAvailable;
                  return (
                    <p
                      key={equipment.id}
                      className={`rounded-md px-3 py-2 text-sm ${
                        full ? "bg-rust/10 text-rust" : "bg-surface text-muted"
                      }`}
                    >
                      {full
                        ? `${equipment.name}: 在庫が不足しています(保有${result.quantity}台中、既に${result.reservedCount}台予約済み。希望${quantity}台は確保できません)`
                        : `${equipment.name}: 在庫状況 ${result.reservedCount}/${result.quantity}台予約済み(残り${result.remaining}台、今回${quantity}台使用)`}
                    </p>
                  );
                })}
              </div>
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">予約者</span>
              <input
                type="text"
                readOnly
                className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-muted"
                value={reservedByEmail ? `${reservedByName}(${reservedByEmail})` : reservedByName}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">メモ(任意)</span>
              <textarea
                className="rounded-md border border-line px-3 py-2 text-sm"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            {error && <p className="text-sm text-rust">{error}</p>}

            <div className="flex items-center justify-between pt-2">
              <div>
                {isEdit && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={submitting}
                    className="rounded-md px-3 py-2 text-sm font-medium text-rust hover:bg-rust/10"
                  >
                    削除
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-line px-4 py-2 text-sm font-medium text-muted hover:bg-surface"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={submitting || isFull || !isRangeValid}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isEdit ? "更新する" : "予約する"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
