import ReactMarkdown from "react-markdown";
import type { ChatMessage as ChatMessageModel, ToolEvent } from "../lib/types";
import ToolCallBubble from "./ToolCallBubble";

interface ChatMessageProps {
  message?: ChatMessageModel;
  isTyping?: boolean;
  attribution?: string;
  toolEvents?: ToolEvent[];
  onRetry?: () => void | Promise<void>;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
          style={{ animationDelay: `${dot * 120}ms` }}
        />
      ))}
    </div>
  );
}

export default function ChatMessage({
  message,
  isTyping = false,
  attribution,
  toolEvents = [],
  onRetry,
}: ChatMessageProps) {
  const isUser = message?.role === "user";

  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && toolEvents.length > 0 ? <ToolCallBubble events={toolEvents} /> : null}
      <div
        className={`max-w-2xl rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isUser
            ? "bg-indigo-600 text-white"
            : "border border-gray-200 bg-white text-gray-800"
        }`}
      >
        {isTyping ? (
          <TypingIndicator />
        ) : (
          <>
            <div
              className={`prose prose-sm max-w-none ${
                isUser ? "prose-invert" : "dark:prose-invert"
              }`}
            >
              <ReactMarkdown>{message?.content ?? ""}</ReactMarkdown>
            </div>
            {!isUser && attribution ? (
              <p className="mt-1 text-[10px] text-gray-400">⚡ {attribution}</p>
            ) : null}
            {message?.role === "assistant" &&
            message.content.startsWith("Sorry") &&
            onRetry ? (
              <button
                type="button"
                onClick={() => {
                  void onRetry();
                }}
                className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-500"
              >
                ↺ Retry
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
