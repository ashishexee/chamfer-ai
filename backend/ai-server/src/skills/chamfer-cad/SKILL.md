# Chamfer AI CadQuery Skill

| name | cadquery |
| description | Generate, modify, and validate parametric CadQuery Python code for Chamfer AI. |

---

## Purpose

Generate parametric CadQuery Python code from natural language descriptions. The code is executed server-side in a Docker sandbox and produces STEP + STL + GLB files.

## Output Format

Your ENTIRE response must be a single valid JSON object. NOTHING else.

```json
{
  "code": "import cadquery as cq\n\n# Parameters\n...",
  "parameters": {
    "param_name": {
      "type": "float",
      "default": 10.0,
      "min": 1,
      "max": 100,
      "step": 1,
      "description": "What this parameter controls"
    }
  },
  "description": "Plain English description of the model",
  "tags": ["category", "type"]
}
```

## Code Structure Requirements

1. Start with: `import cadquery as cq`
2. Define all adjustable parameters as Python variables at the top
3. Use descriptive snake_case variable names
4. Build order: base body → cuts/holes → fillets/chamfers (LAST)
5. Assign final geometry to variable: `result = ...`
6. Do NOT call `show_object()`, `display()`, or any exporters
7. Do NOT write to files or use network
8. Only import `cadquery as cq` (and `math` if needed)
9. All dimensions are in millimeters

## Parameter Annotation Format

```python
teeth = 12        # [6:1:24]    — int with min:step:max
width = 60.0      # [10:5:200]  — float with min:step:max
hole_dia = 8.0    # [2:1:30]    — float with min:step:max
thickness = 5.0   # [1:1:50]    — float with min:step:max
```

## Default Assumptions

- Units: millimeters
- Origin: center of main part
- Base plane: XY
- Up/extrusion axis: positive Z
- Output: closed, positive-volume solids

## Self-Correction Protocol

If you receive an error message:
1. Fix ONLY the broken part — smallest change possible
2. Do NOT rewrite the entire model unless necessary
3. Return the complete JSON with corrected code
4. Do NOT explain what you fixed

---

# REFERENCE FILE ROUTING SYSTEM

## How Routing Works

When a user provides a prompt, you MUST analyze it and load ONLY the relevant reference files. This saves tokens and keeps context focused.

## Step 1: Classify the User's Request

Read the user's prompt and determine:
- **What are they trying to make?** (part type, features)
- **What CadQuery operations will this require?** (holes, patterns, assemblies, etc.)
- **Are they fixing an error?** (error recovery mode)

## Step 2: Load Relevant Files

Based on your classification, load files from this catalog:

---

### CATALOG: Reference Files

Each file below describes its contents, when to load it, and what keywords trigger it.

---

#### `references/cadquery-api.md`
**CONTENTS:** Core Workplane API — creation, 2D drawing (rect, circle, lines, arcs, splines, offset2D), 3D primitives (box, cylinder, sphere, wedge), extrude, revolve, loft, sweep, holes, fillets, chamfers, shell, patterns (pushPoints, rarray, polarArray), boolean operations (union, cut, intersect), tags, shape query methods, BREP topology, stack navigation, context solid, combine=False, toPending, extrude-until-face, workplaneFromTagged, multimethod warning.

**WHEN TO LOAD:** ALWAYS — this is the core reference. Load this for every CadQuery generation task.

**KEYWORDS:** cadquery, workplane, box, cylinder, sphere, extrude, revolve, loft, sweep, hole, fillet, chamfer, shell, pattern, array, boolean, union, cut, intersect, tag, selector, face, edge, vertex, wire, solid

---

#### `references/selectors.md`
**CONTENTS:** Face/edge/vertex selector strings — direction selectors (>Z, <Z, +Z, -Z, |Z, #Z), type selectors (%Plane, %Line, %CIRCLE, %ARC), combining selectors (and, or, not, exc), topological selectors (ancestors, siblings), user-defined directions, filtering faces/edges/vertices tables.

**WHEN TO LOAD:** When the user needs to select specific faces, edges, or vertices for operations like fillet, chamfer, cut, or hole placement. Also when building complex models that require precise geometry selection.

**KEYWORDS:** select, selector, face, edge, vertex, fillet, chamfer, cut, >Z, <Z, |Z, #Z, %CIRCLE, %Line, ancestors, siblings, filter, direction

---

#### `references/holes-cuts.md`
**CONTENTS:** Simple holes (hole), counterbored holes (cboreHole), countersunk holes (cskHole), holes at specific locations (pushPoints, rarray, polarArray), boolean cut operations (cut, cutThruAll, cutBlind), boolean union operations, boolean intersect, shell (hollow), fillets, chamfers, common patterns (box with holes, cylinder with axial hole, flange with bolt circle).

**WHEN TO LOAD:** When the user wants holes, cutouts, boolean operations, hollow parts, or fillets/chamfers. This is one of the most frequently needed references.

**KEYWORDS:** hole, counterbore, countersunk, cut, cutThruAll, cutBlind, boolean, union, subtract, shell, hollow, fillet, chamfer, bolt, hole pattern, through hole, blind hole

---

#### `references/transformations.md`
**CONTENTS:** Translate (move), rotate, mirror (mirror, mirrorX, mirrorY), patterns and arrays (pushPoints, rarray, polarArray, iteration), workplane shifts (center, transformed), split, common transformation patterns (symmetric part, pattern of bosses, circular pattern).

**WHEN TO LOAD:** When the user needs to move, rotate, mirror, or pattern geometry. Also when creating symmetric parts or using workplane transformations.

**KEYWORDS:** translate, move, rotate, mirror, symmetry, symmetric, pattern, array, rarray, polarArray, pushPoints, split, workplane, center, transformed, offset, angle

---

#### `references/export-patterns.md`
**CONTENTS:** Supported export formats (STEP, STL, glTF/GLB, AMF, 3MF, SVG, DXF, TJS, VRML), exporting STEP (simple, non-default extensions, options, units), exporting STL (quality, tolerance, ASCII), exporting glTF/GLB (assemblies only), exporting SVG (options), exporting DXF (2D sections), importing files (STEP, DXF, Assembly), assembly export (default, fused, naming, metadata), common export pitfalls (GLB-only-works-on-Assembly, DXF-only-works-on-2D-sections, file-extension-recognition).

**WHEN TO LOAD:** When the user wants to export to a specific format, import existing CAD files, or when the code generation needs to produce exportable output. Also when troubleshooting export issues.

**KEYWORDS:** export, import, STEP, STL, GLB, glTF, DXF, SVG, file format, download, save, convert, importStep, importDXF, assembly export, fused mode

---

#### `references/error-recovery.md`
**CONTENTS:** 13 specific error patterns with fixes: fillet/chamfer on empty selection, fillet radius too large, boolean operation failures, coplanar face errors, missing result variable, using show_object(), using cq.math, wrong translate syntax, wrong rotate syntax, missing close() before extrude, selector issues with non-planar faces, workplane orientation, import errors. Error classification table for auto-repair (15 categories with patterns and hints).

**WHEN TO LOAD:** When the user reports an error from a previous generation, when code fails to execute, or when troubleshooting CadQuery issues. This is critical for the self-correction loop.

**KEYWORDS:** error, fix, repair, failed, crash, BRep, fillet failed, boolean failed, selector failed, syntax error, no solid, no wire, translate error, rotate error, close before extrude, cq.math, show_object, coplanar, workplane orientation

---

#### `references/assembly-patterns.md`
**CONTENTS:** Basic assembly (Assembly, add, color), color options (named colors, RGBA), positioning with Locations, positioning with constraints and solver, constraint types (Point, Axis, Plane, PointInPlane, PointOnLine, Fixed, FixedPoint, FixedRotation, FixedAxis), constraint selector syntax, tagging faces/edges for constraints, assembly export, assembly example (door with V-slot profiles).

**WHEN TO LOAD:** When the user wants to create multi-part models, assemblies with constraints, or when working with colored components. Also when importing assemblies from STEP files.

**KEYWORDS:** assembly, multi-part, constraint, mate, color, part, component, Location, Assembly, solve, point, axis, plane, fixed, position, joint, V-slot, profile

---

#### `references/free-function-api.md`
**CONTENTS:** Free function API — primitives (segment, circle, plane, box, cone, cylinder, sphere, torus), boolean operations (fuse, cut, intersect), shape construction (wire, face, solid, compound), operations (extrude, sweep, loft, revolve, chamfer, fillet, offset, hollow, draft, prism), placement (move, moved), text on curves/surfaces, parametric trimming (trim, edgeOn, wireOn, faceOn).

**WHEN TO LOAD:** When the user needs advanced control beyond the fluent API, when creating complex free-form geometry, when the fluent API can't express the desired shape, or when working with parametric surfaces.

**KEYWORDS:** free function, advanced, Shape, compound, prism, draft, hollow, fill, cap, edgeOn, wireOn, faceOn, trim, parametric, text on surface, spline surface, helix

---

#### `references/sketch-api.md`
**CONTENTS:** Sketch class — face-based API (rect, circle, ellipse, trapezoid, slot, regularPolygon, polygon, face), modes (a=add, s=subtract, i=intersect, r=replace, c=construction), selection (faces, edges, vertices, reset, tag, select), modifiers (fillet, chamfer, clean, offset, hull), arrays (rarray, parray, distribute, push, each), edge-based API (segment, arc, spline, close, assemble), constraint-based sketches (FixedPoint, Coincident, Angle, Length, Distance, Radius, Orientation, ArcAngle), workplane integration (sketch, finalize, placeSketch, loft between sketches, combining sketches, sketch offsets), export/import DXF.

**WHEN TO LOAD:** When the user needs complex 2D profiles with face-based boolean construction, when the fluent API's rect/circle/extrude pattern is insufficient, when creating sketches with constraints, or when working with DXF files.

**KEYWORDS:** sketch, profile, 2D, face-based, constraint, boolean sketch, hull, edge-based, segment, arc, assemble, sketch mode, DXF, sketch export, sketch import, placeSketch, finalize, sketch offset

---

#### `references/parameter-system.md`
**CONTENTS:** Parameter annotation format ([min:step:max]), JSON response schema (type, default, min, max, step, description, options), parameter extraction (server-side regex), best practices (define at top, descriptive names, units in description, reasonable ranges), parameter update flow.

**WHEN TO LOAD:** When the user wants adjustable parameters, sliders, configurability, or when defining the parameter schema for the JSON response. Always relevant for parametric models.

**KEYWORDS:** parameter, slider, adjustable, configurable, range, min, max, step, default, variable, parametric, adjustable dimensions

---

### CATALOG: Example Files

Each file below contains code examples for specific types of models.

---

#### `examples/basic-shapes.md`
**CONTENTS:** Simple box, cylinder, sphere, cone, hollow cylinder, flat washer, box with hole, box with filleted edges, box with chamfered edges, extruded profile, revolved profile.

**WHEN TO LOAD:** When the user wants simple geometric primitives or basic shapes. Good for getting started or when the model is straightforward.

**KEYWORDS:** box, cube, cylinder, sphere, cone, tube, washer, simple, basic, primitive, flat, plate, block

---

#### `examples/mechanical-parts.md`
**CONTENTS:** Bearing pillow block, pipe flange with bolt circle, L-bracket with holes, pulley with bore and groove, shaft with keyway, hex head bolt, electronics enclosure.

**WHEN TO LOAD:** When the user wants mechanical components, engineering parts, or industrial designs. Covers brackets, flanges, shafts, bolts, enclosures.

**KEYWORDS:** bracket, flange, shaft, pulley, bolt, screw, nut, washer, enclosure, housing, pillow block, bearing, mechanical, engineering, industrial

---

#### `examples/organic-shapes.md`
**CONTENTS:** Spoon with overlapping handle, mug with handle, hammer with claw head.

**WHEN TO LOAD:** When the user wants organic, curved, or non-engineering shapes. Covers kitchen items, tools, curved surfaces.

**KEYWORDS:** spoon, mug, cup, hammer, handle, curved, organic, kitchen, tool, grip, ergonomic, bottle, vase

---

#### `examples/assemblies.md`
**CONTENTS:** Simple assembly with locations, assembly with constraints, assembly with tags, reusable component functions.

**WHEN TO LOAD:** When the user wants multi-part models, assemblies, or when components need to be positioned relative to each other.

**KEYWORDS:** assembly, multi-part, component, part, location, constraint, mate, color, grouped, combined parts

---

## Step 3: Load Order

When loading multiple files, use this order:

```
1. SKILL.md (this file — always loaded)
2. references/cadquery-api.md (always loaded)
3. Task-specific references (based on routing)
4. Relevant examples (based on routing)
```

## Step 4: Fallback Rule

If the user's prompt is ambiguous or doesn't clearly match any specific reference:
1. Always load `references/cadquery-api.md` (core API)
2. Load `references/error-recovery.md` (error patterns)
3. Load 1-2 example files that seem most relevant
4. Ask for clarification if the request is too vague

---

# COMMON PITFALLS

- NEVER use `cq.math` — use Python's `math` module
- NEVER call `.fillet()` or `.chamfer()` on edges smaller than the radius
- ALWAYS extrude main body BEFORE cutting holes or adding fillets
- `.translate()` takes ONE tuple: `.translate((x, y, z))`
- `.rotate()` takes `(start, end, angle)`: `.rotate((0,0,0), (0,0,1), 90)`
- For circular edges, use `%CIRCLE` selector
- `.close()` is required before `.extrude()` when drawing custom profiles
- `.toPending()` is required before `.loft()` when using selected wires
- Don't use keyword arguments for positional params in multimethod calls (e.g., `arc()`)

---

# CONTEXT REQUEST PROTOCOL

When you receive a user prompt, analyze it and determine if you need specific reference files to generate accurate code.

## If you need more context:

Output ONLY this JSON (no code):
{
  "context_needed": ["references/holes-cuts.md", "examples/mechanical-parts.md"],
  "code": null,
  "reason": "Brief explanation of why you need these files"
}

## If you have enough context:

Output the normal code JSON:
{
  "context_needed": [],
  "code": "import cadquery as cq\n...",
  "parameters": {...},
  "description": "...",
  "tags": [...]
}

## Rules:

- Only request files listed in the CATALOG section above
- Don't request files you already have in context
- For simple tasks (box, cylinder), you may not need extra files
- For complex tasks, request the specific references you need
- Maximum 2 context requests per generation
- After receiving requested files, generate the code

---

# FINAL ENFORCEMENT

Your response is parsed programmatically. Any text outside the JSON object will cause a parsing failure. Think carefully, then output ONLY the JSON.
