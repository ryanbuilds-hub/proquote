import test from "node:test";
import assert from "node:assert/strict";
import {
  formatFollowUpDate,
  getFollowUpCutoff,
  getFollowUpState,
  parseFollowUpDate,
} from "./quote-follow-up";

test("validates optional follow-up dates and rejects impossible calendar dates", () => {
  assert.equal(parseFollowUpDate(""), null);
  assert.equal(parseFollowUpDate("2028-02-29"), "2028-02-29");
  assert.equal(parseFollowUpDate("2027-02-29"), undefined);
  assert.equal(parseFollowUpDate("18-11-2026"), undefined);
});

test("includes the next seven calendar days in the reminder window", () => {
  assert.equal(getFollowUpCutoff("2026-12-29"), "2027-01-05");
});

test("classifies overdue, today, and upcoming reminders", () => {
  assert.equal(getFollowUpState("2026-11-17", "2026-11-18"), "overdue");
  assert.equal(getFollowUpState("2026-11-18", "2026-11-18"), "today");
  assert.equal(getFollowUpState("2026-11-19", "2026-11-18"), "upcoming");
});

test("formats date-only values without shifting the calendar day", () => {
  assert.equal(formatFollowUpDate("2026-11-18"), "18 Nov");
});
