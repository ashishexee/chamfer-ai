# CadQuery Transformations Reference

## Translate (Move)

```python
.translate((x, y, z))                    # Move by vector

# Example: Move a cylinder up
cylinder = cq.Workplane("XY").circle(10).extrude(20)
moved = cylinder.translate((0, 0, 50))
```

## Rotate

```python
# Rotate around axis by angle (degrees)
.rotate((0,0,0), (1,0,0), 90)           # axisStart, axisEnd, angleDegrees

# Rotate about center of bounding box
.rotateAboutCenter((1,0,0), 45)

# Example: Rotate a box 45 degrees around Z axis
box = cq.Workplane("XY").box(10, 20, 5)
rotated = box.rotate((0,0,0), (0,0,1), 45)
```

## Mirror

```python
.mirror("XY")           # Mirror about XY plane
.mirror("XZ")
.mirror("YZ")
.mirrorX()              # Mirror about X axis of workplane
.mirrorY()              # Mirror about Y axis of workplane
.mirror((1, 0, 0), (0, 0, 0))  # Mirror about plane defined by normal and origin

# Example: Create symmetric part
half = cq.Workplane("XY").lineTo(10, 0).lineTo(10, 5).lineTo(0, 5).close().extrude(5)
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
# polarArray(radius, startAngle, angle, count)
result = (
    cq.Workplane("XY")
    .box(100, 100, 5)
    .faces(">Z")
    .workplane()
    .polarArray(30, 0, 360, 8)    # 8 holes on a 30mm radius circle
    .hole(3)
)

# Partial arc
.polarArray(30, 0, 180, 5)        # 5 holes over 180 degrees
```

### Iteration (Automatic)

Many methods automatically iterate over all items on the stack:

```python
# vertices() selects 4 corners, circle() creates 4 circles
result = cq.Workplane("XY").box(1,2,3).faces(">Z").vertices().circle(0.5)

# each() for custom callbacks
result = wp.each(lambda loc: cq.Solid.makeSphere(1, pnt=loc))
```

## Workplane Shifts

### Center

```python
# Shift the workplane center
.center(x, y)

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

```python
# Create a rotated/offset workplane
.transformed(rotate=cq.Vector(45, 0, 0), offset=cq.Vector(0, 0, 10))

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
