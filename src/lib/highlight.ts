export interface Token {
  text: string;
  kind?: string;
}

// Presentation-only tokenization. Example validity is checked with Kedi's parser.
export function highlight(line: string): Token[] {
  const pattern =
    /(```|`[^`]*`|<[^>\n]+>|\[[^\]\n]+\]|>>|:=|^\s*>\s+\w+:|@\w+|~\w+|\b(?:str|bool|int|float)\b|^\s*#.*)/g;
  const tokens: Token[] = [];
  let cursor = 0;
  for (const match of line.matchAll(pattern)) {
    const start = match.index!;
    if (start > cursor) tokens.push({ text: line.slice(cursor, start) });
    const text = match[0];
    const value = text.trim();
    const kind = value.startsWith('<')
      ? 'input'
      : value.startsWith('[')
        ? 'binding'
        : value.startsWith('`')
          ? 'python'
          : value.startsWith('#')
            ? 'comment'
            : 'keyword';
    tokens.push({ text, kind });
    cursor = start + text.length;
  }
  if (cursor < line.length) tokens.push({ text: line.slice(cursor) });
  return tokens;
}
