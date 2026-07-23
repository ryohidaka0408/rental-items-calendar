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
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/datetime";
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

export function ReservationModal({ equipmentList, initial, onClose }: Props) {
  const { user } = useAuth();
  const isEdit = initial.mode === "edit";
  const editingReservation = initial.mode === "edit" ? initial.reservation : null;

  const [customerName, setCustomerName] = useState(editingReservation?.customerName ?? "");
  const [color, setColor] = useState(editingReservation?.color ?? DEFAULT_COLOR);
  const [equipmentIds, setEquipmentIds] = useState<string[]>(() => {
    const initialIds = editingReservation?.items?.map((item) => item.equipmentId) ?? [];
    return initialIds.length > 0 ? initialIds : [equipmentList[0]?.id ?? ""];
  });
  const [start, setStart] = useState(
    toDatetimeLocalValue(editingReservation?.start ?? (initial.mode === "create" ? initial.start : ""))
  );
  const [end, setEnd] = useState(
    toDatetimeLocalValue(editingReservation?.end ?? (initial.mode === "create" ? initial.end : ""))
  );
  const [note, setNote] = useState(editingReservation?.note ?? "");
  const [availabilityByEquipmentId, setAvailabilityByEquipmentId] = useState<
    Record<string, AvailabilityResult>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEquipmentList = useMemo(
    () =>
      equipmentIds
        .map((id) => equipmentList.find((item) => item.id === id))
        .filter((item): item is Equipment => Boolean(item)),
    [equipmentList, equipmentIds]
  );

  const reservedByName = editingReservation?.reservedByName ?? (user ? getUserLabel(user) : "");
  const reservedByEmail = editingReservation?.reservedByEmail ?? user?.email ?? "";

  const startISO = start ? fromDatetimeLocalValue(start) : null;
  const endISO = end ? fromDatetimeLocalValue(end) : null;
  const isRangeValid = Boolean(
    equipmentIds.every((id) => id) &&
      selectedEquipmentList.length === equipmentIds.length &&
      startISO &&
      endISO &&
      new Date(endISO) > new Date(startISO)
  );

  useEffect(() => {
    if (!isRangeValid || !startISO || !endISO) {
      setAvailabilityByEquipmentId({});
      return;
    }
    let cancelled = false;
    Promise.all(
      selectedEquipmentList.map((equipment) =>
        checkAvailability(equipment.id, equipment.quantity, startISO, endISO, editingReservation?.id).then(
          (result) => [equipment.id, result] as const
        )
      )
    ).then((results) => {
      if (!cancelled) setAvailabilityByEquipmentId(Object.fromEntries(results));
    });
    return () => {
      cancelled = true;
    };
  }, [isRangeValid, selectedEquipmentList, startISO, endISO, editingReservation?.id]);

  const displayedAvailability = isRangeValid ? availabilityByEquipmentId : {};
  const isFull = Object.values(displayedAvailability).some((result) => !result.isAvailable);

  function updateEquipmentAt(index: number, value: string) {
    setEquipmentIds((prev) => prev.map((id, i) => (i === index ? value : id)));
  }

  function addEquipmentRow() {
    const nextDefault = equipmentList.find((item) => !equipmentIds.includes(item.id))?.id ?? "";
    setEquipmentIds((prev) => [...prev, nextDefault]);
  }

  function removeEquipmentAt(index: number) {
    setEquipmentIds((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !isRangeValid) return;

    const submitStartISO = fromDatetimeLocalValue(start);
    const submitEndISO = fromDatetimeLocalValue(end);
    if (new Date(submitEndISO) <= new Date(submitStartISO)) {
      setError("終了時刻は開始時刻より後にしてください");
      return;
    }

    const items = selectedEquipmentList.map((equipment) => ({
      equipmentId: equipment.id,
      equipmentName: equipment.name,
    }));
    const quantities = Object.fromEntries(
      selectedEquipmentList.map((equipment) => [equipment.id, equipment.quantity])
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
              {equipmentIds.map((id, index) => (
                <div key={index} className="flex items-center gap-2">
                  <select
                    className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
                    value={id}
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
                        disabled={item.id !== id && equipmentIds.includes(item.id)}
                      >
                        {`${item.name}(保有${item.quantity}台)`}
                      </option>
                    ))}
                  </select>
                  {equipmentIds.length > 1 && (
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
                disabled={equipmentIds.length >= equipmentList.length}
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
                <span className="font-medium text-ink">開始日時</span>
                <input
                  type="datetime-local"
                  className="rounded-md border border-line px-3 py-2 text-sm"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-ink">終了日時</span>
                <input
                  type="datetime-local"
                  className="rounded-md border border-line px-3 py-2 text-sm"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </label>
            </div>

            {isRangeValid && selectedEquipmentList.length > 0 && (
              <div className="flex flex-col gap-2">
                {selectedEquipmentList.map((equipment) => {
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
                        ? `${equipment.name}: 指定の時間帯は在庫が埋まっています(${result.reservedCount}/${result.quantity}台予約済み)`
                        : `${equipment.name}: 在庫状況 ${result.reservedCount}/${result.quantity}台予約済み(残り${result.remaining}台)`}
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
