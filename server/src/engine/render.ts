import type { Doc, Lang } from "./values.js";

interface Style {
  fontName?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

interface Side {
  word?: string;
  style?: Style;
}

interface Cell {
  qn?: Side;
  nom?: Side;
  style?: Style;
  cellType?: string;
}

interface Paper {
  cells?: Cell[];
  cellsPerColumn?: number;
}

interface Glyph {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function applyTokens(value: string, tokens: Record<string, string>): string {
  return value.replace(/<[^>]+>/g, (token) => tokens[token] ?? token);
}

function sideOf(cell: Cell, lang: Lang): Side {
  return lang === "nom" ? (cell.nom ?? {}) : (cell.qn ?? {});
}

export function renderSo(longSo: Doc, lang: Lang, paperName: string, tokens: Record<string, string>): string {
  const template = (longSo.template ?? {}) as Record<string, Paper>;
  const paper = template[paperName] ?? template.A3s ?? template.A3 ?? Object.values(template)[0];
  const cells = paper?.cells ?? [];
  const perColumn = paper?.cellsPerColumn || 24;
  const columns: Glyph[][] = [];
  let current: Glyph[] = [];

  const pushChar = (glyph: Glyph) => {
    current.push(glyph);
    if (current.length >= perColumn) {
      columns.push(current);
      current = [];
    }
  };

  for (const cell of cells) {
    if (!cell || cell.cellType === "faked") continue;
    const side = sideOf(cell, lang);
    const style = side.style ?? cell.style ?? {};
    const raw = cell.cellType === "static" ? (side.word ?? "") : (tokens[cell.cellType ?? ""] ?? cell.cellType ?? "");
    const value = applyTokens(raw, tokens);
    const glyphBase = {
      fontFamily: style.fontName || "serif",
      fontSize: style.fontSize || 16,
      color: style.color || "#111",
      bold: Boolean(style.bold),
      italic: Boolean(style.italic),
    };
    for (const char of value) {
      if (char === "\n") {
        if (current.length > 0) columns.push(current);
        current = [];
        continue;
      }
      pushChar({ ...glyphBase, text: char });
    }
  }
  if (current.length > 0) columns.push(current);

  const html = columns
    .map(
      (column) =>
        `<div class="so-col">${column
          .map(
            (glyph) =>
              `<span style="font-family:${escapeHtml(glyph.fontFamily)},serif;font-size:${glyph.fontSize}px;color:${escapeHtml(glyph.color)};font-weight:${glyph.bold ? "700" : "400"};font-style:${glyph.italic ? "italic" : "normal"}">${escapeHtml(glyph.text)}</span>`,
          )
          .join("")}</div>`,
    )
    .join("");
  return `<div class="so-sheet">${html || "<p>Lòng sớ không có ô chữ.</p>"}</div>`;
}
