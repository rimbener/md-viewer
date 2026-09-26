/**
 * Marks hits while the document renders, in the order the text is visited.
 * The count is read after that visit, from the same counter the marks used.
 * The scroll uses the block that owns the hit: a nested Text has no frame.
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
import {
  Text,
  type NativeSyntheticEvent,
  type ScrollView,
  type TextLayoutEventData,
  type TextProps,
  type View,
} from 'react-native';

import { lineOffsetY, MAX_MATCHES, splitMatches } from './search';
import { useTheme } from './theme';

/** Space left above the current hit when the view scrolls to it. */
const REVEAL_MARGIN = 48;

type LineBox = { text: string; y: number };

type HitPlace = { blockId: number; offset: number };

type BlockRecord = {
  source: string;
  origin: number | null;
  lines: LineBox[];
};

type Measurable = {
  measureLayout?: (
    relativeTo: object,
    onSuccess: (x: number, y: number, width: number, height: number) => void,
    onFail?: () => void,
  ) => void;
};

type FindContextValue = {
  query: string;
  active: number;
  contentRef: RefObject<View | null>;
  scrollRef: RefObject<ScrollView | null>;
  remaining: () => number;
  claim: () => number;
  cap: () => void;
  note: (index: number, blockId: number, offset: number) => void;
  setSource: (blockId: number, source: string) => void;
  setLines: (blockId: number, lines: LineBox[]) => void;
  setOrigin: (blockId: number, origin: number) => void;
};

const FindContext = createContext<FindContextValue | null>(null);

type FindBlockValue = {
  id: number;
  source: { current: string };
};

const FindBlockContext = createContext<FindBlockValue | null>(null);

let nextBlockId = 1;

function useBlockId(): number {
  const id = useRef(0);
  if (id.current === 0) {
    id.current = nextBlockId;
    nextBlockId += 1;
  }
  return id.current;
}

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

  const book = useRef({
    places: new Map<number, HitPlace>(),
    blocks: new Map<number, BlockRecord>(),
  });
  book.current.places = new Map();

  const activeRef = useRef(active);
  activeRef.current = active;

  const reveal = useCallback(() => {
    const scroll = scrollRef.current;
    if (scroll == null || typeof scroll.scrollTo !== 'function') {
      return;
    }
    const place = book.current.places.get(activeRef.current);
    if (place == null) {
      return;
    }
    const block = book.current.blocks.get(place.blockId);
    if (block == null || block.origin == null) {
      return;
    }
    const lineY = lineOffsetY(block.source, block.lines, place.offset);
    if (lineY == null) {
      return;
    }
    scroll.scrollTo({
      x: 0,
      y: Math.max(0, block.origin + lineY - REVEAL_MARGIN),
      animated: true,
    });
  }, [scrollRef]);

  const revealRef = useRef(reveal);
  revealRef.current = reveal;

  const blockFor = useCallback((blockId: number): BlockRecord => {
    const found = book.current.blocks.get(blockId);
    if (found != null) {
      return found;
    }
    const created: BlockRecord = { source: '', origin: null, lines: [] };
    book.current.blocks.set(blockId, created);
    return created;
  }, []);

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
  const note = useCallback((index: number, blockId: number, offset: number) => {
    book.current.places.set(index, { blockId, offset });
  }, []);
  const setSource = useCallback(
    (blockId: number, source: string) => {
      const block = blockFor(blockId);
      if (block.source === source) {
        return;
      }
      block.source = source;
      revealRef.current();
    },
    [blockFor],
  );
  const setLines = useCallback(
    (blockId: number, lines: LineBox[]) => {
      const block = blockFor(blockId);
      if (sameLines(block.lines, lines)) {
        return;
      }
      block.lines = lines;
      revealRef.current();
    },
    [blockFor],
  );
  const setOrigin = useCallback(
    (blockId: number, origin: number) => {
      const block = blockFor(blockId);
      if (block.origin === origin) {
        return;
      }
      block.origin = origin;
      revealRef.current();
    },
    [blockFor],
  );

  const value: FindContextValue = {
    query,
    active,
    contentRef,
    scrollRef,
    remaining,
    claim,
    cap,
    note,
    setSource,
    setLines,
    setOrigin,
  };

  useEffect(() => {
    onCount(counter.current.n, counter.current.capped);
  });

  useEffect(() => {
    revealRef.current();
  }, [active, query]);

  return <FindContext.Provider value={value}>{children}</FindContext.Provider>;
}

function sameLines(left: LineBox[], right: LineBox[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (
      left[index].y !== right[index].y ||
      left[index].text !== right[index].text
    ) {
      return false;
    }
  }
  return true;
}

type FindTextProps = TextProps;

/** A text block Find can scroll to. Nested text stays inside it. */
export function FindText({ onTextLayout, ...rest }: FindTextProps) {
  const find = useContext(FindContext);
  const id = useBlockId();
  const source = useRef('');
  const hostRef = useRef<Measurable>(null);
  source.current = '';

  const block = useRef<FindBlockValue>({ id, source });
  block.current.id = id;

  const measure = useCallback(() => {
    const node = hostRef.current;
    const content = find?.contentRef.current;
    if (node == null || content == null || find == null) {
      return;
    }
    if (typeof node.measureLayout !== 'function') {
      return;
    }
    node.measureLayout(
      content,
      (_x, y) => {
        find.setOrigin(id, y);
      },
      () => {},
    );
  }, [find, id]);

  useEffect(() => {
    if (find == null || find.query.length === 0) {
      return;
    }
    find.setSource(id, source.current);
    measure();
  }, [find, id, measure]);

  const handleLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    onTextLayout?.(event);
    if (find == null) {
      return;
    }
    find.setLines(
      id,
      event.nativeEvent.lines.map(line => ({ text: line.text, y: line.y })),
    );
  };

  return (
    <FindBlockContext.Provider value={block.current}>
      <Text {...rest} ref={hostRef as never} onTextLayout={handleLayout} />
    </FindBlockContext.Provider>
  );
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
  const block = useContext(FindBlockContext);
  if (find === null || find.query.length === 0) {
    return <>{text}</>;
  }

  const start = block === null ? 0 : block.source.current.length;
  if (block !== null) {
    block.source.current += text;
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

  let local = 0;
  return (
    <>
      {parts.map((part, index) => {
        const offset = start + local;
        local += part.text.length;
        if (!part.match) {
          return <Fragment key={index}>{part.text}</Fragment>;
        }
        const hit = find.claim();
        if (hit < 0) {
          return <Fragment key={index}>{part.text}</Fragment>;
        }
        if (block !== null) {
          find.note(hit, block.id, offset);
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
  const isActive = find !== null && index === find.active;

  return (
    <Text
      style={{
        backgroundColor: isActive ? theme.searchCurrent : theme.searchHit,
      }}
    >
      {text}
    </Text>
  );
}
