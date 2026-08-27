# CadQuery Error Recovery

Repair discipline: classify the error → make the SMALLEST change that fixes
that one cause → return the complete JSON. Never shotgun-rewrite the model.

Every `python` block below runs in the sandbox. Blocks marked
`# EXPECTED-FAIL` demonstrate a real failure and its exact error message.

### 1. Fillet/Chamfer Failure

**Error:** `OCP.OCP.StdFail.StdFail_NotDone: BRep_API: command not done`

**Cause:** Fillet/chamfer radius too large for the adjacent geometry (it must
be LESS than half the shortest adjacent dimension), or the selection contains
edges that cannot support the blend.

**Fix:** Reduce the radius, or remove the fillet entirely.

```python
import cadquery as cq

# EXPECTED-FAIL — radius 8 exceeds half the 10mm wall
result = cq.Workplane("XY").box(10, 10, 10).edges("|Z").fillet(8.0)
```

```python
import cadquery as cq

# RIGHT — radius safely below half the thinnest dimension
result = cq.Workplane("XY").box(10, 10, 10).edges("|Z").fillet(2.0)
```

### 2. Boolean Operation Failure

**Error:** `RuntimeError: BRep_API: not done`, `null topods`, `boolean operation failed`

**Cause:** Coplanar faces between cutter and target, or cutter does not fully
overlap the material it should remove.

**Fix:** Extend the cutting solid 1–2 mm PAST every face it cuts through.
Note: a union of parts that never touch does not fail — it silently produces
disconnected bodies, so guarantee overlap yourself. The runner wraps every
failure as `RuntimeError: User code execution failed`; the real cause is in
the traceback line above it.

```python
import cadquery as cq

# RIGHT — cutter extends 1 mm past both faces of the 10 mm plate
plate = cq.Workplane("XY").box(20, 20, 10)
cutter = cq.Workplane("XY").circle(5).extrude(12).translate((0, 0, -6))
result = plate.cut(cutter)
```

### 3. Build Order — Operation Before a Solid Exists

**Error:** `ValueError: Cannot find a solid on the stack or in the parent chain`

**Cause:** Called `hole`/`cutBlind`/`fillet`/... before any solid was created.

**Fix:** Create the base body first (extrude/box/cylinder), then cut and finish.

```python
import cadquery as cq

# EXPECTED-FAIL — hole on a flat profile, no solid yet
result = cq.Workplane("XY").rect(10, 10).hole(5)
```

```python
import cadquery as cq

# RIGHT — extrude first, then hole
result = cq.Workplane("XY").rect(10, 10).extrude(5).faces(">Z").workplane().hole(5)
```

### 4. Extrude Without close() (Wire Not Closed)

**Error:** `ValueError: No pending wires present`

**Cause:** `extrude()` found no wire — custom profiles drawn with
`moveTo`/`lineTo` must be closed before extruding.

**Fix:** End custom profiles with `.close()`.

```python
import cadquery as cq

# EXPECTED-FAIL — open profile, nothing to extrude
result = cq.Workplane("XY").moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).extrude(5)
```

```python
import cadquery as cq

# RIGHT — close() completes the wire
result = cq.Workplane("XY").moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close().extrude(5)
```

### 5. close() Without a Start Point

**Error:** `ValueError: No start point specified - cannot close`

**Cause:** Called `.close()` (or started a profile) without `.moveTo()` first.

**Fix:** Always begin custom profiles with `.moveTo(x, y)`.

```python
import cadquery as cq

# EXPECTED-FAIL
result = cq.Workplane("XY").close()
```

### 6. Loft/Sweep Failures

**Error:** `ValueError: Nothing to loft`

**Cause:** Loft found no pending wires. Wires SELECTED from existing geometry
(`.faces(...).wires()`) are not pending — push them with `.toPending()`.
Wires you DRAW (`circle`, `rect`) become pending automatically.

**Fix:** `toPending()` before and after moving selected wires.

```python
import cadquery as cq

# EXPECTED-FAIL — selected wire never reaches the pending list
result = (
    cq.Workplane("XY")
    .box(10, 10, 10)
    .faces(">Z")
    .wires()
    .translate((0, 0, 5))
    .loft()
)
```

```python
import cadquery as cq

# RIGHT — toPending() pushes the selected (and moved) wires
result = (
    cq.Workplane("XY")
    .box(10, 10, 10)
    .faces(">Z")
    .wires()
    .toPending()
    .translate((0, 0, 5))
    .toPending()
    .loft()
)
```

**Sweep placement:** sweep does not relocate profiles reliably. Draw the path
starting at the ORIGIN of its workplane, keep the profile plane perpendicular
to the path's start direction, and `.translate()` the swept result into place.

```python
import cadquery as cq

# Path starts at the XZ origin in +X; YZ profile (normal X) is perpendicular
path = cq.Workplane("XZ").threePointArc((12, 0), (0, 16))
result = cq.Workplane("YZ").circle(2.5).sweep(path).translate((19, 0, 14))
```

### 7. Single Value Where a List/Tuple Is Required

**Error:** `TypeError: must be an iterable` / `argument after * must be...`

**Cause:** Methods like `pushPoints` expect a LIST of points; `translate`
expects ONE tuple.

**Fix:** Wrap multiple points in `[...]`; wrap one vector in `(...)`.

```python
import cadquery as cq

# RIGHT — list of point tuples
result = (
    cq.Workplane("XY")
    .box(40, 40, 5)
    .faces(">Z")
    .workplane()
    .pushPoints([(10, 10), (10, -10), (-10, 10), (-10, -10)])
    .hole(3)
)
```

### 8. Wrong translate()/rotate() Arguments

**Error:** `TypeError: Workplane.translate() takes 2 positional arguments but 4 were given`
or `TypeError: Expected three floats, OCC gp_, or 3-tuple`

**Cause:** `.translate()` takes ONE tuple; `.rotate()` takes
`(axisStart, axisEnd, angleDegrees)` as three separate arguments.

```python
import cadquery as cq

# EXPECTED-FAIL — three separate floats
result = cq.Workplane("XY").box(10, 10, 10).translate(10, 20, 30)
```

```python
import cadquery as cq

# EXPECTED-FAIL — rotate needs two axis points and an angle
result = cq.Workplane("XY").box(10, 10, 10).rotate(0, 0, 90)
```

```python
import cadquery as cq

# RIGHT
moved = cq.Workplane("XY").box(10, 10, 10).translate((10, 20, 30))
result = moved.rotate((0, 0, 0), (0, 0, 1), 90)
```

### 9. Selector Failures

**Error:** `pyparsing.exceptions.ParseException: Expected 'not' operations, found '...'`

**Cause:** Invalid selector string (bad token or malformed expression).

**Fix:** Use only documented selectors: `>Z`, `<Z`, `+Z`, `-Z`, `|Z`, `#Z`,
`%CIRCLE`, `%Plane`, combinators `and`/`or`/`not(...)` — see
`references/selectors.md`. After a boolean, topology is renumbered: prefer
direction selectors over tags created before the boolean.

```python
import cadquery as cq

# EXPECTED-FAIL — 'QQQ' is not a selector
result = cq.Workplane("XY").box(10, 10, 10).faces("QQQ")
```

### 10. Non-Existent API / cq.math

**Error:** `AttributeError: module 'cadquery' has no attribute 'math'` (or any
`has no attribute` message)

**Cause:** `cq.math` does not exist; or a misspelled/nonexistent method.

**Fix:** Use Python's built-in `math` module; check method names against the
API reference.

```python
import cadquery as cq

# EXPECTED-FAIL
x = cq.math.sin(45)
result = cq.Workplane("XY").box(1, 1, 1)
```

```python
import cadquery as cq
import math

# RIGHT
x = math.sin(math.radians(45))
result = cq.Workplane("XY").box(1, 1, 1)
```

### 11. Missing `result` Variable

**Error (from the runner, after your code runs):**
`RuntimeError: Code did not define variable 'r' or 'result'`

**Cause:** Final geometry was never assigned to `result`.

**Fix:** Assign the final geometry to `result`. Never name a radius variable
`r` — the runner looks up `r` before `result`.

```python
import cadquery as cq

# WRONG — executes fine, then crashes in the runner:
# box = cq.Workplane("XY").box(10, 10, 10)

# RIGHT
result = cq.Workplane("XY").box(10, 10, 10)
```

### 12. Syntax Errors

**Error:** `SyntaxError: ...`

**Cause:** Unclosed parenthesis, bad indentation, missing colon.

**Fix:** Fix only the syntax. Do not restructure the model.

```python
# EXPECTED-FAIL — unclosed parenthesis
result = cq.Workplane("XY").box(10, 10, 10
```

### 13. Math Domain Errors

**Error:** `ValueError: math domain error`

**Cause:** `sqrt` of a negative, `log` of zero, division by zero.

**Fix:** Clamp inputs or restructure the formula.

```python
import math

# EXPECTED-FAIL
x = math.sqrt(-1)
```

```python
import math

# RIGHT — guard the domain
value = -1
x = math.sqrt(max(value, 0))
```

### 14. Forbidden Imports

**Error:** `ImportError: module 'os' is not permitted in the sandbox`

**Cause:** Only `cadquery` and `math` can be imported. Everything else —
`os`, `sys`, `json`, `re`, `OCP`, `cadquery.func`, `ezdxf`, ... — is blocked.

```python
# EXPECTED-FAIL
import os
```

```python
import cadquery as cq
import math

# RIGHT — the only two allowed imports
result = cq.Workplane("XY").box(1, 1, 1)
```

### 15. Missing Builtins: show_object, open, class

**Errors:** `NameError: name 'show_object' is not defined`,
`NameError: name 'open' is not defined`, `NameError: __build_class__ not found`

**Cause:** The sandbox strips editor helpers (`show_object`, `display`), file
access (`open`), and class creation (no `__build_class__`).

**Fix:** Assign to `result` instead of displaying; never read/write files;
use plain `def` functions instead of classes.

```python
import cadquery as cq

# EXPECTED-FAIL
show_object(cq.Workplane("XY").box(1, 1, 1))
result = cq.Workplane("XY").box(1, 1, 1)
```

```python
# EXPECTED-FAIL
f = open("x.txt", "w")
```

```python
import cadquery as cq

# EXPECTED-FAIL — class statements cannot compile in the sandbox
class Helper:
    pass

result = cq.Workplane("XY").box(1, 1, 1)
```

### 16. Export Calls Are Wasted Work

Calling `result.export(...)` does not crash — CadQuery can still write files
— but anything written is discarded with the job directory. The runner
exports `output.stl`, `output.step`, and `output.glb` itself.

**Fix:** Remove all export calls; produce a clean `result` and nothing else.

### 17. Returning a cq.Assembly Crashes the Runner

The runner calls `cq.exporters.export(result)` and `result.val()` — an
Assembly supports neither, so the run dies AFTER your code executes.

**Fix:** Use `cq.Assembly` only as a positioning helper and convert with
`.toCompound()` (see `references/assembly-patterns.md`).

```python
import cadquery as cq

assy = cq.Assembly().add(cq.Workplane("XY").box(10, 10, 10), name="part")
# NEVER: result = assy
result = cq.Workplane("XY").newObject([assy.toCompound()])
```

### 18. text() — No Fonts in the Sandbox

**Error:** `AttributeError: 'NoneType' object has no attribute 'FontName'`
(with `Font_FontMgr, error: unable to find any font!`)

**Cause:** The sandbox image has no fonts installed, so `.text()` and any
engraved/embossed lettering ALWAYS fails.

**Fix:** Do not use `.text()`. Model simple markings with primitive shapes
(rects, cylinders) instead, or state in the description that text could not
be rendered.

```python
import cadquery as cq

# EXPECTED-FAIL — no fonts available
result = cq.Workplane("XY").box(20, 10, 2).faces(">Z").workplane().text("HI", 5, 1)
```

### 19. Timeouts and Memory

**Error:** execution killed after 30 s / `MemoryError`

**Cause:** Too many features per boolean (dense hole grids, hundreds of
pattern instances, very fine splines), or giant models.

**Fix:** Keep cutter counts modest (≤ ~8 per boolean), reduce pattern
instance counts, keep bounding dimensions under ~10,000 mm. Simplify before
retrying — the budget will not grow.

---

## Error Classification for Auto-Repair

The repair pipeline classifies errors with these categories (first matching
pattern wins). The hints are injected into the repair prompt.

First matching pattern wins, in the order listed.

| Category | Patterns | Fix Hint |
|----------|----------|----------|
| COMPOUND_ITERABLE | `must be an iterable`, `argument after * must be` | Pass lists/tuples: `.translate((x,y,z))`, `.pushPoints([(x,y),...])` |
| BUILD_ORDER | `no solid to cut from`, `cannot compound`, `cannot find a solid`, `nothing to loft` | Create the solid before cutting/filleting; extrude first; `.toPending()` before lofting selected wires |
| WIRE_NOT_CLOSED | `no wire to close`, `cannot close wire`, `no pending wires` | `.close()` before `.extrude()` |
| NO_START_POINT | `no start point specified`, `cannot close` | Start profiles with `.moveTo()` |
| FILLET_CHAMFER | `no suitable edges`, `standard failure: make-fillet`, `standard failure: make-chamfer`, `BRep_API: command not done` | Reduce radius below half the thinnest adjacent dimension, or remove |
| BOOLEAN_FAILURE | `null topods`, `boolean operation failed`, `cut from a null` | Extend cutters 1–2 mm past the faces; guarantee overlap |
| FONT_ERROR | `fontname`, `font_`, `unable to find any font` | `.text()` is unsupported — no fonts in the sandbox |
| FORBIDDEN_BUILTIN | `is not permitted in the sandbox`, `__build_class__`, `name 'open' is not defined`, `show_object` | cadquery+math imports only; no files, classes, or show_object |
| API_ERROR | `has no attribute`, `attributeerror` | Check method names; NEVER `cq.math` — use `math` |
| MISSING_R | `'r' not in dir`, `no variable`, `did not define variable` | Assign the final model to `result` |
| SYNTAX | `syntaxerror`, `indentationerror` | Fix syntax only |
| TYPE_ERROR | `typeerror`, `argument`, `takes`, `must be an iterable` | `.translate()` ONE tuple; `.rotate((start),(end),angle)` |
| SELECTOR | `selector`, `no faces`, `no edges`, `parseexception` | Valid selector strings only: `>Z`, `\|Z`, `%CIRCLE`, ... |
| WIRE_TOPOLOGY | `wire`, `brep`, `topods`, `standard_failure` | `.close()` profiles; avoid self-intersections |
| RUNTIME | `assert`, `runtimeerror` | Check the traceback for the underlying cause |
| MATH_ERROR | `zerodivision`, `division by zero`, `math domain` | Guard sqrt/log/divide inputs |
| TIMEOUT | `timed out`, `timeout`, `killed`, `deadline exceeded` | Fewer features per boolean, smaller patterns |
| MEMORY | `memoryerror`, `out of memory`, `bad_alloc`, `cannot allocate` | Reduce feature density and model size |
| IMPORT_ERROR | `import`, `modulenotfounderror` | Only `cadquery` and `math` exist in the sandbox |
