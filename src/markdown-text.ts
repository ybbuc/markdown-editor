// Pure text/selection transforms: each takes the textarea's value + selection
// and returns the edit to apply. No DOM; the client bundle performs the write.

export type TextSelection = { value: string; start: number; end: number }

// [start,end) is replaced by `text`, then the selection is set to
// [selectionStart,selectionEnd) in the resulting value.
export type TextEdit = {
  text: string
  start: number
  end: number
  selectionStart: number
  selectionEnd: number
}

export type ActiveMarks = {
  bold: boolean
  italic: boolean
  strike: boolean
  quote: boolean
  ul: boolean
  ol: boolean
}

export type ListKind = 'bullet' | 'ordered'

const EMPTY_MARKS: ActiveMarks = {
  bold: false,
  italic: false,
  strike: false,
  quote: false,
  ul: false,
  ol: false,
}

// Indices of every non-overlapping occurrence of `token` in `line`.
function findTokens(line: string, token: string): number[] {
  const out: number[] = []
  let i = 0
  while (i <= line.length - token.length) {
    if (line.slice(i, i + token.length) === token) {
      out.push(i)
      i += token.length
    } else {
      i++
    }
  }
  return out
}

// True when [startPos,endPos] sits strictly inside one of the token pairs
// (positions come in open/close order from findTokens).
function insidePair(
  positions: number[],
  tokenLen: number,
  startPos: number,
  endPos: number,
): boolean {
  for (let j = 0; j + 1 < positions.length; j += 2) {
    const open = positions[j] + tokenLen
    const close = positions[j + 1]
    if (
      startPos >= open &&
      startPos <= close &&
      endPos >= open &&
      endPos <= close
    ) {
      return true
    }
  }
  return false
}

function lineBounds(
  value: string,
  start: number,
  end: number,
): { start: number; end: number } {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nl = value.indexOf('\n', end)
  return { start: lineStart, end: nl === -1 ? value.length : nl }
}

export function computeActiveMarks(selection: TextSelection): ActiveMarks {
  const { value, start, end } = selection
  if (!value) return { ...EMPTY_MARKS }
  const { start: lineStart, end: lineEnd } = lineBounds(value, start, end)
  const line = value.slice(lineStart, lineEnd)
  const relStart = start - lineStart
  const relEnd = end - lineStart
  // Blank out the pair markers so single-asterisk italic detection doesn't
  // fire on the inner characters of a bold span.
  const masked = line.replace(/\*\*/g, '  ').replace(/__/g, '  ')
  return {
    quote: /^\s*>\s/.test(line),
    ul: /^\s*[-*+]\s/.test(line),
    ol: /^\s*\d+\.\s/.test(line),
    bold: insidePair(findTokens(line, '**'), 2, relStart, relEnd),
    strike: insidePair(findTokens(line, '~~'), 2, relStart, relEnd),
    italic:
      insidePair(findTokens(masked, '*'), 1, relStart, relEnd) ||
      insidePair(findTokens(masked, '_'), 1, relStart, relEnd),
  }
}

// Toggle the inline markers around the selection: unwrap if the markers are
// inside the selection or just outside it, otherwise wrap.
export function toggleWrap(
  selection: TextSelection,
  before: string,
  after: string,
): TextEdit {
  const { value, start, end } = selection
  const selected = value.slice(start, end)
  if (
    selected.length >= before.length + after.length &&
    selected.slice(0, before.length) === before &&
    selected.slice(selected.length - after.length) === after
  ) {
    const inner = selected.slice(before.length, selected.length - after.length)
    return {
      text: inner,
      start,
      end,
      selectionStart: start,
      selectionEnd: start + inner.length,
    }
  }
  if (
    start >= before.length &&
    value.slice(start - before.length, start) === before &&
    value.slice(end, end + after.length) === after
  ) {
    const newStart = start - before.length
    return {
      text: selected,
      start: newStart,
      end: end + after.length,
      selectionStart: newStart,
      selectionEnd: newStart + selected.length,
    }
  }
  if (start === end) {
    const caret = start + before.length
    return {
      text: before + after,
      start,
      end,
      selectionStart: caret,
      selectionEnd: caret,
    }
  }
  return {
    text: before + selected + after,
    start,
    end,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + selected.length,
  }
}

export function prefixSelectionLines(
  selection: TextSelection,
  prefix: string,
): TextEdit {
  const { value, start, end } = selection
  const { start: lineStart, end: lineEnd } = lineBounds(value, start, end)
  const prefixed = value
    .slice(lineStart, lineEnd)
    .split('\n')
    .map((l) => prefix + l)
    .join('\n')
  return {
    text: prefixed,
    start: lineStart,
    end: lineEnd,
    selectionStart: lineStart + prefix.length,
    selectionEnd: lineStart + prefixed.length,
  }
}

// Toggle bullet/ordered markers on the selected block: strip when every
// non-empty line already matches the kind, otherwise (re)number from 1.
export function toggleList(selection: TextSelection, kind: ListKind): TextEdit {
  const { value, start, end } = selection
  const { start: lineStart, end: lineEnd } = lineBounds(value, start, end)
  const block = value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  const bulletRe = /^(\s*)[-*+]\s+/
  const orderedRe = /^(\s*)\d+\.\s+/
  const anyRe = /^(\s*)(?:[-*+]|\d+\.)\s+/
  const kindRe = kind === 'ordered' ? orderedRe : bulletRe
  const nonEmpty = lines.filter((l) => l.trim() !== '')
  const allMatch = nonEmpty.length > 0 && nonEmpty.every((l) => kindRe.test(l))
  let counter = 1
  const out = lines.map((l) => {
    if (allMatch) return l.trim() === '' ? l : l.replace(kindRe, '$1')
    const stripped = l.replace(anyRe, '$1')
    const indent = /^(\s*)/.exec(stripped)?.[1] ?? ''
    const content = stripped.slice(indent.length)
    const marker = kind === 'ordered' ? `${counter++}. ` : '- '
    return indent + marker + content
  })
  const replacement = out.join('\n')
  const collapsedOnEmpty = start === end && block.trim() === ''
  const caret = lineStart + replacement.length
  return collapsedOnEmpty
    ? {
        text: replacement,
        start: lineStart,
        end: lineEnd,
        selectionStart: caret,
        selectionEnd: caret,
      }
    : {
        text: replacement,
        start: lineStart,
        end: lineEnd,
        selectionStart: lineStart,
        selectionEnd: lineStart + replacement.length,
      }
}

// Enter inside a blockquote/list: continue the block, or exit it when the
// current item is empty. Returns null when the caret isn't in a block.
export function handleBlockEnter(selection: TextSelection): TextEdit | null {
  const { value, start, end } = selection
  if (start !== end) return null
  const pos = start
  const lineStart = value.lastIndexOf('\n', pos - 1) + 1
  const line = value.slice(lineStart, pos)
  const bullet = /^(\s*)([-*+])\s+(.*)$/.exec(line)
  const ordered = /^(\s*)(\d+)\.\s+(.*)$/.exec(line)
  const quote = /^(\s*>+\s?)(.*)$/.exec(line)
  if (!bullet && !ordered && !quote) return null
  let indent: string
  let marker: string
  let content: string
  if (quote) {
    indent = ''
    marker = quote[1]
    content = quote[2]
  } else if (bullet) {
    indent = bullet[1]
    marker = `${bullet[2]} `
    content = bullet[3]
  } else if (ordered) {
    indent = ordered[1]
    marker = `${Number.parseInt(ordered[2], 10) + 1}. `
    content = ordered[3]
  } else {
    return null
  }
  if (content === '') {
    const caret = lineStart + 1
    return {
      text: '\n',
      start: lineStart,
      end: pos,
      selectionStart: caret,
      selectionEnd: caret,
    }
  }
  const insertion = `\n${indent}${marker}`
  const caret = pos + insertion.length
  return {
    text: insertion,
    start: pos,
    end: pos,
    selectionStart: caret,
    selectionEnd: caret,
  }
}
