import time
import uuid
from collections.abc import Sequence

import pytest
from argon2 import PasswordHasher
from sqlalchemy.ext.asyncio import AsyncSession

from app.benutzer.dienst import (
    aendere_benutzer,
    finde_nach_email,
    finde_nach_id,
    lege_benutzer_an,
    liste_benutzer,
    melde_an,
    setze_aktiv,
    setze_passwort,
    zaehle_andere_aktive_super_admins,
)
from app.benutzer.fehler import (
    AnmeldungFehlgeschlagen,
    BenutzerNichtGefunden,
    EmailBereitsVergeben,
    EmailUngueltig,
    KontoDeaktiviert,
    KontoNichtInteraktiv,
    LetzterSuperAdmin,
    RegierungspraesidiumFehlt,
    RegierungspraesidiumUnzulaessig,
    RollenLeer,
    SelbstEntzugUnzulaessig,
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


async def test_konto_wird_ueber_die_id_gefunden(session: AsyncSession) -> None:
    angelegt = await _anlegen(session)

    gefunden = await finde_nach_id(session, angelegt.id)

    assert gefunden is not None
    assert gefunden.email == "anna@ffs.de"


async def test_unbekannte_id_findet_nichts(session: AsyncSession) -> None:
    assert await finde_nach_id(session, uuid.uuid4()) is None


async def test_andere_super_admins_werden_gezaehlt(session: AsyncSession) -> None:
    eine = await _anlegen(session, "eine@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    await _anlegen(session, "zwei@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    assert await zaehle_andere_aktive_super_admins(session, ausser=eine.id) == 1


async def test_gesperrte_super_admins_zaehlen_nicht(session: AsyncSession) -> None:
    """A locked account cannot administer anything, so it cannot be the last one."""
    eine = await _anlegen(session, "eine@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    await _anlegen(session, "zwei@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    await setze_aktiv(session, "zwei@ffs.de", aktiv=False)

    assert await zaehle_andere_aktive_super_admins(session, ausser=eine.id) == 0


async def test_andere_rollen_zaehlen_nicht(session: AsyncSession) -> None:
    eine = await _anlegen(session, "eine@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    await _anlegen(session, "zwei@ffs.de", rollen=(Rolle.REVIEWER, Rolle.DATA_STEWARD))

    assert await zaehle_andere_aktive_super_admins(session, ausser=eine.id) == 0


async def test_die_rolle_neben_anderen_zaehlt_mit(session: AsyncSession) -> None:
    """Holding SUPER_ADMIN alongside another role is still holding it."""
    eine = await _anlegen(session, "eine@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    await _anlegen(session, "zwei@ffs.de", rollen=(Rolle.REVIEWER, Rolle.SUPER_ADMIN))

    assert await zaehle_andere_aktive_super_admins(session, ausser=eine.id) == 1


async def test_letzter_super_admin_kann_nicht_gesperrt_werden(session: AsyncSession) -> None:
    await _anlegen(session, "chefin@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    with pytest.raises(LetzterSuperAdmin):
        await setze_aktiv(session, "chefin@ffs.de", aktiv=False)


async def test_letzter_super_admin_bleibt_nach_der_absage_aktiv(session: AsyncSession) -> None:
    """The refusal has to leave the account alone, not half change it."""
    await _anlegen(session, "chefin@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    with pytest.raises(LetzterSuperAdmin):
        await setze_aktiv(session, "chefin@ffs.de", aktiv=False)

    konto = await finde_nach_email(session, "chefin@ffs.de")
    assert konto is not None
    assert konto.ist_aktiv


async def test_mit_einem_zweiten_super_admin_ist_sperren_erlaubt(session: AsyncSession) -> None:
    await _anlegen(session, "chefin@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    await _anlegen(session, "vertretung@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    gesperrt = await setze_aktiv(session, "chefin@ffs.de", aktiv=False)

    assert not gesperrt.ist_aktiv


async def test_ein_submitter_bleibt_sperrbar(session: AsyncSession) -> None:
    """The command line can create a database with no Super Admin at all.

    Without the first branch of pruefe_super_admin_bleibt this would be refused
    for endangering a role the account never had.
    """
    await _anlegen(session, "extern@buero.de", rollen=(Rolle.SUBMITTER,))

    gesperrt = await setze_aktiv(session, "extern@buero.de", aktiv=False)

    assert not gesperrt.ist_aktiv


async def test_ein_gesperrter_super_admin_kann_wieder_freigeschaltet_werden(
    session: AsyncSession,
) -> None:
    """Unlocking never takes an administrator away, so it is never refused."""
    await _anlegen(session, "chefin@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    await _anlegen(session, "vertretung@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    await setze_aktiv(session, "chefin@ffs.de", aktiv=False)

    wieder_da = await setze_aktiv(session, "chefin@ffs.de", aktiv=True)

    assert wieder_da.ist_aktiv


async def test_der_vorletzte_geht_der_letzte_nicht(session: AsyncSession) -> None:
    """The invariant the rule buys, stated as the sequence that tries to break it.

    Locking two Super Admins one after the other is the obvious way to end up
    with none, and it fails on the second call rather than on neither. A run of
    this suite that ever reports both calls succeeding means the rule has been
    weakened.
    """
    await _anlegen(session, "chefin@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    await _anlegen(session, "vertretung@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    await setze_aktiv(session, "chefin@ffs.de", aktiv=False)

    with pytest.raises(LetzterSuperAdmin):
        await setze_aktiv(session, "vertretung@ffs.de", aktiv=False)


async def _admin(session: AsyncSession, email: str = "chefin@ffs.de") -> User:
    """The account making the changes, which aendere_benutzer always needs."""
    return await _anlegen(session, email, rollen=(Rolle.SUPER_ADMIN,))


async def test_rollen_werden_geaendert(session: AsyncSession) -> None:
    admin = await _admin(session)
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    geaendert = await aendere_benutzer(
        session, konto, handelnder=admin, rollen=[Rolle.REVIEWER, Rolle.DATA_STEWARD]
    )

    assert geaendert.rollen == [Rolle.REVIEWER, Rolle.DATA_STEWARD]


async def test_nicht_genannte_felder_bleiben_wie_sie_waren(session: AsyncSession) -> None:
    admin = await _admin(session)
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    geaendert = await aendere_benutzer(session, konto, handelnder=admin, locale=Locale.EN)

    assert geaendert.locale == Locale.EN
    assert geaendert.email == "anna@ffs.de"
    assert geaendert.rollen == [Rolle.SUBMITTER]
    assert geaendert.ist_aktiv


async def test_eine_aenderung_ohne_angaben_aendert_nichts(session: AsyncSession) -> None:
    """An empty change is not an error.

    The screen sends what was edited, and editing nothing is something somebody
    can do.
    """
    admin = await _admin(session)
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    geaendert = await aendere_benutzer(session, konto, handelnder=admin)

    assert geaendert.email == "anna@ffs.de"
    assert geaendert.rollen == [Rolle.SUBMITTER]


async def test_die_adresse_wird_geaendert_und_das_konto_bleibt_dasselbe(
    session: AsyncSession,
) -> None:
    """The reason the endpoints work by id.

    A corrected typo must not create a second account, or every protocol the
    first one filed loses its owner.
    """
    admin = await _admin(session)
    konto = await _anlegen(session, "anna.bergman@ffs.de", rollen=(Rolle.SUBMITTER,))
    vorher = konto.id

    geaendert = await aendere_benutzer(
        session, konto, handelnder=admin, email="Anna.Bergmann@FFS.de"
    )

    assert geaendert.id == vorher
    assert geaendert.email == "anna.bergmann@ffs.de"


async def test_eine_bereits_vergebene_adresse_wird_abgelehnt(session: AsyncSession) -> None:
    admin = await _admin(session)
    await _anlegen(session, "belegt@ffs.de", rollen=(Rolle.SUBMITTER,))
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    with pytest.raises(EmailBereitsVergeben):
        await aendere_benutzer(session, konto, handelnder=admin, email="belegt@ffs.de")


async def test_die_eigene_adresse_noch_einmal_zu_setzen_ist_erlaubt(
    session: AsyncSession,
) -> None:
    """Otherwise a screen that sends every field back would refuse every edit."""
    admin = await _admin(session)
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    geaendert = await aendere_benutzer(session, konto, handelnder=admin, email="anna@ffs.de")

    assert geaendert.email == "anna@ffs.de"


async def test_ungueltige_adresse_wird_abgelehnt(session: AsyncSession) -> None:
    admin = await _admin(session)
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    with pytest.raises(EmailUngueltig):
        await aendere_benutzer(session, konto, handelnder=admin, email="anna")


async def test_leere_rollen_werden_abgelehnt(session: AsyncSession) -> None:
    admin = await _admin(session)
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    with pytest.raises(RollenLeer):
        await aendere_benutzer(session, konto, handelnder=admin, rollen=[])


async def test_regionale_rolle_und_nummer_kommen_zusammen(session: AsyncSession) -> None:
    admin = await _admin(session)
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    geaendert = await aendere_benutzer(
        session,
        konto,
        handelnder=admin,
        rollen=[Rolle.REGIERUNGSPRAESIDIUM],
        regierungspraesidium=4,
    )

    assert geaendert.regierungspraesidium == 4


async def test_regionale_rolle_ohne_nummer_wird_abgelehnt(session: AsyncSession) -> None:
    admin = await _admin(session)
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    with pytest.raises(RegierungspraesidiumFehlt):
        await aendere_benutzer(
            session, konto, handelnder=admin, rollen=[Rolle.REGIERUNGSPRAESIDIUM]
        )


async def test_die_nummer_wird_mit_der_rolle_zusammen_entfernt(session: AsyncSession) -> None:
    """Both in one call, which is what 16d's screen sends."""
    admin = await _admin(session)
    konto = await _anlegen(
        session, "rp@ffs.de", rollen=(Rolle.REGIERUNGSPRAESIDIUM,), regierungspraesidium=2
    )

    geaendert = await aendere_benutzer(
        session,
        konto,
        handelnder=admin,
        rollen=[Rolle.SUBMITTER],
        regierungspraesidium=None,
    )

    assert geaendert.rollen == [Rolle.SUBMITTER]
    assert geaendert.regierungspraesidium is None


async def test_eine_uebrig_gebliebene_nummer_wird_abgelehnt(session: AsyncSession) -> None:
    """Taking the regional role away without clearing its number is refused.

    Dropping the number quietly would be the service deciding what somebody
    meant, and that number is what scopes everything the account can see.
    """
    admin = await _admin(session)
    konto = await _anlegen(
        session, "rp@ffs.de", rollen=(Rolle.REGIERUNGSPRAESIDIUM,), regierungspraesidium=2
    )

    with pytest.raises(RegierungspraesidiumUnzulaessig):
        await aendere_benutzer(session, konto, handelnder=admin, rollen=[Rolle.SUBMITTER])


async def test_ein_konto_wird_ueber_die_aenderung_gesperrt(session: AsyncSession) -> None:
    admin = await _admin(session)
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    geaendert = await aendere_benutzer(session, konto, handelnder=admin, ist_aktiv=False)

    assert not geaendert.ist_aktiv


async def test_der_letzte_super_admin_kann_sich_nicht_selbst_entmachten(
    session: AsyncSession,
) -> None:
    """Both safety rules apply here, and the more useful message has to win.

    "Create a second one first" is something the only administrator can act on.
    "Ask another Super Admin" names somebody who does not exist.
    """
    admin = await _admin(session)

    with pytest.raises(LetzterSuperAdmin):
        await aendere_benutzer(session, admin, handelnder=admin, rollen=[Rolle.SUBMITTER])


async def test_ein_fremder_letzter_super_admin_wird_ebenso_geschuetzt(
    session: AsyncSession,
) -> None:
    admin = await _admin(session)
    andere = await _anlegen(session, "zweite@ffs.de", rollen=(Rolle.SUPER_ADMIN,))
    await setze_aktiv(session, "zweite@ffs.de", aktiv=False)

    with pytest.raises(LetzterSuperAdmin):
        await aendere_benutzer(session, admin, handelnder=andere, rollen=[Rolle.SUBMITTER])


async def test_niemand_gibt_die_eigene_super_admin_rolle_ab(session: AsyncSession) -> None:
    admin = await _admin(session)
    await _anlegen(session, "vertretung@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    with pytest.raises(SelbstEntzugUnzulaessig):
        await aendere_benutzer(session, admin, handelnder=admin, rollen=[Rolle.REVIEWER])


async def test_niemand_sperrt_das_eigene_konto(session: AsyncSession) -> None:
    admin = await _admin(session)
    await _anlegen(session, "vertretung@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    with pytest.raises(SelbstEntzugUnzulaessig):
        await aendere_benutzer(session, admin, handelnder=admin, ist_aktiv=False)


async def test_am_eigenen_konto_bleibt_alles_andere_aenderbar(session: AsyncSession) -> None:
    admin = await _admin(session)

    geaendert = await aendere_benutzer(
        session, admin, handelnder=admin, email="neue.chefin@ffs.de", locale=Locale.EN
    )

    assert geaendert.email == "neue.chefin@ffs.de"
    assert geaendert.locale == Locale.EN


async def test_eine_vertretung_darf_den_super_admin_entmachten(session: AsyncSession) -> None:
    """A handover is somebody else's action, which is what both refusals point at."""
    admin = await _admin(session)
    vertretung = await _anlegen(session, "vertretung@ffs.de", rollen=(Rolle.SUPER_ADMIN,))

    geaendert = await aendere_benutzer(
        session, admin, handelnder=vertretung, rollen=[Rolle.REVIEWER]
    )

    assert geaendert.rollen == [Rolle.REVIEWER]


async def test_eine_abgelehnte_aenderung_laesst_die_zeile_unberuehrt(
    session: AsyncSession,
) -> None:
    admin = await _admin(session)
    await _anlegen(session, "belegt@ffs.de", rollen=(Rolle.SUBMITTER,))
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))

    with pytest.raises(EmailBereitsVergeben):
        await aendere_benutzer(
            session, konto, handelnder=admin, email="belegt@ffs.de", locale=Locale.EN
        )

    await session.rollback()
    unveraendert = await finde_nach_email(session, "anna@ffs.de")
    assert unveraendert is not None
    assert unveraendert.locale == Locale.DE


async def test_ein_neues_passwort_ersetzt_das_alte(session: AsyncSession) -> None:
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))
    alter_hash = konto.password_hash

    geaendert = await setze_passwort(session, konto, passwort="ein anderes langes passwort")

    assert geaendert.password_hash != alter_hash
    assert pruefe_passwort("ein anderes langes passwort", geaendert.password_hash)
    assert not pruefe_passwort(PASSWORT, geaendert.password_hash)


async def test_ein_zu_kurzes_passwort_laesst_das_alte_stehen(session: AsyncSession) -> None:
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))
    alter_hash = konto.password_hash

    with pytest.raises(PasswortZuKurz):
        await setze_passwort(session, konto, passwort="kurz")

    assert konto.password_hash == alter_hash
    assert pruefe_passwort(PASSWORT, konto.password_hash)


async def test_nach_dem_zuruecksetzen_meldet_sich_das_konto_neu_an(
    session: AsyncSession,
) -> None:
    konto = await _anlegen(session, "anna@ffs.de", rollen=(Rolle.SUBMITTER,))
    await setze_passwort(session, konto, passwort="ein anderes langes passwort")

    angemeldet = await melde_an(
        session, email="anna@ffs.de", passwort="ein anderes langes passwort"
    )
    assert angemeldet.id == konto.id

    with pytest.raises(AnmeldungFehlgeschlagen):
        await melde_an(session, email="anna@ffs.de", passwort=PASSWORT)
