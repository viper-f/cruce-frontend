// Flat mark on a text node. Nesting order in BB code is reconstructed at serialization time.
export type Mark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'color'; value: string }
  | { type: 'font';  value: string }
  | { type: 'size';  value: number }
  | { type: 'link';  href: string };

export type TextNode = { type: 'text'; text: string; marks: Mark[] };
export type ImgNode  = { type: 'img';  src: string };
export type InlineNode = TextNode | ImgNode;

// A single line of inline content. No newlines inside.
export type ParagraphNode = {
  type: 'paragraph';
  children: InlineNode[];
};

// [center]/[right]/[left] — may contain multiple paragraphs.
export type AlignBlock = {
  type: 'align';
  align: 'left' | 'center' | 'right';
  children: ParagraphNode[];
};

export type QuoteNode = {
  type: 'quote';
  author?: string;
  children: ParagraphNode[];
};

// Code content is opaque — no inline marks inside.
export type CodeNode = {
  type: 'code';
  text: string;
};

export type SpoilerNode = {
  type: 'spoiler';
  title?: string;
  children: ParagraphNode[];
};

export type BlockNode = ParagraphNode | AlignBlock | QuoteNode | CodeNode | SpoilerNode;

export type DocModel = { children: BlockNode[] };

// ─── Position ────────────────────────────────────────────────────────────────
//
// path[0] = index into doc.children
// path[1] = (only for AlignBlock / QuoteNode / SpoilerNode) index into container.children
// offset  = character offset within the targeted paragraph (or CodeNode.text)
//
// Each TextNode character counts as 1; each ImgNode counts as 1.
export type DocPoint = { path: number[]; offset: number };
export type DocRange = { anchor: DocPoint; focus: DocPoint };
