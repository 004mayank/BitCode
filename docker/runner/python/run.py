import json
import os
import subprocess
import sys
import time
from pathlib import Path


def main():
    """Reads a JSON payload from stdin, writes files into /work, runs python, emits logs + final result."""
    payload_text = sys.stdin.read()
    payload = json.loads(payload_text or "{}")
    files = payload.get("files") or []
    entry = payload.get("entry") or "main.py"
    timeout_ms = int(payload.get("timeoutMs") or 10_000)

    work = Path("/work")
    work.mkdir(parents=True, exist_ok=True)

    for f in files:
        p = work / f.get("path", "")
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(f.get("content", ""), encoding="utf-8")

    start = time.time()
    try:
        proc = subprocess.run(
            ["python", str(work / entry)],
            cwd=str(work),
            capture_output=True,
            text=True,
            timeout=timeout_ms / 1000,
            env={"PYTHONUNBUFFERED": "1", **os.environ},
        )
        end = time.time()
        # Stream raw stdout/stderr as logs (truncated in caller if needed)
        if proc.stdout:
            sys.stdout.write(proc.stdout)
        if proc.stderr:
            sys.stderr.write(proc.stderr)

        result = {
            "exitCode": proc.returncode,
            "stdout": proc.stdout[-20000:] if proc.stdout else "",
            "stderr": proc.stderr[-20000:] if proc.stderr else "",
            "timeMs": int((end - start) * 1000),
        }
        print("[result] " + json.dumps(result, ensure_ascii=False))
    except subprocess.TimeoutExpired as e:
        end = time.time()
        out = e.stdout or ""
        err = e.stderr or ""
        if out:
            sys.stdout.write(out)
        if err:
            sys.stderr.write(err)
        result = {
            "exitCode": 124,
            "stdout": (out[-20000:] if out else ""),
            "stderr": (err[-20000:] if err else "") + "\nTimed out",
            "timeMs": int((end - start) * 1000),
        }
        print("[result] " + json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

