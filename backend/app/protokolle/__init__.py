"""Protocols: the drafts people fill in, and the rules about storing them.

The same shape as app/benutzer: fehler.py holds the typed refusals with no
wording in them, regeln.py holds the rules as plain functions over values, and
dienst.py does the database work. Routers under app/api stay thin and delegate
here, so every rule can be tested without an HTTP request.
"""
