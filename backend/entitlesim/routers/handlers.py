from __future__ import annotations
from pathlib import Path
from typing import Any, Dict
from fastapi import APIRouter, Query

router = APIRouter(prefix="/handlers", tags=["handlers"])


@router.get("/source")
def get_handler_source(bug: str = Query("B2")) -> Dict[str, Any]:
    sut_path = Path(__file__).parent.parent / "engine" / "sut.py"
    if not sut_path.exists():
        return {
            "bug": bug,
            "file": "engine/sut.py",
            "start_line": 1,
            "end_line": 1,
            "source": "",
            "lines": [],
            "guard_lines": [],
        }

    content = sut_path.read_text(encoding="utf-8")
    lines = content.splitlines()

    target_idx = -1
    for i, line in enumerate(lines):
        if "ev_id in self.seen_ids" in line or ("seen_ids" in line and "in self." in line):
            target_idx = i
            break

    if target_idx != -1:
        start = max(0, target_idx - 6)
        end = min(len(lines), start + 11)
    else:
        start = 102
        end = 113

    selected_lines = lines[start:end]
    source_str = "\n".join(selected_lines)

    guard_line_indices = [
        idx + 1
        for idx, line in enumerate(selected_lines)
        if "self.fixed" in line or "seen_ids" in line or "return False" in line
    ]

    return {
        "bug": bug,
        "file": "engine/sut.py",
        "start_line": start + 1,
        "end_line": end,
        "source": source_str,
        "code": source_str,
        "lines": selected_lines,
        "guard_lines": guard_line_indices,
    }
