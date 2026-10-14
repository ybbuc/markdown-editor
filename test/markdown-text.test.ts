import { describe, expect, it } from 'vitest'
import {
  computeActiveMarks,
  continueBlockEnter,
  prefixSelectionLines,
  toggleSelectionList,
  wrapSelection,
} from '../src/markdown-text'

const sel = (value: string, start: number, end = start) => ({
  value,
  start,
  end,
})

describe('wrapSelection', () => {
  it('wraps a selection and keeps it selected', () => {
    expect(wrapSelection(sel('hello world', 0, 5), '**', '**')).toEqual({
      text: '**hello**',
      start: 0,
      end: 5,
      selStart: 2,
      selEnd: 7,
    })
  })

  it('places the caret between the markers for an empty selection', () => {
    expect(wrapSelection(sel('hi', 1), '**', '**')).toEqual({
      text: '****',
      start: 1,
      end: 1,
      selStart: 3,
      selEnd: 3,
    })
  })

  it('unwraps when the selection already includes the markers', () => {
    expect(wrapSelection(sel('**hello**', 0, 9), '**', '**')).toEqual({
      text: 'hello',
      start: 0,
      end: 9,
      selStart: 0,
      selEnd: 5,
    })
  })

  it('unwraps when the markers sit just outside the selection', () => {
    expect(wrapSelection(sel('**hello**', 2, 7), '**', '**')).toEqual({
      text: 'hello',
      start: 0,
      end: 9,
      selStart: 0,
      selEnd: 5,
    })
  })
})

describe('prefixSelectionLines', () => {
  it('prefixes every line in the block', () => {
    const edit = prefixSelectionLines(sel('one\ntwo', 0, 7), '> ')
    expect(edit.text).toBe('> one\n> two')
    expect(edit.start).toBe(0)
    expect(edit.end).toBe(7)
  })
})

describe('toggleSelectionList', () => {
  it('turns plain lines into a bulleted list', () => {
    expect(toggleSelectionList(sel('one\ntwo', 0, 7), 'bullet').text).toBe(
      '- one\n- two',
    )
  })

  it('removes bullets when every line already has them', () => {
    expect(toggleSelectionList(sel('- one\n- two', 0, 11), 'bullet').text).toBe(
      'one\ntwo',
    )
  })

  it('renumbers an ordered list from 1 when converting from bullets', () => {
    expect(
      toggleSelectionList(sel('- one\n- two', 0, 11), 'ordered').text,
    ).toBe('1. one\n2. two')
  })

  it('puts the caret after the inserted marker for an empty collapsed line', () => {
    const edit = toggleSelectionList(sel('', 0), 'bullet')
    expect(edit.text).toBe('- ')
    expect(edit.selStart).toBe(2)
    expect(edit.selEnd).toBe(2)
  })
})

describe('continueBlockEnter', () => {
  it('continues a bulleted list', () => {
    expect(continueBlockEnter(sel('- one', 5))?.text).toBe('\n- ')
  })

  it('exits the list when the item is empty', () => {
    const edit = continueBlockEnter(sel('- ', 2))
    expect(edit?.text).toBe('\n')
    expect(edit?.selStart).toBe(1)
    expect(edit?.selEnd).toBe(1)
  })

  it('continues a blockquote', () => {
    expect(continueBlockEnter(sel('> quote', 7))?.text).toBe('\n> ')
  })

  it('exits an empty blockquote', () => {
    expect(continueBlockEnter(sel('> ', 2))?.text).toBe('\n')
  })

  it('increments ordered list numbers', () => {
    expect(continueBlockEnter(sel('3. item', 7))?.text).toBe('\n4. ')
  })

  it('returns null outside a block', () => {
    expect(continueBlockEnter(sel('plain text', 10))).toBeNull()
  })
})

describe('computeActiveMarks', () => {
  it('detects bold when the caret sits inside **...**', () => {
    expect(computeActiveMarks(sel('**bold**', 4)).bold).toBe(true)
  })

  it('detects italic inside *...* but not inside **...**', () => {
    expect(computeActiveMarks(sel('*it*', 2)).italic).toBe(true)
    expect(computeActiveMarks(sel('**bold**', 4)).italic).toBe(false)
  })

  it('detects list and quote prefixes', () => {
    expect(computeActiveMarks(sel('- item', 3)).ul).toBe(true)
    expect(computeActiveMarks(sel('1. item', 3)).ol).toBe(true)
    expect(computeActiveMarks(sel('> quote', 3)).quote).toBe(true)
  })
})
