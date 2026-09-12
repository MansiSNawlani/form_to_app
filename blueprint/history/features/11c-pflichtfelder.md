# Proposed: what a protocol must contain before it can be submitted

> **Approved on 2026-09-12.** Written after the decision that all six parts must be complete
> before Absenden. The four open questions were answered as follows, and the list below
> stands unchanged:
>
> - **`Quelle` and `PS-Nummer` stay optional.** The PS-Nummer is not always known.
> - **`Fischereiausübungsberechtigter` stays optional**, to be confirmed with FFS.
> - **The Besatz rows stay optional**, but a row with anything in it must be complete.
> - **The Bearbeiter's postal address and telephone stay optional.** The e-mail identifies
>   them.
>
> Built as steps 9 to 14 of feature 11c.

## The problem with "every field is mandatory"

It cannot be applied as written, because roughly a third of the form is tick boxes. An
unticked box is already an answer: "no badebetrieb here" is said by leaving the badebetrieb
box alone. Requiring every box to be ticked would demand that every stretch has every
influence on it at once.

The same goes for the pairs that are alternatives. You use **either** ring anodes **or**
strip anodes. There are **two fished-area rows** and a survey may use one. So "complete"
has to mean something different depending on what kind of control the answer is given
through.

## What "complete" means, per kind of answer

| Kind of control | What completeness means |
|---|---|
| Text, dropdown, radio, date, search | An answer is there |
| Percentage inside one of the six blocks | The block totals exactly 100 |
| Percentage on its own | A number is there |
| Rating from 0 to 3 | A rating is chosen |
| Tick box in a group | **At least one box in the group is ticked**, never all of them |
| "sonstige ..., welche?" free text | Required only when its own tick is set |
| Remarks | Never required |

## Part 1 - occasion, recorder, stretch

**Already required (15):** Anlass, Regierungspräsidium, Datum, Uhrzeit, Bearbeiter Name and
E-Mail, Gewässer, Vorfluter 1, Gewässertyp, Länge, Ortsangabe, and the four coordinates.

**To add (2)**

- `probestrecke.untere` - Untere Grenze, the landmark describing the lower end
- `probestrecke.obere` - Obere Grenze, the landmark describing the upper end

These are what somebody uses to stand in the right place next year. Feature 11a left them
out and recorded the question; this answers it.

**Deliberately not required**

- The Bearbeiter's firm, street, postcode, town and telephone. The e-mail is required and is
  how the person is reached and identified.
- Vorfluter 2 to 5. The chain is as long as it is, and the existing rule already demands it
  has no gaps and ends at the Rhein or the Donau.
- `probestrecke.monitoringnummer`. Already required, conditionally, for a WRRL or FFH
  occasion. Demanding it always would block every other kind of survey.

**Two open questions for you**

- `z.quelle` (Quelle) and `z.ps_nummer` (PS-Nummer) are a dropdown and a text box in the
  occasion block. Neither is marked today and I do not know whether FFS assigns these or the
  surveyor does. If the surveyor fills them in, they should be required; if they are
  administrative, they should not.

## Part 2 - measurements and hydrology

**Already required (14):** the five measurements and the nine hydrology pickers.

**To add (1)**

- `messdaten.sichttiefe` - Sichttiefe, geschätzt. It is an estimate, so it can always be
  given.

**Deliberately not required**

- `hydrologie.breite_schaetzwert` and `tiefe_schaetzwert`. An estimate only refines the band
  already chosen above it.
- `hydrologie.furkationen`, `mit_gumpen`, `mit_flachstellen`, `rueckstroemung`. Tick boxes
  qualifying the profile; unticked means the feature is not there, which is an answer.

On a standing water the whole hydrology section is marked as not applying, which the
existing rule already handles. Nothing changes there.

## Part 3 - surroundings, bank, bed

Nothing is required today. This is the largest addition.

**To add: the six percentage blocks must each total exactly 100** (43 fields, 6 rules)

- Umland, 8 shares
- Uferneigung, 4 shares
- Uferbewuchs, 9 shares
- Uferverbauung, 8 shares
- Sohlsubstrat, 8 shares
- Sohlverbauung, 6 shares

The sum-to-100 rule already exists. Today it only fires on a block somebody has touched;
this makes touching every block compulsory.

**To add: four more**

- `ufer.randstreifen` - Randstreifen, a radio choice
- `ufer.streckenanteil_geschuetteter_damm` - the share of the stretch with a built-up dam
- `ufer.wurzeln` - the share of bank with tree roots reaching into the water
- `ufer.neigung` - the dam's slope, **but only when the dam share above is more than 0**.
  There is no slope to give where there is no dam.

**Deliberately not required**

- `gewaessersohle.kolmatierte_sohle`, `eisenocker`, `treibsand`, `faulschlamm`. Tick boxes
  for things that are either present or not.
- The two "sonstiger ..., welche?" boxes, except when their own tick is set.

## Part 4 - structures, influences, management

Nothing is required today.

**To add**

- The eight Strukturen ratings, each 0 to 3: Totholz, Wurzeln, Äste, Schilf, submerse
  Makrophyten, Schwimmblattpflanzen, emerse Makrophyten, sonstige Strukturen. A rating of 0
  means "none", so there is always an answer to give.
- Einflüsse: **at least one tick**, which may be "keine (erkennbar)" or "unbekannt". Those
  two exist precisely so the block can be answered when there is nothing to report. The
  existing contradiction rule already stops "keine" being ticked alongside a real influence.
- Bewirtschaftung: **at least one tick** among Angelfischerei, Berufsfischerei, Teichablauf
  and Teichspeisung.

**Two open questions for you**

- `bewirschaftung.fischereiausübungsberechtigter`, who holds the fishing rights. Should a
  surveyor have to know this? It is often somebody else's information.
- The four Besatz rows (species, size classes, year). Stocking history is not always known
  to the person doing the survey. My proposal is: not required, but if any one box in a row
  is filled, the whole row must be.

**Deliberately not required**

- The three "sonstige ..., welche?" boxes, except when their own tick is set.
- `bemerkungen.sonstige_bemerkungen`.

## Part 5 - equipment and fished areas

**Already required (2):** the device and its construction.

**To add**

- `ausruestung.spannung` - Spannung
- `ausruestung.leistung` - Ausgangsleistung. Feature 11a left this open; this answers it.
- `ausruestung.kathode` - Kathodentyp
- `anodenfuehrer.vorname` and `anodenfuehrer.nachname` - who led the anode
- `ausruestung.ringanoden_durchmesser` - **but only when ring anodes were used**
- For each fished-area row that has a length, **at least one direction and at least one
  method** must be ticked. A row that was not fished stays empty.

**Already covered by existing rules, left alone**

- At least one of ring or strip anodes must be given.
- At least one of the two rows must have a length, and at least one must have a width.

**Deliberately not required**

- `ausruestung.kiemennetz` and `stoppnetz`. Nets that may or may not have been used.

## Part 6 - the catch

**Already required:** the table must name at least one species, or carry one of the four
"no detection" codes. No change.

`bemerkungen.bemerkung_fische` stays optional.

## What this comes to

| Part | Required today | Proposed |
|---|---|---|
| 1 | 15 | 17 |
| 2 | 14 | 15 |
| 3 | 0 | 4 fields plus the 6 blocks (43 fields) |
| 4 | 0 | 8 ratings plus 2 group rules |
| 5 | 2 | 7 fields plus 2 conditional rules |
| 6 | the table | unchanged |

Roughly 31 enforced paths becomes roughly 90, plus about a dozen rules that are conditions
rather than plain requirements.

## What it costs to build

This is larger than a tweak. It needs, on the backend, a rewritten `vollstaendigkeit.py`
carrying conditions rather than a flat list, several new rule functions for the group and
conditional cases, and the German wording for each new message. On the browser, every newly
required field needs its asterisk so the screen and the gate agree, which is the drift that
started this. Both halves need tests.

I would expect this to be its own set of build steps rather than one diff.
