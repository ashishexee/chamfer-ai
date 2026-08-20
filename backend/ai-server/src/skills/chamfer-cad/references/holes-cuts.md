# CadQuery Holes, Cuts, and Boolean Operations

## Simple Holes

```python
# Through hole (cuts through entire solid)
.hole(diameter)

# Blind hole (specific depth)
.hole(diameter, depth)

# Example
result = (
    cq.Workplane("XY")
    .box(100, 100, 10)
    .faces(">Z")
    .workplane()
    .hole(22)
)
```

## Counterbored Holes

```python
# cboreHole(diameter, cboreDiameter, cboreDepth)
.cboreHole(2.4, 4.4, 2.1)

# With optional through-hole depth
.cboreHole(2.4, 4.4, 2.1, depth=10)

# Example: Pillow block with counterbored holes
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

```python
# cskHole(diameter, cskDiameter, cskAngle)
.cskHole(2.4, 4.4, 82)

# With optional through-hole depth
.cskHole(2.4, 4.4, 82, depth=10)
```

## Holes at Specific Locations

```python
# Holes at rectangle corners
result = (
    cq.Workplane("XY")
    .box(100, 100, 5)
    .faces(">Z")
    .workplane()
    .pushPoints([(20, 20), (20, -20), (-20, 20), (-20, -20)])
    .hole(5)
)

# Holes in rectangular array
result = (
    cq.Workplane("XY")
    .box(100, 100, 5)
    .faces(">Z")
    .workplane()
    .rarray(20, 20, 4, 4)
    .hole(3)
)

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
# Create a solid to use as a cutter
cutter = cq.Workplane("XY").circle(5).extrude(10)

# Cut the cutter from the base
result = base.cut(cutter)
```

### Cut Through All

```python
# Cut through the entire solid
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

```python
# Cut to a specific depth
result = (
    cq.Workplane("XY")
    .box(20, 20, 10)
    .faces(">Z")
    .workplane()
    .circle(5)
    .cutBlind(5)
)

# Cut with taper
result = (
    cq.Workplane("XY")
    .box(20, 20, 10)
    .faces(">Z")
    .workplane()
    .circle(5)
    .cutBlind(5, taper=5)
)
```

## Boolean Union Operations

### Union with Another Solid

```python
# Create two solids
body = cq.Workplane("XY").box(20, 20, 10)
boss = cq.Workplane("XY").circle(5).extrude(5)

# Union them together
result = body.union(boss)
```

### Union with Operator

```python
result = body + other_body
```

## Boolean Intersect Operations

```python
# Keep only the overlapping volume
result = body.intersect(other_body)

# With operator
result = body & other_body
```

## Critical: Boolean Union Overlap Rule

When using `.union()` to combine parts (e.g., handle + bowl):
- The parts MUST overlap by at least 1mm in all directions
- If parts don't overlap, add a small connector piece between them
- WRONG: handle at (0,0,0) and bowl at (100,0,0) with no overlap
- CORRECT: handle ends at x=50, bowl starts at x=49 → 1mm overlap

## Hollow Parts (Shell)

```python
# Shell by removing selected faces
.faces(">Z").shell(2.0)       # Remove top face, 2mm walls

# Negative thickness = inward shell
.faces(">Z").shell(-2.0)

# Example: Electronics enclosure
outer = cq.Workplane("XY").box(100, 60, 30, centered=True)
inner = cq.Workplane("XY").box(96, 56, 28, centered=True)
inner = inner.translate((0, 0, 1))
result = outer.cut(inner)
```

## Fillets (Rounded Edges)

```python
# Fillet selected edges by radius
.edges("|Z").fillet(2.0)

# Fillet edges of a specific face
.faces(">Z").edges().fillet(1.0)

# CRITICAL: radius must be LESS than half the adjacent edge length
# If fillet fails, reduce radius or remove it entirely
```

## Chamfers (Beveled Edges)

```python
# Symmetric chamfer
.edges("|Z").chamfer(1.0)

# Asymmetric chamfer (two lengths)
.edges("|Z").chamfer(1.0, 0.5)
```

## Common Patterns

### Box with Holes (Rectangular Array)

```python
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
cyl = cq.Workplane("XY").circle(20).extrude(30)
hole = cq.Workplane("XY").circle(10).extrude(32)
hole = hole.translate((0, 0, -1))
result = cyl.cut(hole)
```

### Flange with Bolt Circle

```python
flange = cq.Workplane("XY").circle(50).circle(25).extrude(10)
flange = flange.faces(">Z").workplane().polarArray(35, 0, 360, 6).hole(6)
result = flange
```
