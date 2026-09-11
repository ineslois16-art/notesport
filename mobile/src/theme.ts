import { useColorScheme } from 'react-native';

/**
 * Marque : vert sauge (#55684a en clair, éclairci en #9caf88 sur fond sombre
 * pour rester au-dessus de 3:1). Les couleurs de séries, elles, restent
 * indépendantes de la marque — voir ci-dessous.
 *
 * Les quatre couleurs de séries proviennent d'une palette catégorielle validée
 * (bandes de clarté, plancher de chroma, séparation daltonisme, contraste) sur
 * les deux surfaces réellement utilisées ici : #ffffff en clair, #1a1a19 en
 * sombre. Chaque graphique n'affiche qu'une série ; l'aqua passe juste sous
 * 3:1 en mode clair, il est donc toujours accompagné de valeurs lisibles en
 * texte (règle de relief).
 */
const series = {
  light: { jumps: '#2a78d6', kcal: '#eb6834', blocks: '#1baf7a', weight: '#4a3aa7' },
  dark: { jumps: '#3987e5', kcal: '#d95926', blocks: '#199e70', weight: '#9085e9' },
};

const light = {
  mode: 'light' as 'light' | 'dark',
  bg: '#f4f6ef',
  surface: '#ffffff',
  surfaceAlt: '#eef1e7',
  surfaceSunken: '#e4eada',
  line: '#dde3d6',
  ink: '#18231d',
  inkSoft: '#42504a',
  inkMuted: '#65736a',
  brand: '#55684a',
  brandInk: '#ffffff',
  brandSoft: '#e6edde',
  danger: '#b23a36',
  dangerSoft: '#fbe9e8',
  grid: '#e9ede9',
  series: series.light,
  shadow: '#23412b',
};

export type Theme = typeof light;

const dark: Theme = {
  mode: 'dark',
  bg: '#12150f',
  surface: '#1a1a19',
  surfaceAlt: '#242620',
  surfaceSunken: '#2c302a',
  line: '#343830',
  ink: '#f1f4ee',
  inkSoft: '#c3c8c1',
  inkMuted: '#98a09a',
  brand: '#9caf88',
  brandInk: '#10160c',
  brandSoft: '#26301f',
  danger: '#e66767',
  dangerSoft: '#33201f',
  grid: '#2a2e2b',
  series: series.dark,
  shadow: '#000000',
};

export const themes = { light, dark };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? themes.dark : themes.light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

export const type = {
  hero: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.3 },
  section: { fontSize: 13, fontWeight: '800' as const, letterSpacing: 0.8 },
  body: { fontSize: 15, fontWeight: '500' as const },
  strong: { fontSize: 15, fontWeight: '700' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const },
};
