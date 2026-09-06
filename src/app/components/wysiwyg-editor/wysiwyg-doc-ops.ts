// Pure document operations: DocModel → OpResult.
//
// Every function returns the updated document AND the new cursor position so
// the rendering layer can re-render and restore focus in one step.
// Nothing here touches the DOM.

import {
  DocModel, BlockNode, ParagraphNode, AlignBlock, QuoteNode, SpoilerNode, CodeNode,
  InlineNode, TextNode, ImgNode, Mark, DocPoint, DocRange,
} from './wysiwyg-doc-model';

export type OpResult = { doc: DocModel; cursor: DocPoint };

// ─── Public operations ────────────────────────────────────────────────────────

/**
 * Insert `text` with `marks` at `point`.
 * Inside a code block the marks parameter is ignored.
 */
export function insertText(
  doc: DocModel,
  point: DocPoint,
  text: string,
  marks: Mark[],
): OpResult {
  const code = getCode(doc, point.path);
  if (code) {
    const next = code.text.slice(0, point.offset) + text + code.text.slice(point.offset);
    return {
      doc: { children: replaceBlock(doc, point.path[0], { ...code, text: next }) },
      cursor: { path: point.path, offset: point.offset + text.length },
    };
  }

  return updatePara(doc, point, (para, offset) => {
    const newNode: TextNode = { type: 'text', text, marks };
    const [before, after] = splitAt(para.children, offset);
    return {
      para: { ...para, children: normalize([...before, newNode, ...after]) },
      cursor: { path: point.path, offset: offset + text.length },
    };
  });
}

/** Insert an image at `point`. No-op inside code blocks. */
export function insertImg(doc: DocModel, point: DocPoint, src: string): OpResult {
  if (getCode(doc, point.path)) return { doc, cursor: point };
  return updatePara(doc, point, (para, offset) => {
    const imgNode: ImgNode = { type: 'img', src };
    const [before, after] = splitAt(para.children, offset);
    return {
      para: { ...para, children: normalize([...before, imgNode, ...after]) },
      cursor: { path: point.path, offset: offset + 1 },
    };
  });
}

/**
 * Delete all content covered by `range`.
 * Works within a single paragraph, across paragraphs in the same container,
 * and across top-level blocks.
 */
export function deleteRange(doc: DocModel, range: DocRange): OpResult {
  const { anchor, focus } = ordered(range);
  if (pointEq(anchor, focus)) return { doc, cursor: anchor };

  if (pathEq(anchor.path, focus.path)) {
    // Same paragraph or code block
    const code = getCode(doc, anchor.path);
    if (code) {
      const next = code.text.slice(0, anchor.offset) + code.text.slice(focus.offset);
      return {
        doc: { children: replaceBlock(doc, anchor.path[0], { ...code, text: next }) },
        cursor: anchor,
      };
    }
    return updatePara(doc, anchor, (para) => ({
      para: { ...para, children: deleteSlice(para.children, anchor.offset, focus.offset) },
      cursor: anchor,
    }));
  }

  return crossParaDelete(doc, anchor, focus);
}

/**
 * Split the paragraph at `point` in two (Enter key).
 * New cursor lands at offset 0 of the newly created second paragraph.
 */
export function splitParagraph(doc: DocModel, point: DocPoint): OpResult {
  const path = point.path;

  if (path.length === 1) {
    const block = doc.children[path[0]];
    // Code blocks are single opaque text units — Enter inserts a literal newline.
    if (block.type === 'code') {
      const next = block.text.slice(0, point.offset) + '\n' + block.text.slice(point.offset);
      return {
        doc: { children: replaceBlock(doc, path[0], { ...block, text: next }) },
        cursor: { path: point.path, offset: point.offset + 1 },
      };
    }
    if (block.type !== 'paragraph') return { doc, cursor: point };

    const [before, after] = splitAt(block.children, point.offset);
    const a: ParagraphNode = { type: 'paragraph', children: normalize(before) };
    const b: ParagraphNode = { type: 'paragraph', children: normalize(after) };
    return {
      doc: { children: spliceBlocks(doc.children, path[0], 1, a, b) },
      cursor: { path: [path[0] + 1], offset: 0 },
    };
  }

  if (path.length === 2) {
    const container = doc.children[path[0]] as ContainerBlock;
    const para = container.children[path[1]];
    const [before, after] = splitAt(para.children, point.offset);
    const a: ParagraphNode = { type: 'paragraph', children: normalize(before) };
    const b: ParagraphNode = { type: 'paragraph', children: normalize(after) };
    const newParas = spliceBlocks(container.children, path[1], 1, a, b);
    return {
      doc: { children: replaceBlock(doc, path[0], { ...container, children: newParas }) },
      cursor: { path: [path[0], path[1] + 1], offset: 0 },
    };
  }

  return { doc, cursor: point };
}

/**
 * Merge the paragraph at `point` (offset must be 0) into the one before it
 * (Backspace at the very start of a paragraph).
 * No-op when already at the first paragraph in a scope.
 */
export function mergeParagraphWithPrevious(doc: DocModel, point: DocPoint): OpResult {
  const path = point.path;

  if (path.length === 1) {
    if (path[0] === 0) return { doc, cursor: point };
    const prev = doc.children[path[0] - 1];
    const curr = doc.children[path[0]];
    if (prev.type !== 'paragraph' || curr.type !== 'paragraph') return { doc, cursor: point };

    const joinOffset = inlineLen(prev.children);
    const merged: ParagraphNode = {
      type: 'paragraph',
      children: normalize([...prev.children, ...curr.children]),
    };
    return {
      doc: { children: spliceBlocks(doc.children, path[0] - 1, 2, merged) },
      cursor: { path: [path[0] - 1], offset: joinOffset },
    };
  }

  if (path.length === 2) {
    if (path[1] === 0) return { doc, cursor: point };
    const container = doc.children[path[0]] as ContainerBlock;
    const prev = container.children[path[1] - 1];
    const curr = container.children[path[1]];

    const joinOffset = inlineLen(prev.children);
    const merged: ParagraphNode = {
      type: 'paragraph',
      children: normalize([...prev.children, ...curr.children]),
    };
    const newParas = spliceBlocks(container.children, path[1] - 1, 2, merged);
    return {
      doc: { children: replaceBlock(doc, path[0], { ...container, children: newParas }) },
      cursor: { path: [path[0], path[1] - 1], offset: joinOffset },
    };
  }

  return { doc, cursor: point };
}

/**
 * Apply `mark` to every text node in `range`.
 * Only operates within a single paragraph for now.
 */
export function applyMark(doc: DocModel, range: DocRange, mark: Mark): OpResult {
  return markOp(doc, range, nodes =>
    nodes.map(n => n.type === 'img' || hasMark(n.marks, mark)
      ? n
      : { ...n, marks: [...n.marks, mark] }),
  );
}

/**
 * Remove the mark of type `markType` from every text node in `range`.
 */
export function removeMark(doc: DocModel, range: DocRange, markType: Mark['type']): OpResult {
  return markOp(doc, range, nodes =>
    nodes.map(n => n.type === 'img'
      ? n
      : { ...n, marks: n.marks.filter(m => m.type !== markType) }),
  );
}

/**
 * Apply the mark if any text node in the range lacks it; remove it if all
 * text nodes already have it (standard toolbar toggle behaviour).
 */
export function toggleMark(doc: DocModel, range: DocRange, mark: Mark): OpResult {
  const { anchor, focus } = ordered(range);
  if (!pathEq(anchor.path, focus.path)) return { doc, cursor: anchor };

  const para = getPara(doc, anchor.path);
  if (!para) return { doc, cursor: anchor };

  const [, rest]    = splitAt(para.children, anchor.offset);
  const [middle]    = splitAt(rest, focus.offset - anchor.offset);
  const textNodes   = middle.filter((n): n is TextNode => n.type === 'text' && n.text.length > 0);
  const allHaveMark = textNodes.length > 0 && textNodes.every(n => hasMark(n.marks, mark));

  return allHaveMark ? removeMark(doc, range, mark.type) : applyMark(doc, range, mark);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Return the marks that apply at `point` (the marks of the character
 * immediately to the left of the cursor, or [] if at offset 0).
 */
export function getMarksAtPoint(doc: DocModel, point: DocPoint): Mark[] {
  const para = getPara(doc, point.path);
  if (!para || point.offset === 0) return [];

  let remaining = point.offset;
  for (const node of para.children) {
    const len = node.type === 'text' ? node.text.length : 1;
    if (remaining <= len) return node.type === 'text' ? node.marks : [];
    remaining -= len;
  }
  return [];
}

/**
 * True when every text character in `range` carries `mark`.
 */
export function isRangeAllMark(doc: DocModel, range: DocRange, mark: Mark): boolean {
  const { anchor, focus } = ordered(range);
  if (!pathEq(anchor.path, focus.path)) return false;
  const para = getPara(doc, anchor.path);
  if (!para) return false;

  const [, rest]  = splitAt(para.children, anchor.offset);
  const [middle]  = splitAt(rest, focus.offset - anchor.offset);
  const textNodes = middle.filter((n): n is TextNode => n.type === 'text' && n.text.length > 0);
  return textNodes.length > 0 && textNodes.every(n => hasMark(n.marks, mark));
}

// ─── Inline primitives ────────────────────────────────────────────────────────

/** Total model-character count for an inline sequence. */
export function inlineLen(nodes: InlineNode[]): number {
  return nodes.reduce((s, n) => s + (n.type === 'text' ? n.text.length : 1), 0);
}

/**
 * Split `nodes` at `offset`, returning [before, after].
 * Each text node that straddles the split is divided into two pieces.
 */
function splitAt(nodes: InlineNode[], offset: number): [InlineNode[], InlineNode[]] {
  const before: InlineNode[] = [];
  const after:  InlineNode[] = [];
  let rem = offset;
  let past = false;

  for (const node of nodes) {
    if (past) { after.push(node); continue; }

    if (node.type === 'img') {
      if (rem === 0) { after.push(node); past = true; }
      else           { before.push(node); rem -= 1; if (rem === 0) past = true; }
      continue;
    }

    // TextNode
    if (rem <= 0) {
      after.push(node); past = true;
    } else if (rem >= node.text.length) {
      before.push(node); rem -= node.text.length; if (rem === 0) past = true;
    } else {
      before.push({ ...node, text: node.text.slice(0, rem) });
      after.push(  { ...node, text: node.text.slice(rem)   });
      past = true;
    }
  }

  return [before, after];
}

/** Delete characters in [start, end) from an inline sequence. */
function deleteSlice(nodes: InlineNode[], start: number, end: number): InlineNode[] {
  const [before, rest] = splitAt(nodes, start);
  const [, after]      = splitAt(rest,  end - start);
  return normalize([...before, ...after]);
}

/** Merge adjacent text nodes that share identical marks; drop empty text nodes. */
function normalize(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const n of nodes) {
    if (n.type === 'text' && n.text === '') continue;
    const prev = out.length > 0 ? out[out.length - 1] : null;
    if (prev && prev.type === 'text' && n.type === 'text' && marksEq(prev.marks, n.marks)) {
      out[out.length - 1] = { ...prev, text: prev.text + n.text };
    } else {
      out.push(n);
    }
  }
  return out;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

type ContainerBlock = AlignBlock | QuoteNode | SpoilerNode;

/** Apply a transform to the inline nodes inside a range (single paragraph only). */
function markOp(
  doc: DocModel,
  range: DocRange,
  transform: (nodes: InlineNode[]) => InlineNode[],
): OpResult {
  const { anchor, focus } = ordered(range);
  if (!pathEq(anchor.path, focus.path)) return { doc, cursor: anchor };

  return updatePara(doc, anchor, (para) => {
    const [before, rest]  = splitAt(para.children, anchor.offset);
    const [middle, after] = splitAt(rest, focus.offset - anchor.offset);
    return {
      para: { ...para, children: normalize([...before, ...transform(middle), ...after]) },
      cursor: focus,
    };
  });
}

/**
 * Delete across paragraph boundaries.
 * Handles top-level cross-block and same-container cross-paragraph deletes.
 * Falls back to no-op for cross-container deletes (rare; complex).
 */
function crossParaDelete(doc: DocModel, anchor: DocPoint, focus: DocPoint): OpResult {
  // Same depth, both in containers of the same block
  if (anchor.path.length === 2 && focus.path.length === 2 && anchor.path[0] === focus.path[0]) {
    const container = doc.children[anchor.path[0]] as ContainerBlock;
    const firstPara = container.children[anchor.path[1]];
    const lastPara  = container.children[focus.path[1]];

    const [before] = splitAt(firstPara.children, anchor.offset);
    const [, after]  = splitAt(lastPara.children,  focus.offset);
    const merged: ParagraphNode = { type: 'paragraph', children: normalize([...before, ...after]) };

    const newParas = [
      ...container.children.slice(0, anchor.path[1]),
      merged,
      ...container.children.slice(focus.path[1] + 1),
    ];
    return {
      doc: { children: replaceBlock(doc, anchor.path[0], { ...container, children: newParas }) },
      cursor: anchor,
    };
  }

  // Top-level cross-block
  const startIdx = anchor.path[0];
  const endIdx   = focus.path[0];
  const startBlock = doc.children[startIdx];
  const endBlock   = doc.children[endIdx];

  // Extract the surviving inline fragments from the boundary blocks
  const beforeInline = startBlock.type === 'paragraph'
    ? splitAt(startBlock.children, anchor.offset)[0]
    : [];
  const afterInline = endBlock.type === 'paragraph'
    ? splitAt(endBlock.children, focus.offset)[1]
    : [];

  const merged: ParagraphNode = {
    type: 'paragraph',
    children: normalize([...beforeInline, ...afterInline]),
  };

  const newChildren = [
    ...doc.children.slice(0, startIdx),
    merged,
    ...doc.children.slice(endIdx + 1),
  ];

  return { doc: { children: newChildren }, cursor: anchor };
}

/** Locate the ParagraphNode at path, or null if the path points elsewhere. */
function getPara(doc: DocModel, path: number[]): ParagraphNode | null {
  if (path.length === 1) {
    const b = doc.children[path[0]];
    return b?.type === 'paragraph' ? b : null;
  }
  if (path.length === 2) {
    const container = doc.children[path[0]];
    if (!('children' in container)) return null;
    const b = (container as ContainerBlock).children[path[1]];
    return b?.type === 'paragraph' ? b : null;
  }
  return null;
}

/** Locate the CodeNode at path, or null. */
function getCode(doc: DocModel, path: number[]): CodeNode | null {
  if (path.length === 1) {
    const b = doc.children[path[0]];
    return b?.type === 'code' ? b : null;
  }
  return null;
}

type ParaUpdate = { para: ParagraphNode; cursor: DocPoint };

/**
 * Look up the paragraph at `point.path`, pass it (and the offset) to `fn`,
 * and rebuild the document with the returned paragraph.
 */
function updatePara(
  doc: DocModel,
  point: DocPoint,
  fn: (para: ParagraphNode, offset: number) => ParaUpdate,
): OpResult {
  const path = point.path;

  if (path.length === 1) {
    const block = doc.children[path[0]];
    if (block.type !== 'paragraph') return { doc, cursor: point };
    const { para, cursor } = fn(block, point.offset);
    return { doc: { children: replaceBlock(doc, path[0], para) }, cursor };
  }

  if (path.length === 2) {
    const container = doc.children[path[0]] as ContainerBlock;
    const { para, cursor } = fn(container.children[path[1]], point.offset);
    const newParas    = replaceAt(container.children, path[1], para);
    const newContainer = { ...container, children: newParas };
    return { doc: { children: replaceBlock(doc, path[0], newContainer) }, cursor };
  }

  return { doc, cursor: point };
}

// ─── Array utilities ──────────────────────────────────────────────────────────

function replaceBlock(doc: DocModel, idx: number, block: BlockNode): BlockNode[] {
  return replaceAt(doc.children, idx, block);
}

function replaceAt<T>(arr: readonly T[], idx: number, item: T): T[] {
  return [...arr.slice(0, idx), item, ...arr.slice(idx + 1)];
}

/** Like Array.splice but immutable and typed for block arrays. */
function spliceBlocks<T>(arr: readonly T[], start: number, deleteCount: number, ...items: T[]): T[] {
  return [...arr.slice(0, start), ...items, ...arr.slice(start + deleteCount)];
}

// ─── Mark / point utilities ───────────────────────────────────────────────────

function marksEq(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false;
  const key = (m: Mark) => JSON.stringify(m);
  return [...a].map(key).sort().every((v, i) => v === [...b].map(key).sort()[i]);
}

function hasMark(marks: Mark[], mark: Mark): boolean {
  const target = JSON.stringify(mark);
  return marks.some(m => JSON.stringify(m) === target);
}

export function pathEq(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function pointEq(a: DocPoint, b: DocPoint): boolean {
  return pathEq(a.path, b.path) && a.offset === b.offset;
}

export function isCollapsed(range: DocRange): boolean {
  return pointEq(range.anchor, range.focus);
}

/** Return range with anchor ≤ focus in document order. */
function ordered(range: DocRange): DocRange {
  return cmpPoints(range.anchor, range.focus) <= 0
    ? range
    : { anchor: range.focus, focus: range.anchor };
}

function cmpPoints(a: DocPoint, b: DocPoint): number {
  const len = Math.max(a.path.length, b.path.length);
  for (let i = 0; i < len; i++) {
    const ai = a.path[i] ?? -1;
    const bi = b.path[i] ?? -1;
    if (ai !== bi) return ai - bi;
  }
  return a.offset - b.offset;
}
