import type { AlpineGlobal } from './alpine'
import {
  computeActiveMarks,
  continueBlockEnter,
  type Edit,
  type ListKind,
  prefixSelectionLines,
  type Selection,
  toggleSelectionList,
  wrapSelection,
} from './markdown-text'

// Options the x-data call site passes:
//   x-data="markdownEditorData({ initialMarkdown, emptyHtml })"
export type MarkdownEditorOpts = {
  initialMarkdown?: string
  emptyHtml: string
}

export type RegisterMarkdownEditorOptions = {
  /** Alpine.data name; the x-data expression must call this. */
  name?: string
  /**
   * Endpoint the Preview toggle POSTs `body_md` to and renders the HTML from.
   * Each app owns its own route.
   */
  previewUrl: string
}

// Takes the caller's Alpine instance so the package never depends on a global.
export function registerMarkdownEditor(
  Alpine: AlpineGlobal,
  { name = 'markdownEditorData', previewUrl }: RegisterMarkdownEditorOptions,
): void {
  Alpine.data(name, (opts: MarkdownEditorOpts) => ({
    body: opts.initialMarkdown || '',
    preview: false,
    fullscreen: false,
    previewHtml: '',
    previewLoading: false,
    emptyHtml: opts.emptyHtml,
    linkModalOpen: false,
    linkText: '',
    linkUrl: '',
    _linkSelStart: 0,
    _linkSelEnd: 0,
    _lastRenderedBody: null as string | null,
    focusedIdx: 0,
    activeMarks: {
      bold: false,
      italic: false,
      strike: false,
      quote: false,
      ul: false,
      ol: false,
    },
    _selHandler: null as (() => void) | null,

    get ta(): HTMLTextAreaElement | undefined {
      return this.$refs.textarea as HTMLTextAreaElement | undefined
    },

    init() {
      this.$watch('preview', () => {
        if (this.preview) this.loadPreview()
      })
      this.$watch('focusedIdx', () => this._updateTbTabindex())
      this.$nextTick(() => {
        this._updateTbTabindex()
        this._updateActive()
      })
      this._selHandler = () => {
        if (document.activeElement === this.$refs.textarea) this._updateActive()
      }
      document.addEventListener('selectionchange', this._selHandler)
    },

    destroy() {
      if (this._selHandler) {
        document.removeEventListener('selectionchange', this._selHandler)
      }
    },

    _sel(ta: HTMLTextAreaElement): Selection {
      return { value: ta.value, start: ta.selectionStart, end: ta.selectionEnd }
    },

    _updateActive() {
      const ta = this.ta
      if (!ta) return
      this.activeMarks = computeActiveMarks(this._sel(ta))
    },

    _updateTbTabindex() {
      const btns = this.$root.querySelectorAll('[data-tb-idx]')
      const focused = this.focusedIdx
      btns.forEach((btn) => {
        btn.setAttribute(
          'tabindex',
          Number.parseInt(btn.getAttribute('data-tb-idx') || '', 10) === focused
            ? '0'
            : '-1',
        )
      })
    },

    onToolbarKey(e: KeyboardEvent) {
      const key = e.key
      if (
        key !== 'ArrowRight' &&
        key !== 'ArrowLeft' &&
        key !== 'Home' &&
        key !== 'End'
      ) {
        return
      }
      e.preventDefault()
      const el = e.currentTarget as HTMLElement
      const btns = el.querySelectorAll<HTMLElement>('[data-tb-idx]')
      const max = btns.length - 1
      let next: number
      if (key === 'ArrowRight') next = Math.min(this.focusedIdx + 1, max)
      else if (key === 'ArrowLeft') next = Math.max(this.focusedIdx - 1, 0)
      else if (key === 'Home') next = 0
      else next = max
      this.focusedIdx = next
      btns[next].focus()
    },

    onToolbarFocus(e: FocusEvent) {
      const idx = (e.target as HTMLElement | null)?.dataset.tbIdx
      if (idx !== undefined) this.focusedIdx = Number.parseInt(idx, 10)
    },

    async loadPreview() {
      if (this.body === this._lastRenderedBody) return
      if (!this.body) {
        this.previewHtml = ''
        this._lastRenderedBody = ''
        return
      }
      const pending = this.body
      this.previewHtml = ''
      this.previewLoading = true
      try {
        const res = await fetch(previewUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ body_md: pending }),
        })
        if (res.ok) {
          this.previewHtml = await res.text()
          this._lastRenderedBody = pending
        }
      } finally {
        this.previewLoading = false
      }
    },

    _applyInsert(text: string, start: number, end: number) {
      const ta = this.ta
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(start, end)
      let ok = false
      try {
        ok = document.execCommand('insertText', false, text)
      } catch {
        // execCommand is unavailable in some contexts; fall back to setRangeText.
      }
      if (!ok) {
        ta.setRangeText(text, start, end, 'end')
        ta.dispatchEvent(new Event('input', { bubbles: true }))
      }
      this.$nextTick(() => this._updateActive())
    },

    _applyEdit(edit: Edit) {
      this._applyInsert(edit.text, edit.start, edit.end)
      const ta = this.ta
      if (ta) ta.setSelectionRange(edit.selStart, edit.selEnd)
    },

    insertWrap(before: string, after: string) {
      const ta = this.ta
      if (!ta) return
      this._applyEdit(wrapSelection(this._sel(ta), before, after))
    },

    insertLine(prefix: string) {
      const ta = this.ta
      if (!ta) return
      this._applyEdit(prefixSelectionLines(this._sel(ta), prefix))
    },

    toggleList(kind: ListKind) {
      const ta = this.ta
      if (!ta) return
      this._applyEdit(toggleSelectionList(this._sel(ta), kind))
    },

    _handleBlockEnter(): boolean {
      const ta = this.ta
      if (!ta) return false
      const edit = continueBlockEnter(this._sel(ta))
      if (!edit) return false
      this._applyEdit(edit)
      return true
    },

    openLinkModal() {
      const ta = this.ta
      if (!ta) return
      this._linkSelStart = ta.selectionStart
      this._linkSelEnd = ta.selectionEnd
      this.linkText = ta.value.slice(this._linkSelStart, this._linkSelEnd)
      this.linkUrl = ''
      this.linkModalOpen = true
      this.$nextTick(() => {
        const focusRef = this.linkText
          ? this.$refs.linkUrlInput
          : this.$refs.linkTextInput
        if (focusRef) focusRef.focus()
      })
    },

    confirmLink() {
      if (!this.linkUrl) return
      const ta = this.ta
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(this._linkSelStart, this._linkSelEnd)
      const text = this.linkText
      const replacement = `[${text}](${this.linkUrl})`
      this._applyInsert(replacement, this._linkSelStart, this._linkSelEnd)
      const caret = this._linkSelStart + (text ? replacement.length : 1)
      ta.setSelectionRange(caret, caret)
      this.linkModalOpen = false
    },

    togglePreview() {
      this.preview = !this.preview
    },

    toggleFullscreen() {
      this.fullscreen = !this.fullscreen
      document.body.style.overflow = this.fullscreen ? 'hidden' : ''
    },

    onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      if (mod && k === 'b') {
        e.preventDefault()
        this.insertWrap('**', '**')
      } else if (mod && k === 'i') {
        e.preventDefault()
        this.insertWrap('*', '*')
      } else if (mod && k === 'k') {
        e.preventDefault()
        this.openLinkModal()
      } else if (e.key === 'Escape' && this.fullscreen) {
        e.preventDefault()
        this.toggleFullscreen()
      } else if (e.key === 'Enter' && !e.shiftKey && !mod) {
        if (this._handleBlockEnter()) e.preventDefault()
      }
    },
  }))
}
