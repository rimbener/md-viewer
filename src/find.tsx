/**
 * Marks hits while the document renders, in the order the text is visited.
 * The count is read after that visit, from the same counter the marks used.
 */

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { Text, type ScrollView, type View } from 'react-native';

import { MAX_MATCHES, splitMatches } from './search';
import { useTheme } from './theme';

/** Space left above the current hit when the view scrolls to it. */
const REVEAL_MARGIN = 48;

type Measurable = {
  measureLayout?: (
    relativeTo: object,
    onSuccess: (x: number, y: number) => void,
    onFail?: () => void,
  ) => void;
};

type Scrollable = {
  scrollTo?: (options: { y: number; animated: boolean }) => void;
};

type FindContextValue = {
  query: string;
  active: number;
  contentRef: RefObject<View | null>;
  scrollRef: RefObject<ScrollView | null>;
  remaining: () => number;
  claim: () => number;
  cap: () => void;
};

const FindContext = createContext<FindContextValue | null>(null);

type FindProviderProps = {
  query: string;
  active: number;
  contentRef: RefObject<View | null>;
  scrollRef: RefObject<ScrollView | null>;
  onCount: (count: number, capped: boolean) => void;
  children: ReactNode;
};

export function FindProvider({
  query,
  active,
  contentRef,
  scrollRef,
  onCount,
  children,
}: FindProviderProps) {
  // Reset before children render. They fill it; the effect below reads it.
  const counter = useRef({ n: 0, capped: false });
  counter.current = { n: 0, capped: false };

  const remaining = useCallback(
    () => Math.max(0, MAX_MATCHES - counter.current.n),
    [],
  );
  const claim = useCallback(() => {
    if (counter.current.n >= MAX_MATCHES) {
      counter.current.capped = true;
      return -1;
    }
    const index = counter.current.n;
    counter.current.n += 1;
    return index;
  }, []);
  const cap = useCallback(() => {
    counter.current.capped = true;
  }, []);

  const value: FindContextValue = {
    query,
    active,
    contentRef,
    scrollRef,
    remaining,
    claim,
    cap,
  };

  useEffect(() => {
    onCount(counter.current.n, counter.current.capped);
  });

  return <FindContext.Provider value={value}>{children}</FindContext.Provider>;
}

/** With no query the run stays a plain string, not an extra element. */
export function useShowText(): (text: string, key?: number) => ReactNode {
  const find = useContext(FindContext);
  const marking = find !== null && find.query.length > 0;
  return (text: string, key?: number) =>
    marking ? <MarkedRuns key={key} text={text} /> : text;
}

type MarkedRunsProps = {
  text: string;
};

function MarkedRuns({ text }: MarkedRunsProps) {
  const find = useContext(FindContext);
  if (find === null || find.query.length === 0) {
    return <>{text}</>;
  }

  const room = find.remaining();
  if (room === 0) {
    if (text.toLowerCase().includes(find.query.toLowerCase())) {
      find.cap();
    }
    return <>{text}</>;
  }

  const { parts, more } = splitMatches(text, find.query, room);
  if (more) {
    find.cap();
  }

  return (
    <>
      {parts.map((part, index) => {
        if (!part.match) {
          return <Fragment key={index}>{part.text}</Fragment>;
        }
        const hit = find.claim();
        if (hit < 0) {
          return <Fragment key={index}>{part.text}</Fragment>;
        }
        return <Hit key={index} text={part.text} index={hit} />;
      })}
    </>
  );
}

type HitProps = {
  text: string;
  index: number;
};

function Hit({ text, index }: HitProps) {
  const theme = useTheme();
  const find = useContext(FindContext);
  const ref = useRef<Measurable>(null);
  const isActive = find !== null && index === find.active;
  const contentRef = find?.contentRef;
  const scrollRef = find?.scrollRef;

  const reveal = useCallback(() => {
    if (!isActive || contentRef == null || scrollRef == null) {
      return;
    }
    const node = ref.current;
    const content = contentRef.current;
    const scroll = scrollRef.current as Scrollable | null;
    if (node === null || content === null || scroll === null) {
      return;
    }
    if (typeof node.measureLayout !== 'function') {
      return;
    }
    if (typeof scroll.scrollTo !== 'function') {
      return;
    }
    node.measureLayout(
      content,
      (_x, y) => {
        scroll.scrollTo?.({
          y: Math.max(0, y - REVEAL_MARGIN),
          animated: true,
        });
      },
      () => {},
    );
  }, [contentRef, isActive, scrollRef]);

  useEffect(() => {
    reveal();
  }, [reveal]);

  return (
    <Text
      ref={ref as never}
      onLayout={isActive ? reveal : undefined}
      style={{
        backgroundColor: isActive ? theme.searchCurrent : theme.searchHit,
      }}
    >
      {text}
    </Text>
  );
}
