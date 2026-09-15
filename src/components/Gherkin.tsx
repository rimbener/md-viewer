/**
 * Renders a ```gherkin fence as a feature rather than as source.
 *
 * The point of Gherkin is that it reads as prose, so it is set in the body
 * font: scenarios become cards, steps hang their keyword in a gutter, and an
 * Examples block becomes a real table. Only the parts that stand in for values
 * — `<parameters>`, "strings" and doc strings — keep the code font.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { GherkinNode, GherkinSection, GherkinSpan } from '../gherkin';
import { useTheme, type Theme } from '../theme';
import { BODY_SIZE, type FontScheme } from '../typography';

interface GherkinProps {
  nodes: GherkinNode[];
  /** Zoom factor, shared with the surrounding document. */
  scale: number;
  scheme: FontScheme;
  /** Vertical rhythm of the document, so a feature sits on the same grid. */
  spacing: number;
}

type GherkinStyles = ReturnType<typeof createStyles>;

function createStyles(scale: number, scheme: FontScheme) {
  const round = (value: number) => Math.round(value * 2) / 2;
  const size = (value: number) => round(value * scale * scheme.body.scale);
  const code = (value: number) => round(value * scale * scheme.code.scale);
  const heading = (value: number) =>
    round(value * scale * scheme.heading.scale);

  return {
    /** Between steps inside one scenario. */
    stepGap: size(5),
    sheet: StyleSheet.create({
      featureLabel: {
        fontFamily: scheme.body.family,
        fontSize: size(10.5),
        lineHeight: size(16),
        fontWeight: '700',
        letterSpacing: 0.9,
      },
      featureName: {
        fontFamily: scheme.heading.family,
        fontSize: heading(20),
        lineHeight: heading(27),
        fontWeight: '700',
      },
      ruleName: {
        fontFamily: scheme.heading.family,
        fontSize: heading(15),
        lineHeight: heading(22),
        fontWeight: '600',
      },
      ruleGroup: {
        borderLeftWidth: 2,
        paddingLeft: size(12),
      },
      scenario: {
        borderWidth: 1,
        borderRadius: 6,
        padding: size(12),
      },
      scenarioName: {
        fontFamily: scheme.body.family,
        fontSize: size(BODY_SIZE),
        lineHeight: size(21),
        fontWeight: '600',
      },
      tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: size(5),
      },
      tag: {
        fontFamily: scheme.code.family,
        fontSize: code(10.5),
        lineHeight: code(15),
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: size(5),
        overflow: 'hidden',
      },
      step: {
        flexDirection: 'row',
        alignItems: 'flex-start',
      },
      stepKeyword: {
        fontFamily: scheme.body.family,
        fontSize: size(BODY_SIZE),
        lineHeight: size(21),
        fontWeight: '600',
        width: size(46),
        paddingRight: size(8),
        textAlign: 'right',
      },
      body: {
        flex: 1,
        fontFamily: scheme.body.family,
        fontSize: size(BODY_SIZE),
        lineHeight: size(21),
      },
      slot: {
        fontFamily: scheme.code.family,
        fontSize: code(12.5),
      },
      indented: {
        paddingLeft: size(46),
      },
      docString: {
        borderLeftWidth: 2,
        paddingLeft: size(10),
        paddingVertical: size(2),
      },
      docStringText: {
        fontFamily: scheme.code.family,
        fontSize: code(12.5),
        lineHeight: code(18),
      },
      comment: {
        fontFamily: scheme.body.family,
        fontSize: size(12.5),
        lineHeight: size(18),
        fontStyle: 'italic',
      },
      examplesLabel: {
        fontFamily: scheme.body.family,
        fontSize: size(10.5),
        lineHeight: size(16),
        fontWeight: '700',
        letterSpacing: 0.9,
        marginBottom: size(5),
      },
      examples: {
        marginTop: size(7),
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
        paddingVertical: size(5),
        paddingHorizontal: size(9),
      },
      cellText: {
        fontFamily: scheme.body.family,
        fontSize: size(13),
        lineHeight: size(19),
      },
      headerText: {
        fontWeight: '600',
      },
      rowDivider: {
        borderBottomWidth: 1,
      },
      cellDivider: {
        borderRightWidth: 1,
      },
    }),
  };
}

export function Gherkin({ nodes, scale, scheme, spacing }: GherkinProps) {
  const styles = useMemo(() => createStyles(scale, scheme), [scale, scheme]);
  const theme = useTheme();

  return (
    <View style={{ gap: spacing, marginBottom: spacing }}>
      <Nodes nodes={nodes} styles={styles} theme={theme} />
    </View>
  );
}

interface NodesProps {
  nodes: GherkinNode[];
  styles: GherkinStyles;
  theme: Theme;
}

/** Renders siblings in order; the enclosing view's `gap` spaces them. */
function Nodes({ nodes, styles, theme }: NodesProps) {
  return (
    <>
      {nodes.map((node, index) => (
        <NodeView key={index} node={node} styles={styles} theme={theme} />
      ))}
    </>
  );
}

interface NodeProps {
  node: GherkinNode;
  styles: GherkinStyles;
  theme: Theme;
}

function NodeView({ node, styles, theme }: NodeProps) {
  const { sheet } = styles;

  switch (node.kind) {
    case 'section':
      return <SectionView section={node} styles={styles} theme={theme} />;

    case 'step':
      return (
        <View style={sheet.step}>
          <Text
            selectable
            style={[sheet.stepKeyword, { color: theme.gherkinKeyword }]}
          >
            {node.keyword}
          </Text>
          <Text selectable style={[sheet.body, { color: theme.text }]}>
            <Spans spans={node.spans} styles={styles} theme={theme} />
          </Text>
        </View>
      );

    case 'table':
      return (
        <View style={sheet.indented}>
          <TableView node={node} styles={styles} theme={theme} />
        </View>
      );

    case 'docString':
      return (
        <View style={sheet.indented}>
          <View style={[sheet.docString, { borderLeftColor: theme.quoteBar }]}>
            <Text
              selectable
              style={[sheet.docStringText, { color: theme.mutedText }]}
            >
              {node.text}
            </Text>
          </View>
        </View>
      );

    case 'comment':
      return (
        <Text selectable style={[sheet.comment, { color: theme.mutedText }]}>
          {node.text}
        </Text>
      );

    case 'description':
      return (
        <Text selectable style={[sheet.body, { color: theme.mutedText }]}>
          {node.text}
        </Text>
      );
  }
}

interface SectionProps {
  section: GherkinSection;
  styles: GherkinStyles;
  theme: Theme;
}

function SectionView({ section, styles, theme }: SectionProps) {
  const { sheet, stepGap } = styles;

  switch (section.rank) {
    case 0:
      return (
        <View style={{ gap: stepGap }}>
          <Tags tags={section.tags} styles={styles} theme={theme} />
          <Text
            selectable
            style={[sheet.featureLabel, { color: theme.accent }]}
          >
            {section.keyword.toUpperCase()}
          </Text>
          <Text selectable style={[sheet.featureName, { color: theme.text }]}>
            {section.name}
          </Text>
          <View style={{ gap: stepGap * 2, marginTop: stepGap }}>
            <Nodes nodes={section.children} styles={styles} theme={theme} />
          </View>
        </View>
      );

    case 1:
      return (
        <View style={{ gap: stepGap }}>
          <Tags tags={section.tags} styles={styles} theme={theme} />
          <Text selectable style={[sheet.ruleName, { color: theme.text }]}>
            {section.keyword}: {section.name}
          </Text>
          <View
            style={[
              sheet.ruleGroup,
              { borderLeftColor: theme.border, gap: stepGap * 2 },
            ]}
          >
            <Nodes nodes={section.children} styles={styles} theme={theme} />
          </View>
        </View>
      );

    case 2:
      return (
        <View
          style={[
            sheet.scenario,
            {
              backgroundColor: theme.code,
              borderColor: theme.codeBorder,
              gap: stepGap,
            },
          ]}
        >
          <Tags tags={section.tags} styles={styles} theme={theme} />
          <Text selectable style={[sheet.scenarioName, { color: theme.text }]}>
            <Text style={{ color: theme.mutedText }}>{section.keyword}: </Text>
            {section.name}
          </Text>
          <View style={{ gap: stepGap, marginTop: stepGap / 2 }}>
            <Nodes nodes={section.children} styles={styles} theme={theme} />
          </View>
        </View>
      );

    case 3:
      return (
        <View style={sheet.examples}>
          <Tags tags={section.tags} styles={styles} theme={theme} />
          <Text
            selectable
            style={[sheet.examplesLabel, { color: theme.mutedText }]}
          >
            {section.keyword.toUpperCase()}
            {section.name.length > 0 ? ` — ${section.name}` : ''}
          </Text>
          <View style={{ gap: stepGap }}>
            <Nodes nodes={section.children} styles={styles} theme={theme} />
          </View>
        </View>
      );
  }
}

interface TagsProps {
  tags: string[];
  styles: GherkinStyles;
  theme: Theme;
}

function Tags({ tags, styles, theme }: TagsProps) {
  if (tags.length === 0) {
    return null;
  }
  return (
    <View style={styles.sheet.tagRow}>
      {tags.map(tag => (
        <Text
          key={tag}
          selectable
          style={[
            styles.sheet.tag,
            { color: theme.gherkinTag, borderColor: theme.gherkinTag },
          ]}
        >
          {tag}
        </Text>
      ))}
    </View>
  );
}

interface TableProps {
  node: Extract<GherkinNode, { kind: 'table' }>;
  styles: GherkinStyles;
  theme: Theme;
}

function TableView({ node, styles, theme }: TableProps) {
  const { sheet } = styles;
  const columns = node.rows.reduce(
    (most, row) => Math.max(most, row.length),
    0,
  );

  return (
    <View style={[sheet.table, { borderColor: theme.border }]}>
      {node.rows.map((row, index) => {
        const isHeader = node.header && index === 0;
        const isLast = index === node.rows.length - 1;
        return (
          <View
            key={index}
            style={[
              sheet.tableRow,
              {
                backgroundColor: isHeader
                  ? theme.tableHeader
                  : theme.background,
              },
              isLast ? null : sheet.rowDivider,
              isLast ? null : { borderBottomColor: theme.border },
            ]}
          >
            {Array.from({ length: columns }, (_, column) => (
              <View
                key={column}
                style={[
                  sheet.tableCell,
                  column === columns - 1 ? null : sheet.cellDivider,
                  column === columns - 1
                    ? null
                    : { borderRightColor: theme.border },
                ]}
              >
                <Text
                  selectable
                  style={[
                    sheet.cellText,
                    isHeader && sheet.headerText,
                    { color: theme.text },
                  ]}
                >
                  <Spans
                    spans={row[column] ?? []}
                    styles={styles}
                    theme={theme}
                  />
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

interface SpansProps {
  spans: GherkinSpan[];
  styles: GherkinStyles;
  theme: Theme;
}

function Spans({ spans, styles, theme }: SpansProps) {
  const { sheet } = styles;

  return (
    <>
      {spans.map((span, index) => {
        switch (span.kind) {
          case 'text':
            return span.text;
          case 'parameter':
            return (
              <Text
                key={index}
                style={[sheet.slot, { color: theme.gherkinParameter }]}
              >
                {span.text}
              </Text>
            );
          case 'string':
            return (
              <Text
                key={index}
                style={[sheet.slot, { color: theme.gherkinString }]}
              >
                {span.text}
              </Text>
            );
        }
      })}
    </>
  );
}
