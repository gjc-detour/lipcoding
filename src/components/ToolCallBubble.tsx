import type { ToolEvent } from "../lib/types";

interface ToolCallBubbleProps {
  events: ToolEvent[];
}

function getToolLabel(event: ToolEvent): string {
  const preview = event.preview?.trim();
  if (event.status === "done") {
    return preview ? `${event.tool} finished "${preview}"` : `${event.tool} completed`;
  }

  return preview ? `Calling ${event.tool} for "${preview}"` : `Calling ${event.tool}...`;
}

export default function ToolCallBubble({ events }: ToolCallBubbleProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {events.map((event, index) => (
        <div
          key={`${event.tool}-${event.status}-${event.preview ?? "none"}-${index}`}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
            event.status === "done"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-gray-200 bg-gray-100 text-gray-600"
          }`}
        >
          <span className={event.status === "start" ? "animate-pulse" : ""}>
            {event.status === "done" ? "✅" : "🔧"}
          </span>
          <span>{getToolLabel(event)}</span>
        </div>
      ))}
    </div>
  );
}
