import { Loc, ParseError, createLoc } from "./parse";

interface NodeBase {
  name: string;
  loc: Loc;
}

export interface FileNode extends NodeBase {
  dir: false;
}

export interface DirNode extends NodeBase {
  dir: FileTreeNode[];
}

export type FileTreeNode = FileNode | DirNode;

export interface FileTree {
  dir: FileTreeNode[];
  errors: ParseError[];
}

const InvalidCharRx = /[<>:"|\\/?*\0\x00-\x1F]/;

export function parseFileTree(str: string): FileTree {
  const tree: FileTreeNode[] = [];
  const errors: ParseError[] = [];
  const stack: { depth: number; node: FileTreeNode }[] = [];

  let lineNumber = 0;
  let lineOffset = 0;
  let startOffset = -1;
  let endOffset = -1;

  for (let i = 0, len = str.length; i <= len; i++) {
    const char = str.charAt(i);

    if (char === "\n" || i === len) {
      if (startOffset >= lineOffset) {
        const start = startOffset - lineOffset;
        const name = str.slice(startOffset, endOffset + 1);
        const loc = createLoc(lineNumber, start, endOffset - lineOffset);
        const isDir = str.charAt(endOffset + 1) === "/";

        if (name) {
          const invalid = InvalidCharRx.exec(name);
          if (invalid) {
            addError(
              `Invalid character "${invalid[0]}"`,
              createLoc(lineNumber, start + invalid.index),
            );
          }
          addNode(
            {
              name,
              loc,
              dir: isDir && [],
            },
            Math.floor(start / 2),
          );
        } else {
          addError("Invalid empty name for directory", loc);
        }
      }

      lineNumber++;
      lineOffset = i + 1;
    } else if (char !== " " && char !== "\t") {
      if (startOffset < lineOffset) {
        startOffset = i;
      }
      if (char !== "/") {
        endOffset = i;
      }
    }
  }

  function addNode(node: FileTreeNode, depth: number, error: boolean = true) {
    while (stack.length && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (!stack.length) {
      tree.push(node);
    } else {
      const parent = stack[stack.length - 1];
      if (parent.node.dir) {
        parent.node.dir.push(node);
      } else {
        if (error) {
          addError(
            `Cannot nest "${node.name}" under file "${parent.node.name}"`,
            node.loc,
          );
        }
        return addNode(node, parent.depth, false);
      }
    }

    stack.push({ depth, node });
  }

  function addError(message: string, loc: Loc) {
    errors.push({ message, src: str, loc });
  }

  return { dir: tree, errors };
}

export function buildFileTree(paths: string[]): FileTree {
  const root: FileTreeNode[] = [];

  for (const path of paths) {
    let parent = root;
    let prev = 0;
    let next = path.indexOf("/");
    while (next >= 0) {
      const name = path.slice(prev, next);
      let node = parent.find((n): n is DirNode => n.dir && n.name === name);
      if (!node) {
        parent.push(
          (node = {
            name,
            loc: createLoc(-1, 0, 0),
            dir: [],
          }),
        );
      }
      parent = node.dir;
      prev = next + 1;
      next = path.indexOf("/", prev);
    }
    parent.push({
      name: path.slice(prev),
      loc: createLoc(-1, 0, 0),
      dir: false,
    });
  }

  return {
    dir: (root.length === 1 && root[0].dir) || root,
    errors: [],
  };
}

export function printFileTree(fileTree: FileTree): string {
  const iter = traverse(fileTree.dir);
  const { done, value } = iter.next();

  if (done) {
    return "";
  }

  let result = value.node.name;
  if (value.node.dir) {
    result += "/";
  }

  for (const { depth, node } of iter) {
    result += "\n";
    result += " ".repeat(depth * 2);
    result += node.name;
    if (node.dir) {
      result += "/";
    }
  }

  return result;
}

function* traverse(
  nodes: FileTreeNode[],
  depth: number = 0,
): Generator<{ depth: number; node: FileTreeNode }> {
  for (const node of nodes.toSorted(compareNodes)) {
    yield { depth, node };
    if (node.dir) {
      yield* traverse(node.dir, depth + 1);
    }
  }
}

function compareNodes(a: FileTreeNode, b: FileTreeNode) {
  return ~!!a.dir - ~!!b.dir || a.name.localeCompare(b.name);
}


