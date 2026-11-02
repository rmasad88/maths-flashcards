import katex from 'katex';

// Matches, in order: an escaped dollar, $$display maths$$, or $inline maths$.
const TOKEN = /\\\$|\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

/**
 * Splits card text into text and maths segments.
 * An unmatched $ stays as plain text, and \$ is a literal dollar.
 *
 * @param {string} text
 * @returns {Array<{type: 'text', value: string} | {type: 'maths', value: string, display: boolean}>}
 */
export function parseMaths(text) {
  const segments = [];
  let plain = '';
  let last = 0;

  for (const match of text.matchAll(TOKEN)) {
    plain += text.slice(last, match.index);
    last = match.index + match[0].length;

    if (match[0] === '\\$') {
      plain += '$';
      continue;
    }
    if (plain) {
      segments.push({ type: 'text', value: plain });
      plain = '';
    }
    const display = match[1] !== undefined;
    segments.push({ type: 'maths', value: display ? match[1] : match[2], display });
  }

  plain += text.slice(last);
  if (plain) {
    segments.push({ type: 'text', value: plain });
  }
  return segments;
}

/**
 * Renders card text, typesetting $inline$ and $$display$$ maths with KaTeX.
 * Use this everywhere a card's front or back is shown.
 */
export default function Maths({ text }) {
  return (
    <span className="maths-text">
      {parseMaths(text).map((segment, index) =>
        segment.type === 'text' ? (
          <span key={index}>{segment.value}</span>
        ) : (
          <span
            key={index}
            // KaTeX escapes its input, and leaves trust off, so this HTML is safe. Bad LaTeX renders in red instead of throwing.
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(segment.value, {
                displayMode: segment.display,
                throwOnError: false,
              }),
            }}
          />
        ),
      )}
    </span>
  );
}
