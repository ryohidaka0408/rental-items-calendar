export type Equipment = {
  id: string;
  name: string;
  category?: string;
  quantity: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type EquipmentInput = Omit<Equipment, "id" | "createdAt" | "updatedAt">;

export type ReservationStatus = "confirmed" | "cancelled";

export type ReservationEquipmentItem = {
  equipmentId: string;
  equipmentName: string;
};

export type ReservationInput = {
  customerName: string;
  color: string;
  items: ReservationEquipmentItem[];
  /** items の equipmentId 一覧。Firestore の array-contains クエリ用 */
  equipmentIds: string[];
  start: string;
  end: string;
  reservedByUid: string;
  reservedByName: string;
  reservedByEmail: string;
  note?: string;
};

export type Reservation = ReservationInput & {
  id: string;
  status: ReservationStatus;
  createdAt?: string;
  updatedAt?: string;
};
