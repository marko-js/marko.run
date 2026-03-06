import { createLoc, type ParseError } from "./parse";

interface FlatRoute {
  paths: Path[];
  errors: ParseError[];
}

export interface Path {
  key: string;
  segments: PathSegment[];
  params: PathParam[] | undefined;
}

export interface PathSegment {
  prefix: "" | "_" | "&";
  dynamic: false | "$" | "$$";
  name: string;
  raw: string;
}

export interface PathParam {
  type: "$" | "$$",
  name: string,
  offset: number,
}
interface PathJoinError {
  message: string;
  left: PathSegment;
  right: PathSegment;
}

interface StringIterator {
  (): string;
  index: number;
  readonly value: string;
  readonly last: string;
}

/*
  Parses flat route strings to one or more paths.
  Rules
  - ,  alternate
  - .  directory
  - $  dynamic single segment
  - $$ dynamic remaining segments
  - _  pathless segment prefix
  - &  narrowing segment prefix
  - () sub-expression group
  - `` escaped group

  Tests
  | Input String        | Route Matches (; seperated URL patterns)
  | ---                 | ---
  | foo.bar             | /foo/bar
  | foo.                | Error: expected segment character but found EOL
  | foo..bar            | Error: expected segment character but found '.'
  | .foo                | Error: expected segment character but found '.'
  | foo,bar             | /foo; /bar
  | foo,                | /foo; /
  | ,foo                | /; /foo
  | ,foo,               | Error: multiple matches to '/'
  | ,                   | Error: multiple matches to '/'
  | foo,foo             | Error: multuple matches to '/foo'
  | foo.bar,            | /foo/bar; /
  | foo.,bar            | Error: expected segment character but found ','
  | $                   | /$
  | $name               | /$
  | foo.$name           | /foo/$
  | $name.foo           | /$/foo
  | name$               | /name$
  | n$ame               | /n$ame
  | $$                  | /$$
  | $$rest              | /$$
  | foo.$$rest          | /foo/$$
  | foo.$$rest.bar      | Error: '$$' segments may only be succeeded by '&' segments
  | rest$               | /rest$
  | f$oo                | /f$oo
  | _foo                | /
  | foo._bar            | /foo
  | foo._bar.baz        | /foo/baz
  | _                   | /
  | foo_                | /foo_
  | $name.&foo          | /foo
  | $name.&foo.bar      | /foo/bar
  | foo.&foo            | /foo
  | bar.&foo            | Error: 'foo' cannot narrow 'bar'
  | $name.(&foo,&bar,)  | /foo; /bar; /$
  | $$rest.&$name       | /$
  | $$rest.(&$name,)    | /$; /$$
  | $$rest.&$$all       | /$$
  | $$rest.&foo         | /foo
  | foo.(,bar)          | /foo; /foo/bar
  | (foo,bar)           | /foo; /bar
  | (foo.bar)           | /foo/bar
  | (foo)               | /foo
  | (foo,).(bar,)       | /foo/bar; /foo; /bar; /
  | (foo                | Error: expected ')' but found EOL
  | foo)                | Error: unmatched ')' character
  | ().bar              | Error: expected segment character but found '.'
  | bar.()              | Error: expected segment character but found EOL
  | foo.().bar          | Error: expected segment character but found '.'
  | ()                  | Error: expected segment character but found EOL
  | (foo,bar).&foo      | /foo
  | `foo.bar`           | /foo.bar
  | foo`.`bar           | /foo.bar
  | `foo                | Error: expected '`' but found EOL
  | foo`                | Error: unmatched '`' character
*/
export function parseFlatRoute(str: string, isBase: boolean = true): FlatRoute {
  const errors: ParseError[] = [];
  const paths: Path[] = [];
  const iter = iterator(str);
  try {
    for (const segments of parseExpression(iter, isBase)) {
      paths.push(getPath(segments));
    }
  } catch (err) {
    errors.push({
      message: (err as Error).message,
      src: str,
      loc: createLoc(0, iter.index - 1),
    });
  }

  return { paths, errors };
}

function parseExpression(
  iter: StringIterator,
  isRoot: boolean = false,
  isGroup: boolean = false,
): PathSegment[][] {
  const start = iter.index;
  const parsed: PathSegment[][] = [];
  const invalid = ["."];
  const seen = new Map<string, string>();
  let current: PathSegment[][] = [];
  let char = iter();

  while (char) {
    while (invalid.length) {
      if (char === invalid.pop()) {
        throw new Error(`Unexpected '${char}'`);
      }
    }

    switch (char) {
      case ".":
        invalid.push(".", ",", ")");
        break;
      case ",":
        endCurrent();
        invalid.push(".", ",");
        break;
      case "(":
        const group = parseExpression(iter, false, true);
        if (current.length) {
          current = crossJoin(current, group);
        } else {
          current = group;
        }
        invalid.push("(");
        break;
      case ")":
        if (!isGroup) {
          throw new Error(`Unexpected ')'`);
        }
        if (!current.length && iter.index === start + 1) {
          throw new Error("Group cannot be empty");
        }
        return endCurrent();
      default:
        iter.index--;
        const segment = parseSegment(iter);
        if (current.length) {
          current = crossJoin(current, [[segment]]);
        } else {
          current.push([segment]);
        }
        break;
    }
    char = iter();
  }

  if (isGroup) {
    throw new Error(`Expected ')' before end`);
  } else if (iter.last === ".") {
    throw new Error(`Expected segment character before end`);
  }

  function endCurrent() {
    if (current.length) {
      for (const segements of current) {
        if (isRoot) {
          assertNotNarrowing(segements);
        }
        parsed.push(assertUnique(segements, seen));
      }
      current = [];
    } else {
      parsed.push(assertUnique([], seen));
    }
    return parsed;
  }

  return endCurrent();
}

function parseSegment(iter: StringIterator): PathSegment {
  const start = iter.index;
  let dynamic: PathSegment["dynamic"] = false;
  let prefix: PathSegment["prefix"] = "";
  let name = "";
  let char = iter();

  if (char === "_") {
    prefix = char;
    char = iter();
  } else {
    if (char === "&") {
      prefix = char;
      char = iter();
    }
    if (char === "$") {
      dynamic = "$";
      char = iter();
      if (char === "$") {
        dynamic = "$$";
        char = iter();
      }
    }
  }

  let nameStart = iter.index - 1;

  while (char) {
    switch (char) {
      case ".":
      case ",":
      case ")":
        iter.index--;
        char = "";
        break;
      case "`":
        name += iter.value.slice(nameStart, iter.index - 1);
        name += parseEscaped(iter);
        nameStart = iter.index;
      default:
        char = iter();
    }
  }

  return {
    prefix,
    dynamic,
    raw: iter.value.slice(start, iter.index),
    name: name + iter.value.slice(nameStart, iter.index),
  };
}

function parseEscaped(iter: StringIterator): string {
  const start = iter.index;
  let char = iter();

  while (char) {
    if (char === "`") {
      return iter.value.slice(start, iter.index - 1);
    }
    char = iter();
  }

  throw new Error(`Expected '\`' before end`);
}

function iterator(value: string): StringIterator {
  let char = "";
  let last = "";
  const len = value.length;
  const next = () => {
    return next.index < len
      ? ((last = char), (char = value.charAt(next.index++)))
      : "";
  };
  next.index = 0;
  return Object.defineProperties(next, {
    value: {
      value,
    },
    last: {
      get() {
        return last;
      },
    },
  }) as StringIterator;
}

export function crossJoin(
  baseGroup: PathSegment[][],
  otherGroup: PathSegment[][],
) {
  const result: PathSegment[][] = [];
  const seen = new Map<string, string>();

  for (const base of baseGroup) {
    for (const other of otherGroup) {
      let errors: PathJoinError[] | undefined;
      for (const base2 of baseGroup) {
        const error = getSegmentJoinError(base2, other);
        if (error) {
          if (errors) {
            errors.push(error);
          } else {
            errors = [error];
          }
        } else if (base === base2) {
          result.push(assertUnique(base.concat(other), seen));
        }
      }

      if (errors?.length === baseGroup.length) {
        const { right, message } = errors[0];
        throw new Error(
          right.prefix === "&" && errors.length > 1
            ? `Segment '${right.raw}' does not narrow any previous segements '${errors.map(({ left }) => left.raw).join(", ")}'`
            : message,
        );
      }
    }
  }

  return result;
}

function assertUnique(segments: PathSegment[], seen: Map<string, string>) {
  const keyPath = getKeyPath(segments);
  const fullPath = getFullPath(segments);
  const existing = seen.get(keyPath);
  if (existing) {
    throw new Error(`Path '${fullPath}' duplicates '${existing}'`);
  }
  seen.set(keyPath, fullPath);
  return segments;
}

function assertNotNarrowing(segments: PathSegment[]) {
  for (const segement of segments) {
    if (isSignificantSegment(segement)) {
      if (segement.prefix === "&") {
        throw new Error(
          `Narrowing segment '${segement.raw}' may not narrow root segment '/'`,
        );
      }
      break;
    }
  }
  return segments;
}

function getSegmentJoinError(
  base: PathSegment[],
  other: PathSegment | PathSegment[],
): PathJoinError | undefined {
  if (!base.length) return;

  let left = base[base.length - 1];
  let right: PathSegment | undefined;
  let message: string | undefined;

  if (Array.isArray(other)) {
    if (!other.length) return;

    const i = other.findIndex(isSignificantSegment);
    right = other[i];
    if (i > 0) {
      left = other[i - 1];
    }
  } else {
    right = other;
  }

  if (right?.prefix === "&") {
    if (left.prefix === "_") {
      message = `Segment '${right.raw}' may not narrow previous pathless segment '${left.raw}'`;
    } else if (left.dynamic === "$$") {
      if (right.dynamic === "$$") {
        message = `Catch-all segement '${right.raw}' may not narrow previous catch-all segment '${left.raw}'`;
      }
    } else if (left.dynamic === "$") {
      if (right.dynamic === "$$") {
        message = `Catch-all segement '${right.raw}' may not narrow previous dynamic segment '${left.raw}'`;
      } else if (right.dynamic) {
        message = `Dynamic segement '${right.raw}' may not narrow previous dynamic segment '${left.raw}'`;
      }
    } else {
      if (right.dynamic) {
        message = `Dynamic segement '${right.raw}' may not narrow previous static segment '${left.raw}'`;
      } else if (right.name !== left.name) {
        message = `Static segment '${right.raw}' does not narrow previous static segement '${left.raw}'`;
      }
    }
  } else {
    right ||= Array.isArray(other) ? other[0] : other;
    if (right && left.dynamic === "$$") {
      message = `Non-narrowing segment '${right.raw}' may not followed previous catch-all segment '${left.raw}'`;
    }
  }

  if (message) {
    return {
      message,
      left,
      right,
    };
  }
}

function isSignificantSegment(path: PathSegment) {
  return path.prefix !== "_";
}

export function getKeyPath(segments: PathSegment[]): string {
  const parts: string[] = [];
  for (const segment of segments) {
    if (segment.prefix === "_") {
      continue;
    } else if (segment.prefix === "&" && parts.length) {
      parts.pop();
    }
    parts.push(segment.dynamic || segment.name);
  }
  return "/" + parts.join("/");
}

export function getFullPath(segments: PathSegment[]): string {
  return "/" + segments.map((segment) => segment.raw).join("/");
}

export function getParams(segements: PathSegment[]): PathParam[] | undefined {
  let params: PathParam[] | undefined;
  let offset = 0;
  for (const segement of segements) {
    if (segement.dynamic) {
      params ||= [];
      params.push({
        type: segement.dynamic,
        name: segement.name,
        offset
      })
      offset = 0;
    } else if (!segement.prefix) {
      offset += segement.name.length;
    }
  }
  return params;
}

export function getPath(segments: PathSegment[]): Path {
  return {
    key: getKeyPath(segments),
    segments,
    params: getParams(segments),
  };
}

export function compareSegments(a: PathSegment, b: PathSegment) {
  if (a.dynamic === "$$") {
    return a.dynamic === b.dynamic ? 0 : 1;
  } else if (a.dynamic) {
    return a.dynamic === b.dynamic ? 0 : b.dynamic ? -1 : 1;
  } else if (b.dynamic) {
    return -1;
  }
  return a.name.localeCompare(b.name);
}

export function comparePaths(a: PathSegment[], b: PathSegment[]) {
  const aLen = a.length - 1;
  const bLen = b.length - 1;
  let i = 0;
  let j = 0;

  while (i <= aLen && j <= bLen) {
    while (
      (i <= aLen && a[i].prefix === "_") ||
      (i < aLen && a[i + 1].prefix === "&")
    ) {
      i++;
    }
    while (
      (j <= bLen && b[j].prefix === "_") ||
      (j < bLen && b[j + 1].prefix === "&")
    ) {
      j++;
    }
    if (i > aLen || j > bLen) break;
    const comp = compareSegments(a[i], b[j]);
    if (comp) return comp;
    i++;
    j++;
  }

  return aLen - i - (bLen - j);
}
