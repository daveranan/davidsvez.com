# Portfolio Studio

Local-only authoring UI for `prototype/content/site.json`, `prototype/content/projects.json`, and project media.

## Workflow

1. Open the **Portfolio Studio** desktop shortcut.
2. Edit projects, the Character Monitor homepage grid, blog posts, contact details, or the header/EGO/SHADOW transmissions; optionally upload image/video media.
   Projects can be kept in the CMS while removed from site navigation with **Hide from site navigation**.
3. Choose **Save Local** and inspect **Preview Site**.
4. Choose **Publish → Git** to commit only content/project-media paths and push the current branch.
5. A Netlify project linked to this repository automatically deploys the push.

The server binds to `127.0.0.1`, uses a per-session token, has no runtime dependencies, and is outside the Netlify publish directory.

Project, homepage, and blog block streams accept text, uploaded image/video media, or a YouTube video link rendered as a responsive embedded player.

Every upload is first preserved unchanged in the local, git-ignored `prototype/assets/media/og-library/Projects/` library. The Studio then creates a publishable file in `prototype/assets/media/optimized/Projects/` and returns only that optimized path to CMS content. Videos over 30 seconds are cut to 18 seconds, encoded as silent fast-start H.264 MP4s, and images are resized/converted to WebP. Existing source files can be migrated with `npm run media:optimize` after placing them in the original library.

The first repository/Netlify setup is still manual: push the full codebase to a Git host, import that repository in Netlify, and use `prototype` as the publish directory (also declared in `netlify.toml`).
