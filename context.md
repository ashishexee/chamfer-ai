# Chamfer AI — Project Context & Architecture Plan

> This document captures the full research, analysis, and architectural decisions for building an AI-powered parametric CAD web application that generates CadQuery Python code, executes it server-side, and renders 3D models in the browser.

---

## 1. Core Idea

Build an **open-source Text-to-CAD web app** that:
- Takes natural language prompts (and optionally images)
- Generates parametric CadQuery Python code using fine-tuned open-source LLMs
- Executes the code server-side (Python + OpenCASCADE kernel)
- Exports STEP + STL + GLB files
- Renders 3D models in the browser via Three.js
- Provides interactive parameter controls (sliders, selectors, inputs)

---

## 2. Key Architectural Decisions

### 2.1 CadQuery Python Instead of OpenSCAD

**Decision:** Generate CadQuery Python code instead of OpenSCAD.

**Rationale:**
- CadQuery runs on OpenCASCADE — a real B-rep CAD kernel (exact NURBS surfaces, not CSG mesh approximations)
- Supports STEP export (engineering standard) — OpenSCAD cannot export STEP
- Supports GLB/GLTF export (with colors/materials) — OpenSCAD requires a hack (OFF format for colors)
- Python is more familiar to developers and easier for LLMs to generate correctly
- Enables Fusion 360/Onshape interop via STEP import

**Trade-off:**
- OpenSCAD runs in the browser via WASM (instant parameter updates in ~1s)
- CadQuery requires server-side execution (parameter updates take ~2-5s round-trip)
- This is acceptable for a web product — users expect this trade-off

### 2.2 Server-Side Execution (Not Client WASM)

**Decision:** Execute CadQuery on a server, not in the browser.

**Rationale:**
- CadQuery depends on OpenCASCADE (~3M lines of C++). Cannot be compiled to WASM.
- OpenSCAD WASM exists because OpenSCAD is small and self-contained — that's a special case.
- Server-side execution enables: STEP export, real CAD kernel, no ~30MB WASM download.
- Parameter changes re-execute the same code with substituted values (no AI re-generation needed).

### 2.3 Open-Source Fine-Tuned Models (Not Frontier APIs)

**Decision:** Use open-source fine-tuned models instead of Claude/GPT/Gemini.

**Rationale:**
- Lower cost at scale
- Full control over model behavior
- Can fine-tune specifically on CadQuery examples
- Self-hosted on vLLM or Ollama with OpenAI-compatible API

**Recommended base models:**
- **Qwen2.5-Coder-32B** — strongest open code model, likely decent at CadQuery zero-shot
- **DeepSeek-Coder-V2-Lite** — strong alternative
- **CodeLlama-13B** — smaller, faster option

**Training data sources for fine-tuning:**
- CadQuery official docs + examples (~200 snippets)
- CQ-Editor repository scripts
- GitHub repos using CadQuery (gear generators, parametric parts)
- Synthetic data: frontier model generates `(prompt, cadquery_code)` pairs → manually verified
- The current CADAM OpenSCAD examples rewritten in CadQuery

### 2.4 Web-First Frontend (Not Electron)

**Decision:** Build as a web app first. Add Electron later if users demand it.

**Rationale:**
- Zero friction — click a link, start designing (no download required)
- CadQuery is server-side anyway — Electron provides no computational benefit
- Largest addressable market (every device with a browser)
- Zoo themselves have a web client at app.zoo.dev — even they couldn't ignore the web
- Electron packages can wrap the web app later (Zoo does exactly this)

---

## 3. How CADAM (Current) Works

CADAM is an existing open-source Text-to-CAD web app that served as our starting reference.

### 3.1 Tech Stack
- **Frontend:** React 19 + TypeScript + TanStack Start + Vite
- **3D Rendering:** Three.js + React Three Fiber + Drei
- **CAD Engine:** OpenSCAD WebAssembly (client-side)
- **Backend:** TanStack Start server routes + Supabase (PostgreSQL, Auth, Storage)
- **AI:** Anthropic Claude API (frontier model)
- **Styling:** Tailwind CSS + shadcn/ui (Radix UI primitives)

### 3.2 Two Pipelines
1. **Parametric Pipeline:** User text → Claude generates OpenSCAD code → client WASM compiles → STL/OFF → Three.js renders in browser
2. **Creative Pipeline:** User text/images → Claude → image-gen (gpt-image-2/Gemini/Flux) → fal.ai 3D reconstruction (Tripo/SAM-3/Meshy) → GLB download → Three.js

### 3.3 Key Files
| File | Role |
|---|---|
| `src/server/aiChat.ts` (1283 lines) | Core AI orchestrator |
| `src/server/mesh.ts` (1638 lines) | Creative mesh generation engine |
| `src/worker/openSCAD.ts` (435 lines) | OpenSCAD WASM wrapper |
| `src/worker/toolWorker.ts` | Singleton worker for tool execution |
| `shared/chatAi.ts` | Tool schemas & message types |
| `shared/parseParameters.ts` | OpenSCAD annotation → UI parameter extraction |
| `shared/Tree.ts` | Message branching tree |
| `src/hooks/useOpenSCAD.ts` | React hook for OpenSCAD compilation |
| `src/hooks/useMeshData.ts` | React Query hook for mesh polling |
| `src/server/falWebhook.ts` | Async mesh completion handler |
| `src/server/imageGen.ts` | Image generation with 3-tier fallback |
| `src/server/billingClient.ts` | Stripe billing integration |
| `supabase/schemas/` | DB schema with RLS + triggers |

---

## 4. How Our Product Will Work

### 4.1 Parametric Pipeline (CadQuery)

```
User types "Make me a gear with 12 teeth"
    │
    ▼
[1] Client: persistUserMessage() → Supabase messages table
    │
    ▼
[2] Client: POST /api/parametric-chat
    │
    ▼
[3] Server: AI Chat handler → open-source fine-tuned model generates CadQuery Python code
    │  System prompt: Generate CadQuery Python with parameter annotations
    │  Tool: build_parametric_model → { title, version, code }
    │
    ▼
[4] Server: Execute CadQuery code in sandboxed Docker container
    │  → Export STEP + STL + GLB + screenshot/thumbnail
    │  → Extract parameters from Python AST
    │  → Upload files to Supabase Storage
    │  → Return { status, previewUrl, stepUrl, stlUrl, glbUrl, parameters }
    │
    ▼
[5] Client: Download GLB → Render in Three.js viewport
    │  Download parameter definitions → Render slider controls in sidebar
    │
    ▼
[6] Parameter change: Slider tweak → Server re-executes CadQuery with new value
    │  (No AI re-generation — just variable substitution in existing code)
    │  ~2-5 seconds round-trip
    │
    ▼
[7] Export: Already have STEP/STL/GLB on server → Direct download URLs
```

### 4.2 Parameter Update Flow

For **simple dimensional changes** (length, width, radius, etc.):
1. Instant preview: Three.js scales the existing mesh (0ms, but visually imperfect — stretched fillets, oval holes)
2. Accurate render: Server re-executes CadQuery with the new parameter value (~2-5s)
3. Swap: Replace stretched preview with accurate GLB
4. Cache: Server caches results by `(code_hash, params)` for instant revisit

For **topology changes** (teeth count, hole count, adding/removing features):
1. Show loading spinner on viewport
2. Server re-executes CadQuery (~2-5s)
3. Load new GLB

### 4.3 Parameter Extraction

Old (OpenSCAD Customizer):
```openscad
teeth = 12; // [6:1:24]
width = 60; // [10:5:200]
```

New (CadQuery Python — same convention):
```python
import cadquery as cq

teeth = 12    # [6:1:24]
width = 60.0  # [10:5:200]
hole_dia = 8  # [2:1:30]

result = (
    cq.Workplane("XY")
    .rect(width, 40)
    .extrude(5)
    .faces(">Z").workplane()
    .hole(hole_dia)
)
```

Or structured:
```python
from dataclasses import dataclass

@dataclass
class Params:
    teeth: int = 12       # [6:1:24]
    width: float = 60.0   # [10:5:200]
    hole_diameter: float = 8.0  # [2:1:30]
```

Server parameter substitution:
```python
def execute_with_params(code: str, params: dict) -> bytes:
    for name, value in params.items():
        code = re.sub(
            rf'^{name}\s*=\s*.*',
            f'{name} = {value}',
            code,
            flags=re.MULTILINE
        )
    return run_cadquery(code)
```

---

## 5. Competitor Research

### 5.1 CADAM (cadam.new)
- **URL:** adam.new
- **License:** GPLv3
- **Approach:** OpenSCAD WASM + Claude/GPT frontier models
- **Export:** STL, SCAD, DXF
- **Parametric updates:** Instant (WASM in-browser)
- **Strength:** Open source, browser-only, no server cost for rendering
- **Weakness:** No STEP export, limited to OpenSCAD CSG (no real CAD kernel), frontier model dependency

### 5.2 Whisker (whisker.art — couldn't reach directly)
- **Claims from landing page:**
  - "AI-Powered Parametric CAD"
  - STEP + STL export
  - Fusion 360 import with full feature tree
  - ~30s average generation time
  - 50 adjustable parameters
  - Multi-agent system with AI-verified geometry
  - Photo to CAD / STL to parametric
- **Likely approach:** CadQuery Python + server-side execution + vision verification loop
- **Likely stack:** Fine-tuned model → CadQuery → OpenCASCADE → STEP

### 5.3 Zoo / KittyCAD (zoo.dev)
- **Company:** Founded 2021, Inglewood CA, ~30 engineers
- **CEO:** Jessie Frazelle (former Docker, Kubernetes contributor)
- **GitHub:** github.com/KittyCAD/modeling-app — 1.2k stars, MIT license

#### Their Full Stack
1. **Custom GPU Geometry Engine** — wrote their own B-rep kernel from scratch, GPU-accelerated SSI (surface-surface intersection), patented algorithm. Uses NURBS-only B-rep with minimal primitive set (B-splines only).
2. **KCL (KittyCAD Language)** — their own functional programming language for parametric CAD. `cube = extrude(square, 10)`. Human-readable, version-control-friendly, caching-friendly.
3. **Zoo Design Studio** — Electron desktop app + web client. Same React codebase. 3D view is a VIDEO STREAM (WebRTC) from their GPU servers. Three.js only used for 2D sketch overlay.
4. **Zookeeper** — conversational CAD agent. Agentic loop: Plan → Act (use tools) → Observe → Update plan. Engine-level tools: execute KCL, inspect geometry, take snapshots, compute mass/volume.
5. **KittyCAD API + ML-ephant API** — geometry engine as service, $0.50/min, $10 free/month
6. **Enterprise Fine-Tuning** — customer provides NX/Creo/CATIA/SolidWorks files → Zoo converts to KCL → fine-tunes bespoke model

#### Browser Architecture
- 3D viewport is literally a `<video>` element receiving WebRTC video stream
- WebSocket for signaling + reliable commands (msgpack binary encoding)
- DataChannel for low-latency camera interactions
- Three.js is used ONLY for the 2D sketch overlay (transparent WebGL canvas over video)
- Desktop and browser share the same codebase — `isDesktop()` checks user agent for `"electron"`

#### Key Quote
> *"Meshes are great for avatars, not turbine blades and optics."*

They are CAD-first, B-rep-only.

### 5.4 Adam Fusion (fusion.adam.new)
- Same team as CADAM
- A **Fusion 360 desktop add-in** (not web)
- Docks a chat palette inside Fusion's UI
- Chat UI loaded from hosted URL at `https://fusion.adam.new/chat`
- Python handlers run inside Fusion's process:

| Handler | What it does |
|---|---|
| **read** | Query bodies, faces, edges, parameters, volume, area, timeline, screenshots |
| **execute** | Run Python scripts inside Fusion, open/close/save documents |
| **create** | Sketch, extrude, revolve, fillet, chamfer, shell, hole, pattern, primitives |
| **update** | Edit features, change parameters, undo/redo, timeline, visibility, materials |
| **delete** | Remove features, sketches, parameters by name or type |

- AI doesn't generate code files — it makes structured tool calls that directly manipulate Fusion's live parametric engine
- Requires Fusion 360 installed (desktop app only)

---

## 6. Comparison Matrix

| | **CADAM (current)** | **Whisker (likely)** | **Zoo/KittyCAD** | **Our Plan** |
|---|---|---|---|---|
| CAD kernel | OpenSCAD (CSG) | OpenCASCADE via CadQuery | Custom GPU engine | OpenCASCADE via CadQuery |
| Output format | STL/OFF (mesh) | STEP + STL (B-rep) | KCL → STEP/glTF (B-rep) | STEP + STL + GLB (B-rep) |
| AI model | Claude/GPT (frontier) | Likely fine-tuned | Own fine-tuned ML | Fine-tuned Qwen2.5-Coder |
| Execution | Client WASM | Server Python | Server (own engine) | Server (Docker Python) |
| Parametric updates | Instant (~1s) | ~30s | Server round-trip | ~2-5s |
| 3D rendering | Three.js (local) | Likely Three.js | Video stream (WebRTC) | Three.js (local GLB) |
| Web first | Yes | Yes | Yes (secondary) | Yes |
| Open source | Yes (GPLv3) | No | Partially | Yes |
| Fusion interop | None | Feature tree import | KCL conversion | Via STEP export |
| Infrastructure | Serverless (WASM) | Cloud GPU | Own GPU servers | Docker + GPU inference |

---

## 7. Why Big Companies Do Instant Parametric Updates

| Company | How |
|---|---|
| **SolidWorks** | Local Parasolid kernel on your machine (native C++) |
| **Fusion 360** | Local kernel, some cloud features |
| **Onshape** | Custom C++ kernel compiled to WASM. Years of engineering. ~100MB+ download |
| **CADAM** | OpenSCAD compiled to WASM (unique case — small enough to fit) |
| **Zoo** | Video streaming from their GPU servers (not local rendering) |
| **Whisker** | Server round-trip (accepts the latency) |

**Key insight:** Nobody has compiled OpenCASCADE to WASM. It's 3M+ lines of C++. The only browser-side CAD options are:
1. OpenSCAD (small enough for WASM)
2. Onshape (custom kernel, massive investment)
3. Streaming video (Zoo approach)

Our server round-trip approach is the pragmatic middle ground.

---

## 8. Why You Can't Edit STL Files Directly

STL files are just a bag of triangles. They have NO parametric intelligence:
```
STL = "triangle at (0,0,0), (1,0,0), (0,1,0)..."
     ↑ No concept of "teeth", "holes", "fillets" — just raw triangles
```

**What you CAN do in-browser on an STL:**
- Scale, rotate, translate (simple matrix transforms)
- That's it

**What you CANNOT do in-browser on an STL:**
- Change hole diameter, change number of teeth, add/remove features
- Any actual parametric change

Every real parameter change requires re-executing the CadQuery Python code with new parameter values. That's the whole point of a CAD kernel — it rebuilds geometry from the parametric description.

---

## 9. Recommended Execution Phases

```
Phase 1  ──→  CadQuery Docker service (FastAPI + sandbox)
  │             Input: CadQuery Python code + params
  │             Output: STEP + STL + GLB + screenshot + extracted parameters
  │
Phase 2  ──→  Pick base model + test zero-shot CadQuery generation
  │             (Qwen2.5-Coder-32B on vLLM, try without fine-tuning first)
  │
Phase 3  ──→  Build the parametric pipeline
  │             - New system prompt for CadQuery Python
  │             - Parameter parser for Python (AST-based or regex)
  │             - Server route for code execution (proxy to Docker)
  │             - Three.js viewer loads server-generated GLB
  │             - Parameter slider controls + server round-trip
  │             - Instant preview via mesh scaling (hybrid approach)
  │
Phase 4  ──→  Fine-tune model on CadQuery data
  │             (if zero-shot quality isn't good enough)
  │
Phase 5  ──→  Creative pipeline: image-to-3D with open-source models
                 (Hunyuan3D-2 + FLUX on own GPU instead of fal.ai)
```

---

## 10. Frontend Tech Stack (Recommended)

Based on CADAM's proven architecture, with modifications for CadQuery:

```
React 19 + TypeScript + Vite          ← Modern, fast build tooling
TanStack Router + Query               ← File-based routing + server state
Tailwind CSS + shadcn/ui              ← Rapid UI development
Three.js + React Three Fiber + Drei   ← 3D viewport (loads GLB/STL from server)
Monaco Editor                         ← Code view for CadQuery Python
Supabase                              ← Auth, database, storage
XState                                ← State machines for complex CAD workflows (Zoo uses this)
```

### What to remove from CADAM's stack:
- `src/worker/` — entire OpenSCAD WASM worker directory
- `src/vendor/openscad-wasm/` — WASM binary
- `src/hooks/useOpenSCAD.ts` — client compilation hook
- `public/libraries/` — BOSL2/MCAD libraries
- OFF file parsing for colors (GLB has colors built in)

### What to add to CADAM's stack:
- CadQuery execution service (Docker + FastAPI + sandbox)
- `src/hooks/useCadQuery.ts` — polls server for STEP/STL/GLB
- `src/server/cadqueryExec.ts` — proxies to CadQuery Docker service
- Monarch Editor for code viewing
- Python parameter parser (AST-based parsing of CadQuery variable declarations)

---

## 11. Open Questions

1. **CadQuery execution environment:** Docker microservice vs Nitro server subprocess vs serverless?
2. **Model hosting:** Own GPU server (RunPod, Modal, Lambda) or local? Determines model size limits.
3. **Fine-tune immediately or test zero-shot first?** Test Qwen2.5-Coder on CadQuery prompts first.
4. **Creative pipeline:** Keep parametric-only initially, add image-to-3D later?
5. **Monetization:** Free tier + subscription? Credit-based like CADAM? Enterprise fine-tuning like Zoo?

---

## 12. Key Design Principles

1. **Generate once, execute many times** — Store the CadQuery code. Parameter changes only substitute variables and re-execute. No AI re-generation needed for slider changes.
2. **Hybrid parameter updates** — Scale local mesh for instant preview (imperfect), swap to accurate server-rendered GLB when ready.
3. **Cache aggressively** — Server caches results by `(code_hash, params)` for instant revisit of previous parameter combinations.
4. **Export formats** — GLB for browser rendering (has colors), STEP for engineering download, STL for 3D printing download.
5. **B-rep over mesh** — Every model is manufacturable-ready. Not triangle soup.
