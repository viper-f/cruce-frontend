// DocModel → HTML string for the contenteditable view.
//
// Every editable paragraph is rendered as a <div data-doc-path="…"> so the
// cursor mapper can later resolve a DOM position back to a DocPoint by walking
// up to the nearest [data-doc-path] element and counting inline characters.

import {
  DocModel, BlockNode, ParagraphNode, InlineNode, Mark,
} from './wysiwyg-doc-model';

function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname === 'youtu.be') {
      id = u.pathname.slice(1).split('?')[0];
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') {
        id = u.searchParams.get('v');
      } else if (u.pathname.startsWith('/embed/')) {
        id = u.pathname.slice('/embed/'.length).split('?')[0];
      }
    }
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function renderDoc(doc: DocModel): string {
  return doc.children.map((block, i) => renderBlock(block, i)).join('');
}

// ─── Block rendering ─────────────────────────────────────────────────────────

export function renderBlock(block: BlockNode, blockIdx: number): string {
  switch (block.type) {
    case 'paragraph':
      return renderPara(block, [blockIdx]);

    case 'align':
      // Each child paragraph becomes its own aligned div at the top level.
      return block.children
        .map((p, pi) => renderPara(p, [blockIdx, pi], block.align))
        .join('');

    case 'code': {
      const escaped = escCode(block.text);
      // <pre> preserves \n visually (white-space:pre) — no <br> needed.
      return `<div class="wysiwyg-code" data-doc-path="${blockIdx}"><pre>${escaped}</pre></div>`;
    }

    case 'quote': {
      const authorAttr = block.author ? ` data-author="${esc(block.author)}"` : '';
      const userAttr   = block.userId !== undefined ? ` data-user-id="${block.userId}"` : '';
      const inner = block.children
        .map((child, pi) =>
          child.type === 'paragraph'
            ? renderPara(child, [blockIdx, pi])
            : renderBlockStatic(child)
        )
        .join('');
      return `<blockquote${authorAttr}${userAttr} data-doc-path="${blockIdx}">${inner}</blockquote>`;
    }

    case 'spoiler': {
      const title = esc(block.title ?? 'Spoiler');
      const inner = block.children
        .map((p, pi) => renderPara(p, [blockIdx, pi]))
        .join('');
      return (
        `<div class="wysiwyg-spoiler" data-doc-path="${blockIdx}">` +
          `<div class="wysiwyg-spoiler-header">${title}</div>` +
          `<div class="wysiwyg-spoiler-content">${inner}</div>` +
        `</div>`
      );
    }

    case 'video': {
      const embedUrl = youtubeEmbedUrl(block.url);
      if (!embedUrl) return `<div class="wysiwyg-video" contenteditable="false"></div>`;
      return `<div class="wysiwyg-video" contenteditable="false"><iframe src="${esc(embedUrl)}" width="560" height="315" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
    }
  }
}

// ─── Paragraph rendering ─────────────────────────────────────────────────────

function renderPara(para: ParagraphNode, path: number[], align?: string): string {
  const pathAttr  = ` data-doc-path="${path.join(',')}"`;
  const styleAttr = align ? ` style="text-align:${align}"` : '';
  // An empty paragraph needs a <br> so the browser gives it height and lets
  // the cursor enter it.
  const content = para.children.length > 0
    ? para.children.map(renderInline).join('')
    : '<br>';
  return `<div${pathAttr}${styleAttr}>${content}</div>`;
}

// Render a block without data-doc-path attributes so the cursor system cannot
// enter it.  Used for nested quote/spoiler/code blocks inside an outer quote.
function renderBlockStatic(block: BlockNode): string {
  const renderParaStatic = (p: ParagraphNode) => {
    const content = p.children.length > 0 ? p.children.map(renderInline).join('') : '<br>';
    return `<div>${content}</div>`;
  };
  switch (block.type) {
    case 'paragraph':
      return renderParaStatic(block);
    case 'quote': {
      const authorAttr = block.author ? ` data-author="${esc(block.author)}"` : '';
      const userAttr   = block.userId !== undefined ? ` data-user-id="${block.userId}"` : '';
      const inner = block.children.map(c =>
        c.type === 'paragraph' ? renderParaStatic(c) : renderBlockStatic(c)
      ).join('');
      return `<blockquote${authorAttr}${userAttr}>${inner}</blockquote>`;
    }
    case 'code':
      return `<div class="wysiwyg-code"><pre>${escCode(block.text)}</pre></div>`;
    case 'spoiler': {
      const title = esc(block.title ?? 'Spoiler');
      const inner = block.children.map(c =>
        c.type === 'paragraph' ? renderParaStatic(c) : renderBlockStatic(c)
      ).join('');
      return `<div class="wysiwyg-spoiler"><div class="wysiwyg-spoiler-header">${title}</div><div class="wysiwyg-spoiler-content">${inner}</div></div>`;
    }
    case 'align': {
      return block.children.map(p => {
        const content = p.children.length > 0 ? p.children.map(renderInline).join('') : '<br>';
        return `<div style="text-align:${block.align}">${content}</div>`;
      }).join('');
    }
    case 'video': {
      const embedUrl = youtubeEmbedUrl(block.url);
      if (!embedUrl) return `<div class="wysiwyg-video" contenteditable="false"></div>`;
      return `<div class="wysiwyg-video" contenteditable="false"><iframe src="${esc(embedUrl)}" width="560" height="315" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
    }
  }
}

// ─── Inline rendering ────────────────────────────────────────────────────────

// Outermost mark in the rendered HTML is the first entry in this list;
// it is applied last in the wrapping loop (innermost gets wrapped first).
const MARK_ORDER: Mark['type'][] = [
  'size', 'color', 'font', 'link', 'bold', 'italic', 'underline', 'strike',
];

function renderInline(node: InlineNode): string {
  if (node.type === 'img') return `<img src="${esc(safeSrc(node.src))}">`;
  if (!node.text) return '';

  const orderOf = (m: Mark): number => {
    const i = MARK_ORDER.indexOf(m.type);
    return i === -1 ? MARK_ORDER.length : i;
  };
  const sorted = [...node.marks].sort((a, b) => orderOf(a) - orderOf(b));

  let html = esc(node.text);
  for (let i = sorted.length - 1; i >= 0; i--) html = wrapMark(html, sorted[i]);
  return html;
}

function wrapMark(content: string, mark: Mark): string {
  switch (mark.type) {
    case 'bold':      return `<b>${content}</b>`;
    case 'italic':    return `<i>${content}</i>`;
    case 'underline': return `<u>${content}</u>`;
    case 'strike':    return `<s>${content}</s>`;
    case 'color':     return `<span style="color:${esc(mark.value)}">${content}</span>`;
    case 'font':      return `<span style="font-family:${esc(mark.value)}">${content}</span>`;
    // data-user-font-size marks this as intentionally set (not a Chrome artefact)
    case 'size':      return `<span style="font-size:${mark.value}px" data-user-font-size="true">${content}</span>`;
    case 'link':      return `<a href="${esc(safeSrc(mark.href))}">${content}</a>`;
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Escape code content — same as esc() but without the quote rule since it
// lives inside a <pre>, not inside an attribute.
function escCode(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Reject javascript: / data: URLs to prevent XSS through [url] and [img] tags.
function safeSrc(href: string): string {
  const lower = href.trim().toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return '#';
  return href;
}
