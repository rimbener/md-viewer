import { useColorScheme } from 'react-native';

export interface Theme {
  background: string;
  sidebar: string;
  border: string;
  text: string;
  mutedText: string;
  selectedBackground: string;
  selectedText: string;
  hairline: string;
  accent: string;
  /** Backdrop for code spans and fenced code blocks. */
  code: string;
  /** Text of a `code` span. */
  inlineCode: string;
  codeBorder: string;
  link: string;
  /** The rule running down the left of a blockquote. */
  quoteBar: string;
  tableHeader: string;
  /** Gherkin: the Given/When/Then that opens a step. */
  gherkinKeyword: string;
  /** Gherkin: an `@tag` above a scenario. */
  gherkinTag: string;
  /** Gherkin: an `<outline parameter>`. */
  gherkinParameter: string;
  /** Gherkin: a "quoted string" inside a step. */
  gherkinString: string;
  /** Code: a comment, in any highlighted language. */
  syntaxComment: string;
  /** Code: a language keyword, a CSS at-rule, an HTML doctype. */
  syntaxKeyword: string;
  /** Code: a string, a regex, an HTML attribute value. */
  syntaxString: string;
  /** Code: a number, a literal, an HTML entity, a CSS value. */
  syntaxConstant: string;
  /** Code: an HTML tag name, a CSS selector. */
  syntaxTag: string;
  /** Code: an HTML attribute name, a CSS property name. */
  syntaxAttribute: string;
  /** Code: a name being called. */
  syntaxFunction: string;
  /** Find: a hit that is not the current one. */
  searchHit: string;
  /** Find: the current hit. */
  searchCurrent: string;
}

const light: Theme = {
  background: '#ffffff',
  sidebar: '#f4f4f5',
  border: '#e0e0e2',
  text: '#1c1c1e',
  mutedText: '#6e6e73',
  selectedBackground: '#0a66d0',
  selectedText: '#ffffff',
  hairline: '#d8d8dc',
  accent: '#0a66d0',
  code: '#f2f2f4',
  inlineCode: '#d39039',
  codeBorder: '#e0e0e2',
  link: '#0a66d0',
  quoteBar: '#d0d0d4',
  tableHeader: '#f7f7f8',
  gherkinKeyword: '#8250df',
  gherkinTag: '#1a7f37',
  gherkinParameter: '#bc4c00',
  gherkinString: '#0a3069',
  syntaxComment: '#6e7781',
  syntaxKeyword: '#cf222e',
  syntaxString: '#0a3069',
  syntaxConstant: '#0550ae',
  syntaxTag: '#116329',
  syntaxAttribute: '#0550ae',
  syntaxFunction: '#8250df',
  searchHit: '#ffe08a',
  searchCurrent: '#f5a524',
};

const dark: Theme = {
  background: '#252528',
  sidebar: '#1e1e20',
  border: '#37373a',
  text: '#ececee',
  mutedText: '#9a9aa0',
  selectedBackground: '#2f6fd0',
  selectedText: '#ffffff',
  hairline: '#37373a',
  accent: '#69a8f5',
  code: '#2a2a2e',
  inlineCode: '#d39039',
  codeBorder: '#37373a',
  link: '#69a8f5',
  quoteBar: '#4a4a50',
  tableHeader: '#2a2a2e',
  gherkinKeyword: '#d2a8ff',
  gherkinTag: '#7ee787',
  gherkinParameter: '#ffa657',
  gherkinString: '#a5d6ff',
  syntaxComment: '#8b949e',
  syntaxKeyword: '#ff7b72',
  syntaxString: '#a5d6ff',
  syntaxConstant: '#79c0ff',
  syntaxTag: '#7ee787',
  syntaxAttribute: '#79c0ff',
  syntaxFunction: '#d2a8ff',
  searchHit: '#5c4e24',
  searchCurrent: '#8d6b1f',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
