// Generator for lottie5.json ("Write On"): kinetic type from the Monoline
// strokes in type.js.
//   node web/assets/lottie/gen-lottie5.mjs [words separated by /]
// The scene builds the same JSON in the browser from its "Words" parameter
// (type.js runs in both places); this writes the default set to disk so the
// animation exists as a file, and so it can be inspected or opened in any
// Lottie player.
import { writeFileSync } from 'node:fs';
import './kit.js';
import './type.js';

const words = (process.argv[2] || 'LOUDER / ONE MORE TIME / TOGETHER / ALL NIGHT / AGAIN').split('/').map((w) => w.trim()).filter(Boolean);
const data = globalThis.VIZ_LOTTIE.type.build(words);
const out = new URL('./lottie5.json', import.meta.url);
writeFileSync(out, JSON.stringify(data));
console.log('wrote', out.pathname, (JSON.stringify(data).length / 1024).toFixed(0) + ' KB', words.join(' | '));
