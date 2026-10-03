import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Appearance } from 'react-native';

import { DEFAULT_COLOR_SCHEME_ID, type ColorSchemeId } from '../colorScheme';
import { loadColorScheme, saveColorScheme } from '../preferences';
import { ColorSchemeContext } from '../theme';

type ColorSchemeProviderProps = {
  children: ReactNode;
};

/** Text fields and scrollbars read the app appearance, not the React palette. */
function applyColorScheme(schemeId: ColorSchemeId): void {
  Appearance.setColorScheme(schemeId === 'system' ? null : schemeId);
}

export function ColorSchemeProvider({ children }: ColorSchemeProviderProps) {
  const [schemeId, setSchemeIdState] = useState(DEFAULT_COLOR_SCHEME_ID);
  const hasChosen = useRef(false);

  useEffect(() => {
    let cancelled = false;

    loadColorScheme().then(stored => {
      if (!cancelled && stored !== null && !hasChosen.current) {
        setSchemeIdState(stored);
        applyColorScheme(stored);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setSchemeId = useCallback((next: ColorSchemeId) => {
    hasChosen.current = true;
    setSchemeIdState(next);
    saveColorScheme(next);
    applyColorScheme(next);
  }, []);

  return (
    <ColorSchemeContext.Provider value={{ schemeId, setSchemeId }}>
      {children}
    </ColorSchemeContext.Provider>
  );
}
