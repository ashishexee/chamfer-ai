import base64
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from executor import execute_cadquery
from params import extract_parameters

app = FastAPI(title="Chamfer AI CAD Server", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExecuteRequest(BaseModel):
    code: str
    params: dict[str, float] | None = None
    render_snapshots: bool = False
    render_png: bool = False
    render_dim_views: bool = False


class UpdateRequest(BaseModel):
    code: str
    params: dict[str, float]
    render_snapshots: bool = False
    render_png: bool = False
    render_dim_views: bool = False


@app.get("/health")
def health():
    return {"status": "ok", "service": "cad-server", "version": "0.3.0"}


@app.post("/execute")
def execute(req: ExecuteRequest):
    result = execute_cadquery(
        req.code,
        req.params,
        render_snapshots=req.render_snapshots,
        render_png=req.render_png,
        render_dim_views=req.render_dim_views,
    )

    if not result["success"]:
        return {"success": False, "error": result["error"]}

    parameters = extract_parameters(req.code)
    validation = result.get("validation", {})
    inspection = result.get("inspection", {})
    snapshots = result.get("snapshots", {})
    png_snapshots = result.get("png_snapshots", {})
    dim_views = result.get("dim_views", {})

    return {
        "success": True,
        "parameters": parameters,
        "has_stl": result["stl"] is not None,
        "has_step": result["step"] is not None,
        "has_glb": result["glb"] is not None,
        "stl_base64": base64.b64encode(result["stl"]).decode() if result["stl"] else None,
        "step_base64": base64.b64encode(result["step"]).decode() if result["step"] else None,
        "glb_base64": base64.b64encode(result["glb"]).decode() if result["glb"] else None,
        "validation": validation,
        "inspection": inspection,
        "snapshots": snapshots,
        "png_snapshots": png_snapshots,
        "dim_views": dim_views,
    }


@app.post("/update-params")
def update_params(req: UpdateRequest):
    result = execute_cadquery(
        req.code,
        req.params,
        render_snapshots=req.render_snapshots,
        render_png=req.render_png,
        render_dim_views=req.render_dim_views,
    )

    if not result["success"]:
        return {"success": False, "error": result["error"]}

    parameters = extract_parameters(req.code)
    validation = result.get("validation", {})
    inspection = result.get("inspection", {})
    snapshots = result.get("snapshots", {})
    png_snapshots = result.get("png_snapshots", {})
    dim_views = result.get("dim_views", {})

    return {
        "success": True,
        "parameters": parameters,
        "has_stl": result["stl"] is not None,
        "has_step": result["step"] is not None,
        "has_glb": result["glb"] is not None,
        "stl_base64": base64.b64encode(result["stl"]).decode() if result["stl"] else None,
        "step_base64": base64.b64encode(result["step"]).decode() if result["step"] else None,
        "glb_base64": base64.b64encode(result["glb"]).decode() if result["glb"] else None,
        "validation": validation,
        "inspection": inspection,
        "snapshots": snapshots,
        "png_snapshots": png_snapshots,
        "dim_views": dim_views,
    }


@app.post("/inspect")
def inspect_code(req: ExecuteRequest):
    """Run CadQuery code and return inspection + snapshots (no file bytes)."""
    result = execute_cadquery(
        req.code,
        req.params,
        render_snapshots=True,
        render_png=True,
        render_dim_views=True,
    )

    if not result["success"]:
        return {"success": False, "error": result["error"]}

    return {
        "success": True,
        "validation": result.get("validation", {}),
        "inspection": result.get("inspection", {}),
        "snapshots": result.get("snapshots", {}),
        "png_snapshots": result.get("png_snapshots", {}),
        "dim_views": result.get("dim_views", {}),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")
