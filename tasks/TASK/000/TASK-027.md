---
title: Container children text sizes
status: done
priority: high
---

# Description

container with direction horizontal, with children text

current: the following yaml data produces overlapping text
expected: text should not be overlapping

```yaml
elements:
  - id: story
    type: container
    x: 0
    'y': 0
    children:
      - id: layout-j3i8dk32
        type: container
        x: 0
        'y': 0
        children:

          - id: container
            type: container
            direction: horizontal
            gap: 20
            x: 160
            'y': 540
            children:
              - id: Start
                type: text
                content: 'XStart '
                textStyle:
                  fontSize: 48
                  fill: white
                hover:
                  textStyle:
                    fontSize: 48
                    fill: yellow
              - id: Load
                type: text
                content: 'XLoad '
                eventName: system
                eventPayload:
                  actions:
                    addModal:
                      resourceId: dafkjkl3
                    updateVariable:
                      operations:
                        - variableId: currentMenuTabId
                          op: set
                          value: load
                        - variableId: isMainMenu
                          op: set
                          value: true
                textStyle:
                  fontSize: 48
                  fill: white
                hover:
                  textStyle:
                    fontSize: 48
                    fill: yellow
              - id: Options
                type: text
                content: 'XOptions '
                eventName: system
                eventPayload:
                  actions:
                    addModal:
                      resourceId: dafkjkl3
                    updateVariable:
                      operations:
                        - variableId: currentMenuTabId
                          op: set
                          value: options
                        - variableId: isMainMenu
                          op: set
                          value: true
                textStyle:
                  fontSize: 48
                  fill: white
                hover:
                  textStyle:
                    fontSize: 48
                    fill: yellow
              - id: Exit
                type: text
                content: 'XExit '
                eventName: system
                eventPayload:
                  actions:
                    addModal:
                      resourceId: f3jik32isdf
                textStyle:
                  fontSize: 48
                  fill: white
                hover:
                  textStyle:
                    fontSize: 48
                    fill: yellow
          - id: extra
            type: text
            content: 'XExtra '
            eventName: system
            eventPayload:
              actions:
                sectionTransition:
                  sceneId: ajfl3a
                  sectionId: k3nfgdsai34
            x: 100
            'y': 100
            textStyle:
              fontSize: 48
              fill: white
            hover:
              textStyle:
                fontSize: 48
                fill: yellow
animations: []

```

screenshot (taken from playground):

<img src="./assets/TASK-026/1.png"></img>



