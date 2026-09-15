# Deliberate Limits

Things the viewer does not do, and why. None of these are bugs; each one is a
scope decision that can be revisited.

## HTML is stripped, not rendered

Tags are discarded and their text is kept. The practical cost is that badge
images and other HTML-only content in READMEs simply vanish rather than
appearing. Rendering HTML would mean a second parser and a second renderer for
a subset of the web platform, which is a much larger project than the markdown
support itself.

## No syntax highlighting

Fenced code blocks keep their language tag in the syntax tree, but render as
uniform monospace text. Highlighting needs a per-language tokenizer, which is
either a sizeable dependency or a lot of hand-written code.

Gherkin is the one exception, and it earns it by not being code: a `gherkin`
fence is a document about behaviour, its grammar is a dozen keywords, and the
payoff is a laid-out feature rather than tinted source.

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
collects `.md` files.

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

## Restored folders assume an unsandboxed build

The last folder and file are remembered in AsyncStorage and reopened on the
next launch. That stores a *path*, which is not the same as storing
*permission*.

The Debug build is not sandboxed — its signed entitlements are only
`get-task-allow` — so a restored path can simply be read. A sandboxed Release
build is a different matter: macOS grants access to a folder through the
`NSOpenPanel` the person picked it with, and that grant does not survive
relaunching. Persisting it properly needs security-scoped bookmarks, which
means resolving a bookmark at startup and holding the access for as long as the
folder is open.

Until that exists, the degradation is at least graceful: the existence check on
the stored folder fails, and the app falls back to the folder dialog exactly as
it would on a first run.

## Edits are never written to disk

The source editor changes what the viewer renders, not the file. A document's
buffer is kept for as long as the app is running, so switching to another file
and back does not lose it, but quitting does and there is no save, no undo
history beyond the text field's own, and no prompt on the way out. The header
says `edited, not saved` whenever a buffer has diverged from disk.

Writing is the obvious next step, and it is a larger change than it looks: it
needs a save command, a decision about what to do when the file has changed
underneath the buffer, and — in a sandboxed build — the same security-scoped
bookmark problem described above, except that failing to resolve it would cost
someone their work rather than just their folder.

## The document reparses on every keystroke

There is no debounce: the preview is rebuilt from the whole source each time it
changes, which is what makes it feel live. Parsing is fast enough for prose,
but a document of a few hundred thousand characters will type roughly. Past
500,000 characters the editor is disabled outright, because that document is
already falling back to plain text.

## No search and no export

The viewer displays what is on disk, and now what you have typed over it, and
nothing more.
