import sys
from pathlib import Path

if __package__ in (None, ""):
    current_file = Path(__file__).resolve()
    sys.path.insert(0, str(current_file.parents[1]))
    from commit_history_uv.core import main
else:
    from .core import main


if __name__ == "__main__":
    raise SystemExit(main())
