/**
 * FixLens AI — Production-grade CSV Export Utility
 * 
 * Features:
 * - RFC 4180 standard compliance (comma delimiter, double-quote escaping, CRLF line endings)
 * - UTF-8 Byte Order Mark (BOM) inclusion for flawless Excel & Google Sheets character encoding
 * - Formula Injection Mitigation (sanitizes values starting with '=', '+', '-', '@', '\t', '\r')
 * - Safe null/undefined handling and date formatting
 */

import type { Complaint, Proposal } from "./demo-data";

/**
 * Sanitizes a single cell value to prevent CSV / Spreadsheet formula injection (CWE-1236)
 * and properly escapes quotes and delimiters per RFC 4180.
 */
export function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value).trim();

  // Protect against formula injection in spreadsheet applications (Excel, LibreOffice, Sheets)
  const isDangerousStart = /^[=+\-@\t\r]/.test(str);
  if (isDangerousStart) {
    str = `'${str}`;
  }

  // If cell contains commas, quotes, or newlines, quote the string and escape internal quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r") || isDangerousStart) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts headers and row tuples into a formatted RFC 4180 CSV string.
 */
export function buildCSV(headers: string[], rows: (unknown[])[]): string {
  const headerLine = headers.map(escapeCSVCell).join(",");
  const rowLines = rows.map((row) => row.map(escapeCSVCell).join(","));
  return [headerLine, ...rowLines].join("\r\n");
}

/**
 * Triggers a browser file download of the CSV content with UTF-8 BOM.
 */
export function triggerCSVDownload(content: string, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  // Prepend UTF-8 BOM (\uFEFF) so Excel correctly recognizes UTF-8 encoding
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports a collection of campus complaints to a standardized CSV file.
 */
export function exportComplaintsToCSV(
  complaints: Complaint[],
  customFilename?: string,
): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `fixlens_complaints_${dateStr}.csv`;

  const headers = [
    "Complaint ID",
    "Title",
    "Category",
    "Building",
    "Room / Location",
    "Urgency",
    "Priority",
    "Status",
    "Affected Students",
    "Date Reported",
    "Reporter",
    "Resolution Note",
    "Escalated Priority",
    "Escalation Reasons",
  ];

  const rows = complaints.map((c) => [
    c.id,
    c.title,
    c.category,
    c.building,
    c.room,
    c.urgency,
    c.priority,
    c.status,
    c.affected,
    c.date,
    c.reporter || "Campus Student",
    c.resolutionNote || "Pending",
    c.escalatedPriority || c.priority,
    c.escalationReasons?.join("; ") || "Standard assessment",
  ]);

  const csv = buildCSV(headers, rows);
  triggerCSVDownload(csv, filename);
}

/**
 * Exports campus improvement proposals to a standardized CSV file.
 */
export function exportProposalsToCSV(
  proposals: Proposal[],
  customFilename?: string,
): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `fixlens_proposals_${dateStr}.csv`;

  const headers = [
    "Proposal ID",
    "Title",
    "Category",
    "Location",
    "Supporters",
    "Status",
    "Proposed Date",
    "Author",
    "Admin Decision Note",
  ];

  const rows = proposals.map((p) => [
    p.id,
    p.title,
    p.category,
    p.location,
    p.support,
    p.status,
    p.date,
    p.author,
    p.adminNote || "Under Review",
  ]);

  const csv = buildCSV(headers, rows);
  triggerCSVDownload(csv, filename);
}

export interface AnalyticsSummaryExportData {
  rangeDays: string | number;
  totalComplaints: number;
  openCount: number;
  resolvedCount: number;
  resolutionRatePercent: number;
  highPriorityPendingCount: number;
  byCategory: { name: string; value: number }[];
  byLocation: { name: string; value: number }[];
  monthlyTrend: { month: string; complaints: number; resolved: number }[];
  recurringIssues: { issue: string; location: string; count: number; category?: string }[];
}

/**
 * Exports an executive analytics summary report to a multi-section CSV file.
 */
export function exportAnalyticsSummaryToCSV(
  data: AnalyticsSummaryExportData,
  customFilename?: string,
): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = customFilename || `fixlens_analytics_summary_${dateStr}.csv`;

  const lines: string[] = [];

  // 1. Report Title & Meta
  lines.push(buildCSV(["FixLens AI — Campus Facilities Analytics & Planning Summary", ""], []));
  lines.push(buildCSV(["Generated On", new Date().toLocaleString()], []));
  lines.push(buildCSV(["Reporting Window", `Last ${data.rangeDays} days`], []));
  lines.push("");

  // 2. Executive Key Metrics
  lines.push(buildCSV(["--- EXECUTIVE KPI SUMMARY ---", ""], []));
  lines.push(buildCSV(["Metric", "Value"], [
    ["Total Complaints Recorded", data.totalComplaints],
    ["Active Unresolved Backlog", data.openCount],
    ["Resolved Complaints", data.resolvedCount],
    ["Resolution Rate (%)", `${data.resolutionRatePercent}%`],
    ["High Priority Pending", data.highPriorityPendingCount],
  ]));
  lines.push("");

  // 3. Category Distribution
  lines.push(buildCSV(["--- COMPLAINTS BY CATEGORY ---", ""], []));
  lines.push(buildCSV(["Category", "Complaints Recorded"], data.byCategory.map((c) => [c.name, c.value])));
  lines.push("");

  // 4. Location Distribution
  lines.push(buildCSV(["--- COMPLAINTS BY CAMPUS BUILDING ---", ""], []));
  lines.push(buildCSV(["Building", "Complaints Recorded"], data.byLocation.map((l) => [l.name, l.value])));
  lines.push("");

  // 5. Monthly Trend
  lines.push(buildCSV(["--- MONTHLY COMPLAINT & RESOLUTION TREND ---", "", ""], []));
  lines.push(buildCSV(["Month", "Reported", "Resolved"], data.monthlyTrend.map((t) => [t.month, t.complaints, t.resolved])));
  lines.push("");

  // 6. Recurring Issues Hotspots
  lines.push(buildCSV(["--- DETECTED RECURRING MAINTENANCE ISSUES ---", "", "", ""], []));
  lines.push(buildCSV(
    ["Issue Description", "Location", "Category", "Report Count"],
    data.recurringIssues.map((r) => [r.issue, r.location, r.category || "General", r.count]),
  ));

  const content = lines.join("\r\n");
  triggerCSVDownload(content, filename);
}
