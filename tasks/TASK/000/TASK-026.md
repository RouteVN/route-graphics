---
title: Consecutive renders bug
status: done
assignee: nghia
priority: high
---

# Description

I created a spec for: `vt/specs/container/update-direction-2.yaml`

if we call normal `app.render` it works fine.

However if we call `app.render` 2 times immediately, the result messes up. one quick way to test it was to change the code for keypress `n` and `b` to call render 2 times.

because render is async, my hypothesis is the next render executes before the previous one is done.

