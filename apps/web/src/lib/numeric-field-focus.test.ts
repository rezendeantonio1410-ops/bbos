import assert from "node:assert/strict";
import test from "node:test";
import { isNumericField } from "./numeric-field-focus";

function field(attrs: Record<string, string>, extra: Partial<{ readOnly: boolean; disabled: boolean; tagName: string }> = {}) {
  return {
    tagName: extra.tagName ?? "INPUT",
    readOnly: extra.readOnly ?? false,
    disabled: extra.disabled ?? false,
    dataset: attrs["data-keep-cursor"] !== undefined ? { keepCursor: "" } : {},
    getAttribute: (name: string) => attrs[name] ?? null,
  } as unknown as EventTarget;
}

test("number fields select their content on tap; text fields do not", () => {
  assert.equal(isNumericField(field({ type: "number" })), true);
  assert.equal(isNumericField(field({ type: "text", inputmode: "decimal" })), true);
  assert.equal(isNumericField(field({ inputmode: "numeric" })), true);
  assert.equal(isNumericField(field({ type: "text" })), false);
  assert.equal(isNumericField(field({ type: "email", inputmode: "numeric" })), false);
  assert.equal(isNumericField(field({ type: "number" }, { readOnly: true })), false);
  assert.equal(isNumericField(field({ type: "number" }, { disabled: true })), false);
  assert.equal(isNumericField(field({ type: "number", "data-keep-cursor": "" })), false);
  assert.equal(isNumericField(field({}, { tagName: "TEXTAREA" })), false);
  assert.equal(isNumericField(null), false);
});
