import { useColorScheme } from 'react-native';
import { useA11y } from './a11y';

/** Te same tokeny wyglądu co panel pacjenta w przeglądarce (web/src/styles.css, html[data-panel='patient']) — kolorystyka rundy 5. */
const light = {
  bg: '#f7f5fb',
  surface: '#ffffff',
  surface2: '#faf8fd',
  ink: '#1c1830',
  ink2: '#3d3655',
  muted: '#5f5873',
  border: '#e3ddef',
  primary: '#5b3fc4',
  primaryInk: '#ffffff',
  primarySoft: '#efeafc',
  success: '#17663f',
  successSoft: '#e4f4ea',
  warning: '#8a4b00',
  warningSoft: '#fdf1df',
  danger: '#b42318',
  dangerSoft: '#fdeceb',
};

const dark: typeof light = {
  bg: '#12101c',
  surface: '#1a1727',
  surface2: '#201c30',
  ink: '#eeeaf7',
  ink2: '#d2cbe4',
  muted: '#a69fbb',
  border: '#322c46',
  primary: '#ab9bff',
  primaryInk: '#1a1033',
  primarySoft: '#2a2148',
  success: '#6fd39b',
  successSoft: '#163223',
  warning: '#f0b45c',
  warningSoft: '#3a2a12',
  danger: '#ff8a80',
  dangerSoft: '#3d1a18',
};

/** Wysoki kontrast (A23.3): czerń/biel, mocne obramowania — te same wartości co w przeglądarce. */
const highLight: typeof light = {
  bg: '#ffffff',
  surface: '#ffffff',
  surface2: '#ffffff',
  ink: '#000000',
  ink2: '#000000',
  muted: '#1f2a30',
  border: '#000000',
  primary: '#00474e',
  primaryInk: '#ffffff',
  primarySoft: '#d5ecee',
  success: '#0b4a2b',
  successSoft: '#e4f4ea',
  warning: '#5c3200',
  warningSoft: '#fdf1df',
  danger: '#8a1209',
  dangerSoft: '#fdeceb',
};

const highDark: typeof light = {
  bg: '#000000',
  surface: '#000000',
  surface2: '#0a0a0a',
  ink: '#ffffff',
  ink2: '#ffffff',
  muted: '#e6e6e6',
  border: '#ffffff',
  primary: '#8fe9f0',
  primaryInk: '#000000',
  primarySoft: '#0b3338',
  success: '#9ff0c0',
  successSoft: '#0b2a18',
  warning: '#ffd08a',
  warningSoft: '#2e2008',
  danger: '#ffb3ab',
  dangerSoft: '#2e0f0c',
};

export type Colors = typeof light;

export function useColors(): Colors {
  const dark_ = useColorScheme() === 'dark';
  const { highContrast } = useA11y();
  if (highContrast) return dark_ ? highDark : highLight;
  return dark_ ? dark : light;
}

export const radius = 14;
export const space = (n: number) => n * 4;
