# CadQuery Export Patterns

## Supported Export Formats

| Format | Extension  | Notes                                    |
|--------|------------|------------------------------------------|
| STEP   | .step/.stp | B-rep, engineering standard              |
| STL    | .stl       | Mesh, for 3D printing                    |
| glTF   | .gltf/.glb | Mesh, for web (assemblies only, colors!) |
| AMF    | .amf       | Mesh, additive manufacturing             |
| 3MF    | .3mf       | Mesh, additive manufacturing             |
| SVG    | .svg       | 2D vector rendering                      |
| DXF    | .dxf       | 2D CAD format (sections only)            |
| TJS    | .tjs/.json | Three.js JSON mesh                       |
| VRML   | .vrml      | Web 3D format                            |

## Exporting STEP (from Workplane)

```python
# Simple export (format auto-detected from extension)
result.export("output.step")

# With non-standard extension, specify type
result.export("output.stp", "STEP")
result.export("output.stp", cq.exporters.ExportTypes.STEP)

# With options
result.export("output.step", opt={"write_pcurves": False})

# With units (default is MM)
result.export("output.step", unit="MM")
result.export("output.step", unit="MM", outputUnit="M")  # Scale to meters
```

## Exporting STL

```python
# Simple export
result.export("output.stl")

# With mesh quality control
# tolerance: linear deflection (default 0.001)
# angularTolerance: angular deflection (default 0.1)
result.val().exportStl("output.stl", tolerance=0.001, angularTolerance=0.1)

# ASCII STL (default is binary)
result.val().exportStl("output.stl", ascii=True)

# Parallel processing (default True)
result.val().exportStl("output.stl", parallel=True)
```

## Exporting glTF/GLB (Assemblies Only)

```python
# Binary GLB (recommended for web -- includes colors)
assy.export("output.glb")

# Text glTF
assy.export("output.gltf")
```

> **IMPORTANT:** glTF/GLB export is only available for Assembly objects, not Workplane. To export a single part as GLB, wrap it in an Assembly:
> ```python
> assy = cq.Assembly().add(result, name="part", color=cq.Color("gray"))
> assy.export("output.glb")
> ```

## Exporting SVG

```python
result.export("output.svg")

# With options
result.export("output.svg", opt={
    "width": 300,
    "height": 300,
    "marginLeft": 10,
    "marginTop": 10,
    "showAxes": True,
    "projectionDir": (0.5, 0.5, 0.5),
    "strokeWidth": 0.25,
    "strokeColor": (255, 0, 0),
    "hiddenColor": (0, 0, 255),
    "showHidden": True,
    "focus": 25,  # Perspective projection
})
```

## Exporting DXF (2D Sections Only)

```python
# Must section the 3D object first
result = cq.Workplane().box(10, 10, 10).section()
result.export("output.dxf")

# With approximation
cq.exporters.exportDXF(result, "output.dxf", approx="spline")  # or "arc"
cq.exporters.exportDXF(result, "output.dxf", approx="arc", tolerance=0.001)
```

## Importing Files

```python
# Import STEP
result = cq.importers.importStep("input.step")
result = cq.importers.importStep("input.step", unit="MM")

# Import DXF
result = cq.importers.importDXF("input.dxf")
result = cq.importers.importDXF("input.dxf", tol=1e-6, exclude=["layer1"], include=["layer2"])

# Import assembly from STEP/XML/XBF
assy = cq.Assembly.load("input.step")
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

# Export to XML (OCCT internal format)
assy.export("assembly.xml")
```

## Common Export Pitfalls

### glTF/GLB Export Only Works on Assemblies

```python
# WRONG: This will fail
result.export("output.glb")

# CORRECT: Wrap in Assembly first
assy = cq.Assembly().add(result, name="part", color=cq.Color("gray"))
assy.export("output.glb")
```

### DXF Export Only Works on 2D Sections

```python
# WRONG: This will fail
result.export("output.dxf")

# CORRECT: Section the object first
result.section().export("output.dxf")
```

### File Extension Recognition

```python
# CadQuery auto-detects format from file extension
# Using .stp for STEP may fail
# Fix: specify the export type explicitly
result.export("output.stp", "STEP")
# or
result.export("output.stp", cq.exporters.ExportTypes.STEP)
```
