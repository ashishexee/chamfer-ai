"""Validate that every executable code block in skill docs actually runs.

The chamfer-cad skill ships markdown docs that the LLM reads before writing
CadQuery code. Any block that fails to run teaches the model a broken pattern,
so CI treats doc blocks as executable tests.

Run inside a CadQuery environment (e.g., the chamfer-ai-cad-executor sandbox):

    python tests/test_skill_docs.py [skills_root]

Defaults to ../src/skills relative to this file. Exit code 0 means every
executable block passed.

Rules
-----
- Every ```python block is executable. Use ```text for API signatures and
  fragments that are not runnable on their own.
- Blocks run under the SAME restrictions as the production runner
  (executor/src/runner.py): only `cadquery` and `math` imports, no `open`,
  no `class` statements, sandbox builtins only.
- A block is validated when it runs without raising and — if it assigns
  `result` — the runner would accept it: `cq.exporters.export()` must succeed
  and `result.val()` must return a positive-volume solid. Blocks that run but
  never assign `result` are treated as fragments and pass.
- A block containing an `# EXPECTED-FAIL` marker MUST raise; a passing block
  with that marker is a failure.
"""

from __future__ import annotations

import contextlib
import io
import re
import sys
import traceback
from pathlib import Path

import cadquery as cq

HEADER = "import cadquery as cq\n"
BLOCK_RE = re.compile(r"```python\s*\n(.*?)```", re.S)

# ── Mirror of executor/src/runner.py restricted environment ──────────

ALLOWED_MODULES = {"cadquery", "math"}


def _safe_import(name, *args, **kwargs):
    if name not in ALLOWED_MODULES:
        raise ImportError(f"module '{name}' is not permitted in the sandbox")
    return __import__(name, *args, **kwargs)


SAFE_BUILTINS = {
    "True": True,
    "False": False,
    "None": None,
    "print": print,
    "range": range,
    "len": len,
    "int": int,
    "float": float,
    "str": str,
    "bool": bool,
    "list": list,
    "dict": dict,
    "tuple": tuple,
    "set": set,
    "frozenset": frozenset,
    "bytes": bytes,
    "bytearray": bytearray,
    "complex": complex,
    "abs": abs,
    "min": min,
    "max": max,
    "round": round,
    "sum": sum,
    "pow": pow,
    "divmod": divmod,
    "hex": hex,
    "oct": oct,
    "bin": bin,
    "enumerate": enumerate,
    "zip": zip,
    "map": map,
    "filter": filter,
    "sorted": sorted,
    "reversed": reversed,
    "any": any,
    "all": all,
    "iter": iter,
    "next": next,
    "slice": slice,
    "isinstance": isinstance,
    "issubclass": issubclass,
    "type": type,
    "object": object,
    "property": property,
    "staticmethod": staticmethod,
    "classmethod": classmethod,
    "hasattr": hasattr,
    "Exception": Exception,
    "RuntimeError": RuntimeError,
    "ValueError": ValueError,
    "TypeError": TypeError,
    "NameError": NameError,
    "IndexError": IndexError,
    "KeyError": KeyError,
    "AttributeError": AttributeError,
    "ZeroDivisionError": ZeroDivisionError,
    "OverflowError": OverflowError,
    "ImportError": ImportError,
    "StopIteration": StopIteration,
    "ArithmeticError": ArithmeticError,
    "LookupError": LookupError,
    "__import__": _safe_import,
}


def extract_blocks(text: str):
    """Yield (block_number, code) for every python-fenced block."""
    for i, m in enumerate(BLOCK_RE.finditer(text), start=1):
        yield i, m.group(1)


def run_block(code: str):
    """Compile and exec a block under sandbox restrictions.

    Returns (status, error, namespace); status is "syntax" when the block
    does not compile, else "ran".
    """
    try:
        compiled = compile(HEADER + code, "<block>", "exec")
    except SyntaxError as e:
        return "syntax", e, {}

    ns: dict = {"__builtins__": dict(SAFE_BUILTINS)}
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            exec(compiled, ns)
    except Exception as e:  # noqa: BLE001 - any failure is data here
        return "ran", e, ns
    return "ran", None, ns


def validate_result(ns: dict):
    """Check the runner would accept the block's `result`."""
    if "result" not in ns:
        return True, "fragment (no `result`)"

    r = ns["result"]

    if not hasattr(r, "val"):
        return False, (
            f"result is a {type(r).__name__} without .val() — the runner "
            "requires a Workplane (never a raw Shape or cq.Assembly)"
        )

    # The runner exports STL/STEP from result before anything else
    try:
        cq.exporters.export(r, "/tmp/_harness_check.stl")
    except Exception as e:  # noqa: BLE001
        return False, (
            f"runner STL export would fail: {type(e).__name__}: {e}"
        )

    try:
        shape = r.val()
    except Exception as e:  # noqa: BLE001
        return False, f"result.val() raised {type(e).__name__}: {e}"

    type_name = type(shape).__name__
    if not hasattr(shape, "Volume"):
        return False, (
            f"result.val() is a {type_name}, not a solid — "
            "wrap Sketch results with placeSketch(...).extrude()"
        )
    try:
        volume = shape.Volume()
    except Exception as e:  # noqa: BLE001
        return False, f"{type_name}.Volume() raised {type(e).__name__}: {e}"
    if volume <= 0:
        return False, f"{type_name} has non-positive volume ({volume:.3f})"
    return True, f"solid, volume={volume:.1f}"


def check_file(path: Path):
    """Return (passed, failed, failures, expected_fails) for one markdown file."""
    text = path.read_text(encoding="utf-8")
    passed = failed = 0
    failures = []
    expected_fails = []

    for num, code in extract_blocks(text):
        expected_fail = "# EXPECTED-FAIL" in code
        status, err, ns = run_block(code)
        snippet = "\n".join(code.strip().splitlines()[:3])

        if status == "syntax":
            if expected_fail:
                passed += 1
                expected_fails.append((num, f"SyntaxError: {err}"))
            else:
                failed += 1
                failures.append((num, f"SyntaxError: {err}", snippet))
        elif err is not None:
            detail = "".join(
                traceback.format_exception_only(type(err), err)
            ).strip()
            if expected_fail:
                passed += 1  # raised exactly as documented
                expected_fails.append((num, detail))
            else:
                failed += 1
                failures.append((num, detail, snippet))
        elif expected_fail:
            failed += 1
            failures.append(
                (num, "marked EXPECTED-FAIL but did not raise", snippet)
            )
        else:
            ok, msg = validate_result(ns)
            if ok:
                passed += 1
            else:
                failed += 1
                failures.append((num, msg, snippet))

    return passed, failed, failures, expected_fails


def main(argv):
    if len(argv) > 1:
        root = Path(argv[1])
    else:
        root = Path(__file__).resolve().parents[1] / "src" / "skills"
    if not root.is_dir():
        print(f"skills root not found: {root}")
        return 2

    total_passed = total_failed = 0
    broken_files = []

    for md in sorted(root.rglob("*.md")):
        passed, failed, failures, expected_fails = check_file(md)
        total_passed += passed
        total_failed += failed
        rel = md.relative_to(root)
        if failed:
            broken_files.append(rel)
            print(f"FAIL {rel}: {passed} passed, {failed} failed")
            for num, msg, snippet in failures:
                first_line = snippet.splitlines()[0] if snippet else ""
                print(f"  block {num}: {msg}")
                print(f"    | {first_line}")
        else:
            print(f"ok   {rel}: {passed} block(s)")
        for num, detail in expected_fails:
            print(f"  expected-fail block {num} raised: {detail}")

    print(
        f"\n{total_passed} passed, {total_failed} failed "
        f"across {len(broken_files)} broken file(s)"
    )
    return 1 if total_failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
