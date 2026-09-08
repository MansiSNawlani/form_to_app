import json
import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from jwt.utils import base64url_decode, base64url_encode

from app.config import get_settings
from app.security.token import (
    TokenAbgelaufen,
    TokenFehlerhaft,
    TokenSignaturUngueltig,
    erstelle_token,
    lies_token,
)


def _geheimnis() -> str:
    return get_settings().jwt_secret.get_secret_value()


def test_token_kommt_als_dieselbe_id_zurueck() -> None:
    benutzer_id = uuid.uuid4()

    assert lies_token(erstelle_token(benutzer_id)) == benutzer_id


def test_token_enthaelt_nur_id_ausstellung_und_ablauf() -> None:
    """Roles must not be in the token: they would go stale the moment one changed."""
    inhalt = jwt.decode(erstelle_token(uuid.uuid4()), _geheimnis(), algorithms=["HS256"])

    assert set(inhalt) == {"sub", "iat", "exp"}


def test_abgelaufener_token_wird_abgelehnt() -> None:
    ausgestellt = datetime.now(UTC) - timedelta(
        hours=get_settings().sitzungsdauer_stunden + 1
    )
    token = erstelle_token(uuid.uuid4(), ausgestellt_am=ausgestellt)

    with pytest.raises(TokenAbgelaufen):
        lies_token(token)


def test_token_kurz_vor_ablauf_gilt_noch() -> None:
    """The boundary in the other direction, so an expiry that is far too short fails here."""
    ausgestellt = datetime.now(UTC) - timedelta(
        hours=get_settings().sitzungsdauer_stunden, minutes=-1
    )
    benutzer_id = uuid.uuid4()

    assert lies_token(erstelle_token(benutzer_id, ausgestellt_am=ausgestellt)) == benutzer_id


def test_veraenderter_inhalt_wird_abgelehnt() -> None:
    """Rewriting the account id and keeping the original signature: exactly the
    attack the signature exists to stop.

    The content is edited rather than the signature, because the last character of
    a signature carries spare bits and changing it can decode to the same bytes.
    """
    kopf, inhalt, signatur = erstelle_token(uuid.uuid4()).split(".")
    entpackt = json.loads(base64url_decode(inhalt))
    entpackt["sub"] = str(uuid.uuid4())
    neuer_inhalt = base64url_encode(json.dumps(entpackt).encode()).decode()

    with pytest.raises(TokenSignaturUngueltig):
        lies_token(f"{kopf}.{neuer_inhalt}.{signatur}")


def test_fremdes_geheimnis_wird_abgelehnt() -> None:
    """The whole point of the signature: another secret cannot mint a session here."""
    fremd = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        "ein-vollkommen-anderes-geheimnis-mit-genug-laenge",
        algorithm="HS256",
    )

    with pytest.raises(TokenSignaturUngueltig):
        lies_token(fremd)


def test_token_ohne_benutzer_id_wird_abgelehnt() -> None:
    ohne_sub = jwt.encode(
        {"iat": datetime.now(UTC), "exp": datetime.now(UTC) + timedelta(hours=1)},
        _geheimnis(),
        algorithm="HS256",
    )

    with pytest.raises(TokenFehlerhaft):
        lies_token(ohne_sub)


def test_token_mit_unbrauchbarer_benutzer_id_wird_abgelehnt() -> None:
    keine_uuid = jwt.encode(
        {
            "sub": "kein-uuid",
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        _geheimnis(),
        algorithm="HS256",
    )

    with pytest.raises(TokenFehlerhaft):
        lies_token(keine_uuid)


@pytest.mark.parametrize("unsinn", ["", "kein-token", "a.b.c"])
def test_unsinn_wird_abgelehnt(unsinn: str) -> None:
    with pytest.raises(TokenFehlerhaft):
        lies_token(unsinn)


def test_andere_algorithmen_werden_abgelehnt() -> None:
    """The "alg: none" attack: a token that says it needs no signature at all."""
    ohne_signatur = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        key="",
        algorithm="none",
    )

    with pytest.raises((TokenSignaturUngueltig, TokenFehlerhaft)):
        lies_token(ohne_signatur)
