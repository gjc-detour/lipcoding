import { useCallback, useState } from "react";
import { sendChat } from "../lib/api";
import type { ChatMessage, ToolEvent } from "../lib/types";

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
  const [lastModel, setLastModel] = useState<string>();
  const [lastLatencyMs, setLastLatencyMs] = useState<number>();
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      const nextUserMessage = createMessage("user", trimmedText);
      const nextHistory = [...messages, nextUserMessage];

      setMessages(nextHistory);
      setLastModel(undefined);
      setLastLatencyMs(undefined);
      setIsLoading(true);
      setToolEvents([]);

      try {
        const result = await sendChat(trimmedText, nextHistory);
        setLastModel(result.model);
        setLastLatencyMs(result.latencyMs);
        setMessages((currentMessages) => [
          ...currentMessages,
          createMessage("assistant", result.response),
        ]);
      } catch (caughtError) {
        setLastModel(undefined);
        setLastLatencyMs(undefined);
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
    setLastModel(undefined);
    setLastLatencyMs(undefined);
    setToolEvents([]);
  }, []);

  const sendMessageStream = useCallback(
    async (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      if (typeof EventSource === "undefined") {
        await sendMessage(trimmedText);
        return;
      }

      const nextUserMessage = createMessage("user", trimmedText);
      const history = [...messages, nextUserMessage];
      const assistantId = `assistant-${Date.now()}`;
      setToolEvents([]);

      setMessages([
        ...history,
        {
          id: assistantId,
          role: "assistant",
          content: "",
        },
      ]);
      setLastModel(undefined);
      setLastLatencyMs(undefined);
      setIsLoading(true);

      await new Promise<void>((resolve) => {
        const finalize = (eventSource: EventSource, responseText?: string) => {
          eventSource.close();
          setIsLoading(false);
          if (responseText) {
            setMessages((currentMessages) =>
              currentMessages.map((message) =>
                message.id === assistantId && !message.content.trim()
                  ? { ...message, content: responseText }
                  : message
              )
            );
          }
          resolve();
        };

        const params = new URLSearchParams({
          message: trimmedText,
          userId: "default",
          messages: JSON.stringify(history.map(({ role, content }) => ({ role, content }))),
        });
        const eventSource = new EventSource(`/api/chat/stream?${params.toString()}`);

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data) as
            | { type: "token"; content: string }
            | { type: "tool_call" | "tool_result"; tool: string; status: "start" | "done"; preview?: string }
            | { type: "done"; response?: string; model?: string; latencyMs?: number }
            | { type: "error"; message?: string };

          if (data.type === "token") {
            setMessages((currentMessages) =>
              currentMessages.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + data.content }
                  : message
              )
            );
            return;
          }

          if (data.type === "tool_call" || data.type === "tool_result") {
            setToolEvents((currentEvents) => {
              const doneEvent: ToolEvent = {
                type: "tool_call",
                tool: data.tool,
                status: data.status,
                preview: data.preview,
              };

              if (data.status === "done") {
                const openIndex = currentEvents.findIndex(
                  (eventItem) =>
                    eventItem.tool === data.tool &&
                    eventItem.status === "start" &&
                    eventItem.preview === data.preview
                );

                if (openIndex >= 0) {
                  return currentEvents.map((eventItem, index) =>
                    index === openIndex ? doneEvent : eventItem
                  );
                }
              }

              return [...currentEvents, doneEvent];
            });
            return;
          }

          if (data.type === "done") {
            setLastModel(data.model);
            setLastLatencyMs(data.latencyMs);
            finalize(eventSource, data.response);
            return;
          }

          let errorMessage = "Sorry, something went wrong while contacting the assistant.";
          if (data.type === "error" && data.message) {
            errorMessage = data.message;
          }
          setLastModel(undefined);
          setLastLatencyMs(undefined);
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === assistantId
                ? { ...message, content: `Sorry — ${errorMessage}` }
                : message
            )
          );
          finalize(eventSource);
        };

        eventSource.onerror = () => {
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    content: message.content.trim()
                      ? message.content
                      : "Sorry — something went wrong while streaming the response.",
                  }
                : message
            )
          );
          finalize(eventSource);
        };
      });
    },
    [messages, sendMessage]
  );

  return {
    messages,
    sendMessage,
    sendMessageStream,
    isLoading,
    toolEvents,
    clearHistory,
    lastModel,
    lastLatencyMs,
  };
}
