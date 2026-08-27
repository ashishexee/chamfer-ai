# Multi-Body & Positioning Patterns

The sandbox exports ONE `result` (Workplane/Shape). `cq.Assembly` cannot be
exported by the runner — returning one crashes the pipeline. Use the patterns
below to build multi-part designs as a single result.

## Rule: One Result, Many Bodies

| Situation | Pattern |
|-----------|---------|
| Parts touch or overlap (mug + handle, bracket + legs) | `.union()` into one solid |
| Parts must stay separate (bolt next to nut) | Compound with a clearance gap ≥ 0.1 mm |
| Complex placement of many parts | `cq.Assembly` as a positioning HELPER, then `.toCompound()` |

## Pattern 1: Union of Positioned Solids

Build each part, position it with `.translate()` / `.rotate()`, then fuse.
Parts must actually overlap (or at least touch) — extend mating features
1 mm into each other so the boolean has real volume to work with.

```python
import cadquery as cq

base = cq.Workplane("XY").box(40, 20, 10)
boss = cq.Workplane("XY").cylinder(12, 4).translate((10, 0, 5 + 6 - 1))
result = base.union(boss)
```

For repeated features, use a helper function plus a loop:

```python
import cadquery as cq

def make_post(height, diameter):
    return cq.Workplane("XY").cylinder(height, diameter / 2).translate((0, 0, height / 2))

plate = cq.Workplane("XY").box(60, 30, 5)
result = plate
for x in (-20, 0, 20):
    result = result.union(make_post(15, 6).translate((x, 0, 2.5 - 1)))
```

## Pattern 2: Compound for Separate Parts

When parts must remain distinct bodies, keep a gap ≥ 0.1 mm between them
(touching faces may fuse or create non-manifold edges), then combine with
`cq.Compound.makeCompound` and wrap in a Workplane via `newObject`:

```python
import cadquery as cq

part_a = cq.Workplane("XY").box(10, 10, 10)
part_b = cq.Workplane("XY").box(5, 5, 5).translate((20, 0, 0))

result = cq.Workplane("XY").newObject(
    [cq.Compound.makeCompound([part_a.val(), part_b.val()])]
)
```

Notes:
- `.val()` extracts the Solid from each Workplane before compounding.
- Compounds export cleanly to STL/STEP/GLB and keep each solid separate.
- Never call `.union()` on parts you want to keep separate — it fuses them.

## Pattern 3: Assembly as a Positioning Helper

`cq.Assembly` with `cq.Location` is the most readable way to place many parts,
especially with rotations. Convert to a Compound at the end:

```python
import cadquery as cq

part_a = cq.Workplane("XY").box(20, 20, 20)
part_b = cq.Workplane("XY").box(10, 10, 4)
part_c = cq.Workplane("XY").box(4, 4, 12)

assy = (
    cq.Assembly()
    .add(part_a, name="body")
    .add(part_b, name="lid", loc=cq.Location(cq.Vector(0, 0, 25)))
    .add(part_c, name="arm", loc=cq.Location(cq.Vector(10, 0, 0), cq.Vector(0, 1, 0), 45))
)
result = cq.Workplane("XY").newObject([assy.toCompound()])
```

`cq.Location(position, axis, angle_degrees)` places a part at `position`,
rotated `angle` degrees around `axis`.

Colors passed to `.add(..., color=...)` are LOST by `toCompound()` — the
pipeline currently renders single-material output, so do not promise colors
in the description.

## Positioning Quick Reference

```text
.translate((x, y, z))                       # move by vector (ONE tuple)
.rotate((0,0,0), (0,0,1), 90)               # rotate: axisStart, axisEnd, angle
cq.Location(cq.Vector(x, y, z))             # position only (Assembly helper)
cq.Location(pos_vec, axis_vec, angle_deg)   # position + rotation (Assembly helper)
```

## Selectors After Unions

Boolean operations renumber the topology. After a union, prefer selecting by
direction/axis (`.faces(">Z")`, `.edges("|Z")`) over tags or indices that were
created before the union — tagged references can silently point at the wrong
faces once geometry has been fused.

## Anti-Patterns (these crash or waste the run)

Returning an Assembly as `result` crashes the pipeline AFTER your code runs:
the runner calls `cq.exporters.export(result)` and `result.val()`, and an
Assembly supports neither.

```python
import cadquery as cq

assy = cq.Assembly()
assy.add(cq.Workplane("XY").box(10, 10, 10), name="part")
# NEVER do this: result = assy
# Convert first instead:
result = cq.Workplane("XY").newObject([assy.toCompound()])
```

Calling `.export()` yourself is wasted work: the sandbox does not stop
CadQuery from writing files, but anything you write is thrown away with the
job directory. The runner exports `output.stl`, `output.step`, and
`output.glb` on its own — just produce a clean `result`.

```python
import cadquery as cq

result = cq.Workplane("XY").box(10, 10, 10)
# result.export("my.step")  ← runs, but the file is discarded; never bother
```
