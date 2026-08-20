# CadQuery Error Recovery

## Common Error Patterns and Fixes

### 1. Fillet/Chamfer on Empty Selection

**Error:** `ValueError: No edges selected`

**Cause:** Selector matched no edges before applying fillet/chamfer.

**Fix:** Verify your selector matches edges before applying operations. Use `.size()` to check stack count.

```python
# WRONG: Selector may not match
result.edges("|Z").fillet(2.0)

# RIGHT: Check first
edges = result.edges("|Z")
if edges.size() > 0:
    result = edges.fillet(2.0)
```

### 2. Fillet Radius Too Large

**Error:** `ValueError: fillet radius too large`

**Cause:** Fillet radius exceeds the adjacent edge length.

**Fix:** Ensure fillet radius is smaller than the shortest adjacent edge. If fillet fails, remove it entirely or reduce radius to 1.0.

```python
# WRONG: Radius too large for thin wall
result.edges("|Z").fillet(5.0)  # Wall is only 8mm thick

# RIGHT: Reduce radius
result.edges("|Z").fillet(3.0)  # Must be < 4mm (half of 8mm)
```

### 3. Boolean Operation Failures

**Error:** `RuntimeError: BRep_API: not done` or `Standard_Fail`

**Cause:** Boolean operation failed with non-manifold geometry or coplanar faces.

**Fix:** Use `clean=True` after boolean ops. Try `glue=True` for union operations. Adjust tolerance with `tol` parameter.

```python
# Add tolerance to boolean operations
result = body.union(other, clean=True, glue=True, tol=0.1)
result = body.cut(cutter, clean=True, tol=0.1)
```

### 4. Coplanar Face Errors

**Error:** `BRep_API: command not done` when cutting holes

**Cause:** Cutting solid exactly matches target surface.

**Fix:** Extend the cutting solid slightly beyond the target.

```python
# WRONG: Cutter exactly matches surface
hole = cq.Workplane("XY").circle(5).extrude(10)
result = body.cut(hole)

# RIGHT: Extend cutter beyond surface
hole = cq.Workplane("XY").circle(5).extrude(12)
hole = hole.translate((0, 0, -1))
result = body.cut(hole)
```

### 5. Missing `result` Variable

**Error:** `Code did not define variable 'r' or 'result'`

**Cause:** Final geometry not assigned to `result`.

**Fix:** Always assign final geometry to `result`.

```python
# WRONG
box = cq.Workplane("XY").box(10, 10, 10)

# RIGHT
result = cq.Workplane("XY").box(10, 10, 10)
```

### 6. Using `show_object()`

**Error:** `show_object is not defined`

**Cause:** Calling `show_object()` which is not available in the sandbox.

**Fix:** Remove `show_object()` calls. Just assign to `result`.

```python
# WRONG
result = cq.Workplane("XY").box(10, 10, 10)
show_object(result)

# RIGHT
result = cq.Workplane("XY").box(10, 10, 10)
```

### 7. Using `cq.math`

**Error:** `module 'cadquery' has no attribute 'math'`

**Cause:** Trying to use `cq.math` which doesn't exist.

**Fix:** Use Python's built-in `math` module.

```python
# WRONG
import cadquery as cq
x = cq.math.sin(45)

# RIGHT
import cadquery as cq
import math
x = math.sin(math.radians(45))
```

### 8. Wrong `.translate()` Syntax

**Error:** `TypeError: translate() takes 2 positional arguments but 4 were given`

**Cause:** Passing three separate floats instead of a tuple.

**Fix:** `.translate()` takes ONE tuple.

```python
# WRONG
.translate(10, 20, 30)

# RIGHT
.translate((10, 20, 30))
```

### 9. Wrong `.rotate()` Syntax

**Error:** Various type errors

**Cause:** Wrong argument format for `.rotate()`.

**Fix:** `.rotate()` takes `(start_point, end_point, angle)`.

```python
# WRONG
.rotate(0, 0, 90)

# RIGHT
.rotate((0,0,0), (0,0,1), 90)
```

### 10. Missing `.close()` Before Extrude

**Error:** `RuntimeError: no wire to close` or `cannot close wire`

**Cause:** Called `.extrude()` on an unclosed profile.

**Fix:** Always call `.close()` before `.extrude()` when drawing custom profiles.

```python
# WRONG
result = cq.Workplane("XY").moveTo(0,0).lineTo(10,0).lineTo(10,10).extrude(5)

# RIGHT
result = cq.Workplane("XY").moveTo(0,0).lineTo(10,0).lineTo(10,10).close().extrude(5)
```

### 11. Selector Issues with Non-Planar Faces

**Error:** Unexpected face selection results

**Cause:** Non-planar faces are evaluated at their center of mass for selectors.

**Fix:** Use `>>Z` / `<<Z` (center-based) instead of `>Z` / `<Z` (normal-based) for non-planar faces.

### 12. Workplane Orientation

**Error:** Extrude goes in wrong direction

**Cause:** After `.faces(">Z").workplane()`, the new workplane's Z axis points outward from the face.

**Fix:** Use negative distance to extrude inward: `.extrude(-5)` or use `.cutBlind()` for pockets.

### 13. Import Errors

**Error:** `ModuleNotFoundError: No module named 'cadquery'`

**Cause:** CadQuery not installed or not in Python path.

**Fix:** The Docker sandbox has CadQuery pre-installed. If running locally, install with `pip install cadquery`.

## Error Classification for Auto-Repair

The following error patterns are recognized by the auto-repair system:

| Category | Patterns | Fix Hint |
|----------|----------|----------|
| FILLET_CHAMFER | `no suitable edges`, `standard failure: make-fillet` | Reduce radius or remove fillet |
| BOOLEAN_FAILURE | `null topods`, `boolean operation failed` | Check solids overlap |
| API_ERROR | `has no attribute` | Check method names |
| MISSING_R | `did not define variable` | Add `result = ...` |
| SYNTAX | `syntaxerror`, `indentationerror` | Check Python syntax |
| TYPE_ERROR | `typeerror`, `argument` | Check argument types |
| SELECTOR | `selector`, `no faces`, `no edges` | Check selector strings |
| WIRE_TOPOLOGY | `wire`, `brep`, `topods` | Ensure `.close()` before extrude |
| MATH_ERROR | `zerodivision`, `math domain` | Check math operations |
| IMPORT_ERROR | `import`, `modulenotfounderror` | Only cadquery and math allowed |
