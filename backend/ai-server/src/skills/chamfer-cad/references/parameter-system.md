# CadQuery Parameter System

## Parameter Annotation Format

Parameters should be declared as module-level variables with inline range annotations:

```python
import cadquery as cq

teeth = 12          # [6:1:24]
width = 60.0        # [10:5:200]
hole_dia = 8.0      # [2:1:30]
thickness = 5.0     # [1:1:50]
```

### Annotation Format

```
variable_name = value    # [min:step:max]
```

- `min` — Minimum allowed value
- `step` — Step size for sliders
- `max` — Maximum allowed value

### Type Detection

- If the value has no decimal point → `int` type
- If the value has a decimal point → `float` type

### Examples

```python
# Integer parameters
teeth = 12          # [6:1:24]     → int, min=6, step=1, max=24
bolt_count = 4      # [2:1:12]     → int, min=2, step=1, max=12

# Float parameters
width = 60.0        # [10:5:200]   → float, min=10, step=5, max=200
hole_dia = 8.0      # [2:1:30]     → float, min=2, step=1, max=30
fillet_r = 2.0      # [0.5:0.5:20] → float, min=0.5, step=0.5, max=20
```

## JSON Response Schema

When generating code, include parameters in the JSON response:

```json
{
  "code": "import cadquery as cq\n\nteeth = 12\n...",
  "parameters": {
    "teeth": {
      "type": "int",
      "default": 12,
      "min": 6,
      "max": 24,
      "step": 1,
      "description": "Number of teeth on the gear"
    },
    "width": {
      "type": "float",
      "default": 60.0,
      "min": 10,
      "max": 200,
      "step": 5,
      "description": "Overall width in mm"
    }
  },
  "description": "A spur gear with 12 teeth",
  "tags": ["gear", "mechanical"]
}
```

### Parameter Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | One of: `int`, `float`, `bool`, `string`, `enum`, `color` |
| `default` | number/string/bool | Yes | Default value |
| `min` | number | For int/float | Minimum value |
| `max` | number | For int/float | Maximum value |
| `step` | number | For int/float | Step size for sliders |
| `description` | string | No | Human-readable description |
| `options` | array | For enum | Array of string choices |

## Parameter Extraction (Server-Side)

The server extracts parameters from Python code using regex:

```python
def substitute_params(code: str, params: dict[str, float | int | str]) -> str:
    """Replace top-level variable assignments with new parameter values."""
    result = code
    for name, value in params.items():
        # Detect if original value was an integer
        original_match = re.search(rf'^{name}\s*=\s*([\d.]+)', result, re.MULTILINE)
        if original_match and '.' not in original_match.group(1):
            formatted_value = int(value)
        else:
            formatted_value = value

        # Replace the value while preserving any trailing comment
        result = re.sub(
            rf'^({name}\s*=\s*)([\d.]+)(\s*#.*)?$',
            rf'\g<1>{formatted_value}\3',
            result,
            flags=re.MULTILINE,
        )
    return result
```

## Best Practices for Parameters

### 1. Define All Parameters at Top

```python
import cadquery as cq

# All configurable parameters at the top
length = 80.0       # [20:5:200]
width = 60.0        # [20:5:200]
thickness = 10.0    # [2:1:50]
bearing_dia = 22.0  # [5:1:50]
hole_padding = 12.0 # [5:1:50]
fillet_radius = 2.0 # [0.5:0.5:20]

# Model uses parameters
result = (
    cq.Workplane("XY")
    .box(length, width, thickness)
    .faces(">Z")
    .workplane()
    .hole(bearing_dia)
    .faces(">Z")
    .workplane()
    .rect(length - hole_padding, width - hole_padding, forConstruction=True)
    .vertices()
    .cboreHole(2.4, 4.4, 2.1)
    .edges("|Z")
    .fillet(fillet_radius)
)
```

### 2. Use Descriptive Names

```python
# GOOD
bracket_length = 100.0
hole_diameter = 6.0
fillet_radius = 2.0

# BAD
l = 100.0
d = 6.0
r = 2.0
```

### 3. Include Units in Description

```json
{
  "width": {
    "type": "float",
    "default": 60.0,
    "min": 10,
    "max": 200,
    "step": 5,
    "description": "Overall width in mm"
  }
}
```

### 4. Reasonable Ranges

```json
{
  "teeth": {
    "type": "int",
    "default": 12,
    "min": 6,      // Too few teeth = weak gear
    "max": 60,     // Too many teeth = impractical
    "step": 1,
    "description": "Number of teeth"
  }
}
```

## Parameter Update Flow

1. User changes a parameter value via the UI slider
2. Client sends `{ code, params: { "width": 80.0 } }` to server
3. Server calls `substitute_params(code, params)`
4. Server executes the modified code in Docker sandbox
5. Server returns new STEP/STL/GLB files
6. Client loads new GLB into Three.js viewport

**No AI re-generation needed** — just variable substitution and re-execution.
