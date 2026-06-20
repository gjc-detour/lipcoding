import { EmailClient } from "@azure/communication-email";
import { logger } from "./logger.js";

interface ReminderEvent {
  title: string;
  description?: string;
  due_at: string;
}

let emailClient: EmailClient | null = null;

function getEmailClient(connectionString: string): EmailClient {
  if (!emailClient) {
    emailClient = new EmailClient(connectionString);
  }

  return emailClient;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDueDate(dueAt: string): string {
  const parsed = new Date(dueAt);
  if (Number.isNaN(parsed.getTime())) {
    return dueAt;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(parsed);
}

function buildHtmlBody(event: ReminderEvent): string {
  const title = escapeHtml(event.title);
  const description = event.description?.trim()
    ? `<p style="margin: 12px 0 0; color: #475569; font-size: 14px; line-height: 1.6;">${escapeHtml(event.description)}</p>`
    : "";
  const dueAt = escapeHtml(formatDueDate(event.due_at));

  return `
    <div style="background: #fff7ed; padding: 24px; font-family: Arial, sans-serif;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #fdba74; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #f59e0b, #f97316); color: #ffffff; padding: 16px 20px; font-size: 18px; font-weight: 700;">
          ⏰ Event reminder
        </div>
        <div style="padding: 20px;">
          <h1 style="margin: 0; color: #111827; font-size: 22px; line-height: 1.3;">${title}</h1>
          ${description}
          <div style="margin-top: 18px; padding: 14px 16px; border-radius: 12px; background: #fff7ed; border: 1px solid #fed7aa;">
            <p style="margin: 0; color: #9a3412; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
              Due time
            </p>
            <p style="margin: 6px 0 0; color: #7c2d12; font-size: 15px; font-weight: 600;">${dueAt}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function sendEventReminderEmail(event: ReminderEvent): Promise<void> {
  const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;

  if (!connectionString) {
    logger.warn("Email notifications skipped because ACS connection string is missing");
    return;
  }

  const senderAddress = process.env.NOTIFICATION_FROM_EMAIL;
  const recipientAddress = process.env.NOTIFICATION_TO_EMAIL;

  if (!senderAddress || !recipientAddress) {
    logger.warn("Email notifications skipped because sender or recipient email is missing");
    return;
  }

  try {
    const client = getEmailClient(connectionString);
    const subject = `⏰ Reminder: ${event.title}`;
    const html = buildHtmlBody(event);

    const poller = await client.beginSend({
      senderAddress,
      content: {
        subject,
        plainText: `${event.title}${event.description ? `\n\n${event.description}` : ""}\n\nDue: ${formatDueDate(event.due_at)}`,
        html,
      },
      recipients: {
        to: [{ address: recipientAddress }],
      },
    });

    const result = await poller.pollUntilDone();

    if (result.status !== "Succeeded") {
      logger.error("Email notification failed", {
        title: event.title,
        dueAt: event.due_at,
        status: result.status,
        error: result.error?.message,
      });
      return;
    }

    logger.info("Email notification sent", {
      title: event.title,
      dueAt: event.due_at,
      operationId: result.id,
      status: result.status,
    });
  } catch (error: unknown) {
    logger.error("Email notification failed", {
      title: event.title,
      dueAt: event.due_at,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
