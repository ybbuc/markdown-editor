# @ybbuc/markdown-editor

Typed, dependency-free logic for a markdown editor toolbar.

Two layers:

- **`markdown-text.ts`** — pure selection/text transforms (`wrapSelection`,
  `toggleSelectionList`, `continueBlockEnter`, `computeActiveMarks`, …). No DOM,
  no framework. Unit-tested.
- **`markdown-editor.ts`** — the Alpine data factory wiring those transforms to
  a `<textarea>` (`registerMarkdownEditor`). The markup stays in the consuming
  app, because the toolbar's markup, icons and design tokens are app-specific.

Ships raw TypeScript (`exports` points at `./src/index.ts`), so the consumer's
bundler transpiles it — no build or publish step.

## Installing

Consumed as a pinned git dependency:

```bash
pnpm add github:ybbuc/markdown-editor#v0.9.0
```

## Usage

Declare the Alpine global in the app (once), then register the factory on
`alpine:init`:

```ts
import { registerMarkdownEditor } from '@ybbuc/markdown-editor'

declare global {
  interface Window {
    Alpine: AlpineGlobal
  }
}

document.addEventListener('alpine:init', () => {
  registerMarkdownEditor(window.Alpine, { previewUrl: '/markdown/preview' })
})
```

The markup calls the factory by name, passing per-instance copy:

```html
<div x-data="markdownEditorData({ initialMarkdown: '…', emptyHtml: '…' })">
```

`previewUrl` is where the Preview toggle POSTs `body_md` (form-encoded) and
reads the rendered HTML back.

## Local development across repos

Editing this package while running an app? Point the app at the working copy
instead of the pinned tag:

```jsonc
// app package.json
"pnpm": {
  "overrides": {
    "@ybbuc/markdown-editor": "link:../markdown-editor"
  }
}
```

Remove the override before committing.

## Releasing an update

Bump `version`, commit, tag, push, then `pnpm update @ybbuc/markdown-editor`
in each consumer. Consumers pin a tag so builds stay reproducible.
