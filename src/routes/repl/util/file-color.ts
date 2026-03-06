import type { RouteFile } from "./routes";

export function buildColorMap(files: RouteFile[]) {
  const map = new Map<RouteFile, string>();
  const len = files.length;
  for (let i = 0; i < len; i++) {
    map.set(files[i], `oklch(0.6 0.2 ${(360 / len) * i})`);
  }
  return map;
}

export function buildLineColors(
  colors: Map<RouteFile, string>,
  source: string,
  highlightedFile?: RouteFile | null,
): Map<number, string> {
  const lineColors = new Map<number, string>();
  const lines = source.split("\n");

  // Assign colors for recognized route files
  for (const [file, color] of colors) {
    if (file.loc.line >= 0 && (!highlightedFile || file === highlightedFile)) {
      lineColors.set(file.loc.line, color);
    }
  }

  // Assign white for folders (lines ending with /) and grey for uncolored files
  for (let i = 0; i < lines.length; i++) {
    if (lineColors.has(i)) continue;
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.endsWith("/")) {
      lineColors.set(i, "white");
    } else {
      lineColors.set(i, "grey");
    }
  }

  return lineColors;
}

export function fileAtLine(
  colors: Map<RouteFile, string>,
  line: number,
): RouteFile | null {
  for (const [file] of colors) {
    if (file.loc.line === line) return file;
  }
  return null;
}
