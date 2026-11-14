import assert from "node:assert/strict";
import test from "node:test";
import {
  FREE_PLAN_LIMITS,
  getQuotaExceededMessage,
  hasReachedFreePlanLimit,
} from "./plan-limits";

test("free plan limits are three active clients and five saved quotes", () => {
  assert.deepEqual(FREE_PLAN_LIMITS, { clients: 3, quotes: 5 });
  assert.equal(hasReachedFreePlanLimit("clients", 2, false), false);
  assert.equal(hasReachedFreePlanLimit("clients", 3, false), true);
  assert.equal(hasReachedFreePlanLimit("quotes", 4, false), false);
  assert.equal(hasReachedFreePlanLimit("quotes", 5, false), true);
});

test("paid workspaces are unlimited and database quota errors are actionable", () => {
  assert.equal(hasReachedFreePlanLimit("clients", 30, true), false);
  assert.equal(hasReachedFreePlanLimit("quotes", 50, true), false);
  assert.match(
    getQuotaExceededMessage("free_plan_client_limit_reached") ?? "",
    /3 active clients/,
  );
  assert.match(
    getQuotaExceededMessage("free_plan_quote_limit_reached") ?? "",
    /5 saved quotes/,
  );
  assert.equal(getQuotaExceededMessage("other database error"), null);
});
