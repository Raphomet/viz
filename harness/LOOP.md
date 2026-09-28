# The loop

How a scene gets made. Each step is a separate agent so the maker never grades
its own work.

1. **Brief.** A technique plus a constraint, from `briefs/`. One brief per maker.
2. **Make.** The maker reads `TASTE.md`, `../web/CONTRACT.md` and
   `README.md`, writes `web/scenes/<id>.js`, and renders it with
   `node harness/render.mjs`. It looks at `sheet.png` and a couple of full-size
   frames, and revises until it would defend the piece to the critic, for at
   most five renders. Before settling defaults it renders every option and the
   extremes of the sliders that matter, because the best version is often
   hiding behind a control. Its last renders are of the final code, at full
   size: the 24 s test and a 96 s run (`--seconds 96 --frames
   12,24,36,48,60,72,84,96`), since the real failures (saturation, grain,
   mush, stasis) mostly appear after 24 s. It records what it tried in the
   scene's `gallery.lineage`.
3. **Critique.** One critic sees every contact sheet in the batch at once (so it
   judges comparatively), plus each scene's code and `report.json`. It scores
   each against `TASTE.md` and writes specific, actionable notes.
4. **Revise.** Each maker gets its notes, revises, re-renders. One round, two
   at most.
5. **Verdict.** The critic re-scores. Scenes that meet the bar in `TASTE.md`
   ship to the gallery (added to `web/index.html`); the rest are kept in
   `web/scenes/` with their notes, unlisted, as material for later batches.
6. **Breed** (later). Raph picks favourites; new briefs are variations of them.

## Writing briefs

Lessons from batch 01 (2026-09-27):

- **Name a technique and demand a departure from it.** Briefs that named only
  a technique got the textbook look (a Clifford attractor, two-ring moiré,
  standard Gray-Scott tubes). The winner broke its technique on purpose:
  Current made its flow deliberately non-divergence-free so drains and voids
  form. Every brief now asks for one named departure.
- **Say where the eye goes.** Without a composition note the results split
  into all-over wallpaper and single centred objects.
- **Describe the drop as the most structured moment**, and say what the kick
  should *drive* (a rate, a phase, a pressure) rather than what it should
  *trigger*.
- **Run makers in parallel, but time on an idle machine.** Six makers rendering
  at once inflated timings two to three times; re-render the batch serially
  before the critic reads timings.
