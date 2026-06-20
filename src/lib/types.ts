export interface InboxItem {
  id: string;
  user_id: string;
  type: "note" | "task" | "event" | "file";
  raw: string;
  summary: string;
  tags: string[];
  due_date?: string;
  scheduled: boolean;
  created_at: string;
}

export interface ScheduledEvent {
  id: string;
  user_id: string;
  item_id?: string;
  title: string;
  description?: string;
  due_at: string;
  notified: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
