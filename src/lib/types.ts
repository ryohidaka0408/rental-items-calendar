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

export type ReservationInput = {
  customerName: string;
  equipmentId: string;
  equipmentName: string;
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
