import pytest

from app.config import GEHEIMNIS_MINDESTLAENGE, KonfigurationUngueltig, lade_settings

DATENBANK = "postgresql+asyncpg://befischung:local@localhost:5432/befischung"
GEHEIMNIS = "x" * GEHEIMNIS_MINDESTLAENGE


@pytest.fixture
def umgebung(monkeypatch: pytest.MonkeyPatch) -> None:
    """The environment alone, without whatever .env this machine happens to have."""
    for name in (
        "DATABASE_URL",
        "JWT_SECRET",
        "SITZUNGSDAUER_STUNDEN",
        "COOKIE_SECURE",
        "ANLAGEN_SPEICHER",
        "S3_BUCKET",
        "S3_ENDPOINT",
        "S3_REGION",
        "S3_ZUGRIFFSSCHLUESSEL",
        "S3_GEHEIMSCHLUESSEL",
    ):
        monkeypatch.delenv(name, raising=False)


def test_vollstaendige_umgebung_wird_akzeptiert(
    umgebung: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", DATENBANK)
    monkeypatch.setenv("JWT_SECRET", GEHEIMNIS)

    einstellungen = lade_settings(_env_file=None)

    assert einstellungen.jwt_secret.get_secret_value() == GEHEIMNIS
    assert einstellungen.sitzungsdauer_stunden == 8
    assert einstellungen.cookie_secure is True


def test_fehlendes_geheimnis_wird_abgelehnt(
    umgebung: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", DATENBANK)

    with pytest.raises(KonfigurationUngueltig) as fehler:
        lade_settings(_env_file=None)

    assert "JWT_SECRET" in str(fehler.value)
    assert "secrets.token_urlsafe" in str(fehler.value)


def test_zu_kurzes_geheimnis_wird_abgelehnt(
    umgebung: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", DATENBANK)
    monkeypatch.setenv("JWT_SECRET", "x" * (GEHEIMNIS_MINDESTLAENGE - 1))

    with pytest.raises(KonfigurationUngueltig) as fehler:
        lade_settings(_env_file=None)

    assert "JWT_SECRET" in str(fehler.value)


def test_fehlende_datenbank_wird_abgelehnt(
    umgebung: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("JWT_SECRET", GEHEIMNIS)

    with pytest.raises(KonfigurationUngueltig) as fehler:
        lade_settings(_env_file=None)

    assert "DATABASE_URL" in str(fehler.value)


def test_geheimnis_erscheint_nicht_in_der_darstellung(
    umgebung: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Printing the settings, or any model holding them, must not leak the key."""
    monkeypatch.setenv("DATABASE_URL", DATENBANK)
    monkeypatch.setenv("JWT_SECRET", GEHEIMNIS)

    einstellungen = lade_settings(_env_file=None)

    assert GEHEIMNIS not in repr(einstellungen)
    assert GEHEIMNIS not in str(einstellungen)


class TestWelcherAnlagenspeicher:
    """Choosing the object store is opt-in, and choosing it badly has to stop the
    process rather than the first upload."""

    def test_ohne_angabe_bleibt_es_das_verzeichnis(
        self, umgebung: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DATABASE_URL", DATENBANK)
        monkeypatch.setenv("JWT_SECRET", GEHEIMNIS)

        assert lade_settings(_env_file=None).anlagen_speicher == "datei"

    def test_s3_mit_allem_noetigen_wird_angenommen(
        self, umgebung: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DATABASE_URL", DATENBANK)
        monkeypatch.setenv("JWT_SECRET", GEHEIMNIS)
        monkeypatch.setenv("ANLAGEN_SPEICHER", "s3")
        monkeypatch.setenv("S3_BUCKET", "befischung-anlagen")
        monkeypatch.setenv("S3_ZUGRIFFSSCHLUESSEL", "zugriff")
        # Deliberately unlike the field name, so the assertion below is about the
        # value being masked and not about the word appearing in "s3_geheim...".
        monkeypatch.setenv("S3_GEHEIMSCHLUESSEL", "xyzzy-nicht-loggen")

        einstellungen = lade_settings(_env_file=None)

        assert einstellungen.anlagen_speicher == "s3"
        assert einstellungen.s3_bucket == "befischung-anlagen"
        # Not printed by accident, the same protection jwt_secret has.
        assert "xyzzy-nicht-loggen" not in str(einstellungen)
        assert einstellungen.s3_geheimschluessel.get_secret_value() == "xyzzy-nicht-loggen"

    @pytest.mark.parametrize(
        "fehlt", ["S3_BUCKET", "S3_ZUGRIFFSSCHLUESSEL", "S3_GEHEIMSCHLUESSEL"]
    )
    def test_s3_ohne_eine_pflichtangabe_wird_abgelehnt(
        self, umgebung: None, monkeypatch: pytest.MonkeyPatch, fehlt: str
    ) -> None:
        monkeypatch.setenv("DATABASE_URL", DATENBANK)
        monkeypatch.setenv("JWT_SECRET", GEHEIMNIS)
        monkeypatch.setenv("ANLAGEN_SPEICHER", "s3")
        for name, wert in (
            ("S3_BUCKET", "eimer"),
            ("S3_ZUGRIFFSSCHLUESSEL", "zugriff"),
            ("S3_GEHEIMSCHLUESSEL", "geheim"),
        ):
            if name != fehlt:
                monkeypatch.setenv(name, wert)

        with pytest.raises(KonfigurationUngueltig) as fehler:
            lade_settings(_env_file=None)

        # The message has to survive, not be swallowed: a rule spanning several
        # fields carries no field name for the usual lookup to find.
        assert "S3_BUCKET" in str(fehler.value)
        assert "ANLAGEN_SPEICHER" in str(fehler.value)

    def test_eine_leere_pflichtangabe_zaehlt_als_fehlend(
        self, umgebung: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A variable set to nothing is a realistic deployment mistake and must
        not read as a configured bucket named "" ."""
        monkeypatch.setenv("DATABASE_URL", DATENBANK)
        monkeypatch.setenv("JWT_SECRET", GEHEIMNIS)
        monkeypatch.setenv("ANLAGEN_SPEICHER", "s3")
        monkeypatch.setenv("S3_BUCKET", "   ")
        monkeypatch.setenv("S3_ZUGRIFFSSCHLUESSEL", "zugriff")
        monkeypatch.setenv("S3_GEHEIMSCHLUESSEL", "geheim")

        with pytest.raises(KonfigurationUngueltig):
            lade_settings(_env_file=None)

    def test_ein_unbekannter_speicher_wird_abgelehnt(
        self, umgebung: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("DATABASE_URL", DATENBANK)
        monkeypatch.setenv("JWT_SECRET", GEHEIMNIS)
        monkeypatch.setenv("ANLAGEN_SPEICHER", "blob")

        with pytest.raises(KonfigurationUngueltig) as fehler:
            lade_settings(_env_file=None)

        assert "ANLAGEN_SPEICHER" in str(fehler.value)
