# CadQuery Sketch API Reference

## Overview

The Sketch class provides a constraint-based 2D drawing API. It can be used standalone or within a Workplane.

## Basic Sketch (Face-Based API)

```python
import cadquery as cq

result = (
    cq.Sketch()
    .trapezoid(4, 3, 90)
    .vertices()
    .circle(0.5, mode="s")
    .reset()
    .vertices()
    .fillet(0.25)
    .reset()
    .rarray(0.6, 1, 5, 1)
    .slot(1.5, 0.4, mode="s", angle=90)
)
```

## Modes

Every face-based operation accepts a `mode` parameter:

| Mode | Letter | Description |
|------|--------|-------------|
| `a`  | Additive | Fuse with existing (default) |
| `s`  | Subtractive | Cut from existing |
| `i`  | Intersect | Keep intersection |
| `r`  | Replace | Overwrite |
| `c`  | Construction | Reference only (requires tag) |

```python
result = (
    cq.Sketch()
    .rect(1, 2, mode="c", tag="base")
    .vertices(tag="base")
    .circle(0.7)
    .reset()
    .edges("|Y", tag="base")
    .ellipse(1.2, 1, mode="i")
    .reset()
    .rect(2, 2, mode="i")
    .clean()
)
```

## Face-Based Operations

```python
.rect(w, h, angle=0, mode="a")        # Rectangle
.circle(r, mode="a")                   # Circle
.ellipse(a1, a2, angle=0, mode="a")    # Ellipse
.trapezoid(w, h, a1, a2=None, mode="a") # Trapezoid
.slot(w, h, angle=0, mode="a")         # Slot
.regularPolygon(r, n, angle=0, mode="a") # Regular polygon
.polygon(pts, angle=0, mode="a")       # Arbitrary polygon
.face(b, angle=0, mode="a")            # From wire/edges
```

## Selection

```python
.faces(s=None, tag=None)     # Select faces
.edges(s=None, tag=None)     # Select edges
.vertices(s=None, tag=None)  # Select vertices
.reset()                     # Reset selection
.delete()                    # Delete selected
.tag(tag)                    # Tag current selection
.select(*tags)               # Select by tags
```

## Modifiers

```python
.fillet(d)                   # Fillet based on selection
.chamfer(d)                  # Chamfer based on selection
.clean()                     # Remove internal wires
.offset(d, mode="a")         # Offset selected wires
.hull(mode="a")              # Convex hull
```

## Arrays

```python
.rarray(xs, ys, nx, ny)     # Rectangular array of locations
.parray(r, a1, da, n, rotate=True) # Polar array
.distribute(n, start=0, stop=1, rotate=True) # Distribute along edges
.push(locs, tag=None)        # Set selection to locations
.each(callback, mode="a")    # Apply callback to all
```

## Edge-Based API

For constructing sketches by placing individual edges:

```python
result = (
    cq.Sketch()
    .segment((0.0, 0), (0.0, 2.0))
    .segment((2.0, 0))
    .close()
    .arc((0.6, 0.6), 0.4, 0.0, 360.0)
    .assemble(tag="face")
    .edges("%LINE", tag="face")
    .vertices()
    .chamfer(0.2)
)
```

Edge operations:
```python
.segment(p1, p2, tag=None)   # Line segment
.arc(...)                     # Arc (multiple overloads)
.spline(pts, tag=None)        # Spline
.close(tag=None)              # Close the wire
.assemble(mode="a", tag=None) # Convert edges to faces
```

## Constraint-Based Sketches (Experimental)

```python
result = (
    cq.Sketch()
    .segment((0, 0), (0, 3.0), "s1")
    .arc((0.0, 3.0), (1.5, 1.5), (0.0, 0.0), "a1")
    .constrain("s1", "Fixed", None)
    .constrain("s1", "a1", "Coincident", None)
    .constrain("a1", "s1", "Coincident", None)
    .constrain("s1", "a1", "Angle", 45)
    .solve()
    .assemble()
)
```

### Constraint Types

| Constraint | Args | Description |
|-----------|------|-------------|
| `FixedPoint` | None or 0..1 | Point is fixed |
| `Coincident` | None | Points coincide |
| `Angle` | angle | Tangent angle fixed |
| `Length` | length | Entity length fixed |
| `Distance` | None/0..1, None/0..1, distance | Distance between points |
| `Radius` | radius | Arc radius fixed |
| `Orientation` | x,y | Segment parallel to vector |
| `ArcAngle` | angle | Arc angular span fixed |

## Workplane Integration

### In-Place Sketch

```python
result = (
    cq.Workplane()
    .box(5, 5, 1)
    .faces(">Z")
    .sketch()
    .regularPolygon(2, 3, tag="outer")
    .regularPolygon(1.5, 3, mode="s")
    .vertices(tag="outer")
    .fillet(0.2)
    .finalize()
    .extrude(0.5)
)
```

### Placing Existing Sketch

```python
s = cq.Sketch().trapezoid(3, 1, 110).vertices().fillet(0.2)

result = (
    cq.Workplane()
    .box(5, 5, 5)
    .faces(">X")
    .workplane()
    .transformed((0, 0, -90))
    .placeSketch(s)
    .cutThruAll()
)
```

### Lofting Between Sketches

```python
s1 = cq.Sketch().trapezoid(3, 1, 110).vertices().fillet(0.2)
s2 = cq.Sketch().rect(2, 1).vertices().fillet(0.2)

result = cq.Workplane().placeSketch(s1, s2.moved(z=3)).loft()
```

### Combining Sketches

```python
s1 = cq.Sketch().rect(2, 2)
s2 = cq.Sketch().circle(0.5)

result = s1.face(s2, mode='s')
```

### Boolean Operations on Sketches

```python
s1 = cq.Sketch().rect(2, 2).vertices().fillet(0.25).reset()
s2 = cq.Sketch().rect(1, 1, angle=45).vertices().chamfer(0.1).reset()

result = s1 - s2   # Difference
result = s1 + s2   # Union
result = s1 * s2   # Intersection
```

### Sketch Offsets

```python
sketch = cq.Sketch().rect(1.0, 4.0).circle(1.0).clean()

# Offset outward
sketch_offset = sketch.copy().wires().offset(0.25)

# Offset inward
sketch_offset = sketch.copy().wires().offset(-0.25, mode='r')
```

## Supported Workplane Operations with Sketches

After creating a sketch on a Workplane, these operations are supported:
- `extrude()` — Extrude the sketch
- `twistExtrude()` — Extrude with twist
- `revolve()` — Revolve the sketch
- `sweep()` — Sweep along a path
- `cutBlind()` — Cut to depth
- `cutThruAll()` — Cut through all
- `loft()` — Loft between sketches

## Export/Import

```python
# Export sketch to DXF
sketch.export("output.dxf")

# Import DXF
s = cq.Sketch().importDXF("input.dxf")
```
