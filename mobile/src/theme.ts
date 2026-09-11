/**
 * Marque : vert #689d71 (éclairci en #8ebd96 sur fond sombre
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
  dark: { jumps: '#5aa2f0', kcal: '#f0794a', blocks: '#35c79a', weight: '#a79bf0' },
};

/**
 * Complémentaires partagées du vert de marque (280° et 340°, même saturation et
 * clarté) : la prune marque les jalons, la framboise l'instant présent. Elles
 * habillent l'interface, jamais les courbes — celles-ci gardent leur palette.
 */
const accentLight = { plum: '#8b689c', plumSoft: '#f1eaf4', berry: '#9b6678', berrySoft: '#f7ecf0' };
const accentDark = { plum: '#c9a2d8', plumSoft: '#241b28', berry: '#e79fb0', berrySoft: '#2a1c21' };

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
  brand: '#689d71',
  brandDeep: '#4a7251',
  brandInk: '#ffffff',
  brandSoft: '#e6efe8',
  ...accentLight,
  danger: '#b23a36',
  dangerSoft: '#fbe9e8',
  grid: '#e9ede9',
  series: series.light,
  shadow: '#23412b',
};

export type Theme = typeof light;

const dark: Theme = {
  mode: 'dark',
  bg: '#0b0c0a',
  surface: '#141713',
  surfaceAlt: '#1d211b',
  surfaceSunken: '#262b25',
  line: '#2b302a',
  ink: '#f3f6ef',
  inkSoft: '#c3c8c1',
  inkMuted: '#98a295',
  brand: '#8fd69a',
  brandDeep: '#8fd69a',
  brandInk: '#06120a',
  brandSoft: '#1b2a1e',
  ...accentDark,
  danger: '#e66767',
  dangerSoft: '#33201f',
  grid: '#2a2e2b',
  series: series.dark,
  shadow: '#000000',
};

export const themes = { light, dark };

/**
 * L'application est sombre en permanence, comme la page web : le fond quasi
 * noir et l'accent unique sont le langage visuel du produit, pas une préférence
 * d'affichage. Le thème clair reste défini — il sert de référence de contraste
 * et pourrait redevenir une option — mais rien ne le sélectionne aujourd'hui.
 */
export function useTheme(): Theme {
  return themes.dark;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

/**
 * Échelle typographique athlétique : les chiffres portent l'écran, les
 * étiquettes passent en petites capitales très espacées, et rien entre les deux
 * ne vient concurrencer la valeur du jour.
 */
export const type = {
  hero: { fontSize: 46, fontWeight: '900' as const, letterSpacing: -1.6 },
  title: { fontSize: 22, fontWeight: '900' as const, letterSpacing: -0.5 },
  section: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.4 },
  body: { fontSize: 15, fontWeight: '500' as const },
  strong: { fontSize: 15, fontWeight: '800' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6 },
};
