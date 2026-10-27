# Résumé source coverage

Sources visually inspected in full:

- `David Svezhintsev Resume - Product Designer _ Design Engineer.pdf`: one page,
  referred to as **product** in `resume.json`.
- `Copy of David Svezhintsev Resume 2025 ENG.pdf`: two pages, referred to as
  **game** in `resume.json`.

The original documents are linked unchanged from the résumé page. The public
website uses one consolidated experience list, not duplicate job histories.

## Coverage mapping

| Source information | Integrated location |
| --- | --- |
| Both headline variants; product profile and 10+ years | `resume.json` headline, summary, versions; `site.json` profile |
| Primary site, email, phone; older second-page site | Résumé contact, contact settings, source versions/downloads |
| Wanderstar, May 2023–present; game/film/writing/art scope | Résumé experience; Lightkeeper, KERN, Flax, and Daedalus film cases |
| Lightkeeper concepts, pitching, funding, design, UI/UX, progression, level design, prototyping, production | Main Lightkeeper case and compact 11-block override |
| Pitch deck, GDD, writing, world building, map layouts, content creation, marketing | Wanderstar résumé bullets and Lightkeeper contribution overview |
| KERN systems, tools, interfaces, in-engine prototyping, hands-on iteration | KERN case and Wanderstar résumé bullets |
| Flax editor UI/workflows/feedback; selected upstream contributions | Flax implementation-status block and Wanderstar résumé bullets |
| Film writing, pitching, direction, production, edit, 12-person production | Daedalus film case and both relevant résumé entries |
| Unfold project/product title variants; June 2020–May 2023 | Consolidated résumé entry with source-specific date/title variants |
| Dronies nine teams, roughly 30 contributors, Solana Labs, marketing plan, approximately US$3M | Dronies scope/launch block and Unfold résumé entry |
| Product strategy, UX concepts, interaction design, design systems; UserWise and Merck | Unfold résumé entry, existing UserWise case, new short Merck brief |
| Bolt 2.0 UX docs/mockups, 278 icons, Unity API-function scope, in-engine export/iteration | Expanded Bolt case and dated résumé entry |
| Daedalus ownership, Sep 2022–Aug 2023; story/world; 9,000 inputs; 12 Rive panels; reader/soundtrack; brand/merch; film | Main/comic/film cases and separate Daedalus résumé entry |
| Bad Jupiter chatbot/web app, user research/personas, onboarding, wireframes, flows, prototypes, hi-fi mockups, Figma/Framer, Product Hunt | New Bad Jupiter brief and résumé entry |
| Idea Ranch websites, Toyota/Remington/Christie Cookies/Carhartt, requirements/IA/flows/design/implementation, Sketch/Photoshop, documentation | New Idea Ranch brief and résumé entry |
| All 16 client/brand names | Résumé clients list, with agency-work context |
| Figma, Framer, Rive, Photoshop, Illustrator, Sketch, HTML/CSS/JS, C#/C++, Flax, Unity, Unreal | Résumé skills groups |
| Tulsa UX co-organizer and speaker; beginner Figma course; Adobe XD Live courses | Résumé community section; shared profile data |

## Reconciliation and bounds

- **Idea Ranch:** product source ends in January 2017; game source ends in April
  2017. The consolidated display uses **2015–2017**. Both exact source periods
  are retained in `dateVariants`; no month was silently chosen.
- **Dronies:** the product source describes approximately **US$3M in sales**;
  the older game source says “profited $3m.” Public copy uses the sales wording
  and does not turn it into a profit claim or individual design impact.
- **Bolt:** the game source labels the engagement “Unity - Bolt Visual
  Scripting.” Existing project history distinguishes the commissioned Bolt work
  from its later inclusion in Unity Visual Scripting. The site preserves that
  distinction rather than inferring direct Unity employment or an editor-wide
  redesign.
- **Daedalus:** the existing 12-page comic and the newly supplied **12 animated
  Rive panels** are different counts. The **9,000 generated source images** are
  inputs and attempts, not a claim of 9,000 finished illustrations. The film's
  White Mirror/Venice boundary remains unchanged.
- **Unquantified language:** the older source's “multi-million client accounts,”
  “multi-million dollar websites,” and Bad Jupiter sign-up uptick do not define
  budgets, revenue attribution, or a measured conversion change. Public copy
  retains the actual work, named clients, and launch contribution without
  inventing those measures. The unchanged PDFs retain the original wording.
- **Clients:** the source list does not establish the project scope or direct
  contractual relationship for every brand. The résumé labels them client and
  brand experience and notes that work includes agency delivery.
- **Education and languages:** neither source supplies these details. Their
  data arrays are empty; no school, degree, or proficiency was inferred.
- **Source dates:** all document/article dates are preserved. Only the
  Daedalus case's project period and Bolt case's previously missing period were
  expanded with the newly supplied dated engagement evidence.

No source PDF was edited. No generated route or content bundle was built during
this integration pass.
