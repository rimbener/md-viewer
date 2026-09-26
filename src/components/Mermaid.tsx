/**
 * One ```mermaid fence, drawn by Mermaid inside a web view.
 *
 * The page reports its height. Until then a short block is reserved. A page
 * that fails, or that never reports, yields to the caller, which shows the
 * fence as source.
 */

import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

import {
  publishMermaidPage,
  removeMermaidPage,
  type PublishedPage,
} from '../mermaidAsset';
import { parseMermaidResult } from '../mermaidPage';

const RENDER_WAIT_MS = 8_000;

const RESERVE_HEIGHT = 64;

type MermaidProps = {
  html: string;
  spacing: number;
  background: string;
  onFail: () => void;
};

let sequence = 0;

/** macOS reports a file URL with or without a `localhost` host. */
function sameDirectory(url: string, readAccessUrl: string): boolean {
  const path = (value: string) =>
    decodeURI(value.replace(/^file:\/\/(localhost)?/, ''));
  return path(url).startsWith(path(readAccessUrl));
}

export function Mermaid({ html, spacing, background, onFail }: MermaidProps) {
  const name = useRef('');
  if (name.current === '') {
    sequence += 1;
    name.current = `d${sequence}`;
  }
  const revision = useRef(0);
  const fail = useRef(onFail);
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uri = useRef<string | null>(null);
  const [published, setPublished] = useState<PublishedPage | null>(null);
  const [height, setHeight] = useState(RESERVE_HEIGHT);
  fail.current = onFail;

  useEffect(() => {
    let cancelled = false;
    const pageName = `${name.current}-${(revision.current += 1)}`;
    // A diagram that never reports a size falls back to source.
    wait.current = setTimeout(() => fail.current(), RENDER_WAIT_MS);

    publishMermaidPage(html, pageName)
      .then(next => {
        if (cancelled) {
          removeMermaidPage(next.uri).catch(() => undefined);
          return;
        }
        uri.current = next.uri;
        setPublished(next);
      })
      .catch(() => {
        if (!cancelled) {
          fail.current();
        }
      });

    return () => {
      cancelled = true;
      if (wait.current !== null) {
        clearTimeout(wait.current);
        wait.current = null;
      }
      const current = uri.current;
      uri.current = null;
      setPublished(null);
      if (current !== null) {
        removeMermaidPage(current).catch(() => undefined);
      }
    };
  }, [html]);

  const frame = {
    height,
    backgroundColor: background,
    marginBottom: spacing,
  };

  if (published === null) {
    return <View style={frame} />;
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{ uri: published.uri }}
      allowingReadAccessToURL={published.readAccessUrl}
      scrollEnabled={false}
      onShouldStartLoadWithRequest={(request): boolean =>
        sameDirectory(request.url, published.readAccessUrl)
      }
      onMessage={(event: WebViewMessageEvent): void => {
        const result = parseMermaidResult(event.nativeEvent.data);
        if (!result.ok) {
          fail.current();
          return;
        }
        if (wait.current !== null) {
          clearTimeout(wait.current);
          wait.current = null;
        }
        setHeight(result.height);
      }}
      onError={() => fail.current()}
      style={frame}
    />
  );
}
