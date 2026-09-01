import { ORG_NAME } from "./hr";
import logoAsset from "@/assets/mudeer-logo.png.asset.json";

const LOGO_URL =
  typeof window !== "undefined" ? window.location.origin + logoAsset.url : logoAsset.url;

export type ReportSection = {
  heading?: string;
  paragraphs?: string[];
  table?: { columns: string[]; rows: (string | number)[][] };
};

export type ReportDoc = {
  title: string;
  subtitle?: string;
  periodLabel?: string;
  meta?: { label: string; value: string }[];
  sections: ReportSection[];
  branding?: {
    org_name: string;
    system_name: string;
    logoUrl: string | null;
  };
};

function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildReportHtml(doc: ReportDoc) {
  const orgName = doc.branding?.org_name ?? ORG_NAME;
  const logo = doc.branding?.logoUrl ?? LOGO_URL;
  const systemName = doc.branding?.system_name ?? "مدير";
  const issued = new Date().toLocaleString("ar-EG-u-nu-latn");
  const meta = (doc.meta ?? [])
    .map((m) => `<span class="meta-item"><b>${esc(m.label)}:</b> ${esc(m.value)}</span>`)
    .join("");

  const sections = doc.sections
    .map((s) => {
      const heading = s.heading ? `<h2>${esc(s.heading)}</h2>` : "";
      const paras = (s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join("");
      const table = s.table
        ? `<table>
            <thead><tr>${s.table.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
            <tbody>${s.table.rows
              .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
              .join("")}</tbody>
          </table>`
        : "";
      return `<section>${heading}${paras}${table}</section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>${esc(doc.title)}</title>
<style>
  @page { size: A4; margin: 1.6cm; }
  body { font-family: "Tajawal","Cairo","Arial",sans-serif; color:#1b2b23; direction: rtl; }
  .header { border-bottom: 3px solid #1f5c43; padding-bottom: 14px; margin-bottom: 18px; }
  .logo { width:72px; height:auto; float:right; margin-left:14px; }
  .org { font-size: 20px; font-weight: 800; color:#1f5c43; }
  h1 { font-size: 18px; margin: 6px 0 2px; }
  .sub { color:#5a6b62; font-size: 13px; }
  .meta { margin: 10px 0 18px; font-size: 12px; color:#33473d; }
  .meta-item { display:inline-block; margin-left: 18px; }
  h2 { font-size: 15px; color:#1f5c43; margin: 18px 0 8px; border-right: 4px solid #f0c060; padding-right: 8px; }
  table { width:100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  th, td { border: 1px solid #cbd8d1; padding: 6px 8px; text-align: right; }
  th { background: #eaf2ee; color:#1f5c43; }
  tr:nth-child(even) td { background:#f7faf8; }
  p { font-size: 13px; line-height: 1.8; }
  .footer { margin-top: 28px; border-top:1px solid #cbd8d1; padding-top: 8px; font-size: 11px; color:#6b7d74; }
</style></head>
<body>
  <div class="header">
    <img class="logo" src="${logo}" alt="شعار ${esc(orgName)}" />
    <div class="org">${esc(orgName)}</div>
    <h1>${esc(doc.title)}</h1>
    <div class="sub">${esc(doc.subtitle ?? "")}</div>
  </div>
  <div class="meta">
    ${doc.periodLabel ? `<span class="meta-item"><b>الفترة:</b> ${esc(doc.periodLabel)}</span>` : ""}
    <span class="meta-item"><b>تاريخ الإصدار:</b> ${esc(issued)}</span>
    ${meta}
  </div>
  ${sections}
  <div class="footer">تم إصدار هذا التقرير آلياً من نظام ${esc(systemName)} — ${esc(orgName)}</div>
</body></html>`;
}

export function exportWord(doc: ReportDoc, fileName: string) {
  const html = buildReportHtml(doc);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPdf(doc: ReportDoc) {
  const html = buildReportHtml(doc);
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
  return true;
}
