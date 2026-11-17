const KEY_ACTIONS = Object.freeze({
  " ": "toggle",
  Spacebar: "toggle",
  ArrowLeft: "previous",
  ArrowRight: "next",
  Home: "first",
  End: "last"
});

const INTERACTIVE_TAGS = new Set(["input", "textarea", "select", "button", "a", "label"]);

export function getReplayKeyboardAction(event) {
  if (!event || typeof event !== "object" || event.defaultPrevented || event.repeat ||
      event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }
  const target = event.target;
  const tagName = String(target?.tagName ?? "").toLowerCase();
  if (INTERACTIVE_TAGS.has(tagName) || target?.isContentEditable) return null;
  return KEY_ACTIONS[event.key] ?? null;
}
