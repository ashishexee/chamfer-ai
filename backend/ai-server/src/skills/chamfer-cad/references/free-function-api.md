# CadQuery Free Function API Reference

## Overview

The free function API provides more flexibility for crafting individual objects. It has no hidden state, but may result in more verbose code.

```python
from cadquery.func import *
```

## Primitives

```python
e = segment((0,0), (0,1))
c = circle(1)
f = plane(1, 1.5)
b = box(1, 1, 1)
```

## Boolean Operations

```python
# Union
r1 = c2 + c1
r2 = fuse(f1, f2)

# Difference
r3 = c1 - c2
r4 = cut(f1, f2)

# Intersection
r5 = c1 * c2
r6 = intersect(f1, f2)

# Splitting
r7 = (c1 / f1).solids('<Z')
r8 = split(f2, e1).faces('<X')
```

## Shape Construction

```python
# Wire from edges
e1 = segment((0,0), (1,0))
e2 = segment((1,0), (1,1))
r1 = wire(e1, e2)

# Face from a planar wire
c1 = circle(1)
r2 = face(c1)

# Solid from faces
f1 = plane(1,1)
f2 = f1.moved(z=1)
f3 = extrude(f1.wires(), (0,0,1))
r3 = solid(f1, f2, *f3)

# Compound from shapes
r4 = compound(s1, s2, s3)
```

## Operations

```python
# Extrude
s1 = extrude(r, (0,0,2))
s2 = extrude(fill(r), (0,0,1))

# Sweep
s3 = sweep(r, p)
s4 = sweep(f, p)

# Loft
s5 = loft(r, c.moved(z=2))
s6 = loft(r, c.moved(z=1), cap=True)

# Revolve
s7 = revolve(fill(r), (0.5, 0, 0), (0, 1, 0), 90)
```

## Placement

```python
# Move single object
s.move(rx=15)

# Move multiple objects
s.moved(locs)
s.moved(loc1, loc2, *locs)
```

## Shape Selection

```python
# Select by type
result = box.faces(">Z")
result = box.edges("|Z")
result = box.vertices()

# Combine selectors
result = box.edges("|Z and >Y")
result = box.faces(">Z or <Z")
```

## Free Function Examples

### Hollow Box

```python
from cadquery.func import *

w = 1
r = 0.9*w/2

# box
b = box(w, w, w)
# bottom face
b_bot = b.faces('<Z')
# top faces
b_top = b.faces('>Z')

# inner face
inner = extrude(circle(r), (0,0,w))

# add holes to the bottom and top face
b_bot_hole = b_bot.addHole(inner.edges('<Z'))
b_top_hole = b_top.addHole(inner.edges('>Z'))

# construct the final solid
result = solid(
    b.remove(b_top, b_bot).faces(),
    b_bot_hole,
    inner,
    b_top_hole,
)
```

### Text on Surface

```python
from cadquery.func import *
from math import pi

D = 5
H = 2*D

# base and spine
c = cylinder(D, H).moved(rz=-135)
cf = c.faces("%CYLINDER")
spine = (c*plane().moved(z=D)).edges().trim(pi/2, pi)

# planar
r1 = text("CadQuery", 1, spine, planar=True).moved(z=-S)

# normal
r2 = text("CadQuery", 1, spine)

# projected
r3 = text("CadQuery", 1, spine, cf).moved(z=S)

# projected and thickened
r4 = offset(r3, TH).moved(z=S)

result = compound(r1, r2, r3, r4)
```
