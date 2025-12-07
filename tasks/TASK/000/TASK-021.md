---
title: Standardize event names
status: done
priority: high
---

# Description

the below code as the following issues

```js
        eventHandler(`${id}-drag`, {
          _event: { id, value: currentValue },
          ...drag.actionPayload,
          currentValue,
        });
```

- id is already present in `_event.id`, so not is not necessary to have it in the event name
- event name should only be event name
- follow event name of our domain, such as `click`, `hover`, etc...
- inspired, but not same has the HTML events https://www.w3schools.com/tags/ref_eventattributes.asp, and pixijs events: https://pixijs.com/8.x/guides/components/events#event-types
- event name and payload should be well documented, and structurarlly documented, similar to how we use json schema to docuument the yaml schema.



