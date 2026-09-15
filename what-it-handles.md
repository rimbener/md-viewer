# What It Handles

The markdown support in this viewer is hand-written: `src/markdown/parseBlocks.ts`
turns a document into blocks, `src/markdown/parseInline.ts` turns the text inside
them into spans, and `src/components/Markdown.tsx` renders the result with stock
react-native components. No markdown dependency is involved.

## Blocks

| Syntax | Notes |
| --- | --- |
| `# Heading` … `###### Heading` | Closing `#`s are optional and trimmed |
| `Heading` over `===` or `---` | Setext headings, levels 1 and 2 |
| Paragraphs | Soft line breaks collapse to a space |
| Two trailing spaces, or a trailing `\` | Hard break — the newline is kept |
| ` ```lang ` fenced code | Runs to the end of the document if never closed |
| Four-space indented code | Language is unset |
| `> quoted` | Nests, and supports lazy continuation lines |
| `- item`, `* item`, `+ item` | Nested lists at any depth |
| `1. item`, `3) item` | The starting number is preserved |
| `---`, `***`, `___` | Thematic rules |
| GFM tables | `:--`, `:-:` and `--:` set per-column alignment |
| `---` front matter | Stripped, not rendered |

Lists are classified as *tight* or *loose*: a blank line between two items, or
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

## Performance

Parsing `react-native/README.md` (6.5 KB) takes about 1 ms. The parser is
also fuzzed against randomized markdown-marker input to confirm it always
terminates.
