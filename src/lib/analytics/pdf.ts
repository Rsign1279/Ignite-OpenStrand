import type { PdfReport } from "@/components/staff/exports";
// Loaded only after Export is clicked. Recharts' actual SVG becomes PDF vector paths/text.
export async function downloadPdf(report: PdfReport) {
  const { jsPDF } = await import("jspdf");
  await import("svg2pdf.js");
  // A3 landscape gives the advisor a one-page chart summary with legible labels.
  // The complete leaderboard continues in an appendix rather than truncating students.
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
  const width = doc.internal.pageSize.getWidth(),
    height = doc.internal.pageSize.getHeight(),
    margin = 30;
  const now = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
  });
  const ink = "#18354b",
    blue = "#245d82";
  const header = (title = report.title) => {
    doc.setTextColor(ink);
    doc.setFontSize(18);
    doc.text(title, margin, 30);
    doc.setFontSize(8);
    doc.text(`IGNITE Interview Coach · ${now} Central Time`, margin, 44);
    const lines = doc.splitTextToSize(report.filters, width - 2 * margin);
    doc.text(lines, margin, 57);
    return 65 + lines.length * 9;
  };
  let y = header();
  const cardWidth = (width - 2 * margin) / report.kpis.length;
  report.kpis.forEach((k, i) => {
    doc.setFillColor("#eaf3fa");
    doc.roundedRect(margin + i * cardWidth, y, cardWidth - 7, 49, 5, 5, "F");
    doc.setFontSize(8);
    doc.text(k.label, margin + i * cardWidth + 10, y + 15);
    doc.setFontSize(17);
    doc.text(k.value, margin + i * cardWidth + 10, y + 37);
  });
  y += 65;
  const charts = [
    ...document.querySelectorAll<HTMLElement>("[data-pdf-chart]"),
  ];
  if (!charts.length) throw new Error("Charts not ready");
  async function drawChart(
    chart: HTMLElement,
    x: number,
    top: number,
    w: number,
    h: number,
  ) {
    doc.setFontSize(11);
    doc.setTextColor(blue);
    doc.text(chart.querySelector("h2")?.textContent ?? "Chart", x, top);
    doc.setFontSize(7);
    doc.setTextColor(ink);
    const description = doc.splitTextToSize(
      chart.querySelector("header p")?.textContent ?? "",
      w,
    );
    doc.text(description, x, top + 12);
    const source = chart.querySelector<SVGSVGElement>(
      ".recharts-wrapper > svg.recharts-surface",
    );
    if (source) {
      const svg = source.cloneNode(true) as SVGSVGElement;
      const originalWidth = Number(source.getAttribute("width")) || 950,
        originalHeight = Number(source.getAttribute("height")) || 310;
      svg.setAttribute("viewBox", `0 0 ${originalWidth} ${originalHeight}`);
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svg
        .querySelectorAll("text")
        .forEach((text) => text.setAttribute("font-family", "Helvetica"));
      await doc.svg(svg, {
        x,
        y: top + 16 + description.length * 8,
        width: w,
        height: h - 40,
      });
      let legendX = x;
      chart
        .querySelectorAll<HTMLElement>(".recharts-legend-item")
        .forEach((item) => {
          const text =
            item.querySelector(".recharts-legend-item-text")?.textContent ?? "";
          const color =
            item.querySelector("svg path")?.getAttribute("fill") ?? blue;
          doc.setFillColor(/^#[0-9a-f]{3,8}$/i.test(color) ? color : blue);
          doc.rect(legendX, top + h - 5, 7, 7, "F");
          doc.setFontSize(7);
          doc.setTextColor(ink);
          doc.text(text, legendX + 11, top + h + 1);
          legendX += doc.getTextWidth(text) + 28;
        });
    } else {
      doc.setFontSize(10);
      doc.text("No practice data in the selected filters.", x, top + 40);
    }
  }
  const gap = 25,
    half = (width - margin * 2 - gap) / 2;
  if (charts.length === 5) {
    await drawChart(charts[0], margin, y, width - 2 * margin, 190);
    for (let i = 1; i < charts.length; i++)
      await drawChart(
        charts[i],
        margin + ((i - 1) % 2) * (half + gap),
        y + 210 + Math.floor((i - 1) / 2) * 175,
        half,
        155,
      );
    y += 570;
  } else {
    for (let i = 0; i < charts.length; i++)
      await drawChart(
        charts[i],
        margin + (i % 2) * (half + gap),
        y + Math.floor(i / 2) * 270,
        half,
        245,
      );
    y += Math.ceil(charts.length / 2) * 270 + 15;
  }
  const columnWidth = (width - 2 * margin) / report.headers.length;
  const tableHeader = () => {
    doc.setFillColor("#eaf3fa");
    doc.rect(margin, y, width - 2 * margin, 21, "F");
    doc.setFontSize(8);
    doc.setTextColor(blue);
    report.headers.forEach((h, i) =>
      doc.text(h, margin + i * columnWidth + 5, y + 14),
    );
    y += 26;
  };
  doc.setTextColor(blue);
  doc.setFontSize(11);
  doc.text(
    report.student
      ? "Question mastery and growth"
      : "Student growth leaderboard",
    margin,
    y,
  );
  y += 12;
  tableHeader();
  for (const row of report.rows) {
    const cells = row.map(
      (v) => doc.splitTextToSize(v, columnWidth - 10) as string[],
    );
    const rowHeight = Math.max(18, ...cells.map((c) => c.length * 9 + 7));
    if (y + rowHeight > height - 25) {
      doc.addPage();
      y = header(
        report.student
          ? "Student question appendix"
          : "Student growth · continued",
      );
      tableHeader();
    }
    doc.setTextColor(ink);
    doc.setFontSize(8);
    cells.forEach((cell, i) =>
      doc.text(cell, margin + i * columnWidth + 5, y + 10),
    );
    y += rowHeight;
    doc.setDrawColor("#d7e3ec");
    doc.line(margin, y - 3, width - margin, y - 3);
  }
  if (!report.rows.length) {
    doc.setFontSize(10);
    doc.text("No matching student results.", margin, y + 12);
  }
  const pages = doc.getNumberOfPages();
  for (let n = 1; n <= pages; n++) {
    doc.setPage(n);
    doc.setFontSize(7);
    doc.setTextColor(ink);
    doc.text(
      `Confidential staff report · ${n} / ${pages}`,
      width - margin - 130,
      height - 12,
    );
  }
  doc.save(
    `ignite-${report.student ? "student" : "program"}-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}
