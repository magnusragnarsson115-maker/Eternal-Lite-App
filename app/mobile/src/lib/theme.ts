import { useColorScheme } from 'react-native';
import { useA11y } from './a11y';

/** Te same tokeny wyglądu co panel i strona (web/src/styles.css) — R7: wspólny system wyglądu. */
const light = {
  bg: '#f3f6f7',
  surface: '#ffffff',
  surface2: '#f8fafb',
  ink: '#102029',
  ink2: '#33444e',
  muted: '#56666f',
  border: '#d9e2e6',
  primary: '#0e6f78',
  primaryInk: '#ffffff',
  primarySoft: '#e3f1f2',
  success: '#17663f',
  successSoft: '#e4f4ea',
  warning: '#8a4b00',
  warningSoft: '#fdf1df',
  danger: '#b42318',
  dangerSoft: '#fdeceb',
};

const dark: typeof light = {
  bg: '#0d1418',
  surface: '#141e23',
  surface2: '#19252b',
  ink: '#e6eef1',
  ink2: '#c3d0d6',
  muted: '#9aabb3',
  border: '#2a3a42',
  primary: '#4fb3bc',
  primaryInk: '#04252a',
  primarySoft: '#16343a',
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
