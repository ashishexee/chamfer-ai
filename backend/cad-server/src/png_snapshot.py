"""Render PNG snapshots of STL files for LLM visual inspection."""

import struct
import numpy as np
import matplotlib
matplotlib.use('Agg')  # headless rendering
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from pathlib import Path
import base64


VIEW_ANGLES = {
    "iso": {"elev": 30, "azim": 45},
    "top": {"elev": 90, "azim": 0},
    "front": {"elev": 0, "azim": 0},
    "right": {"elev": 0, "azim": 90},
}


def _parse_binary_stl(stl_path: str) -> list:
    """Parse a binary STL file and return list of triangles (each = 3 vertices)."""
    triangles = []
    with open(stl_path, 'rb') as f:
        f.read(80)  # header
        num_faces = struct.unpack('<I', f.read(4))[0]
        for _ in range(num_faces):
            f.read(12)  # normal vector (skip)
            v1 = struct.unpack('<fff', f.read(12))
            v2 = struct.unpack('<fff', f.read(12))
            v3 = struct.unpack('<fff', f.read(12))
            f.read(2)  # attribute byte count
            triangles.append([v1, v2, v3])
    return triangles


def _parse_stl(stl_path: str) -> list:
    """Parse STL (binary or ASCII)."""
    try:
        return _parse_binary_stl(stl_path)
    except Exception:
        # Fallback: ASCII STL
        triangles = []
        vertices = []
        with open(stl_path, 'r') as f:
            for line in f:
                if 'vertex' in line:
                    parts = line.strip().split()
                    vertices.append((float(parts[1]), float(parts[2]), float(parts[3])))
                    if len(vertices) == 3:
                        triangles.append(vertices)
                        vertices = []
        return triangles


def render_png(stl_path: str, output_path: str, view: str = "iso") -> bool:
    """Render an STL file to a PNG image from a given angle."""
    triangles = _parse_stl(stl_path)
    if not triangles:
        return False

    angles = VIEW_ANGLES.get(view, VIEW_ANGLES["iso"])

    fig = plt.figure(figsize=(8, 6), facecolor='#1a1a1a')
    ax = fig.add_subplot(111, projection='3d', facecolor='#1a1a1a')

    # Render mesh
    collection = Poly3DCollection(triangles, alpha=0.85)
    collection.set_facecolor('#6b8cae')
    collection.set_edgecolor('#2a2a2a')
    collection.set_linewidth(0.15)
    ax.add_collection3d(collection)

    # Set view angle
    ax.view_init(elev=angles["elev"], azim=angles["azim"])

    # Auto-scale axes
    all_v = np.array(triangles).reshape(-1, 3)
    margins = 0.1
    x_range = all_v[:, 0].max() - all_v[:, 0].min()
    y_range = all_v[:, 1].max() - all_v[:, 1].min()
    z_range = all_v[:, 2].max() - all_v[:, 2].min()
    max_range = max(x_range, y_range, z_range) * (1 + margins)

    x_center = (all_v[:, 0].max() + all_v[:, 0].min()) / 2
    y_center = (all_v[:, 1].max() + all_v[:, 1].min()) / 2
    z_center = (all_v[:, 2].max() + all_v[:, 2].min()) / 2

    ax.set_xlim(x_center - max_range / 2, x_center + max_range / 2)
    ax.set_ylim(y_center - max_range / 2, y_center + max_range / 2)
    ax.set_zlim(z_center - max_range / 2, z_center + max_range / 2)

    # Equal aspect ratio
    ax.set_box_aspect([1, 1, 1])

    # Style: dark theme, no axes
    ax.set_axis_off()
    ax.set_xlabel('')
    ax.set_ylabel('')
    ax.set_zlabel('')

    # Title with view name
    ax.set_title(f'{view.upper()} view', color='#888888', fontsize=10, pad=10)

    plt.savefig(output_path, dpi=100, bbox_inches='tight',
                facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close(fig)
    return True


def render_png_snapshots(stl_path: str, output_dir: str, views: list[str] | None = None) -> dict[str, str]:
    """Render multiple PNG snapshots. Returns dict mapping view name -> base64 PNG."""
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    results = {}
    target_views = views or ["iso", "top", "front"]

    for view_name in target_views:
        png_path = out / f"snapshot_{view_name}.png"
        try:
            if render_png(str(stl_path), str(png_path), view_name):
                png_bytes = png_path.read_bytes()
                results[view_name] = base64.b64encode(png_bytes).decode()
        except Exception:
            pass

    return results
