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
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Equipment, EquipmentInput } from "./types";

const equipmentCollection = collection(db, "equipment");

function toEquipment(id: string, data: unknown): Equipment {
  return { id, ...(data as object) } as Equipment;
}

export function subscribeEquipment(
  callback: (items: Equipment[]) => void
): Unsubscribe {
  const q = query(equipmentCollection, orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((docSnapshot) => toEquipment(docSnapshot.id, docSnapshot.data())));
  });
}

export async function getEquipmentList(): Promise<Equipment[]> {
  const snapshot = await getDocs(query(equipmentCollection, orderBy("name")));
  return snapshot.docs.map((docSnapshot) => toEquipment(docSnapshot.id, docSnapshot.data()));
}

export async function addEquipment(input: EquipmentInput): Promise<string> {
  const now = new Date().toISOString();
  const docRef = await addDoc(equipmentCollection, {
    ...input,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateEquipment(
  id: string,
  input: EquipmentInput
): Promise<void> {
  await updateDoc(doc(db, "equipment", id), {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteEquipment(id: string): Promise<void> {
  await deleteDoc(doc(db, "equipment", id));
}
