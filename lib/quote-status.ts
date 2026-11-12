export const quoteStatuses = ["draft", "sent", "accepted", "declined", "completed"] as const;

export type QuoteStatus = (typeof quoteStatuses)[number];

export function isQuoteStatus(status: string): status is QuoteStatus {
  return quoteStatuses.some((validStatus) => validStatus === status);
}
