"""The HTTP surface: routers, request and response shapes, and the error handler.

Routers here stay thin, as coding-standards.md asks: parse, authorise, delegate,
return. Every rule they enforce lives in app/benutzer or app/security, which is
what lets those rules be tested without a request.
"""
