"""The S3 store, against an in-process S3.

moto serves real HTTP to real botocore, so these exercise our own calls and our
own error handling rather than a stub written to agree with us. No bucket, no
credentials and no network are needed, so unlike the database tests these run
everywhere and never skip.

What is deliberately tested here is the behaviour the interface in speicher.py
promises and the places S3 does not give it for free: a missing object answering
"no" instead of raising, a refused upload leaving nothing behind, and deleting a
protocol sweeping a prefix rather than removing a directory.
"""

import uuid
from collections.abc import AsyncIterator, Iterator

import boto3
import pytest
from moto import mock_aws

from app.anlagen.speicher import SchluesselUngueltig, anlagen_schluessel
from app.anlagen.speicher_s3 import S3Speicher

BUCKET = "befischung-test"
PROTOKOLL = uuid.UUID("11111111-1111-4111-8111-111111111111")
ANLAGE = uuid.UUID("22222222-2222-4222-8222-222222222222")
ZWEITE = uuid.UUID("33333333-3333-4333-8333-333333333333")


async def bloecke(*teile: bytes) -> AsyncIterator[bytes]:
    for teil in teile:
        yield teil


@pytest.fixture
def speicher() -> Iterator[S3Speicher]:
    with mock_aws():
        boto3.client("s3", region_name="eu-central-1").create_bucket(
            Bucket=BUCKET,
            CreateBucketConfiguration={"LocationConstraint": "eu-central-1"},
        )
        yield S3Speicher(
            bucket=BUCKET,
            endpoint=None,
            region="eu-central-1",
            zugriffsschluessel="test",
            geheimschluessel="test",
        )


class TestSchreibenUndLesen:
    async def test_schreibt_und_liest_zurueck(self, speicher: S3Speicher) -> None:
        schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)

        groesse = await speicher.schreibe(schluessel, bloecke(b"abc", b"defg"))

        assert groesse == 7
        assert await speicher.lies(schluessel) == b"abcdefg"

    async def test_streamt_in_bloecken_und_ergibt_dasselbe(self, speicher: S3Speicher) -> None:
        schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)
        # Larger than one read, so the loop in bloecke() runs more than once.
        inhalt = b"x" * (700 * 1024)
        await speicher.schreibe(schluessel, bloecke(inhalt))

        gelesen = b"".join([block async for block in speicher.bloecke(schluessel)])

        assert gelesen == inhalt

    async def test_ueberschreibt_denselben_schluessel(self, speicher: S3Speicher) -> None:
        schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)
        await speicher.schreibe(schluessel, bloecke(b"alt"))

        await speicher.schreibe(schluessel, bloecke(b"neu"))

        assert await speicher.lies(schluessel) == b"neu"


class TestWasNichtDaIst:
    """The interface's second rule: a row may outlive its object, and that has to
    read as "not there" rather than as a broken server."""

    async def test_lesen_ohne_objekt_gibt_nichts_zurueck(self, speicher: S3Speicher) -> None:
        assert await speicher.lies(anlagen_schluessel(PROTOKOLL, ANLAGE)) is None

    async def test_existiert_ist_falsch_ohne_objekt(self, speicher: S3Speicher) -> None:
        assert await speicher.existiert(anlagen_schluessel(PROTOKOLL, ANLAGE)) is False

    async def test_existiert_ist_wahr_mit_objekt(self, speicher: S3Speicher) -> None:
        schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)
        await speicher.schreibe(schluessel, bloecke(b"da"))

        assert await speicher.existiert(schluessel) is True

    async def test_bloecke_ohne_objekt_ergeben_nichts(self, speicher: S3Speicher) -> None:
        """No exception: the response has already started by the time this runs,
        so there is no status code left to change."""
        schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)

        assert [block async for block in speicher.bloecke(schluessel)] == []

    async def test_loeschen_was_nicht_da_ist_ist_kein_fehler(self, speicher: S3Speicher) -> None:
        await speicher.loesche(anlagen_schluessel(PROTOKOLL, ANLAGE))


class TestEinAbbruchLaesstNichtsZurueck:
    """The interface's first rule. The caller enforces the size cap as it reads
    and raises part way through, which must not leave a half object behind."""

    async def test_ein_fehler_im_strom_schreibt_nichts(self, speicher: S3Speicher) -> None:
        schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)

        async def bricht_ab() -> AsyncIterator[bytes]:
            yield b"erst noch gut"
            raise ValueError("zu gross")

        with pytest.raises(ValueError):
            await speicher.schreibe(schluessel, bricht_ab())

        assert await speicher.existiert(schluessel) is False
        assert await speicher.lies(schluessel) is None

    async def test_ein_abbruch_laesst_ein_aelteres_objekt_in_ruhe(
        self, speicher: S3Speicher
    ) -> None:
        """A refused replacement must not take the good picture with it."""
        schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)
        await speicher.schreibe(schluessel, bloecke(b"das gute bild"))

        async def bricht_ab() -> AsyncIterator[bytes]:
            yield b"teil"
            raise ValueError("zu gross")

        with pytest.raises(ValueError):
            await speicher.schreibe(schluessel, bricht_ab())

        assert await speicher.lies(schluessel) == b"das gute bild"

    async def test_ein_fehlgeschlagener_upload_laesst_das_gute_bild_stehen(
        self, speicher: S3Speicher, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The case the stream test above does not reach, and the reason this
        store must not clean up after a failed upload the way the disk store
        does.

        Here the stream is fine and the upload itself dies, a dropped connection
        half way through replacing a photograph. S3 has not replaced anything at
        that point, so the previous photograph is still there and must stay
        there. An earlier draft deleted the key on this path and silently
        destroyed it.
        """
        schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)
        await speicher.schreibe(schluessel, bloecke(b"das gute bild"))

        def verbindung_weg(*args: object, **kwargs: object) -> None:
            raise OSError("Verbindung weg")

        monkeypatch.setattr(speicher._client, "upload_fileobj", verbindung_weg)

        with pytest.raises(OSError):
            await speicher.schreibe(schluessel, bloecke(b"der ersatz"))

        monkeypatch.undo()
        assert await speicher.lies(schluessel) == b"das gute bild"

    async def test_ein_fehlgeschlagener_erster_upload_laesst_nichts_zurueck(
        self, speicher: S3Speicher, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The same failure with no previous object: nothing may appear."""
        schluessel = anlagen_schluessel(PROTOKOLL, ANLAGE)

        def verbindung_weg(*args: object, **kwargs: object) -> None:
            raise OSError("Verbindung weg")

        monkeypatch.setattr(speicher._client, "upload_fileobj", verbindung_weg)

        with pytest.raises(OSError):
            await speicher.schreibe(schluessel, bloecke(b"nie angekommen"))

        monkeypatch.undo()
        assert await speicher.existiert(schluessel) is False


class TestEinGanzesProtokoll:
    async def test_loescht_alle_objekte_eines_protokolls(self, speicher: S3Speicher) -> None:
        eins = anlagen_schluessel(PROTOKOLL, ANLAGE)
        zwei = anlagen_schluessel(PROTOKOLL, ZWEITE)
        await speicher.schreibe(eins, bloecke(b"a"))
        await speicher.schreibe(zwei, bloecke(b"b"))

        await speicher.loesche_protokoll(PROTOKOLL)

        assert await speicher.existiert(eins) is False
        assert await speicher.existiert(zwei) is False

    async def test_laesst_ein_anderes_protokoll_in_ruhe(self, speicher: S3Speicher) -> None:
        """The sweep is scoped to the one protocol it was asked about."""
        fremd = uuid.UUID("44444444-4444-4444-8444-444444444444")
        meins = anlagen_schluessel(PROTOKOLL, ANLAGE)
        fremdes = anlagen_schluessel(fremd, ANLAGE)
        await speicher.schreibe(meins, bloecke(b"a"))
        await speicher.schreibe(fremdes, bloecke(b"b"))

        await speicher.loesche_protokoll(PROTOKOLL)

        assert await speicher.existiert(meins) is False
        assert await speicher.existiert(fremdes) is True

    async def test_ein_protokoll_ohne_anlagen_zu_loeschen_ist_kein_fehler(
        self, speicher: S3Speicher
    ) -> None:
        await speicher.loesche_protokoll(PROTOKOLL)


class TestFremderSchluessel:
    """The same guard the disk store applies. A key this application did not
    build has no business reaching the bucket."""

    @pytest.mark.parametrize(
        "schluessel",
        [
            "../../etc/passwd",
            "nicht/uuids",
            f"{PROTOKOLL}",
            f"{PROTOKOLL}/{ANLAGE}/noch-was",
            "",
        ],
    )
    async def test_wird_abgelehnt(self, speicher: S3Speicher, schluessel: str) -> None:
        with pytest.raises(SchluesselUngueltig):
            await speicher.lies(schluessel)
        with pytest.raises(SchluesselUngueltig):
            await speicher.existiert(schluessel)
        with pytest.raises(SchluesselUngueltig):
            await speicher.loesche(schluessel)
        with pytest.raises(SchluesselUngueltig):
            await speicher.schreibe(schluessel, bloecke(b"x"))


class TestAdressierung:
    """The bucket belongs in the path, not in the hostname.

    boto3 decides that for itself otherwise, and its decision varies with the
    endpoint and the bucket name. Neon's object storage accepts path style only,
    so a wrong guess here is a deployment where every upload fails.
    """

    def test_die_erzeugte_adresse_traegt_den_eimer_im_pfad(
        self, speicher: S3Speicher
    ) -> None:
        """What the client would actually request, rather than merely what it was
        configured with. Asserting on the configuration would pass even if botocore
        stopped honouring it."""
        adresse = speicher._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET, "Key": anlagen_schluessel(PROTOKOLL, ANLAGE)},
        )

        assert f"/{BUCKET}/" in adresse
        assert f"//{BUCKET}." not in adresse
