import { buildCampaignBalanceReport, formatCampaignBalanceReport } from "../balance.js";

const report = buildCampaignBalanceReport();
console.log(formatCampaignBalanceReport(report));
