---
template: docs-documentation
title: Using the Playground
tags: documentation
sidebarId: guide-playground
---

The playground is the fastest way to try Route Graphics states without building a separate host app.

## What You Can Do

- load a built-in template from the selector
- edit raw YAML in place
- move through multi-state examples with `Previous` and `Next`
- inspect emitted events in the event log
- reset the current template back to its baseline
- copy the current YAML
- copy a shareable URL for the current template or custom YAML

## Share URL Rules

The playground supports two URL modes:

- `?template=<id>` for built-in templates
- `?yaml=<encoded-yaml>` for custom editor content

If the current state list has multiple entries, the share URL also carries `state=<1-based-index>`.

## Why The Event Log Matters

Many Route Graphics behaviors are event-driven:

- hover/click/change payloads
- global keyboard events
- `renderComplete`

The playground records those so example templates are debuggable without opening the browser console.

## Suggested Workflow

1. Start from the closest built-in template.
2. Change one node or one animation at a time.
3. Watch the event log after each interaction.
4. Copy the share URL when you have a state worth reviewing.

Jump straight to the [Playground](/playground/).
