const ANSI_RESET = '\x1b[0m';

function fgHex(hex) {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

export const themeTokens = {
  dark: {
    accent: '#d199ff',
    text: '#ecebff',
    muted: '#b8afcf',
    subtle: '#8f86a8',
    success: '#7ce2b3',
    warning: '#ffd166',
    error: '#ff7a90',
    info: '#8ec5ff'
  },
  light: {
    accent: '#8f4fd6',
    text: '#24172f',
    muted: '#5d4d73',
    subtle: '#7a6b90',
    success: '#1f8f63',
    warning: '#9a6700',
    error: '#c23b57',
    info: '#2f6fdd'
  }
};

function resolveTheme(mode) {
  if (mode === 'light') return 'light';
  return 'dark';
}

export function createColors(mode = 'dark') {
  const resolved = resolveTheme(mode);
  const palette = themeTokens[resolved];

  const color = (text, hex) => `${fgHex(hex)}${text}${ANSI_RESET}`;

  return {
    theme: resolved,
    accent: (text) => color(text, palette.accent),
    text: (text) => color(text, palette.text),
    muted: (text) => color(text, palette.muted),
    subtle: (text) => color(text, palette.subtle),
    success: (text) => color(text, palette.success),
    warning: (text) => color(text, palette.warning),
    error: (text) => color(text, palette.error),
    info: (text) => color(text, palette.info)
  };
}
