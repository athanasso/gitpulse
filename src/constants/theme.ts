export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const Colors = {
  // Backgrounds
  background: '#070B14',
  backgroundElevated: '#0D1322',
  card: '#11192C',
  cardElevated: '#17223B',
  cardBorder: '#1E2D4A',
  cardBorderActive: '#38BDF8',

  // Primary & Accents
  primary: '#8B5CF6',
  primaryMuted: 'rgba(139, 92, 246, 0.15)',
  cyan: '#06B6D4',
  cyanMuted: 'rgba(6, 182, 212, 0.15)',
  emerald: '#10B981',
  emeraldMuted: 'rgba(16, 185, 129, 0.15)',
  gold: '#F59E0B',
  goldMuted: 'rgba(245, 158, 11, 0.15)',
  ruby: '#EF4444',
  rubyMuted: 'rgba(239, 68, 68, 0.15)',

  // Text
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Code & Syntax Highlights
  codeBackground: '#05080F',
  codeBorder: '#182238',
  codeLineNumber: '#475569',
  codeKeyword: '#C084FC',
  codeFunction: '#60A5FA',
  codeString: '#34D399',
  codeComment: '#64748B',
  codeNumber: '#FBBF24',
  codeDiffAdd: 'rgba(16, 185, 129, 0.2)',
  codeDiffRemove: 'rgba(239, 68, 68, 0.2)',

  // Heatmap Contribution Colors
  heat0: '#141D30',
  heat1: '#0E4429',
  heat2: '#006D32',
  heat3: '#26A641',
  heat4: '#39D353',
};

export type ThemePalette = typeof Colors;

export type ThemeId =
  | 'obsidian'
  | 'dimmed'
  | 'high-contrast'
  | 'light'
  | 'cyberpunk';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  tagline: string;
  isDark: boolean;
  colors: ThemePalette;
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  obsidian: {
    id: 'obsidian',
    name: 'GitPulse Obsidian',
    tagline: 'Deep space canvas with vibrant violet & cyan pulses',
    isDark: true,
    colors: Colors,
  },
  dimmed: {
    id: 'dimmed',
    name: 'GitHub Dimmed',
    tagline: 'Soft slate dark canvas designed for long nighttime reading',
    isDark: true,
    colors: {
      ...Colors,
      background: '#22272E',
      backgroundElevated: '#2D333B',
      card: '#2D333B',
      cardElevated: '#373E47',
      cardBorder: '#444C56',
      cardBorderActive: '#539BF5',
      primary: '#539BF5',
      primaryMuted: 'rgba(83, 155, 245, 0.15)',
      cyan: '#39C5CF',
      cyanMuted: 'rgba(57, 197, 207, 0.15)',
      emerald: '#56D364',
      emeraldMuted: 'rgba(86, 211, 100, 0.15)',
      ruby: '#F47067',
      rubyMuted: 'rgba(244, 112, 103, 0.15)',
      textPrimary: '#ADBAC7',
      textSecondary: '#768390',
      textMuted: '#636E7B',
      codeBackground: '#1C2128',
      codeBorder: '#373E47',
      heat0: '#2D333B',
      heat1: '#0E4429',
      heat2: '#006D32',
      heat3: '#26A641',
      heat4: '#39D353',
    },
  },
  'high-contrast': {
    id: 'high-contrast',
    name: 'High Contrast Dark',
    tagline: 'Pure pitch black with crisp white and high visibility borders',
    isDark: true,
    colors: {
      ...Colors,
      background: '#010409',
      backgroundElevated: '#0D1117',
      card: '#0D1117',
      cardElevated: '#161B22',
      cardBorder: '#6E7681',
      cardBorderActive: '#79C0FF',
      primary: '#79C0FF',
      primaryMuted: 'rgba(121, 192, 255, 0.2)',
      cyan: '#56D4DD',
      cyanMuted: 'rgba(86, 212, 221, 0.2)',
      emerald: '#7EE787',
      emeraldMuted: 'rgba(126, 231, 135, 0.2)',
      ruby: '#FF7B72',
      rubyMuted: 'rgba(255, 123, 114, 0.2)',
      textPrimary: '#FFFFFF',
      textSecondary: '#C9D1D9',
      textMuted: '#8B949E',
      codeBackground: '#010409',
      codeBorder: '#545D68',
      heat0: '#161B22',
      heat1: '#0E4429',
      heat2: '#006D32',
      heat3: '#26A641',
      heat4: '#39D353',
    },
  },
  light: {
    id: 'light',
    name: 'GitHub Clean Light',
    tagline: 'Crisp daylight white with official GitHub light palettes',
    isDark: false,
    colors: {
      ...Colors,
      background: '#FFFFFF',
      backgroundElevated: '#F6F8FA',
      card: '#F6F8FA',
      cardElevated: '#EAEEF2',
      cardBorder: '#D0D7DE',
      cardBorderActive: '#0969DA',
      primary: '#0969DA',
      primaryMuted: 'rgba(9, 105, 218, 0.12)',
      cyan: '#0550AE',
      cyanMuted: 'rgba(5, 80, 174, 0.12)',
      emerald: '#1A7F37',
      emeraldMuted: 'rgba(26, 127, 55, 0.15)',
      gold: '#9A6700',
      goldMuted: 'rgba(154, 103, 0, 0.15)',
      ruby: '#CF222E',
      rubyMuted: 'rgba(207, 34, 46, 0.15)',
      textPrimary: '#1F2328',
      textSecondary: '#59636E',
      textMuted: '#8C959F',
      codeBackground: '#F6F8FA',
      codeBorder: '#D0D7DE',
      codeLineNumber: '#8C959F',
      codeKeyword: '#A40E26',
      codeFunction: '#8250DF',
      codeString: '#0A3069',
      codeComment: '#6E7781',
      codeNumber: '#953800',
      heat0: '#EBEDF0',
      heat1: '#9BE9A8',
      heat2: '#40C463',
      heat3: '#30A14E',
      heat4: '#216E39',
    },
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Neon Cyberpunk',
    tagline: 'High-voltage electric dark with neon rose, emerald & amber accents',
    isDark: true,
    colors: {
      ...Colors,
      background: '#080B10',
      backgroundElevated: '#0E131F',
      card: '#0F172A',
      cardElevated: '#1E293B',
      cardBorder: '#334155',
      cardBorderActive: '#F43F5E',
      primary: '#F43F5E',
      primaryMuted: 'rgba(244, 63, 94, 0.18)',
      cyan: '#06B6D4',
      cyanMuted: 'rgba(6, 182, 212, 0.18)',
      emerald: '#10B981',
      emeraldMuted: 'rgba(16, 185, 129, 0.18)',
      gold: '#FACC15',
      goldMuted: 'rgba(250, 204, 21, 0.18)',
      ruby: '#EF4444',
      rubyMuted: 'rgba(239, 68, 68, 0.18)',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#64748B',
      codeBackground: '#0B0F19',
      codeBorder: '#1E293B',
      heat0: '#0F172A',
      heat1: '#064E3B',
      heat2: '#047857',
      heat3: '#059669',
      heat4: '#10B981',
    },
  },
};

export const THEME_LIST = Object.values(THEMES);
