import { describe, expect, it } from 'vitest'
import {
  computeActiveMarks,
  handleBlockEnter,
  prefixSelectionLines,
  toggleList,
  toggleWrap,
} from '../src/markdown-text'

const selection = (value: string, start: number, end = start) => ({
  value,
  start,
  end,
})

describe('toggleWrap', () => {
  it('wraps a selection and keeps it selected', () => {
    expect(toggleWrap(selection('hello world', 0, 5), '**', '**')).toEqual({
      text: '**hello**',
      start: 0,
      end: 5,
      selectionStart: 2,
      selectionEnd: 7,
    })
  })

  it('places the caret between the markers for an empty selection', () => {
    expect(toggleWrap(selection('hi', 1), '**', '**')).toEqual({
      text: '****',
      start: 1,
      end: 1,
      selectionStart: 3,
      selectionEnd: 3,
    })
  })

  it('unwraps when the selection already includes the markers', () => {
    expect(toggleWrap(selection('**hello**', 0, 9), '**', '**')).toEqual({
      text: 'hello',
      start: 0,
      end: 9,
      selectionStart: 0,
      selectionEnd: 5,
    })
  })

  it('unwraps when the markers sit just outside the selection', () => {
    expect(toggleWrap(selection('**hello**', 2, 7), '**', '**')).toEqual({
      text: 'hello',
      start: 0,
      end: 9,
      selectionStart: 0,
      selectionEnd: 5,
    })
  })
})

describe('prefixSelectionLines', () => {
  it('prefixes every line in the block', () => {
    const edit = prefixSelectionLines(selection('one\ntwo', 0, 7), '> ')
    expect(edit.text).toBe('> one\n> two')
    expect(edit.start).toBe(0)
    expect(edit.end).toBe(7)
  })
})

describe('toggleList', () => {
  it('turns plain lines into a bulleted list', () => {
    expect(toggleList(selection('one\ntwo', 0, 7), 'bullet').text).toBe(
      '- one\n- two',
    )
  })

  it('removes bullets when every line already has them', () => {
    expect(toggleList(selection('- one\n- two', 0, 11), 'bullet').text).toBe(
      'one\ntwo',
    )
  })

  it('renumbers an ordered list from 1 when converting from bullets', () => {
    expect(toggleList(selection('- one\n- two', 0, 11), 'ordered').text).toBe(
      '1. one\n2. two',
    )
  })

  it('puts the caret after the inserted marker for an empty collapsed line', () => {
    const edit = toggleList(selection('', 0), 'bullet')
    expect(edit.text).toBe('- ')
    expect(edit.selectionStart).toBe(2)
    expect(edit.selectionEnd).toBe(2)
  })
})

describe('handleBlockEnter', () => {
  it('continues a bulleted list', () => {
    expect(handleBlockEnter(selection('- one', 5))?.text).toBe('\n- ')
  })

  it('exits the list when the item is empty', () => {
    const edit = handleBlockEnter(selection('- ', 2))
    expect(edit?.text).toBe('\n')
    expect(edit?.selectionStart).toBe(1)
    expect(edit?.selectionEnd).toBe(1)
  })

  it('continues a blockquote', () => {
    expect(handleBlockEnter(selection('> quote', 7))?.text).toBe('\n> ')
  })

  it('exits an empty blockquote', () => {
    expect(handleBlockEnter(selection('> ', 2))?.text).toBe('\n')
  })

  it('increments ordered list numbers', () => {
    expect(handleBlockEnter(selection('3. item', 7))?.text).toBe('\n4. ')
  })

  it('returns null outside a block', () => {
    expect(handleBlockEnter(selection('plain text', 10))).toBeNull()
  })
})

describe('computeActiveMarks', () => {
  it('detects bold when the caret sits inside **...**', () => {
    expect(computeActiveMarks(selection('**bold**', 4)).bold).toBe(true)
  })

  it('detects italic inside *...* but not inside **...**', () => {
    expect(computeActiveMarks(selection('*it*', 2)).italic).toBe(true)
    expect(computeActiveMarks(selection('**bold**', 4)).italic).toBe(false)
  })

  it('detects list and quote prefixes', () => {
    expect(computeActiveMarks(selection('- item', 3)).ul).toBe(true)
    expect(computeActiveMarks(selection('1. item', 3)).ol).toBe(true)
    expect(computeActiveMarks(selection('> quote', 3)).quote).toBe(true)
  })
})
