"""Reading a filled-in Protokoll E-Befischung out of the legacy Acrobat form.

Feature 23a. Plain functions over bytes and values: no database, no HTTP, no
German wording. 23b gives them an endpoint, 23c a screen.

The mechanics of opening a form PDF live in app/formular/pdf.py, because the
extraction script and feature 23e's export need the same ones. What is here is
what makes a *filled-in* copy of that form into an answers document: which
fields carry answers, which form version the file is, and what its German dates
and numbers mean.
"""
