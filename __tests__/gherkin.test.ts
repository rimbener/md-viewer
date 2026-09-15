import { isGherkin, parseGherkin, type GherkinNode } from '../src/gherkin';

function text(spans: { text: string }[]): string {
  return spans.map(span => span.text).join('');
}

/** Renders the node tree as indented lines, which asserts far more readably. */
function outline(nodes: GherkinNode[], depth = 0): string[] {
  const pad = '  '.repeat(depth);
  return nodes.flatMap((node): string[] => {
    switch (node.kind) {
      case 'section':
        return [
          `${pad}${node.keyword}[${node.rank}]${
            node.tags.length > 0 ? ` ${node.tags.join(' ')}` : ''
          }: ${node.name}`,
          ...outline(node.children, depth + 1),
        ];
      case 'step':
        return [`${pad}${node.keyword} ${text(node.spans)}`];
      case 'table':
        return [
          `${pad}table${node.header ? '[header]' : ''}`,
          ...node.rows.map(row => `${pad}  ${row.map(text).join(' | ')}`),
        ];
      case 'docString':
        return [`${pad}doc: ${node.text}`];
      case 'comment':
        return [`${pad}# ${node.text}`];
      case 'description':
        return [`${pad}desc: ${node.text}`];
    }
  });
}

describe('parseGherkin', () => {
  it('nests scenarios under their feature and steps under their scenario', () => {
    expect(
      outline(
        parseGherkin(
          [
            'Feature: Stepper',
            '',
            '  Scenario: It renders',
            '    Given a stepper',
            '    When it renders',
            '    Then it shows five steps',
            '    And they are in order',
            '',
            '  Scenario: It scrolls',
            '    * a lone bullet step',
          ].join('\n'),
        ),
      ),
    ).toEqual([
      'Feature[0]: Stepper',
      '  Scenario[2]: It renders',
      '    Given a stepper',
      '    When it renders',
      '    Then it shows five steps',
      '    And they are in order',
      '  Scenario[2]: It scrolls',
      '    * a lone bullet step',
    ]);
  });

  it('attaches tags to the section below them, across several lines', () => {
    const [feature] = parseGherkin(
      ['@slow', '@ac-1 @ui', 'Feature: Tagged'].join('\n'),
    );
    expect(feature).toMatchObject({ tags: ['@slow', '@ac-1', '@ui'] });
  });

  it('closes a scenario when the next one opens, and a rule groups them', () => {
    expect(
      outline(
        parseGherkin(
          [
            'Feature: Two rules',
            '  Rule: First',
            '    Scenario: A',
            '      Given a',
            '  Rule: Second',
            '    Scenario: B',
            '      Given b',
          ].join('\n'),
        ),
      ),
    ).toEqual([
      'Feature[0]: Two rules',
      '  Rule[1]: First',
      '    Scenario[2]: A',
      '      Given a',
      '  Rule[1]: Second',
      '    Scenario[2]: B',
      '      Given b',
    ]);
  });

  it('reads an Examples table as a table with a header row', () => {
    expect(
      outline(
        parseGherkin(
          [
            'Scenario Outline: Appearance',
            '  Given a <kind> step',
            '  Examples:',
            '    | kind  | state   |',
            '    | video | current |',
          ].join('\n'),
        ),
      ),
    ).toEqual([
      'Scenario Outline[2]: Appearance',
      '  Given a <kind> step',
      '  Examples[3]: ',
      '    table[header]',
      '      kind | state',
      '      video | current',
    ]);
  });

  it('reads a data table under a step as a table without a header', () => {
    const [scenario] = parseGherkin(
      ['Scenario: Data', '  Given the rows', '    | a | b |'].join('\n'),
    );
    expect(outline([scenario])).toEqual([
      'Scenario[2]: Data',
      '  Given the rows',
      '  table',
      '    a | b',
    ]);
  });

  it('honours escaped pipes and newlines inside a cell', () => {
    const [table] = parseGherkin('| a \\| b | c\\nd |');
    expect(outline([table])).toEqual(['table', '  a | b | c\nd']);
  });

  it('picks out outline parameters and quoted strings', () => {
    const [step] = parseGherkin(
      'Then it shows the translation of "a.b" for <kind>',
    );
    expect(step).toMatchObject({
      kind: 'step',
      keyword: 'Then',
      spans: [
        { kind: 'text', text: 'it shows the translation of ' },
        { kind: 'string', text: '"a.b"' },
        { kind: 'text', text: ' for ' },
        { kind: 'parameter', text: '<kind>' },
      ],
    });
  });

  it('keeps a doc string verbatim, less the opening indentation', () => {
    expect(
      outline(
        parseGherkin(
          [
            '  Scenario: Payload',
            '    Given the body',
            '      """',
            '      {',
            '        "id": 1',
            '      }',
            '      """',
          ].join('\n'),
        ),
      ),
    ).toEqual([
      'Scenario[2]: Payload',
      '  Given the body',
      '  doc: {\n  "id": 1\n}',
    ]);
  });

  it('keeps comments, and gathers free text into a description', () => {
    expect(
      outline(
        parseGherkin(
          [
            '# language: en',
            'Feature: Described',
            '  As a reader',
            '  I want prose',
            '',
            '  Scenario: S',
          ].join('\n'),
        ),
      ),
    ).toEqual([
      '# language: en',
      'Feature[0]: Described',
      '  desc: As a reader\nI want prose',
      '  Scenario[2]: S',
    ]);
  });

  it('treats a step-shaped line with a colon as a step, not a section', () => {
    const [step] = parseGherkin('Given a map of a: b');
    expect(step).toMatchObject({ kind: 'step', keyword: 'Given' });
  });

  it('keeps unrecognised lines instead of dropping them', () => {
    expect(outline(parseGherkin('just some words\n\nand more'))).toEqual([
      'desc: just some words',
      'desc: and more',
    ]);
  });

  it('accepts an empty document', () => {
    expect(parseGherkin('')).toEqual([]);
  });
});

describe('isGherkin', () => {
  it('recognises the fence languages that mean Gherkin', () => {
    expect(
      ['gherkin', 'Gherkin', 'feature', 'cucumber'].map(isGherkin),
    ).toEqual([true, true, true, true]);
  });

  it('leaves other fences alone', () => {
    expect(['ts', 'json', null].map(isGherkin)).toEqual([false, false, false]);
  });
});
