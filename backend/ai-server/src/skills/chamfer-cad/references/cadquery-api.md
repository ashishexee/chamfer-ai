# CadQuery Core API Reference

## Core Concepts

CadQuery builds 3D models by creating a Workplane (2D sketch plane), drawing profiles, and extruding/revolving/lofting them into solids.

- Operations are chained: `result = cq.Workplane("XY").box(10,20,30).edges("|Z").fillet(2)`
- All dimensions are in millimeters
- The final geometry must be assigned to the variable `result`

## Essential Import

```python
import cadquery as cq
```

## Workplane Creation

```python
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

```python
# Create a workplane on the topmost face
result = cq.Workplane("XY").box(10, 10, 10).faces(">Z").workplane()

# Use CenterOfMass for the workplane origin
result = cq.Workplane("XY").box(10, 10, 10).faces(">Z").workplane(centerOption="CenterOfMass")

# Offset the workplane from the face
result = cq.Workplane("XY").box(10, 10, 10).faces(">Z").workplane(offset=5)
```

## 2D Drawing Operations

### Basic Shapes

```python
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

```python
result = (
    cq.Workplane("XY")
    .moveTo(0, 0)
    .lineTo(10, 0)       # Absolute endpoint
    .line(5, 0)          # Relative distance
    .hLine(5)            # Horizontal, relative
    .hLineTo(20)         # Horizontal, absolute X
    .vLine(5)            # Vertical, relative
    .vLineTo(15)         # Vertical, absolute Y
    .polarLine(10, 45)   # Line at angle, given length
    .polarLineTo(10, 45) # Line to polar coordinates
    .close()             # Close the wire
    .extrude(5)
)
```

### Arcs and Splines

```python
.threePointArc(point1, point2)      # Arc through 3 points
.sagittaArc(endPoint, sag)          # Arc defined by sagitta
.radiusArc(endPoint, radius)        # Arc defined by radius
.tangentArcPoint(endpoint)          # Tangent arc from current edge end
.spline(listOfXYTuple)              # Spline through points
.parametricCurve(func, N=20)        # Curve from function
```

### Offsetting 2D Wires

```python
.offset2D(d)                       # Offset by distance d
.offset2D(d, kind="arc")           # Arc corners (default)
.offset2D(d, kind="intersection")  # Sharp corners
.offset2D(d, kind="tangent")       # Tangent corners
```

## 3D Operations

### Primitives

```python
.box(length, width, height, centered=True)
.box(length, width, height, centered=(True, True, True))
.cylinder(height, radius)
.cylinder(height, radius, direct=(0, 0, 1), centered=(True, True, True))
.sphere(radius)
.sphere(radius, direct=(0, 0, 1), angle1=-90, angle2=90, angle3=360)
.wedge(dx, dy, dz, xmin, zmin, xmax, zmax)
.text(txt, fontsize, distance)
```

### Extrude

```python
.extrude(distance)                    # Extrude by distance, combine with context
.extrude(distance, combine=False)     # Don't combine with context solid
.extrude(distance, taper=5)           # 5 degree taper
.extrude(distance, both=True)         # Extrude both directions
```

### Revolve

```python
.revolve()                                              # Full 360 around X axis
.revolve(angleDegrees=180, axisStart=(0,0,0), axisEnd=(1,0,0))
```

### Loft

```python
# Loft through multiple wires on offset workplanes
result = (
    cq.Workplane("XY")
    .circle(5)
    .workplane(offset=10)
    .circle(3)
    .workplane(offset=10)
    .circle(1)
    .loft()
)

.loft(ruled=True)   # Ruled loft (straight edges between sections)
```

### Sweep

```python
# Sweep a profile along a path
path = cq.Workplane("XY").polyline([(0,0), (0, 10), (10, 10)])
result = cq.Workplane("YZ").circle(1).sweep(path)

# Sweep with transition
result = cq.Workplane("YZ").rect(2, 2).sweep(path, transition="round")
```

## Holes, Fillets, Chamfers

### Simple Holes

```python
# Through hole (cuts through entire solid)
.hole(diameter)

# Blind hole (specific depth)
.hole(diameter, depth)
```

### Counterbored Holes

```python
# cboreHole(diameter, cboreDiameter, cboreDepth)
.cboreHole(2.4, 4.4, 2.1)

# With optional through-hole depth
.cboreHole(2.4, 4.4, 2.1, depth=10)
```

### Countersunk Holes

```python
# cskHole(diameter, cskDiameter, cskAngle)
.cskHole(2.4, 4.4, 82)

# With optional through-hole depth
.cskHole(2.4, 4.4, 82, depth=10)
```

### Fillets

```python
# Fillet selected edges by radius
.edges("|Z").fillet(2.0)

# 2D fillet (on wires/faces in sketch mode)
.fillet2D(radius, wire)
```

### Chamfers

```python
# Symmetric chamfer
.edges("|Z").chamfer(1.0)

# Asymmetric chamfer (two lengths)
.edges("|Z").chamfer(1.0, 0.5)

# 2D chamfer (on wires/faces in sketch mode)
.chamfer2D(length, wire)
```

### Shell (Hollow)

```python
# Shell by removing selected faces, leaving walls of given thickness
.faces(">Z").shell(2.0)       # Remove top face, shell with 2mm walls

# Negative thickness = inward shell
.faces(">Z").shell(-2.0)
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
```

## Boolean Operations

### Union (fuse)

```python
result = body.union(other_body)
result = body + other_body
```

### Cut (subtract)

```python
result = body.cut(toCut)
result = body - cutter
```

### Intersect

```python
result = body.intersect(toIntersect)
result = body & other_body
```

## Transformations

### Translate

```python
.translate((x, y, z))                    # Move by vector
```

### Rotate

```python
.rotate((0,0,0), (1,0,0), 90)           # axisStart, axisEnd, angleDegrees
.rotateAboutCenter((1,0,0), 45)
```

### Mirror

```python
.mirror("XY")           # Mirror about XY plane
.mirror("XZ")
.mirror("YZ")
.mirrorX()              # Mirror about X axis of workplane
.mirrorY()              # Mirror about Y axis of workplane
```

## Tags

Tags let you refer back to a specific Workplane state later in the chain:

```python
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
solid = result.val()
solid.Volume()              # Total volume
solid.Area()                # Total surface area
solid.BoundingBox()         # Bounding box
solid.Center()              # Center of mass
solid.isValid()             # Check if geometry is valid
solid.geomType()            # Geometry type string
solid.Faces()               # List of all faces
solid.Edges()               # List of all edges
solid.Vertices()            # List of all vertices
```

## Stack Navigation

```python
# .val() — Get first value on stack
box = cq.Workplane().box(10, 5, 5)
box.val()  # Returns Solid object

# .vals() — Get all values on stack
box.vals()  # Returns list of shapes

# .findSolid() — Get context solid (Solid or Compound)
part = cq.Workplane().box(10,5,5).circle(3).findSolid()

# .end(n) — Go back n parents in the chain
cq.Workplane().box(1,1,1).faces(">Z").vertices().end()  # Back to faces
cq.Workplane().box(1,1,1).faces(">Z").vertices().end(2) # Back to box

# .size() — Number of objects on stack
cq.Workplane().box(1,1,1).faces(">Z").vertices().size()  # Returns 4
```

## Context Solid and combine=False

The first solid created becomes the "context solid." Subsequent features auto-combine with it:

```python
# Auto-union (default)
result = cq.Workplane("XY").box(1,2,3).faces(">Z").circle(0.25).extrude(1)

# Keep separate with combine=False
result = cq.Workplane("XY").box(1,2,3).faces(">Z").circle(0.25).extrude(1, combine=False)
```

## toPending() — Required for Loft/Sweep

When selecting wires/edges for loft or sweep, you must push them to the pending list:

```python
# WRONG: Loft won't find the wire
result = cq.Workplane("XY").circle(5).workplane(offset=10).circle(3).loft()

# RIGHT: Push wires to pending before loft
result = (
    cq.Workplane("XY")
    .circle(5)
    .workplane(offset=10)
    .circle(3)
    .loft()
)
# Note: circle() automatically adds to pending, but selecting existing wires requires toPending()

# For selected wires:
result = (
    cq.Workplane("XY")
    .box(10, 10, 10)
    .faces(">Z")
    .wires()
    .toPending()  # Required!
    .translate((0, 0, 5))
    .toPending()
    .loft()
)
```

## Extrude Until Face

```python
# Extrude until next face
result = cq.Workplane().circle(2).extrude("next")

# Extrude until last face
result = cq.Workplane().circle(2).extrude("last")

# Cut until a specific face
target_face = result.faces(">Z").val()
result = cq.Workplane().circle(5).cutBlind(target_face)
```

## Tags and workplaneFromTagged()

```python
# Tag a workplane state
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

```python
# WRONG — may cause dispatch error
sketch.arc(p1=(1, 2), p2=(2, 3), p3=(3, 4))

# RIGHT — use positional arguments
sketch.arc((1, 2), (2, 3), (3, 4))
```
