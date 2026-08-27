# CadQuery Core API Reference

## Core Concepts

CadQuery builds 3D models by creating a Workplane (2D sketch plane), drawing profiles, and extruding/revolving/lofting them into solids.

- Operations are chained: `result = cq.Workplane("XY").box(10,20,30).edges("|Z").fillet(2)`
- All dimensions are in millimeters
- The final geometry must be assigned to the variable `result`
- Signature-only listings below use `text` blocks. Every `python` block in this file runs in the sandbox.

## Essential Import

```python
import cadquery as cq
```

## Workplane Creation

```text
cq.Workplane("XY")     # Front plane (default), Z is normal
cq.Workplane("YZ")     # Side plane, X is normal
cq.Workplane("XZ")     # Top plane, Y is normal
cq.Workplane("front")  # Same as "XY"
cq.Workplane("back")   # XY, rotated 180
cq.Workplane("left")   # YZ, rotated 180
cq.Workplane("right")  # Same as "YZ"
cq.Workplane("top")    # Same as "XZ"
cq.Workplane("bottom") # XZ, rotated 180
```

## Creating Workplanes on Existing Faces

`workplane()` alone produces a plane, not geometry — draw and extrude on it:

```python
import cadquery as cq

# Workplane on the topmost face, with a boss on it
result = (
    cq.Workplane("XY")
    .box(10, 10, 10)
    .faces(">Z")
    .workplane()
    .circle(2)
    .extrude(3)
)
```

```python
import cadquery as cq

# CenterOfMass workplane origin
result = (
    cq.Workplane("XY")
    .box(10, 10, 10)
    .faces(">Z")
    .workplane(centerOption="CenterOfMass")
    .circle(2)
    .extrude(3)
)
```

```python
import cadquery as cq

# Offset the workplane 5 mm above the face
result = (
    cq.Workplane("XY")
    .box(10, 10, 10)
    .faces(">Z")
    .workplane(offset=5)
    .circle(2)
    .extrude(3)
)
```

## 2D Drawing Operations

### Basic Shapes

```text
.rect(xLen, yLen)                                # Centered on workplane
.rect(xLen, yLen, centered=(True, False))        # Center X only
.rect(xLen, yLen, forConstruction=True)          # Construction only
.circle(radius)
.ellipse(x_radius, y_radius)
.polygon(nSides, diameter, circumscribed=False)
.slot2D(length, diameter)
.slot2D(length, diameter, angle=45)
```

### Lines and Polyline Drawing

Keep the profile simple and non-self-intersecting; `close()` before extruding:

```python
import cadquery as cq

result = (
    cq.Workplane("XY")
    .moveTo(0, 0)        # Start point
    .lineTo(20, 0)       # Absolute endpoint
    .line(0, 10)         # Relative distance
    .hLineTo(10)         # Horizontal to absolute X
    .vLineTo(20)         # Vertical to absolute Y
    .close()             # Close the wire
    .extrude(5)
)
```

```text
.moveTo(x, y)             # Set current point without drawing
.lineTo(x, y)             # Absolute endpoint
.line(dx, dy)             # Relative distance
.hLine(dx) / .hLineTo(x)  # Horizontal, relative / absolute
.vLine(dy) / .vLineTo(y)  # Vertical, relative / absolute
.polarLine(length, angle) # Line at angle, given length
.polarLineTo(r, angle)    # Line to polar coordinates
.polyline([(x,y), ...])   # Chain of points (also used for sweep paths)
.close()                  # Close the wire
```

### Arcs and Splines

```python
import cadquery as cq

# Arc through a middle point, then close the profile
result = (
    cq.Workplane("XY")
    .moveTo(0, 0)
    .lineTo(10, 0)
    .threePointArc((15, 5), (10, 10))
    .lineTo(0, 10)
    .close()
    .extrude(3)
)
```

```python
import cadquery as cq

# Spline through points, closed with straight edges
result = (
    cq.Workplane("XY")
    .moveTo(0, 0)
    .spline([(5, 2), (10, 8), (15, 2)])
    .lineTo(15, 0)
    .close()
    .extrude(3)
)
```

```text
.threePointArc(point1, point2)      # Arc from current point through point1 to point2
.sagittaArc(endPoint, sag)          # Arc defined by sagitta
.radiusArc(endPoint, radius)        # Arc defined by radius
.tangentArcPoint(endpoint)          # Tangent arc from current edge end
.spline(listOfXYTuple)              # Spline through points
.parametricCurve(func, N=20)        # Curve from function
```

### Offsetting 2D Wires

```python
import cadquery as cq

# Shrink a rectangle outline by 2 mm with sharp corners, then extrude
result = (
    cq.Workplane("XY")
    .rect(20, 10)
    .offset2D(-2, kind="intersection")
    .extrude(5)
)
```

```text
.offset2D(d)                       # Offset by distance d (negative = inward)
.offset2D(d, kind="arc")           # Arc corners (default)
.offset2D(d, kind="intersection")  # Sharp corners
.offset2D(d, kind="tangent")       # Tangent corners
```

## 3D Operations

### Primitives

```text
.box(length, width, height, centered=True)
.box(length, width, height, centered=(True, True, True))
.cylinder(height, radius)
.cylinder(height, radius, direct=(0, 0, 1), centered=(True, True, True))
.sphere(radius)
.sphere(radius, direct=(0, 0, 1), angle1=-90, angle2=90, angle3=360)
.wedge(dx, dy, dz, xmin, zmin, xmax, zmax)
.text(txt, fontsize, distance)     # UNSUPPORTED in this sandbox: no fonts installed
```

### Extrude

```text
.extrude(distance)                    # Extrude by distance, combine with context
.extrude(distance, combine=False)     # Don't combine with context solid
.extrude(distance, taper=5)           # 5 degree taper
.extrude(distance, both=True)         # Extrude both directions
```

### Revolve

Revolve axis points are in WORKPLANE-LOCAL coordinates. On the `XZ` workplane
the part's vertical axis is local Y — revolving around `(0, 0, 1)` (local Z)
would swing the profile out of the part instead of spinning it.

```python
import cadquery as cq

# Ring: rectangular profile on XZ revolved around the vertical (local Y) axis
result = (
    cq.Workplane("XZ")
    .moveTo(5, 0)
    .lineTo(15, 0)
    .lineTo(15, 20)
    .lineTo(5, 20)
    .close()
    .revolve(360, (0, 0, 0), (0, 1, 0))
)
```

```text
.revolve()                                              # Full 360 around workplane X axis
.revolve(angleDegrees=180, axisStart=(0,0,0), axisEnd=(1,0,0))
```

### Loft

Loft through wires drawn on stacked offset workplanes:

```python
import cadquery as cq

result = (
    cq.Workplane("XY")
    .circle(5)
    .workplane(offset=10)
    .circle(3)
    .workplane(offset=10)
    .circle(1)
    .loft()
)
```

```text
.loft(ruled=True)   # Ruled loft (straight edges between sections)
```

### Sweep

The path should START AT THE ORIGIN of its workplane, and the profile plane
must be perpendicular to the path's starting direction. Sweep does not
relocate profiles reliably — if the path starts away from the origin, sweep
first and then `.translate()` the result into position.

```python
import cadquery as cq

# Path starts in +Y from the XY origin, so the profile sits on XZ (normal X)
path = cq.Workplane("XY").polyline([(0, 0), (0, 10), (10, 10)])
result = cq.Workplane("XZ").circle(1).sweep(path)
```

```python
import cadquery as cq

# Square section with rounded transitions at the corners
path = cq.Workplane("XY").polyline([(0, 0), (0, 10), (10, 10)])
result = cq.Workplane("XZ").rect(2, 2).sweep(path, transition="round")
```

## Holes, Fillets, Chamfers

### Simple Holes

```text
.hole(diameter)           # Through hole (cuts through entire solid)
.hole(diameter, depth)    # Blind hole (specific depth)
```

```python
import cadquery as cq

# Through hole
result = cq.Workplane("XY").box(30, 30, 10).faces(">Z").workplane().hole(8)
```

```python
import cadquery as cq

# Blind hole, 6 mm deep
result = cq.Workplane("XY").box(30, 30, 10).faces(">Z").workplane().hole(8, 6)
```

### Counterbored Holes

```text
# cboreHole(diameter, cboreDiameter, cboreDepth)
.cboreHole(2.4, 4.4, 2.1)

# With optional through-hole depth
.cboreHole(2.4, 4.4, 2.1, depth=10)
```

```python
import cadquery as cq

result = (
    cq.Workplane("XY")
    .box(30, 30, 10)
    .faces(">Z")
    .workplane()
    .rect(20, 20, forConstruction=True)
    .vertices()
    .cboreHole(2.4, 4.4, 2.1)
)
```

### Countersunk Holes

```text
# cskHole(diameter, cskDiameter, cskAngle)
.cskHole(2.4, 4.4, 82)

# With optional through-hole depth
.cskHole(2.4, 4.4, 82, depth=10)
```

```python
import cadquery as cq

result = (
    cq.Workplane("XY")
    .box(30, 30, 10)
    .faces(">Z")
    .workplane()
    .cskHole(2.4, 4.4, 82)
)
```

### Fillets

```text
.edges("|Z").fillet(2.0)          # Fillet selected edges by radius
.fillet2D(radius, wire)           # 2D fillet on sketch wires
```

```python
import cadquery as cq

# Radius must be LESS than half the shortest adjacent dimension
result = cq.Workplane("XY").box(30, 20, 10).edges("|Z").fillet(2.0)
```

### Chamfers

```text
.edges("|Z").chamfer(1.0)         # Symmetric chamfer
.edges("|Z").chamfer(1.0, 0.5)    # Asymmetric chamfer (two lengths)
.chamfer2D(length, wire)          # 2D chamfer on sketch wires
```

```python
import cadquery as cq

result = cq.Workplane("XY").box(30, 20, 10).edges("|Z").chamfer(1.0)
```

### Shell (Hollow)

```text
.faces(">Z").shell(2.0)     # Remove selected faces, leave 2 mm walls
.faces(">Z").shell(-2.0)    # Negative thickness = inward shell
```

```python
import cadquery as cq

# Open box: top face removed, 2 mm walls
result = cq.Workplane("XY").box(30, 20, 15).faces(">Z").shell(2.0)
```

## Patterns and Arrays

### pushPoints — Multiple Features at Specific Locations

```python
import cadquery as cq

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
import cadquery as cq

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

## Boolean Operations

Bodies must be defined before combining them. The operators `+`, `-`, `&`
are shortcuts for union, cut, intersect.

### Union (fuse)

```python
import cadquery as cq

body = cq.Workplane("XY").box(20, 20, 20)
other = cq.Workplane("XY").cylinder(25, 5)
result = body.union(other)
```

### Cut (subtract)

```python
import cadquery as cq

body = cq.Workplane("XY").box(20, 20, 20)
cutter = cq.Workplane("XY").cylinder(25, 5)
result = body.cut(cutter)
```

### Intersect

```python
import cadquery as cq

body = cq.Workplane("XY").box(20, 20, 20)
other = cq.Workplane("XY").cylinder(30, 12).translate((8, 0, 0))
result = body.intersect(other)
```

## Transformations

```text
.translate((x, y, z))                       # Move by ONE vector tuple
.rotate((0,0,0), (1,0,0), 90)               # axisStart, axisEnd, angleDegrees
.rotateAboutCenter((1,0,0), 45)             # Rotate about bounding-box center
.mirror("XY") / .mirror("XZ") / .mirror("YZ")
.mirrorX() / .mirrorY()                     # Mirror about workplane axes
```

```python
import cadquery as cq

# Build half a symmetric part, mirror it about the workplane Y axis
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

## Tags

Tags let you refer back to a specific Workplane state later in the chain:

```python
import cadquery as cq

result = (
    cq.Workplane("XY")
    .box(1, 1, 1)
    .tag("base")
    .faces(">Z")
    .circle(0.2)
    .extrude(1)
    .faces(">>X", tag="base")
    .workplane(centerOption="CenterOfMass")
    .circle(0.2)
    .extrude(1)
)
```

## BREP Topology Hierarchy

CadQuery uses Boundary Representation (BREP). Shapes are defined bottom-up:

| Entity   | Description |
|----------|-------------|
| Vertex   | A single point in space |
| Edge     | A connection between vertices along a curve |
| Wire     | A collection of connected edges |
| Face     | A set of edges/wires enclosing a surface |
| Shell    | A collection of connected faces |
| Solid    | A shell with a closed interior |
| Compound | A collection of solids |

## Shape Query Methods (for validation/inspection)

```python
import cadquery as cq

result = cq.Workplane("XY").box(10, 20, 30)
solid = result.val()
volume = solid.Volume()       # Total volume
area = solid.Area()           # Total surface area
bbox = solid.BoundingBox()    # Bounding box
center = solid.Center()       # Center of mass
valid = solid.isValid()       # Check if geometry is valid
gtype = solid.geomType()      # Geometry type string
```

## Stack Navigation

```python
import cadquery as cq

box = cq.Workplane("XY").box(10, 5, 5)
first = box.val()             # First value on stack (the Solid)
all_shapes = box.vals()       # List of all values on stack
count = box.faces(">Z").vertices().size()   # Number of objects on stack
back_one = box.faces(">Z").vertices().end()  # Back to faces
back_two = box.faces(">Z").vertices().end(2) # Back to box
```

```python
import cadquery as cq

# findSolid() walks back to the context solid even with pending 2D work.
# It returns a raw Shape (no .val()), so use it for inspection — never as
# `result`.
part = cq.Workplane("XY").box(10, 5, 5).circle(3).findSolid()
volume = part.Volume()
```

## Context Solid and combine=False

The first solid created becomes the "context solid." Subsequent features auto-combine with it:

```python
import cadquery as cq

# Auto-union (default)
result = cq.Workplane("XY").box(1, 2, 3).faces(">Z").circle(0.25).extrude(1)
```

```python
import cadquery as cq

# combine=False keeps the new feature as a separate body in the result
# (val() returns a Compound of both bodies)
result = cq.Workplane("XY").box(1, 2, 3).faces(">Z").circle(0.25).extrude(1, combine=False)
```

## toPending() — Required for Loft/Sweep of Selected Wires

Drawn wires (`circle`, `rect`, ...) go onto the pending list automatically.
Wires you SELECT from existing geometry do not — push them with `toPending()`
or loft/sweep will find nothing.

```python
import cadquery as cq

# EXPECTED-FAIL
# WRONG: selected wires never reach the pending list -> "ValueError: Nothing to loft"
result = (
    cq.Workplane("XY")
    .box(10, 10, 10)
    .faces(">Z")
    .wires()
    .translate((0, 0, 5))
    .loft()
)
```

```python
import cadquery as cq

# RIGHT: toPending() before AND after moving the wire
result = (
    cq.Workplane("XY")
    .box(10, 10, 10)
    .faces(">Z")
    .wires()
    .toPending()       # push the selected wire
    .translate((0, 0, 5))
    .toPending()       # push the moved wire
    .loft()
)
```

## Cut/Extrude To Depth or Face

Prefer numeric depths — they are the most reliable. Negative `cutBlind` depth
cuts DOWN into the part from the selected face.

```python
import cadquery as cq

# Blind pocket, 6 mm deep from the top face
result = (
    cq.Workplane("XY")
    .box(20, 20, 10, centered=(True, True, False))
    .faces(">Z")
    .workplane()
    .circle(3)
    .cutBlind(-6)
)
```

```python
import cadquery as cq

# Cut until a specific face: capture the face, keep the solid in the chain
base = cq.Workplane("XY").box(20, 20, 10, centered=(True, True, False))
target_face = base.faces(">Z").val()
result = base.faces(">Z").workplane(offset=-4).circle(3).cutBlind(target_face)
```

`extrude("next")` / `extrude("last")` (and the same strings for `cutBlind`)
extrude until the next/last face hit along the extrusion direction. They only
work when a solid is in the chain AND a face lies in that direction; when in
doubt use a numeric depth instead.

## Tags and workplaneFromTagged()

```python
import cadquery as cq

result = (
    cq.Workplane("XY")
    .box(10, 10, 10)
    .tag("base")
    .faces(">Z")
    .circle(2)
    .extrude(5)
    .workplaneFromTagged("base")  # Return to tagged workplane
    .center(5, 5)
    .circle(1)
    .extrude(3)
)
```

## Multimethod Warning

CadQuery uses multimethods (dispatch by argument type). Do NOT use keyword arguments for positional parameters:

```text
# WRONG — may cause dispatch errors
sketch.arc(p1=(1, 2), p2=(2, 3), p3=(3, 4))

# RIGHT — use positional arguments
sketch.arc((1, 2), (2, 3), (3, 4))
```
