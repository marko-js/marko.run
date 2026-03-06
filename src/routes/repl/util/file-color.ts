import type { RouteFile } from "./routes";

export function buildColorMap(files: RouteFile[]) {
  const map = new Map<RouteFile, string>();
  const len = files.length;
  for (let i = 0; i < len; i++) {
    map.set(files[i], `oklch(0.6 0.2 ${(360 / len) * i})`);
  }
  return map;
}
