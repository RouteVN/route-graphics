# Tween Animations

tween animations have 3 types. add, update and delete. it depends on the target element's state.

## Add

This will trigger during add because target element `rect1` is first added.

```yaml
states:
  - elements: []
  - elements:
      - id: "rect1"
        type: "rect"
        x: 200
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 1
    animations:
      - id: "rect-fade-in"
        targetId: "rect1"
        type: tween
        properties:
          alpha:
            initialValue: 0
            keyframes:
              - duration: 1000
                value: 1
                easing: linear
```

## Update

This will trigger update. because rect1 was already in the scene.

```yaml
states:
  - elements:
      - id: "rect1"
        type: "rect"
        x: 200
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 1
  - elements:
      - id: "rect1"
        type: "rect"
        x: 400
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 1
    animations:
      - id: "rect-move-right"
        targetId: "rect1"
        type: tween
        properties:
          x:
            keyframes:
              - duration: 1000
                value: 200
                easing: linear
```

## Delete

This will trigger delete. because rect1 was previously in the scene, but not anymore.

`rect1` has to run the full animation, before being removed from the scene.

```yaml
states:
  - elements:
      - id: "rect1"
        type: "rect"
        x: 200
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 1
  - elements: []
    animations:
      - id: "rect-fade-out"
        targetId: "rect1"
        type: tween
        properties:
          alpha:
            initialValue: 1
            keyframes:
              - duration: 1000
                value: 0
                easing: linear
```

# Key Behaviors

## All animations run simultaneously

All elements and their animations should run and appear at the same time. Animations should not wait for other animations to complete before starting.

## State transitions abort running animations

When transitioning to the next state before an animation has finished, the current animation should stop immediately and proceed from the start of the next state (not from the end of the previous state or the current animation progress).

## Consecutive render calls

If render is called twice consecutively, it is treated as running next state twice, with the first one being aborted.

# Implications

## When updating state when animation has not finished running

In the below example. The animation takes 1000ms to complete. If we update to the next state when animation is just at 500ms, what should happen is it should immediately jump at the next state. which is alpha with 0.8

```yaml
states:
  - elements: []
  - elements:
      - id: "rect1"
        type: "rect"
        x: 200
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 1
    animations:
      - id: "rect-fade-in"
        targetId: "rect1"
        type: tween
        properties:
          alpha:
            initialValue: 0
            keyframes:
              - duration: 1000
                value: 1
                easing: linear
  - elements:
      - id: "rect1"
        type: "rect"
        x: 200
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 0.8
```

## Do not keep the animation in 2 states

If animation is kep for 2 statates, the 2nd one will continue to run. The 1st time animation runs it will be an add animation. The second time it will be an update animation

```yaml
states:
  - elements: []
  - elements:
      - id: "rect1"
        type: "rect"
        x: 200
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 1
    animations:
      - id: "rect-fade-in"
        targetId: "rect1"
        type: tween
        properties:
          alpha:
            initialValue: 0
            keyframes:
              - duration: 1000
                value: 1
                easing: linear
  - elements:
      - id: "rect1"
        type: "rect"
        x: 200
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 0.8
    animations:
      - id: "rect-fade-in"
        targetId: "rect1"
        type: tween
        properties:
          alpha:
            initialValue: 0
            keyframes:
              - duration: 1000
                value: 1
                easing: linear
```

# Use cases

## Transition effect with Fade in and Fade out

We currently have a background image, and want to change the background image with a transition.
In such case, to give most flexibility we need to run an add animation and a delete animation

```yaml
states:
  - elements:
      - id: "rect1"
        type: "rect"
        x: 200
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 1
  - elements:
      - id: "rect2"
        type: "rect"
        x: 200
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 1
    animations:
      - id: "rect-fade-out"
        targetId: "rect1"
        type: tween
        properties:
          alpha:
            initialValue: 1
            keyframes:
              - duration: 1000
                value: 0
                easing: linear
      - id: "rect-fade-in"
        targetId: "rect2"
        type: tween
        properties:
          alpha:
            initialValue: 0
            keyframes:
              - duration: 1000
                value: 1
                easing: linear
```

## Moving animating an element's position and maintaing it

If we want to animate an element to move right by 200 pixels. We also need to increment the element's x by 200. Because at the end of the animation, we will always render the final state of elements, regardless of animation values.

```yaml
states:
  - elements:
      - id: "rect1"
        type: "rect"
        x: 200
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 1
  - elements:
      - id: "rect1"
        type: "rect"
        x: 400
        y: 150
        width: 400
        height: 300
        fill: "#3498db"
        alpha: 1
    animations:
      - id: "rect-move-right"
        targetId: "rect1"
        type: tween
        properties:
          x:
            keyframes:
              - duration: 1000
                relative: true
                value: 200
                easing: linear
```
