const ELEMENTS = Object.freeze({
  fire: { icon: "🔥", name: "火" },
  water: { icon: "💧", name: "水" },
  wood: { icon: "🌿", name: "木" },
  light: { icon: "✨", name: "光" },
  dark: { icon: "🌙", name: "暗" }
});

function positiveDamage(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function buildLiveCombatNumbers({ damageByElement = [], totalDamage = 0, combo = 0 } = {}) {
  const numbers = [];
  if (Array.isArray(damageByElement)) {
    for (const item of damageByElement) {
      if (!item || !Object.hasOwn(ELEMENTS, item.element) || !positiveDamage(item.damage)) continue;
      const element = ELEMENTS[item.element];
      numbers.push({
        type: "element",
        element: item.element,
        text: element.icon + " " + element.name + " " + item.damage.toLocaleString("zh-TW")
      });
    }
  }
  if (numbers.length === 0 && positiveDamage(totalDamage)) {
    numbers.push({ type: "total", element: "neutral", text: "⚔️ " + totalDamage.toLocaleString("zh-TW") });
  }
  if (Number.isSafeInteger(combo) && combo > 1) {
    numbers.push({ type: "combo", element: "combo", text: combo + " COMBO" });
  }
  return numbers;
}
