const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export type FollowUpState = "overdue" | "today" | "upcoming";

export function parseFollowUpDate(value: string): string | null | undefined {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return undefined;
  }

  return value;
}

export function getFollowUpCutoff(today: string): string {
  const parsedToday = parseFollowUpDate(today);
  if (!parsedToday) throw new Error("A valid current date is required.");

  return new Date(Date.parse(`${parsedToday}T00:00:00.000Z`) + 7 * DAY_IN_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

export function getFollowUpState(followUpDate: string, today: string): FollowUpState {
  if (followUpDate < today) return "overdue";
  if (followUpDate === today) return "today";
  return "upcoming";
}

export function formatFollowUpDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
  });
}
