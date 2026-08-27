# CadQuery Transformations Reference

## Translate (Move)

```text
.translate((x, y, z))                    # Move by ONE vector tuple
```

```python
import cadquery as cq

# Example: Move a cylinder up
cylinder = cq.Workplane("XY").circle(10).extrude(20)
moved = cylinder.translate((0, 0, 50))
result = moved
```

## Rotate

```text
.rotate((0,0,0), (1,0,0), 90)           # axisStart, axisEnd, angleDegrees
.rotateAboutCenter((1,0,0), 45)         # Rotate about bounding-box center
```

```python
import cadquery as cq

# Example: Rotate a box 45 degrees around Z axis
box = cq.Workplane("XY").box(10, 20, 5)
result = box.rotate((0, 0, 0), (0, 0, 1), 45)
```

## Mirror

```text
.mirror("XY")           # Mirror about XY plane
.mirror("XZ")
.mirror("YZ")
.mirrorX()              # Mirror about X axis of workplane
.mirrorY()              # Mirror about Y axis of workplane
.mirror((1, 0, 0), (0, 0, 0))  # Mirror about plane defined by normal and origin
```

```python
import cadquery as cq

# Example: Create symmetric part — draw half, mirror about workplane Y axis
half = (
    cq.Workplane("XY")
    .moveTo(0, 0)
    .lineTo(10, 0)
    .lineTo(10, 5)
    .lineTo(0, 5)
    .close()
    .extrude(5)
)
result = half.mirrorY()
```

## Patterns and Arrays

### pushPoints — Multiple Features at Specific Locations

```python
result = (
    cq.Workplane("XY")
    .box(100, 100, 5)
    .faces(">Z")
    .workplane()
    .pushPoints([(20, 20), (20, -20), (-20, 20), (-20, -20)])
    .hole(5)
)
```

### Rectangular Array (rarray)

```python
# rarray(xSpacing, ySpacing, xCount, yCount)
result = (
    cq.Workplane("XY")
    .box(100, 100, 5)
    .faces(">Z")
    .workplane()
    .rarray(20, 20, 4, 4)
    .hole(3)
)
```

### Polar Array

```python
import cadquery as cq

# polarArray(radius, startAngle, angle, count)
result = (
    cq.Workplane("XY")
    .box(100, 100, 5)
    .faces(">Z")
    .workplane()
    .polarArray(30, 0, 360, 8)    # 8 holes on a 30mm radius circle
    .hole(3)
)
```

```text
# Partial arc: 5 positions spread over 180 degrees
.polarArray(30, 0, 180, 5)
```

### Iteration (Automatic)

Many methods automatically iterate over all items on the stack —
`vertices()` below selects 4 corners, and `circle()` creates one circle
at each of them:

```python
import cadquery as cq

result = (
    cq.Workplane("XY")
    .box(10, 10, 2)
    .faces(">Z")
    .vertices()
    .circle(1)
    .extrude(3)
)
```

## Workplane Shifts

### Center

```text
.center(x, y)     # Shift the workplane center
```

```python
import cadquery as cq

# Example
result = (
    cq.Workplane("XY")
    .box(10, 10, 10)
    .faces(">Z")
    .workplane()
    .center(5, 5)  # Shift to corner
    .circle(2)
    .extrude(5)
)
```

### Transform

```text
# Create a rotated/offset workplane
.transformed(rotate=cq.Vector(45, 0, 0), offset=cq.Vector(0, 0, 10))
```

```python
import cadquery as cq

# Example: Angled workplane
result = (
    cq.Workplane("XY")
    .box(4, 4, 0.25)
    .faces(">Z")
    .workplane()
    .transformed(offset=cq.Vector(0, -1.5, 1.0), rotate=cq.Vector(60, 0, 0))
    .rect(1.5, 1.5, forConstruction=True)
    .vertices()
    .hole(0.25)
)
```

## Split

```python
# Split a solid into two parts
splitter = cq.Workplane("XY").box(20, 20, 10)
result = splitter.split(keepTop=True)
result = splitter.split(keepBottom=True)
```

## Common Transformation Patterns

### Symmetric Part with Mirror

```python
# Create half the profile, then mirror
profile = (
    cq.Workplane("XY")
    .moveTo(0, 0)
    .lineTo(10, 0)
    .lineTo(10, 5)
    .lineTo(5, 8)
    .lineTo(0, 5)
    .close()
)
half = profile.extrude(5)
result = half.mirrorY()
```

### Pattern of Bosses

```python
result = (
    cq.Workplane("XY")
    .box(100, 100, 10)
    .faces(">Z")
    .workplane()
    .rarray(25, 25, 3, 3)
    .circle(5)
    .extrude(5)
)
```

### Circular Pattern of Features

```python
result = (
    cq.Workplane("XY")
    .circle(50)
    .extrude(10)
    .faces(">Z")
    .workplane()
    .polarArray(30, 0, 360, 6)
    .circle(5)
    .cutThruAll()
)
```
