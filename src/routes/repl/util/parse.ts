export interface Loc {
  line: number;
  column: number;
  end: number;
}

export interface ParseError {
  message: string;
  src: string;
  loc: Loc;
}

export function createLoc(
  line: number,
  column: number,
  end: number = column,
): Loc {
  return { line, column, end };
}
