import { useEffect, useMemo, useState } from "react";
import type { InboxItem } from "../lib/types";

type SearchType = InboxItem["type"];

interface SearchBarProps {
  query: string;
  type?: SearchType;
  tag: string;
  from: string;
  to: string;
  total: number;
  onQueryChange: (value: string) => void;
  onTypeChange: (value?: SearchType) => void;
  onTagChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear: () => void;
}

const TYPE_OPTIONS: Array<{ label: string; value?: SearchType }> = [
  { label: "All" },
  { label: "Notes", value: "note" },
  { label: "Tasks", value: "task" },
  { label: "Events", value: "event" },
  { label: "Files", value: "file" },
];

export default function SearchBar({
  query,
  type,
  tag,
  from,
  to,
  total,
  onQueryChange,
  onTypeChange,
  onTagChange,
  onFromChange,
  onToChange,
  onClear,
}: SearchBarProps) {
  const [localQuery, setLocalQuery] = useState(query);

  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  useEffect(() => {
    if (localQuery === query) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onQueryChange(localQuery);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [localQuery, onQueryChange, query]);

  const hasActiveFilters = useMemo(
    () => Boolean(query || type || tag || from || to),
    [from, query, tag, to, type]
  );

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            value={localQuery}
            onChange={(event) => setLocalQuery(event.target.value)}
            placeholder="Search notes, tasks, events, and files..."
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          <div className="flex items-center justify-between gap-3 lg:min-w-fit">
            <span className="text-sm font-medium text-gray-500">
              {total} result{total === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={onClear}
              disabled={!hasActiveFilters}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear all filters
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((option) => {
            const isActive = option.value === type || (!option.value && !type);
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => onTypeChange(option.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-600"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
          <label className="flex flex-col gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-700">From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-700">To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => onToChange(event.target.value)}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-700">Tag</span>
            <input
              type="text"
              value={tag}
              onChange={(event) => onTagChange(event.target.value)}
              placeholder="Filter by tag"
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
