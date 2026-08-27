# Multi-Body Examples

The sandbox exports a single `result`. Build multi-part designs as ONE Workplane:
fuse touching parts with `.union()`, or keep separate parts in a Compound with a
clearance gap between them. Never return a `cq.Assembly`.

## Stacked Parts Fused with Union

```python
import cadquery as cq

plate_length = 60.0     # [30:5:200]
plate_width = 30.0      # [15:5:100]
plate_thickness = 5.0   # [2:1:20]
pin_diameter = 6.0      # [2:1:20]
pin_height = 12.0       # [5:1:50]
pin_count = 3           # [1:1:9]

def make_pin(diameter, height):
    # Cylinder is centered on origin — lift it so its base sits at z = 0
    return cq.Workplane("XY").cylinder(height, diameter / 2).translate((0, 0, height / 2))

plate = cq.Workplane("XY").box(plate_length, plate_width, plate_thickness)
spacing = plate_length / (pin_count + 1)

result = plate
for i in range(pin_count):
    x = -plate_length / 2 + spacing * (i + 1)
    # Sink each pin 1mm into the plate so the boolean has real overlap
    pin = make_pin(pin_diameter, pin_height).translate((x, 0, plate_thickness / 2 - 1))
    result = result.union(pin)
```

## Side-by-Side Parts Kept Separate (Compound)

Use this when parts must NOT be fused (e.g., a bolt shown next to its nut).
Leave a clearance gap ≥ 0.1 mm between the parts, then join them as a Compound.

```python
import cadquery as cq

bolt_diameter = 10.0  # [4:1:30]
bolt_length = 40.0    # [10:5:200]
nut_size = 18.0       # [8:1:40]
nut_height = 8.0      # [3:1:20]
gap = 10.0            # [1:1:50]

bolt = cq.Workplane("XY").circle(bolt_diameter / 2).extrude(bolt_length)

nut = (
    cq.Workplane("XY")
    .polygon(6, nut_size, circumscribed=True)
    .extrude(nut_height)
    .faces(">Z")
    .workplane()
    .hole(bolt_diameter)
)
nut = nut.translate((bolt_diameter / 2 + nut_size / 2 + gap, 0, 0))

result = cq.Workplane("XY").newObject(
    [cq.Compound.makeCompound([bolt.val(), nut.val()])]
)
```

## Positioning with an Assembly Helper, Then Converting

`cq.Assembly` is a convenient way to place many parts with `cq.Location`,
but you must convert it to a Compound before assigning it to `result`.

```python
import cadquery as cq
import math

post_height = 30.0   # [10:5:100]
post_count = 4       # [2:1:8]
ring_radius = 25.0   # [10:5:60]

def make_post(height):
    return cq.Workplane("XY").cylinder(height, 3).translate((0, 0, height / 2))

base = cq.Workplane("XY").cylinder(4, ring_radius + 8)

assy = cq.Assembly().add(base, name="base")
for i in range(post_count):
    angle = 2 * math.pi * i / post_count
    x = ring_radius * math.cos(angle)
    y = ring_radius * math.sin(angle)
    assy = assy.add(make_post(post_height), name=f"post{i}", loc=cq.Location(cq.Vector(x, y, 0)))

result = cq.Workplane("XY").newObject([assy.toCompound()])
```

## Reusable Component Functions

```python
import cadquery as cq

bracket_width = 40.0   # [20:5:100]
bracket_height = 30.0  # [15:5:80]
bracket_thickness = 5.0 # [2:1:15]
hole_dia = 8.0         # [3:1:20]
separation = 60.0      # [40:5:150]

def make_bracket(width, height, thickness, bore):
    return (
        cq.Workplane("XY")
        .box(width, height, thickness)
        .faces(">Z")
        .workplane()
        .hole(bore)
    )

left = make_bracket(bracket_width, bracket_height, bracket_thickness, hole_dia)
right = make_bracket(bracket_width, bracket_height, bracket_thickness, hole_dia)
right = right.translate((separation, 0, 0))

# Two independent brackets, kept separate as a Compound
result = cq.Workplane("XY").newObject(
    [cq.Compound.makeCompound([left.val(), right.val()])]
)
```
