# Deliberate Limits

Things the viewer does not do, and why. None of these are bugs; each one is a
scope decision that can be revisited.

## HTML is stripped, not rendered

Tags are discarded and their text is kept. The practical cost is that badge
images and other HTML-only content in READMEs simply vanish rather than
appearing. Rendering HTML would mean a second parser and a second renderer for
a subset of the web platform, which is a much larger project than the markdown
support itself.

## Syntax highlighting covers three languages

HTML, CSS and JavaScript/TypeScript are tinted; every other fence renders as
uniform monospace. Each language costs a hand-written tokeniser, so the list
grows one language at a time rather than by taking a dependency.

The highlighter is shallow on purpose. It marks lexical categories, not
meaning: a name is tinted as a call because a `(` follows it, not because it is
a function, and types, classes and variables are all plain text. JSX is read as
JavaScript, so `<View>` in a `tsx` fence gets no tag colour. A `${…}`
interpolation is found by counting braces, so a `}` inside a string inside an
interpolation closes it early.

Gherkin remains the one fence that is not highlighted but *laid out*, and it
earns that by not being code: a `gherkin` fence is a document about behaviour,
its grammar is a dozen keywords, and the payoff is a feature rather than tinted
source.

## Gherkin is read, not checked

The Gherkin reader never rejects anything. A line it does not recognise becomes
description text, so a misspelled keyword shows up as prose rather than as an
error. That is the right trade for a viewer, but it does mean the viewer is no
substitute for running Cucumber.

Only the English keywords are known, and only as Gherkin capitalises them. A
`# language: fr` header is shown as the comment it is and otherwise ignored,
and a lowercase `given` stays prose, because description lines that open with
an ordinary "and" or "given" are far more common than uncapitalised steps.

Gherkin is also only reached through a fenced block inside a markdown document.
A standalone `.feature` file is not shown at all, because the folder scan only
collects `.md` and `.mdc` files.

## Images only render as blocks

An image renders as a picture when it is alone in its paragraph. An image mixed
into a sentence falls back to its alt text, because an inline image has to be
measured and baseline-aligned inside a run of text.

## Relative links are inert

A link to another `.md` file is styled as a link but does nothing when clicked.
Only links with a scheme — `https:`, `mailto:` and so on — are handed to the
system. Making relative links select the target file in the sidebar tree is the
obvious next step.

## Large files fall back to plain text

Documents over 500,000 characters are shown as monospace plain text with a
notice, rather than parsed. Parsing runs on the UI thread, and past that size a
document is almost certainly not prose.

## Not a CommonMark implementation

The parser covers the constructs that appear in real documents, not the full
specification. Known gaps include HTML blocks as block-level constructs, link
titles (parsed only so they can be skipped), and the finer points of emphasis
delimiter matching in ambiguous cases such as `**a*b**`.

## Only one folder is remembered, and only the last one

The last folder and file are remembered and reopened on the next launch. That
stores a *path*, which is not the same as storing *permission*: the sandboxed
build reaches a folder through the `NSOpenPanel` the person picked it with, and
that grant dies with the process.

A security-scoped bookmark is the grant written down. `FolderAccess.mm` makes
one while the panel's grant is still live, stores it beside the path, and
resolves it at startup — so the folder reopens, and it reopens even if it moved,
because a bookmark follows the folder rather than the path. Access is held for
as long as that folder is open and given up when another is chosen.

Only the last folder is kept. There is no list of recent folders and no way to
hold two open at once, so picking a new folder gives up the old grant. When a
bookmark no longer resolves — the folder was deleted, or the grant was revoked —
the degradation is graceful: the app falls back to the folder dialog exactly as
it would on a first run.

## Edits are never written to disk

The source editor changes what the viewer renders, not the file. A document's
buffer is kept for as long as the app is running, so switching to another file
and back does not lose it, but quitting does and there is no save, no undo
history beyond the text field's own, and no prompt on the way out. The header
says `edited, not saved` whenever a buffer has diverged from disk.

Writing is the obvious next step, and it is a larger change than it looks: it
needs a save command, a decision about what to do when the file has changed
underneath the buffer, and a wider sandbox grant, because the entitlements ask
only for read-only access to what the person picked. Nothing can be written
even while the folder is open.

## The preview trails the typing by a moment

The editor takes every keystroke, but the preview waits 150 ms after the last
one and then rebuilds from the whole source. A burst of typing therefore parses
once instead of once per character, and the document still follows closely
enough to read as live. There is no incremental parse: the debounce makes the
work less frequent, not smaller, so a document of a few hundred thousand
characters still types roughly. Past 500,000 characters the editor is disabled
outright, because that document is already falling back to plain text.

## No search and no export

The viewer displays what is on disk, and now what you have typed over it, and
nothing more.
