"use client";

import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import jaLocale from "@fullcalendar/core/locales/ja";
import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";
import { subscribeEquipment } from "@/lib/equipment";
import { subscribeReservations } from "@/lib/reservations";
import type { Equipment, Reservation } from "@/lib/types";
import { ReservationModal, type ReservationModalState } from "./ReservationModal";

const DEFAULT_EVENT_COLOR = "#2563eb";

export function CalendarView() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [modalState, setModalState] = useState<ReservationModalState | null>(null);

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
          const title = [reservation.customerName, ...(reservation.items ?? []).map((item) => item.equipmentName)]
            .filter(Boolean)
            .join(" / ");
          return {
            id: reservation.id,
            title,
            start: reservation.start,
            end: reservation.end,
            backgroundColor: color,
            borderColor: color,
            extendedProps: { reservation },
          };
        }),
    [reservations]
  );

  function handleSelect(selectInfo: DateSelectArg) {
    setModalState({ mode: "create", start: selectInfo.startStr, end: selectInfo.endStr });
    selectInfo.view.calendar.unselect();
  }

  function handleEventClick(clickInfo: EventClickArg) {
    const reservation = clickInfo.event.extendedProps.reservation as Reservation;
    setModalState({ mode: "edit", reservation });
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-4 shadow-sm">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        locales={[jaLocale]}
        locale="ja"
        selectable
        selectMirror
        events={events}
        select={handleSelect}
        eventClick={handleEventClick}
        height="auto"
      />
      {modalState && (
        <ReservationModal
          equipmentList={equipmentList}
          initial={modalState}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
}
