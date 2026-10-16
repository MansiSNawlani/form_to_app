"""Which of the form's 540 fields carry an answer, and which do not.

485 do. The 55 that do not are listed here by name, in five groups, each with the
reason it is not survey data. By name rather than by a rule, because a rule
clever enough to recognise all five would also be clever enough to swallow a
real question in the next form version, and that is the one mistake this module
exists to prevent: a field silently not imported looks exactly like a field
somebody left blank.

The names come from `database/seed/form_version_20260609/felder.json`, and
`felder_test.py` checks every one of them back against it, including three
cross-checks against properties of the file rather than against this list.
"""

#: What the form's push buttons do: print it, mail it, save it, open the help.
#: Not answers, and their "values" are not values at all, but the keys of the
#: appearance stream that draws the button.
AKTIONEN = frozenset(
    {
        "drucken",
        "export",
        "saveas",
        "hilfe",
        "Button2",
        "button_server",
        "button_versenden",
    }
)

#: The picture slots. Push buttons too, holding an image as their icon rather
#: than a value, which is why the legacy form can carry photographs at all.
#: These are attachments, not answers: feature 23d reads them out into real
#: Anlagen, and until then 23b still reports that the file carries them.
BILDER = frozenset(
    {
        "fotos.kartenausschnitt_image",
        "fotos.bild1",
        "fotos.bild2",
        "fotos.bild3",
        "fotos.bild4",
    }
)

#: The red stars and green ticks the legacy form draws beside its six percentage
#: blocks. Its own working-out, kept in fields because a PDF has nowhere else to
#: keep anything. Our totals are worked out while rendering, by
#: teil3/Gruppensumme.tsx, and stored nowhere.
ANZEIGEN = frozenset(
    {
        "check_summen",
        "check_n_umland",
        "check_ok_umland",
        "check_n_neigung",
        "check_ok_neigung",
        "check_n_bewuchs",
        "check_ok_bewuchs",
        "check_n_uferverbau",
        "check_ok_uferverbau",
        "check_n_substrat",
        "check_ok_substrat",
        "check_n_sohlverbau",
        "check_ok_sohlverbau",
    }
)

#: The catch table's totals, one per row plus the grand total. Computed by the
#: form and marked read-only there. entwurf/typen.ts refuses to store one for the
#: reason it gives: a stored total can disagree with the cells it claims to add
#: up, and then there are two answers to how many fish were caught.
SUMMEN = frozenset({f"arten.art{nummer}.summe" for nummer in range(1, 27)}) | {
    "arten.gesamtsumme"
}

#: Three fields the form keeps for itself.
#:
#: version is its own version stamp, read-only, and what pruefe_formular reads
#: to say which template a file was filled in on. hydrologie_box is the
#: sentence "Angaben zur Hydrologie sind bei stehenden Gewaessern nicht
#: relevant", which the form shows and hides as the Gewaessertyp changes.
#: bemerkungen.default is ticked in the blank form and belongs to its workings;
#: no answers document in this application has ever held it.
FORMULARINTERN = frozenset({"version", "hydrologie_box", "bemerkungen.default"})

#: Everything above, and nothing else. 55 names.
KEINE_ANTWORT = AKTIONEN | BILDER | ANZEIGEN | SUMMEN | FORMULARINTERN


def ist_antwort(name: str) -> bool:
    """Whether a field of this form carries an answer worth importing.

    Everything not excluded above is an answer, rather than the other way round.
    That direction is deliberate: a field this module has never heard of is far
    more likely to be a question FFS added than a button they added, and being
    imported and then flagged by the rules is a better failure than vanishing.
    """
    return name not in KEINE_ANTWORT
