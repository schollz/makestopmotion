# makestopmotion.com

A free, local-first, hands-free stop-motion camera built with Vite, React,
MediaPipe, Handtrack.js, and ml5.js. Camera frames and captured photos stay in
the browser and are never uploaded.

## Run

```sh
make serve
```

Open the local URL shown by Vite in desktop Chrome or Edge. The command checks
and installs npm dependencies before starting the app.

## How capture works

1. Start the camera and allow access.
2. Bring a hand into view to arm capture.
3. Adjust the scene.
4. Move your hand clear. One frame is captured after the configured delay.
5. Bring your hand back before another automatic frame can be taken.

Use the **Hand detector** control to choose between MediaPipe finger landmarks,
Handtrack.js gesture boxes, and ml5 HandPose landmarks running on TensorFlow.js.
The choice is saved in local storage. All detectors run inference in the
browser; Handtrack.js and ml5.js download their pinned library or model files
the first time they are selected.

Frames persist in IndexedDB on the current browser. The preview player can
download the sequence as a WebM video without uploading any images.

## Checks

```sh
make test
make build
```
