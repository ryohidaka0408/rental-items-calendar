"use client";

import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import jaLocale from "@fullcalendar/core/locales/ja";
import type { DateSelectArg, EventClickArg, EventHoveringArg } from "@fullcalendar/core";
import { subscribeEquipment } from "@/lib/equipment";
import { subscribeReservations } from "@/lib/reservations";
import type { Equipment, Reservation } from "@/lib/types";
import { addDaysToDateString, toDateInputValue } from "@/lib/datetime";
import { ReservationModal, type ReservationModalState } from "./ReservationModal";

const DEFAULT_EVENT_COLOR = "#2563eb";

function formatItemLabel(item: { equipmentName: string; quantity: number }): string {
  return item.quantity > 1 ? `${item.equipmentName}×${item.quantity}` : item.equipmentName;
}

export function CalendarView() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [modalState, setModalState] = useState<ReservationModalState | null>(null);
  const [hoveredReservation, setHoveredReservation] = useState<{
    reservation: Reservation;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const unsubscribeReservations = subscribeReservations(setReservations);
    const unsubscribeEquipment = subscribeEquipment(setEquipmentList);
    return () => {
      unsubscribeReservations();
      unsubscribeEquipment();
    };
  }, []);

  const events = useMemo(
    () =>
      reservations
        .filter((reservation) => reservation.status === "confirmed")
        .map((reservation) => {
          const color = reservation.color ?? DEFAULT_EVENT_COLOR;
          const title = [
            reservation.customerName,
            ...(reservation.items ?? []).map(formatItemLabel),
          ]
            .filter(Boolean)
            .join(" / ");
          return {
            id: reservation.id,
            title,
            start: toDateInputValue(reservation.start),
            end: addDaysToDateString(toDateInputValue(reservation.end), 1),
            allDay: true,
            backgroundColor: color,
            borderColor: color,
            extendedProps: { reservation },
          };
        }),
    [reservations]
  );

  function handleSelect(selectInfo: DateSelectArg) {
    const inclusiveEnd = addDaysToDateString(selectInfo.endStr, -1);
    setModalState({ mode: "create", start: selectInfo.startStr, end: inclusiveEnd });
    selectInfo.view.calendar.unselect();
  }

  function handleEventClick(clickInfo: EventClickArg) {
    const reservation = clickInfo.event.extendedProps.reservation as Reservation;
    setModalState({ mode: "edit", reservation });
  }

  function handleEventMouseEnter(info: EventHoveringArg) {
    const reservation = info.event.extendedProps.reservation as Reservation;
    setHoveredReservation({
      reservation,
      x: info.jsEvent.clientX,
      y: info.jsEvent.clientY,
    });
  }

  function handleEventMouseLeave() {
    setHoveredReservation(null);
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-4 shadow-sm">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,dayGridWeek",
        }}
        locales={[jaLocale]}
        locale="ja"
        buttonText={{ today: "今日", month: "月", week: "週" }}
        selectable
        selectMirror
        events={events}
        select={handleSelect}
        eventClick={handleEventClick}
        eventMouseEnter={handleEventMouseEnter}
        eventMouseLeave={handleEventMouseLeave}
        height="auto"
      />
      {modalState && (
        <ReservationModal
          equipmentList={equipmentList}
          initial={modalState}
          onClose={() => setModalState(null)}
        />
      )}
      {hoveredReservation && (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-line bg-paper px-3 py-2 text-sm shadow-lg"
          style={{ left: hoveredReservation.x + 12, top: hoveredReservation.y + 12 }}
        >
          <p className="font-medium text-ink">貸出製品</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-muted">
            {(hoveredReservation.reservation.items ?? []).map((item) => (
              <li key={item.equipmentId}>{formatItemLabel(item)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
