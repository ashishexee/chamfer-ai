# Organic Shapes Examples

## Spoon with Overlapping Handle

```python
import cadquery as cq

# Parameters
spoon_length = 200.0    # [100:10:300]
handle_length = 120.0   # [60:5:200]
handle_width = 12.0     # [5:1:20]
handle_thickness = 4.0  # [2:0.5:10]
bowl_width = 50.0       # [30:2:80]
bowl_length = 60.0      # [30:2:80]
bowl_depth = 8.0        # [3:1:15]
bowl_thickness = 2.0    # [1:0.5:5]
overlap = 5.0           # [1:1:20]

# Handle
handle = cq.Workplane("XY").box(handle_length, handle_width, handle_thickness, centered=True)
handle = handle.translate((-spoon_length / 2 + handle_length / 2 + overlap / 2, 0, 0))

# Bowl
bowl_base = cq.Workplane("XY").box(bowl_length, bowl_width, bowl_thickness, centered=True)

# Bowl depression
bowl_cavity = (
    cq.Workplane("XY")
    .workplane(offset=bowl_thickness / 2)
    .ellipse(bowl_length / 2 - 4, bowl_width / 2 - 4)
    .extrude(-bowl_depth)
)

bowl = bowl_base.cut(bowl_cavity)
bowl = bowl.translate((spoon_length / 2 - bowl_length / 2 - overlap / 2, 0, 0))

# Combine with guaranteed overlap
result = handle.union(bowl)
```

## Mug with Handle

```python
import cadquery as cq

# Parameters
outer_diameter = 80.0   # [50:5:120]
inner_diameter = 70.0   # [40:5:110]
height = 90.0           # [60:5:150]
handle_diameter = 12.0  # [5:1:20]
handle_length = 40.0    # [20:5:70]
handle_overlap = 5.0    # [1:1:15]

# Body
outer = cq.Workplane("XY").circle(outer_diameter / 2).extrude(height)
inner = cq.Workplane("XY").circle(inner_diameter / 2).extrude(height + 2)
inner = inner.translate((0, 0, -1))
body = outer.cut(inner)

# Handle (C-shape)
upper = cq.Workplane("XY").circle(handle_diameter / 2).extrude(handle_length + handle_overlap)
upper = upper.translate((0, outer_diameter / 2 + handle_length / 2 - handle_overlap / 2, height - 25))

lower = cq.Workplane("XY").circle(handle_diameter / 2).extrude(handle_length + handle_overlap)
lower = lower.translate((0, outer_diameter / 2 + handle_length / 2 - handle_overlap / 2, 25))

bar = cq.Workplane("XY").box(handle_diameter, handle_length, height - 50, centered=True)
bar = bar.translate((0, outer_diameter / 2 + handle_length / 2 - handle_overlap / 2, height / 2))

handle = upper.union(lower).union(bar)
handle = handle.rotate((0, 0, 0), (0, 0, 1), 90)

# Union with body
result = body.union(handle)
```

## Hammer with Claw Head

```python
import cadquery as cq

# Parameters
head_length = 60.0       # [30:5:100]
head_width = 30.0        # [15:2:50]
head_height = 30.0       # [15:2:50]
claw_opening = 15.0      # [5:2:30]
handle_length = 150.0    # [80:5:250]
handle_diameter = 20.0   # [10:1:35]
connector_length = 10.0  # [5:1:20]
connector_diameter = 22.0 # [10:1:40]

# Hammer head
head = cq.Workplane("XY").box(head_length, head_width, head_height, centered=True)

# Claw slot
claw_slot = cq.Workplane("XY").box(claw_opening, head_width + 2, head_height + 2, centered=True)
claw_slot = claw_slot.translate((head_length / 2 - claw_opening / 2, 0, 0))
head = head.cut(claw_slot)

# Connector
connector = cq.Workplane("XY").circle(connector_diameter / 2).extrude(connector_length)
connector = connector.translate((0, 0, handle_length / 2 - connector_length / 2))

# Handle
handle = cq.Workplane("XY").circle(handle_diameter / 2).extrude(handle_length)
handle = handle.translate((0, 0, -handle_length / 2))

# Position head
head = head.translate((0, 0, handle_length / 2 + connector_length / 2))

# Union
result = head.union(connector).union(handle)
```
