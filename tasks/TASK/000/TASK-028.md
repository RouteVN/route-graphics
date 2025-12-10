---
title: Fix font size inconsistencies
status: todo
priority: medium
assignee: han4wluc
labels: [bug]
---

# Description

- root cause seems to be because we're using arial font. but that one is not installed in pure linux env by default.
- we need to pick a font and make sure it is installed for all environments.


- width being 419 vs 420 and x being 451 vs 450 I supsect is due to font size different. my system is using a different font therefore having different font sizes. font usually fallback to system when specified font is not found
- wordWrapWidth should be rounded to pixel

Got the below errors when running test:

```diff
 FAIL  puty.test.js > parser > parseText > Test parsing simple text o
bject
AssertionError: expected { id: 'tl', type: 'text', …(11) } to deeply 
equal { id: 'tl', type: 'text', …(11) }

- Expected
+ Received

@@ -40,9 +40,9 @@
      "strokeColor": "transparent",
      "strokeWidth": 0,
      "wordWrap": false,
    },
    "type": "text",
-   "width": 419,
-   "x": 451,
+   "width": 420,
+   "x": 450,
    "y": 226,
  }

 ❯ node_modules/puty/src/puty.js:261:30

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  puty.test.js > parser > parseTextRevealing > Test parsing text
-revealing with multiple styled content segments
AssertionError: expected { id: 'tr4', …(12) } to deeply equal { id: '
tr4', …(12) }

- Expected
+ Received

@@ -31,13 +31,13 @@
              "fontSize": 16,
              "lineHeight": 19,
              "strokeColor": "transparent",
              "strokeWidth": 0,
              "wordWrap": true,
-             "wordWrapWidth": 144.65625,
+             "wordWrapWidth": 144.27734375,
            },
-           "x": 55.34375,
+           "x": 55.72265625,
            "y": 19,
          },
          {
            "text": "World",
            "textStyle": {
@@ -49,13 +49,13 @@
              "fontWeight": "bold",
              "lineHeight": 38,
              "strokeColor": "transparent",
              "strokeWidth": 0,
              "wordWrap": true,
-             "wordWrapWidth": 140.2109375,
+             "wordWrapWidth": 139.83203125,
            },
-           "x": 59.7890625,
+           "x": 60.16796875,
            "y": 0,
          },
          {
            "text": "!",
            "textStyle": {
@@ -66,13 +66,13 @@
              "fontSize": 28,
              "lineHeight": 34,
              "strokeColor": "transparent",
              "strokeWidth": 0,
              "wordWrap": true,
-             "wordWrapWidth": 50.1484375,
+             "wordWrapWidth": 49.76953125,
            },
-           "x": 149.8515625,
+           "x": 150.23046875,
            "y": 4,
          },
        ],
        "y": 0,
      },

 ❯ node_modules/puty/src/puty.js:261:30

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  1 failed (1)
      Tests  2 failed | 33 passed (35)
   Start at  15:40:38
   Duration  529ms (transform 13ms, setup 18ms, collect 171ms, tests 
72ms, environment 202ms, prepare 2ms)

error: script "test" exited with code 1

```
