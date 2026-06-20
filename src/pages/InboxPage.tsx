import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import CaptureBar from "../components/CaptureBar";
import ChatMessage from "../components/ChatMessage";
import InboxItem from "../components/InboxItem";
import SearchBar from "../components/SearchBar";
import { useChat } from "../hooks/useChat";
import { useInbox } from "../hooks/useInbox";
import { useSearch } from "../hooks/useSearch";
import type { InboxItem as InboxItemModel } from "../lib/types";

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

function PageShell({
  title,
  subtitle,
  headerContent,
  leftPanel,
  rightPanelTitle,
  rightPanelSubtitle,
  rightPanelCount,
  rightPanelContent,
}: {
  title: string;
  subtitle: string;
  headerContent: ReactNode;
  leftPanel: ReactNode;
  rightPanelTitle: string;
  rightPanelSubtitle: string;
  rightPanelCount: number;
  rightPanelContent: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-gray-200 bg-white/90 px-8 py-6 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          </div>
          {headerContent}
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-8 py-6">
        <div className="mx-auto grid h-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {leftPanel}

          <section className="flex min-h-0 flex-col rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{rightPanelTitle}</h2>
                <p className="text-sm text-gray-500">{rightPanelSubtitle}</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                {rightPanelCount} item{rightPanelCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">{rightPanelContent}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CaptureInboxView() {
  const { items, loading, error, refetch, deleteItem } = useInbox();
  const { messages, sendMessage, isLoading, clearHistory } = useChat();

  const handleCaptureSubmit = async (text: string) => {
    await sendMessage(text);
    await refetch();
  };

  return (
    <PageShell
      title="Inbox"
      subtitle="Capture fast, organize with AI, and keep your next move visible."
      headerContent={
        <>
          {messages.length > 0 ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-indigo-200 hover:text-indigo-600"
              >
                Clear chat
              </button>
            </div>
          ) : null}
          <CaptureBar onSubmit={handleCaptureSubmit} isLoading={isLoading} />
        </>
      }
      leftPanel={
        <section className="flex min-h-0 flex-col rounded-3xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">AI conversation</h2>
            <p className="text-sm text-gray-500">Responses appear here after each capture.</p>
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
      }
      rightPanelTitle="Captured items"
      rightPanelSubtitle="Newest first, with quick access to the original capture."
      rightPanelCount={items.length}
      rightPanelContent={
        <>
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          {loading ? <LoadingSkeleton /> : null}

          {!loading && items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
              Your inbox is empty. Drop something above to get started.
            </div>
          ) : null}

          {!loading
            ? items.map((item) => <InboxItem key={item.id} item={item} onDelete={deleteItem} />)
            : null}
        </>
      }
    />
  );
}

function SearchTips({
  activeFilters,
}: {
  activeFilters: Array<{ label: string; value: string }>;
}) {
  return (
    <section className="flex min-h-0 flex-col rounded-3xl border border-gray-200 bg-gradient-to-br from-indigo-50 via-white to-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Search tips</h2>
        <p className="text-sm text-gray-500">
          Narrow down by type, tag, or created date to find the exact capture you need.
        </p>
      </div>

      <div className="space-y-4 text-sm text-gray-600">
        <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4">
          <p className="font-medium text-gray-900">What you can search</p>
          <ul className="mt-3 space-y-2">
            <li>• Notes, tasks, events, and files</li>
            <li>• Original captures and AI summaries</li>
            <li>• Tagged items and recent captures</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="font-medium text-gray-900">Active filters</p>
          {activeFilters.length === 0 ? (
            <p className="mt-2 text-gray-500">Start typing or add filters to search your inbox.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <span
                  key={`${filter.label}-${filter.value}`}
                  className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700"
                >
                  {filter.label}: {filter.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SearchInboxView() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<InboxItemModel["type"] | undefined>();
  const [tag, setTag] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { items, total, loading, error } = useSearch({ query, type, tag, from, to });

  const activeFilters = [
    query ? { label: "Query", value: query } : null,
    type ? { label: "Type", value: type } : null,
    tag ? { label: "Tag", value: tag } : null,
    from ? { label: "From", value: from } : null,
    to ? { label: "To", value: to } : null,
  ].filter((value): value is { label: string; value: string } => value !== null);

  const hasActiveSearch = activeFilters.length > 0;

  return (
    <PageShell
      title="Search your inbox"
      subtitle="Find captured notes, tasks, events, and files in seconds."
      headerContent={
        <SearchBar
          query={query}
          type={type}
          tag={tag}
          from={from}
          to={to}
          total={total}
          onQueryChange={setQuery}
          onTypeChange={setType}
          onTagChange={setTag}
          onFromChange={setFrom}
          onToChange={setTo}
          onClear={() => {
            setQuery("");
            setType(undefined);
            setTag("");
            setFrom("");
            setTo("");
          }}
        />
      }
      leftPanel={<SearchTips activeFilters={activeFilters} />}
      rightPanelTitle="Search results"
      rightPanelSubtitle="Filtered results from your inbox, newest first."
      rightPanelCount={total}
      rightPanelContent={
        <>
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          {loading ? <LoadingSkeleton /> : null}

          {!loading && !hasActiveSearch ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
              Start typing to search
            </div>
          ) : null}

          {!loading && hasActiveSearch && items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-sm text-gray-500">
              {query ? `No results for '${query}'` : "No results for the selected filters."}
            </div>
          ) : null}

          {!loading && items.length > 0
            ? items.map((item) => <InboxItem key={item.id} item={item} />)
            : null}
        </>
      }
    />
  );
}

export default function InboxPage() {
  const location = useLocation();

  return location.pathname === "/search" ? <SearchInboxView /> : <CaptureInboxView />;
}
