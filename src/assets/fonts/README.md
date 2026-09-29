# Local UI fonts

Self-hosted, normal-style variable WOFF2 files (weights 100–900):

- `@fontsource-variable/inter` **5.3.0**, Latin and Latin Extended subsets.
- `@fontsource-variable/vazirmatn` **5.3.0**, Arabic (including Persian), Latin,
  and Latin Extended subsets.

Copied unchanged from each npm package's `files/` directory, with the upstream
OFL licenses alongside. These are source assets, not generated build artifacts.
To reproduce, use `npm pack <package>@5.3.0` outside the repository and extract
the matching `*-wght-normal.woff2` files and `LICENSE`.

`src/fonts.css` preserves upstream Unicode ranges, uses local URLs, and applies
matching ascent/descent/line-gap metrics to both families. `src/i18n.css` selects
the primary family using `html:lang()`. Persian fallback remains available for
user-entered Persian names while English is selected. No external font service
or font JavaScript is required; Vite also embeds these in the single-file build.
