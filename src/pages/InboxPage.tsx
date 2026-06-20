import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import CaptureBar from "../components/CaptureBar";
import ChatMessage from "../components/ChatMessage";
import InboxItem from "../components/InboxItem";
import { useChat } from "../hooks/useChat";
import { useInbox } from "../hooks/useInbox";

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 h-4 w-20 animate-pulse rounded bg-gray-200" />
          <div className="mb-2 h-5 w-2/3 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export default function InboxPage() {
  const location = useLocation();
  const isSearchView = location.pathname === "/search";
  const [search, setSearch] = useState("");
  const debouncedSearch = useMemo(() => search.trim(), [search]);
  const { items, loading, error, refetch, deleteItem } = useInbox(
    isSearchView ? debouncedSearch : ""
  );
  const { messages, sendMessage, isLoading, clearHistory } = useChat();

  const handleCaptureSubmit = async (text: string) => {
    await sendMessage(text);
    await refetch();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-gray-200 bg-white/90 px-8 py-6 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {isSearchView ? "Search your inbox" : "Inbox"}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Capture fast, organize with AI, and keep your next move visible.
              </p>
            </div>
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-indigo-200 hover:text-indigo-600"
              >
                Clear chat
              </button>
            ) : null}
          </div>

          <CaptureBar onSubmit={handleCaptureSubmit} isLoading={isLoading} />

          {isSearchView ? (
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes, tasks, events, and files..."
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          ) : null}
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-8 py-6">
        <div className="mx-auto grid h-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="flex min-h-0 flex-col rounded-3xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">AI conversation</h2>
                <p className="text-sm text-gray-500">
                  Responses appear here after each capture.
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.length === 0 && !isLoading ? (
                <div className="rounded-2xl border border-dashed border-indigo-200 bg-white/80 p-6 text-sm text-gray-500">
                  Ask LipCoding to summarize, categorize, or schedule what you capture.
                </div>
              ) : null}

              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {isLoading ? <ChatMessage isTyping /> : null}
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {isSearchView ? "Search results" : "Captured items"}
                </h2>
                <p className="text-sm text-gray-500">
                  Newest first, with quick access to the original capture.
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {items.length} item{items.length === 1 ? "" : "s"}
              </span>
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : null}

            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {loading ? <LoadingSkeleton /> : null}

              {!loading && items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
                  Your inbox is empty. Drop something above to get started.
                </div>
              ) : null}

              {!loading
                ? items.map((item) => (
                    <InboxItem key={item.id} item={item} onDelete={deleteItem} />
                  ))
                : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
