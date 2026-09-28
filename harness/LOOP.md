# The loop

How a scene gets made. Each step is a separate agent so the maker never grades
its own work.

1. **Brief.** A technique plus a constraint, from `briefs/`. One brief per maker.
2. **Make.** The maker reads `TASTE.md`, `../web/CONTRACT.md` and
   `README.md`, writes `web/scenes/<id>.js`, and renders it with
   `node harness/render.mjs`. It looks at `sheet.png` and a couple of full-size
   frames, and revises until it would defend the piece to the critic, for at
   most five renders. It records what it tried in the scene's `gallery.lineage`.
3. **Critique.** One critic sees every contact sheet in the batch at once (so it
   judges comparatively), plus each scene's code and `report.json`. It scores
   each against `TASTE.md` and writes specific, actionable notes.
4. **Revise.** Each maker gets its notes, revises, re-renders. One round, two
   at most.
5. **Verdict.** The critic re-scores. Scenes that meet the bar in `TASTE.md`
   ship to the gallery (added to `web/index.html`); the rest are kept in
   `web/scenes/` with their notes, unlisted, as material for later batches.
6. **Breed** (later). Raph picks favourites; new briefs are variations of them.
