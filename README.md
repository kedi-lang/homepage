# Kedi Homepage

Home of lovely cats. Source repository: [kedi-lang/homepage](https://github.com/kedi-lang/homepage).

Standalone, static Astro website. No Kedi runtime, notebook, Python, model
credentials, analytics, or backend is required to serve the site.

## Local preview

Node 22.12+ (Node 24 recommended):

```sh
git clone https://github.com/kedi-lang/homepage.git
cd homepage
npm ci
npm run dev
```

Open the localhost URL printed by Astro. `npm run build` performs the TypeScript
check and writes the static site to `dist/`. `npm run preview` serves that build.
The production domain is <https://kedi-lang.org/>.

Inside the Kedi workspace, this independent checkout lives at `website/`.
It is not part of the Kedi package. The combined deployment places this
repository's `dist/` at the domain root and the separately built documentation
under `/docs/`.

## Publication

The **Documentation** workflow in `kedi-lang/kedi-docs` owns the single Pages
publication. It checks out an exact homepage commit, builds and tests both sites,
then publishes them together. Do not deploy this repository's `dist/` directly
over the documentation or configure a second custom domain here.
The **Homepage** workflow runs Astro and Playwright checks on pushes and pull
requests; this repository's standalone GitHub Pages/Jekyll publisher is disabled.

Homepage `main` is checked approximately every 15 minutes (GitHub Actions
schedules can be delayed). Unchanged revisions do not trigger another build.
For an immediate release, run the publisher manually after pushing:

```sh
gh workflow run docs.yml --repo kedi-lang/kedi-docs --ref main
```

`https://kedi-lang.org/deployment.json` records the published homepage, docs,
and Kedi commit IDs. Existing documentation URLs redirect to `/docs/`, preserving
query strings and section anchors. These are static HTML redirects, not HTTP 301
responses. Raw Markdown and LLM indexes remain available at their old addresses.

Social-media covers are unrelated to the website. `assets/social/` is local-only
and ignored by Git. It must never be copied into `public/` or the deployment
artifact. Only the built `dist/` directory is a publishable website output.

## Scope

- Istanbul hero with a separate interactive pixel cat.
- A TMDB movie lookup, typed action, API migration check, grounded-copy loop, and a loop/map
  issue inbox. Python calculates a quote; a reusable procedure builds a handoff.
- The stock tool reads `public/examples/inventory.json`. Place it in the
  program's cwd as `inventory.json` when running the displayed example.
- A release-team example combining profiles, a file-reading tool, a typed
  subagent result, and template outputs. The fictional input changelog is in
  `public/examples/CHANGELOG.md`; the program reads `CHANGELOG.md` from its cwd.
- One compact Kedi + Jev example: a `Literal` queue choice and a cancellation
  `Probability` share one request. Python applies the priority rule locally.
  The threshold is illustrative application policy, not a calibration result.
- Kedi Harness teaser explicitly marked coming soon.
- A local Notebook section with its real screenshot, `kedi notebook` launch
  command, source-checkout setup, and cell-to-cell state example.
- Discord community links in the main and footer navigation.
- Installation command switching/copying and an animated Bosphorus ferry.
- Responsive layouts, keyboard-operated tabs/menu, and reduced-motion support.

All displayed outputs are curated **illustrative output**, not live model calls
or measured recordings. Replay is visual playback only. There are no model
latency, accuracy, or cost claims. The examples are stored in
`src/data/examples.json`; rendered code and clipboard text share that source.
Only the introductory movie example has explanatory comments. The hero imports the HTTPX-backed
tool from `public/examples/tmdb.kedi`, linked beneath the example. This is a local
example module, not a built-in Kedi package; it must sit alongside `movie_night.kedi`.
The copy button copies the displayed main program.
Real workflow recordings can replace this illustrative presentation later.

The header, footer, and favicon use the supplied monochrome Kedi emblem.
Its original JPEG and reproducible transparent extraction are in `assets/source/`.
The cat gently leans on hover/focus and greets with "Meow!". Replay only animates
the code example; it does not move the cat. The ferry's paw control toggles
Pause/Play. Reduced motion disables movement. Grooming/walking sprite animation
is not implemented in this first prototype.

The standalone snippets inherit the user's configured model. The release-team
example selects `google/gemini-3-flash-preview` directly through Google, with
`GOOGLE_API_KEY`; no OpenRouter routing is used. The Jev example requires
`kedi[typesafe]` and `TYPESAFE_API_KEY`, but no generative model.
These are local program prerequisites, not website secrets:
the static site never calls a model. Displayed decisions are illustrative, not
measurements or guarantees of correctness.

The movie example uses `httpx` and the official
[TMDB movie details API](https://developer.themoviedb.org/reference/movie-details).
Set `TMDB_API_KEY` to your TMDB API Read Access Token in the Kedi process's
environment. The tool sends it as a Bearer header, requests credits alongside
movie details, applies a 10-second HTTPX timeout, and checks HTTP status before
decoding JSON. It first searches by the supplied film title, then retrieves
details using the ID returned by TMDB. No ID is embedded in the program.
Ambiguous results request a year or a more specific title rather than choosing
an arbitrary match; `movie_details("Dune", 1984)` can distinguish remakes.
No MCP server, Node.js, or
localhost port is needed. No credential is embedded in the example or sent by
the homepage. Tests run the actual tool with mocked HTTP responses, not live
TMDB requests. The example allows its registered tool to execute automatically.

## Verification

```sh
npm run build
npm test
```

Playwright uses an installed Chrome (`channel: chrome`) and a separate temporary
browser profile. `npm test` builds first, then tests the production output on
port 4322, separate from the live development preview to avoid HMR reload races.
Layout checks cover 320, 390, 768, 1440, and 1920px widths.
Tests also cover tabs, clipboard, replay, mobile navigation, and reduced motion.
Screenshots are written into ignored `test-results/`.

The displayed programs also have offline execution tests against the real Kedi
runtime and Pydantic adapter, with deterministic model and Jev SDK responses:

```sh
# From the Kedi workspace root, with test and typesafe dependencies installed:
source .venv/bin/activate
python -m pytest website/tests/test_examples.py -q
```

These check typed bindings, branching, loop/map behavior, real fixture reads,
subagent delegation, HTTP authentication, error handling and typed movie results, Jev criteria
transport, and threshold boundaries. They are integration checks, not live-model
accuracy measurements. The stock example explicitly allows its tools; the
researcher uses a read-only file tool. Review tool permissions before adapting them.

When developing inside the Kedi workspace, validate examples with the real parser:

```sh
source .venv/bin/activate
python << 'PYTHON_EOF'
import json
from pathlib import Path
from kedi.lang.parser import parse_program
for example in json.loads(Path('website/src/data/examples.json').read_text()).values():
    parse_program(example['code'])
PYTHON_EOF
```

## Files

- `src/pages/index.astro`: content and section composition.
- `src/components/`: shared code windows, tabs, and installation control.
- `src/styles/`: separate base/component, section, and responsive styles.
- `src/scripts/interactions.ts`: small client-side interaction layer.
- `assets/source/`: original generated art; `public/assets/`: WebP web assets.
- `assets/README.md`: illustration provenance and prompts.

Fonts are self-hosted Geist and Geist Mono. Icons use Lucide's Astro package.
Dependencies are pinned with a lockfile. Documentation links point directly to
`https://kedi-lang.org/docs/`; source repository links stay on GitHub.
