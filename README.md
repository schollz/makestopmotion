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

## Environment

`SITE_URL` sets the public HTTP(S) origin used by canonical links, Open Graph
metadata, JSON-LD, `robots.txt`, and `sitemap.xml`. It defaults to
`https://makestopmotion.com`.

Set both `UMAMI_URL` and `UMAMI_WEBSITE_ID` to enable the Umami tracker on every
page. `UMAMI_URL` is the Umami origin (for example,
`https://umami.example.com`); if either value is missing, no tracker is loaded.
See `.env.example` for the complete configuration.

The Docker image applies these values when the container starts, so the same
image can be reused across deployments without rebuilding it. Vite also reads
the variables from the shell or a local `.env` file during development and
standalone builds.

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
