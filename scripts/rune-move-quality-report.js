import { buildRuneMoveQualityReport, formatRuneMoveQualityReport } from "../runeMoveAnalysis.js";

const report = buildRuneMoveQualityReport({
  samples: 100,
  seed: 20261117,
  enemyElement: "fire"
});

console.log(formatRuneMoveQualityReport(report));
if (report.summary.deadBoardCount !== 0) {
  process.exitCode = 1;
}
