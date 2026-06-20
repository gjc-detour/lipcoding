import { useState } from "react";
import { formatDateTime, formatRelativeTime, isPastDate } from "../lib/time";
import type { InboxItem as InboxItemModel } from "../lib/types";

interface InboxItemProps {
  item: InboxItemModel;
  onDelete: (id: string) => Promise<void>;
}

const TYPE_STYLES: Record<InboxItemModel["type"], string> = {
  note: "bg-blue-100 text-blue-700",
  task: "bg-green-100 text-green-700",
  event: "bg-purple-100 text-purple-700",
  file: "bg-orange-100 text-orange-700",
};

export default function InboxItem({ item, onDelete }: InboxItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isPastDue = item.due_date ? isPastDate(item.due_date) : false;

  const handleDelete = async () => {
    const confirmed = window.confirm("Delete this inbox item?");
    if (!confirmed) {
      return;
    }

    await onDelete(item.id);
  };

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${TYPE_STYLES[item.type]}`}
            >
              {item.type}
            </span>
            {item.tags.map((tag) => (
              <span
                key={`${item.id}-${tag}`}
                className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900">{item.summary}</h3>
            <p className="text-sm text-gray-500">{formatRelativeTime(item.created_at)}</p>
          </div>

          {item.due_date ? (
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                isPastDue ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
              }`}
            >
              <span aria-hidden="true">🕒</span>
              <span>{formatDateTime(item.due_date)}</span>
            </div>
          ) : null}

          <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className="font-medium text-indigo-600 transition hover:text-indigo-500"
            >
              {isExpanded ? "Hide original capture" : "Show original capture"}
            </button>
            {isExpanded ? (
              <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm text-gray-700">
                {item.raw}
              </pre>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleDelete();
          }}
          className="rounded-full p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
          aria-label="Delete inbox item"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </article>
  );
}
