// Minimal DOM patcher for the doc editor.
//
// patchDoc() compares prevDoc vs newDoc and makes the smallest possible DOM
// changes. For the common case — one text node changed within a paragraph —
// it mutates only that text node and sets the cursor directly, so the browser
// never sees a full re-render.
//
// Returns true when it has already positioned the cursor (caller can skip
// applyDocRange); false when it fell back to innerHTML (caller must apply).

import { DocModel, ParagraphNode, TextNode, Mark, DocPoint } from './wysiwyg-doc-model';
import { renderDoc, renderBlock } from './wysiwyg-doc-renderer';

export function patchDoc(
  el: HTMLElement,
  prevDoc: DocModel,
  newDoc: DocModel,
  newCursor: DocPoint,
): boolean {
  const oldBlocks = prevDoc.children;
  const newBlocks = newDoc.children;

  // Different block count (split / merge / bulk insert) — full re-render.
  if (oldBlocks.length !== newBlocks.length) {
    el.innerHTML = renderDoc(newDoc);
    return false;
  }

  const groups = buildBlockGroups(el);
  if (groups.length !== oldBlocks.length) {
    // DOM is out of sync somehow — reset.
    el.innerHTML = renderDoc(newDoc);
    return false;
  }

  let cursorHandled = false;

  for (let i = 0; i < newBlocks.length; i++) {
    if (newBlocks[i] === oldBlocks[i]) continue; // reference-equal → skip

    const group = groups[i];

    // Fast path: paragraph with identical inline structure, one text node changed.
    if (
      group.nodes.length === 1 &&
      oldBlocks[i].type === 'paragraph' &&
      newBlocks[i].type === 'paragraph'
    ) {
      const handled = tryPatchParagraph(
        group.nodes[0] as HTMLElement,
        oldBlocks[i] as ParagraphNode,
        newBlocks[i] as ParagraphNode,
        newCursor,
      );
      if (handled) { cursorHandled = true; continue; }
    }

    // General path: replace all DOM nodes for this block.
    replaceBlockNodes(el, group.nodes, renderBlock(newBlocks[i], i));
  }

  return cursorHandled;
}

// ─── Block groups ─────────────────────────────────────────────────────────────

// An align block renders as multiple sibling divs (one per paragraph), so one
// model block can correspond to several DOM elements. Group by the first path
// component to reassemble them.
function buildBlockGroups(el: HTMLElement): Array<{ nodes: Element[] }> {
  const map = new Map<number, Element[]>();
  for (const child of Array.from(el.children)) {
    const path = child.getAttribute('data-doc-path');
    if (!path) continue;
    const idx = parseInt(path.split(',')[0], 10);
    if (!map.has(idx)) map.set(idx, []);
    map.get(idx)!.push(child);
  }
  return Array.from(map.keys())
    .sort((a, b) => a - b)
    .map(k => ({ nodes: map.get(k)! }));
}

function replaceBlockNodes(el: HTMLElement, oldNodes: Element[], html: string): void {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const anchor = oldNodes[0];
  for (const newNode of Array.from(temp.children)) el.insertBefore(newNode, anchor);
  for (const old of oldNodes) el.removeChild(old);
}

// ─── Paragraph fast path ─────────────────────────────────────────────────────

// Attempts to patch a single changed text node in place and set the cursor.
// Returns false if the change is too structural for this path.
function tryPatchParagraph(
  divEl: HTMLElement,
  oldPara: ParagraphNode,
  newPara: ParagraphNode,
  newCursor: DocPoint,
): boolean {
  const oldInline = oldPara.children;
  const newInline = newPara.children;

  if (oldInline.length !== newInline.length) return false;

  // Find the single differing inline node. If marks changed, the DOM element
  // structure changes too — bail out and let the general path handle it.
  let changedIdx = -1;
  for (let i = 0; i < newInline.length; i++) {
    const o = oldInline[i], n = newInline[i];
    if (o.type !== n.type) return false;
    if (o.type === 'img') continue;
    if (!marksEq((o as TextNode).marks, (n as TextNode).marks)) return false;
    if ((o as TextNode).text !== (n as TextNode).text) {
      if (changedIdx !== -1) return false; // more than one node differs
      changedIdx = i;
    }
  }

  if (changedIdx === -1) return true; // already in sync

  const textNode = domTextNodeAt(divEl, changedIdx);
  if (!textNode) return false;

  const newText = (newInline[changedIdx] as TextNode).text;
  textNode.nodeValue = newText;

  // Compute the cursor offset within this specific text node.
  let preceding = 0;
  for (let i = 0; i < changedIdx; i++) {
    const n = newInline[i];
    preceding += n.type === 'text' ? n.text.length : 1; // img counts as 1
  }
  const nodeOffset = Math.max(0, Math.min(newCursor.offset - preceding, newText.length));

  const sel = window.getSelection();
  if (sel) {
    const r = document.createRange();
    r.setStart(textNode, nodeOffset);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  return true;
}

// Returns the DOM Text node that corresponds to the inline node at inlineIdx.
// Paragraph children map 1:1 to top-level DOM children (elements or text nodes);
// marked nodes are wrapped elements whose innermost text node holds the content.
function domTextNodeAt(paraEl: HTMLElement, inlineIdx: number): Text | null {
  let count = 0;
  for (const child of Array.from(paraEl.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE && child.nodeType !== Node.TEXT_NODE) continue;
    if (count === inlineIdx) {
      return child.nodeType === Node.TEXT_NODE
        ? child as Text
        : leafTextNode(child as Element);
    }
    count++;
  }
  return null;
}

// Walks firstChild until reaching a text node (handles <b><i>text</i></b>).
function leafTextNode(el: Element): Text | null {
  let node: Node = el;
  while (node.firstChild) node = node.firstChild;
  return node.nodeType === Node.TEXT_NODE ? node as Text : null;
}

// ─── Mark equality ────────────────────────────────────────────────────────────

function marksEq(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false;
  const key = (m: Mark) => JSON.stringify(m);
  const sa = [...a].map(key).sort();
  const sb = [...b].map(key).sort();
  return sa.every((v, i) => v === sb[i]);
}
