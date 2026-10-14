import { useColorScheme } from 'react-native';

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

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = 14;
export const space = (n: number) => n * 4;
