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
  highlightedFile?: RouteFile | null,
): Map<number, string> {
  const lineColors = new Map<number, string>();
  for (const [file, color] of colors) {
    if (file.loc.line >= 0 && (!highlightedFile || file === highlightedFile)) {
      lineColors.set(file.loc.line, color);
    }
  }
  return lineColors;
}
