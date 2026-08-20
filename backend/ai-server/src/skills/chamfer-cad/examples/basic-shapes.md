# Basic Shapes Examples

## Simple Box

```python
import cadquery as cq

side = 10.0  # [1:1:100]

result = cq.Workplane("XY").box(side, side, side)
```

## Cylinder

```python
import cadquery as cq

height = 50.0    # [10:5:200]
diameter = 20.0  # [5:1:100]

result = cq.Workplane("XY").circle(diameter / 2).extrude(height)
```

## Sphere

```python
import cadquery as cq

radius = 10.0  # [1:1:50]

result = cq.Workplane("XY").sphere(radius)
```

## Cone

```python
import cadquery as cq

bottom_radius = 20.0  # [5:1:50]
top_radius = 10.0     # [2:1:50]
height = 30.0         # [10:5:100]

result = cq.Workplane("XY").cylinder(height, bottom_radius)
```

## Hollow Cylinder (Tube)

```python
import cadquery as cq

outer_diameter = 60.0  # [20:5:200]
inner_diameter = 50.0  # [10:5:180]
cylinder_height = 80.0 # [10:5:300]

outer = cq.Workplane("XY").circle(outer_diameter / 2).extrude(cylinder_height)
inner = cq.Workplane("XY").circle(inner_diameter / 2).extrude(cylinder_height + 2)
inner = inner.translate((0, 0, -1))
result = outer.cut(inner)
```

## Flat Washer

```python
import cadquery as cq

outer_diameter = 25.0  # [10:1:100]
inner_diameter = 10.0  # [2:0.5:90]
thickness = 2.0        # [0.5:0.5:10]

result = (
    cq.Workplane("XY")
    .circle(outer_diameter / 2)
    .circle(inner_diameter / 2)
    .extrude(thickness)
)
```

## Box with Hole

```python
import cadquery as cq

length = 80.0     # [20:5:200]
height = 60.0     # [20:5:200]
thickness = 10.0  # [2:1:50]
center_hole = 22.0 # [5:1:50]

result = (
    cq.Workplane("XY")
    .box(length, height, thickness)
    .faces(">Z")
    .workplane()
    .hole(center_hole)
)
```

## Box with Filleted Edges

```python
import cadquery as cq

length = 80.0      # [20:5:200]
width = 60.0       # [20:5:200]
thickness = 10.0   # [2:1:50]
fillet_radius = 5.0 # [0.5:0.5:20]

result = (
    cq.Workplane("XY")
    .box(length, width, thickness)
    .edges("|Z")
    .fillet(fillet_radius)
)
```

## Box with Chamfered Edges

```python
import cadquery as cq

length = 80.0      # [20:5:200]
width = 60.0       # [20:5:200]
thickness = 10.0   # [2:1:50]
chamfer_size = 3.0 # [0.5:0.5:15]

result = (
    cq.Workplane("XY")
    .box(length, width, thickness)
    .edges("|Z")
    .chamfer(chamfer_size)
)
```

## Extruded Profile

```python
import cadquery as cq

width = 10.0   # [5:1:50]
height = 5.0   # [2:1:25]
depth = 20.0   # [10:5:100]

result = cq.Workplane("XY").rect(width, height).extrude(depth)
```

## Revolved Profile

```python
import cadquery as cq

outer_radius = 20.0  # [5:1:50]
inner_radius = 10.0  # [2:1:40]
height = 30.0        # [10:5:100]

profile = (
    cq.Workplane("XZ")
    .moveTo(inner_radius, 0)
    .lineTo(outer_radius, 0)
    .lineTo(outer_radius, height)
    .lineTo(inner_radius, height)
    .close()
)
result = profile.revolve(360, (0, 0, 0), (0, 0, 1))
```
