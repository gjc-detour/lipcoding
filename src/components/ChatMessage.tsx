import { Fragment } from "react";
import type { ChatMessage as ChatMessageModel } from "../lib/types";

interface ChatMessageProps {
  message?: ChatMessageModel;
  isTyping?: boolean;
}

function renderBoldSegments(text: string) {
  return text.split("**").map((segment, index) =>
    index % 2 === 1 ? (
      <strong key={`${segment}-${index}`} className="font-semibold">
        {segment}
      </strong>
    ) : (
      <Fragment key={`${segment}-${index}`}>{segment}</Fragment>
    )
  );
}

function renderFormattedContent(content: string) {
  return content.split("\n").map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {renderBoldSegments(line)}
    </Fragment>
  ));
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

export default function ChatMessage({ message, isTyping = false }: ChatMessageProps) {
  const isUser = message?.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-2xl rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isUser
            ? "bg-indigo-600 text-white"
            : "border border-gray-200 bg-white text-gray-800"
        }`}
      >
        {isTyping ? <TypingIndicator /> : renderFormattedContent(message?.content ?? "")}
      </div>
    </div>
  );
}
