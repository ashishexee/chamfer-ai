"""Render 2D dimensional orthographic views (top/front/side) with dimension annotations.

Projects STL triangle mesh onto the three principal planes and draws an
engineering-style outline with overall width/height dimensions, a mm grid,
and axis labels. Output is base64-encoded PNG suitable for inline chat display.
"""

import struct
import base64
from pathlib import Path

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon
from matplotlib.collections import PolyCollection


# ── Projection definitions ──
# Each projection maps (x, y, z) -> (u, v) 2D coords and labels the axes.
# "top":   look down -Z  ->  u=x, v=y    (width=x, depth=y)
# "front": look along +Y ->  u=x, v=z    (width=x, height=z)
# "side":  look along +X ->  u=y, v=z    (depth=y, height=z)
PROJECTIONS = {
    "top": {
        "axes": ("X", "Y"),
        "title": "Top View",
        "drop": 2,  # drop z
    },
    "front": {
        "axes": ("X", "Z"),
        "title": "Front View",
        "drop": 1,  # drop y
    },
    "side": {
        "axes": ("Y", "Z"),
        "title": "Side View",
        "drop": 0,  # drop x
    },
}


def _parse_binary_stl(stl_path: str) -> np.ndarray:
    """Parse a binary STL file. Returns array of shape (N, 3, 3)."""
    dt = np.dtype([
        ("normal", "<f4", (3,)),
        ("v1", "<f4", (3,)),
        ("v2", "<f4", (3,)),
        ("v3", "<f4", (3,)),
        ("attr", "<u2"),
    ])
    with open(stl_path, "rb") as f:
        f.read(80)  # header
        num_faces = struct.unpack("<I", f.read(4))[0]
        raw = f.read(num_faces * 50)
    faces = np.frombuffer(raw, dtype=dt, count=num_faces)
    verts = np.stack([faces["v1"], faces["v2"], faces["v3"]], axis=1)
    return verts.astype(np.float64)


def _parse_stl(stl_path: str) -> np.ndarray:
    """Parse STL (binary first, ASCII fallback). Returns (N, 3, 3) vertices."""
    try:
        return _parse_binary_stl(stl_path)
    except Exception:
        triangles = []
        verts: list[tuple[float, float, float]] = []
        with open(stl_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                if "vertex" in line:
                    parts = line.strip().split()
                    verts.append((float(parts[1]), float(parts[2]), float(parts[3])))
                    if len(verts) == 3:
                        triangles.append(verts)
                        verts = []
        return np.array(triangles)


def _project(verts: np.ndarray, drop: int) -> np.ndarray:
    """Project (N, 3, 3) vertices onto a 2D plane by dropping one axis.

    Returns (N, 3, 2) array of 2D triangle vertices.
    """
    axes = [i for i in range(3) if i != drop]
    return verts[:, :, axes]


def _boundary_edges(tri2d: np.ndarray) -> np.ndarray:
    """Compute the outline of a 2D triangle mesh.

    Edges that appear exactly once are boundary edges. Returns an (M, 2, 2)
    array of boundary edge endpoints.
    """
    # Build edge list with sorted endpoints as keys
    edges = []
    for tri in tri2d:
        for i in range(3):
            a = tri[i]
            b = tri[(i + 1) % 3]
            key = (round(float(a[0]), 4), round(float(a[1]), 4),
                   round(float(b[0]), 4), round(float(b[1]), 4))
            edges.append((key, a, b))
    # Count occurrences by sorted pair
    from collections import defaultdict
    counts: dict[tuple, list] = defaultdict(list)
    for key, a, b in edges:
        # canonical key independent of direction
        p = (round(float(a[0]), 4), round(float(a[1]), 4))
        q = (round(float(b[0]), 4), round(float(b[1]), 4))
        ck = (p, q) if p <= q else (q, p)
        counts[ck].append((a, b))
    boundary = []
    for ck, lst in counts.items():
        if len(lst) == 1:
            boundary.append(lst[0])
    if not boundary:
        return np.empty((0, 2, 2))
    return np.array([[a, b] for a, b in boundary])


def _draw_dimension(ax, start, end, label, offset=4.0, color="#9ca3af"):
    """Draw a dimension line with arrows and a label between two points."""
    import matplotlib.patches as mpatches

    sx, sy = start
    ex, ey = end
    # Direction and perpendicular
    dx, dy = ex - sx, ey - sy
    length = np.hypot(dx, dy)
    if length < 1e-6:
        return
    ux, uy = dx / length, dy / length
    px, py = -uy, ux  # perpendicular
    # Offset line
    ox, oy = px * offset, py * offset
    a = (sx + ox, sy + oy)
    b = (ex + ox, ey + oy)
    # Extension lines from points to offset line
    ax.plot([sx, a[0]], [sy, a[1]], color=color, linewidth=0.5, linestyle=(0, (2, 2)))
    ax.plot([ex, b[0]], [ey, b[1]], color=color, linewidth=0.5, linestyle=(0, (2, 2)))
    # Dimension line with arrows
    ax.annotate(
        "",
        xy=b,
        xytext=a,
        arrowprops=dict(arrowstyle="<->", color=color, lw=0.8, shrinkA=0, shrinkB=0),
    )
    # Label centered above the dimension line
    mx = (a[0] + b[0]) / 2 + px * 2.5
    my = (a[1] + b[1]) / 2 + py * 2.5
    ax.text(
        mx,
        my,
        label,
        color="#e5e7eb",
        fontsize=8,
        ha="center",
        va="center",
        bbox=dict(boxstyle="round,pad=0.2", fc="#1a1a1a", ec="none", alpha=0.85),
    )


def render_dim_view(stl_path: str, output_path: str, view: str = "top") -> bool:
    """Render a single 2D dimensional view to a PNG file."""
    verts = _parse_stl(stl_path)
    if verts.size == 0:
        return False

    proj = PROJECTIONS.get(view, PROJECTIONS["top"])
    tri2d = _project(verts, proj["drop"])

    # Compute bounds
    all2d = tri2d.reshape(-1, 2)
    xmin, ymin = all2d.min(axis=0)
    xmax, ymax = all2d.max(axis=0)
    w = xmax - xmin
    h = ymax - ymin
    if w < 1e-6 or h < 1e-6:
        return False

    # Padding around the part
    pad = max(w, h) * 0.18
    fig_w = 5.0
    fig_h = fig_w * (h / w) if w > 0 else fig_w
    fig_h = max(fig_h, 2.5)
    fig_w = max(fig_w, 3.0)

    fig, ax = plt.subplots(figsize=(fig_w, fig_h), facecolor="#1a1a1a")
    ax.set_facecolor("#1a1a1a")

    # Fill triangles (solid) so interior is opaque, then draw boundary on top
    poly = PolyCollection(
        tri2d, closed=True, facecolor="#6b8cae", edgecolor="none", alpha=0.55
    )
    ax.add_collection(poly)

    # Boundary outline
    boundary = _boundary_edges(tri2d)
    if boundary.size > 0:
        for edge in boundary:
            ax.plot(
                [edge[0][0], edge[1][0]],
                [edge[0][1], edge[1][1]],
                color="#d1d5db",
                linewidth=1.0,
                zorder=3,
            )

    # Set limits with padding
    ax.set_xlim(xmin - pad, xmax + pad)
    ax.set_ylim(ymin - pad, ymax + pad)
    ax.set_aspect("equal", adjustable="box")

    # Grid + axes styling (mm)
    major = _nice_tick(max(w, h))
    ax.xaxis.set_major_locator(plt.MultipleLocator(major))
    ax.yaxis.set_major_locator(plt.MultipleLocator(major))
    ax.tick_params(axis="both", colors="#6b7280", labelsize=7, length=3, width=0.6)
    for spine in ax.spines.values():
        spine.set_color("#374151")
        spine.set_linewidth(0.8)
    ax.grid(True, color="#262626", linewidth=0.5, zorder=0)

    # Axis labels
    ax.set_xlabel(f"{proj['axes'][0]} (mm)", color="#9ca3af", fontsize=8)
    ax.set_ylabel(f"{proj['axes'][1]} (mm)", color="#9ca3af", fontsize=8)

    # Title
    ax.set_title(
        proj["title"],
        color="#e5e7eb",
        fontsize=10,
        pad=8,
        loc="left",
        fontweight="medium",
    )

    # Dimension annotations: width along u, height along v
    dim_off = max(w, h) * 0.10 + 3.0
    # Width dimension (bottom)
    _draw_dimension(
        ax,
        (xmin, ymin),
        (xmax, ymin),
        f"{w:.1f} mm",
        offset=-dim_off,
    )
    # Height dimension (left)
    _draw_dimension(
        ax,
        (xmin, ymin),
        (xmin, ymax),
        f"{h:.1f} mm",
        offset=-dim_off,
    )

    fig.tight_layout(pad=0.4)
    fig.savefig(
        output_path,
        dpi=130,
        bbox_inches="tight",
        facecolor=fig.get_facecolor(),
        edgecolor="none",
    )
    plt.close(fig)
    return True


def _nice_tick(extent: float) -> float:
    """Pick a 'nice' major tick spacing for a given extent (mm)."""
    if extent <= 0:
        return 1.0
    magnitude = 10 ** np.floor(np.log10(extent))
    normalized = extent / magnitude
    if normalized <= 1.5:
        return magnitude * 0.25
    elif normalized <= 3:
        return magnitude * 0.5
    elif normalized <= 7:
        return magnitude * 1.0
    else:
        return magnitude * 2.0


def render_dim_views(
    stl_path: str, output_dir: str, views: list[str] | None = None
) -> dict[str, str]:
    """Render multiple 2D dimensional views. Returns dict view_name -> base64 PNG."""
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    results: dict[str, str] = {}
    target_views = views or ["top", "front", "side"]

    for view_name in target_views:
        png_path = out / f"dim_{view_name}.png"
        try:
            if render_dim_view(str(stl_path), str(png_path), view_name):
                png_bytes = png_path.read_bytes()
                results[view_name] = base64.b64encode(png_bytes).decode()
        except Exception as e:
            # Don't fail the whole batch if one view fails
            print(f"[dim_views] {view_name} failed: {e}")

    return results
