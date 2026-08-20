# Mechanical Parts Examples

## Bearing Pillow Block

```python
import cadquery as cq

# Parameters
length = 30.0      # [20:5:100]
height = 40.0      # [20:5:100]
bearing_dia = 22.0 # [10:1:50]
thickness = 10.0   # [5:1:30]
padding = 8.0      # [5:1:30]

result = (
    cq.Workplane("XY")
    .box(length, height, thickness)
    .faces(">Z")
    .workplane()
    .hole(bearing_dia)
    .faces(">Z")
    .workplane()
    .rect(length - padding, height - padding, forConstruction=True)
    .vertices()
    .cboreHole(2.4, 4.4, 2.1)
)
```

## Pipe Flange with Bolt Circle

```python
import cadquery as cq

# Parameters
outer_diameter = 150.0     # [50:10:500]
inner_diameter = 100.0     # [20:10:480]
thickness = 10.0           # [2:1:30]
bolt_hole_count = 8        # [4:1:20]
bolt_circle_diameter = 125.0 # [30:5:480]
bolt_hole_diameter = 10.0  # [4:0.5:30]

# Flange base
flange = (
    cq.Workplane("XY")
    .circle(outer_diameter / 2)
    .circle(inner_diameter / 2)
    .extrude(thickness)
)

# Bolt holes
flange = (
    flange
    .faces(">Z")
    .workplane()
    .polarArray(bolt_circle_diameter / 2, 0, 360, bolt_hole_count)
    .hole(bolt_hole_diameter)
)

result = flange
```

## L-Bracket with Holes

```python
import cadquery as cq

# Parameters
bracket_length = 100.0   # [30:5:300]
bracket_width = 50.0     # [20:5:150]
bracket_thickness = 5.0  # [1:0.5:15]
hole_diameter = 6.0      # [2:0.5:20]
hole_offset = 10.0       # [5:1:30]
fillet_radius = 1.5      # [0:0.5:10]

# Horizontal leg
base = cq.Workplane("XY").box(bracket_length, bracket_width, bracket_thickness, centered=True)

# Vertical leg
leg = cq.Workplane("YZ").box(bracket_length, bracket_width, bracket_thickness, centered=True)
leg = leg.translate((0, bracket_width / 2, bracket_width / 2))

# Combine
bracket = base.union(leg)

# Holes on horizontal leg
bracket = (
    bracket
    .faces(">Z")
    .workplane()
    .rarray(bracket_length - 2 * hole_offset, 1, 2, 1)
    .hole(hole_diameter)
)

# Holes on vertical leg
bracket = (
    bracket
    .faces(">X")
    .workplane()
    .rarray(bracket_length - 2 * hole_offset, 1, 2, 1)
    .hole(hole_diameter)
)

# Fillets
bracket = bracket.edges("|Z").fillet(fillet_radius)

result = bracket
```

## Pulley with Bore and Groove

```python
import cadquery as cq

# Parameters
pulley_diameter = 80.0  # [20:5:300]
pulley_width = 20.0     # [5:1:100]
bore_diameter = 10.0    # [3:0.5:50]
groove_depth = 5.0      # [1:0.5:20]
groove_width = 4.0      # [1:0.5:20]

# Main pulley cylinder
pulley = cq.Workplane("XY").circle(pulley_diameter / 2).extrude(pulley_width)

# Center bore
bore = cq.Workplane("XY").circle(bore_diameter / 2).extrude(pulley_width + 2)
bore = bore.translate((0, 0, -1))

# Belt groove
groove = (
    cq.Workplane("XY")
    .workplane(offset=pulley_width / 2 - groove_width / 2)
    .circle(pulley_diameter / 2 + 1)
    .circle(pulley_diameter / 2 - groove_depth)
    .extrude(groove_width)
)

# Apply cuts
result = pulley.cut(bore).cut(groove)
```

## Shaft with Keyway

```python
import cadquery as cq

# Parameters
shaft_diameter = 30.0   # [5:1:100]
shaft_length = 150.0    # [20:5:500]
keyway_width = 8.0      # [2:0.5:20]
keyway_depth = 4.0      # [1:0.5:15]
keyway_length = 50.0    # [10:5:200]

# Main shaft cylinder
shaft = cq.Workplane("XY").circle(shaft_diameter / 2).extrude(shaft_length)

# Keyway cutter
keyway_cutter = (
    cq.Workplane("XY")
    .center(shaft_diameter / 2 - keyway_depth / 2, 0)
    .rect(keyway_depth, keyway_width)
    .extrude(keyway_length)
)

# Subtract keyway from shaft
result = shaft.cut(keyway_cutter)
```

## Hex Head Bolt

```python
import cadquery as cq

# Parameters
bolt_diameter = 10.0   # [3:0.5:30]
bolt_length = 50.0     # [10:5:200]
head_diameter = 16.0   # [5:1:50]
head_height = 7.0      # [2:0.5:20]

# Shank cylinder
shank = cq.Workplane("XY").circle(bolt_diameter / 2).extrude(bolt_length)

# Hex head
head = (
    cq.Workplane("XY")
    .polygon(6, head_diameter, circumscribed=True)
    .extrude(head_height)
)
head = head.translate((0, 0, bolt_length))

result = shank.union(head)
```

## Electronics Enclosure

```python
import cadquery as cq

# Parameters
length = 120.0     # [30:5:300]
width = 80.0       # [30:5:300]
height = 50.0      # [10:5:200]
wall = 2.0         # [1:0.5:6]

# Outer shell
outer = cq.Workplane("XY").box(length, width, height, centered=True)

# Inner cavity
inner = cq.Workplane("XY").box(length - 2 * wall, width - 2 * wall, height - wall, centered=True)
inner = inner.translate((0, 0, wall / 2))

# Hollow enclosure
result = outer.cut(inner)
```
