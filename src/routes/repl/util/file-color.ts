import type { RouteFile } from "./routes";

export function buildFileCSS(files: RouteFile[]): string {
  const len = files.length;
  let colors = "";
  let selectors = "";
  let i = 0;
  for (const file of files) {
    colors += `.${file.id}{--h:${Math.round((360 / len) * i)};}`;
    if (i > 0) selectors += `,`;
    selectors += `body:has(.${file.id}:hover) .${file.id}`;
    i++
  }

  return `${colors}${selectors}{background: color-mix(in oklch, var(--box-color) 40%, var(--color-background));&.hl-box {box-shadow: 0 0 8px 3px oklch(from var(--box-color) l c h / 50%);}&.hl-text {color: color-mix(in oklch, var(--box-color) 35%, var(--color-foreground));}}`;
}

export function buildLineClasses(
  files: RouteFile[],
  source: string,
): Map<number, string> {
  const lineClasses = new Map<number, string>();
  const lines = source.split("\n");

  for (const file of files) {
    if (file.loc.line >= 0) {
      lineClasses.set(file.loc.line, "hl-text " + file.id);
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (lineClasses.has(i)) continue;
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.endsWith("/")) {
      lineClasses.set(i, "folder-line");
    } else {
      lineClasses.set(i, "unmatched-line");
    }
  }

  return lineClasses;
}

export function fileAtLine(files: RouteFile[], line: number): RouteFile | null {
  for (const file of files) {
    if (file.loc.line === line) return file;
  }
  return null;
}
