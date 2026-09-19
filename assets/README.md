# Illustration Assets

Scene illustrations were generated with the built-in image-generation tool on 2026-09-19. Original PNGs
are preserved in `source/`; WebP copies use Sharp at quality 90, proportionally
resized for the web without cropping. The approved landing-page mockup was the style and
character reference. No third-party stock assets are used.

The brand mark comes from the user-supplied `source/kedi-logo-original.jpg`.
With the user's approval, Sharp converts its white background to transparency,
preserves the original black strokes and antialiased edges, and trims excess
outer space with a transparent margin. The result is `source/kedi-logo.png`;
the header and footer use its 256px WebP copy. A separate 64px favicon uses a
light background so the black emblem is also visible in dark browser chrome.
No generatively redrawn logo is used. Rerun `npm run assets` to reproduce it.

## Istanbul panorama

Production bitmap asset, background only for a website, not a mockup. Match the
refined pixel art and dither of the approved terrace reference, but make it
recognizably Istanbul. No text, logos, windows, code, cats, or badges. A pale
stone balcony above the Bosphorus with Galata Tower at the far left, muted tiled
rooftops, pale silver-blue water, and a distant shore. Stone ledges and restrained
ivy at the bottom corners. Keep the upper center mostly empty, very pale
offwhite #F5F6F2 for overlaid heading and code. Precise 1990s bitmap style, no
dark vignette or blur.

## Cat

Production transparent-background character sprite. Isolate the approved black
and white tuxedo cat with golden collar and tag from the reference. Full body
sitting, ears erect, white muzzle, chest and paws, charcoal fur, curved tail to
the right. Looking slightly left toward the code. Hard square pixels and subtle
dither, not smooth painting or 3D. Preserve the reference proportions, with a
small transparent margin.

## Harness

Transparent-background landscape pixel illustration. Offwhite 1990s CRT and
keyboard, slightly isometric, dark fern-green screen with sparse code-shaped
marks and yellow cursor. The same small tuxedo cat rests one paw on the
keyboard. A tulip-shaped Turkish tea glass and saucer beside it. Precise square
pixels, restrained dither, no enclosing panel, backdrop, label, or invented
readable text.

## Ferry

Transparent-background side view of a classic Istanbul Sehir Hatlari ferry,
facing right. White decks, dark green trim, yellow and black funnel, small
Turkish flag. A tiny tuxedo cat with yellow collar on the deck. Refined 1990s
pixel style and restrained dither. Wide layout with a small pixel wake, no
background scene, labels, or border.

## Team avatars

`team-mert.png` and `team-yigit.png` are generated front-facing pixel portraits,
without glasses or accessories. Mert's white and brown tabby markings reference
a user-provided photograph; that private photograph is not included here.
Yigit's portrait depicts a white Turkish Angora with blue eyes. Both use the
same coarse pixel style, upright framing and transparent square canvas.
Their web copies are 256px lossless WebP,
resized with nearest-neighbor sampling to preserve the pixel edges.

## Other assets and reproduction

The notebook screenshot at `public/assets/kedi-notebook.png` is an unmodified
copy of `notebook/.github/assets/kedi-notebook.png`, the real product screenshot
already used in the notebook README. It is not an AI-generated interface.

From `website/`, after dependency installation:

```sh
npm run assets
```
