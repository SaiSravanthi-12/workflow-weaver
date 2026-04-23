/**
 * PDF export of a simulation run.
 * Uses jsPDF's vector text engine — no canvas rasterization, fast and crisp.
 */
import { jsPDF } from "jspdf";
import type { SimulationResult, ValidationIssue } from "./types";

interface ExportInput {
  workflowName: string;
  result: SimulationResult;
  issues: ValidationIssue[];
}

const STATUS_COLOR: Record<string, [number, number, number]> = {
  ok: [16, 122, 87],
  warn: [180, 110, 20],
  error: [185, 28, 28],
};

export function exportSimulationPdf({ workflowName, result, issues }: ExportInput): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  // ---- Header ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 24, 36);
  doc.text("Workflow simulation report", margin, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 110, 130);
  doc.text(workflowName, margin, y);
  y += 14;

  const finished = new Date(result.finishedAt).toLocaleString();
  doc.text(
    `Run finished ${finished} · ${result.steps.length} step(s) · ${result.ok ? "SUCCESS" : "FAILED"}`,
    margin,
    y,
  );
  y += 22;

  // Status pill
  const pillColor: [number, number, number] = result.ok ? [16, 122, 87] : [185, 28, 28];
  doc.setFillColor(...pillColor);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const pillText = result.ok ? "PASSED" : "FAILED";
  const pillW = doc.getTextWidth(pillText) + 18;
  doc.roundedRect(margin, y - 11, pillW, 16, 8, 8, "F");
  doc.text(pillText, margin + 9, y);
  y += 24;

  doc.setDrawColor(220, 225, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // ---- Validation ----
  if (issues.length > 0) {
    y = section(doc, "Validation", y, margin);
    doc.setFontSize(10);
    for (const i of issues) {
      y = ensureSpace(doc, y, pageHeight, margin, 18);
      const color: [number, number, number] = i.level === "error" ? [185, 28, 28] : [180, 110, 20];
      doc.setTextColor(...color);
      doc.setFont("helvetica", "bold");
      doc.text(i.level.toUpperCase(), margin, y);
      doc.setTextColor(45, 55, 72);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(i.message, pageWidth - margin * 2 - 60);
      doc.text(lines, margin + 56, y);
      y += 14 * lines.length + 4;
    }
    y += 8;
  }

  // ---- Steps ----
  y = section(doc, "Execution log", y, margin);
  doc.setFontSize(10);

  for (let idx = 0; idx < result.steps.length; idx += 1) {
    const step = result.steps[idx];
    y = ensureSpace(doc, y, pageHeight, margin, 36);

    // Step index circle
    doc.setFillColor(245, 247, 252);
    doc.circle(margin + 10, y - 3, 11, "F");
    doc.setTextColor(60, 70, 90);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(String(idx + 1), margin + 10, y, { align: "center", baseline: "middle" });

    // Title
    doc.setFontSize(11);
    doc.setTextColor(20, 24, 36);
    doc.text(step.title, margin + 30, y - 1);

    // Status pill
    const sc = STATUS_COLOR[step.status] ?? [120, 120, 120];
    doc.setFillColor(...sc);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    const sText = step.status.toUpperCase();
    const sW = doc.getTextWidth(sText) + 10;
    doc.roundedRect(pageWidth - margin - sW - 60, y - 10, sW, 13, 6, 6, "F");
    doc.text(sText, pageWidth - margin - sW - 60 + 5, y - 1);

    // Duration
    doc.setTextColor(120, 130, 150);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`${step.durationMs}ms`, pageWidth - margin, y - 1, { align: "right" });

    y += 14;

    // Message
    doc.setTextColor(80, 90, 110);
    doc.setFontSize(9);
    const msgLines = doc.splitTextToSize(step.message, pageWidth - margin * 2 - 30);
    doc.text(msgLines, margin + 30, y);
    y += 12 * msgLines.length;

    // Kind tag
    doc.setTextColor(150, 160, 180);
    doc.setFontSize(8);
    doc.text(step.nodeKind.toUpperCase(), margin + 30, y);
    y += 16;
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 170, 190);
    doc.text(`HR Workflow Designer · Page ${i} of ${pages}`, pageWidth / 2, pageHeight - 20, {
      align: "center",
    });
  }

  const safe = workflowName.replace(/[^a-z0-9-_ ]/gi, "_").slice(0, 60) || "workflow";
  doc.save(`${safe}-simulation.pdf`);
}

function section(doc: jsPDF, title: string, y: number, margin: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(60, 70, 90);
  doc.text(title.toUpperCase(), margin, y);
  doc.setDrawColor(230, 234, 242);
  doc.line(
    margin + doc.getTextWidth(title.toUpperCase()) + 12,
    y - 3,
    doc.internal.pageSize.getWidth() - margin,
    y - 3,
  );
  return y + 16;
}

function ensureSpace(doc: jsPDF, y: number, pageH: number, margin: number, needed: number): number {
  if (y + needed > pageH - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}
