import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import pytest

from app.anlagen.speicher import (
    Anlagenspeicher,
    SchluesselUngueltig,
    anlagen_schluessel,
)

# No database here. This module only touches the disk, so its tests take a
# tmp_path and run whether or not Docker is up.

PROTOKOLL = uuid.UUID("11111111-1111-4111-8111-111111111111")
ANLAGE = uuid.UUID("22222222-2222-4222-8222-222222222222")


async def bloecke(*teile: bytes) -> AsyncIterator[bytes]:
    for teil in teile:
        yield teil


@pytest.fixture
def speicher(tmp_path: Path) -> Anlagenspeicher:
    return Anlagenspeicher(tmp_path)


async def test_schreibt_und_liest_zurueck(speicher: Anlagenspeicher) -> None:
    schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)

    groesse = await speicher.schreibe(schluessel, bloecke(b"abc", b"defg"))

    assert groesse == 7
    assert await speicher.lies(schluessel) == b"abcdefg"


async def test_legt_das_verzeichnis_des_protokolls_selbst_an(
    speicher: Anlagenspeicher, tmp_path: Path
) -> None:
    """Nothing creates it beforehand, so the first upload has to."""
    schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)

    await speicher.schreibe(schluessel, bloecke(b"x"))

    assert (tmp_path / str(PROTOKOLL) / str(ANLAGE)).is_file()


async def test_loescht(speicher: Anlagenspeicher) -> None:
    schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)
    await speicher.schreibe(schluessel, bloecke(b"abc"))

    await speicher.loesche(schluessel)

    assert await speicher.lies(schluessel) is None


async def test_loeschen_was_nicht_da_ist_ist_kein_fehler(speicher: Anlagenspeicher) -> None:
    """The row usually goes first, so a missing file means the work is done.

    Raising here would turn a successful delete into an error a surveyor can do
    nothing about.
    """
    await speicher.loesche(anlagen_schluessel(PROTOKOLL, ANLAGE))


async def test_lesen_ohne_datei_gibt_nichts_zurueck(speicher: Anlagenspeicher) -> None:
    """A row pointing at a missing file is a state this design admits.

    The route turns None into the same 404 an unknown attachment gets. Raising
    would make it a 500, which claims the server is broken when the honest answer
    is that the picture is gone.
    """
    assert await speicher.lies(anlagen_schluessel(PROTOKOLL, ANLAGE)) is None


async def test_loescht_alle_dateien_eines_protokolls(speicher: Anlagenspeicher) -> None:
    zweite = uuid.uuid4()
    anderes_protokoll = anlagen_schluessel(uuid.uuid4(), uuid.uuid4())
    await speicher.schreibe(anlagen_schluessel(PROTOKOLL, ANLAGE), bloecke(b"a"))
    await speicher.schreibe(anlagen_schluessel(PROTOKOLL, zweite), bloecke(b"b"))
    await speicher.schreibe(anderes_protokoll, bloecke(b"c"))

    await speicher.loesche_protokoll(PROTOKOLL)

    assert await speicher.lies(anlagen_schluessel(PROTOKOLL, ANLAGE)) is None
    assert await speicher.lies(anlagen_schluessel(PROTOKOLL, zweite)) is None
    # Only that protocol's. A delete that reached further would take somebody
    # else's survey evidence with it.
    assert await speicher.lies(anderes_protokoll) == b"c"


async def test_loeschen_eines_protokolls_ohne_dateien_ist_kein_fehler(
    speicher: Anlagenspeicher,
) -> None:
    """A protocol nobody attached anything to has no directory at all."""
    await speicher.loesche_protokoll(PROTOKOLL)


class TestSchluessel:
    """The key is built from ids we generated and from nothing in the request."""

    def test_ist_protokoll_und_anlage(self) -> None:
        assert anlagen_schluessel(PROTOKOLL, ANLAGE) == f"{PROTOKOLL}/{ANLAGE}"

    async def test_der_dateiname_kann_den_pfad_nicht_beeinflussen(
        self, speicher: Anlagenspeicher, tmp_path: Path
    ) -> None:
        """The one that matters.

        A key assembled out of a filename is how "../../boom.jpg" becomes a path
        outside the storage directory. The filename never reaches the key, so a
        file called that lands under its own id like any other and the bytes are
        the only place the name appears.
        """
        schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)

        await speicher.schreibe(schluessel, bloecke(b"../../boom.jpg"))

        assert (tmp_path / str(PROTOKOLL) / str(ANLAGE)).is_file()
        assert list(tmp_path.iterdir()) == [tmp_path / str(PROTOKOLL)]

    @pytest.mark.parametrize(
        "schluessel",
        [
            "../../etc/passwd",
            f"{PROTOKOLL}/../../etc/passwd",
            f"{PROTOKOLL}/{ANLAGE}/../..",
            "/etc/passwd",
            str(PROTOKOLL),
            f"{PROTOKOLL}/nicht-eine-uuid",
            "",
        ],
    )
    async def test_ein_fremder_schluessel_erreicht_die_platte_nicht(
        self, speicher: Anlagenspeicher, schluessel: str
    ) -> None:
        """Only the shape we produce is accepted.

        Accepting what we know beats refusing the tricks somebody thought of:
        a list of forbidden sequences is only ever as long as the last person's
        imagination.
        """
        with pytest.raises(SchluesselUngueltig):
            await speicher.lies(schluessel)
        with pytest.raises(SchluesselUngueltig):
            await speicher.loesche(schluessel)
        with pytest.raises(SchluesselUngueltig):
            await speicher.schreibe(schluessel, bloecke(b"x"))


async def test_ein_abgebrochener_upload_laesst_nichts_liegen(
    speicher: Anlagenspeicher, tmp_path: Path
) -> None:
    """The caller stops part way through: past the size cap, or a dropped request.

    A half written file is a photograph that opens as a grey band, so it goes.
    """

    async def bricht_ab() -> AsyncIterator[bytes]:
        yield b"erster block"
        raise ValueError("zu gross")

    schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)

    with pytest.raises(ValueError):
        await speicher.schreibe(schluessel, bricht_ab())

    assert await speicher.lies(schluessel) is None


async def test_ueberschreiben_laesst_keine_reste_der_alten_datei(
    speicher: Anlagenspeicher,
) -> None:
    """Nothing in the application reuses a key, since both ids are fresh per upload.

    Checked anyway because the alternative failure is silent: a shorter file
    written over a longer one would otherwise keep the old tail and still open.
    """
    schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)
    await speicher.schreibe(schluessel, bloecke(b"ein langer erster inhalt"))

    await speicher.schreibe(schluessel, bloecke(b"kurz"))

    assert await speicher.lies(schluessel) == b"kurz"
