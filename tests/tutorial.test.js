import test from "node:test";
import assert from "node:assert/strict";
import {
  TUTORIAL_STORAGE_KEY,
  TUTORIAL_STEPS,
  createTutorialProgress,
  normalizeTutorialProgress,
  getTutorialStep,
  advanceTutorial,
  skipTutorial,
  loadTutorialProgress,
  saveTutorialProgress
} from "../tutorial.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    peek(key) { return values.get(key); }
  };
}

test("a new tutorial starts at the welcome step with a stable versioned shape", () => {
  const progress = createTutorialProgress();
  assert.deepEqual(progress, { version: 1, stepIndex: 0, completed: false, skipped: false });
  assert.equal(getTutorialStep(progress).id, "welcome");
  assert.equal(TUTORIAL_STEPS.length, 8);
});

test("the rune step advances only after a successful match event", () => {
  let progress = advanceTutorial(createTutorialProgress(), "next");
  assert.equal(getTutorialStep(progress).id, "match");
  assert.equal(advanceTutorial(progress, "next").stepIndex, 1);
  progress = advanceTutorial(progress, "match");
  assert.equal(getTutorialStep(progress).id, "combo");
});

test("the skill step advances after a skill event and can be manually skipped", () => {
  let progress = createTutorialProgress();
  progress = advanceTutorial(progress, "next");
  progress = advanceTutorial(progress, "match");
  progress = advanceTutorial(progress, "next");
  assert.equal(getTutorialStep(progress).id, "skills");
  assert.equal(advanceTutorial(progress, "match").stepIndex, 3);
  progress = advanceTutorial(progress, "next", true);
  assert.equal(getTutorialStep(progress).id, "party");
});

test("the guided sequence reaches a completed state without marking it skipped", () => {
  let progress = createTutorialProgress();
  progress = advanceTutorial(progress, "next");
  progress = advanceTutorial(progress, "match");
  progress = advanceTutorial(progress, "next");
  progress = advanceTutorial(progress, "skill");
  progress = advanceTutorial(progress, "next");
  progress = advanceTutorial(progress, "next");
  progress = advanceTutorial(progress, "next");
  assert.equal(getTutorialStep(progress).id, "finish");
  progress = advanceTutorial(progress, "next");
  assert.equal(progress.completed, true);
  assert.equal(progress.skipped, false);
  assert.equal(getTutorialStep(progress), null);
});

test("skip completes the tutorial immediately and preserves the distinction from finishing", () => {
  const progress = skipTutorial(createTutorialProgress());
  assert.equal(progress.completed, true);
  assert.equal(progress.skipped, true);
  assert.equal(getTutorialStep(progress), null);
  assert.deepEqual(skipTutorial(progress), progress);
});

test("normalization rejects unsupported versions, invalid indices, and inconsistent flags", () => {
  assert.throws(() => normalizeTutorialProgress({ ...createTutorialProgress(), version: 2 }), /version/i);
  assert.throws(() => normalizeTutorialProgress({ ...createTutorialProgress(), stepIndex: 99 }), /stepIndex/i);
  assert.throws(() => normalizeTutorialProgress({ ...createTutorialProgress(), completed: true }), /completion state/i);
  assert.throws(() => normalizeTutorialProgress({ ...createTutorialProgress(), skipped: true }), /must be completed/i);
});

test("loading distinguishes new, saved, corrupt, and unavailable storage", () => {
  assert.equal(loadTutorialProgress(memoryStorage()).status, "new");
  const storage = memoryStorage();
  saveTutorialProgress(advanceTutorial(createTutorialProgress(), "next"), storage);
  assert.equal(loadTutorialProgress(storage).status, "loaded");
  const corrupt = memoryStorage({ [TUTORIAL_STORAGE_KEY]: "{broken" });
  assert.equal(loadTutorialProgress(corrupt).status, "invalid");
  assert.equal(corrupt.peek(TUTORIAL_STORAGE_KEY), "{broken", "corrupt data must not be deleted");
  assert.equal(loadTutorialProgress(null).status, "unavailable");
});

test("tutorial progress round-trips through storage without mutating the input", () => {
  const storage = memoryStorage();
  const progress = advanceTutorial(createTutorialProgress(), "next");
  const before = structuredClone(progress);
  assert.deepEqual(saveTutorialProgress(progress, storage), { ok: true, status: "saved" });
  assert.deepEqual(loadTutorialProgress(storage).progress, progress);
  assert.deepEqual(progress, before);
});

test("storage write failures are reported without throwing", () => {
  const storage = { setItem() { throw new Error("quota"); } };
  assert.deepEqual(saveTutorialProgress(createTutorialProgress(), storage), { ok: false, status: "failed" });
  assert.equal(saveTutorialProgress(createTutorialProgress(), null).status, "unavailable");
});
