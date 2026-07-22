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
    where("equipmentId", "==", equipmentId),
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
  remaining: number;
  isAvailable: boolean;
};

/** 保有台数(quantity)を考慮し、指定時間帯に空きがあるかを判定する */
export async function checkAvailability(
  equipmentId: string,
  quantity: number,
  start: string,
  end: string,
  excludeReservationId?: string
): Promise<AvailabilityResult> {
  const overlaps = await findOverlaps(equipmentId, start, end, excludeReservationId);
  const reservedCount = overlaps.length;
  return {
    quantity,
    reservedCount,
    remaining: Math.max(quantity - reservedCount, 0),
    isAvailable: reservedCount < quantity,
  };
}

export class ReservationConflictError extends Error {
  availability: AvailabilityResult;

  constructor(availability: AvailabilityResult) {
    super(
      `指定の時間帯は在庫が埋まっています(${availability.reservedCount}/${availability.quantity}台予約済み)`
    );
    this.name = "ReservationConflictError";
    this.availability = availability;
  }
}

export async function addReservation(
  input: ReservationInput,
  quantity: number
): Promise<string> {
  const availability = await checkAvailability(
    input.equipmentId,
    quantity,
    input.start,
    input.end
  );
  if (!availability.isAvailable) {
    throw new ReservationConflictError(availability);
  }
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
  quantity: number
): Promise<void> {
  const availability = await checkAvailability(
    input.equipmentId,
    quantity,
    input.start,
    input.end,
    id
  );
  if (!availability.isAvailable) {
    throw new ReservationConflictError(availability);
  }
  await updateDoc(doc(db, "reservations", id), {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteReservation(id: string): Promise<void> {
  await deleteDoc(doc(db, "reservations", id));
}

/**
 * 返却期限が近い(または過ぎている)確定予約を取得する。
 * Cloud Functions等からの通知バッチでも再利用できるよう独立した関数として切り出している。
 */
export async function getUpcomingDeadlines(
  hoursAhead: number = 24,
  now: Date = new Date()
): Promise<Reservation[]> {
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000).toISOString();
  const q = query(
    reservationsCollection,
    where("status", "==", "confirmed"),
    where("end", "<=", cutoff),
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
      counts[reservation.equipmentId] = (counts[reservation.equipmentId] ?? 0) + 1;
    }
  });
  return counts;
}
