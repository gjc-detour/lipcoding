const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

type RelativeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year";

function getRelativeParts(targetDate: string): { value: number; unit: RelativeUnit } {
  const now = Date.now();
  const target = new Date(targetDate).getTime();
  const deltaSeconds = Math.round((target - now) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);

  if (absoluteSeconds < 60) {
    return { value: deltaSeconds, unit: "second" };
  }

  const deltaMinutes = Math.round(deltaSeconds / 60);
  if (Math.abs(deltaMinutes) < 60) {
    return { value: deltaMinutes, unit: "minute" };
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) {
    return { value: deltaHours, unit: "hour" };
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (Math.abs(deltaDays) < 7) {
    return { value: deltaDays, unit: "day" };
  }

  const deltaWeeks = Math.round(deltaDays / 7);
  if (Math.abs(deltaWeeks) < 5) {
    return { value: deltaWeeks, unit: "week" };
  }

  const deltaMonths = Math.round(deltaDays / 30);
  if (Math.abs(deltaMonths) < 12) {
    return { value: deltaMonths, unit: "month" };
  }

  const deltaYears = Math.round(deltaDays / 365);
  return { value: deltaYears, unit: "year" };
}

export function formatRelativeTime(targetDate: string): string {
  if (Number.isNaN(Date.parse(targetDate))) {
    return "Unknown time";
  }

  const { value, unit } = getRelativeParts(targetDate);
  return relativeTimeFormatter.format(value, unit);
}

export function isPastDate(targetDate: string): boolean {
  return new Date(targetDate).getTime() < Date.now();
}

export function formatDateTime(targetDate: string): string {
  if (Number.isNaN(Date.parse(targetDate))) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(targetDate));
}
