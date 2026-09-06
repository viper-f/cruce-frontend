// HTML produced by contenteditable → BB code
export function htmlToBbCode(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return processContainer(div).trim();
}

// Walk the top-level children, inserting a newline before block elements when needed
function processContainer(el: Element): string {
  let result = '';
  let prevWasBlock = false;
  for (const child of Array.from(el.childNodes)) {
    const tag = (child as HTMLElement).tagName?.toLowerCase();
    const childEl = child as HTMLElement;
    const isBlock = child.nodeType === Node.ELEMENT_NODE && (
      ['p', 'blockquote', 'pre'].includes(tag ?? '') ||
      (tag === 'div' && !childEl.classList.contains('wysiwyg-spoiler-header') && !childEl.classList.contains('wysiwyg-spoiler-content')) ||
      childEl.classList.contains('wysiwyg-spoiler') ||
      childEl.classList.contains('wysiwyg-code')
    );
    if (isBlock && result && !result.endsWith('\n')) {
      result += '\n';
    }
    // A <br> that immediately follows a block element is a Chrome normalization
    // artifact — the browser inserts it as a stand-alone node between <div>s when
    // it rewrites flat <br>-based content to paragraph-div format. Skipping it
    // prevents a single newline from becoming a double newline on each save.
    if (tag === 'br' && prevWasBlock) {
      prevWasBlock = false;
      continue;
    }
    result += nodeToText(child);
    prevWasBlock = isBlock;
  }
  return result;
}

function nodeToText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = (): string => Array.from(el.childNodes).map(nodeToText).join('');

  switch (tag) {
    case 'br': return '\n';
    case 'b': case 'strong': return `[b]${inner()}[/b]`;
    case 'i': case 'em':     return `[i]${inner()}[/i]`;
    case 'u':                return `[u]${inner()}[/u]`;
    case 's': case 'del': case 'strike': return `[s]${inner()}[/s]`;

    case 'img': {
      const src = (el as HTMLImageElement).getAttribute('src') ?? '';
      return src ? `[img]${src}[/img]` : '';
    }
    case 'a': {
      const href = (el as HTMLAnchorElement).getAttribute('href') ?? '';
      return href ? `[url=${href}]${inner()}[/url]` : inner();
    }
    case 'blockquote': {
      const author = el.getAttribute('data-author') ?? '';
      return author
        ? `[quote=${author}]${inner()}[/quote]\n`
        : `[quote]${inner()}[/quote]\n`;
    }
    case 'pre': {
      // Walk children so <br> elements are preserved as \n
      const parts: string[] = [];
      el.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) parts.push(child.textContent ?? '');
        else if ((child as HTMLElement).tagName?.toLowerCase() === 'br') parts.push('\n');
      });
      return `[code]${parts.join('')}[/code]\n`;
    }

    case 'div': {
      if (el.classList.contains('wysiwyg-code')) {
        const pre = el.querySelector('pre');
        if (pre) {
          const walkPre = (node: Node): string => {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
            if ((node as HTMLElement).tagName?.toLowerCase() === 'br') return '\n';
            return Array.from(node.childNodes).map(walkPre).join('');
          };
          const content = Array.from(pre.childNodes).map(walkPre).join('');
          return `[code]${content}[/code]\n`;
        }
        return `[code]${el.textContent ?? ''}[/code]\n`;
      }
      if (el.classList.contains('wysiwyg-spoiler')) {
        const headerEl = el.querySelector('.wysiwyg-spoiler-header');
        const title = headerEl?.textContent?.trim() ?? '';
        const contentEl = el.querySelector('.wysiwyg-spoiler-content');
        const content = contentEl
          ? Array.from(contentEl.childNodes).map(nodeToText).join('').trim()
          : '';
        return title
          ? `[spoiler=${title}]${content}[/spoiler]\n`
          : `[spoiler]${content}[/spoiler]\n`;
      }
      if (el.classList.contains('wysiwyg-spoiler-header')) return '';
      if (el.classList.contains('wysiwyg-spoiler-content')) return inner();
      const divChildren = inner().replace(/\n+$/, '');
      const divContent = divChildren === '' ? '' : divChildren;
      const divAlign = el.style.textAlign;
      let divResult = divContent;
      if (divAlign === 'center') divResult = `[center]${divResult.trimEnd()}[/center]`;
      else if (divAlign === 'right')  divResult = `[right]${divResult.trimEnd()}[/right]`;
      else if (divAlign === 'left')   divResult = `[left]${divResult.trimEnd()}[/left]`;
      return divResult + '\n';
    }

    case 'p': {
      const children = inner().replace(/\n+$/, '');
      const content = children === '' ? '' : children;
      const align = el.style.textAlign;
      let result = content;
      if (align === 'center') result = `[center]${result.trimEnd()}[/center]`;
      else if (align === 'right')  result = `[right]${result.trimEnd()}[/right]`;
      else if (align === 'left')   result = `[left]${result.trimEnd()}[/left]`;
      return result + '\n';
    }

    case 'font': {
      let r = inner();
      const color = el.getAttribute('color');
      const face  = el.getAttribute('face');
      if (color) r = `[color=${color}]${r}[/color]`;
      if (face)  r = `[font="${face}"]${r}[/font]`;
      return r;
    }
    case 'span': {
      let r = inner();
      const s = el.style;
      if (s.color)      r = `[color=${s.color}]${r}[/color]`;
      if (s.fontFamily) r = `[font="${s.fontFamily.replace(/['"]/g, '')}"]${r}[/font]`;
      // Only convert font-size if it was explicitly set by the user (not injected by
      // Chrome's contenteditable normalization during Enter/delete/Enter sequences).
      if (s.fontSize && el.dataset['userFontSize'])   r = `[size=${parseInt(s.fontSize)}]${r}[/size]`;
      return r;
    }

    default: return inner();
  }
}

// BB code → HTML for the WYSIWYG editor.
//
// [code] blocks are extracted first (before any other rules run) so their
// content is never touched by the [img]/[url]/etc. replacements.
// Content is HTML-escaped and placed in a <pre> — the browser renders it as
// literal text, never as HTML.
// The <span>[</span> wrapping is an extra layer: even if the regex somehow
// missed a block, [img] etc. can't form because [ is no longer a bare character.
// sanitizeCodeBlocks() in the component strips any remaining HTML elements from
// <pre> after innerHTML is set, as a final safety net.
export function bbCodeToHtml(bb: string): string {
  if (!bb) return '';

  const codeBlocks: string[] = [];
  let s = bb.replace(/\[code\]([\s\S]*?)\[\/code\]/g, (_, content) => {
    codeBlocks.push(content);
    return `WYSIWYG_CODE_PH_${codeBlocks.length - 1}_END`;
  });

  s = s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[b\]([\s\S]*?)\[\/b\]/g,   '<b>$1</b>')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/g,   '<i>$1</i>')
    .replace(/\[u\]([\s\S]*?)\[\/u\]/g,   '<u>$1</u>')
    .replace(/\[s\]([\s\S]*?)\[\/s\]/g,   '<s>$1</s>')
    .replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/g, '<font color="$1">$2</font>')
    .replace(/\[font="?([^"\]]+)"?\]([\s\S]*?)\[\/font\]/g, '<font face="$1">$2</font>')
    .replace(/\[size=(\d+)\]([\s\S]*?)\[\/size\]/g,      '<span style="font-size:$1px" data-user-font-size="true">$2</span>')
    .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/g,     '<a href="$1">$2</a>')
    .replace(/\[img\]([\s\S]*?)\[\/img\]/g,              '<img src="$1">')
    .replace(/\[center\]([\s\S]*?)\[\/center\]/g, '<div style="text-align:center">$1</div>')
    .replace(/\[right\]([\s\S]*?)\[\/right\]/g,   '<div style="text-align:right">$1</div>')
    .replace(/\[left\]([\s\S]*?)\[\/left\]/g,     '<div style="text-align:left">$1</div>')
    .replace(/\[quote=([^\]]+)\]([\s\S]*?)\[\/quote\]/g, '<blockquote data-author="$1">$2</blockquote>')
    .replace(/\[quote\]([\s\S]*?)\[\/quote\]/g,          '<blockquote>$1</blockquote>')
    .replace(/\[spoiler=([^\]]+)\]([\s\S]*?)\[\/spoiler\]/g, '<div class="wysiwyg-spoiler" data-title="$1"><div class="wysiwyg-spoiler-header">$1</div><div class="wysiwyg-spoiler-content">$2</div></div>')
    .replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/g,          '<div class="wysiwyg-spoiler"><div class="wysiwyg-spoiler-header">Spoiler</div><div class="wysiwyg-spoiler-content">$1</div></div>')
    .replace(/\n/g, '<br>');

  return s.replace(/WYSIWYG_CODE_PH_(\d+)_END/g, (_, i) => {
    const escaped = codeBlocks[parseInt(i)]
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\[/g, '<span>[</span>');
    return `<div class="wysiwyg-code"><pre>${escaped}</pre></div>`;
  });
}
