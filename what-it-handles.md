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

## Gherkin

A fenced block tagged `gherkin`, `feature` or `cucumber` is read as a feature
file and laid out instead of being printed as source. Gherkin is meant to read
as prose, so it is set in the body font, and only the parts that stand in for a
value keep the code font.

| Syntax | Rendered as |
| --- | --- |
| `Feature:`, `Business Need:`, `Ability:` | A labelled heading |
| `Rule:` | A subheading, with its scenarios grouped under it |
| `Scenario:`, `Example:`, `Background:` | A card |
| `Scenario Outline:`, `Scenario Template:` | A card |
| `Examples:`, `Scenarios:` | A labelled table with a header row |
| `Given`, `When`, `Then`, `And`, `But`, `*` | A step, keyword hung in a gutter |
| `@tag` | A chip above the section it decorates |
| A `\|` table under a step | A data table, with no header row |
| `"""` doc strings | An indented monospace block |
| `# comment` | A muted line |
| Anything else | Description text, kept as written |

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

## Performance

Parsing `react-native/README.md` (6.5 KB) takes about 1 ms. The parser is
also fuzzed against randomized markdown-marker input to confirm it always
terminates.
