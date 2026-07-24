import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Reservation, ReservationInput } from "./types";

const reservationsCollection = collection(db, "reservations");

function toReservation(id: string, data: unknown): Reservation {
  return { id, ...(data as object) } as Reservation;
}

export function subscribeReservations(
  callback: (items: Reservation[]) => void
): Unsubscribe {
  const q = query(reservationsCollection, orderBy("start"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((docSnapshot) => toReservation(docSnapshot.id, docSnapshot.data())));
  });
}

export async function getReservationsByEquipment(
  equipmentId: string
): Promise<Reservation[]> {
  const q = query(
    reservationsCollection,
    where("equipmentIds", "array-contains", equipmentId),
    where("status", "==", "confirmed")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnapshot) => toReservation(docSnapshot.id, docSnapshot.data()));
}

function isOverlapping(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart;
}

/** 同一機器・同一時間帯に重なっている確定予約(自分自身を除く)を返す */
export async function findOverlaps(
  equipmentId: string,
  start: string,
  end: string,
  excludeReservationId?: string
): Promise<Reservation[]> {
  const reservations = await getReservationsByEquipment(equipmentId);
  return reservations.filter(
    (reservation) =>
      reservation.id !== excludeReservationId &&
      isOverlapping(start, end, reservation.start, reservation.end)
  );
}

export type AvailabilityResult = {
  quantity: number;
  reservedCount: number;
  requestedQuantity: number;
  remaining: number;
  isAvailable: boolean;
};

/** 保有台数(quantity)を考慮し、指定時間帯に希望数量分の空きがあるかを判定する */
export async function checkAvailability(
  equipmentId: string,
  quantity: number,
  requestedQuantity: number,
  start: string,
  end: string,
  excludeReservationId?: string
): Promise<AvailabilityResult> {
  const overlaps = await findOverlaps(equipmentId, start, end, excludeReservationId);
  const reservedCount = overlaps.reduce((sum, reservation) => {
    const item = reservation.items?.find((i) => i.equipmentId === equipmentId);
    return sum + (item?.quantity ?? 0);
  }, 0);
  return {
    quantity,
    reservedCount,
    requestedQuantity,
    remaining: Math.max(quantity - reservedCount, 0),
    isAvailable: reservedCount + requestedQuantity <= quantity,
  };
}

export class ReservationConflictError extends Error {
  equipmentName: string;
  availability: AvailabilityResult;

  constructor(equipmentName: string, availability: AvailabilityResult) {
    super(
      `${equipmentName}: 希望数量${availability.requestedQuantity}台を確保できません` +
        `(保有${availability.quantity}台中、既に${availability.reservedCount}台予約済み)`
    );
    this.name = "ReservationConflictError";
    this.equipmentName = equipmentName;
    this.availability = availability;
  }
}

/** equipmentId ごとの保有台数(quantity) */
type QuantityByEquipmentId = Record<string, number>;

async function assertItemsAvailable(
  input: ReservationInput,
  quantities: QuantityByEquipmentId,
  excludeReservationId?: string
): Promise<void> {
  for (const item of input.items) {
    const quantity = quantities[item.equipmentId] ?? 0;
    const availability = await checkAvailability(
      item.equipmentId,
      quantity,
      item.quantity,
      input.start,
      input.end,
      excludeReservationId
    );
    if (!availability.isAvailable) {
      throw new ReservationConflictError(item.equipmentName, availability);
    }
  }
}

export async function addReservation(
  input: ReservationInput,
  quantities: QuantityByEquipmentId
): Promise<string> {
  await assertItemsAvailable(input, quantities);
  const now = new Date().toISOString();
  const docRef = await addDoc(reservationsCollection, {
    ...input,
    status: "confirmed",
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateReservation(
  id: string,
  input: ReservationInput,
  quantities: QuantityByEquipmentId
): Promise<void> {
  await assertItemsAvailable(input, quantities, id);
  await updateDoc(doc(db, "reservations", id), {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteReservation(id: string): Promise<void> {
  await deleteDoc(doc(db, "reservations", id));
}

/**
 * 返却日が本日の確定予約を取得する。
 * Cloud Functions等からの通知バッチでも再利用できるよう独立した関数として切り出している。
 */
export async function getReservationsDueToday(now: Date = new Date()): Promise<Reservation[]> {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  ).toISOString();
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  ).toISOString();
  const q = query(
    reservationsCollection,
    where("status", "==", "confirmed"),
    where("end", ">=", startOfToday),
    where("end", "<=", endOfToday),
    orderBy("end", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnapshot) => toReservation(docSnapshot.id, docSnapshot.data()));
}

/** 指定時刻時点で稼働中(貸出中)の確定予約数を機器IDごとに集計する */
export async function getActiveReservationCounts(
  at: Date = new Date()
): Promise<Record<string, number>> {
  const nowISO = at.toISOString();
  const q = query(
    reservationsCollection,
    where("status", "==", "confirmed"),
    where("end", ">=", nowISO)
  );
  const snapshot = await getDocs(q);
  const counts: Record<string, number> = {};
  snapshot.docs.forEach((docSnapshot) => {
    const reservation = toReservation(docSnapshot.id, docSnapshot.data());
    if (reservation.start <= nowISO && reservation.end >= nowISO) {
      (reservation.items ?? []).forEach((item) => {
        counts[item.equipmentId] = (counts[item.equipmentId] ?? 0) + item.quantity;
      });
    }
  });
  return counts;
}
