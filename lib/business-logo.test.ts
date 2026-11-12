import assert from "node:assert/strict";
import test from "node:test";
import { identifyBusinessLogoFormat } from "./business-logo";

test("accepts supported image signatures", () => {
  assert.deepEqual(
    identifyBusinessLogoFormat("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    { contentType: "image/png", extension: "png" },
  );
  assert.deepEqual(
    identifyBusinessLogoFormat("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff])),
    { contentType: "image/jpeg", extension: "jpg" },
  );
  assert.deepEqual(
    identifyBusinessLogoFormat(
      "image/webp",
      Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
    ),
    { contentType: "image/webp", extension: "webp" },
  );
});

test("rejects unsupported, mismatched, and truncated image signatures", () => {
  assert.equal(identifyBusinessLogoFormat("image/svg+xml", new Uint8Array(16)), null);
  assert.equal(identifyBusinessLogoFormat("image/png", Uint8Array.from([0x89, 0x50])), null);
  assert.equal(
    identifyBusinessLogoFormat("image/png", Uint8Array.from([0xff, 0xd8, 0xff])),
    null,
  );
});
