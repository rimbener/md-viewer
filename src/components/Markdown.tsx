/**
 * Renders a parsed markdown document with stock react-native primitives.
 *
 * Blocks map onto `View`s, inline nodes onto nested `Text`s — nesting `Text`
 * is what gives us bold-inside-a-link and friends without any measuring.
 *
 * Every size is derived from a zoom factor and handed down through context, so
 * changing the zoom rebuilds one stylesheet instead of touching each element.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from 'react-native';

import { isGherkin, parseGherkin } from '../gherkin';
import { resolveUri } from '../markdown/resolveUri';
import type { Block, CellAlignment, InlineNode } from '../markdown/types';
import { useTheme, type Theme } from '../theme';
import { BODY_SIZE, schemeById, type FontScheme } from '../typography';
import { Gherkin } from './Gherkin';

/** Vertical rhythm between sibling blocks, before zoom. */
const BLOCK_SPACING = 12;

type MarkdownStyles = ReturnType<typeof createStyles>;

function createStyles(scale: number, scheme: FontScheme) {
  /** Rounds to a half pixel, which is as fine as the screen resolves. */
  const round = (value: number) => Math.round(value * 2) / 2;
  const heading = (value: number) =>
    round(value * scale * scheme.heading.scale);
  const size = (value: number) => round(value * scale * scheme.body.scale);
  const code = (value: number) => round(value * scale * scheme.code.scale);

  const headingFamily = scheme.heading.family;
  const bodyFamily = scheme.body.family;
  const codeFamily = scheme.code.family;

  const headings: Record<number, TextStyle> = {
    1: { fontSize: heading(26), lineHeight: heading(34), fontWeight: '700' },
    2: { fontSize: heading(20), lineHeight: heading(28), fontWeight: '700' },
    3: { fontSize: heading(17), lineHeight: heading(24), fontWeight: '600' },
    4: { fontSize: heading(15), lineHeight: heading(22), fontWeight: '600' },
    5: { fontSize: heading(14), lineHeight: heading(20), fontWeight: '600' },
    6: { fontSize: heading(13), lineHeight: heading(19), fontWeight: '600' },
  };
  for (const style of Object.values(headings)) {
    style.fontFamily = headingFamily;
  }

  return {
    scale,
    scheme,
    spacing: size(BLOCK_SPACING),
    headings,
    sheet: StyleSheet.create({
      paragraph: {
        fontFamily: bodyFamily,
        fontSize: size(BODY_SIZE),
        lineHeight: size(21),
      },
      headingSpacing: {
        marginTop: size(10),
      },
      headingUnderline: {
        borderBottomWidth: 1,
        paddingBottom: size(6),
      },
      strong: {
        fontWeight: '700',
      },
      emphasis: {
        fontStyle: 'italic',
      },
      strikethrough: {
        textDecorationLine: 'line-through',
      },
      inlineCode: {
        fontFamily: codeFamily,
        fontSize: code(12.5),
      },
      codeBlock: {
        borderWidth: 1,
        borderRadius: 6,
        overflow: 'hidden',
      },
      codeBlockContent: {
        padding: size(12),
      },
      codeText: {
        fontFamily: codeFamily,
        fontSize: code(12.5),
        lineHeight: code(18),
      },
      quote: {
        borderLeftWidth: 3,
        paddingLeft: size(12),
      },
      listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
      },
      looseItem: {
        marginBottom: size(BLOCK_SPACING),
      },
      tightItem: {
        marginBottom: 2,
      },
      bullet: {
        fontFamily: bodyFamily,
        width: size(18),
        fontSize: size(BODY_SIZE),
        lineHeight: size(21),
      },
      orderedBullet: {
        width: size(26),
        paddingRight: size(6),
        textAlign: 'right',
      },
      listContent: {
        flex: 1,
      },
      rule: {
        height: 1,
        marginTop: 4,
      },
      table: {
        borderWidth: 1,
        borderRadius: 6,
        overflow: 'hidden',
      },
      tableRow: {
        flexDirection: 'row',
      },
      tableCell: {
        flex: 1,
        paddingVertical: size(6),
        paddingHorizontal: size(10),
      },
      tableHeaderText: {
        fontWeight: '600',
      },
      rowDivider: {
        borderBottomWidth: 1,
      },
      cellDivider: {
        borderRightWidth: 1,
      },
      image: {
        width: '100%',
      },
    }),
  };
}

const StyleContext = createContext<MarkdownStyles>(
  createStyles(1, schemeById(null)),
);

function useStyles(): MarkdownStyles {
  return useContext(StyleContext);
}

interface MarkdownProps {
  blocks: Block[];
  /** Directory of the document, used to resolve relative image paths. */
  basePath: string;
  /** Zoom factor; 1 is the natural size. */
  scale?: number;
  /** Font scheme id; an unknown one falls back to the default. */
  schemeId?: string | null;
}

export function Markdown({
  blocks,
  basePath,
  scale = 1,
  schemeId = null,
}: MarkdownProps) {
  const scheme = useMemo(() => schemeById(schemeId), [schemeId]);
  const styles = useMemo(() => createStyles(scale, scheme), [scale, scheme]);

  return (
    <StyleContext.Provider value={styles}>
      <BlockSequence blocks={blocks} basePath={basePath} />
    </StyleContext.Provider>
  );
}

interface SequenceProps {
  blocks: Block[];
  basePath: string;
  color?: string;
}

/** Renders blocks in order, spacing all but the last one. */
function BlockSequence({ blocks, basePath, color }: SequenceProps) {
  const { spacing } = useStyles();

  return (
    <>
      {blocks.map((block, index) => (
        <BlockView
          key={index}
          block={block}
          basePath={basePath}
          color={color}
          isFirst={index === 0}
          spacing={index === blocks.length - 1 ? 0 : spacing}
        />
      ))}
    </>
  );
}

interface BlockProps {
  block: Block;
  basePath: string;
  color?: string;
  isFirst: boolean;
  spacing: number;
}

function BlockView({ block, basePath, color, isFirst, spacing }: BlockProps) {
  const theme = useTheme();
  const { sheet, headings } = useStyles();
  const textColor = color ?? theme.text;

  switch (block.kind) {
    case 'heading': {
      const underlined = block.level <= 2;
      return (
        <Text
          selectable
          style={[
            headings[block.level],
            isFirst ? null : sheet.headingSpacing,
            {
              color: block.level === 6 ? theme.mutedText : textColor,
              marginBottom: spacing,
            },
            underlined && sheet.headingUnderline,
            underlined && { borderBottomColor: theme.border },
          ]}
        >
          <Inline nodes={block.content} color={textColor} />
        </Text>
      );
    }

    case 'paragraph': {
      const image = imageOnly(block.content);
      if (image !== null) {
        return (
          <MarkdownImage node={image} basePath={basePath} spacing={spacing} />
        );
      }
      return (
        <Text
          selectable
          style={[sheet.paragraph, { color: textColor, marginBottom: spacing }]}
        >
          <Inline nodes={block.content} color={textColor} />
        </Text>
      );
    }

    case 'codeBlock':
      if (isGherkin(block.language)) {
        return <GherkinBlock text={block.text} spacing={spacing} />;
      }
      return (
        <View
          style={[
            sheet.codeBlock,
            {
              backgroundColor: theme.code,
              borderColor: theme.codeBorder,
              marginBottom: spacing,
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sheet.codeBlockContent}
          >
            <Text selectable style={[sheet.codeText, { color: theme.text }]}>
              {block.text}
            </Text>
          </ScrollView>
        </View>
      );

    case 'quote':
      return (
        <View
          style={[
            sheet.quote,
            { borderLeftColor: theme.quoteBar, marginBottom: spacing },
          ]}
        >
          <BlockSequence
            blocks={block.blocks}
            basePath={basePath}
            color={theme.mutedText}
          />
        </View>
      );

    case 'list':
      return (
        <View style={{ marginBottom: spacing }}>
          {block.items.map((item, index) => (
            <View
              key={index}
              style={[
                sheet.listItem,
                index === block.items.length - 1
                  ? null
                  : block.loose
                  ? sheet.looseItem
                  : sheet.tightItem,
              ]}
            >
              <Text
                style={[
                  sheet.bullet,
                  block.ordered ? sheet.orderedBullet : null,
                  { color: textColor },
                ]}
              >
                {block.ordered ? `${block.start + index}.` : '•'}
              </Text>
              <View style={sheet.listContent}>
                <BlockSequence
                  blocks={item.blocks}
                  basePath={basePath}
                  color={color}
                />
              </View>
            </View>
          ))}
        </View>
      );

    case 'rule':
      return (
        <View
          style={[
            sheet.rule,
            { backgroundColor: theme.border, marginBottom: spacing },
          ]}
        />
      );

    case 'table':
      return (
        <View
          style={[
            sheet.table,
            { borderColor: theme.border, marginBottom: spacing },
          ]}
        >
          <TableRow
            cells={block.header}
            alignments={block.alignments}
            theme={theme}
            isHeader
            isLast={block.rows.length === 0}
          />
          {block.rows.map((row, index) => (
            <TableRow
              key={index}
              cells={row}
              alignments={block.alignments}
              theme={theme}
              isLast={index === block.rows.length - 1}
            />
          ))}
        </View>
      );
  }
}

/** A ```gherkin fence, reparsed as a feature and rendered as one. */
function GherkinBlock({ text, spacing }: { text: string; spacing: number }) {
  const { scale, scheme } = useStyles();
  const nodes = useMemo(() => parseGherkin(text), [text]);

  return (
    <Gherkin nodes={nodes} scale={scale} scheme={scheme} spacing={spacing} />
  );
}

interface TableRowProps {
  cells: InlineNode[][];
  alignments: CellAlignment[];
  theme: Theme;
  isHeader?: boolean;
  isLast: boolean;
}

function TableRow({
  cells,
  alignments,
  theme,
  isHeader = false,
  isLast,
}: TableRowProps) {
  const { sheet } = useStyles();

  return (
    <View
      style={[
        sheet.tableRow,
        isHeader && { backgroundColor: theme.tableHeader },
        isLast ? null : sheet.rowDivider,
        isLast ? null : { borderBottomColor: theme.border },
      ]}
    >
      {cells.map((cell, index) => (
        <View
          key={index}
          style={[
            sheet.tableCell,
            index === cells.length - 1 ? null : sheet.cellDivider,
            index === cells.length - 1
              ? null
              : { borderRightColor: theme.border },
          ]}
        >
          <Text
            selectable
            style={[
              sheet.paragraph,
              isHeader && sheet.tableHeaderText,
              { color: theme.text, textAlign: alignments[index] ?? 'left' },
            ]}
          >
            <Inline nodes={cell} color={theme.text} />
          </Text>
        </View>
      ))}
    </View>
  );
}

interface InlineProps {
  nodes: InlineNode[];
  color: string;
}

function Inline({ nodes, color }: InlineProps) {
  const theme = useTheme();
  const { sheet } = useStyles();

  return (
    <>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case 'text':
            return node.text;

          case 'strong':
            return (
              <Text key={index} style={sheet.strong}>
                <Inline nodes={node.children} color={color} />
              </Text>
            );

          case 'emphasis':
            return (
              <Text key={index} style={sheet.emphasis}>
                <Inline nodes={node.children} color={color} />
              </Text>
            );

          case 'strikethrough':
            return (
              <Text key={index} style={sheet.strikethrough}>
                <Inline nodes={node.children} color={color} />
              </Text>
            );

          case 'code':
            return (
              <Text
                key={index}
                style={[
                  sheet.inlineCode,
                  { backgroundColor: theme.code, color: theme.text },
                ]}
              >
                {node.text}
              </Text>
            );

          case 'link':
            return (
              <Text
                key={index}
                style={{ color: theme.link }}
                onPress={() => openLink(node.href)}
              >
                <Inline nodes={node.children} color={theme.link} />
              </Text>
            );

          case 'image':
            // Images only render as blocks; inline ones fall back to alt text.
            return (
              <Text
                key={index}
                style={[sheet.emphasis, { color: theme.mutedText }]}
              >
                {node.alt}
              </Text>
            );
        }
      })}
    </>
  );
}

interface MarkdownImageProps {
  node: Extract<InlineNode, { kind: 'image' }>;
  basePath: string;
  spacing: number;
}

function MarkdownImage({ node, basePath, spacing }: MarkdownImageProps) {
  const theme = useTheme();
  const { sheet } = useStyles();
  const uri = useMemo(
    () => resolveUri(node.src, basePath),
    [node.src, basePath],
  );
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSize(null);
    setFailed(false);

    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled && height > 0) {
          setSize({ width, height });
        }
      },
      () => {
        if (!cancelled) {
          setFailed(true);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [uri]);

  // Until the intrinsic size is known there is no sensible box to reserve.
  if (size === null) {
    return (
      <Text
        style={[
          sheet.paragraph,
          sheet.emphasis,
          { color: theme.mutedText, marginBottom: spacing },
        ]}
      >
        {failed ? `⚠︎ ${node.alt || node.src}` : node.alt}
      </Text>
    );
  }

  return (
    <Image
      accessibilityLabel={node.alt}
      source={{ uri }}
      resizeMode="contain"
      style={[
        sheet.image,
        {
          maxWidth: size.width,
          aspectRatio: size.width / size.height,
          marginBottom: spacing,
        },
      ]}
    />
  );
}

/** The single image of an image-only paragraph, if that is what this is. */
function imageOnly(
  nodes: InlineNode[],
): Extract<InlineNode, { kind: 'image' }> | null {
  const meaningful = nodes.filter(
    node => node.kind !== 'text' || node.text.trim().length > 0,
  );
  const [only] = meaningful;
  return meaningful.length === 1 && only.kind === 'image' ? only : null;
}

function openLink(href: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) {
    return; // Relative links point inside the document set, not the web.
  }
  Linking.openURL(href).catch(() => {
    // Nothing useful to do if the system has no handler for the scheme.
  });
}
