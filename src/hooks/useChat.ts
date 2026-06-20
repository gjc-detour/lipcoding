import { useCallback, useState } from "react";
import { sendChat } from "../lib/api";
import type { ChatMessage } from "../lib/types";

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      const nextUserMessage = createMessage("user", trimmedText);
      const nextHistory = [...messages, nextUserMessage];

      setMessages(nextHistory);
      setIsLoading(true);

      try {
        const result = await sendChat(trimmedText, nextHistory);
        setMessages((currentMessages) => [
          ...currentMessages,
          createMessage("assistant", result.response),
        ]);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Sorry, something went wrong while contacting the assistant.";

        setMessages((currentMessages) => [
          ...currentMessages,
          createMessage("assistant", `Sorry — ${message}`),
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    clearHistory,
  };
}
