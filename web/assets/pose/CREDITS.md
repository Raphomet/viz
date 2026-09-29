# Pose assets

Used by `web/pose/kit.js` and the five MediaPipe scenes, `web/scenes/pose1.js`
… `pose5.js`.

## The dance

| File | What it is |
|---|---|
| `little-tich-1900.mp4` | 40 s of the film below (76.5–116.5 s of the archive.org file), cropped to its 4:3 picture, converted to greys, 640×480, H.264, 3.0 MB |
| `little-tich.pose.json` | MediaPipe pose landmarks and world landmarks for every frame of that clip, 30 fps, 1,202 frames (0.63 MB) |
| `little-tich.masks.png` | MediaPipe's person segmentation mask for every frame, 160×120, three frames per tile in R, G and B (1.5 MB) |

**Little Tich et ses Big Boots** (the Big-Boot Dance), Harry Relph as
Little Tich, directed by Clément Maurice for the Phono-Cinéma-Théâtre, Paris,
1900. **Public domain**: published 1900; Maurice died in 1933 and Relph in
1928, so it is out of copyright everywhere, and archive.org marks the item
with the Creative Commons Public Domain Mark 1.0.

Source: https://archive.org/details/little-tich-big-boot-dance-et-ses-big-boots-1900-directed-by-clement-maurice
(downloaded 2026-09-29). That upload is a modern colourised transfer; the clip
here is converted back to greys, which drops the colourisation.

Trimmed and re-encoded with `harness/pose/trim.mjs` (installed Chrome's
MediaRecorder; ffmpeg is not on the laptop) and remuxed with macOS
`avconvert`. Landmarks and masks baked with `harness/pose/bake.mjs` using
MediaPipe tasks-vision 1.0.1 and `pose_landmarker_heavy` (float16), which is
not bundled (30.7 MB, over the 15 MB file cap).

## Models

| File | Model | Size | Licence |
|---|---|---|---|
| `models/pose_landmarker_lite.task` | MediaPipe Pose Landmarker (lite, float16) | 5.8 MB | Apache-2.0, Google |
| `models/selfie_segmenter.tflite` | MediaPipe Selfie Segmenter (square, float16) | 0.25 MB | Apache-2.0, Google |

Downloaded 2026-09-29 from `storage.googleapis.com/mediapipe-models/…/latest/`,
unaltered. They are bundled because that host is outside the Artifact's CSP.
The library itself (`@mediapipe/tasks-vision@1.0.1`, Apache-2.0) and its WASM
load from cdn.jsdelivr.net.
