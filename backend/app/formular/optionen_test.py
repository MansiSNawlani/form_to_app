import json
from pathlib import Path

import pytest

from app.formular.felder import FormularDefinitionFehlt
from app.formular.optionen import lade_optionen, optionen


def schreibe(verzeichnis: Path, inhalt: object) -> Path:
    verzeichnis.mkdir(parents=True, exist_ok=True)
    pfad = verzeichnis / "optionslisten.json"
    pfad.write_text(json.dumps(inhalt, ensure_ascii=False), encoding="utf-8")
    return pfad


class TestDasEchteSeed:
    def test_liest_die_ausgelieferten_listen(self) -> None:
        geladen = optionen()
        assert geladen.version == "20260609"
        # The eight water types on the printed form. Anything else means the
        # seed was regenerated and every rule that switches on the type needs
        # rereading.
        assert geladen.werte("gewaessertyp") == frozenset(
            {"11", "12", "13", "14", "21", "26", "28", "29"}
        )

    def test_kennt_die_listen_die_regeln_brauchen(self) -> None:
        geladen = optionen()
        for name in ("anlass", "arten", "gewaessertyp"):
            assert geladen.werte(name), name

    def test_stimmt_mit_der_feldliste_ueberein(self) -> None:
        from app.formular.felder import formular

        assert optionen().version == formular().version

    def test_eine_unbekannte_liste_ist_leer(self) -> None:
        # A rule asking for a list that does not exist is our bug, but it must
        # not take the request down with a KeyError halfway through a check.
        assert optionen().werte("gibtesnicht") == frozenset()


class TestKaputteSeeds:
    def test_keine_datei(self, tmp_path: Path) -> None:
        with pytest.raises(FormularDefinitionFehlt, match="could not be opened"):
            lade_optionen(tmp_path)

    def test_kein_json(self, tmp_path: Path) -> None:
        (tmp_path / "optionslisten.json").write_text("{nicht", encoding="utf-8")
        with pytest.raises(FormularDefinitionFehlt, match="not readable JSON"):
            lade_optionen(tmp_path)

    def test_kein_objekt(self, tmp_path: Path) -> None:
        schreibe(tmp_path, [])
        with pytest.raises(FormularDefinitionFehlt, match="top level is not an object"):
            lade_optionen(tmp_path)

    def test_keine_version(self, tmp_path: Path) -> None:
        schreibe(tmp_path, {"listen": {}})
        with pytest.raises(FormularDefinitionFehlt, match="no version or no lists"):
            lade_optionen(tmp_path)

    def test_eine_liste_die_keine_liste_ist(self, tmp_path: Path) -> None:
        schreibe(tmp_path, {"version": "1", "listen": {"anlass": "wrrl"}})
        with pytest.raises(FormularDefinitionFehlt, match="anlass"):
            lade_optionen(tmp_path)

    def test_ein_eintrag_ohne_wert(self, tmp_path: Path) -> None:
        schreibe(tmp_path, {"version": "1", "listen": {"anlass": [{"label": "nur ein Text"}]}})
        with pytest.raises(FormularDefinitionFehlt, match="anlass"):
            lade_optionen(tmp_path)


class TestGeladeneListen:
    def test_ein_doppelter_wert_faellt_zusammen(self, tmp_path: Path) -> None:
        # The E-Gerät list really offers the same value under two labels, defect
        # 12, and the browser collapses it the same way. Refusing it would mean a
        # backend that cannot read the seed the frontend reads happily.
        schreibe(
            tmp_path,
            {
                "version": "1",
                "listen": {"anlass": [{"wert": "a", "label": "A"}, {"wert": "a", "label": "B"}]},
            },
        )
        assert lade_optionen(tmp_path).werte("anlass") == frozenset({"a"})

    def test_das_echte_egeraet_faellt_zusammen(self) -> None:
        # 34 entries on the printed form, 33 distinct answers. Pinned so that a
        # regenerated seed losing or gaining one is noticed here.
        assert len(optionen().werte("ausruestung.egeraet")) == 33

    def test_haelt_die_werte_nicht_die_labels(self, tmp_path: Path) -> None:
        schreibe(
            tmp_path,
            {
                "version": "1",
                "listen": {"anlass": [{"wert": "wrrl", "label": "Fischmonitoring"}]},
            },
        )
        assert lade_optionen(tmp_path).werte("anlass") == frozenset({"wrrl"})
