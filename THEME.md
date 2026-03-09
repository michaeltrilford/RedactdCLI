# Redactd CLI Theme

Default terminal theme tokens for Redactd CLI, based on the OpenNote ecosystem palette.

## Intent

This theme should feel:

- technical
- calm
- purple-accented
- readable in long terminal sessions

The CLI should support `auto`, `dark`, and `light` theme modes.

On macOS, the terminal app controls the actual background color.

That means Redactd CLI should treat theming primarily as a text-color system for ANSI output, not as a full-screen background system.

## Source Palette

Shared OpenNote-derived colors:

- primary accent: `#d199ff`
- soft foreground: `#ecebff`
- deep dark background: `#120a1a`

## Semantic Tokens

### Dark

- `accent`: `#d199ff`
- `text`: `#ecebff`
- `muted`: `#b8afcf`
- `subtle`: `#8f86a8`
- `success`: `#7ce2b3`
- `warning`: `#ffd166`
- `error`: `#ff7a90`
- `info`: `#8ec5ff`
- `background`: `#120a1a`
- `surface`: `#1a1126`
- `border`: `#312341`

### Light

- `accent`: `#8f4fd6`
- `text`: `#24172f`
- `muted`: `#5d4d73`
- `subtle`: `#7a6b90`
- `success`: `#1f8f63`
- `warning`: `#9a6700`
- `error`: `#c23b57`
- `info`: `#2f6fdd`
- `background`: `#fcf8ff`
- `surface`: `#f2eafe`
- `border`: `#d8c7f2`

## Usage

- use `accent` for headings, active labels, prompts, and key values
- use `text` for primary readable output
- use `muted` and `subtle` for secondary metadata and help text
- use `success`, `warning`, `error`, and `info` for system states
- use `background`, `surface`, and `border` only in owned surfaces such as screenshots, HTML reports, docs, or boxed terminal UI

## Defaults

- default CLI mode: `auto`
- fallback mode when detection is unclear: `dark`
- do not assume the terminal background matches the theme tokens exactly

## Notes

This is a starting point, not a final locked palette.

The main invariant is shared ecosystem branding through a purple-led accent system and restrained terminal presentation.
