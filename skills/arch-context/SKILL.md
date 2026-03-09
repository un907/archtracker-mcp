---
name: arch-context
description: Load the current architecture context into the session. Auto-detects multi-layer projects. Use at the start of a new session or when you need to understand the project structure. Prevents hallucination of old file paths.
allowed-tools:
  - mcp__archtracker__get_current_context
---

## Load Architecture Context

Retrieve and display the current project architecture context.

1. Call `get_current_context` to get valid file paths and architecture summary
   - For multi-layer projects: set `projectRoot` to the project root where `.archtracker/layers.json` exists
2. Internalize the returned structure so you reference only existing files
3. Display a brief summary to the user

Present results in the user's language:
- Valid file paths (organized by layer if multi-layer)
- Architecture overview summary
- Time since last snapshot (if available)
- Layer structure and cross-layer connections (if multi-layer)

**Important**: Use this context to avoid referencing non-existent file paths in subsequent interactions.
