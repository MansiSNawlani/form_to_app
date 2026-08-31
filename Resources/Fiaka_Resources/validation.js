






function validation()
{
	var valide = false;
	var kein_fang = false;
	lb = "\r\n";
	var titel = 'Die Dateneingabe ist nicht komplett!!' + lb + lb;
	var titel2 = unescape('Daten sind nicht valide bzw. unvollst%E4ndig!');
	var fehler = '';
	if ((this.getField("bearbeiter.name").value.length < 3) || (this.getField("bearbeiter.telefon").value.length < 3) || (this.getField("bearbeiter.strasse").value.length < 3) || (this.getField("bearbeiter.plz").value.length < 3) || (this.getField("bearbeiter.email").value.length < 6)) {
		fehler = fehler + unescape('Angaben zum Bearbeiter sind nicht ausreichend!') + lb;
	}
	var anlass = this.getField("anlass").value;
	if ((anlass.indexOf("wrrl") > -1) || (anlass.indexOf("ffh") > -1)) {
			if (this.getField("probestrecke.monitoringnummer").value.length < 3) {
				fehler = fehler + unescape('Ist der Anlass eine WRRL- bzw. FFH-Monitoringfischerei, ist die Monitoringstellennummer anzugeben!') + lb;
			}
	}
	var gew = this.getField("probestrecke.gewaesser.gewaessername").value.toLowerCase();
	if ((gew.length < 3)) {
		fehler = fehler + unescape('Angaben zum Gew%E4ssername sind nicht ausreichend!') + lb;
	}
	if (((gew != "rhein") && (gew != "donau")) && (this.getField("probestrecke.gewaesser.vorfluter1").value.length < 3)) {
		fehler = fehler + unescape('Angaben zum Gew%E4sservorfluter sind nicht ausreichend!') + lb;
	}
	if ((this.getField("probestrecke.ortsangabe").value.length < 2)) {
		fehler = fehler + unescape('Angaben zum Ort sind nicht ausreichend!') + lb;
	}
	if ((this.getField("datum").value.length < 10)) {
		fehler = fehler + unescape('Angaben zum Datum sind nicht ausreichend!') + lb;
	}
	if ((this.getField("probestrecke.laenge").value.length < 1)) {
		fehler = fehler + unescape('Angaben zur Probestreckenl%E4nge sind nicht ausreichend!') + lb;
	}
	if ((this.getField("z.rp").value < 1)) {
		fehler = fehler + unescape('W%E4hlen Sie bitte das zust%E4ndige Regierungspr%E4sidium aus!') + lb;
	}
	if (this.getField("probestrecke.gewaessertyp").value == "Off") {
		fehler = fehler + unescape('Angaben zum Gew%E4ssertyp sind nicht ausreichend!') + lb;
	}
	if ((this.getField("messdaten.uhrzeit").value.length < 4)) {
		fehler = fehler + unescape('Angaben zur Uhrzeit sind nicht ausreichend!') + lb;
	}
	if ((this.getField("messdaten.regenfaelle").value == "Off")) {
		fehler = fehler + unescape('Angaben zu Regenf%E4llen sind nicht ausreichend!') + lb;
	}
	if ((this.getField("messdaten.truebung").value == "Off")) {
		fehler = fehler + unescape('Angaben zur Wassertr%FCbung sind nicht ausreichend!') + lb;
	}
	if ((this.getField("messdaten.schaumbildung").value == "Off")) {
		fehler = fehler + unescape('Angaben zur Schaumbildung sind nicht ausreichend!') + lb;
	}
	if ((this.getField("probestrecke.gewaessertyp").value < 20) || (this.getField("probestrecke.gewaessertyp").value == 31)) {
		if ((this.getField("hydrologie.breite").value == "Off")) {
			fehler = fehler + unescape('Angaben zur mittleren Breite sind nicht ausreichend!') + lb;
		}
		if ((this.getField("hydrologie.tiefe").value == "Off")) {
			fehler = fehler + unescape('Angaben zur mittleren Tiefe sind nicht ausreichend!') + lb;
		}
		if ((this.getField("hydrologie.tiefenvarianz").value == "Off")) {
			fehler = fehler + unescape('Angaben zur Tiefenvarianz sind nicht ausreichend!') + lb;
		}
		if ((this.getField("hydrologie.linienfuehrung").value == "Off")) {
			fehler = fehler + unescape('Angaben zur Linienf%FChrung sind nicht ausreichend!') + lb;
		}
		if ((this.getField("hydrologie.stroemung").value == "Off")) {
			fehler = fehler + unescape('Angaben zur StrÃ¶mung sind nicht ausreichend!') + lb;
		}
		if ((this.getField("hydrologie.fliessgeschwindigkeit").value == "Off")) {
			fehler = fehler + unescape('Angaben zur Fliessgeschwindigkeit sind nicht ausreichend!') + lb;
		}
		if ((this.getField("hydrologie.wasserfuehrung").value == "Off")) {
			fehler = fehler + unescape('Angaben zur Wasserf%FChrung sind nicht ausreichend!') + lb;
		}
		if ((this.getField("hydrologie.stillwasserbereich").value == "Off")) {
			fehler = fehler + unescape('Angaben zu Stillwasserbereichen sind nicht ausreichend!') + lb;
		}
		if ((this.getField("hydrologie.gesamtprofil").value == "Off")) {
			fehler = fehler + unescape('Angaben zum Gesamtprofil sind nicht ausreichend!') + lb;
		}
	}
	if (this.getField("check_ok_umland").hidden == true) {
		fehler = fehler + "Angaben zum Umland sind nicht komplett!" + lb;
	}
	if (this.getField("check_ok_neigung").hidden == true) {
		fehler = fehler + "Angaben zur Uferneigung sind nicht komplett!" + lb;
	}
	if (this.getField("check_ok_bewuchs").hidden == true) {
		fehler = fehler + "Angaben zum Uferbewuchs sind nicht komplett!" + lb;
	}
	if (this.getField("check_ok_uferverbau").hidden == true) {
		fehler = fehler + "Angaben zum Uferverbau sind nicht komplett!" + lb;
	}
	if (this.getField("check_ok_sohlverbau").hidden == true) {
		fehler = fehler + "Angaben zum Sohlverbau sind nicht komplett!" + lb;
	}
	if ((this.getField("ausruestung.egeraet").value.length < 2)) {
		fehler = fehler + unescape('Geben Sie bitte das E-Ger%E4t an!') + lb;
	}
	if ((this.getField("ausruestung.bauweise").value == "Off")) {
		fehler = fehler + unescape('Geben Sie bitte die Bauweise des E-Ger%E4tes an!') + lb;
	}
	if ((this.getField("ausruestung.ringanoden").value + this.getField("ausruestung.streifenanoden").value) < 1) {
		fehler = fehler + "Keine Angaben zu den eingesetzten Anoden!" + lb;
	}
	if (this.getField("arten.gesamtsumme").value == 0) {
//		app.alert(this.getField("arten.art1.name").value);
		for (var i=1;i<=26;i++) {
			if ((this.getField("arten.art"+i+".name").value == "OFAN") || (this.getField("arten.art"+i+".name").value == "OFAF") || (this.getField("arten.art"+i+".name").value == "KNKR") || (this.getField("arten.art"+i+".name").value == "KNMU")){
				kein_fang = true;
			}
		}
		if (kein_fang == false) {
			fehler = fehler + lb + lb + unescape('Wenn Sie nichts gefangen haben, w%E4hlen Sie bitte im Artenfeld entweder "kein Nachweis", "kein Nachweis, Fische", "kein Nachweis, Krebse" oder "kein Nachweis, Muscheln" aus!')+lb;
		}	
	}
	if ((this.getField("befischte_bereiche.ges_gew_laenge").value + this.getField("befischte_bereiche.ufer_laenge").value) == 0) {
		fehler = fehler + unescape("Geben Sie bitte die L%E4nge des untersuchten Bereiches an!") + lb;
	}
	if ((this.getField("befischte_bereiche.ges_gew_breite").value + this.getField("befischte_bereiche.ufer_breite").value) == 0) {
		fehler = fehler + unescape("Geben Sie bitte die Breite des untersuchten Bereiches an!") + lb;
	}
	if (fehler.length > 1) {
		app.beep(0);
		app.alert(titel + fehler,0,0,titel2);
		valide = false;
	}
	else {
		valide = true;
	}
	return valide;
}
