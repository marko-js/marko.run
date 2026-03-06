import type { FileTreeNode, DirNode } from "./file-tree";
import {
  comparePaths,
  crossJoin,
  type Path,
  getPath,
  parseFlatRoute,
  type PathSegment,
} from "./flat-routes";
import { createLoc, type ParseError } from "./parse";

export interface BuildRoutesResult {
  routes: Route[],
  files: RouteFile[],
  errors: ParseError[]
}

export interface Route {
  path: Path;
  page?: RouteFile;
  handler?: RouteFile;
  layouts: RouteFile[];
  middlewares: RouteFile[];
  metas: RouteFile[];
  partials: RouteFile[];
}

export type RouteFileType =
  | "page"
  | "layout"
  | "handler"
  | "middleware"
  | "meta"
  | "partial";

export interface RouteFile {
  match: RouteFileMatch;
  name: string;
  dirPath: string;
  filePath: string;
}

interface RouteExtra {
  vDir: VDir;
  establishers: RouteFile[];
}

type DirNodeLike = Pick<DirNode, "name" | "dir">;

export interface RouteFileMatch {
  type: RouteFileType;
  name: string;
  path: string;
  ext: string;
  extra: string;
}

interface VDir {
  prefix: PathSegment["prefix"];
  parent: VDir | null;
  files?: Map<string, RouteFile>;
  dirs?: Map<string, VDir>;
  route?: Route;
}

export function buildRoutes(root: FileTreeNode[]): BuildRoutesResult {
  const routes = new Map<string, Route>();
  const errors: ParseError[] = [];
  const vTree: VDir = { parent: null, prefix: "" };
  const files = new Set<RouteFile>();
  const unusedFiles = new Set<RouteFile>();
  const partialNames = new Set<string>();
  let dirPath = "/";
  let paths: PathSegment[][] | undefined;

  function traverse(dir: DirNodeLike) {
    const routeExtra = new Map<Route, RouteExtra>();
    const dirNodes: DirNode[] = [];
    const prevDirPath = dirPath;
    const prevPaths = paths;
    const isRoot = !dir.name;
    const flatRoutes = parseFlatRoute(dir.name, isRoot);
    if (flatRoutes.errors.length) {
      errors.push(...flatRoutes.errors);
      return;
    }

    dirPath = joinPath(dirPath, dir.name);
    paths = flatRoutes.paths.map((path) => path.segments);
    if (prevPaths) {
      try {
        paths = crossJoin(prevPaths, paths);
      } catch (err) {
        errors.push({
          message: (err as Error).message,
          src: dir.name,
          loc: createLoc(0, 0),
        });
        return;
      }
    }

    for (const entry of dir.dir) {
      if (entry.dir) {
        dirNodes.push(entry);
        continue;
      }

      const match = matchRouteFile(entry.name);
      if (match) {
        const routeFile: RouteFile = {
          match,
          name: entry.name,
          dirPath,
          filePath: joinPath(dirPath, entry.name),
        };
        let filePaths = paths;

        unusedFiles.add(routeFile);
        if (match.type === "partial") {
          partialNames.add(match.name);
        }

        if (match.path) {
          const fileFlatRoute = parseFlatRoute(match.path, isRoot);
          if (fileFlatRoute.errors.length) {
            errors.push(...fileFlatRoute.errors);
            continue;
          } else {
            try {
              filePaths = crossJoin(
                paths,
                fileFlatRoute.paths.map((p) => p.segments),
              );
            } catch (err) {
              errors.push({
                message: (err as Error).message,
                src: match.path,
                loc: createLoc(0, 0),
              });
              continue;
            }
          }
        }

        for (const segements of filePaths) {
          const vDir = getVDir(vTree, segements);
          if (!vDir.files) {
            vDir.files = new Map();
          } else {
            const existing = vDir.files.get(match.name);
            if (existing) {
              errors.push({
                message: `${routeFile.filePath} is ambiguous with ${existing.filePath}`,
                src: routeFile.filePath,
                loc: createLoc(0, 0),
              });
              continue;
            }
          }
          vDir.files.set(match.name, routeFile);

          if (!vDir.route) {
            routeExtra.set(
              (vDir.route = {
                path: getPath(segements),
                layouts: [],
                middlewares: [],
                metas: [],
                partials: [],
              }),
              { vDir, establishers: [routeFile] },
            );
          }
        }
      }
    }

    for (const [route, { vDir, establishers }] of routeExtra) {
      let sources = getFileSources(vDir);

      const meta = getHeritableFile(dirPath, sources, "meta");
      route.page = getHeritableFile(dirPath, sources, "page");
      route.handler = getHeritableFile(dirPath, sources, "handler");
      meta && route.metas.push(meta);

      while (true) {
        const layout = getHeritableFile(dirPath, sources, "layout");
        const middleware = getHeritableFile(dirPath, sources, "middleware");
        layout && route.layouts.push(layout);
        middleware && route.middlewares.push(middleware);

        for (const name of partialNames) {
          if (!route.partials.find(file => file.match.name === name)) {
            const partial = getHeritableFile(dirPath, sources, name);
            if (partial) {
              route.partials.push(partial);
            }
          }
        }

        const next = sources[sources.length - 1].parent;
        if (!next) break;

        sources = getFileSources(next);
      }

      const routeFile = route.page || route.handler;
      if (routeFile) {
        const existing = routes.get(route.path.key);
        if (!existing || isOverrideRoute(existing, route)) {
          if (route.page) {
            route.layouts.reverse();
          } else {
            route.layouts.length = 0;
          }
          route.middlewares.reverse();
          route.metas.reverse();
          routes.set(route.path.key, route);

          for (const file of routeFileIterator(route)) {
            files.add(file);
            unusedFiles.delete(file);
          }

          if (
            routeFile === vDir.files?.get("page") ||
            routeFile === vDir.files?.get("handler")
          ) {
            establishers[0] = routeFile;
          } else if (establishers[0] !== routeFile) {
            establishers.unshift(routeFile);
          }
        } else if (!isOverrideRoute(route, existing)) {
          const routeEst = establishers.map((file) => file.filePath);
          const existingEst = routeExtra
            .get(existing)!
            .establishers.map((file) => file.filePath);

          errors.push({
            message: `${routeEst.join(" and ")} establishes route '${route.path.key}' already established by ${existingEst.join(" and ")}`,
            src: routeFile.filePath,
            loc: createLoc(0, 0),
          });
        }
      }
    }

    for (const dir of dirNodes) {
      traverse(dir);
    }

    dirPath = prevDirPath;
    paths = prevPaths;
  }

  traverse({ name: "", dir: root });

  for (const file of unusedFiles) {
    errors.push({
      message: `File ${file.filePath} was not included in any route`,
      src: file.filePath,
      loc: createLoc(0, 0),
    });
  }

  return {
    routes: [...routes.values()].sort(compareRoutes),
    files: [...files],
    errors,
  };
}

const routeFileRx = /^(.+)?([+@])([^.]+)(\..*)?(\.\w+)$/;
function matchRouteFile(file: string): RouteFileMatch | undefined {
  const match = routeFileRx.exec(file);
  if (match) {
    const [_, path, sep, name, extra, ext] = match;
    const type = sep === "@" ? "partial" : name;
    switch (type) {
      case "page":
      case "layout":
      case "partial":
        if (ext !== ".marko") return;
      case "handler":
      case "middleware":
      case "meta":
        return {
          type,
          path,
          name,
          extra,
          ext,
        };
    }
  }
}

function joinPath(base: string, path: string) {
  return path ? base.endsWith("/") ? base + path : base + "/" + path : base
}

function getVDir(root: VDir, segements: PathSegment[]) {
  let cur = root;
  for (const segement of segements) {
    const name = segement.prefix + (segement.dynamic || segement.name);
    cur.dirs ||= new Map();
    let next = cur.dirs.get(name);
    if (!next) {
      cur.dirs.set(
        name,
        (next = {
          parent: cur,
          prefix: segement.prefix,
        }),
      );
    }
    cur = next;
  }
  return cur;
}

function isOverrideRoute(base: Route, other: Route) {
  const baseSegments = base.path.segments;
  const otherSegments = other.path.segments;
  const len = baseSegments.length;
  if (otherSegments.length > len) {
    let i = 0;
    while (i < len) {
      if (baseSegments[i].raw !== otherSegments[i].raw) {
        return false;
      }
      i++;
    }
    return otherSegments[i].prefix === "&";
  }
  return false;
}

function getFileSources(vDir: VDir) {
  const sources = [vDir];
  let cur = vDir;
  while (cur.prefix === "&") {
    cur = cur.parent!;
    sources.push(cur);
  }
  return sources;
}

function getHeritableFile(dirPath: string, sources: VDir[], name: string) {
  for (const vDir of sources) {
    const file = vDir.files?.get(name);
    if (file && dirPath.startsWith(file.dirPath)) {
      return file;
    }
  }
}

function* routeFileIterator(route: Route) {
  if (route.page) yield route.page;
  if (route.handler) yield route.handler;
  yield* route.metas;
  yield* route.layouts;
  yield* route.middlewares;
  yield* route.partials;
}

function compareRoutes(a: Route, b: Route) {
  return comparePaths(a.path.segments, b.path.segments);
}
