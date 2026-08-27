# CadQuery Holes, Cuts, and Boolean Operations

## Simple Holes

```text
.hole(diameter)           # Through hole (cuts through entire solid)
.hole(diameter, depth)    # Blind hole (specific depth)
```

```python
import cadquery as cq

# Example: through hole centered on the top face
result = (
    cq.Workplane("XY")
    .box(100, 100, 10)
    .faces(">Z")
    .workplane()
    .hole(22)
)
```

## Counterbored Holes

```text
# cboreHole(diameter, cboreDiameter, cboreDepth)
.cboreHole(2.4, 4.4, 2.1)

# With optional through-hole depth
.cboreHole(2.4, 4.4, 2.1, depth=10)
```

```python
import cadquery as cq

# Example: Pillow block with counterbored holes at the rectangle corners
result = (
    cq.Workplane("XY")
    .box(80, 60, 10)
    .faces(">Z")
    .workplane()
    .rect(68, 48, forConstruction=True)
    .vertices()
    .cboreHole(2.4, 4.4, 2.1)
)
```

## Countersunk Holes

```text
# cskHole(diameter, cskDiameter, cskAngle)
.cskHole(2.4, 4.4, 82)

# With optional through-hole depth
.cskHole(2.4, 4.4, 82, depth=10)
```

## Holes at Specific Locations

```python
import cadquery as cq

# Holes at explicit points
result = (
    cq.Workplane("XY")
    .box(100, 100, 5)
    .faces(">Z")
    .workplane()
    .pushPoints([(20, 20), (20, -20), (-20, 20), (-20, -20)])
    .hole(5)
)
```

```python
import cadquery as cq

# Holes in rectangular array
result = (
    cq.Workplane("XY")
    .box(100, 100, 5)
    .faces(">Z")
    .workplane()
    .rarray(20, 20, 4, 4)
    .hole(3)
)
```

```python
import cadquery as cq

# Holes in polar array (bolt circle)
result = (
    cq.Workplane("XY")
    .box(100, 100, 5)
    .faces(">Z")
    .workplane()
    .polarArray(30, 0, 360, 8)
    .hole(3)
)
```

## Boolean Cut Operations

### Cut with a Solid

```python
import cadquery as cq

# Create a solid to use as a cutter; extend it past the faces it cuts
base = cq.Workplane("XY").box(20, 20, 10)
cutter = cq.Workplane("XY").circle(5).extrude(12)
cutter = cutter.translate((0, 0, -1))
result = base.cut(cutter)
```

### Cut Through All

```python
import cadquery as cq

result = (
    cq.Workplane("XY")
    .box(20, 20, 10)
    .faces(">Z")
    .workplane()
    .circle(5)
    .cutThruAll()
)
```

### Cut Blind (Partial Cut)

SIGN CONVENTION — a workplane created on a face points OUTWARD from the part,
so a POSITIVE `cutBlind` depth cuts outward into empty space and removes
NOTHING. Use a NEGATIVE depth to cut down into the part.

```python
import cadquery as cq

# Pocket 5 mm deep from the top face (negative = into the part)
result = (
    cq.Workplane("XY")
    .box(20, 20, 10)
    .faces(">Z")
    .workplane()
    .circle(5)
    .cutBlind(-5)
)
```

```python
import cadquery as cq

# Same, with a 5 degree draft taper
result = (
    cq.Workplane("XY")
    .box(20, 20, 10)
    .faces(">Z")
    .workplane()
    .circle(5)
    .cutBlind(-5, taper=5)
)
```

## Boolean Union Operations

### Union with Another Solid

```python
import cadquery as cq

# Create two solids
body = cq.Workplane("XY").box(20, 20, 10)
boss = cq.Workplane("XY").circle(5).extrude(5)

# Union them together
result = body.union(boss)
```

### Union with Operator

```python
import cadquery as cq

body = cq.Workplane("XY").box(20, 20, 10)
boss = cq.Workplane("XY").circle(5).extrude(5)
result = body + boss
```

## Boolean Intersect Operations

```python
import cadquery as cq

# Keep only the overlapping volume
body = cq.Workplane("XY").box(20, 20, 10)
other_body = cq.Workplane("XY").cylinder(10, 8).translate((12, 0, 0))
result = body.intersect(other_body)
```

## Critical: Boolean Union Overlap Rule

When using `.union()` to combine parts (e.g., handle + bowl):
- The parts MUST overlap by at least 1mm in all directions
- If parts don't overlap, add a small connector piece between them
- WRONG: handle at (0,0,0) and bowl at (100,0,0) with no overlap
- CORRECT: handle ends at x=50, bowl starts at x=49 → 1mm overlap
- A union of non-touching solids silently produces disconnected bodies

## Hollow Parts (Shell)

```text
# Shell by removing selected faces
.faces(">Z").shell(2.0)       # Remove top face, 2mm walls

# Negative thickness = inward shell
.faces(">Z").shell(-2.0)
```

```python
import cadquery as cq

# Example: Electronics enclosure (box with cavity, open top)
outer = cq.Workplane("XY").box(100, 60, 30, centered=True)
result = outer.faces(">Z").shell(2.0)
```

## Fillets (Rounded Edges)

```text
# Fillet selected edges by radius
.edges("|Z").fillet(2.0)

# Fillet edges of a specific face
.faces(">Z").edges().fillet(1.0)
```

CRITICAL: radius must be LESS than half the adjacent edge length.
If fillet fails, reduce radius or remove it entirely.

```python
import cadquery as cq

result = cq.Workplane("XY").box(30, 20, 10).edges("|Z").fillet(2.0)
```

## Chamfers (Beveled Edges)

```text
# Symmetric chamfer
.edges("|Z").chamfer(1.0)

# Asymmetric chamfer (two lengths)
.edges("|Z").chamfer(1.0, 0.5)
```

```python
import cadquery as cq

result = cq.Workplane("XY").box(30, 20, 10).edges("|Z").chamfer(1.0)
```

## Common Patterns

### Box with Holes (Rectangular Array)

```python
import cadquery as cq

result = (
    cq.Workplane("XY")
    .box(80, 60, 10)
    .faces(">Z")
    .workplane()
    .rect(68, 48, forConstruction=True)
    .vertices()
    .cboreHole(2.4, 4.4, 2.1)
)
```

### Cylinder with Axial Hole

```python
import cadquery as cq

cyl = cq.Workplane("XY").circle(20).extrude(30)
hole = cq.Workplane("XY").circle(10).extrude(32)
hole = hole.translate((0, 0, -1))
result = cyl.cut(hole)
```

### Flange with Bolt Circle

```python
import cadquery as cq

flange = cq.Workplane("XY").circle(50).circle(25).extrude(10)
flange = flange.faces(">Z").workplane().polarArray(35, 0, 360, 6).hole(6)
result = flange
```
