# Frontend is React with Vite, not Next.js

The repository was scaffolded with Next.js. We removed it and rebuilt the frontend as a plain
React application built by Vite, talking to a separate FastAPI service.

## Why

Next.js pays for itself through what it does on the server: server components, server actions and
server rendering. When a separate FastAPI service owns all the data and all the logic, none of
those are usable. What remains is a Node process in production whose real job is serving static
files, which a small web server does with less machinery.

Vite also matches the deployment shape the requirements already describe, where the frontend
container is "a React production build served by a minimal web server".

## Considered options

**Next.js on its own, dropping FastAPI.** This would have been a good answer and would have let
Next.js earn its keep. It was ruled out because the backend needs to be Python, which appears to be
an FFS operational constraint rather than a preference. If that turns out to be wrong, this
decision should be revisited before much is built, because the two-service split stops paying for
itself.

**Next.js frontend with a FastAPI backend.** Works, and many teams run this. Rejected because it
carries Next.js's operational cost without access to its benefits.

## Note for future readers

This is not a judgement that Vite is more modern than Next.js or the reverse. Both are current.
The decision is entirely about where the server-side logic lives.
