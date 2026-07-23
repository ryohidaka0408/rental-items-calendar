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

export function ReservationModal({ equipmentList, initial, onClose }: Props) {
  const { user } = useAuth();
  const isEdit = initial.mode === "edit";
  const editingReservation = initial.mode === "edit" ? initial.reservation : null;

  const [customerName, setCustomerName] = useState(editingReservation?.customerName ?? "");
  const [equipmentId, setEquipmentId] = useState(
    editingReservation?.equipmentId ?? equipmentList[0]?.id ?? ""
  );
  const [start, setStart] = useState(
    toDatetimeLocalValue(editingReservation?.start ?? (initial.mode === "create" ? initial.start : ""))
  );
  const [end, setEnd] = useState(
    toDatetimeLocalValue(editingReservation?.end ?? (initial.mode === "create" ? initial.end : ""))
  );
  const [note, setNote] = useState(editingReservation?.note ?? "");
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEquipment = useMemo(
    () => equipmentList.find((item) => item.id === equipmentId) ?? null,
    [equipmentList, equipmentId]
  );

  const reservedByName = editingReservation?.reservedByName ?? (user ? getUserLabel(user) : "");
  const reservedByEmail = editingReservation?.reservedByEmail ?? user?.email ?? "";

  const startISO = start ? fromDatetimeLocalValue(start) : null;
  const endISO = end ? fromDatetimeLocalValue(end) : null;
  const isRangeValid = Boolean(
    selectedEquipment && startISO && endISO && new Date(endISO) > new Date(startISO)
  );

  useEffect(() => {
    if (!isRangeValid || !selectedEquipment || !startISO || !endISO) {
      return;
    }
    let cancelled = false;
    checkAvailability(
      selectedEquipment.id,
      selectedEquipment.quantity,
      startISO,
      endISO,
      editingReservation?.id
    ).then((result) => {
      if (!cancelled) setAvailability(result);
    });
    return () => {
      cancelled = true;
    };
  }, [isRangeValid, selectedEquipment, startISO, endISO, editingReservation?.id]);

  const displayedAvailability = isRangeValid ? availability : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user || !selectedEquipment) return;

    const submitStartISO = fromDatetimeLocalValue(start);
    const submitEndISO = fromDatetimeLocalValue(end);
    if (new Date(submitEndISO) <= new Date(submitStartISO)) {
      setError("終了時刻は開始時刻より後にしてください");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && editingReservation) {
        await updateReservation(
          editingReservation.id,
          {
            customerName: customerName.trim(),
            equipmentId: selectedEquipment.id,
            equipmentName: selectedEquipment.name,
            start: submitStartISO,
            end: submitEndISO,
            reservedByUid: editingReservation.reservedByUid,
            reservedByName: editingReservation.reservedByName,
            reservedByEmail: editingReservation.reservedByEmail,
            note: note.trim() || undefined,
          },
          selectedEquipment.quantity
        );
      } else {
        await addReservation(
          {
            customerName: customerName.trim(),
            equipmentId: selectedEquipment.id,
            equipmentName: selectedEquipment.name,
            start: submitStartISO,
            end: submitEndISO,
            reservedByUid: user.uid,
            reservedByName: getUserLabel(user),
            reservedByEmail: user.email ?? "",
            note: note.trim() || undefined,
          },
          selectedEquipment.quantity
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

  const isFull = displayedAvailability ? !displayedAvailability.isAvailable : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-paper p-6 shadow-lg">
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

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">機器</span>
            <select
              className="rounded-md border border-line px-3 py-2 text-sm"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              required
            >
              <option value="" disabled>
                選択してください
              </option>
              {equipmentList.map((item) => (
                <option key={item.id} value={item.id}>
                  {`${item.name}(保有${item.quantity}台)`}
                </option>
              ))}
            </select>
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

          {displayedAvailability && (
            <p
              className={`rounded-md px-3 py-2 text-sm ${
                isFull ? "bg-rust/10 text-rust" : "bg-surface text-muted"
              }`}
            >
              {isFull
                ? `指定の時間帯は在庫が埋まっています(${displayedAvailability.reservedCount}/${displayedAvailability.quantity}台予約済み)`
                : `在庫状況: ${displayedAvailability.reservedCount}/${displayedAvailability.quantity}台予約済み(残り${displayedAvailability.remaining}台)`}
            </p>
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
                disabled={submitting || isFull}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEdit ? "更新する" : "予約する"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
