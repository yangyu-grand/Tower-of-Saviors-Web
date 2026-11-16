import {
  buildPartyBalanceReport,
  formatPartyBalanceReport
} from "../partyBalance.js";

const report = buildPartyBalanceReport();
console.log(formatPartyBalanceReport(report));
