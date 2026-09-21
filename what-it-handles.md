# What It Handles

The markdown support in this viewer is hand-written: `src/markdown/parseBlocks.ts`
turns a document into blocks, `src/markdown/parseInline.ts` turns the text inside
them into spans, and `src/components/Markdown.tsx` renders the result with stock
react-native components. No markdown dependency is involved.

## Blocks

| Syntax                                 | Notes                                           |
| -------------------------------------- | ----------------------------------------------- |
| `# Heading` … `###### Heading`         | Closing `#`s are optional and trimmed           |
| `Heading` over `===` or `---`          | Setext headings, levels 1 and 2                 |
| Paragraphs                             | Soft line breaks collapse to a space            |
| Two trailing spaces, or a trailing `\` | Hard break — the newline is kept                |
| ` ```lang ` fenced code                | Runs to the end of the document if never closed |
| Four-space indented code               | Language is unset                               |
| `> quoted`                             | Nests, and supports lazy continuation lines     |
| `- item`, `* item`, `+ item`           | Nested lists at any depth                       |
| `1. item`, `3) item`                   | The starting number is preserved                |
| `---`, `***`, `___`                    | Thematic rules                                  |
| GFM tables                             | `:--`, `:-:` and `--:` set per-column alignment |
| `---` front matter                     | Stripped, not rendered                          |

Lists are classified as _tight_ or _loose_: a blank line between two items, or
between blocks inside one item, adds vertical spacing to the whole list. That
matches how the same document reads on GitHub.

## Inline

- `**bold**`, `*italic*`, `***both***`, `~~strikethrough~~`
- `` `code` ``, and ``` ``a ` b`` ``` when the content itself holds a backtick
- `[text](url "title")` links, plus `[text][ref]`, `[ref][]` and `[ref]` resolved
  against `[ref]: url` definitions — the definition lines are removed from the
  rendered output
- `![alt](path)` images
- `<https://example.com>` and `<me@example.com>` autolinks
- Bare `https://…` URLs, without swallowing the trailing sentence punctuation
- Backslash escapes, so `\*not emphasis\*` stays literal
- HTML entities: `&amp;`, `&lt;`, `&nbsp;`, `&#65;`, `&#x41;` and friends

Underscores inside words are left alone, so `some_long_name` survives intact
while `_emphasised_` still works.

## Syntax highlighting

A fence tagged with one of these languages is tokenised and tinted. Every other
fence renders as uniform monospace.

| Fence                                   | Read as    |
| --------------------------------------- | ---------- |
| `html`, `htm`                           | HTML       |
| `css`                                   | CSS        |
| `js`, `jsx`, `mjs`, `cjs`, `javascript` | JavaScript |
| `ts`, `tsx`, `typescript`               | TypeScript |

- **HTML** — tag names, attribute names and values, comments, doctypes and
  `&entities;`. The body of `<script>` and `<style>` goes to the JavaScript and
  CSS readers, so an inline stylesheet is highlighted as the stylesheet it is.
- **CSS** — selectors, property names, values, at-rules, the `(min-width: 40em)`
  condition of an at-rule, `!important`, strings and comments. A block opened by
  `@media`, `@supports`, `@layer`, `@container`, `@scope`, `@document` or
  `@keyframes` holds rules; every other block holds declarations.
- **JavaScript and TypeScript** — keywords, including the TypeScript ones,
  literals, numbers, names being called, both comment forms, strings, regex
  literals, and template literals, whose `${…}` is tokenised as the code it is.
  A `/` is read as a regex only where a value cannot stand, and a regex never
  crosses a line, so a division is never mistaken for one.

Seven colours carry the tokens — comment, keyword, string, constant, tag,
attribute and name being called — and each has a light and a dark value.

Like the Gherkin reader, the highlighter is a _reader_: it rejects nothing, its
scans are all bounded, and the tokens always concatenate back into the source,
so a half-written or mis-tagged block still renders as itself.

## Gherkin

A fenced block tagged `gherkin`, `feature` or `cucumber` is read as a feature
file and laid out instead of being printed as source. Gherkin is meant to read
as prose, so it is set in the body font. The code font is kept for the parts
that stand in for a value, and for the step keywords, which are fixed
vocabulary rather than prose.

| Syntax                                     | Rendered as                                       |
| ------------------------------------------ | ------------------------------------------------- |
| `Feature:`, `Business Need:`, `Ability:`   | A labelled heading                                |
| `Rule:`                                    | A subheading, with its scenarios grouped under it |
| `Scenario:`, `Example:`, `Background:`     | A card                                            |
| `Scenario Outline:`, `Scenario Template:`  | A card                                            |
| `Examples:`, `Scenarios:`                  | A labelled table with a header row                |
| `Given`, `When`, `Then`, `And`, `But`, `*` | A step, monospace keyword in a gutter             |
| `@tag`                                     | A chip above the section it decorates             |
| A `\|` table under a step                  | A data table, with no header row                  |
| `"""` doc strings                          | An indented monospace block                       |
| `# comment`                                | A muted line                                      |
| Anything else                              | Description text, kept as written                 |

Inside a step or a table cell, `<outline parameters>` and `"quoted strings"`
are picked out and coloured, because those are the two things a scenario varies
by. Tags stack: several tag lines above one scenario all belong to it.

Sections close by rank, so a `Scenario:` ends at the next `Scenario:` or `Rule:`
without needing a blank line, and an `Examples:` block belongs to the scenario
above it.

## Raw HTML

HTML is not rendered, but its tags are dropped rather than displayed, so an
HTML-wrapped heading in a README reads as its own text instead of showing
`<h1 align="center">` literally. `<br>` becomes a line break, comments are
removed, and a paragraph left holding nothing but whitespace disappears.

## Images

An image gets its own block when it is the only thing in a paragraph. Its
intrinsic size is measured before rendering, and it scales down to the panel
width without ever growing past its natural size. Relative paths resolve
against the folder of the document being viewed, `/absolute` paths and
`http(s):` URLs are used as-is.

## The session

The folder and file open at the last quit are reopened at the next launch, with
no dialog. A path alone is not enough for that: the sandboxed build reaches a
folder through the open panel, and that grant ends with the process. So the
grant is stored as a security-scoped bookmark beside the path (`FolderAccess.mm`
makes it, `src/folderAccess.ts` reads it), which also means the folder is found
again after it is moved or renamed. A bookmark that no longer resolves falls
back to the folder dialog.

Zoom, the font scheme and the line length are properties of the reader: they
survive switching files and come back on the next launch.

That dialog is the app's own open panel, and it shows hidden files. The scan
walks hidden directories — `.claude`, `.github` and `.cursor` are where a lot
of specs live — so a hidden folder must also be selectable as the root.
`cmd-shift-.` still hides them again for the length of one dialog.

The scan walks three directory levels from the folder it starts at. Clicking a
folder in the tree walks that folder again, so a file deeper than three levels,
or added since the last walk of that folder, appears then. Reload walks the
open root again without asking for it. The folder is not watched.

## Performance

Parsing `react-native/README.md` (6.5 KB) takes about 1 ms. Highlighting
`src/components/Markdown.tsx` (17 KB of TSX) takes about 0.9 ms. Both are
fuzzed against randomized input — markdown markers for the parser, punctuation
for the highlighter — to confirm they always terminate.
