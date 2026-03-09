/**
 * Lightweight contenteditable editor engine that replaces CodeMirror.
 *
 * Features:
 * - Plain text editing via contenteditable="plaintext-only"
 * - Per-line color decorations (lineColors)
 * - Active line highlight
 * - Auto-indentation on Enter
 * - Tab / Shift+Tab indent/dedent
 * - Indentation-based code folding
 */

// ── Types ────────────────────────────────────────────────────────────

export interface FoldState {
  /** Whether this line can be folded (has indented children) */
  foldable: boolean;
  /** Whether this line's children are currently collapsed */
  folded: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function getIndentation(line: string): number {
  const m = line.match(/^\s*/);
  return m ? m[0].length : 0;
}

function getLineElements(container: HTMLElement): HTMLDivElement[] {
  return Array.from(container.querySelectorAll<HTMLDivElement>(":scope > div"));
}

/**
 * Get the 0-based line index the caret is currently on.
 * Returns -1 if caret is not inside the editor.
 */
function getCaretLineIndex(container: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;
  let node: Node | null = sel.focusNode;
  while (node && node !== container) {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node as HTMLElement).parentElement === container
    ) {
      const lines = getLineElements(container);
      return lines.indexOf(node as HTMLDivElement);
    }
    node = node.parentNode;
  }
  return -1;
}

// ── EditorEngine ─────────────────────────────────────────────────────

export class EditorEngine {
  private el: HTMLElement;
  private gutter: HTMLElement;
  private onChange: (value: string) => void;
  private onLineHover: ((line: number) => void) | undefined;
  private foldStates: FoldState[] = [];
  private activeLine = -1;
  private suppressInput = false;

  constructor(
    el: HTMLElement,
    gutter: HTMLElement,
    onChange: (value: string) => void,
    onLineHover?: (line: number) => void,
  ) {
    this.el = el;
    this.gutter = gutter;
    this.onChange = onChange;
    this.onLineHover = onLineHover;

    this.el.addEventListener("input", this.handleInput);
    this.el.addEventListener("keydown", this.handleKeydown);
    this.el.addEventListener("mouseover", this.handleMouseOver);
    this.el.addEventListener("mouseleave", this.handleMouseLeave);
    document.addEventListener("selectionchange", this.handleSelectionChange);
  }

  // ── Public API ───────────────────────────────────────────────────

  getValue(): string {
    const lines = getLineElements(this.el);
    return lines
      .map((div) => (div.textContent || "").replace(/\u200B/g, ""))
      .join("\n");
  }

  setValue(text: string): void {
    if (text === this.getValue()) return;
    this.suppressInput = true;
    const lines = text.split("\n");
    this.el.innerHTML = "";
    for (const line of lines) {
      const div = document.createElement("div");
      div.textContent = line || "\u200B"; // zero-width space for empty lines
      this.el.appendChild(div);
    }
    this.foldStates = lines.map(() => ({ foldable: false, folded: false }));
    this.computeFoldability();
    this.renderGutter();
    this.suppressInput = false;
  }

  applyLineClasses(lineClasses: Map<number, string>): void {
    const lines = getLineElements(this.el);
    for (let i = 0; i < lines.length; i++) {
      const cls = lineClasses.get(i);
      // Remove any previously applied file/folder/unmatched classes
      lines[i].className = cls || "";
    }
  }

  highlightActiveLine(): void {
    const idx = getCaretLineIndex(this.el);
    if (idx === this.activeLine) return;
    const lines = getLineElements(this.el);
    if (this.activeLine >= 0 && this.activeLine < lines.length) {
      lines[this.activeLine].classList.remove("active-line");
    }
    this.activeLine = idx;
    if (idx >= 0 && idx < lines.length) {
      lines[idx].classList.add("active-line");
    }
  }

  updateFolding(): void {
    // Recompute foldability from current text
    const lines = getLineElements(this.el);
    const textLines = lines.map((d) => d.textContent || "");

    // Preserve existing fold state for lines that are still foldable
    const oldFoldStates = this.foldStates;
    this.foldStates = textLines.map((_, i) => ({
      foldable: false,
      folded: oldFoldStates[i]?.folded ?? false,
    }));
    this.computeFoldability();

    // Apply fold visibility
    for (let i = 0; i < lines.length; i++) {
      if (this.foldStates[i]?.folded) {
        this.applyFoldVisibility(i, true);
      }
    }

    this.renderGutter();
  }

  destroy(): void {
    this.el.removeEventListener("input", this.handleInput);
    this.el.removeEventListener("keydown", this.handleKeydown);
    this.el.removeEventListener("mouseover", this.handleMouseOver);
    this.el.removeEventListener("mouseleave", this.handleMouseLeave);
    document.removeEventListener("selectionchange", this.handleSelectionChange);
  }

  private handleMouseOver = (e: MouseEvent): void => {
    if (!this.onLineHover) return;
    const target = e.target as HTMLElement;
    const lineDiv = target.closest("div") === this.el ? null : target.closest("div");
    if (!lineDiv || lineDiv.parentElement !== this.el) {
      return;
    }
    const lines = getLineElements(this.el);
    const index = lines.indexOf(lineDiv as HTMLDivElement);
    if (index >= 0) {
      this.onLineHover(index);
    }
  };

  private handleMouseLeave = (): void => {
    if (this.onLineHover) {
      this.onLineHover(-1);
    }
  };

  // ── Fold Logic ───────────────────────────────────────────────────

  private computeFoldability(): void {
    const lines = getLineElements(this.el);
    const textLines = lines.map((d) => d.textContent || "");

    // Sync foldStates array length with actual line count
    while (this.foldStates.length < textLines.length) {
      this.foldStates.push({ foldable: false, folded: false });
    }
    if (this.foldStates.length > textLines.length) {
      this.foldStates.length = textLines.length;
    }

    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];
      if (/^\s*$/.test(line)) {
        this.foldStates[i].foldable = false;
        continue;
      }
      const indent = getIndentation(line);
      // Check if any following non-blank line has greater indentation
      let hasDeeperChild = false;
      for (let j = i + 1; j < textLines.length; j++) {
        const nextLine = textLines[j];
        if (/^\s*$/.test(nextLine)) continue;
        if (getIndentation(nextLine) > indent) {
          hasDeeperChild = true;
        }
        break; // only check the first non-blank line after
      }
      this.foldStates[i].foldable = hasDeeperChild;

      // If line is no longer foldable, unfold it
      if (!hasDeeperChild && this.foldStates[i].folded) {
        this.foldStates[i].folded = false;
      }
    }
  }

  /**
   * Get the range of child line indices that belong to a fold at `lineIdx`.
   * Returns [startChild, endChild) exclusive.
   */
  private getFoldRange(lineIdx: number): [number, number] {
    const lines = getLineElements(this.el);
    const textLines = lines.map((d) => d.textContent || "");
    const indent = getIndentation(textLines[lineIdx]);
    let end = lineIdx + 1;

    for (let i = lineIdx + 1; i < textLines.length; i++) {
      const text = textLines[i];
      if (/^\s*$/.test(text)) {
        end = i + 1;
      } else if (getIndentation(text) > indent) {
        end = i + 1;
      } else {
        break;
      }
    }

    return [lineIdx + 1, end];
  }

  toggleFold(lineIdx: number): void {
    if (!this.foldStates[lineIdx]?.foldable) return;
    const folded = !this.foldStates[lineIdx].folded;
    this.foldStates[lineIdx].folded = folded;
    this.applyFoldVisibility(lineIdx, folded);
    this.renderGutter();
  }

  private applyFoldVisibility(lineIdx: number, folded: boolean): void {
    const lines = getLineElements(this.el);
    const [start, end] = this.getFoldRange(lineIdx);

    for (let i = start; i < end && i < lines.length; i++) {
      lines[i].style.display = folded ? "none" : "";
      // If hiding, also unfold any nested folds
      if (folded && this.foldStates[i]?.folded) {
        this.foldStates[i].folded = false;
      }
    }
  }

  renderGutter(): void {
    const lines = getLineElements(this.el);
    this.gutter.innerHTML = "";

    for (let i = 0; i < lines.length; i++) {
      const row = document.createElement("div");
      row.className = "gutter-row";

      // Match the line's display state
      if (lines[i].style.display === "none") {
        row.style.display = "none";
        this.gutter.appendChild(row);
        continue;
      }

      if (this.foldStates[i]?.foldable) {
        const marker = document.createElement("span");
        marker.className =
          "fold-marker" + (this.foldStates[i].folded ? "" : " fold-open");
        marker.textContent = "›";
        const idx = i;
        marker.addEventListener("mousedown", (e) => {
          e.preventDefault(); // don't steal focus from editor
          this.toggleFold(idx);
        });
        row.appendChild(marker);
      }

      this.gutter.appendChild(row);
    }
  }

  // ── Event Handlers ───────────────────────────────────────────────

  private handleInput = (): void => {
    if (this.suppressInput) return;

    // Ensure every line is wrapped in a div
    this.normalizeLines();
    this.computeFoldability();
    this.renderGutter();
    this.onChange(this.getValue());
  };

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      this.handleEnter(e);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        this.handleDedent();
      } else {
        this.handleIndent();
      }
    } else if (e.key === "Backspace") {
      if (this.handleBackspaceIndent(e)) return;
    } else if (e.key === " ") {
      if (this.handleSpaceIndent(e)) return;
    }
  };

  private handleSelectionChange = (): void => {
    if (this.el.contains(document.activeElement) || this.el === document.activeElement) {
      this.highlightActiveLine();
    }
  };

  // ── Editing Operations ───────────────────────────────────────────

  private handleEnter(e: KeyboardEvent): void {
    e.preventDefault();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    // Find current line div
    let lineDiv: HTMLElement | null = null;
    let node: Node | null = range.startContainer;
    while (node && node !== this.el) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as HTMLElement).parentElement === this.el
      ) {
        lineDiv = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }

    if (!lineDiv) return;

    const lineText = (lineDiv.textContent || "").replace(/\u200B/g, "");
    const indent = lineText.match(/^\s*/)?.[0] || "";

    // Get text after cursor on current line
    const cloneRange = range.cloneRange();
    cloneRange.selectNodeContents(lineDiv);
    cloneRange.setStart(range.startContainer, range.startOffset);
    const afterText = cloneRange.toString().replace(/\u200B/g, "");

    // Split line at cursor position
    const beforeText = lineText.slice(0, lineText.length - afterText.length);
    lineDiv.textContent = beforeText || "\u200B";

    // Create new line with preserved indentation
    const newDiv = document.createElement("div");
    const newText = indent + afterText.replace(/^\s*/, "");
    newDiv.textContent = newText || "\u200B";
    lineDiv.after(newDiv);

    // Place caret at end of indentation on new line
    const newRange = document.createRange();
    const textNode = newDiv.firstChild!;
    const caretPos = Math.min(indent.length, (textNode.textContent || "").length);
    newRange.setStart(textNode, caretPos);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    this.normalizeLines();
    this.computeFoldability();
    this.renderGutter();
    this.onChange(this.getValue());
  }

  private handleIndent(): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const lineDiv = this.findLineDiv(range.startContainer);
    if (lineDiv) {
      const text = (lineDiv.textContent || "").replace(/\u200B/g, "");
      const currentIndent = getIndentation(text);
      const maxIndent = this.getMaxIndent(lineDiv);
      if (currentIndent + 2 > maxIndent) return;
    }

    // Insert two spaces at cursor position
    document.execCommand("insertText", false, "  ");
  }

  private handleDedent(): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // Find current line
    let lineDiv: HTMLElement | null = null;
    let node: Node | null = sel.focusNode;
    while (node && node !== this.el) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as HTMLElement).parentElement === this.el
      ) {
        lineDiv = node as HTMLElement;
        break;
      }
      node = node.parentNode;
    }
    if (!lineDiv) return;

    const text = lineDiv.textContent || "";
    if (text.startsWith("  ")) {
      // Save cursor position
      const range = sel.getRangeAt(0);
      let offset = range.startOffset;

      lineDiv.textContent = text.slice(2) || "\u200B";

      // Restore cursor
      const newRange = document.createRange();
      const textNode = lineDiv.firstChild!;
      const newOffset = Math.max(0, offset - 2);
      newRange.setStart(textNode, Math.min(newOffset, (textNode.textContent || "").length));
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      this.onChange(this.getValue());
    }
  }

  /**
   * When backspace is pressed in leading whitespace, delete one indent level (2 spaces).
   * Returns true if handled, false to let the browser handle it normally.
   */
  private handleBackspaceIndent(e: KeyboardEvent): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

    const range = sel.getRangeAt(0);
    const lineDiv = this.findLineDiv(range.startContainer);
    if (!lineDiv) return false;

    const text = (lineDiv.textContent || "").replace(/\u200B/g, "");
    const offset = this.getOffsetInLine(lineDiv, range);

    // Only handle if cursor is within leading whitespace and at an indent boundary
    const leadingSpaces = text.match(/^\s*/)?.[0].length || 0;
    if (offset > leadingSpaces || offset === 0) return false;
    if (offset < 2) return false;

    // Check if the two characters before cursor are spaces
    if (text.charAt(offset - 1) === " " && text.charAt(offset - 2) === " ") {
      e.preventDefault();
      const newText = text.slice(0, offset - 2) + text.slice(offset);
      lineDiv.textContent = newText || "\u200B";

      const newRange = document.createRange();
      const textNode = lineDiv.firstChild!;
      newRange.setStart(textNode, Math.min(offset - 2, (textNode.textContent || "").length));
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      this.onChange(this.getValue());
      return true;
    }

    return false;
  }

  /**
   * When space is pressed in leading whitespace, insert a full indent level (2 spaces).
   * Returns true if handled, false to let the browser handle it normally.
   */
  private handleSpaceIndent(e: KeyboardEvent): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;

    const range = sel.getRangeAt(0);
    const lineDiv = this.findLineDiv(range.startContainer);
    if (!lineDiv) return false;

    const text = (lineDiv.textContent || "").replace(/\u200B/g, "");
    const offset = this.getOffsetInLine(lineDiv, range);

    // Only handle if cursor is within or at the end of leading whitespace
    const leadingSpaces = text.match(/^\s*/)?.[0].length || 0;
    if (offset > leadingSpaces) return false;

    // Don't allow indenting more than one level past previous line
    const maxIndent = this.getMaxIndent(lineDiv);
    if (leadingSpaces + 2 > maxIndent) {
      e.preventDefault();
      return true;
    }

    e.preventDefault();
    document.execCommand("insertText", false, "  ");
    return true;
  }

  /**
   * Get the maximum allowed indentation (in spaces) for a given line div.
   * A line cannot be indented more than one level (2 spaces) past the previous line.
   */
  private getMaxIndent(lineDiv: HTMLElement): number {
    const prev = lineDiv.previousElementSibling as HTMLElement | null;
    if (!prev) return 2; // first line can indent up to one level
    const prevText = (prev.textContent || "").replace(/\u200B/g, "");
    return getIndentation(prevText) + 2;
  }

  private findLineDiv(node: Node | null): HTMLElement | null {
    while (node && node !== this.el) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node as HTMLElement).parentElement === this.el
      ) {
        return node as HTMLElement;
      }
      node = node.parentNode;
    }
    return null;
  }

  private getOffsetInLine(lineDiv: HTMLElement, range: Range): number {
    const preRange = document.createRange();
    preRange.selectNodeContents(lineDiv);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().replace(/\u200B/g, "").length;
  }

  /**
   * Ensure all direct children are divs (normalize after browser mutations).
   */
  private normalizeLines(): void {
    const children = Array.from(this.el.childNodes);

    // If the editor has no children or only has bare text, wrap in divs
    if (children.length === 0) {
      const div = document.createElement("div");
      div.textContent = "\u200B";
      this.el.appendChild(div);
      return;
    }

    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        const div = document.createElement("div");
        div.textContent = child.textContent || "\u200B";
        this.el.replaceChild(div, child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (el.tagName !== "DIV") {
          const div = document.createElement("div");
          div.textContent = el.textContent || "\u200B";
          this.el.replaceChild(div, el);
        }
      }
    }

    // Remove <br> tags browsers sometimes insert
    this.el.querySelectorAll("br").forEach((br) => br.remove());
  }
}
