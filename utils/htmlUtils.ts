/**
 * Convert HTML content to plain text (strip tags).
 * Used for voice tracking which requires plain text input.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  // Create a temporary DOM element to parse HTML
  const div = document.createElement('div');
  div.innerHTML = html;
  // Replace <br> and <p>/<div> with newlines for readability
  div.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  div.querySelectorAll('p, div, h1, h2, h3, h4, li').forEach(el => {
    el.after('\n');
  });
  return div.textContent || div.innerText || '';
}

/**
 * Check if a string contains HTML tags.
 */
export function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Convert plain text to simple HTML paragraphs.
 */
export function plainTextToHtml(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${p.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('');
}
