"use client";

import { useEffect, useState } from "react";
import { CalendarView } from "@/components/CalendarView";
import { getReservationsDueToday } from "@/lib/reservations";
import type { Reservation } from "@/lib/types";

const REFRESH_INTERVAL_MS = 60_000;

function formatItemLabel(item: { equipmentName: string; quantity: number }): string {
  return item.quantity > 1 ? `${item.equipmentName}×${item.quantity}` : item.equipmentName;
}

export default function HomePage() {
  const [dueToday, setDueToday] = useState<Reservation[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const items = await getReservationsDueToday();
      if (!cancelled) setDueToday(items);
    }
    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      {dueToday.length > 0 && (
        <section className="rounded-xl border border-rust/30 bg-rust/5 p-4">
          <h2 className="text-sm font-semibold text-rust">
            {`本日返却予定の予約(${dueToday.length}件)`}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {dueToday.map((reservation) => (
              <li
                key={reservation.id}
                className="flex flex-col gap-1 rounded-lg bg-paper px-3 py-2 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-ink">
                  <span className="font-medium">{reservation.customerName}</span>
                  <span className="mx-2 text-muted">/</span>
                  <span>{(reservation.items ?? []).map(formatItemLabel).join(" / ")}</span>
                </div>
                <div className="text-xs font-medium text-rust">本日返却</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CalendarView />
    </div>
  );
}
