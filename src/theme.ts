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
  codeBorder: '#e0e0e2',
  link: '#0a66d0',
  quoteBar: '#d0d0d4',
  tableHeader: '#f7f7f8',
  gherkinKeyword: '#8250df',
  gherkinTag: '#1a7f37',
  gherkinParameter: '#bc4c00',
  gherkinString: '#0a3069',
};

const dark: Theme = {
  background: '#1e1e20',
  sidebar: '#252528',
  border: '#37373a',
  text: '#ececee',
  mutedText: '#9a9aa0',
  selectedBackground: '#2f6fd0',
  selectedText: '#ffffff',
  hairline: '#37373a',
  accent: '#69a8f5',
  code: '#2a2a2e',
  codeBorder: '#37373a',
  link: '#69a8f5',
  quoteBar: '#4a4a50',
  tableHeader: '#2a2a2e',
  gherkinKeyword: '#d2a8ff',
  gherkinTag: '#7ee787',
  gherkinParameter: '#ffa657',
  gherkinString: '#a5d6ff',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
