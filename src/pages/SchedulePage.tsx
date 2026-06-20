import { useCallback, useEffect, useState } from "react";
import { deleteEvent, fetchEvents } from "../lib/api";
import { formatDateTime, formatRelativeTime, isPastDate } from "../lib/time";
import type { ScheduledEvent } from "../lib/types";

export default function SchedulePage() {
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const nextEvents = await fetchEvents();
      setEvents(
        [...nextEvents].sort(
          (left, right) => new Date(left.due_at).getTime() - new Date(right.due_at).getTime()
        )
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to load scheduled events.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = useCallback(
    async (id: string, actionLabel: "done" | "cancel") => {
      const targetEvent = events.find((event) => event.id === id);
      if (!targetEvent) {
        return;
      }

      const confirmed = window.confirm(
        actionLabel === "done"
          ? "Mark this scheduled event as done?"
          : "Cancel this scheduled event?"
      );
      if (!confirmed) {
        return;
      }

      setError(null);
      setEvents((currentEvents) => currentEvents.filter((event) => event.id !== id));

      try {
        await deleteEvent(id);
      } catch (caughtError) {
        setEvents((currentEvents) =>
          [...currentEvents, targetEvent].sort(
            (left, right) => new Date(left.due_at).getTime() - new Date(right.due_at).getTime()
          )
        );
        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to update scheduled event.";
        setError(message);
      }
    },
    [events]
  );

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Schedule</h1>
          <p className="mt-2 text-sm text-gray-500">
            Upcoming commitments, reminders, and event-driven tasks in one place.
          </p>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 h-5 w-1/3 animate-pulse rounded bg-gray-200" />
                <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-1/4 animate-pulse rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : null}

        {!loading && events.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
            No scheduled events yet.
          </div>
        ) : null}

        {!loading ? (
          <div className="space-y-3">
            {events.map((event) => {
              const pastEvent = isPastDate(event.due_at);

              return (
                <article
                  key={event.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <h2
                        className={`text-lg font-semibold ${
                          pastEvent ? "text-gray-400 line-through" : "text-gray-900"
                        }`}
                      >
                        {event.title}
                      </h2>
                      {event.description ? (
                        <p className="text-sm text-gray-600">{event.description}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1 text-sm md:text-right">
                      <p className={pastEvent ? "text-gray-400" : "text-indigo-600"}>
                        {formatDateTime(event.due_at)}
                      </p>
                      <p className="text-gray-500">{formatRelativeTime(event.due_at)}</p>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleDelete(event.id, "done");
                          }}
                          className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50"
                        >
                          Done
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleDelete(event.id, "cancel");
                          }}
                          className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
