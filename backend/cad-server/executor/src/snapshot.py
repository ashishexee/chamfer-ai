"""Render SVG snapshots of CadQuery shapes from multiple angles."""

import cadquery as cq
from pathlib import Path


VIEWS = {
    "iso": (1, 1, 1),
    "top": (0, 0, 1),
    "front": (0, -1, 0),
    "right": (1, 0, 0),
}


def render_snapshots(shape, output_dir: str, views: list[str] | None = None) -> dict[str, str]:
    """Render SVG snapshots from multiple angles.

    Returns dict mapping view name -> SVG file path.
    Uses CadQuery's built-in SVG exporter (no extra dependencies).
    """
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    results = {}
    target_views = views or ["iso", "top", "front"]

    for view_name in target_views:
        proj = VIEWS.get(view_name, (1, 1, 1))
        svg_path = out / f"snapshot_{view_name}.svg"

        try:
            cq.exporters.export(
                shape,
                str(svg_path),
                opt={
                    "width": 800,
                    "height": 600,
                    "projectionDir": proj,
                    "focus": (0, 0, 0),
                    "strokeWidth": 0.3,
                    "strokeColor": (0.6, 0.7, 0.85),
                    "hiddenColor": (0.3, 0.3, 0.35),
                    "showHidden": True,
                    "showAxes": False,
                },
            )
            if svg_path.exists():
                results[view_name] = str(svg_path)
        except Exception:
            pass

    return results


def read_snapshots_as_text(paths: dict[str, str]) -> dict[str, str]:
    """Read SVG files and return as dict of view_name -> svg_content."""
    out = {}
    for view_name, path in paths.items():
        try:
            out[view_name] = Path(path).read_text(encoding="utf-8")
        except Exception:
            pass
    return out
