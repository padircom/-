# RTL/LTR presentation regression

These checks use the existing language switch and UI. They do not seed, edit, or
reset business records. The synthetic mixed-data table exists only in the test
browser DOM; it is not application/sample data.

With the frontend on 5173 and the existing JSON preview API on 4000:

```sh
npm ci
# Test tooling only; do not modify the application dependency manifest/lockfile.
npm install --no-save --package-lock=false @playwright/test@1.63.0
npx playwright install chromium
npx playwright test --config tests/ui/playwright.config.ts
```

`UI_BASE_URL` overrides the preview URL. `CHROMIUM_PATH` optionally points to an
already installed Chromium executable (no system Chrome/channel assumption).
Run `npm ci` afterwards to restore the exact application dependency tree.

Coverage:
- FA → EN → FA at 1440, 1024, and 390 CSS pixels; root lang/dir, font loading,
  control/card/panel heights, fixed sidebar placement, no document overflow.
- Collapse/expand at the fixed left edge, horizontal navigation arrow orientation, theme switches, calendar arrows.
- The real projects table: identifier isolation, actions column order, row height,
  native horizontal scrolling in both directions on narrow screens.
- A real inner PEX workspace: fixed right sidebar, selected process preservation,
  and a left-to-right time axis even in a Persian workspace.
- A browser-only table fixture: negative decimal amounts, Persian digits, codes,
  dates, tabular numerals, bidi isolation, and scrolling to both column extremes.

Snapshots and test artifacts go to ignored `test-results/i18n/`.

## Data source health

`data-source-health.spec.ts` adds ten read-only UI tests with controlled status
responses: configuration is not connectivity, fresh confirmation and Power BI
identity mapping, polling/recovery, HTTP failures, offline/online, stale evidence,
timeout, invalid responses, and session changes. Real external connectors are
not contacted by these tests. The current backend is configuration-only; see
`docs/DATA_SOURCE_HEALTH.md` for the deliberately conservative health contract.

Client policy unit tests (using the existing esbuild dependency):

```sh
node --test tests/unit/dataSourceHealth.test.mjs
```

## Shared sidebar layout

`sidebars.spec.ts` adds eight layout regressions: flat source rows/icon styling,
identical controls across FA/EN and dark/light themes, fixed button geometry in
both collapse states, dedicated non-overlapping rails at desktop/tablet/mobile
sizes, retained selection/search and health, and keyboard focus/hidden content.
The latest regression requires NO hide button on the right: it remains visible at 320px while the left control is unchanged. See `docs/SIDEBAR_UI.md`.

## Header and workspace typography

`header.spec.ts` covers the restored header in two themes and both languages.
`workspace-typography.spec.ts` adds five checks for shared right-navigation and
center-workspace font sizes: actual monitoring tabs/labels, inner process and
sub-process navigation in FA/EN, theme changes, legacy text sizes, root font
scaling, and header/source-pane/icon/SVG/document-preview exclusions.

`src/workspace-typography.css` applies screen-only sizes to the right navigation
and central workspace: 0.75rem for navigation/body/forms/tables and 0.875rem for
semantic section titles. It does not override layout, font family, weight or
line-height. The existing root font-scale setting remains effective.

`process-sidebar.spec.ts` adds four regressions for flat process groups and
subprocess rows in Planning, Documents, Quality and Risk: FA/EN, both themes,
selection, hover, focus, domain expansion, unchanged panel width and entry form.
The UI suite contains 37 tests.
