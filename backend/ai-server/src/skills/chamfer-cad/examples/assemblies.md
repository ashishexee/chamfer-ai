# Assembly Examples

## Simple Assembly with Locations

```python
import cadquery as cq

# Create parts
body = cq.Workplane().box(20, 20, 10)
pin = cq.Workplane().center(0, 0).cylinder(radius=2, height=20)

# Create assembly
assy = cq.Assembly(name="my_part")
assy.add(body, name="body", color=cq.Color(0.6, 0.6, 0.6, 1.0))
assy.add(pin, name="pin", color=cq.Color(0.8, 0.2, 0.2, 1.0))

# Export for web rendering (GLB with colors)
assy.export("output.glb")

# Export for engineering (STEP)
assy.export("output.step")
```

## Assembly with Constraints

```python
import cadquery as cq

w = 10
d = 10
h = 10

part1 = cq.Workplane().box(2 * w, 2 * d, h)
part2 = cq.Workplane().box(w, d, 2 * h)
part3 = cq.Workplane().box(w, d, 3 * h)

assy = (
    cq.Assembly(part1, name="part1", loc=cq.Location(cq.Vector(-w, 0, h / 2)))
    .add(part2, name="part2", color=cq.Color(0, 0, 1, 0.5))
    .add(part3, name="part3", color=cq.Color("red"))
    .constrain("part1@faces@>Z", "part3@faces@<Z", "Axis")
    .constrain("part1@faces@>Z", "part2@faces@<Z", "Axis")
    .constrain("part1@faces@>Y", "part3@faces@<Y", "Axis")
    .constrain("part1@faces@>Y", "part2@faces@<Y", "Axis")
    .constrain("part1@vertices@>(-1,-1,1)", "part3@vertices@>(-1,-1,-1)", "Point")
    .constrain("part1@vertices@>(1,-1,-1)", "part2@vertices@>(-1,-1,-1)", "Point")
    .solve()
)

assy.export("assembly.step")
assy.export("assembly.glb")
```

## Assembly with Tags

```python
import cadquery as cq

w = 10
d = 10
h = 10

part1 = cq.Workplane().box(2 * w, 2 * d, h)
part2 = cq.Workplane().box(w, d, 2 * h)
part3 = cq.Workplane().box(w, d, 3 * h)

# Tag faces for easy constraint reference
part1.faces(">Z").edges("<X").vertices("<Y").tag("pt1")
part1.faces(">X").edges("<Z").vertices("<Y").tag("pt2")
part3.faces("<Z").edges("<X").vertices("<Y").tag("pt1")
part2.faces("<X").edges("<Z").vertices("<Y").tag("pt2")

assy = (
    cq.Assembly(part1, name="part1", loc=cq.Location(cq.Vector(-w, 0, h / 2)))
    .add(part2, name="part2", color=cq.Color(0, 0, 1, 0.5))
    .add(part3, name="part3", color=cq.Color("red"))
    .constrain("part1@faces@>Z", "part3@faces@<Z", "Axis")
    .constrain("part1@faces@>Z", "part2@faces@<Z", "Axis")
    .constrain("part1@faces@>Y", "part3@faces@<Y", "Axis")
    .constrain("part1@faces@>Y", "part2@faces@<Y", "Axis")
    .constrain("part1?pt1", "part3?pt1", "Point")
    .constrain("part1?pt2", "part2?pt2", "Point")
    .solve()
)

assy.export("assembly.step")
```

## Reusable Component Functions

```python
import cadquery as cq

def make_bracket(width, height, thickness, hole_dia):
    return (
        cq.Workplane("XY")
        .box(width, height, thickness)
        .faces(">Z")
        .workplane()
        .hole(hole_dia)
    )

def make_gear(teeth, pitch_radius, thickness):
    # ... gear generation code ...
    pass

# Use in assembly
assy = cq.Assembly()
assy.add(make_bracket(40, 30, 5, 8), name="bracket1")
assy.add(make_bracket(40, 30, 5, 8), name="bracket2", loc=cq.Location((50, 0, 0)))
```
