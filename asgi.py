"""The entrypoint for a platform that serves the whole application as one thing.

Used by the Vercel deployment and by nothing else. The Docker Compose stack runs
`uvicorn app.main:app` and serves the built frontend from its own web server, so
this file is not on that path at all.

**Why the API and the frontend share one origin.** The browser only ever sees one
address, so every request the frontend makes is same-origin and the session
cookie travels without a single line of CORS configuration. That is not a happy
accident: `frontend/src/api/client.ts` has always called relative URLs with
`credentials: "same-origin"`, and `vite.config.ts` proxies `/api` in development
for the same reason. Splitting the two across domains here would mean loosening
the cookie to SameSite=None and maintaining an allowed-origins list, which is a
larger security surface than this application has any need for.

The API routes are declared on the app in `app/main.py` before this runs, and
they win over any file of the same name. Everything else falls through to the
built frontend, with `index.html` answering addresses like
`/protokolle/<id>/abschnitt/3`, which exist only inside React Router and have no
file behind them.
"""

import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent

# The backend is installed as a package by requirements.txt, so `app` imports
# normally. This stays as a fallback for running the file straight out of a
# checkout, where nothing has been installed yet.
if str(WURZEL / "backend") not in sys.path:
    sys.path.insert(0, str(WURZEL / "backend"))

# Imported after the path is set above, which is why it is not at the top.
from app.main import app

# Relative on purpose. The platform runs with the project root as the working
# directory, which is also where this file sits, so the same string is correct
# locally and when deployed.
app.frontend("/", directory="frontend/dist", fallback="index.html")
