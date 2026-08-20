# CadQuery Assembly Patterns

## Basic Assembly

```python
import cadquery as cq

part1 = cq.Workplane().box(20, 20, 10)
part2 = cq.Workplane().box(10, 10, 20)

assy = (
    cq.Assembly()
    .add(part1, name="base", color=cq.Color("red"))
    .add(part2, name="post", color=cq.Color(0, 0, 1, 0.5))
)
```

## Color Options

```python
# Named colors (X11 color names)
cq.Color("red")
cq.Color("green")
cq.Color("blue")
cq.Color("black")
cq.Color("yellow")
cq.Color("orange")

# RGBA (0.0 to 1.0)
cq.Color(1, 0, 0)          # Red, opaque
cq.Color(0, 0, 1, 0.5)     # Blue, 50% transparent
cq.Color(1, 1, 0, 0.2)     # Yellow, 20% transparent
```

## Positioning with Locations

```python
# Explicit locations (relative to parent)
assy = (
    cq.Assembly(part1, loc=cq.Location(cq.Vector(0, 0, 0)), name="part1")
    .add(part2, loc=cq.Location(cq.Vector(10, 0, 5)), color=cq.Color("red"))
)

# Location with rotation
# cq.Location(position, axis_vector, angle_degrees)
assy.add(part, loc=cq.Location((0, 0, 0), (1, 0, 0), 180))
```

## Positioning with Constraints and Solver

```python
# Define constraints then solve
assy = (
    cq.Assembly(part1, name="part1")
    .add(part2, name="part2", color=cq.Color("blue"))
    .constrain("part1@faces@>Z", "part2@faces@<Z", "Plane")
    .constrain("part1@faces@>Y", "part2@faces@<Y", "Axis")
    .solve()
)
```

## Constraint Types

| Constraint      | Description                                        |
|-----------------|----------------------------------------------------|
| `Point`         | Two points coincident (or separated by distance)   |
| `Axis`          | Two normals anti-coincident (mate) or at angle     |
| `Plane`         | Combination of Point + Axis (coincident planes)    |
| `PointInPlane`  | Point lies on a plane (with optional offset)       |
| `PointOnLine`   | Point lies on a line (with optional offset)        |
| `Fixed`         | Fix position and rotation of an object             |
| `FixedPoint`    | Fix position to a specific point                   |
| `FixedRotation` | Fix rotation to specific angles                    |
| `FixedAxis`     | Fix orientation of normal/tangent to a vector      |

## Constraint Selector Syntax

```python
# String syntax: "name@type@selector" or "name?tag"
.constrain("part1@faces@>Z", "part2@faces@<Z", "Plane")
.constrain("part1?myTag", "part2?otherTag", "Point")

# With param (e.g., offset distance or angle)
.constrain("part1@faces@>Z", "part2@faces@<Z", "Axis", param=0)  # Same direction
.constrain("part1", "part2", "Point", param=5)                   # 5 units apart

# Fixed constraint (locks all DOF)
.constrain("part1", "Fixed")
```

## Tagging Faces/Edges for Constraints

```python
# Tag faces/edges in the part definition for easy constraint reference
def make_connector():
    rv = (
        cq.Workplane()
        .box(20, 20, 20)
        .faces("<X")
        .workplane()
        .cboreHole(6, 15, 18)
        .faces("<Z")
        .workplane(centerOption="CenterOfMass")
        .cboreHole(6, 15, 18)
    )

    # tag mating faces
    rv.faces(">X").tag("X").end()
    rv.faces(">Z").tag("Z").end()

    return rv

# Then in constraints:
.constrain("left?Z", "con_bl?Z", "Plane")
```

## Assembly Export

```python
# Export assembly to STEP (preserves colors and names)
assy.export("assembly.step")

# Fused mode (single solid, preserves color info)
assy.export("assembly_fused.step", mode="fused")

# Export to glTF/GLB (for web rendering -- preserves colors!)
assy.export("assembly.glb")
assy.export("assembly.gltf")
```

## Assembly Example: Door with V-Slot Profiles

```python
import cadquery as cq

# Parameters
H = 400
W = 200
D = 350

PROFILE = cq.importers.importDXF("vslot-2020_1.dxf").wires()

SLOT_D = 5
PANEL_T = 3

HANDLE_D = 20
HANDLE_L = 50
HANDLE_W = 4


def make_vslot(l):
    return PROFILE.toPending().extrude(l)


def make_connector():
    rv = (
        cq.Workplane()
        .box(20, 20, 20)
        .faces("<X")
        .workplane()
        .cboreHole(6, 15, 18)
        .faces("<Z")
        .workplane(centerOption="CenterOfMass")
        .cboreHole(6, 15, 18)
    )

    # tag mating faces
    rv.faces(">X").tag("X").end()
    rv.faces(">Z").tag("Z").end()

    return rv


def make_panel(w, h, t, cutout):
    rv = (
        cq.Workplane("XZ")
        .rect(w, h)
        .extrude(t)
        .faces(">Y")
        .vertices()
        .rect(2 * cutout, 2 * cutout)
        .cutThruAll()
        .faces("<Y")
        .workplane()
        .pushPoints([(-w / 3, HANDLE_L / 2), (-w / 3, -HANDLE_L / 2)])
        .hole(3)
    )

    # tag mating edges
    rv.faces(">Y").edges("%CIRCLE").edges(">Z").tag("hole1")
    rv.faces(">Y").edges("%CIRCLE").edges("<Z").tag("hole2")

    return rv


def make_handle(w, h, r):
    pts = ((0, 0), (w, 0), (w, h), (0, h))

    path = cq.Workplane().polyline(pts)

    rv = (
        cq.Workplane("YZ")
        .rect(r, r)
        .sweep(path, transition="round")
        .tag("solid")
        .faces("<X")
        .workplane()
        .faces("<X", tag="solid")
        .hole(r / 1.5)
    )

    # tag mating faces
    rv.faces("<X").faces(">Y").tag("mate1")
    rv.faces("<X").faces("<Y").tag("mate2")

    return rv


# define the elements
door = (
    cq.Assembly()
    .add(make_vslot(H), name="left")
    .add(make_vslot(H), name="right")
    .add(make_vslot(W), name="top")
    .add(make_vslot(W), name="bottom")
    .add(make_connector(), name="con_tl", color=cq.Color("black"))
    .add(make_connector(), name="con_tr", color=cq.Color("black"))
    .add(make_connector(), name="con_bl", color=cq.Color("black"))
    .add(make_connector(), name="con_br", color=cq.Color("black"))
    .add(
        make_panel(W + SLOT_D, H + SLOT_D, PANEL_T, SLOT_D),
        name="panel",
        color=cq.Color(0, 0, 1, 0.2),
    )
    .add(
        make_handle(HANDLE_D, HANDLE_L, HANDLE_W),
        name="handle",
        color=cq.Color("yellow"),
    )
)

# define the constraints
(
    door
    # left profile
    .constrain("left@faces@<Z", "con_bl?Z", "Plane")
    .constrain("left@faces@<X", "con_bl?X", "Axis")
    .constrain("left@faces@>Z", "con_tl?Z", "Plane")
    .constrain("left@faces@<X", "con_tl?X", "Axis")
    # top
    .constrain("top@faces@<Z", "con_tl?X", "Plane")
    .constrain("top@faces@<Y", "con_tl@faces@>Y", "Axis")
    # bottom
    .constrain("bottom@faces@<Y", "con_bl@faces@>Y", "Axis")
    .constrain("bottom@faces@>Z", "con_bl?X", "Plane")
    # right connectors
    .constrain("top@faces@>Z", "con_tr@faces@>X", "Plane")
    .constrain("bottom@faces@<Z", "con_br@faces@>X", "Plane")
    .constrain("left@faces@>Z", "con_tr?Z", "Axis")
    .constrain("left@faces@<Z", "con_br?Z", "Axis")
    # right profile
    .constrain("right@faces@>Z", "con_tr@faces@>Z", "Plane")
    .constrain("right@faces@<X", "left@faces@<X", "Axis")
    # panel
    .constrain("left@faces@>X[-4]", "panel@faces@<X", "Plane")
    .constrain("left@faces@>Z", "panel@faces@>Z", "Axis")
    # handle
    .constrain("panel?hole1", "handle?mate1", "Plane")
    .constrain("panel?hole2", "handle?mate2", "Point")
)

# solve
door.solve()

# export
door.export("door.step")
```
