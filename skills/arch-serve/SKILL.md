---
name: arch-serve
description: Launch the interactive architecture graph viewer in the browser. Visualizes dependency graphs with force-directed layout, convex hull layer grouping, diff highlighting, and hierarchy view. Use when the user wants to see the architecture visually.
argument-hint: "[port number, e.g. 3000]"
---

## Launch Architecture Viewer

Start the interactive web-based architecture viewer.

Run the following CLI command via Bash:
```
archtracker serve --root <projectRoot> --port <port>
```

- Default port: 3000
- For multi-layer projects: use `--root <dir>` pointing to the directory containing `.archtracker/layers.json`
- For single-directory projects: use `--target <dir>` to specify the source directory
- Add `--watch` for auto-reload on file changes

The viewer provides:
- **Graph view**: Force-directed dependency graph with layer grouping (convex hulls), cross-layer links, and layer tab filtering
- **Hierarchy view**: Depth-based layout showing import hierarchy levels with layer filtering
- **Diff view**: Visual comparison against saved snapshot highlighting added/removed/modified files
- **Settings**: Node size, gravity, layer cohesion, link opacity, cross-layer link toggle, theme, and language

After launching, inform the user of the URL (http://localhost:<port>) and available features.
