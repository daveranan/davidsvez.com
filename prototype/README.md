# ASCII Portfolio Creative Developer

This is an intentionally framework-free prototype for validating:

- Departure Mono at its native 11px lattice and 22px rendering size.
- A full-color video-to-ASCII boot sequence driven by source luminance.
- A real glyph-based milestone progress bar.
- Cell-by-cell video/image-to-folder project reveals.
- OS, grid, and list views over the same content.
- Draggable, focusable desktop windows.
- Independently scrollable window interiors.
- Glyph-cycling text resolution during boot and project-folder reveals.
- A three-frame connection handshake during the extended centered loading bar.
- DOM-derived content masks that turn video glyphs into final text and frame glyphs.
- Split-flap OS, grid, and list switching.
- Split-flap window shells before project media appears.
- Direct split-flap project-folder content while the ASCII media preview dissolves.
- A synchronized SVG-masked video logo that physically docks into the responsive Grid and launches the fullscreen reel.
- A compact project-only List view.
- A velocity-sensitive cursor glitch trail that resolves after the pointer rests.
- Top-to-bottom overwriting `EGO.EXE` and `SHADOW.EXE` text buffers seeded from the former site's side-channel copy.
- A right-anchored, punctuation-aware pre-navigation transmission seeded from the former site's long “this is dave speaking” marquee.
- A continuously shifting, film-like glyph-noise field capped at `#0d0d0d` over pure black.
- A custom Departure Mono cursor using `↖`, interactive `╅`, and a shade/quadrant click cycle.
- The cursor glitch remains active over the boot video and its loading controls.
- Cursor corruption uses luma-selected white glyphs with difference blending, producing a localized negative trail rather than a rainbow overlay.
- Images use that same glyph trail directly, without a circular clipped-image effect.

## Run locally

From the repository root:

```powershell
python -m http.server 4173 --directory prototype
```

## Local content studio

Use the separate **Portfolio Studio** desktop shortcut to edit `content/site.json`, copy project media, preview the site, and publish content through Git. The studio lives in `tools/studio`, outside Netlify's `prototype` publish directory.

Projects use a flat, CMS-friendly hierarchy: `parentId: null` places an item in the root `PROJECT_INDEX.DIR`; setting `parentId` places it inside that folder. Folder depth is unlimited and parent cycles are rejected before save. Only items using the `folder` layout can contain children.

Each project chooses one opening mode in the Studio:

- `folder` runs the media-to-ASCII preview, then opens HTML content and child-folder icons.
- `media-fullscreen` runs the same glyph reveal into a viewport takeover for an image or looping video.
- `text-window` opens preserved multiline text in a scrollable window without requiring media.

Folder entries may use the standard overview/meta/action template, an ordered block stream, or both. Studio exposes independent switches for the default overview and footer actions. Blocks can be reordered and can contain text, images, or video; each block spans a full row, one half, or one third of the six-column content grid. Half and third spans collapse to one column on narrow screens. Media blocks accept uploaded files, captions, alternative text, and `cover` or `contain` fitting.

The Studio also includes a Blog workspace. Blog posts have an id, publication date, title, summary, draft/published state, and the same ordered text/image/video block editor used by project folders. Public contact-page copy lives in the Site Settings column; no receiving email address is rendered on the site.

Project window width and height values are minimum authoring bounds. On desktop, ordinary project windows target two-thirds of the live viewport and grow beyond that only when an entry's minimum requires it; viewport caps and the mobile takeover layout prevent overflow.

Navigation, project folders, media labels, and the contact action use a small vendored sprite selected from the [Pixel Icon Library by HackerNoon](https://github.com/hackernoon/pixel-icon-library). Only eight 24px-grid symbols are shipped; the full icon package is not loaded. The free icon license is CC BY 4.0 and requires the visible HackerNoon attribution retained in the site footer. See the [official license](https://pixeliconlibrary.com/license/) and `assets/icons/README.md`.

`windowWidth`, `windowHeight`, and `textWidth` accept CSS sizes such as `748px`, `70vw`, or `62ch`; the server validates those values before writing the content file. Root projects appear as icons in the full-width Grid index. The OS shortcut rack mirrors those same root items.

The seeded `NESTED.DEMO → IMAGE.CHAMBER → FULLSCREEN.SIGNAL` path demonstrates two folder levels followed by an image project using the fullscreen takeover layout. It is ordinary Studio content and can be edited or deleted.

Fullscreen image and video leaves use real source thumbnails in folder shelves. List view replaces the root shelf with a recursive tree containing every project, its hierarchy, layout, media type, description, and author-selected category. Categories are `WEBSITE`, `FILM`, `GAME`, `EXPERIMENT`, or `APP`; hierarchy indentation never shifts the aligned type and category columns.

Then open `http://localhost:4173/`.

On this workstation, the desktop shortcut **ASCII Portfolio Lab** runs `start-prototype.ps1`, starts the server in a hidden process if necessary, and opens the prototype in the default browser.

## Netlify contact delivery

The contact page uses a static HTML form with `data-netlify="true"`, a `form-name` field, URL-encoded AJAX submission, and a honeypot. Netlify detects it during deploy, stores submissions without a custom backend, and uses the visitor's `email` field as the notification Reply-To. See [Forms setup](https://docs.netlify.com/manage/forms/setup/), [spam filters](https://docs.netlify.com/manage/forms/spam-filters/), and [form notifications](https://docs.netlify.com/manage/forms/notifications/).

After the first deploy, enable form detection if it is not already enabled, then go to **Project configuration → Notifications → Emails and webhooks → Form submission notifications** and send verified `contact` submissions to your private receiving address. That address does not appear in this repository or on the public contact page.

## Media hosting

The current prototype is approximately **1.02 MiB** across 17 files; `assets/media/boot-preview.mp4` is approximately **0.80 MiB**. It is safe to keep the present HTML, JSON, fonts, images, thumbnails, and short compressed MP4 previews in the Netlify deploy.

Use this working split as the portfolio grows:

- Keep optimized images, poster frames, and short preview loops on Netlify.
- Keep each deployed media file below 10 MB. Netlify documents files above 10 MB as poorly supported by its CDN and recommends hosting large content elsewhere.
- Put long reels, high-resolution masters, and frequently viewed project videos on a dedicated media CDN or streaming service. Store only the public media URL and poster image in the local CMS.
- External media used by the ASCII renderer must be served with cross-origin access enabled; otherwise the browser will prevent canvas-based luma sampling.

For current credit-based accounts, Netlify Free includes 300 monthly credits. Web bandwidth consumes 20 credits per GB, web requests consume 2 credits per 10,000 requests, and each production deploy consumes 15 credits. If bandwidth were the only usage, 300 credits would equal 15 GB, but real usage also includes deploys and requests. Older legacy accounts may have different allowances, so confirm the active plan in the Netlify usage dashboard.

Official references: [Netlify credit-based pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [build troubleshooting for large files](https://docs.netlify.com/build/configure-builds/troubleshooting-tips/), and [deploy limits](https://docs.netlify.com/deploy/deploy-overview/).

The full reel is hosted on Vimeo and is not stored in the repository. The prototype keeps only the 640px, audio-free boot derivative at `assets/media/boot-preview.mp4`, its first frame at `assets/media/boot-first-frame.webp`, and `assets/media/logo.svg` as the identity mask. The boot moves through four representations of one synchronized source: colored ASCII, unfiltered fullscreen video, fullscreen video clipped by the SVG logo, and the same live masked-video element resizing into its permanent Grid cell. Boot rendering applies a dedicated contrast curve and modest color gain: shadows use darker, sparser glyphs while highlights become denser, avoiding the flattened result of a global luma lift.

In Grid view, `PROJECT_INDEX.DIR` keeps the full first row with compact 110px project tiles. The row beneath is a responsive `2fr / 3fr / 2fr` composition of `EGO.EXE`, the live video-logo reel launcher, and `SHADOW.EXE`; `CHARACTER_MONITOR.EXE` spans the following row. At the mobile breakpoint this composition returns to the normal single-column flow.

The loading prelude also uses `boot-connect-01.webp` through `boot-connect-03.webp`, extracted from the first three frames of the 13-second source offset and cycled for 1.5 seconds as a connection handshake.

When the loading prelude completes (or is skipped), its panel is first consumed by the same dense glyph field used by closing project windows. The panel shell is then removed beneath that field while the glyphs clear away, revealing the boot imagery instead of abruptly hiding the panel.

The content handoff intentionally uses two coordinated layers: a coarse video-cell mask and an exact DOM-positioned split-flap layer. Video cells disappear before the final characters settle, avoiding a visible fade between mismatched grids.

After the logo, the real interface immediately runs the exact dense split-flap routine used by OS/Grid/List switching. The obsolete sparse 22px fake-UI stage is skipped. Images load through a color, luma-driven 11px ASCII cycle, then staggered glyph cells clear to expose the already-aligned bitmap beneath; the boot handoff and fullscreen project media use that same mechanism instead of whole-canvas opacity fades.

After boot, move the pointer quickly across text and window frames. Pointer movement deposits a short-lived trail that replaces the interface beneath it with color video sampled through luma-selected glyphs. Nearby DOM text cycles through the same split-flap alphabet, and the trail settles from oldest to newest after movement ends. The first frame remains the fallback if the looping video cannot be sampled.

The header is a clipped, right-anchored tape: each incoming character glitches at the right edge, settles, pushes the previous copy left, and pauses longer at punctuation. `EGO.EXE` and `SHADOW.EXE` write from the top-left toward the bottom-right; once their measured lattice fills, the write head returns to the top and continuously overwrites old copy. Sentences are joined by ` ... ` rather than manually composed around line breaks. The old public email line is intentionally omitted.

## Interaction checklist

- Let the boot complete, then replay it with `[REPLAY BOOT]`.
- Skip the boot with pointer and keyboard.
- Switch between OS, grid, and list.
- In OS view, drag windows by their title bars.
- Click overlapping windows to raise them.
- Open `SIGNAL.STUDY` for the video pipeline.
- Open `STATIC.TRANSMISSION` for the image pipeline.
- Resize below 720px to validate the single-column flow.
- Test browser zoom at 100%, 200%, and an awkward intermediate value.
- Enable reduced motion and confirm that media dissolves are bypassed.

## Known prototype boundary

Windows use stable CSS borders rather than character-built frames. Opening a folder briefly activates four independent segmented glitch lines along its inner edges; those lines are a non-content overlay and disappear after the reveal, so they cannot cross the case-study body or affect scrolling. A future shared-edge compiler could still resolve adjacent Grid blocks into `├`, `┬`, `┼`, and related junctions without reintroducing a full text frame above the content.
