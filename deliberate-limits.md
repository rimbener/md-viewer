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

## Read-only

There is no editing, no search, and no export. The viewer displays what is on
disk and nothing more.
