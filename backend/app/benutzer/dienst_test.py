import time
from collections.abc import Sequence

import pytest
from argon2 import PasswordHasher
from sqlalchemy.ext.asyncio import AsyncSession

from app.benutzer.dienst import (
    finde_nach_email,
    lege_benutzer_an,
    liste_benutzer,
    melde_an,
    setze_aktiv,
)
from app.benutzer.fehler import (
    AnmeldungFehlgeschlagen,
    BenutzerNichtGefunden,
    EmailBereitsVergeben,
    EmailUngueltig,
    KontoDeaktiviert,
    KontoNichtInteraktiv,
    RegierungspraesidiumFehlt,
    RegierungspraesidiumUnzulaessig,
    RollenLeer,
)
from app.models.benutzer import Locale, Rolle, User
from app.security.passwoerter import PasswortZuKurz, braucht_neuen_hash, pruefe_passwort

PASSWORT = "ein gutes langes passwort"


async def _anlegen(
    session: AsyncSession,
    email: str = "anna@ffs.de",
    passwort: str = PASSWORT,
    rollen: Sequence[Rolle] = (Rolle.SUBMITTER,),
    regierungspraesidium: int | None = None,
) -> User:
    """The defaults every test starts from, so each one states only its own case."""
    return await lege_benutzer_an(
        session,
        email=email,
        passwort=passwort,
        rollen=rollen,
        regierungspraesidium=regierungspraesidium,
    )


async def test_konto_wird_angelegt_und_ist_wiederauffindbar(session: AsyncSession) -> None:
    angelegt = await _anlegen(session)
    gefunden = await finde_nach_email(session, "anna@ffs.de")
    assert gefunden is not None
    assert gefunden.id == angelegt.id


async def test_rollen_kommen_als_rolle_zurueck_nicht_als_text(session: AsyncSession) -> None:
    """The point of the TypeDecorator on the model.

    Every permission check in features 2b, 11, 12, 13 and 16 reads this, and a
    bare string would compare against a literal that nothing checks for typos.
    """
    await _anlegen(session, rollen=[Rolle.REVIEWER, Rolle.DATA_STEWARD])
    gefunden = await finde_nach_email(session, "anna@ffs.de")
    assert gefunden is not None
    assert gefunden.rollen == [Rolle.REVIEWER, Rolle.DATA_STEWARD]
    assert all(isinstance(rolle, Rolle) for rolle in gefunden.rollen)


async def test_passwort_wird_gehasht_gespeichert(session: AsyncSession) -> None:
    benutzer = await _anlegen(session)
    assert benutzer.password_hash != PASSWORT
    assert benutzer.password_hash.startswith("$argon2id$")
    assert pruefe_passwort(PASSWORT, benutzer.password_hash) is True


async def test_falsches_passwort_prueft_nicht(session: AsyncSession) -> None:
    benutzer = await _anlegen(session)
    assert pruefe_passwort("ein anderes langes passwort", benutzer.password_hash) is False


async def test_neues_konto_ist_aktiv_und_deutsch(session: AsyncSession) -> None:
    benutzer = await _anlegen(session)
    assert benutzer.ist_aktiv is True
    assert benutzer.locale == Locale.DE


async def test_zeitstempel_werden_gesetzt(session: AsyncSession) -> None:
    benutzer = await _anlegen(session)
    assert benutzer.created_at is not None
    # Timezone aware, so the first time a server and a user sit in different
    # zones the timestamp still means one moment rather than two.
    assert benutzer.created_at.tzinfo is not None


async def test_doppelte_email_wird_abgelehnt(session: AsyncSession) -> None:
    await _anlegen(session)
    with pytest.raises(EmailBereitsVergeben):
        await _anlegen(session)


async def test_email_nur_anders_geschrieben_gilt_als_doppelt(session: AsyncSession) -> None:
    """One person, one account, whatever they capitalised on the day."""
    await _anlegen(session, email="anna@ffs.de")
    with pytest.raises(EmailBereitsVergeben):
        await _anlegen(session, email="Anna@FFS.de")


async def test_doppelte_email_nennt_die_adresse(session: AsyncSession) -> None:
    """The command line prints this back, so it has to carry the address."""
    await _anlegen(session)
    with pytest.raises(EmailBereitsVergeben) as fehler:
        await _anlegen(session, email="ANNA@ffs.de")
    assert fehler.value.email == "anna@ffs.de"


async def test_konto_wird_unter_jeder_schreibweise_gefunden(session: AsyncSession) -> None:
    await _anlegen(session, email="anna@ffs.de")
    assert await finde_nach_email(session, "  ANNA@FFS.de ") is not None


async def test_unbekannte_email_findet_nichts(session: AsyncSession) -> None:
    assert await finde_nach_email(session, "niemand@ffs.de") is None


async def test_regionales_konto_ohne_nummer_wird_abgelehnt(session: AsyncSession) -> None:
    with pytest.raises(RegierungspraesidiumFehlt):
        await _anlegen(session, rollen=[Rolle.REGIERUNGSPRAESIDIUM])


async def test_regionales_konto_mit_nummer_wird_angelegt(session: AsyncSession) -> None:
    benutzer = await _anlegen(
        session, rollen=[Rolle.REGIERUNGSPRAESIDIUM], regierungspraesidium=4
    )
    assert benutzer.regierungspraesidium == 4


async def test_submitter_mit_nummer_wird_abgelehnt(session: AsyncSession) -> None:
    with pytest.raises(RegierungspraesidiumUnzulaessig):
        await _anlegen(session, regierungspraesidium=2)


async def test_ohne_rollen_wird_abgelehnt(session: AsyncSession) -> None:
    with pytest.raises(RollenLeer):
        await _anlegen(session, rollen=[])


async def test_kurzes_passwort_wird_abgelehnt(session: AsyncSession) -> None:
    with pytest.raises(PasswortZuKurz):
        await _anlegen(session, passwort="kurz")


async def test_ungueltige_email_wird_abgelehnt(session: AsyncSession) -> None:
    with pytest.raises(EmailUngueltig):
        await _anlegen(session, email="anna")


async def test_abgelehntes_konto_hinterlaesst_nichts(session: AsyncSession) -> None:
    """Everything is checked before anything is written, so a refusal is clean."""
    with pytest.raises(PasswortZuKurz):
        await _anlegen(session, passwort="kurz")
    assert await liste_benutzer(session) == []


async def test_konto_wird_deaktiviert_und_wieder_aktiviert(session: AsyncSession) -> None:
    await _anlegen(session)

    deaktiviert = await setze_aktiv(session, "anna@ffs.de", aktiv=False)
    assert deaktiviert.ist_aktiv is False

    aktiviert = await setze_aktiv(session, "anna@ffs.de", aktiv=True)
    assert aktiviert.ist_aktiv is True


async def test_deaktivieren_ueberlebt_das_neuladen(session: AsyncSession) -> None:
    """Written, not merely set on an object still in memory."""
    await _anlegen(session)
    await setze_aktiv(session, "anna@ffs.de", aktiv=False)

    session.expunge_all()
    frisch = await finde_nach_email(session, "anna@ffs.de")
    assert frisch is not None
    assert frisch.ist_aktiv is False


async def test_deaktivieren_eines_unbekannten_kontos_wird_gemeldet(session: AsyncSession) -> None:
    with pytest.raises(BenutzerNichtGefunden):
        await setze_aktiv(session, "niemand@ffs.de", aktiv=False)


async def test_liste_ist_leer_wenn_es_keine_konten_gibt(session: AsyncSession) -> None:
    assert await liste_benutzer(session) == []


async def test_liste_ist_nach_email_sortiert(session: AsyncSession) -> None:
    """A stable order, so two runs of the listing command can be compared."""
    for email in ["carla@ffs.de", "anna@ffs.de", "bernd@ffs.de"]:
        await _anlegen(session, email=email)

    assert [benutzer.email for benutzer in await liste_benutzer(session)] == [
        "anna@ffs.de",
        "bernd@ffs.de",
        "carla@ffs.de",
    ]


async def test_liste_bleibt_sortiert_nach_einer_aenderung(session: AsyncSession) -> None:
    """Postgres is free to move an updated row, which is what an unordered
    listing would show."""
    for email in ["anna@ffs.de", "bernd@ffs.de"]:
        await _anlegen(session, email=email)
    await setze_aktiv(session, "anna@ffs.de", aktiv=False)

    assert [benutzer.email for benutzer in await liste_benutzer(session)] == [
        "anna@ffs.de",
        "bernd@ffs.de",
    ]


async def test_hash_steht_nicht_im_repr(session: AsyncSession) -> None:
    """A repr reaches logs and test failure output. The hash must reach neither."""
    benutzer = await _anlegen(session)
    assert benutzer.password_hash not in repr(benutzer)
    assert "anna@ffs.de" in repr(benutzer)


async def test_anmeldung_mit_richtigem_passwort_gibt_das_konto(session: AsyncSession) -> None:
    angelegt = await _anlegen(session)

    angemeldet = await melde_an(session, email="anna@ffs.de", passwort=PASSWORT)

    assert angemeldet.id == angelegt.id


async def test_anmeldung_akzeptiert_andere_grossschreibung(session: AsyncSession) -> None:
    """The address is the login identifier and it is stored lower case, so
    somebody typing their own name with a capital must still get in."""
    await _anlegen(session)

    angemeldet = await melde_an(session, email="Anna@FFS.de", passwort=PASSWORT)

    assert angemeldet.email == "anna@ffs.de"


async def test_falsches_passwort_wird_abgewiesen(session: AsyncSession) -> None:
    await _anlegen(session)

    with pytest.raises(AnmeldungFehlgeschlagen):
        await melde_an(session, email="anna@ffs.de", passwort="etwas ganz anderes")


async def test_unbekannte_adresse_wird_genauso_abgewiesen(session: AsyncSession) -> None:
    """Deliberately the same error as a wrong password.

    Two different answers would turn the login page into a way of finding out who
    holds an account here.
    """
    with pytest.raises(AnmeldungFehlgeschlagen):
        await melde_an(session, email="niemand@ffs.de", passwort=PASSWORT)


async def test_unbekannte_adresse_kostet_so_viel_wie_ein_falsches_passwort(
    session: AsyncSession,
) -> None:
    """The identical message is not enough on its own: an answer that comes back
    instantly says "no such account" just as loudly as a different message would.

    Compared against the other refusal rather than against a fixed number of
    milliseconds, because the claim is that the two are alike, not that either is
    slow."""
    await _anlegen(session)

    async def dauer(email: str) -> float:
        beginn = time.perf_counter()
        with pytest.raises(AnmeldungFehlgeschlagen):
            await melde_an(session, email=email, passwort="etwas ganz anderes")
        return time.perf_counter() - beginn

    unbekannte_adresse = await dauer("niemand@ffs.de")
    falsches_passwort = await dauer("anna@ffs.de")

    # A wide margin on purpose. Both paths do one Argon2 verify, so they are
    # inherently comparable, and a loaded machine can stall either of them. What
    # this catches is not a slow answer but an instant one, which is what leaving
    # the blind hash out would produce.
    assert unbekannte_adresse > falsches_passwort / 3


async def test_deaktiviertes_konto_wird_abgewiesen(session: AsyncSession) -> None:
    await _anlegen(session)
    await setze_aktiv(session, "anna@ffs.de", aktiv=False)

    with pytest.raises(KontoDeaktiviert):
        await melde_an(session, email="anna@ffs.de", passwort=PASSWORT)


async def test_deaktiviertes_konto_verraet_sich_nicht_bei_falschem_passwort(
    session: AsyncSession,
) -> None:
    """The password is checked first on purpose. Otherwise "this account is
    deactivated" would confirm the address to somebody who does not have the
    password."""
    await _anlegen(session)
    await setze_aktiv(session, "anna@ffs.de", aktiv=False)

    with pytest.raises(AnmeldungFehlgeschlagen):
        await melde_an(session, email="anna@ffs.de", passwort="etwas ganz anderes")


async def test_integrationskonto_darf_sich_nicht_anmelden(session: AsyncSession) -> None:
    """project-overview.md makes that role machine only, with no interactive login."""
    await _anlegen(session, email="fiaka@ffs.de", rollen=[Rolle.INTEGRATION])

    with pytest.raises(KontoNichtInteraktiv):
        await melde_an(session, email="fiaka@ffs.de", passwort=PASSWORT)


async def test_schwacher_hash_wird_bei_der_anmeldung_erneuert(session: AsyncSession) -> None:
    """A stored hash keeps the settings it was made with forever, and a successful
    sign in is the only moment the plain password exists to make a stronger one."""
    benutzer = await _anlegen(session)
    schwach = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash(PASSWORT)
    benutzer.password_hash = schwach
    await session.commit()

    angemeldet = await melde_an(session, email="anna@ffs.de", passwort=PASSWORT)

    assert angemeldet.password_hash != schwach
    assert pruefe_passwort(PASSWORT, angemeldet.password_hash)
    assert not braucht_neuen_hash(angemeldet.password_hash)


async def test_starker_hash_bleibt_bei_der_anmeldung_unveraendert(session: AsyncSession) -> None:
    """Rehashing every sign in would write to the table on every request."""
    benutzer = await _anlegen(session)
    vorher = benutzer.password_hash

    angemeldet = await melde_an(session, email="anna@ffs.de", passwort=PASSWORT)

    assert angemeldet.password_hash == vorher


async def test_unbrauchbare_adresse_wird_wie_ein_falsches_passwort_behandelt(
    session: AsyncSession,
) -> None:
    """Not a validation error. A different answer for "not an address at all"
    would be one more thing the login page tells somebody probing it."""
    with pytest.raises(AnmeldungFehlgeschlagen):
        await melde_an(session, email="keine adresse", passwort=PASSWORT)
