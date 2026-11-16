import { simulateRuneEncounter } from "../runeBattleSimulation.js";
import { createRuneBattleReplay } from "../runeBattleReplay.js";

const simulation = simulateRuneEncounter({
  stageIndex: 3,
  waveIndex: 2,
  seed: 20261117,
  skillPolicy: "greedy",
  maxTurns: 60
});
const replay = createRuneBattleReplay(simulation);
const counts = {};
for (const event of replay.events) counts[event.type] = (counts[event.type] ?? 0) + 1;

console.log("Rune battle replay report");
console.log("Seed: " + replay.seed);
console.log("Encounter: " + replay.stage.name + " / " + replay.encounter.name);
console.log("Status: " + replay.status);
console.log("Turns: " + replay.turnsSimulated);
console.log("Events: " + replay.eventCount);
console.log("Event types: " + Object.entries(counts).map(([type, count]) => type + "=" + count).join(", "));
console.log("First swap: " + JSON.stringify(replay.events.find((event) => event.type === "swap")?.data ?? null));
