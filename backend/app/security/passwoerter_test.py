import pytest

from app.security.passwoerter import (
    HOECHSTLAENGE,
    MINDESTLAENGE,
    PasswortZuKurz,
    PasswortZuLang,
    braucht_neuen_hash,
    hashe_passwort,
    pruefe_passwort,
    pruefe_passwortregel,
)

GUELTIG = "ein gutes langes passwort"


def test_hash_ist_nicht_das_passwort() -> None:
    """The whole point. A stolen table must not hand over anybody's password."""
    assert hashe_passwort(GUELTIG) != GUELTIG


def test_hash_nennt_das_verfahren() -> None:
    """Argon2id specifically, not Argon2i or Argon2d.

    The variant is written into the hash string, so this catches a future change
    to a weaker one, which would otherwise be invisible.
    """
    assert hashe_passwort(GUELTIG).startswith("$argon2id$")


def test_richtiges_passwort_wird_erkannt() -> None:
    assert pruefe_passwort(GUELTIG, hashe_passwort(GUELTIG)) is True


def test_falsches_passwort_wird_abgelehnt() -> None:
    assert pruefe_passwort("ein anderes langes passwort", hashe_passwort(GUELTIG)) is False


def test_zwei_hashes_desselben_passworts_unterscheiden_sich() -> None:
    """Because each one gets its own random salt.

    Without this, two people who chose the same password would be visibly
    identical in the table, which tells an attacker where to spend their effort.
    """
    assert hashe_passwort(GUELTIG) != hashe_passwort(GUELTIG)


def test_beide_hashes_pruefen_trotzdem() -> None:
    """Different strings, both still valid for the same password."""
    for _ in range(2):
        assert pruefe_passwort(GUELTIG, hashe_passwort(GUELTIG)) is True


def test_kaputter_hash_gibt_false_statt_zu_werfen() -> None:
    """A damaged row must not turn a sign in attempt into a server error."""
    assert pruefe_passwort(GUELTIG, "nicht wirklich ein hash") is False


def test_leerer_hash_gibt_false() -> None:
    assert pruefe_passwort(GUELTIG, "") is False


def test_passwort_an_der_mindestlaenge_wird_angenommen() -> None:
    pruefe_passwortregel("a" * MINDESTLAENGE)


def test_passwort_knapp_unter_der_mindestlaenge_wird_abgelehnt() -> None:
    with pytest.raises(PasswortZuKurz):
        pruefe_passwortregel("a" * (MINDESTLAENGE - 1))


def test_hashen_erzwingt_die_regel_selbst() -> None:
    """A caller who forgets to validate gets an exception, not a weak account."""
    with pytest.raises(PasswortZuKurz):
        hashe_passwort("kurz")


def test_lange_passphrase_wird_angenommen_und_prueft() -> None:
    """Argon2 has no short ceiling of its own, unlike bcrypt, which silently
    ignores everything past 72 bytes. A real passphrase must work end to end."""
    passphrase = "korrekt pferd batterie heftklammer " * 6
    assert len(passphrase) > 200
    assert pruefe_passwort(passphrase, hashe_passwort(passphrase)) is True


def test_langes_passwort_wird_bis_zum_ende_geprueft() -> None:
    """Two passphrases identical for their first 72 bytes must not be
    interchangeable.

    This is the bcrypt trap written down as a test. bcrypt ignores everything
    past 72 bytes, so under it these two would sign in to each other's accounts
    and nobody would ever notice. Argon2 reads the whole string, and this fails
    loudly if the hashing is ever swapped for something that does not.
    """
    gemeinsam = "a" * 72
    erstes = hashe_passwort(gemeinsam + "eins")
    assert pruefe_passwort(gemeinsam + "zwei", erstes) is False


def test_passwort_an_der_hoechstlaenge_wird_angenommen() -> None:
    pruefe_passwortregel("a" * HOECHSTLAENGE)


def test_absurd_langes_passwort_wird_abgelehnt() -> None:
    """Hashing is deliberately expensive, so an unbounded input is a way to make
    the server do a lot of work on request."""
    with pytest.raises(PasswortZuLang):
        pruefe_passwortregel("a" * (HOECHSTLAENGE + 1))


def test_umlaute_zaehlen_als_ein_zeichen() -> None:
    """Measured in characters, not bytes, so an accented passphrase is not
    penalised for encoding to more bytes than it has letters."""
    passwort = "ä" * MINDESTLAENGE
    assert len(passwort.encode("utf-8")) > MINDESTLAENGE
    pruefe_passwortregel(passwort)


def test_frischer_hash_braucht_keinen_neuen() -> None:
    assert braucht_neuen_hash(hashe_passwort(GUELTIG)) is False


def test_schwaecherer_hash_braucht_einen_neuen() -> None:
    """An account hashed with weaker settings keeps them until something notices.

    Feature 2b checks this on a successful sign in, which is the only moment the
    plain password is available to make a stronger hash from.
    """
    from argon2 import PasswordHasher

    schwach = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
    assert braucht_neuen_hash(schwach.hash(GUELTIG)) is True


def test_unlesbarer_hash_braucht_einen_neuen() -> None:
    assert braucht_neuen_hash("nicht wirklich ein hash") is True
