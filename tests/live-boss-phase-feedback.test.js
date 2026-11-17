import test from "node:test";
import assert from "node:assert/strict";
import { getLiveBossPhaseTransition } from "../liveBossPhaseFeedback.js";

test("live Boss phase changes return a bounded from/to announcement", () => {
  assert.deepEqual(getLiveBossPhaseTransition("花霧姿態", "月蝕姿態"), {
    fromPhase: "花霧姿態",
    toPhase: "月蝕姿態"
  });
});

test("initial, missing, and unchanged phases do not announce", () => {
  assert.equal(getLiveBossPhaseTransition(null, "花霧姿態"), null);
  assert.equal(getLiveBossPhaseTransition("花霧姿態", null), null);
  assert.equal(getLiveBossPhaseTransition("花霧姿態", "花霧姿態"), null);
  assert.equal(getLiveBossPhaseTransition("  ", "月蝕姿態"), null);
});

test("phase labels normalize whitespace and are length-bounded", () => {
  const transition = getLiveBossPhaseTransition(
    "  " + "花霧".repeat(40),
    "  月蝕\n  姿態  "
  );
  assert.equal(transition.fromPhase.length, 48);
  assert.equal(transition.toPhase, "月蝕 姿態");
});

test("phase labels remain plain text values for safe textContent rendering", () => {
  const transition = getLiveBossPhaseTransition("<img src=x onerror=alert(1)>", "月蝕姿態");
  assert.equal(transition.fromPhase, "<img src=x onerror=alert(1)>");
});
