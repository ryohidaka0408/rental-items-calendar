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

const EVENT_COLORS = ["#2563eb", "#b45309", "#0f766e", "#7c3aed", "#be123c", "#0369a1"];

function colorForEquipment(equipmentId: string, equipmentIds: string[]): string {
  const index = equipmentIds.indexOf(equipmentId);
  if (index < 0) return "var(--brand)";
  return EVENT_COLORS[index % EVENT_COLORS.length];
}

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

  const equipmentIds = useMemo(() => equipmentList.map((item) => item.id), [equipmentList]);

  const events = useMemo(
    () =>
      reservations
        .filter((reservation) => reservation.status === "confirmed")
        .map((reservation) => {
          const color = colorForEquipment(reservation.equipmentId, equipmentIds);
          return {
            id: reservation.id,
            title: `${reservation.customerName} / ${reservation.equipmentName}`,
            start: reservation.start,
            end: reservation.end,
            backgroundColor: color,
            borderColor: color,
            extendedProps: { reservation },
          };
        }),
    [reservations, equipmentIds]
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
