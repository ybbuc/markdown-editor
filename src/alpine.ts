// Alpine runtime types shared with the editor factory.
//
// This package deliberately does NOT declare the `window.Alpine` global.
// Consumers own that augmentation (and pass their Alpine instance to
// registerMarkdownEditor), which avoids two competing `Window.Alpine`
// declarations when the package sits next to an app's own Alpine typing.

export type AlpineMagics<T> = {
  $watch: <K extends keyof T>(
    property: K,
    callback: (next: T[K], prev: T[K]) => void,
  ) => void
  $nextTick: (callback?: () => void) => Promise<void>
  $refs: Record<string, HTMLElement>
  $root: HTMLElement
  $el: HTMLElement
  $dispatch: (event: string, detail?: unknown) => void
}

// ThisType is what makes `this.$refs`, `this.$watch`, … typecheck inside a
// factory's methods while T still infers from the returned literal.
export type AlpineComponent<T> = T &
  ThisType<T & AlpineMagics<T>> & { init?(): void; destroy?(): void }

export type AlpineGlobal = {
  data: <T, A extends unknown[]>(
    name: string,
    factory: (...args: A) => AlpineComponent<T>,
  ) => void
}
