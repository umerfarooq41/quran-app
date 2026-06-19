const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BR',
  'EM',
  'H2',
  'H3',
  'I',
  'LI',
  'OL',
  'P',
  'STRONG',
  'UL',
]);

const DROP_CONTENT_TAGS = new Set([
  'IFRAME',
  'OBJECT',
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
]);

export function sanitizeSurahHtml(value = '') {
  if (typeof DOMParser === 'undefined') return stripHtml(value);

  const source = decodeStructuralEntities(String(value));
  const documentNode = new DOMParser().parseFromString(source, 'text/html');
  sanitizeChildren(documentNode.body);
  return documentNode.body.innerHTML;
}

export function parseQuranInternalHref(value = '') {
  const href = String(value).trim();
  const match = href.match(/^(?:\/)?(\d{1,3})\/(\d{1,3})(?:-\d{1,3})?\/?$/)
    || href.match(/^(?:\/)?(\d{1,3}):(\d{1,3})\/?$/);

  if (!match) return null;

  const surahNumber = Number(match[1]);
  const ayahNumber = Number(match[2]);
  if (surahNumber < 1 || surahNumber > 114 || ayahNumber < 1) return null;
  return { surahNumber, ayahNumber };
}

function sanitizeChildren(parent) {
  Array.from(parent.children).forEach((element) => {
    if (DROP_CONTENT_TAGS.has(element.tagName)) {
      element.remove();
      return;
    }

    sanitizeChildren(element);

    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }

    const originalHref = element.tagName === 'A' ? element.getAttribute('href') : '';

    Array.from(element.attributes).forEach((attribute) => {
      element.removeAttribute(attribute.name);
    });

    if (element.tagName === 'A') {
      const reference = parseQuranInternalHref(originalHref);
      if (!reference) {
        element.replaceWith(...element.childNodes);
        return;
      }

      element.setAttribute('href', `/${reference.surahNumber}/${reference.ayahNumber}`);
      element.setAttribute('data-quran-link', 'true');
    }
  });
}

function decodeStructuralEntities(value) {
  return value
    .replace(/&lt;(\/?)(p|h2|h3|ol|ul|li|strong|b|em|i|br|a)(\s[^&]*?)?&gt;/gi, '<$1$2$3>');
}

function stripHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
