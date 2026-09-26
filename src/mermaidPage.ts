/**
 * The HTML page a ```mermaid fence is drawn in.
 *
 * Mermaid itself runs only inside that page. This module builds the page and
 * reads the size message the page posts back. It never loads Mermaid.
 */

import type { Theme } from './theme';
import { BODY_SIZE } from './typography';

/** Mermaid's own default. A longer fence is shown as source. */
export const MERMAID_TEXT_CAP = 50_000;

export type MermaidPageOptions = {
  theme: Theme;
  /** Zoom factor; 1 is the natural size. */
  scale: number;
  /** The body face's x-height scale, so the diagram matches the prose. */
  bodyScale: number;
  /** Unset means the macOS system font. */
  fontFamily?: string;
};

export type MermaidResult = { ok: true; height: number } | { ok: false };

export function isMermaid(language: string | null): boolean {
  return language !== null && language.toLowerCase() === 'mermaid';
}

/** The page, or null when the fence is over the cap and must stay source. */
export function mermaidPage(
  text: string,
  options: MermaidPageOptions,
): string | null {
  if (text.length > MERMAID_TEXT_CAP) {
    return null;
  }

  const fontSize =
    Math.round(BODY_SIZE * options.scale * options.bodyScale * 2) / 2;
  const config = {
    background: options.theme.background,
    init: {
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      maxTextSize: MERMAID_TEXT_CAP,
      secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize'],
      theme: 'base',
      fontFamily: options.fontFamily ?? '-apple-system',
      fontSize,
      themeVariables: {
        background: options.theme.background,
        primaryColor: options.theme.code,
        primaryTextColor: options.theme.text,
        primaryBorderColor: options.theme.border,
        lineColor: options.theme.mutedText,
        secondaryColor: options.theme.sidebar,
        tertiaryColor: options.theme.sidebar,
        textColor: options.theme.text,
        mainBkg: options.theme.code,
        nodeBorder: options.theme.border,
        clusterBkg: options.theme.sidebar,
        titleColor: options.theme.text,
        actorBkg: options.theme.code,
        actorBorder: options.theme.border,
        actorTextColor: options.theme.text,
        signalColor: options.theme.accent,
        noteBkgColor: options.theme.sidebar,
        noteTextColor: options.theme.text,
        noteBorderColor: options.theme.border,
      },
    },
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; overflow-x: auto; overflow-y: hidden; }
  #out svg { display: block; }
</style>
</head>
<body>
<div id="out"></div>
<script src="mermaid.min.js"></script>
<script>
  const config = ${embed(config)};
  const source = ${embed(text)};
  document.body.style.background = config.background;
  function post(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }
  if (typeof mermaid === 'undefined') {
    post({ ok: false });
  } else {
    mermaid.initialize(config.init);
    mermaid.render('diagram', source).then(function (result) {
      var out = document.getElementById('out');
      out.innerHTML = result.svg;
      requestAnimationFrame(function () {
        post({ ok: true, height: Math.ceil(out.getBoundingClientRect().height) });
      });
    }).catch(function () {
      post({ ok: false });
    });
  }
</script>
</body>
</html>
`;
}

export function parseMermaidResult(data: string): MermaidResult {
  try {
    const payload = JSON.parse(data) as { ok?: unknown; height?: unknown };
    if (
      payload.ok === true &&
      typeof payload.height === 'number' &&
      payload.height > 0
    ) {
      return { ok: true, height: payload.height };
    }
  } catch {
    return { ok: false };
  }
  return { ok: false };
}

/** A `<` inside the string would close the script element that holds it. */
function embed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
