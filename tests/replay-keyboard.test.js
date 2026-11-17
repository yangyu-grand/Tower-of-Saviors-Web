import test from "node:test";
import assert from "node:assert/strict";
import { getReplayKeyboardAction } from "../replayKeyboard.js";

function keyEvent(key, overrides = {}) {
  return { key, target: { tagName: "SECTION" }, ...overrides };
}

test("replay keyboard maps playback, stepping, and boundary navigation", () => {
  assert.equal(getReplayKeyboardAction(keyEvent(" ")), "toggle");
  assert.equal(getReplayKeyboardAction(keyEvent("Spacebar")), "toggle");
  assert.equal(getReplayKeyboardAction(keyEvent("ArrowLeft")), "previous");
  assert.equal(getReplayKeyboardAction(keyEvent("ArrowRight")), "next");
  assert.equal(getReplayKeyboardAction(keyEvent("Home")), "first");
  assert.equal(getReplayKeyboardAction(keyEvent("End")), "last");
});

test("unsupported keys and malformed events are ignored", () => {
  assert.equal(getReplayKeyboardAction(null), null);
  assert.equal(getReplayKeyboardAction({}), null);
  assert.equal(getReplayKeyboardAction(keyEvent("Escape")), null);
});

test("modifier shortcuts and already handled events are ignored", () => {
  for (const overrides of [
    { altKey: true }, { ctrlKey: true }, { metaKey: true },
    { defaultPrevented: true }, { repeat: true }
  ]) {
    assert.equal(getReplayKeyboardAction(keyEvent("ArrowRight", overrides)), null);
  }
});

test("typing and native controls keep their own keyboard behavior", () => {
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "LABEL"]) {
    assert.equal(getReplayKeyboardAction(keyEvent(" ", { target: { tagName } })), null);
  }
  assert.equal(getReplayKeyboardAction(keyEvent("ArrowLeft", {
    target: { tagName: "DIV", isContentEditable: true }
  })), null);
});
