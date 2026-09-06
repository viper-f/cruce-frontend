// BB code ↔ DocModel
//
// parseBbCode  : string → DocModel
// serializeDoc : DocModel → string

import {
  DocModel, BlockNode, ParagraphNode, AlignBlock, QuoteNode, CodeNode, SpoilerNode,
  InlineNode, TextNode, Mark,
} from './wysiwyg-doc-model';

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parseBbCode(bb: string): DocModel {
  const children = parseBlocks(bb);
  // Always keep at least one paragraph so the editor has a cursor target.
  return { children: children.length > 0 ? children : [{ type: 'paragraph', children: [] }] };
}

function parseBlocks(text: string): BlockNode[] {
  const result: BlockNode[] = [];
  // Matches the opening tag of every block-level construct.
  const blockOpen = /\[code\]|\[quote(?:=[^\]]*)?\]|\[spoiler(?:=[^\]]*)?\]|\[center\]|\[right\]|\[left\]/gi;
  let pos = 0;

  let m: RegExpExecArray | null;
  while ((m = blockOpen.exec(text)) !== null) {
    // Inline/paragraph content before this block tag → plain paragraphs
    if (m.index > pos) {
      result.push(...paraLines(text.slice(pos, m.index)));
    }

    const tag   = (m[0].match(/\[(\w+)/) ?? [])[1]?.toLowerCase() ?? '';
    const attr  = (m[0].match(/\[(?:\w+)=([^\]]*)\]/) ?? [])[1];
    const close = `[/${tag}]`;
    const after = m.index + m[0].length;
    const ci    = text.toLowerCase().indexOf(close, after);

    if (ci === -1) {
      // Unclosed tag — skip it
      pos = after;
      blockOpen.lastIndex = after;
      continue;
    }

    // Trim leading/trailing newlines so block content doesn't produce ghost paragraphs
    const content = text.slice(after, ci).replace(/^\n+|\n+$/, '');
    pos = ci + close.length;
    blockOpen.lastIndex = pos;

    switch (tag) {
      case 'code':
        result.push({ type: 'code', text: content });
        break;
      case 'quote':
        result.push({ type: 'quote', author: attr, children: paraLines(content) });
        break;
      case 'spoiler':
        result.push({ type: 'spoiler', title: attr, children: paraLines(content) });
        break;
      case 'center':
      case 'right':
      case 'left':
        result.push({ type: 'align', align: tag as AlignBlock['align'], children: paraLines(content) });
        break;
    }
  }

  if (pos < text.length) {
    result.push(...paraLines(text.slice(pos)));
  }

  return result;
}

// Split raw text on newlines → ParagraphNode[]
function paraLines(text: string): ParagraphNode[] {
  if (!text) return [{ type: 'paragraph', children: [] }];
  return text.split('\n').map(line => ({ type: 'paragraph', children: parseInline(line) }));
}

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const markStack: Mark[] = [];
  const tag = /\[(\/?)([a-z]+)(?:=([^\]]*))?\]/gi;
  let pos = 0;

  let m: RegExpExecArray | null;
  while ((m = tag.exec(text)) !== null) {
    if (m.index > pos) {
      nodes.push({ type: 'text', text: text.slice(pos, m.index), marks: [...markStack] });
    }

    const isClose  = m[1] === '/';
    const tagName  = m[2].toLowerCase();
    const attr     = m[3];

    if (tagName === 'img' && !isClose) {
      const after    = m.index + m[0].length;
      const closeImg = text.toLowerCase().indexOf('[/img]', after);
      if (closeImg !== -1) {
        nodes.push({ type: 'img', src: text.slice(after, closeImg) });
        tag.lastIndex = closeImg + '[/img]'.length;
      }
    } else if (!isClose) {
      const mark = tagToMark(tagName, attr);
      if (mark) markStack.push(mark);
    } else {
      // Pop the last matching mark off the stack (handles overlapping tags gracefully)
      const markType = tagToMarkType(tagName);
      if (markType) {
        for (let i = markStack.length - 1; i >= 0; i--) {
          if (markStack[i].type === markType) { markStack.splice(i, 1); break; }
        }
      }
    }

    pos = tag.lastIndex;
  }

  if (pos < text.length) {
    nodes.push({ type: 'text', text: text.slice(pos), marks: [...markStack] });
  }

  return nodes;
}

function tagToMark(tag: string, attr?: string): Mark | null {
  switch (tag) {
    case 'b':     return { type: 'bold' };
    case 'i':     return { type: 'italic' };
    case 'u':     return { type: 'underline' };
    case 's':     return { type: 'strike' };
    case 'color': return attr ? { type: 'color', value: attr } : null;
    case 'font':  return attr ? { type: 'font',  value: attr.replace(/['"]/g, '') } : null;
    case 'size':  return attr && !isNaN(+attr) ? { type: 'size', value: parseInt(attr) } : null;
    case 'url':   return attr ? { type: 'link',  href: attr } : null;
    default:      return null;
  }
}

function tagToMarkType(tag: string): Mark['type'] | null {
  const map: Partial<Record<string, Mark['type']>> = {
    b: 'bold', i: 'italic', u: 'underline', s: 'strike',
    color: 'color', font: 'font', size: 'size', url: 'link',
  };
  return map[tag] ?? null;
}

// ─── Serializer ───────────────────────────────────────────────────────────────

export function serializeDoc(doc: DocModel): string {
  return doc.children.map(serializeBlock).join('').replace(/\n$/, '');
}

function serializeBlock(block: BlockNode): string {
  switch (block.type) {
    case 'paragraph':
      return serializeParaContent(block) + '\n';
    case 'align': {
      const inner = block.children.map(serializeParaContent).join('\n');
      return `[${block.align}]${inner}[/${block.align}]\n`;
    }
    case 'code':
      return `[code]${block.text}[/code]\n`;
    case 'quote': {
      const inner = block.children.map(serializeParaContent).join('\n');
      return block.author
        ? `[quote=${block.author}]${inner}[/quote]\n`
        : `[quote]${inner}[/quote]\n`;
    }
    case 'spoiler': {
      const inner = block.children.map(serializeParaContent).join('\n');
      return block.title
        ? `[spoiler=${block.title}]${inner}[/spoiler]\n`
        : `[spoiler]${inner}[/spoiler]\n`;
    }
  }
}

function serializeParaContent(para: ParagraphNode): string {
  return mergeAdjacent(para.children).map(serializeInline).join('');
}

// Merge consecutive text nodes with identical marks to avoid redundant tags
function mergeAdjacent(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const n of nodes) {
    if (n.type === 'text' && out.length > 0 && out[out.length - 1].type === 'text') {
      const prev = out[out.length - 1] as TextNode;
      if (marksEqual(prev.marks, n.marks)) {
        out[out.length - 1] = { ...prev, text: prev.text + n.text };
        continue;
      }
    }
    out.push(n);
  }
  return out;
}

function marksEqual(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false;
  const key = (m: Mark) => JSON.stringify(m);
  return [...a].map(key).sort().every((v, i) => v === [...b].map(key).sort()[i]);
}

// Outermost tag comes first in MARK_ORDER; applied last in the wrap loop.
const MARK_ORDER: Mark['type'][] = ['size', 'color', 'font', 'link', 'bold', 'italic', 'underline', 'strike'];

function serializeInline(node: InlineNode): string {
  if (node.type === 'img') return `[img]${node.src}[/img]`;
  if (!node.text) return '';

  const orderOf = (m: Mark) => { const i = MARK_ORDER.indexOf(m.type); return i === -1 ? MARK_ORDER.length : i; };
  const sorted = [...node.marks].sort((a, b) => orderOf(a) - orderOf(b));

  // Wrap innermost first so outermost ends up on the outside
  let result = node.text;
  for (let i = sorted.length - 1; i >= 0; i--) result = wrapMark(result, sorted[i]);
  return result;
}

function wrapMark(text: string, mark: Mark): string {
  switch (mark.type) {
    case 'bold':      return `[b]${text}[/b]`;
    case 'italic':    return `[i]${text}[/i]`;
    case 'underline': return `[u]${text}[/u]`;
    case 'strike':    return `[s]${text}[/s]`;
    case 'color':     return `[color=${mark.value}]${text}[/color]`;
    case 'font':      return `[font="${mark.value}"]${text}[/font]`;
    case 'size':      return `[size=${mark.value}]${text}[/size]`;
    case 'link':      return `[url=${mark.href}]${text}[/url]`;
  }
}
