"""Detailed geometry inspection for CadQuery shapes."""

import cadquery as cq


def inspect_geometry(shape) -> dict:
    """Run comprehensive geometry inspection checks.

    Returns structured dict with topology, dimensions, and validation data
    that can be fed back to the LLM for self-repair decisions.
    """
    try:
        val = shape.val()
    except Exception as e:
        return {"error": str(e), "valid": False}

    result = {}

    # ── Topology ──
    try:
        result["shape_type"] = val.ShapeType()
    except Exception:
        result["shape_type"] = "unknown"

    try:
        result["face_count"] = len(shape.faces().vals())
    except Exception:
        result["face_count"] = 0

    try:
        result["edge_count"] = len(shape.edges().vals())
    except Exception:
        result["edge_count"] = 0

    try:
        result["vertex_count"] = len(shape.vertices().vals())
    except Exception:
        result["vertex_count"] = 0

    # ── Dimensions ──
    try:
        vol = val.Volume()
        result["volume"] = round(vol, 3)
        result["has_volume"] = vol > 0
    except Exception:
        result["volume"] = 0
        result["has_volume"] = False

    try:
        result["surface_area"] = round(val.Area(), 3)
    except Exception:
        result["surface_area"] = 0

    try:
        bb = val.BoundingBox()
        result["bounding_box"] = {
            "size": [round(bb.xlen, 3), round(bb.ylen, 3), round(bb.zlen, 3)],
            "min": [round(bb.xmin, 3), round(bb.ymin, 3), round(bb.zmin, 3)],
            "max": [round(bb.xmax, 3), round(bb.ymax, 3), round(bb.zmax, 3)],
            "center": [round(bb.center.x, 3), round(bb.center.y, 3), round(bb.center.z, 3)],
        }
    except Exception:
        result["bounding_box"] = None

    try:
        com = val.Center()
        result["center_of_mass"] = [round(com.x, 3), round(com.y, 3), round(com.z, 3)]
    except Exception:
        result["center_of_mass"] = None

    # ── Validation ──
    try:
        result["is_valid"] = val.isValid()
    except Exception:
        result["is_valid"] = False

    try:
        result["is_solid"] = result["shape_type"] == "Solid"
    except Exception:
        result["is_solid"] = False

    try:
        result["is_closed"] = val.isClosed()
    except Exception:
        result["is_closed"] = None

    # ── Sanity checks ──
    warnings = []
    errors = []

    if not result.get("has_volume", False):
        errors.append("ZERO_VOLUME: Model has zero volume — likely surfaces/wires, not a solid. Ensure .extrude(), .revolve(), or .box() is used.")

    if result.get("bounding_box"):
        size = result["bounding_box"]["size"]
        if any(s > 10000 for s in size):
            warnings.append(f"OVERSIZED: Model is {size[0]}x{size[1]}x{size[2]}mm — likely a units error. Use millimeters.")
        if any(0 < s < 0.01 for s in size):
            warnings.append(f"UNDERSIZED: Model is {size[0]}x{size[1]}x{size[2]}mm — likely a units error.")
        if any(s == 0 for s in size):
            errors.append(f"FLAT_MODEL: Model is flat in one dimension ({size[0]}x{size[1]}x{size[2]}mm) — extrude depth may be zero.")

    if result.get("is_valid") is False:
        errors.append("INVALID_BREP: Shape is not a valid B-rep solid. May have self-intersecting geometry or incomplete boolean operations.")

    if result.get("face_count", 0) < 4:
        warnings.append(f"LOW_FACE_COUNT: Only {result.get('face_count', 0)} faces — a valid solid should have at least 4 (tetrahedron).")

    result["warnings"] = warnings
    result["errors"] = errors
    result["all_clear"] = len(errors) == 0 and len(warnings) == 0

    return result


def format_inspection_for_llm(inspection: dict) -> str:
    """Format inspection data as text feedback for the LLM repair loop."""
    if not inspection or inspection.get("error"):
        return f"Inspection failed: {inspection.get('error', 'unknown error')}"

    parts = []
    bb = inspection.get("bounding_box")
    if bb:
        parts.append(f"Geometry: {bb['size'][0]}x{bb['size'][1]}x{bb['size'][2]}mm, "
                      f"{inspection.get('face_count', 0)} faces, {inspection.get('edge_count', 0)} edges, "
                      f"volume={inspection.get('volume', 0)}mm³")

    for err in inspection.get("errors", []):
        parts.append(f"ERROR: {err}")

    for warn in inspection.get("warnings", []):
        parts.append(f"WARNING: {warn}")

    if inspection.get("all_clear"):
        parts.append("All geometry checks passed.")

    return "\n".join(parts)
