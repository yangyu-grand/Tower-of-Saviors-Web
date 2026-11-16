import {
  buildRepresentativeCampaignReport,
  formatRepresentativeCampaignReport
} from "../balanceScenarios.js";

const report = buildRepresentativeCampaignReport();
console.log(formatRepresentativeCampaignReport(report));
