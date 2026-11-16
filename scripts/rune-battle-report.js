import {
  buildRuneBattleReport,
  formatRuneBattleReport
} from "../runeBattleSimulation.js";

const report = buildRuneBattleReport({
  samples: 2,
  seed: 20261117,
  skillPolicy: "greedy"
});
console.log(formatRuneBattleReport(report));
