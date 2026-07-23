"use client";

import { useEffect, useState } from "react";
import { CalendarView } from "@/components/CalendarView";
import { formatDateTimeJa, formatRelativeDeadline } from "@/lib/datetime";
import { getUpcomingDeadlines } from "@/lib/reservations";
import type { Reservation } from "@/lib/types";

const REMINDER_WINDOW_HOURS = 24;
const REFRESH_INTERVAL_MS = 60_000;

export default function HomePage() {
  const [deadlines, setDeadlines] = useState<Reservation[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const items = await getUpcomingDeadlines(REMINDER_WINDOW_HOURS);
      if (!cancelled) setDeadlines(items);
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
      {deadlines.length > 0 && (
        <section className="rounded-xl border border-rust/30 bg-rust/5 p-4">
          <h2 className="text-sm font-semibold text-rust">
            {`返却期限が近い予約(${deadlines.length}件)`}
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {deadlines.map((reservation) => (
              <li
                key={reservation.id}
                className="flex flex-col gap-1 rounded-lg bg-paper px-3 py-2 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-ink">
                  <span className="font-medium">{reservation.customerName}</span>
                  <span className="mx-2 text-muted">/</span>
                  <span>{(reservation.items ?? []).map((item) => item.equipmentName).join(" / ")}</span>
                </div>
                <div className="text-muted">
                  返却期限: {formatDateTimeJa(reservation.end)}
                  <span className="ml-2 font-medium text-rust">
                    ({formatRelativeDeadline(reservation.end)})
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CalendarView />
    </div>
  );
}
