# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) or to other AI agents when working with code in this repository.

In all interactions and commit messages, be extremely concise and sacrifice grammar for the sake of concision. Always use ASD-STE100 (Simplified Technical English) for explanations, documentation, etc.

## What this is

A macOS markdown viewer built with react-native-macos: a tree of `.md` files on
the left, the rendered document on the right. The markdown parser, the Gherkin
reader and the syntax highlighter are all hand-written — there is no markdown,
highlighting or styling dependency, and adding one is a real decision rather
than a detail.

## Commands

```sh
npm start                       # Metro dev server
npm run macos                   # build and run the macOS app (the primary target)
npm run build:macos             # Debug build without launching
pod install --project-directory=macos   # after a fresh clone or a native dependency change

npm test                        # jest, the whole suite
npx jest __tests__/highlight.test.ts    # one file
npx jest -t 'tells a regex literal'     # one test by name
npm run lint                    # eslint
npx tsc --noEmit                # typecheck; there is no npm script for it
npx prettier --write <paths>    # formatting, enforced by the eslint config
```

Open `macos/MdViewer.xcworkspace` — the workspace, not the `.xcodeproj` — to
build from Xcode. `react-native` is pinned to 0.81.6 because that is the exact
version `react-native-macos@0.81.9` peers against; bump both together or
neither.

## Architecture

`App.tsx` owns the session: the chosen folder, the scanned tree, the selected
file, and sidebar visibility. `src/scanDirectory.ts` walks the folder and
returns a tree of _only_ markdown files and the directories leading to them
(machine directories skipped, empty branches pruned, depth capped).
`src/components/DocumentPanel.tsx` owns everything about one document — reading
it, zoom, font scheme, the editor pane — and `src/components/Markdown.tsx`
renders the parsed result with stock react-native primitives.

### The three readers

`src/markdown/` (blocks and inline), `src/gherkin.ts` and `src/highlight.ts`
are independent, dependency-free, and share one discipline that every change to
them must preserve:

- **Nothing is rejected.** Unrecognised input degrades into plain text rather
  than an error, so a half-written document still renders.
- **Every scan is bounded**, so no input can hang the UI thread.
- **The output reconstructs the input.** Highlighter tokens concatenate back
  into the source exactly; the tests assert this against fuzzed input, as do
  the parser's.

A fenced block is dispatched in `Markdown.tsx`: a `gherkin`/`feature`/
`cucumber` fence is _laid out_ as a feature by `Gherkin.tsx`, a fence whose
language `languageOf()` recognises is tinted token by token, and anything else
stays uniform monospace.

### Styling

There is no style library and no inline color literals outside
`src/theme.ts`. `useTheme()` returns the light or dark palette for the system
appearance; every component reads its colors from that object. New rendering
features add named palette entries rather than hardcoding a color.

`src/typography.ts` is why sizes look the way they do: each font scheme carries
a `scale` measured from the family's x-height (so schemes look the same size at
the same point size) and an `advance` (average character width in ems) that
turns a target line length in characters into the column width in pixels. Only
macOS system fonts are used. `Markdown.tsx` derives every size from
`zoom * scheme.<role>.scale` inside one memoized `createStyles`, handed down
through a context — so changing the zoom rebuilds one stylesheet rather than
touching each element.

### Persistence and editing

`src/preferences.ts` wraps AsyncStorage and is deliberately best-effort: a
failed read falls back to the default, a failed write is dropped, and stored
values are validated on the way in (`isZoomLevel`, `isSchemeId`, absolute-path
checks). Components that restore a preference guard against a race with the
person using the app: a `hasChosen*` ref means a stored value never overwrites
a choice made while the read was in flight. Copy that pattern for new
preferences.

Editing is in-memory only. `DocumentPanel` keeps a `Map` of drafts keyed by
path in a ref, so switching files and back keeps the work, and quitting loses
it. The preview reparses on every keystroke, with no debounce, and documents
over 500,000 characters fall back to plain text with the editor disabled.

## Conventions

`.agents/rules/global.mdc` applies here and is the authority; the parts that
come up most:

- **No comments by default.** Add one short line only when the _why_ is
  non-obvious — a hidden constraint or subtle invariant — never to describe
  what the code does. One invariant, one comment, next to the code that owns
  it.
- **Never `export default`.** `App.tsx` is the one exception, because
  `index.js` registers it.
- Functional React only, no Redux.
- Don't touch `Gemfile`, `Podfile`, `package.json` or lockfiles unless the
  change is itself a dependency change.
- Commit messages are extremely concise, in the imperative
  (`feat(code): highlight html, css and js/ts fences`).

## Keep the scope documents current

`what-it-handles.md` and `deliberate-limits.md` are the specification of what
this viewer does and what it refuses to do, written as prose with reasons. They
are not stale README material — a change to what is parsed, rendered or
highlighted belongs in them in the same commit, either as new capability or as
a narrowed limit.

## Tests

Jest with `react-test-renderer`. `jest.setup.js` mocks the three native
modules (file system, document picker, AsyncStorage), so tests can render `App`
and `DocumentPanel` directly. Pure modules get unit tests that assert against a
compact text rendering of the tree rather than deep object literals — see the
`outline()` helpers in `parseBlocks.test.ts` and `gherkin.test.ts`, and
`marks()` in `highlight.test.ts`. View tests assert colors and sizes through
`StyleSheet.flatten` on a found `Text`. Readers also get an invariant test over
fuzzed input.

REMEMBER: In all interactions and commit messages, be extremely concise and sacrifice grammar for the sake of concision. ALWAYS use ASD-STE100 (Simplified Technical English) for explanations, documentation, etc.
