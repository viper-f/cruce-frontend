// Cursor mapping: DocPoint ↔ DOM position.
//
// Every editable paragraph is rendered as <… data-doc-path="N" or "N,M">.
// The mapper walks up to that element, then counts inline characters to
// translate between the model's integer offset and the browser's (node, offset).

import { DocPoint, DocRange } from './wysiwyg-doc-model';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert a DOM cursor position (from Selection API) to a DocPoint.
 * Returns null when the cursor is outside the editor or inside a container
 * element that is not itself an editable paragraph (e.g. <blockquote>,
 * .wysiwyg-spoiler wrapper, .wysiwyg-spoiler-header).
 */
export function domPositionToDocPoint(
  node: Node,
  offset: number,
  editorEl: HTMLElement,
): DocPoint | null {
  const paraEl = nearestDocPathEl(node, editorEl);
  if (!paraEl || isContainerEl(paraEl)) return null;

  const path = paraEl.dataset['docPath']!.split(',').map(Number);
  return { path, offset: charsToPosition(paraEl, node, offset) };
}

/**
 * Convert a DocPoint to a DOM (node, offset) pair for restoring the browser
 * selection after a model mutation + re-render.
 * Returns null when the path no longer exists in the DOM.
 */
export function docPointToDomPosition(
  point: DocPoint,
  editorEl: HTMLElement,
): { node: Node; offset: number } | null {
  const paraEl = editorEl.querySelector<HTMLElement>(
    `[data-doc-path="${point.path.join(',')}"]`,
  );
  if (!paraEl || isContainerEl(paraEl)) return null;
  return offsetToDomPos(paraEl, point.offset);
}

/**
 * Read the current browser selection as a DocRange within the editor.
 * Returns null if the selection is outside the editor or in a non-editable
 * container element.
 */
export function readDocRange(editorEl: HTMLElement): DocRange | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range  = sel.getRangeAt(0);
  const anchor = domPositionToDocPoint(range.startContainer, range.startOffset, editorEl);
  if (!anchor) return null;

  if (range.collapsed) return { anchor, focus: anchor };

  const focus = domPositionToDocPoint(range.endContainer, range.endOffset, editorEl);
  if (!focus) return null;

  return { anchor, focus };
}

/**
 * Apply a DocRange to the browser selection.
 * Call this after every model mutation + re-render cycle to restore the cursor.
 */
export function applyDocRange(docRange: DocRange, editorEl: HTMLElement): void {
  const start = docPointToDomPosition(docRange.anchor, editorEl);
  if (!start) return;

  const end = docRange.anchor === docRange.focus
    ? start
    : docPointToDomPosition(docRange.focus, editorEl);

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  if (end) range.setEnd(end.node, end.offset); else range.collapse(true);

  const sel = window.getSelection();
  if (sel) { sel.removeAllRanges(); sel.addRange(range); }
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

/** Walk up from `node` to find the nearest ancestor with data-doc-path. */
function nearestDocPathEl(node: Node, editorEl: HTMLElement): HTMLElement | null {
  let cur: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (cur && cur !== editorEl) {
    if (cur instanceof HTMLElement && cur.dataset['docPath'] !== undefined) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * True for elements that carry data-doc-path as a container identifier
 * but are not themselves editable paragraphs.
 */
function isContainerEl(el: HTMLElement): boolean {
  return el.tagName === 'BLOCKQUOTE' || el.classList.contains('wysiwyg-spoiler');
}

// ─── Character counting: DOM → model offset ───────────────────────────────────

/**
 * DFS walk of `container`'s content, counting model characters until we reach
 * the DOM position (targetNode, targetOffset).
 *
 * Counting rules:
 *   - Text node  : each character = 1
 *   - <img>      : counts as 1 (atomic inline)
 *   - <br>       : 0 (empty-paragraph placeholder, not a real character)
 */
function charsToPosition(
  container: HTMLElement,
  targetNode: Node,
  targetOffset: number,
): number {
  let count = 0;
  let done  = false;

  function walk(node: Node): void {
    if (done) return;

    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        // Cursor is at character offset inside this text node.
        count += targetOffset;
      } else {
        // Cursor is at child-index targetOffset inside this element.
        // Count the characters of children [0, targetOffset).
        let i = 0;
        for (const child of Array.from((node as Element).childNodes)) {
          if (i >= targetOffset) break;
          countAll(child);
          i++;
        }
      }
      done = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      count += (node.textContent ?? '').length;
      return;
    }

    const el = node as HTMLElement;
    if (el.tagName === 'BR')  return;
    if (el.tagName === 'IMG') { count += 1; return; }

    for (const child of Array.from(el.childNodes)) {
      walk(child);
      if (done) return;
    }
  }

  // Count all characters under a subtree (used when walking past children).
  function countAll(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      count += (node.textContent ?? '').length;
      return;
    }
    const el = node as HTMLElement;
    if (el.tagName === 'BR')  return;
    if (el.tagName === 'IMG') { count += 1; return; }
    for (const child of Array.from(el.childNodes)) countAll(child);
  }

  walk(container);
  return count;
}

// ─── Offset resolution: model offset → DOM ───────────────────────────────────

/**
 * Walk `container`'s content and find the DOM position that corresponds to
 * `targetChars` characters from the start.  Falls back to the end of the
 * container if targetChars exceeds the paragraph's total character count.
 */
function offsetToDomPos(
  container: HTMLElement,
  targetChars: number,
): { node: Node; offset: number } {
  let remaining = targetChars;

  function walk(node: Node): { node: Node; offset: number } | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? '').length;
      if (remaining <= len) return { node, offset: remaining };
      remaining -= len;
      return null;
    }

    const el = node as HTMLElement;

    if (el.tagName === 'BR') {
      // Only present in empty paragraphs; cursor goes at offset 0 in the parent.
      return remaining === 0 ? { node: el.parentNode!, offset: 0 } : null;
    }

    if (el.tagName === 'IMG') {
      if (remaining === 0) {
        // Cursor is before this img — position in parent at img's child index.
        const parent = el.parentNode!;
        const idx    = Array.from(parent.childNodes).indexOf(el as ChildNode);
        return { node: parent, offset: idx };
      }
      remaining -= 1;
      // remaining === 0 after decrement means cursor is immediately after the img.
      // Return null so the walk continues to the next sibling (or falls back to
      // end-of-container), which naturally lands at offset 0 of whatever follows.
      return null;
    }

    for (const child of Array.from(el.childNodes)) {
      const result = walk(child);
      if (result) return result;
    }
    return null;
  }

  // Fall back to end of container when offset exceeds paragraph length.
  return walk(container) ?? { node: container, offset: container.childNodes.length };
}
