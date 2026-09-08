import pytest

from app.config import GEHEIMNIS_MINDESTLAENGE, KonfigurationUngueltig, lade_settings

DATENBANK = "postgresql+asyncpg://befischung:local@localhost:5432/befischung"
GEHEIMNIS = "x" * GEHEIMNIS_MINDESTLAENGE


@pytest.fixture
def umgebung(monkeypatch: pytest.MonkeyPatch) -> None:
    """The environment alone, without whatever .env this machine happens to have."""
    for name in ("DATABASE_URL", "JWT_SECRET", "SITZUNGSDAUER_STUNDEN", "COOKIE_SECURE"):
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
