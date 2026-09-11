"""Deciding which Gewaesser, Probestrecke and Person a submitted protocol names.

Two halves, kept apart on purpose. regeln.py reads the answers document into
typed values and needs no database to be tested. dienst.py takes those values and
finds or creates the rows.

The rule both halves are built around, decided on 2026-09-11: **the matching
reads an existing record or creates a new one, and never updates one.** A
protocol is an official survey record on its way to FiaKa, so anything an
accepted one points at has to be as fixed as the protocol itself. The cost is
duplicates, paid deliberately, and feature 18 is where merging them can be done
correctly with the official water body dataset behind it.
"""
