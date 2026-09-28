# Batch 06 · The panel's ideas

The six judges (harness/review/) proposed 54 new scenes, merged into 25 in the
panel report. Raph (2026-09-28): "I'd love to see the 25 proposed new ideas too,
as sketches." Each idea below is quoted from the report: its title, lineage (the
existing scenes or artists it grows from), the look, how the music lands, and
the judge(s) who proposed it. Where an idea names alternatives ("or"), the
maker picks the strongest one (or a fusion) and says why.

## Built for the new performer model

Raph decided (2026-09-28) that the arc of a set belongs to the VJ: the beat
stays automatic, but build/drop/breakdown are shaped by hand with per-scene
snapshots and a morph fader in the core (and an optional Drop button). So every
scene in this batch:
- exposes everything its drop changes as ordinary params (layers, speed,
  palette, density, camera, etc.), so snapshots can capture them;
- declares `presets: { calm: {…}, drop: {…} }` in its def (param values for a
  calm state and a drop state; add one or two more named presets if the scene
  has other great states);
- keeps a `follow` param ("Follow the track", default on) that lets the scene
  move itself between its calm and drop looks from the audio as scenes do
  today, so it works unattended and the render harness can test it. With it
  off, only the params (and so the VJ) decide the look.

Everything in harness/TASTE.md still applies.

## The 25 ideas

The originals, re-imagined
Four ideas that give the 2016 sketches a proper stage.
Swiss Grid, or Line
Arcs, Rings and Jags; Müller-Brockmann’s concert posters; Agnes Martin
A strict grid of concentric arcs in one or two inks, or hand-ruled graphite lines across a pale canvas. The kick moves one circle to its next cell or lays a wash between two lines; the breakdown erases from the top down.
DesignerCurator
Moiré Weave
Interference crossed with Jags
Two sheets of band-driven polylines, one a beat behind the other, so the moiré is literally the difference between the music now and a beat ago. Black on cream with one vermilion thread.
Purist
Guilloché
Parametric Lines; banknote engraving
Engraved rosettes in security green with a microprint border. The bass modulates the rosette, hats flicker the microprint, and the drop prints a second ink in register.
Designer
Sand Traveler Orbits
Planets, Magnetosphere, Tarbell’s Sand Traveler
The planets are never drawn; grains sprinkled between each pair paint their relations onto accumulating paper. The kick adds a moon, which adds a new relation to paint.
Purist
Generative systems
Rules that make images their authors did not draw.
Substrate City
Tarbell’s Substrate, Iso City, Stamps
Crack-walkers lay a city plan of fine black lines on cream, shaded with sand-painted colour. The kick spawns a crack where the beat last landed; the drop raises the spawn rate; a full plate re-papers cell by cell.
Purist
Things that grow
Differential growth, space colonisation, DLA frost
A folding coral line, a tree reaching for food, frost creeping across a dark window. Bass sets the growth rate or temperature, the kick seeds new growth in one place, and the drop is a visible frenzy.
Purist
Woven rules
Knit, Stamps, Chomper; wave function collapse; Wolfram automata; Interference
A tapestry collapsed tile by tile at tempo, a cellular-automaton runner carpet written one row per beat, or two knitted sheets drifting into moiré. The snare swaps the rule or tile set; the drop opens several frontiers at once.
PuristPsychonaut
Pen on paper
Plotter and harmonograph; Thresholds, Zen, Attractor
A pen visibly drawing one continuous line in real time. The kick lifts the pen or nudges a pendulum, the snare swaps pens, and the breakdown slides in a fresh sheet with the last drawing faint beneath.
PuristCurator
Trance and flight
Places to fall into, for the altered viewer.
Material tunnels
Mandala crossed with Coral, Current and Orphism
A feedback tunnel whose walls are reaction-diffusion reef, curl-noise smoke, or matte Delaunay discs with no glow at all. The kick seeds a new ring at the vanishing point; bass sets flight speed.
Psychonaut
Engraved Deep
Thresholds crossed with Abyss
A descent through an ocean drawn as Victorian engraving: hatched jellyfish, marine snow, a whale’s flank sliding past on the drop. The kick contracts one bell, darker rather than whiter.
FloorPsychonaut
Droste Garden
Iris crossed with Bloom
A slow zoom into a mandala flower whose centre is a window onto another garden, forever. Each phrase completes one step; the kick flares one petal ring; the drop speeds the fall.
Psychonaut
Aurora, re-inked
Aurora crossed with Attractor, or with Terminal
Attractor’s silk hung as curtains over the mirror lake, or the whole scene drawn in glyphs on black. The kick runs a white edge along one ribbon, or a ripple of characters across the lake; the drop adds colour.
PsychonautFloor
Sand Rose
Chladni crossed with Zen and Mandala
A raked garden mirrored six ways, its rake lines Chladni nodal lines. The snare flows every grain to a new rose; the kick drops one pebble whose ripples rake outward. The Floor’s variants add dancers’ footprints or a low stage view with side spotlights.
PsychonautFloor
Graphic and print
The traditions the Designer found missing, and print processes that carry the build.
Psychedelic Fillmore
Wes Wilson and Victor Moscoso
Letterforms melting to fill a silhouette in vibrating complementary pairs: the one place where vibrating colour is historically right. The snare swaps the pair; the drop brings concentric outlines.
Designer
Blue Note sleeve
Reid Miles
Huge condensed words cropped at the edge, a tinted photo, three flat inks. Each bar re-sets the word stack like a drummer’s fill; the drop reverses the layout out of black. The Designer also lists Polish, Japanese modernist and Vienna Secession posters as gaps.
Designer
Press sheet
Letterpress crossed with Skyline; risograph duotone
A dark press sheet where each kick prints one firework as an ink stamp, or two riso drums whose misregistration the music shifts. The drop overprints; the breakdown pulls a fresh sheet.
FloorDesigner
Figurative worlds
Stories that land on the downbeat.
Night Market
Expressway, Diner, Night Train; Physarum
A slow tram ride through neon signs, steam and lanterns, entering a covered arcade on the drop. The kick swings one lantern. The Psychonaut’s Vein City flies over a landscape whose roads are a living slime network.
FloorPsychonaut
Laser Congregation
Rave crossed with Ophanim
A cathedral nave with Ophanim’s ring of eyes as the rose window and lasers sweeping through incense. The kick is one laser fan; the drop opens and turns the window.
Floor
Stage and strings
Paper, Zagreb, Penny Dreadful, Thresholds
A marionette lifted onto its toes through the build and dancing loose on the drop, or a woodcut theatre whose curtain rises a notch per kick and reveals a different set each drop.
Director
Railway Handcar
Night Train, Zagreb, Cube
Two cartoon men pumping a handcar: the kick is the lever. The build climbs a hill, the drop crests and plunges, the breakdown coasts along a lake at dusk.
Director
The Lighthouse Keeper
Isle, Sumi, WPA
A three-ink riso seascape at night. The build brings in a storm as the keeper climbs; the drop lights the lamp across the bay; the kick is one flash catching one boat.
Director
Quiet and minimal
Scenes for 5 a.m., with almost nothing in the frame.
Skyspace
Turrell; Mobile; Sumi
A ceiling with a square aperture onto drifting sky. The kick sends one bird across; the drop brings sky and ceiling to equal luminance so the edge dissolves.
Curator
Seascape
Sugimoto; Murmuration; Sumi
A horizon at half height, grey on grey, the swell tracking past. The kick runs one crest of foam; the drop sharpens the horizon; the breakdown mists it away.
Curator
Ripple Tank
Koi, Interference, Chladni
Black water from above, lit so only the ripples show. Each kick drops one drop and the rings interfere; the snare drops two, making hyperbolic nodal lines.
Curator
Fold
Letterpress, Mobile, Paper
One sheet of white paper under a low lamp folding itself into an origami form, one crease per kick. The breakdown unfolds it, leaving the ridges of everything it has been.
Curator
Further single proposals from the Director: Kite Festival, Paper Plane, Weather Clock, Bakery at 4 AM and Relay. From the Floor: Pinball and Flipbook. From the Psychonaut: Koi Sky. From the Designer: Olympic pictograms. From the Curator: Datum and Weather.
