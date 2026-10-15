# Datenquellen

The open datasets the application uses, where they come from, and the credit each licence asks
for. None of them is in the repository as downloaded; what is committed is said below.

| Dataset | From | Licence | Used for | In the repository |
|---|---|---|---|---|
| basemap.de Web Vektor | BKG | CC BY 4.0 | The background map in section 1 (feature 18a) | No. The browser loads it from BKG's server |
| Amtliches Digitales Wasserwirtschaftliches Gewässernetz (AWGN), Fließgewässer and Stehende Gewässer | LUBW | CC BY 4.0 | The Gewässernetz table (feature 18b), and the Bodensee in the border file | No. Loaded with `befischung gewaessernetz laden` |
| Verwaltungsgebiete 1:250 000 (VG250), Stand 01.01. | BKG | dl-de/by-2-0 | The Baden-Württemberg border the coordinate check tests against (feature 18b) | A derived file, `database/seed/landesgrenze/landesgrenze_bw.json` |

## Credit lines

- **basemap.de:** "© basemap.de / BKG", with the licence, shown on the map itself.
- **AWGN:** "Amtliches Digitales Wasserwirtschaftliches Gewässernetz (AWGN), © LUBW, CC BY 4.0
  (https://creativecommons.org/licenses/by/4.0/)".
- **VG250:** "© GeoBasis-DE / BKG (2026), dl-de/by-2-0 (https://www.govdata.de/dl-de/by-2-0)".
  The border file is a modified work, so it carries the Veränderungshinweis the licence asks for:
  the state's areas joined with the Bodensee, widened by 2 km, simplified to 100 m and rounded to
  whole metres. The file holds both lines in its `quelle` and `veraenderung` fields.

The AWGN and VG250 credits are not yet shown anywhere a user sees them, because nothing on screen
draws either dataset yet. 18c shows AWGN names in the Gewässer search, and the credit belongs there.

## Downloads

Into `Resources/Geodaten/`, which is not in git:

- `Fliessgewaessernetz.zip` from https://rips-datenlink.lubw.de/UDO_download/Fliessgewaessernetz.zip
- `StehendeGewaesser.zip` from https://rips-datenlink.lubw.de/UDO_download/StehendeGewaesser.zip
- `vg250_01-01.utm32s.shape.ebenen.zip` from
  https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/aktuell/vg250_01-01.utm32s.shape.ebenen.zip

The metadata pages for AWGN are linked from [question 16](ffs-questions.md).
