# Organic Shapes Examples

Every example here has been executed in the sandbox and checked for correct
geometry (not just "it ran"). Key techniques: sphere cuts that floor inside
the part, blind `cutBlind` cavities, and swept handles whose path starts at
its workplane origin.

## Spoon with Sculpted Bowl

The bowl cavity is a sphere cut whose lowest point stays ABOVE the plate
bottom, so the bowl floors instead of punching through. The handle overlaps
the bowl by `overlap` mm so the union has real shared volume.

```python
import cadquery as cq

# Parameters
bowl_length = 30.0      # [20:2:60]
bowl_width = 20.0       # [12:2:40]
bowl_thickness = 3.0    # [2:0.5:8]
bowl_depth = 1.5        # [0.5:0.5:1.5]  must stay < bowl_thickness
handle_length = 58.0    # [30:5:120]
handle_width = 6.0      # [4:1:12]
overlap = 2.0           # [1:1:5]

# Bowl plate (ellipse footprint) and handle overlapping it
bowl = cq.Workplane("XY").ellipse(bowl_length / 2, bowl_width / 2).extrude(bowl_thickness)
handle = cq.Workplane("XY").box(handle_length, handle_width, bowl_thickness).translate(
    (bowl_length / 2 - overlap + handle_length / 2, 0, bowl_thickness / 2)
)
spoon = bowl.union(handle)

# Cavity: sphere centered so it cuts bowl_depth into the top surface and
# leaves a floor of (bowl_thickness - bowl_depth)
sphere_radius = bowl_length / 2 - 1
cutter = cq.Workplane("XY").workplane(
    offset=bowl_thickness + sphere_radius - bowl_depth
).sphere(sphere_radius)

result = spoon.cut(cutter)
```

## Mug with Swept Handle

The body cavity uses `cutBlind` with a NEGATIVE depth (down into the part),
leaving a solid bottom. The handle path is drawn starting at the ORIGIN of
its workplane — sweep does not relocate profiles reliably otherwise — and
the swept handle is translated onto the wall afterwards.

```python
import cadquery as cq

# Parameters
outer_radius = 20.0    # [12:1:40]
wall = 3.0             # [1.5:0.5:6]
bottom = 3.0           # [1.5:0.5:6]
height = 40.0          # [25:5:80]
handle_radius = 2.5    # [1.5:0.5:3.5]

# Body with a blind cavity (floor stays `bottom` mm thick)
body = cq.Workplane("XY").circle(outer_radius).extrude(height)
cavity = (
    body
    .faces(">Z")
    .workplane()
    .circle(outer_radius - wall)
    .cutBlind(-(height - bottom))
)

# Handle: path anchored at the XZ workplane origin, profile plane (YZ)
# perpendicular to the path start direction (+X), then positioned so both
# ends bury 1 mm into the mug wall
handle_path = cq.Workplane("XZ").threePointArc((12, 0), (0, 16))
handle = (
    cq.Workplane("YZ")
    .circle(handle_radius)
    .sweep(handle_path)
    .translate((outer_radius - 1, 0, height * 0.35))
)

result = cavity.union(handle)
```

## Hammer with Claw Head

The claw is a single angled slot cut through the head end, leaving two
prongs. The handle is embedded several millimeters into the head before the
union so the parts cannot end up disconnected.

```python
import cadquery as cq

# Parameters
head_length = 36.0     # [24:2:60]
head_width = 16.0      # [10:1:24]
head_height = 16.0     # [10:1:24]
handle_length = 42.0   # [25:5:80]
handle_width = 8.0     # [5:1:12]
handle_depth = 12.0    # [8:1:18]
claw_angle = 28.0      # [15:1:40]

# Head sunk onto the top of the handle (overlap = head_height/2 + 2)
head = cq.Workplane("XY").box(head_length, head_width, head_height).translate(
    (0, 0, handle_length - 2)
)
handle = cq.Workplane("XY").box(handle_width, handle_depth, handle_length).translate(
    (0, 0, handle_length / 2)
)
hammer = head.union(handle)

# Angled slot through the -X end of the head -> two claw prongs
claw_cutter = (
    cq.Workplane("XY")
    .box(head_length / 2, 3, head_height * 1.625)
    .rotate((0, 0, 0), (0, 1, 0), claw_angle)
    .translate((-(head_length / 2 + 1), 0, handle_length + 2))
)

result = hammer.cut(claw_cutter)
```
