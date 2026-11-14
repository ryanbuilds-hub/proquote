export const FREE_PLAN_LIMITS = {
  clients: 3,
  quotes: 5,
} as const;

export type PlanResource = keyof typeof FREE_PLAN_LIMITS;

export function hasReachedFreePlanLimit(
  resource: PlanResource,
  currentCount: number,
  isPaid: boolean,
): boolean {
  return !isPaid && currentCount >= FREE_PLAN_LIMITS[resource];
}

export function getQuotaExceededMessage(databaseMessage: string): string | null {
  if (databaseMessage.includes("free_plan_client_limit_reached")) {
    return "The free plan includes up to 3 active clients. Upgrade for unlimited clients.";
  }
  if (databaseMessage.includes("free_plan_quote_limit_reached")) {
    return "The free plan includes up to 5 saved quotes. Upgrade for unlimited quotes.";
  }
  return null;
}
