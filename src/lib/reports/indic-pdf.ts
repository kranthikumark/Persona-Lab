import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import { ApiError } from "@/lib/api";
import type { ReportDocument } from "./data";
import { indicSections } from "./indic-sections";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
let rendering = false;
export async function indicPDF(data: ReportDocument) {
  if (rendering)
    throw new ApiError(
      429,
      "Another PDF is being prepared. Please retry shortly.",
    );
  rendering = true;
  let browser: Browser | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const { copy, sections } = indicSections(data);
    const fonts = await Promise.all(
      ["NotoSansDevanagari.ttf", "NotoSansTelugu.ttf"].map((name) =>
        readFile(path.join(process.cwd(), "public/fonts", name)),
      ),
    );
    const latin = await readFile(
      path.join(process.cwd(), "assets/report-fonts/NotoSans-Regular.ttf"),
    );
    try {
      browser = await chromium.launch({
        ...(process.env.PERSONA_PDF_BROWSER_PATH
          ? { executablePath: process.env.PERSONA_PDF_BROWSER_PATH }
          : process.platform === "darwin"
            ? { channel: "chrome" }
            : {}),
        timeout: 20000,
      });
    } catch {
      throw new ApiError(
        503,
        "The Indic PDF renderer is unavailable. Configure the server's Chromium runtime; Word download remains available.",
      );
    }
    const page = await browser.newPage({ javaScriptEnabled: false });
    deadline = setTimeout(() => {
      void browser?.close().catch(() => {});
    }, 30000);
    // No user markup, scripts, navigation or external font/image requests.
    await page.route("**/*", (route) => route.abort());
    await page.setContent(
      `<!doctype html><html lang="${data.locale}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src 'none'"><title>PERSONA LAB</title><style>
    @font-face{font-family:Latin;src:url(data:font/ttf;base64,${latin.toString("base64")})} @font-face{font-family:Hindi;src:url(data:font/ttf;base64,${fonts[0].toString("base64")})} @font-face{font-family:Telugu;src:url(data:font/ttf;base64,${fonts[1].toString("base64")})}
    @page{size:A4;margin:18mm 17mm 20mm} *{box-sizing:border-box} body{font-family:${data.locale === "hi-IN" ? "Hindi,Telugu,Latin" : data.locale === "te-IN" ? "Telugu,Hindi,Latin" : "Latin,Hindi,Telugu"},sans-serif;color:#242033;font-size:10pt;line-height:1.85;-webkit-print-color-adjust:exact} h1{font-size:25pt;color:#242033;line-height:1.6;margin:8mm 0 3mm} h2{font-size:15pt;color:#6840bd;line-height:1.65;margin:7mm 0 2mm;break-after:avoid} p{margin:2mm 0;overflow-wrap:anywhere;orphans:3;widows:3} .brand{color:#6840bd;letter-spacing:2px;font:700 10pt sans-serif} .sub{color:#616176;font-size:9pt} .score{background:#f1ebfa;border:1px solid #ddd6ea;border-radius:10px;padding:6mm;margin:5mm 0;break-inside:avoid} .score strong{font:700 35pt sans-serif;color:#6840bd} section{break-inside:auto} .draft{border-left:3px solid #6840bd;padding-left:4mm} </style></head><body><div class="brand">PERSONA LAB</div><h1>${escape(copy.title)}</h1><p>${escape(data.title)}</p><p class="sub">${escape(data.approach)} · Revision ${data.revision} · ${data.turns} turns · ${escape(new Date(data.createdAt).toISOString())}</p><div class="score"><strong>${data.score} / 100</strong><p>${escape(copy.provisional)} · ${data.coverage} / ${data.totalChecks} ${escape(copy.coverage)}</p></div><p class="draft sub">${escape(copy.draft)}</p>${sections.map((s) => `<section><h2>${escape(s.title)}</h2>${(s.paragraphs.length ? s.paragraphs : [copy.empty]).map((p) => `<p>${escape(p)}</p>`).join("")}</section>`).join("")}</body></html>`,
      { timeout: 15000 },
    );
    // Browser's HarfBuzz shapes Indic conjuncts, reorders matras and positions
    // marks. All fonts are embedded data, not runtime network dependencies.
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({
      format: "A4",
      printBackground: true,
      tagged: true,
      outline: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;text-align:center;font:8px sans-serif;color:#616176">PERSONA LAB · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });
  } finally {
    clearTimeout(deadline);
    await browser?.close().catch(() => {});
    rendering = false;
  }
}
