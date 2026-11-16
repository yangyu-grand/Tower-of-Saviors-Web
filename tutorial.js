export const TUTORIAL_VERSION = 1;
export const TUTORIAL_STORAGE_KEY = "tower-of-saviors.tutorial.v1";

export const TUTORIAL_STEPS = Object.freeze([
  Object.freeze({
    id: "welcome",
    title: "歡迎來到符石遠征",
    body: "這份簡短導覽會帶你認識轉珠、Combo、角色技能、隊伍編組與卡片養成。你可以隨時跳過，遊戲進度不會受到影響。",
    target: null,
    trigger: "next"
  }),
  Object.freeze({
    id: "match",
    title: "第一步：轉動符石",
    body: "在符石盤上按住一顆符石，拖曳到上下或左右相鄰的位置。讓至少三顆相同屬性的符石連成一線，就能發動消除。",
    target: "#board",
    trigger: "match"
  }),
  Object.freeze({
    id: "combo",
    title: "連鎖消除會累積 Combo",
    body: "符石消除後，上方符石會落下並補滿空格。如果掉落後再次形成消除，就會接續增加 Combo；Combo 越高，這回合的攻擊倍率也越高。",
    target: "#combo",
    trigger: "next"
  }),
  Object.freeze({
    id: "skills",
    title: "善用角色主動技能",
    body: "隊伍中的角色各有不同技能，例如轉換符石、提升攻擊、提供護盾或回復生命。選擇一個目前可用的技能試試看；若暫時不想操作，也可以略過此步。",
    target: "#skillButtons",
    trigger: "skill"
  }),
  Object.freeze({
    id: "party",
    title: "編組你的五人隊伍",
    body: "隊伍共有五個位置，第一格是隊長。隊長技能會影響整隊；不同屬性的隊員也會提供對應攻擊力。更換隊員時，系統會檢查持有狀態與 Cost。",
    target: "#teamSlots",
    trigger: "next"
  }),
  Object.freeze({
    id: "inventory",
    title: "培養並管理卡片",
    body: "在背包中可以查看持有角色、消耗金幣特訓、使用重複卡強化技能，或收集覺醒素材進化角色。培養成果會自動保存到這個瀏覽器。",
    target: "#inventoryGrid",
    trigger: "next"
  }),
  Object.freeze({
    id: "summon",
    title: "透過星門召喚新角色",
    body: "使用召喚石進行單抽或十連。十連至少會取得一張四星以上角色，連續未取得五星時也有五星保底計數。召喚機率與保底進度都會顯示在星門面板。",
    target: ".summon-panel",
    trigger: "next"
  }),
  Object.freeze({
    id: "finish",
    title: "準備好展開冒險了！",
    body: "你已認識遊戲的主要操作。接下來就挑戰關卡、培養原創角色，並組合不同屬性與技能，找出適合自己的戰術吧！",
    target: null,
    trigger: "next"
  })
]);

export function createTutorialProgress() {
  return {
    version: TUTORIAL_VERSION,
    stepIndex: 0,
    completed: false,
    skipped: false
  };
}

export function normalizeTutorialProgress(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Tutorial progress must be an object");
  }
  if (input.version !== TUTORIAL_VERSION) {
    throw new RangeError("Unsupported tutorial progress version");
  }
  if (!Number.isInteger(input.stepIndex) || input.stepIndex < 0 || input.stepIndex > TUTORIAL_STEPS.length) {
    throw new RangeError("Tutorial stepIndex is out of range");
  }
  if (typeof input.completed !== "boolean" || typeof input.skipped !== "boolean") {
    throw new TypeError("Tutorial completion flags must be boolean");
  }
  if (input.completed !== (input.stepIndex === TUTORIAL_STEPS.length)) {
    throw new RangeError("Tutorial completion state does not match its step");
  }
  if (input.skipped && !input.completed) {
    throw new RangeError("A skipped tutorial must be completed");
  }
  return {
    version: TUTORIAL_VERSION,
    stepIndex: input.stepIndex,
    completed: input.completed,
    skipped: input.skipped
  };
}

export function getTutorialStep(progress) {
  const normalized = normalizeTutorialProgress(progress);
  return normalized.completed ? null : TUTORIAL_STEPS[normalized.stepIndex];
}

export function advanceTutorial(progress, trigger = "next", force = false) {
  const current = normalizeTutorialProgress(progress);
  if (current.completed) return current;
  if (typeof trigger !== "string" || trigger.length === 0) {
    throw new TypeError("Tutorial trigger must be a non-empty string");
  }
  const step = TUTORIAL_STEPS[current.stepIndex];
  if (!force && step.trigger !== trigger) return current;
  const stepIndex = current.stepIndex + 1;
  return {
    version: TUTORIAL_VERSION,
    stepIndex,
    completed: stepIndex === TUTORIAL_STEPS.length,
    skipped: false
  };
}

export function skipTutorial(progress) {
  const current = normalizeTutorialProgress(progress);
  if (current.completed) return current;
  return {
    version: TUTORIAL_VERSION,
    stepIndex: TUTORIAL_STEPS.length,
    completed: true,
    skipped: true
  };
}

export function loadTutorialProgress(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return { progress: createTutorialProgress(), status: "unavailable" };
  }
  try {
    const raw = storage.getItem(TUTORIAL_STORAGE_KEY);
    if (raw === null) return { progress: createTutorialProgress(), status: "new" };
    try {
      return { progress: normalizeTutorialProgress(JSON.parse(raw)), status: "loaded" };
    } catch {
      return { progress: createTutorialProgress(), status: "invalid" };
    }
  } catch {
    return { progress: createTutorialProgress(), status: "unavailable" };
  }
}

export function saveTutorialProgress(progress, storage) {
  if (!storage || typeof storage.setItem !== "function") {
    return { ok: false, status: "unavailable" };
  }
  let normalized;
  try {
    normalized = normalizeTutorialProgress(progress);
  } catch (error) {
    return { ok: false, status: "invalid", error: error.message };
  }
  try {
    storage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(normalized));
    return { ok: true, status: "saved" };
  } catch {
    return { ok: false, status: "failed" };
  }
}
