import { useState } from "react";
import { formatDateTime, formatRelativeTime, isPastDate } from "../lib/time";
import type { InboxItem as InboxItemModel } from "../lib/types";

interface InboxItemProps {
  item: InboxItemModel;
  onDelete?: (id: string) => Promise<void>;
  onComplete?: (id: string) => Promise<void>;
}

const TYPE_STYLES: Record<InboxItemModel["type"], string> = {
  note: "bg-blue-100 text-blue-700",
  task: "bg-green-100 text-green-700",
  event: "bg-purple-100 text-purple-700",
  file: "bg-orange-100 text-orange-700",
};

const PRIORITY_STYLES: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-emerald-100 text-emerald-700",
};

const PRIORITY_LABELS: Record<"high" | "medium" | "low", string> = {
  high: "🔴 High",
  medium: "🟡 Medium",
  low: "🟢 Low",
};

export default function InboxItem({ item, onDelete, onComplete }: InboxItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isPastDue = item.due_date ? isPastDate(item.due_date) : false;
  const priorityTag = item.tags.find((tag) => tag.startsWith("priority:"));
  const priority = priorityTag?.split(":")[1] as "high" | "medium" | "low" | undefined;
  const visibleTags = item.tags.filter((tag) => tag !== priorityTag);

  const handleDelete = async () => {
    if (!onDelete) {
      return;
    }

    const confirmed = window.confirm("Delete this inbox item?");
    if (!confirmed) {
      return;
    }

    await onDelete(item.id);
  };

  return (
    <article
      role="article"
      aria-label={item.summary}
      className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        item.completed ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {priority ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[priority]}`}
              >
                {PRIORITY_LABELS[priority]}
              </span>
            ) : null}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${TYPE_STYLES[item.type]}`}
            >
              {item.type}
            </span>
            {visibleTags.map((tag) => (
              <span
                key={`${item.id}-${tag}`}
                className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {item.type === "task" ? (
                <input
                  type="checkbox"
                  checked={Boolean(item.completed)}
                  disabled={Boolean(item.completed) || !onComplete}
                  aria-label={`Mark complete: ${item.summary}`}
                  onChange={() => {
                    if (onComplete) {
                      void onComplete(item.id);
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              ) : null}
              <h3
                className={`text-base font-semibold ${
                  item.completed ? "text-gray-500 line-through" : "text-gray-900"
                }`}
              >
                {item.summary}
              </h3>
            </div>
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

        {onDelete ? (
          <button
            type="button"
            onClick={() => {
              void handleDelete();
            }}
            className="rounded-full p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
            aria-label={`Delete: ${item.summary}`}
            title="Delete"
          >
            🗑️
          </button>
        ) : null}
      </div>
    </article>
  );
}
