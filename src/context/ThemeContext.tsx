import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  THEMES,
  THEME_LIST,
  ThemeDefinition,
  ThemeId,
  ThemePalette,
  Colors as DefaultColors,
} from '../constants/theme';

interface ThemeContextType {
  theme: ThemeDefinition;
  colors: ThemePalette;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => Promise<void>;
  availableThemes: ThemeDefinition[];
}

const STORAGE_KEY = '@gitpulse_theme_id';

const ThemeContext = createContext<ThemeContextType>({
  theme: THEMES.obsidian,
  colors: DefaultColors,
  themeId: 'obsidian',
  setThemeId: async () => {},
  availableThemes: THEME_LIST,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeId, setCurrentThemeId] = useState<ThemeId>('obsidian');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && saved in THEMES) {
        setCurrentThemeId(saved as ThemeId);
      }
    });
  }, []);

  const setThemeId = async (id: ThemeId) => {
    if (id in THEMES) {
      setCurrentThemeId(id);
      await AsyncStorage.setItem(STORAGE_KEY, id);
    }
  };

  const currentTheme = THEMES[themeId] || THEMES.obsidian;

  return (
    <ThemeContext.Provider
      value={{
        theme: currentTheme,
        colors: currentTheme.colors,
        themeId,
        setThemeId,
        availableThemes: THEME_LIST,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
