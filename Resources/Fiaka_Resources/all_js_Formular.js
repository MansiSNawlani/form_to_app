//-------------------------------------------------------------
//-----------------Bearbeite die XML-Tags nicht--------------------
//-------------------------------------------------------------

//<Document-Level>
//<ACRO_source>validation</ACRO_source>
//<ACRO_script>
/*********** gehört zu: Document-Level:validation ***********/







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
//</ACRO_script>
//</Document-Level>

//<Document-Actions>
//<ACRO_source>Speichert Dokument </ACRO_source>
//<ACRO_script>
/*********** gehört zu: Document-Actions:Speichert Dokument  ***********/







var message = '';
lb = "\r\n";
if (this.validation() == false) { 
	message = unescape("Zumindest ein Teil der Pflichtfelder ist nicht eingegeben worden!") + lb;
	message = message + unescape("Das Formular wird nachfolgend unvollst%E4ndig abgespeichert und muss") + lb;
	message = message + unescape("vor Abgabe an das Regierungspr%E4sidium bzw. die FFS komplettiert werden!") + lb;
	app.alert(message,2,0,unescape('Das Formular ist unvollst%E4ndig!')); 
}
//</ACRO_script>
//</Document-Actions>

//<AcroForm>
//<ACRO_source>Button2:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:Button2:Annot1:MouseUp:Action1 ***********/







this.exportAsXFDF({aFields: ["anlass","bearbeiter"]});
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art1.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art1.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art1.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art1.0plus").display = display.visible;
  this.getField("arten.art1.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art1.klasse_"+i).display = display.hidden;
    this.getField("arten.art1.klasse_"+i).value = '';
  }
  this.getField("arten.art1.0plus").display = display.hidden;
  this.getField("arten.art1.0plus").value = '';
}

//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art10.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art10.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art10.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art10.0plus").display = display.visible;
  this.getField("arten.art10.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art10.klasse_"+i).display = display.hidden;
    this.getField("arten.art10.klasse_"+i).value = '';
  }
  this.getField("arten.art10.0plus").display = display.hidden;
  this.getField("arten.art10.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art11.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art11.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art11.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art11.0plus").display = display.visible;
  this.getField("arten.art11.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art11.klasse_"+i).display = display.hidden;
    this.getField("arten.art11.klasse_"+i).value = '';
  }
  this.getField("arten.art11.0plus").display = display.hidden;
  this.getField("arten.art11.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art12.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art12.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art12.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art12.0plus").display = display.visible;
  this.getField("arten.art12.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art12.klasse_"+i).display = display.hidden;
    this.getField("arten.art12.klasse_"+i).value = '';
  }
  this.getField("arten.art12.0plus").display = display.hidden;
  this.getField("arten.art12.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art13.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art13.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art13.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art13.0plus").display = display.visible;
  this.getField("arten.art13.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art13.klasse_"+i).display = display.hidden;
    this.getField("arten.art13.klasse_"+i).value = '';
  }
  this.getField("arten.art13.0plus").display = display.hidden;
  this.getField("arten.art13.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art14.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art14.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art14.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art14.0plus").display = display.visible;
  this.getField("arten.art14.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art14.klasse_"+i).display = display.hidden;
    this.getField("arten.art14.klasse_"+i).value = '';
  }
  this.getField("arten.art14.0plus").display = display.hidden;
  this.getField("arten.art14.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art15.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art15.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art15.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art15.0plus").display = display.visible;
  this.getField("arten.art15.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art15.klasse_"+i).display = display.hidden;
    this.getField("arten.art15.klasse_"+i).value = '';
  }
  this.getField("arten.art15.0plus").display = display.hidden;
  this.getField("arten.art15.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art16.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art16.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art16.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art16.0plus").display = display.visible;
  this.getField("arten.art16.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art16.klasse_"+i).display = display.hidden;
    this.getField("arten.art16.klasse_"+i).value = '';
  }
  this.getField("arten.art16.0plus").display = display.hidden;
  this.getField("arten.art16.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art17.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art17.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art17.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art17.0plus").display = display.visible;
  this.getField("arten.art17.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art17.klasse_"+i).display = display.hidden;
    this.getField("arten.art17.klasse_"+i).value = '';
  }
  this.getField("arten.art17.0plus").display = display.hidden;
  this.getField("arten.art17.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art18.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art18.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art18.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art18.0plus").display = display.visible;
  this.getField("arten.art18.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art18.klasse_"+i).display = display.hidden;
    this.getField("arten.art18.klasse_"+i).value = '';
  }
  this.getField("arten.art18.0plus").display = display.hidden;
  this.getField("arten.art18.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art19.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art19.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art19.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art19.0plus").display = display.visible;
  this.getField("arten.art19.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art19.klasse_"+i).display = display.hidden;
    this.getField("arten.art19.klasse_"+i).value = '';
  }
  this.getField("arten.art19.0plus").display = display.hidden;
  this.getField("arten.art19.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art2.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art2.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art2.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art2.0plus").display = display.visible;
  this.getField("arten.art2.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art2.klasse_"+i).display = display.hidden;
    this.getField("arten.art2.klasse_"+i).value = '';
  }
  this.getField("arten.art2.0plus").display = display.hidden;
  this.getField("arten.art2.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art20.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art20.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art20.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art20.0plus").display = display.visible;
  this.getField("arten.art20.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art20.klasse_"+i).display = display.hidden;
    this.getField("arten.art20.klasse_"+i).value = '';
  }
  this.getField("arten.art20.0plus").display = display.hidden;
  this.getField("arten.art20.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art21.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art21.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art21.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art21.0plus").display = display.visible;
  this.getField("arten.art21.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art21.klasse_"+i).display = display.hidden;
    this.getField("arten.art21.klasse_"+i).value = '';
  }
  this.getField("arten.art21.0plus").display = display.hidden;
  this.getField("arten.art21.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art22.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art22.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art22.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art22.0plus").display = display.visible;
  this.getField("arten.art22.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art22.klasse_"+i).display = display.hidden;
    this.getField("arten.art22.klasse_"+i).value = '';
  }
  this.getField("arten.art22.0plus").display = display.hidden;
  this.getField("arten.art22.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art23.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art23.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art23.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art23.0plus").display = display.visible;
  this.getField("arten.art23.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art23.klasse_"+i).display = display.hidden;
    this.getField("arten.art23.klasse_"+i).value = '';
  }
  this.getField("arten.art23.0plus").display = display.hidden;
  this.getField("arten.art23.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art24.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art24.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art24.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art24.0plus").display = display.visible;
  this.getField("arten.art24.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art24.klasse_"+i).display = display.hidden;
    this.getField("arten.art24.klasse_"+i).value = '';
  }
  this.getField("arten.art24.0plus").display = display.hidden;
  this.getField("arten.art24.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art25.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art25.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art25.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art25.0plus").display = display.visible;
  this.getField("arten.art25.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art25.klasse_"+i).display = display.hidden;
    this.getField("arten.art25.klasse_"+i).value = '';
  }
  this.getField("arten.art25.0plus").display = display.hidden;
  this.getField("arten.art25.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art26.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art26.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art26.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art26.0plus").display = display.visible;
  this.getField("arten.art26.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art26.klasse_"+i).display = display.hidden;
    this.getField("arten.art26.klasse_"+i).value = '';
  }
  this.getField("arten.art26.0plus").display = display.hidden;
  this.getField("arten.art26.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art3.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art3.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art3.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art3.0plus").display = display.visible;
  this.getField("arten.art3.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art3.klasse_"+i).display = display.hidden;
    this.getField("arten.art3.klasse_"+i).value = '';
  }
  this.getField("arten.art3.0plus").display = display.hidden;
  this.getField("arten.art3.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art4.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art4.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art4.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art4.0plus").display = display.visible;
  this.getField("arten.art4.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art4.klasse_"+i).display = display.hidden;
    this.getField("arten.art4.klasse_"+i).value = '';
  }
  this.getField("arten.art4.0plus").display = display.hidden;
  this.getField("arten.art4.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art5.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art5.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art5.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art5.0plus").display = display.visible;
  this.getField("arten.art5.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art5.klasse_"+i).display = display.hidden;
    this.getField("arten.art5.klasse_"+i).value = '';
  }
  this.getField("arten.art5.0plus").display = display.hidden;
  this.getField("arten.art5.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art6.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art6.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art6.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art6.0plus").display = display.visible;
  this.getField("arten.art6.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art6.klasse_"+i).display = display.hidden;
    this.getField("arten.art6.klasse_"+i).value = '';
  }
  this.getField("arten.art6.0plus").display = display.hidden;
  this.getField("arten.art6.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art7.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art7.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art7.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art7.0plus").display = display.visible;
  this.getField("arten.art7.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art7.klasse_"+i).display = display.hidden;
    this.getField("arten.art7.klasse_"+i).value = '';
  }
  this.getField("arten.art7.0plus").display = display.hidden;
  this.getField("arten.art7.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art8.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art8.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art8.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art8.0plus").display = display.visible;
  this.getField("arten.art8.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art8.klasse_"+i).display = display.hidden;
    this.getField("arten.art8.klasse_"+i).value = '';
  }
  this.getField("arten.art8.0plus").display = display.hidden;
  this.getField("arten.art8.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>arten.art9.name:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:arten.art9.name:Validate ***********/







var value = event.value;
if (value.length > 1) {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art9.klasse_"+i).display = display.visible;
  }
  this.getField("arten.art9.0plus").display = display.visible;
  this.getField("arten.art9.klasse_1").setFocus();
}
else {
  for (var i=1;i<=10;i++) {
    this.getField("arten.art9.klasse_"+i).display = display.hidden;
    this.getField("arten.art9.klasse_"+i).value = '';
  }
  this.getField("arten.art9.0plus").display = display.hidden;
  this.getField("arten.art9.0plus").value = '';
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>button_versenden:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:button_versenden:Annot1:MouseUp:Action1 ***********/



var message = '';
var lb = "\r\n";
if (this.validation() == true) {
	var protname = "Protokoll ";
	if (this.getField("probestrecke.monitoringnummer").value > 10000) {
		protname = protname + this.getField("probestrecke.monitoringnummer").value + " ";
	}
	protname = protname + this.getField("probestrecke.gewaesser.gewaessername").value + " " + this.getField("probestrecke.ortsangabe").value + " " + this.getField("datum").value  + " " + this.getField("messdaten.uhrzeit").value;
	var email1 = 'fiaka@lazbw.bwl.de';
	var email2 = '';
	if (this.getField("z.rp").value == 1) {
		email2 = 'Elisabeth.Schweikert@rpk.bwl.de';
	}
	if (this.getField("z.rp").value == 2) {
		email2 = 'Fischerei@rps.bwl.de';
	}
	if (this.getField("z.rp").value == 3) {
		email2 = 'Abteilung3@rpf.bwl.de';
	}
	if (this.getField("z.rp").value == 4) {
		email2 = 'fischereibehoerde@rpt.bwl.de';
	}
	var body = 'Automatischer email-Versand Elektrofischerei-Protokoll';
	this.mailDoc(true, email1+";"+email2,"","",protname, body);

}
else {
	message = unescape("Die Daten sind nicht valide bzw. unvollst%E4ndig. Das Protokoll wird nicht versandt!") + lb;
	app.alert(message,2,0,'Kein Versand!'); 	
}




//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>button_versenden:Annot2:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:button_versenden:Annot2:MouseUp:Action1 ***********/



var message = '';
var lb = "\r\n";
if (this.validation() == true) {
	var protname = "Protokoll ";
	if (this.getField("probestrecke.monitoringnummer").value > 10000) {
		protname = protname + this.getField("probestrecke.monitoringnummer").value + " ";
	}
	protname = protname + this.getField("probestrecke.gewaesser.gewaessername").value + " " + this.getField("probestrecke.ortsangabe").value + " " + this.getField("datum").value  + " " + this.getField("messdaten.uhrzeit").value;
	var email1 = 'fiaka@lazbw.bwl.de';
	var email2 = '';
	if (this.getField("z.rp").value == 1) {
		email2 = 'fiaka@rpk.bwl.de';
	}
	if (this.getField("z.rp").value == 2) {
		email2 = 'fiaka@rps.bwl.de';
	}
	if (this.getField("z.rp").value == 3) {
		email2 = 'fiaka@rpf.bwl.de';
	}
	if (this.getField("z.rp").value == 4) {
		email2 = 'fischereibehoerde@rpt.bwl.de';
	}
	var body = 'Automatischer email-Versand Elektrofischerei-Protokoll';
	this.mailDoc(true, email1+";"+email2,"","",protname, body);

}
else {
	message = unescape("Die Daten sind nicht valide bzw. unvollst%E4ndig. Das Protokoll wird nicht versandt!") + lb;
	app.alert(message,2,0,'Kein Versand!'); 	
}


//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>drucken:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:drucken:Annot1:MouseUp:Action1 ***********/







this.importAnXFDF();
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>export:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:export:Annot1:MouseUp:Action1 ***********/



var message = '';
var lb = "\r\n";
if (this.validation() == true) {
	this.exportAsXFDF({aFields: ["version", "anlass","bearbeiter", "datum", "probestrecke", "messdaten", "hydrologie", "umland", "ufer", "gewaessersohle", "strukturen", "einfluesse", "bewirtschaftung", "bemerkungen", "ausruestung", "befischte_bereiche", "arten", "fotos"]});
}
else {
	message = unescape("Die Daten sind nicht valide bzw. unvollst%E4ndig. Das Protokoll wird nicht exportiert!") + lb;
	app.alert(message,2,0,'Kein Export!'); 	
}

//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>export:Annot2:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:export:Annot2:MouseUp:Action1 ***********/







var message = '';
var lb = "\r\n";
if (this.validation() == true) {
	message = unescape("Exportieren nicht mÃ¶glich!") + lb;
	try {
		this.exportAsXFDF({aFields: ["version", "anlass","bearbeiter", "probestrecke", "messdaten", "hydrologie", "umland", "ufer", "gewaessersohle", "strukturen", "einfluesse", "bewirtschaftung", "bemerkungen", "ausruestung", "befischte_bereiche", "arten", "fotos"]});
	} catch(e) {
		app.alert(message); 
	}
}
else {
	message = unescape("Die Daten sind nicht valide bzw. unvollst%E4ndig. Das Protokoll wird nicht exportiert!") + lb;
	app.alert(message,2,0,'Kein Export!'); 	
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>fotos.bild1:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:fotos.bild1:Annot1:MouseUp:Action1 ***********/







event.target.buttonImportIcon();
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>fotos.bild2:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:fotos.bild2:Annot1:MouseUp:Action1 ***********/







event.target.buttonImportIcon();
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>fotos.bild3:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:fotos.bild3:Annot1:MouseUp:Action1 ***********/







event.target.buttonImportIcon();
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>fotos.bild4:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:fotos.bild4:Annot1:MouseUp:Action1 ***********/







event.target.buttonImportIcon();
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>fotos.kartenausschnitt_image:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:fotos.kartenausschnitt_image:Annot1:MouseUp:Action1 ***********/







event.target.buttonImportIcon();
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.betonschale:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.betonschale:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var keine_sohlverbauung = parseInt(this.getField("gewaessersohle.keine_sohlverbauung").value);
if (keine_sohlverbauung) {summe = summe + keine_sohlverbauung};
var rasensteine = parseInt(this.getField("gewaessersohle.rasensteine").value);
if (rasensteine) {summe = summe + rasensteine};
var drahtnetze_sohlverbauung = parseInt(this.getField("gewaessersohle.drahtnetze_sohlverbauung").value);
if (drahtnetze_sohlverbauung) {summe = summe + drahtnetze_sohlverbauung};
var steinschuettung = parseInt(this.getField("gewaessersohle.steinschuettung").value);
if (steinschuettung) {summe = summe + steinschuettung};
var pflasterung = parseInt(this.getField("gewaessersohle.pflasterung").value);
if (pflasterung) {summe = summe + pflasterung};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_sohlverbau").display = display.visible;
    this.getField("check_n_sohlverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_sohlverbau").display = display.hidden;
    this.getField("check_n_sohlverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.drahtnetze_sohlverbauung:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.drahtnetze_sohlverbauung:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var keine_sohlverbauung = parseInt(this.getField("gewaessersohle.keine_sohlverbauung").value);
if (keine_sohlverbauung) {summe = summe + keine_sohlverbauung};
var rasensteine = parseInt(this.getField("gewaessersohle.rasensteine").value);
if (rasensteine) {summe = summe + rasensteine};
var steinschuettung = parseInt(this.getField("gewaessersohle.steinschuettung").value);
if (steinschuettung) {summe = summe + steinschuettung};
var pflasterung = parseInt(this.getField("gewaessersohle.pflasterung").value);
if (pflasterung) {summe = summe + pflasterung};
var betonschale = parseInt(this.getField("gewaessersohle.betonschale").value);
if (betonschale) {summe = summe + betonschale};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_sohlverbau").display = display.visible;
    this.getField("check_n_sohlverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_sohlverbau").display = display.hidden;
    this.getField("check_n_sohlverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.felsen:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.felsen:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var schlamm = parseInt(this.getField("gewaessersohle.schlamm").value);
if (schlamm) {summe = summe + schlamm};
var lehm = parseInt(this.getField("gewaessersohle.lehm").value);
if (lehm) {summe = summe + lehm};
var sonstiges_erdreich = parseInt(this.getField("gewaessersohle.sonstiges_erdreich").value);
if (sonstiges_erdreich) {summe = summe + sonstiges_erdreich};
var sand = parseInt(this.getField("gewaessersohle.sand").value);
if (sand) {summe = summe + sand};
var kies = parseInt(this.getField("gewaessersohle.kies").value);
if (kies) {summe = summe + kies};
var grobkies = parseInt(this.getField("gewaessersohle.grobkies").value);
if (grobkies) {summe = summe + grobkies};
var steine = parseInt(this.getField("gewaessersohle.steine").value);
if (steine) {summe = summe + steine};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_substrat").display = display.visible;
    this.getField("check_n_substrat").display = display.hidden;
  }
  else {
    this.getField("check_ok_substrat").display = display.hidden;
    this.getField("check_n_substrat").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.grobkies:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.grobkies:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var schlamm = parseInt(this.getField("gewaessersohle.schlamm").value);
if (schlamm) {summe = summe + schlamm};
var lehm = parseInt(this.getField("gewaessersohle.lehm").value);
if (lehm) {summe = summe + lehm};
var sonstiges_erdreich = parseInt(this.getField("gewaessersohle.sonstiges_erdreich").value);
if (sonstiges_erdreich) {summe = summe + sonstiges_erdreich};
var sand = parseInt(this.getField("gewaessersohle.sand").value);
if (sand) {summe = summe + sand};
var kies = parseInt(this.getField("gewaessersohle.kies").value);
if (kies) {summe = summe + kies};
var steine = parseInt(this.getField("gewaessersohle.steine").value);
if (steine) {summe = summe + steine};
var felsen = parseInt(this.getField("gewaessersohle.felsen").value);
if (felsen) {summe = summe + felsen};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_substrat").display = display.visible;
    this.getField("check_n_substrat").display = display.hidden;
  }
  else {
    this.getField("check_ok_substrat").display = display.hidden;
    this.getField("check_n_substrat").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.keine_sohlverbauung:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.keine_sohlverbauung:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var rasensteine = parseInt(this.getField("gewaessersohle.rasensteine").value);
if (rasensteine) {summe = summe + rasensteine};
var drahtnetze_sohlverbauung = parseInt(this.getField("gewaessersohle.drahtnetze_sohlverbauung").value);
if (drahtnetze_sohlverbauung) {summe = summe + drahtnetze_sohlverbauung};
var steinschuettung = parseInt(this.getField("gewaessersohle.steinschuettung").value);
if (steinschuettung) {summe = summe + steinschuettung};
var pflasterung = parseInt(this.getField("gewaessersohle.pflasterung").value);
if (pflasterung) {summe = summe + pflasterung};
var betonschale = parseInt(this.getField("gewaessersohle.betonschale").value);
if (betonschale) {summe = summe + betonschale};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_sohlverbau").display = display.visible;
    this.getField("check_n_sohlverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_sohlverbau").display = display.hidden;
    this.getField("check_n_sohlverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.kies:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.kies:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var schlamm = parseInt(this.getField("gewaessersohle.schlamm").value);
if (schlamm) {summe = summe + schlamm};
var lehm = parseInt(this.getField("gewaessersohle.lehm").value);
if (lehm) {summe = summe + lehm};
var sonstiges_erdreich = parseInt(this.getField("gewaessersohle.sonstiges_erdreich").value);
if (sonstiges_erdreich) {summe = summe + sonstiges_erdreich};
var sand = parseInt(this.getField("gewaessersohle.sand").value);
if (sand) {summe = summe + sand};
var grobkies = parseInt(this.getField("gewaessersohle.grobkies").value);
if (grobkies) {summe = summe + grobkies};
var steine = parseInt(this.getField("gewaessersohle.steine").value);
if (steine) {summe = summe + steine};
var felsen = parseInt(this.getField("gewaessersohle.felsen").value);
if (felsen) {summe = summe + felsen};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_substrat").display = display.visible;
    this.getField("check_n_substrat").display = display.hidden;
  }
  else {
    this.getField("check_ok_substrat").display = display.hidden;
    this.getField("check_n_substrat").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.lehm:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.lehm:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var schlamm = parseInt(this.getField("gewaessersohle.schlamm").value);
if (schlamm) {summe = summe + schlamm};
var sonstiges_erdreich = parseInt(this.getField("gewaessersohle.sonstiges_erdreich").value);
if (sonstiges_erdreich) {summe = summe + sonstiges_erdreich};
var sand = parseInt(this.getField("gewaessersohle.sand").value);
if (sand) {summe = summe + sand};
var kies = parseInt(this.getField("gewaessersohle.kies").value);
if (kies) {summe = summe + kies};
var grobkies = parseInt(this.getField("gewaessersohle.grobkies").value);
if (grobkies) {summe = summe + grobkies};
var steine = parseInt(this.getField("gewaessersohle.steine").value);
if (steine) {summe = summe + steine};
var felsen = parseInt(this.getField("gewaessersohle.felsen").value);
if (felsen) {summe = summe + felsen};
if (summe > 100)
{
  app.alert0(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_substrat").display = display.visible;
    this.getField("check_n_substrat").display = display.hidden;
  }
  else {
    this.getField("check_ok_substrat").display = display.hidden;
    this.getField("check_n_substrat").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.pflasterung:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.pflasterung:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var keine_sohlverbauung = parseInt(this.getField("gewaessersohle.keine_sohlverbauung").value);
if (keine_sohlverbauung) {summe = summe + keine_sohlverbauung};
var rasensteine = parseInt(this.getField("gewaessersohle.rasensteine").value);
if (rasensteine) {summe = summe + rasensteine};
var drahtnetze_sohlverbauung = parseInt(this.getField("gewaessersohle.drahtnetze_sohlverbauung").value);
if (drahtnetze_sohlverbauung) {summe = summe + drahtnetze_sohlverbauung};
var steinschuettung = parseInt(this.getField("gewaessersohle.steinschuettung").value);
if (steinschuettung) {summe = summe + steinschuettung};
var betonschale = parseInt(this.getField("gewaessersohle.betonschale").value);
if (betonschale) {summe = summe + betonschale};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_sohlverbau").display = display.visible;
    this.getField("check_n_sohlverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_sohlverbau").display = display.hidden;
    this.getField("check_n_sohlverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.rasensteine:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.rasensteine:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var keine_sohlverbauung = parseInt(this.getField("gewaessersohle.keine_sohlverbauung").value);
if (keine_sohlverbauung) {summe = summe + keine_sohlverbauung};
var drahtnetze_sohlverbauung = parseInt(this.getField("gewaessersohle.drahtnetze_sohlverbauung").value);
if (drahtnetze_sohlverbauung) {summe = summe + drahtnetze_sohlverbauung};
var steinschuettung = parseInt(this.getField("gewaessersohle.steinschuettung").value);
if (steinschuettung) {summe = summe + steinschuettung};
var pflasterung = parseInt(this.getField("gewaessersohle.pflasterung").value);
if (pflasterung) {summe = summe + pflasterung};
var betonschale = parseInt(this.getField("gewaessersohle.betonschale").value);
if (betonschale) {summe = summe + betonschale};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_sohlverbau").display = display.visible;
    this.getField("check_n_sohlverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_sohlverbau").display = display.hidden;
    this.getField("check_n_sohlverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.sand:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.sand:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var schlamm = parseInt(this.getField("gewaessersohle.schlamm").value);
if (schlamm) {summe = summe + schlamm};
var lehm = parseInt(this.getField("gewaessersohle.lehm").value);
if (lehm) {summe = summe + lehm};
var sonstiges_erdreich = parseInt(this.getField("gewaessersohle.sonstiges_erdreich").value);
if (sonstiges_erdreich) {summe = summe + sonstiges_erdreich};
var kies = parseInt(this.getField("gewaessersohle.kies").value);
if (kies) {summe = summe + kies};
var grobkies = parseInt(this.getField("gewaessersohle.grobkies").value);
if (grobkies) {summe = summe + grobkies};
var steine = parseInt(this.getField("gewaessersohle.steine").value);
if (steine) {summe = summe + steine};
var felsen = parseInt(this.getField("gewaessersohle.felsen").value);
if (felsen) {summe = summe + felsen};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_substrat").display = display.visible;
    this.getField("check_n_substrat").display = display.hidden;
  }
  else {
    this.getField("check_ok_substrat").display = display.hidden;
    this.getField("check_n_substrat").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.schlamm:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.schlamm:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var lehm = parseInt(this.getField("gewaessersohle.lehm").value);
if (lehm) {summe = summe + lehm};
var sonstiges_erdreich = parseInt(this.getField("gewaessersohle.sonstiges_erdreich").value);
if (sonstiges_erdreich) {summe = summe + sonstiges_erdreich};
var sand = parseInt(this.getField("gewaessersohle.sand").value);
if (sand) {summe = summe + sand};
var kies = parseInt(this.getField("gewaessersohle.kies").value);
if (kies) {summe = summe + kies};
var grobkies = parseInt(this.getField("gewaessersohle.grobkies").value);
if (grobkies) {summe = summe + grobkies};
var steine = parseInt(this.getField("gewaessersohle.steine").value);
if (steine) {summe = summe + steine};
var felsen = parseInt(this.getField("gewaessersohle.felsen").value);
if (felsen) {summe = summe + felsen};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_substrat").display = display.visible;
    this.getField("check_n_substrat").display = display.hidden;
  }
  else {
    this.getField("check_ok_substrat").display = display.hidden;
    this.getField("check_n_substrat").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.sonstiges_erdreich:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.sonstiges_erdreich:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var schlamm = parseInt(this.getField("gewaessersohle.schlamm").value);
if (schlamm) {summe = summe + schlamm};
var lehm = parseInt(this.getField("gewaessersohle.lehm").value);
if (lehm) {summe = summe + lehm};
var sand = parseInt(this.getField("gewaessersohle.sand").value);
if (sand) {summe = summe + sand};
var kies = parseInt(this.getField("gewaessersohle.kies").value);
if (kies) {summe = summe + kies};
var grobkies = parseInt(this.getField("gewaessersohle.grobkies").value);
if (grobkies) {summe = summe + grobkies};
var steine = parseInt(this.getField("gewaessersohle.steine").value);
if (steine) {summe = summe + steine};
var felsen = parseInt(this.getField("gewaessersohle.felsen").value);
if (felsen) {summe = summe + felsen};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_substrat").display = display.visible;
    this.getField("check_n_substrat").display = display.hidden;
  }
  else {
    this.getField("check_ok_substrat").display = display.hidden;
    this.getField("check_n_substrat").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.steine:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.steine:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var schlamm = parseInt(this.getField("gewaessersohle.schlamm").value);
if (schlamm) {summe = summe + schlamm};
var lehm = parseInt(this.getField("gewaessersohle.lehm").value);
if (lehm) {summe = summe + lehm};
var sonstiges_erdreich = parseInt(this.getField("gewaessersohle.sonstiges_erdreich").value);
if (sonstiges_erdreich) {summe = summe + sonstiges_erdreich};
var sand = parseInt(this.getField("gewaessersohle.sand").value);
if (sand) {summe = summe + sand};
var kies = parseInt(this.getField("gewaessersohle.kies").value);
if (kies) {summe = summe + kies};
var grobkies = parseInt(this.getField("gewaessersohle.grobkies").value);
if (grobkies) {summe = summe + grobkies};
var felsen = parseInt(this.getField("gewaessersohle.felsen").value);
if (felsen) {summe = summe + felsen};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_substrat").display = display.visible;
    this.getField("check_n_substrat").display = display.hidden;
  }
  else {
    this.getField("check_ok_substrat").display = display.hidden;
    this.getField("check_n_substrat").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>gewaessersohle.steinschuettung:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:gewaessersohle.steinschuettung:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var keine_sohlverbauung = parseInt(this.getField("gewaessersohle.keine_sohlverbauung").value);
if (keine_sohlverbauung) {summe = summe + keine_sohlverbauung};
var rasensteine = parseInt(this.getField("gewaessersohle.rasensteine").value);
if (rasensteine) {summe = summe + rasensteine};
var drahtnetze_sohlverbauung = parseInt(this.getField("gewaessersohle.drahtnetze_sohlverbauung").value);
if (drahtnetze_sohlverbauung) {summe = summe + drahtnetze_sohlverbauung};
var pflasterung = parseInt(this.getField("gewaessersohle.pflasterung").value);
if (pflasterung) {summe = summe + pflasterung};
var betonschale = parseInt(this.getField("gewaessersohle.betonschale").value);
if (betonschale) {summe = summe + betonschale};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_sohlverbau").display = display.visible;
    this.getField("check_n_sohlverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_sohlverbau").display = display.hidden;
    this.getField("check_n_sohlverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>hydrologie.breite_schaetzwert:Annot1:OnBlur:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:hydrologie.breite_schaetzwert:Annot1:OnBlur:Action1 ***********/







event.rc = true;
var value = event.value;
var oben = 0;
var unten = 0;
var status = true;
switch (this.getField("hydrologie.breite").value) {
	case  0:
		unten = 0;
		oben = 0;
		break;
	case  1:
		unten = 0;
		oben = 1;
		break;
	case  2:
		unten = 1;
		oben = 2;
		break;
	case  3:
		unten = 2;
		oben = 5;
		break;
	case  4:
		unten = 5;
		oben = 15;
		break;
	case  5:
		unten = 15;
		oben = 50;
		break;
	case  6:
		unten = 50;
		oben = 100;
		break;
	case  7:
		unten = 100;
		oben = 100000000;
		break;
	default:
		status = false;
		break;
}
if (status == false) {
	app.alert("WÃ¤hlen Sie bitte erst die mittlere Breite aus!");
	event.value = '';
	this.getField("hydrologie.breite").setFocus();
}
else {
	if ((value < unten) && (value <= oben)) {
		app.alert("Der Wert muss der Auswahl vorher entsprechen!");
		event.target.textColor = color.red;
		event.rc = false;
		this.getField("hydrologie.breite_schaetzwert").setFocus();
	}
	else {
		event.target.textColor = color.black;
	}
}

//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>hydrologie.tiefe_schaetzwert:Annot1:OnBlur:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:hydrologie.tiefe_schaetzwert:Annot1:OnBlur:Action1 ***********/







event.rc = true;
var value = event.value;
var oben = 0;
var unten = 0;
var status = true;
switch (this.getField("hydrologie.tiefe").value) {
	case  0:
		unten = 0;
		oben = 0;
		break;
	case  1:
		unten = 0;
		oben = 0.1;
		break;
	case  2:
		unten = 0.1;
		oben = 0.3;
		break;
	case  3:
		unten = 0.3;
		oben = 0.5;
		break;
	case  4:
		unten = 0.5;
		oben = 1;
		break;
	case  5:
		unten = 1;
		oben = 2;
		break;
	case  6:
		unten = 2;
		oben = 4;
		break;
	case  7:
		unten = 4;
		oben = 300;
		break;
	default:
		status = false;
		break;
}
if (status == false) {
	app.alert("WÃ¤hlen Sie bitte erst die mittlere Tiefe aus!");
	event.value = '';
	this.getField("hydrologie.tiefe").setFocus();
}
else {
	if ((value < unten) && (value <= oben)) {
		app.alert("Der Wert muss der Auswahl vorher entsprechen!");
		event.target.textColor = color.red;
		event.rc = false;
		this.getField("hydrologie.tiefe_schaetzwert").setFocus();
	}
	else {
		event.target.textColor = color.black;
	}
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaesser.gewaessername:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaesser.gewaessername:Annot1:MouseUp:Action1 ***********/







this.documentFileName = this.Gewaessername + '.pdf';

//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaesser.gewaessername:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaesser.gewaessername:Validate ***********/



var value = event.value.toLowerCase();
if ((value == "rhein") || (value == "donau")) {
    this.getField("probestrecke.gewaesser.vorfluter1").required = false;
}
else {
    this.getField("probestrecke.gewaesser.vorfluter1").required = true;
}
event.value = value[0].toUpperCase() + value.slice(1);

//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaesser.vorfluter1:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaesser.vorfluter1:Validate ***********/







var value = event.value.toLowerCase();
if ((value.length > 0) && (value != "rhein") && (value != "donau")) {
    this.getField("probestrecke.gewaesser.vorfluter2").required = true;
}
else {
    this.getField("probestrecke.gewaesser.vorfluter2").required = false;
    this.getField("probestrecke.gewaesser.vorfluter3").required = false;
    this.getField("probestrecke.gewaesser.vorfluter4").required = false;
    this.getField("probestrecke.gewaesser.vorfluter5").required = false;
}
event.value = value[0].toUpperCase() + value.slice(1);
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaesser.vorfluter2:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaesser.vorfluter2:Validate ***********/







var value = event.value.toLowerCase();
if ((value.length > 0) && (value != "rhein") && (value != "donau")) {
    this.getField("probestrecke.gewaesser.vorfluter3").required = true;
}
else {
    this.getField("probestrecke.gewaesser.vorfluter3").required = false;
    this.getField("probestrecke.gewaesser.vorfluter4").required = false;
    this.getField("probestrecke.gewaesser.vorfluter5").required = false;
}
event.value = value[0].toUpperCase() + value.slice(1);
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaesser.vorfluter3:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaesser.vorfluter3:Validate ***********/







var value = event.value.toLowerCase();
if ((value.length > 0) && (value != "rhein") && (value != "donau")) {
    this.getField("probestrecke.gewaesser.vorfluter4").required = true;
}
else {
    this.getField("probestrecke.gewaesser.vorfluter4").required = false;
    this.getField("probestrecke.gewaesser.vorfluter5").required = false;
}
event.value = value[0].toUpperCase() + value.slice(1);
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaesser.vorfluter4:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaesser.vorfluter4:Validate ***********/







var value = event.value.toLowerCase();
if ((value.length > 0) && (value != "rhein") && (value != "donau")) {
    this.getField("probestrecke.gewaesser.vorfluter5").required = true;
}
else {
    this.getField("probestrecke.gewaesser.vorfluter5").required = false;
}
event.value = value[0].toUpperCase() + value.slice(1);
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaessertyp:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaessertyp:Annot1:MouseUp:Action1 ***********/







if (this.getField("probestrecke.gewaessertyp").value == 14) {
    this.getField("hydrologie_box").hidden = true;
    this.getField("hydrologie").hidden = false;
    this.getField("hydrologie.breite.7").hidden = true;
    this.getField("hydrologie.tiefe.7").hidden = true;
    this.getField("hydrologie.tiefenvarianz.3").hidden = true;
    this.getField("hydrologie.linienfuehrung.4").hidden = true;
    this.getField("hydrologie.stroemung.5").hidden = true;
    this.getField("hydrologie.fliessgeschwindigkeit.6").hidden = true;
    this.getField("hydrologie.wasserfuehrung.4").hidden = true;
    this.getField("hydrologie.stillwasserbereich.5").hidden = true;
    this.getField("hydrologie.gesamtprofil.4").hidden = true;
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaessertyp:Annot2:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaessertyp:Annot2:MouseUp:Action1 ***********/







if (this.getField("probestrecke.gewaessertyp").value == 12) {
    this.getField("hydrologie_box").hidden = true;
    this.getField("hydrologie").hidden = false;
    this.getField("hydrologie.breite.7").hidden = true;
    this.getField("hydrologie.tiefe.7").hidden = true;
    this.getField("hydrologie.tiefenvarianz.3").hidden = true;
    this.getField("hydrologie.linienfuehrung.4").hidden = true;
    this.getField("hydrologie.stroemung.5").hidden = true;
    this.getField("hydrologie.fliessgeschwindigkeit.6").hidden = true;
    this.getField("hydrologie.wasserfuehrung.4").hidden = true;
    this.getField("hydrologie.stillwasserbereich.5").hidden = true;
    this.getField("hydrologie.gesamtprofil.4").hidden = true;
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaessertyp:Annot3:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaessertyp:Annot3:MouseUp:Action1 ***********/







if (this.getField("probestrecke.gewaessertyp").value == 13) {
    this.getField("hydrologie_box").hidden = true;
    this.getField("hydrologie").hidden = false;
    this.getField("hydrologie.breite.7").hidden = true;
    this.getField("hydrologie.tiefe.7").hidden = true;
    this.getField("hydrologie.tiefenvarianz.3").hidden = true;
    this.getField("hydrologie.linienfuehrung.4").hidden = true;
    this.getField("hydrologie.stroemung.5").hidden = true;
    this.getField("hydrologie.fliessgeschwindigkeit.6").hidden = true;
    this.getField("hydrologie.wasserfuehrung.4").hidden = true;
    this.getField("hydrologie.stillwasserbereich.5").hidden = true;
    this.getField("hydrologie.gesamtprofil.4").hidden = true;
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaessertyp:Annot4:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaessertyp:Annot4:MouseUp:Action1 ***********/







if (this.getField("probestrecke.gewaessertyp").value == 11) {
    this.getField("hydrologie_box").hidden = true;
    this.getField("hydrologie").hidden = false;
    this.getField("hydrologie.breite.7").hidden = true;
    this.getField("hydrologie.tiefe.7").hidden = true;
    this.getField("hydrologie.tiefenvarianz.3").hidden = true;
    this.getField("hydrologie.linienfuehrung.4").hidden = true;
    this.getField("hydrologie.stroemung.5").hidden = true;
    this.getField("hydrologie.fliessgeschwindigkeit.6").hidden = true;
    this.getField("hydrologie.wasserfuehrung.4").hidden = true;
    this.getField("hydrologie.stillwasserbereich.5").hidden = true;
    this.getField("hydrologie.gesamtprofil.4").hidden = true;
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaessertyp:Annot5:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaessertyp:Annot5:MouseUp:Action1 ***********/







if (this.getField("probestrecke.gewaessertyp").value == 26) {
    this.getField("hydrologie_box").hidden = false;
    this.getField("hydrologie").hidden = true;
    this.getField("hydrologie.breite").value = 0;
    this.getField("hydrologie.breite_schaetzwert").value = 0;
    this.getField("hydrologie.tiefe").value = 0;
    this.getField("hydrologie.tiefe_schaetzwert").value = 0;
    this.getField("hydrologie.tiefenvarianz").value = 0;
    this.getField("hydrologie.linienfuehrung").value = 0;
    this.getField("hydrologie.stroemung").value = 0;
    this.getField("hydrologie.fliessgeschwindigkeit").value = 0;
    this.getField("hydrologie.wasserfuehrung").value = 0;
    this.getField("hydrologie.stillwasserbereich").value = 0;
    this.getField("hydrologie.gesamtprofil").value = 0;
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaessertyp:Annot6:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaessertyp:Annot6:MouseUp:Action1 ***********/







if (this.getField("probestrecke.gewaessertyp").value == 32) {
    this.getField("hydrologie_box").hidden = false;
    this.getField("hydrologie").hidden = true;
    this.getField("hydrologie.breite").value = 0;
    this.getField("hydrologie.breite_schaetzwert").value = 0;
    this.getField("hydrologie.tiefe").value = 0;
    this.getField("hydrologie.tiefe_schaetzwert").value = 0;
    this.getField("hydrologie.tiefenvarianz").value = 0;
    this.getField("hydrologie.linienfuehrung").value = 0;
    this.getField("hydrologie.stroemung").value = 0;
    this.getField("hydrologie.fliessgeschwindigkeit").value = 0;
    this.getField("hydrologie.wasserfuehrung").value = 0;
    this.getField("hydrologie.stillwasserbereich").value = 0;
    this.getField("hydrologie.gesamtprofil").value = 0;
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaessertyp:Annot7:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaessertyp:Annot7:MouseUp:Action1 ***********/







if (this.getField("probestrecke.gewaessertyp").value == 31) {
    this.getField("hydrologie_box").hidden = true;
    this.getField("hydrologie").hidden = false;
    this.getField("hydrologie.breite.7").hidden = true;
    this.getField("hydrologie.tiefe.7").hidden = true;
    this.getField("hydrologie.tiefenvarianz.3").hidden = true;
    this.getField("hydrologie.linienfuehrung.4").hidden = true;
    this.getField("hydrologie.stroemung.5").hidden = true;
    this.getField("hydrologie.fliessgeschwindigkeit.6").hidden = true;
    this.getField("hydrologie.wasserfuehrung.4").hidden = true;
    this.getField("hydrologie.stillwasserbereich.5").hidden = true;
    this.getField("hydrologie.gesamtprofil.4").hidden = true;
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>probestrecke.gewaessertyp:Annot8:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:probestrecke.gewaessertyp:Annot8:MouseUp:Action1 ***********/







if (this.getField("probestrecke.gewaessertyp").value == 21) {
    this.getField("hydrologie_box").hidden = false;
    this.getField("hydrologie").hidden = true;
    this.getField("hydrologie.breite").value = 0;
    this.getField("hydrologie.breite_schaetzwert").value = 0;
    this.getField("hydrologie.tiefe").value = 0;
    this.getField("hydrologie.tiefe_schaetzwert").value = 0;
    this.getField("hydrologie.tiefenvarianz").value = 0;
    this.getField("hydrologie.linienfuehrung").value = 0;
    this.getField("hydrologie.stroemung").value = 0;
    this.getField("hydrologie.fliessgeschwindigkeit").value = 0;
    this.getField("hydrologie.wasserfuehrung").value = 0;
    this.getField("hydrologie.stillwasserbereich").value = 0;
    this.getField("hydrologie.gesamtprofil").value = 0;
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>saveas:Annot1:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:saveas:Annot1:MouseUp:Action1 ***********/







var message = '';
var lb = "\r\n";
if (this.validation() == true) {
	var heute1 = new Date();
	var aktuelles_datum = heute1.toISOString().substring(0, 10); //getFullYear() + String(heute1.getMonth()+1) + String(heute1.getDay()) + '_' + heute1.getHours() + "_" + heute1.getMinutes();
	var aMyPath = this.path.split("/");
	// Remove old file name
	aMyPath.pop();
	// Add new file name
	filename = "Protokoll_";
	if (this.getField("probestrecke.monitoringnummer").value.length > 5) {
		filename = filename + this.getField("probestrecke.monitoringnummer").value + "_";
	}
	filename = filename + this.getField("probestrecke.gewaesser.gewaessername").value + "_" + this.getField("datum").value.replace(".","_").replace(".","_")  + "_" + this.getField("messdaten.uhrzeit").value.replace(":","_") + "_" + aktuelles_datum + ".pdf";
	//filename = "test.pdf";
//	app.alert(filename,3,0,'Dateiname des Protokolls:'); 
	aMyPath.push(filename);
	// Put path back together and save
	message = unescape("Gem%E4ÃŸ den Sicherheitseinstellungen kann das Formular") + lb;
	message = message + "nicht abgespeichert werden." + lb;
	message = message + "Bitte tragen Sie den Ordner des Formulars unter" + lb;
	message = message + "  - Bearbeiten" + lb;
	message = message + "    - Einstellungen" + lb;
	message = message + "      - Sicherheit (erweitert)" + lb;
	message = message + unescape("        - Vertrauensw%FCrdige Sites") + lb;
	message = message + unescape("          - Verzeichnispfad hinzuf%FCgen") + lb;
	message = message + "ein!" + lb;
	//app.alert(message);
	try {
		app.execMenuItem("SaveAs")
//		this.saveAs({cPath: aMyPath.join("/"), bCopy: true});
//		var nButton = app.alert(unescape('Die Daten sind valide. Wenn Sie diesen Dialog mit Ja best%E4tigen,\r\nwird der Formularinhalt nicht mehr bearbeitbar sein und abgespeichert.\r\nKorrekturen sind dann nicht mehr m%F6glich!\r\n\r\nSoll die Dateneingabe abgeschlossen werden?'),2,2,'Daten sind valide!');
//		if (nButton == 4) {
//			valide = true;
//			var oField;
//			for (var i=0;i<this.numFields;i++) {
//				oField = this.getField(this.getNthFieldName(i)).readonly = true;	
//			}
//		}
//		this.saveAs({cPath: aMyPath.join("/"), bCopy: true});
//	}		
	} catch(e) {
		app.alert(message,2,0,'Probleme mit der Sicherheitseinstellung:'); 
	}
}
else {
	message = unescape("Die Daten sind nicht valide bzw. unvollst%E4ndig. Das Protokoll wird nicht abgespeichert!") + lb;
	app.alert(message,2,0,'Keine Speicherung!'); 	
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>saveas:Annot2:MouseUp:Action1</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:saveas:Annot2:MouseUp:Action1 ***********/







var message = '';
var lb = "\r\n";
if (this.validation() == true) {
	var heute1 = new Date();
	var aktuelles_datum = heute1.toISOString().substring(0, 10); //getFullYear() + String(heute1.getMonth()+1) + String(heute1.getDay()) + '_' + heute1.getHours() + "_" + heute1.getMinutes();
	var aMyPath = this.path.split("/");
	// Remove old file name
	aMyPath.pop();
	// Add new file name
	filename = "Protokoll_";
	if (this.getField("probestrecke.monitoringnummer").value.length > 5) {
		filename = filename + this.getField("probestrecke.monitoringnummer").value + "_";
	}
	filename = filename + this.getField("probestrecke.gewaesser.gewaessername").value + "_" + this.getField("datum").value.replace(".","_").replace(".","_")  + "_" + this.getField("messdaten.uhrzeit").value.replace(":","_") + "_" + aktuelles_datum + ".pdf";
	//filename = "test.pdf";
	app.alert(filename,3,0,'Dateiname des Protokolls:'); 
	aMyPath.push(filename);
	// Put path back together and save
	message = unescape("Gem%E4ÃŸ den Sicherheitseinstellungen kann das Formular") + lb;
	message = message + "nicht abgespeichert werden." + lb;
	message = message + "Bitte tragen Sie den Ordner des Formulars unter" + lb;
	message = message + "  - Bearbeiten" + lb;
	message = message + "    - Einstellungen" + lb;
	message = message + "      - Sicherheit (erweitert)" + lb;
	message = message + unescape("        - Vertrauensw%FCrdige Sites") + lb;
	message = message + unescape("          - Verzeichnispfad hinzuf%FCgen") + lb;
	message = message + "ein!" + lb;
	//app.alert(message);
	try {
		this.saveAs({cPath: aMyPath.join("/"), bCopy: true});
//		var nButton = app.alert(unescape('Die Daten sind valide. Wenn Sie diesen Dialog mit Ja best%E4tigen,\r\nwird der Formularinhalt nicht mehr bearbeitbar sein und abgespeichert.\r\nKorrekturen sind dann nicht mehr m%F6glich!\r\n\r\nSoll die Dateneingabe abgeschlossen werden?'),2,2,'Daten sind valide!');
//		if (nButton == 4) {
//			valide = true;
//			var oField;
//			for (var i=0;i<this.numFields;i++) {
//				oField = this.getField(this.getNthFieldName(i)).readonly = true;	
//			}
//		}
//		this.saveAs({cPath: aMyPath.join("/"), bCopy: true});
//	}		
	} catch(e) {
		app.alert(message,2,0,'Probleme mit der Sicherheitseinstellung:'); 
	}
}
else {
	message = unescape("Die Daten sind nicht valide bzw. unvollst%E4ndig. Das Protokoll wird nicht abgespeichert!") + lb;
	app.alert(message,2,0,'Keine Speicherung!'); 	
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.abbruch:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.abbruch:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var flachufer = parseInt(this.getField("ufer.flachufer").value);
if (flachufer) {summe = summe + flachufer};
var schraegufer = parseInt(this.getField("ufer.schraegufer").value);
if (schraegufer) {summe = summe + schraegufer};
var unterspuelung = parseInt(this.getField("ufer.unterspuelung").value);
if (unterspuelung) {summe = summe + unterspuelung};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_neigung").display = display.visible;
    this.getField("check_n_neigung").display = display.hidden;
  }
  else {
    this.getField("check_ok_neigung").display = display.hidden;
    this.getField("check_n_neigung").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.andere_baeume:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.andere_baeume:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var ohne_bewuchs = parseInt(this.getField("ufer.ohne_bewuchs").value);
if (ohne_bewuchs) {summe = summe + ohne_bewuchs};
var graeser = parseInt(this.getField("ufer.graeser").value);
if (graeser) {summe = summe + graeser};
var schilf_rohr = parseInt(this.getField("ufer.schilf_rohr").value);
if (schilf_rohr) {summe = summe + schilf_rohr};
var krautige_blattpflanzen = parseInt(this.getField("ufer.krautige_blattpflanzen").value);
if (krautige_blattpflanzen) {summe = summe + krautige_blattpflanzen};
var straeucher = parseInt(this.getField("ufer.straeucher").value);
if (straeucher) {summe = summe + straeucher};
var weiden = parseInt(this.getField("ufer.weiden").value);
if (weiden) {summe = summe + weiden};
var erlen = parseInt(this.getField("ufer.erlen").value);
if (erlen) {summe = summe + erlen};
var sonstiger_bewuchs = parseInt(this.getField("ufer.sonstiger_bewuchs").value);
if (sonstiger_bewuchs) {summe = summe + sonstiger_bewuchs};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_bewuchs").display = display.visible;
    this.getField("check_n_bewuchs").display = display.hidden;
  }
  else {
    this.getField("check_ok_bewuchs").display = display.hidden;
    this.getField("check_n_bewuchs").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.drahtnetze:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.drahtnetze:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var uferverbau_keiner = parseInt(this.getField("ufer.uferverbau_keiner").value);
if (uferverbau_keiner) {summe = summe + uferverbau_keiner};
var mauer_unverfugt = parseInt(this.getField("ufer.mauer_unverfugt").value);
if (mauer_unverfugt) {summe = summe + mauer_unverfugt};
var faschinen = parseInt(this.getField("ufer.faschinen").value);
if (faschinen) {summe = summe + faschinen};
var ueberwachsen = parseInt(this.getField("ufer.ueberwachsen").value);
if (ueberwachsen) {summe = summe + ueberwachsen};
var mauer_verfugt = parseInt(this.getField("ufer.mauer_verfugt").value);
if (mauer_verfugt) {summe = summe + mauer_verfugt};
var steinwurf = parseInt(this.getField("ufer.steinwurf").value);
if (steinwurf) {summe = summe + steinwurf};
var sonstiger_uferverbau = parseInt(this.getField("ufer.sonstiger_uferverbau").value);
if (sonstiger_uferverbau) {summe = summe + sonstiger_uferverbau};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_uferverbau").display = display.visible;
    this.getField("check_n_uferverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_uferverbau").display = display.hidden;
    this.getField("check_n_uferverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.erlen:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.erlen:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var ohne_bewuchs = parseInt(this.getField("ufer.ohne_bewuchs").value);
if (ohne_bewuchs) {summe = summe + ohne_bewuchs};
var graeser = parseInt(this.getField("ufer.graeser").value);
if (graeser) {summe = summe + graeser};
var schilf_rohr = parseInt(this.getField("ufer.schilf_rohr").value);
if (schilf_rohr) {summe = summe + schilf_rohr};
var krautige_blattpflanzen = parseInt(this.getField("ufer.krautige_blattpflanzen").value);
if (krautige_blattpflanzen) {summe = summe + krautige_blattpflanzen};
var straeucher = parseInt(this.getField("ufer.straeucher").value);
if (straeucher) {summe = summe + straeucher};
var weiden = parseInt(this.getField("ufer.weiden").value);
if (weiden) {summe = summe + weiden};
var andere_baeume = parseInt(this.getField("ufer.andere_baeume").value);
if (andere_baeume) {summe = summe + andere_baeume};
var sonstiger_bewuchs = parseInt(this.getField("ufer.sonstiger_bewuchs").value);
if (sonstiger_bewuchs) {summe = summe + sonstiger_bewuchs};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_bewuchs").display = display.visible;
    this.getField("check_n_bewuchs").display = display.hidden;
  }
  else {
    this.getField("check_ok_bewuchs").display = display.hidden;
    this.getField("check_n_bewuchs").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.faschinen:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.faschinen:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var uferverbau_keiner = parseInt(this.getField("ufer.uferverbau_keiner").value);
if (uferverbau_keiner) {summe = summe + uferverbau_keiner};
var mauer_unverfugt = parseInt(this.getField("ufer.mauer_unverfugt").value);
if (mauer_unverfugt) {summe = summe + mauer_unverfugt};
var drahtnetze = parseInt(this.getField("ufer.drahtnetze").value);
if (drahtnetze) {summe = summe + drahtnetze};
var ueberwachsen = parseInt(this.getField("ufer.ueberwachsen").value);
if (ueberwachsen) {summe = summe + ueberwachsen};
var mauer_verfugt = parseInt(this.getField("ufer.mauer_verfugt").value);
if (mauer_verfugt) {summe = summe + mauer_verfugt};
var steinwurf = parseInt(this.getField("ufer.steinwurf").value);
if (steinwurf) {summe = summe + steinwurf};
var sonstiger_uferverbau = parseInt(this.getField("ufer.sonstiger_uferverbau").value);
if (sonstiger_uferverbau) {summe = summe + sonstiger_uferverbau};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_uferverbau").display = display.visible;
    this.getField("check_n_uferverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_uferverbau").display = display.hidden;
    this.getField("check_n_uferverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.flachufer:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.flachufer:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var schraegufer = parseInt(this.getField("ufer.schraegufer").value);
if (schraegufer) {summe = summe + schraegufer};
var abbruch = parseInt(this.getField("ufer.abbruch").value);
if (abbruch) {summe = summe + abbruch};
var unterspuelung = parseInt(this.getField("ufer.unterspuelung").value);
if (unterspuelung) {summe = summe + unterspuelung};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_neigung").display = display.visible;
    this.getField("check_n_neigung").display = display.hidden;
  }
  else {
    this.getField("check_ok_neigung").display = display.hidden;
    this.getField("check_n_neigung").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.graeser:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.graeser:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var ohne_bewuchs = parseInt(this.getField("ufer.ohne_bewuchs").value);
if (ohne_bewuchs) {summe = summe + ohne_bewuchs};
var schilf_rohr = parseInt(this.getField("ufer.schilf_rohr").value);
if (schilf_rohr) {summe = summe + schilf_rohr};
var krautige_blattpflanzen = parseInt(this.getField("ufer.krautige_blattpflanzen").value);
if (krautige_blattpflanzen) {summe = summe + krautige_blattpflanzen};
var straeucher = parseInt(this.getField("ufer.straeucher").value);
if (straeucher) {summe = summe + straeucher};
var weiden = parseInt(this.getField("ufer.weiden").value);
if (weiden) {summe = summe + weiden};
var erlen = parseInt(this.getField("ufer.erlen").value);
if (erlen) {summe = summe + erlen};
var andere_baeume = parseInt(this.getField("ufer.andere_baeume").value);
if (andere_baeume) {summe = summe + andere_baeume};
var sonstiger_bewuchs = parseInt(this.getField("ufer.sonstiger_bewuchs").value);
if (sonstiger_bewuchs) {summe = summe + sonstiger_bewuchs};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_bewuchs").display = display.visible;
    this.getField("check_n_bewuchs").display = display.hidden;
  }
  else {
    this.getField("check_ok_bewuchs").display = display.hidden;
    this.getField("check_n_bewuchs").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.krautige_blattpflanzen:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.krautige_blattpflanzen:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var ohne_bewuchs = parseInt(this.getField("ufer.ohne_bewuchs").value);
if (ohne_bewuchs) {summe = summe + ohne_bewuchs};
var graeser = parseInt(this.getField("ufer.graeser").value);
if (graeser) {summe = summe + graeser};
var schilf_rohr = parseInt(this.getField("ufer.schilf_rohr").value);
if (schilf_rohr) {summe = summe + schilf_rohr};
var straeucher = parseInt(this.getField("ufer.straeucher").value);
if (straeucher) {summe = summe + straeucher};
var weiden = parseInt(this.getField("ufer.weiden").value);
if (weiden) {summe = summe + weiden};
var erlen = parseInt(this.getField("ufer.erlen").value);
if (erlen) {summe = summe + erlen};
var andere_baeume = parseInt(this.getField("ufer.andere_baeume").value);
if (andere_baeume) {summe = summe + andere_baeume};
var sonstiger_bewuchs = parseInt(this.getField("ufer.sonstiger_bewuchs").value);
if (sonstiger_bewuchs) {summe = summe + sonstiger_bewuchs};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_bewuchs").display = display.visible;
    this.getField("check_n_bewuchs").display = display.hidden;
  }
  else {
    this.getField("check_ok_bewuchs").display = display.hidden;
    this.getField("check_n_bewuchs").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.mauer_unverfugt:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.mauer_unverfugt:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var uferverbau_keiner = parseInt(this.getField("ufer.uferverbau_keiner").value);
if (uferverbau_keiner) {summe = summe + uferverbau_keiner};
var faschinen = parseInt(this.getField("ufer.faschinen").value);
if (faschinen) {summe = summe + faschinen};
var drahtnetze = parseInt(this.getField("ufer.drahtnetze").value);
if (drahtnetze) {summe = summe + drahtnetze};
var ueberwachsen = parseInt(this.getField("ufer.ueberwachsen").value);
if (ueberwachsen) {summe = summe + ueberwachsen};
var mauer_verfugt = parseInt(this.getField("ufer.mauer_verfugt").value);
if (mauer_verfugt) {summe = summe + mauer_verfugt};
var steinwurf = parseInt(this.getField("ufer.steinwurf").value);
if (steinwurf) {summe = summe + steinwurf};
var sonstiger_uferverbau = parseInt(this.getField("ufer.sonstiger_uferverbau").value);
if (sonstiger_uferverbau) {summe = summe + sonstiger_uferverbau};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_uferverbau").display = display.visible;
    this.getField("check_n_uferverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_uferverbau").display = display.hidden;
    this.getField("check_n_uferverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.mauer_verfugt:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.mauer_verfugt:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var uferverbau_keiner = parseInt(this.getField("ufer.uferverbau_keiner").value);
if (uferverbau_keiner) {summe = summe + uferverbau_keiner};
var mauer_unverfugt = parseInt(this.getField("ufer.mauer_unverfugt").value);
if (mauer_unverfugt) {summe = summe + mauer_unverfugt};
var faschinen = parseInt(this.getField("ufer.faschinen").value);
if (faschinen) {summe = summe + faschinen};
var drahtnetze = parseInt(this.getField("ufer.drahtnetze").value);
if (drahtnetze) {summe = summe + drahtnetze};
var ueberwachsen = parseInt(this.getField("ufer.ueberwachsen").value);
if (ueberwachsen) {summe = summe + ueberwachsen};
var steinwurf = parseInt(this.getField("ufer.steinwurf").value);
if (steinwurf) {summe = summe + steinwurf};
var sonstiger_uferverbau = parseInt(this.getField("ufer.sonstiger_uferverbau").value);
if (sonstiger_uferverbau) {summe = summe + sonstiger_uferverbau};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_uferverbau").display = display.visible;
    this.getField("check_n_uferverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_uferverbau").display = display.hidden;
    this.getField("check_n_uferverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.ohne_bewuchs:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.ohne_bewuchs:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var graeser = parseInt(this.getField("ufer.graeser").value);
if (graeser) {summe = summe + graeser};
var schilf_rohr = parseInt(this.getField("ufer.schilf_rohr").value);
if (schilf_rohr) {summe = summe + schilf_rohr};
var krautige_blattpflanzen = parseInt(this.getField("ufer.krautige_blattpflanzen").value);
if (krautige_blattpflanzen) {summe = summe + krautige_blattpflanzen};
var straeucher = parseInt(this.getField("ufer.straeucher").value);
if (straeucher) {summe = summe + straeucher};
var weiden = parseInt(this.getField("ufer.weiden").value);
if (weiden) {summe = summe + weiden};
var erlen = parseInt(this.getField("ufer.erlen").value);
if (erlen) {summe = summe + erlen};
var andere_baeume = parseInt(this.getField("ufer.andere_baeume").value);
if (andere_baeume) {summe = summe + andere_baeume};
var sonstiger_bewuchs = parseInt(this.getField("ufer.sonstiger_bewuchs").value);
if (sonstiger_bewuchs) {summe = summe + sonstiger_bewuchs};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_bewuchs").display = display.visible;
    this.getField("check_n_bewuchs").display = display.hidden;
  }
  else {
    this.getField("check_ok_bewuchs").display = display.hidden;
    this.getField("check_n_bewuchs").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.schilf_rohr:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.schilf_rohr:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var ohne_bewuchs = parseInt(this.getField("ufer.ohne_bewuchs").value);
if (ohne_bewuchs) {summe = summe + ohne_bewuchs};
var graeser = parseInt(this.getField("ufer.graeser").value);
if (graeser) {summe = summe + graeser};
var krautige_blattpflanzen = parseInt(this.getField("ufer.krautige_blattpflanzen").value);
if (krautige_blattpflanzen) {summe = summe + krautige_blattpflanzen};
var straeucher = parseInt(this.getField("ufer.straeucher").value);
if (straeucher) {summe = summe + straeucher};
var weiden = parseInt(this.getField("ufer.weiden").value);
if (weiden) {summe = summe + weiden};
var erlen = parseInt(this.getField("ufer.erlen").value);
if (erlen) {summe = summe + erlen};
var andere_baeume = parseInt(this.getField("ufer.andere_baeume").value);
if (andere_baeume) {summe = summe + andere_baeume};
var sonstiger_bewuchs = parseInt(this.getField("ufer.sonstiger_bewuchs").value);
if (sonstiger_bewuchs) {summe = summe + sonstiger_bewuchs};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_bewuchs").display = display.visible;
    this.getField("check_n_bewuchs").display = display.hidden;
  }
  else {
    this.getField("check_ok_bewuchs").display = display.hidden;
    this.getField("check_n_bewuchs").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.schraegufer:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.schraegufer:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var flachufer = parseInt(this.getField("ufer.flachufer").value);
if (flachufer) {summe = summe + flachufer};
var abbruch = parseInt(this.getField("ufer.abbruch").value);
if (abbruch) {summe = summe + abbruch};
var unterspuelung = parseInt(this.getField("ufer.unterspuelung").value);
if (unterspuelung) {summe = summe + unterspuelung};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_neigung").display = display.visible;
    this.getField("check_n_neigung").display = display.hidden;
  }
  else {
    this.getField("check_ok_neigung").display = display.hidden;
    this.getField("check_n_neigung").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.sonstiger_bewuchs:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.sonstiger_bewuchs:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var ohne_bewuchs = parseInt(this.getField("ufer.ohne_bewuchs").value);
if (ohne_bewuchs) {summe = summe + ohne_bewuchs};
var graeser = parseInt(this.getField("ufer.graeser").value);
if (graeser) {summe = summe + graeser};
var schilf_rohr = parseInt(this.getField("ufer.schilf_rohr").value);
if (schilf_rohr) {summe = summe + schilf_rohr};
var krautige_blattpflanzen = parseInt(this.getField("ufer.krautige_blattpflanzen").value);
if (krautige_blattpflanzen) {summe = summe + krautige_blattpflanzen};
var straeucher = parseInt(this.getField("ufer.straeucher").value);
if (straeucher) {summe = summe + straeucher};
var weiden = parseInt(this.getField("ufer.weiden").value);
if (weiden) {summe = summe + weiden};
var erlen = parseInt(this.getField("ufer.erlen").value);
if (erlen) {summe = summe + erlen};
var andere_baeume = parseInt(this.getField("ufer.andere_baeume").value);
if (andere_baeume) {summe = summe + andere_baeume};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_bewuchs").display = display.visible;
    this.getField("check_n_bewuchs").display = display.hidden;
  }
  else {
    this.getField("check_ok_bewuchs").display = display.hidden;
    this.getField("check_n_bewuchs").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.sonstiger_uferverbau:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.sonstiger_uferverbau:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var uferverbau_keiner = parseInt(this.getField("ufer.uferverbau_keiner").value);
if (uferverbau_keiner) {summe = summe + uferverbau_keiner};
var mauer_unverfugt = parseInt(this.getField("ufer.mauer_unverfugt").value);
if (mauer_unverfugt) {summe = summe + mauer_unverfugt};
var faschinen = parseInt(this.getField("ufer.faschinen").value);
if (faschinen) {summe = summe + faschinen};
var drahtnetze = parseInt(this.getField("ufer.drahtnetze").value);
if (drahtnetze) {summe = summe + drahtnetze};
var ueberwachsen = parseInt(this.getField("ufer.ueberwachsen").value);
if (ueberwachsen) {summe = summe + ueberwachsen};
var mauer_verfugt = parseInt(this.getField("ufer.mauer_verfugt").value);
if (mauer_verfugt) {summe = summe + mauer_verfugt};
var steinwurf = parseInt(this.getField("ufer.steinwurf").value);
if (steinwurf) {summe = summe + steinwurf};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_uferverbau").display = display.visible;
    this.getField("check_n_uferverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_uferverbau").display = display.hidden;
    this.getField("check_n_uferverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.steinwurf:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.steinwurf:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var uferverbau_keiner = parseInt(this.getField("ufer.uferverbau_keiner").value);
if (uferverbau_keiner) {summe = summe + uferverbau_keiner};
var mauer_unverfugt = parseInt(this.getField("ufer.mauer_unverfugt").value);
if (mauer_unverfugt) {summe = summe + mauer_unverfugt};
var faschinen = parseInt(this.getField("ufer.faschinen").value);
if (faschinen) {summe = summe + faschinen};
var drahtnetze = parseInt(this.getField("ufer.drahtnetze").value);
if (drahtnetze) {summe = summe + drahtnetze};
var ueberwachsen = parseInt(this.getField("ufer.ueberwachsen").value);
if (ueberwachsen) {summe = summe + ueberwachsen};
var mauer_verfugt = parseInt(this.getField("ufer.mauer_verfugt").value);
if (mauer_verfugt) {summe = summe + mauer_verfugt};
var sonstiger_uferverbau = parseInt(this.getField("ufer.sonstiger_uferverbau").value);
if (sonstiger_uferverbau) {summe = summe + sonstiger_uferverbau};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_uferverbau").display = display.visible;
    this.getField("check_n_uferverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_uferverbau").display = display.hidden;
    this.getField("check_n_uferverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.straeucher:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.straeucher:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var ohne_bewuchs = parseInt(this.getField("ufer.ohne_bewuchs").value);
if (ohne_bewuchs) {summe = summe + ohne_bewuchs};
var graeser = parseInt(this.getField("ufer.graeser").value);
if (graeser) {summe = summe + graeser};
var schilf_rohr = parseInt(this.getField("ufer.schilf_rohr").value);
if (schilf_rohr) {summe = summe + schilf_rohr};
var krautige_blattpflanzen = parseInt(this.getField("ufer.krautige_blattpflanzen").value);
if (krautige_blattpflanzen) {summe = summe + krautige_blattpflanzen};
var weiden = parseInt(this.getField("ufer.weiden").value);
if (weiden) {summe = summe + weiden};
var erlen = parseInt(this.getField("ufer.erlen").value);
if (erlen) {summe = summe + erlen};
var andere_baeume = parseInt(this.getField("ufer.andere_baeume").value);
if (andere_baeume) {summe = summe + andere_baeume};
var sonstiger_bewuchs = parseInt(this.getField("ufer.sonstiger_bewuchs").value);
if (sonstiger_bewuchs) {summe = summe + sonstiger_bewuchs};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_bewuchs").display = display.visible;
    this.getField("check_n_bewuchs").display = display.hidden;
  }
  else {
    this.getField("check_ok_bewuchs").display = display.hidden;
    this.getField("check_n_bewuchs").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.ueberwachsen:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.ueberwachsen:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var uferverbau_keiner = parseInt(this.getField("ufer.uferverbau_keiner").value);
if (uferverbau_keiner) {summe = summe + uferverbau_keiner};
var mauer_unverfugt = parseInt(this.getField("ufer.mauer_unverfugt").value);
if (mauer_unverfugt) {summe = summe + mauer_unverfugt};
var faschinen = parseInt(this.getField("ufer.faschinen").value);
if (faschinen) {summe = summe + faschinen};
var drahtnetze = parseInt(this.getField("ufer.drahtnetze").value);
if (drahtnetze) {summe = summe + drahtnetze};
var mauer_verfugt = parseInt(this.getField("ufer.mauer_verfugt").value);
if (mauer_verfugt) {summe = summe + mauer_verfugt};
var steinwurf = parseInt(this.getField("ufer.steinwurf").value);
if (steinwurf) {summe = summe + steinwurf};
var sonstiger_uferverbau = parseInt(this.getField("ufer.sonstiger_uferverbau").value);
if (sonstiger_uferverbau) {summe = summe + sonstiger_uferverbau};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_uferverbau").display = display.visible;
    this.getField("check_n_uferverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_uferverbau").display = display.hidden;
    this.getField("check_n_uferverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.uferverbau_keiner:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.uferverbau_keiner:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var mauer_unverfugt = parseInt(this.getField("ufer.mauer_unverfugt").value);
if (mauer_unverfugt) {summe = summe + mauer_unverfugt};
var faschinen = parseInt(this.getField("ufer.faschinen").value);
if (faschinen) {summe = summe + faschinen};
var drahtnetze = parseInt(this.getField("ufer.drahtnetze").value);
if (drahtnetze) {summe = summe + drahtnetze};
var ueberwachsen = parseInt(this.getField("ufer.ueberwachsen").value);
if (ueberwachsen) {summe = summe + ueberwachsen};
var mauer_verfugt = parseInt(this.getField("ufer.mauer_verfugt").value);
if (mauer_verfugt) {summe = summe + mauer_verfugt};
var steinwurf = parseInt(this.getField("ufer.steinwurf").value);
if (steinwurf) {summe = summe + steinwurf};
var sonstiger_uferverbau = parseInt(this.getField("ufer.sonstiger_uferverbau").value);
if (sonstiger_uferverbau) {summe = summe + sonstiger_uferverbau};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_uferverbau").display = display.visible;
    this.getField("check_n_uferverbau").display = display.hidden;
  }
  else {
    this.getField("check_ok_uferverbau").display = display.hidden;
    this.getField("check_n_uferverbau").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.unterspuelung:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.unterspuelung:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var flachufer = parseInt(this.getField("ufer.flachufer").value);
if (flachufer) {summe = summe + flachufer};
var schraegufer = parseInt(this.getField("ufer.schraegufer").value);
if (schraegufer) {summe = summe + schraegufer};
var abbruch = parseInt(this.getField("ufer.abbruch").value);
if (abbruch) {summe = summe + abbruch};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_neigung").display = display.visible;
    this.getField("check_n_neigung").display = display.hidden;
  }
  else {
    this.getField("check_ok_neigung").display = display.hidden;
    this.getField("check_n_neigung").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>ufer.weiden:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:ufer.weiden:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var ohne_bewuchs = parseInt(this.getField("ufer.ohne_bewuchs").value);
if (ohne_bewuchs) {summe = summe + ohne_bewuchs};
var graeser = parseInt(this.getField("ufer.graeser").value);
if (graeser) {summe = summe + graeser};
var schilf_rohr = parseInt(this.getField("ufer.schilf_rohr").value);
if (schilf_rohr) {summe = summe + schilf_rohr};
var krautige_blattpflanzen = parseInt(this.getField("ufer.krautige_blattpflanzen").value);
if (krautige_blattpflanzen) {summe = summe + krautige_blattpflanzen};
var straeucher = parseInt(this.getField("ufer.straeucher").value);
if (straeucher) {summe = summe + straeucher};
var erlen = parseInt(this.getField("ufer.erlen").value);
if (erlen) {summe = summe + erlen};
var andere_baeume = parseInt(this.getField("ufer.andere_baeume").value);
if (andere_baeume) {summe = summe + andere_baeume};
var sonstiger_bewuchs = parseInt(this.getField("ufer.sonstiger_bewuchs").value);
if (sonstiger_bewuchs) {summe = summe + sonstiger_bewuchs};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_bewuchs").display = display.visible;
    this.getField("check_n_bewuchs").display = display.hidden;
  }
  else {
    this.getField("check_ok_bewuchs").display = display.hidden;
    this.getField("check_n_bewuchs").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>umland.auwald:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:umland.auwald:Validate ***********/







var summe = 0;
var nadelwald = parseInt(this.getField("umland.nadelwald").value);
if (nadelwald) {summe = summe + nadelwald;}
var mischwald = parseInt(this.getField("umland.mischwald").value);
if (mischwald) {summe = summe + mischwald};
var laubwald = parseInt(this.getField("umland.laubwald").value);
if (laubwald) {summe = summe + laubwald};
summe = summe + parseInt(event.value);
var wiese = parseInt(this.getField("umland.wiese").value);
if (wiese) {summe = summe + wiese};
var kulturland_acker = parseInt(this.getField("umland.kulturland_acker").value);
if (kulturland_acker) {summe = summe + kulturland_acker};
var feuchtgebiet_moor = parseInt(this.getField("umland.feuchtgebiet_moor").value);
if (feuchtgebiet_moor) {summe = summe + feuchtgebiet_moor};
var siedlungsgebiet = parseInt(this.getField("umland.siedlungsgebiet").value);
if (siedlungsgebiet) {summe = summe + siedlungsgebiet};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_umland").checkThisBox(0,true);
    this.getField("check_ok_umland").display = display.visible;
    this.getField("check_n_umland").display = display.hidden;
  }
  else {
    this.getField("check_ok_umland").checkThisBox(0,false);
    this.getField("check_ok_umland").display = display.hidden;
    this.getField("check_n_umland").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>umland.feuchtgebiet_moor:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:umland.feuchtgebiet_moor:Validate ***********/







var summe = 0;
var nadelwald = parseInt(this.getField("umland.nadelwald").value);
if (nadelwald) {summe = summe + nadelwald;}
var mischwald = parseInt(this.getField("umland.mischwald").value);
if (mischwald) {summe = summe + mischwald};
var laubwald = parseInt(this.getField("umland.laubwald").value);
if (laubwald) {summe = summe + laubwald};
var auwald = parseInt(this.getField("umland.auwald").value);
if (auwald) {summe = summe + auwald};
var wiese = parseInt(this.getField("umland.wiese").value);
if (wiese) {summe = summe + wiese};
var kulturland_acker = parseInt(this.getField("umland.kulturland_acker").value);
if (kulturland_acker) {summe = summe + kulturland_acker};
summe = summe + parseInt(event.value);
var siedlungsgebiet = parseInt(this.getField("umland.siedlungsgebiet").value);
if (siedlungsgebiet) {summe = summe + siedlungsgebiet};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_umland").checkThisBox(0,true);
    this.getField("check_ok_umland").display = display.visible;
    this.getField("check_n_umland").display = display.hidden;
  }
  else {
    this.getField("check_ok_umland").checkThisBox(0,false);
    this.getField("check_ok_umland").display = display.hidden;
    this.getField("check_n_umland").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>umland.kulturland_acker:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:umland.kulturland_acker:Validate ***********/







var summe = 0;
var nadelwald = parseInt(this.getField("umland.nadelwald").value);
if (nadelwald) {summe = summe + nadelwald;}
var mischwald = parseInt(this.getField("umland.mischwald").value);
if (mischwald) {summe = summe + mischwald};
var laubwald = parseInt(this.getField("umland.laubwald").value);
if (laubwald) {summe = summe + laubwald};
var auwald = parseInt(this.getField("umland.auwald").value);
if (auwald) {summe = summe + auwald};
var wiese = parseInt(this.getField("umland.wiese").value);
if (wiese) {summe = summe + wiese};
summe = summe + parseInt(event.value);
var feuchtgebiet_moor = parseInt(this.getField("umland.feuchtgebiet_moor").value);
if (feuchtgebiet_moor) {summe = summe + feuchtgebiet_moor};
var siedlungsgebiet = parseInt(this.getField("umland.siedlungsgebiet").value);
if (siedlungsgebiet) {summe = summe + siedlungsgebiet};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_umland").checkThisBox(0,true);
    this.getField("check_ok_umland").display = display.visible;
    this.getField("check_n_umland").display = display.hidden;
  }
  else {
    this.getField("check_ok_umland").checkThisBox(0,false);
    this.getField("check_ok_umland").display = display.hidden;
    this.getField("check_n_umland").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>umland.laubwald:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:umland.laubwald:Validate ***********/







var summe = 0;
var nadelwald = parseInt(this.getField("umland.nadelwald").value);
if (nadelwald) {summe = summe + nadelwald;}
var mischwald = parseInt(this.getField("umland.mischwald").value);
if (mischwald) {summe = summe + mischwald};
var auwald = parseInt(this.getField("umland.auwald").value);
if (auwald) {summe = summe + auwald};
summe = summe + parseInt(event.value);
var wiese = parseInt(this.getField("umland.wiese").value);
if (wiese) {summe = summe + wiese};
var kulturland_acker = parseInt(this.getField("umland.kulturland_acker").value);
if (kulturland_acker) {summe = summe + kulturland_acker};
var feuchtgebiet_moor = parseInt(this.getField("umland.feuchtgebiet_moor").value);
if (feuchtgebiet_moor) {summe = summe + feuchtgebiet_moor};
var siedlungsgebiet = parseInt(this.getField("umland.siedlungsgebiet").value);
if (siedlungsgebiet) {summe = summe + siedlungsgebiet};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_umland").checkThisBox(0,true);
    this.getField("check_ok_umland").display = display.visible;
    this.getField("check_n_umland").display = display.hidden;
  }
  else {
    this.getField("check_ok_umland").checkThisBox(0,false);
    this.getField("check_ok_umland").display = display.hidden;
    this.getField("check_n_umland").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>umland.mischwald:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:umland.mischwald:Validate ***********/







var summe = 0;
var nadelwald = parseInt(this.getField("umland.nadelwald").value);
if (nadelwald) {summe = summe + nadelwald;}
summe = summe + parseInt(event.value);
var laubwald = parseInt(this.getField("umland.laubwald").value);
if (laubwald) {summe = summe + laubwald};
var auwald = parseInt(this.getField("umland.auwald").value);
if (auwald) {summe = summe + auwald};
var wiese = parseInt(this.getField("umland.wiese").value);
if (wiese) {summe = summe + wiese};
var kulturland_acker = parseInt(this.getField("umland.kulturland_acker").value);
if (kulturland_acker) {summe = summe + kulturland_acker};
var feuchtgebiet_moor = parseInt(this.getField("umland.feuchtgebiet_moor").value);
if (feuchtgebiet_moor) {summe = summe + feuchtgebiet_moor};
var siedlungsgebiet = parseInt(this.getField("umland.siedlungsgebiet").value);
if (siedlungsgebiet) {summe = summe + siedlungsgebiet};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_umland").checkThisBox(0,true);
    this.getField("check_ok_umland").display = display.visible;
    this.getField("check_n_umland").display = display.hidden;
  }
  else {
    this.getField("check_ok_umland").checkThisBox(0,false);
    this.getField("check_ok_umland").display = display.hidden;
    this.getField("check_n_umland").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>umland.nadelwald:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:umland.nadelwald:Validate ***********/







var summe = 0;
summe = summe + parseInt(event.value);
var mischwald = parseInt(this.getField("umland.mischwald").value);
if (mischwald) {summe = summe + mischwald};
var laubwald = parseInt(this.getField("umland.laubwald").value);
if (laubwald) {summe = summe + laubwald};
var auwald = parseInt(this.getField("umland.auwald").value);
if (auwald) {summe = summe + auwald};
var wiese = parseInt(this.getField("umland.wiese").value);
if (wiese) {summe = summe + wiese};
var kulturland_acker = parseInt(this.getField("umland.kulturland_acker").value);
if (kulturland_acker) {summe = summe + kulturland_acker};
var feuchtgebiet_moor = parseInt(this.getField("umland.feuchtgebiet_moor").value);
if (feuchtgebiet_moor) {summe = summe + feuchtgebiet_moor};
var siedlungsgebiet = parseInt(this.getField("umland.siedlungsgebiet").value);
if (siedlungsgebiet) {summe = summe + siedlungsgebiet};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_umland").checkThisBox(0,true);
    this.getField("check_ok_umland").display = display.visible;
    this.getField("check_n_umland").display = display.hidden;
  }
  else {
    this.getField("check_ok_umland").checkThisBox(0,false);
    this.getField("check_ok_umland").display = display.hidden;
    this.getField("check_n_umland").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>umland.siedlungsgebiet:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:umland.siedlungsgebiet:Validate ***********/







var summe = 0;
var nadelwald = parseInt(this.getField("umland.nadelwald").value);
if (nadelwald) {summe = summe + nadelwald;}
var mischwald = parseInt(this.getField("umland.mischwald").value);
if (mischwald) {summe = summe + mischwald};
var laubwald = parseInt(this.getField("umland.laubwald").value);
if (laubwald) {summe = summe + laubwald};
var auwald = parseInt(this.getField("umland.auwald").value);
if (auwald) {summe = summe + auwald};
var wiese = parseInt(this.getField("umland.wiese").value);
if (wiese) {summe = summe + wiese};
var kulturland_acker = parseInt(this.getField("umland.kulturland_acker").value);
if (kulturland_acker) {summe = summe + kulturland_acker};
var feuchtgebiet_moor = parseInt(this.getField("umland.feuchtgebiet_moor").value);
if (feuchtgebiet_moor) {summe = summe + feuchtgebiet_moor};
summe = summe + parseInt(event.value);
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_umland").checkThisBox(0,true);
    this.getField("check_ok_umland").display = display.visible;
    this.getField("check_n_umland").display = display.hidden;
  }
  else {
    this.getField("check_ok_umland").checkThisBox(0,false);
    this.getField("check_ok_umland").display = display.hidden;
    this.getField("check_n_umland").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>

//<AcroForm>
//<ACRO_source>umland.wiese:Validate</ACRO_source>
//<ACRO_script>
/*********** gehört zu: AcroForm:umland.wiese:Validate ***********/







var summe = 0;
var nadelwald = parseInt(this.getField("umland.nadelwald").value);
if (nadelwald) {summe = summe + nadelwald;}
var mischwald = parseInt(this.getField("umland.mischwald").value);
if (mischwald) {summe = summe + mischwald};
var laubwald = parseInt(this.getField("umland.laubwald").value);
if (laubwald) {summe = summe + laubwald};
var auwald = parseInt(this.getField("umland.auwald").value);
if (auwald) {summe = summe + auwald};
summe = summe + parseInt(event.value);
var kulturland_acker = parseInt(this.getField("umland.kulturland_acker").value);
if (kulturland_acker) {summe = summe + kulturland_acker};
var feuchtgebiet_moor = parseInt(this.getField("umland.feuchtgebiet_moor").value);
if (feuchtgebiet_moor) {summe = summe + feuchtgebiet_moor};
var siedlungsgebiet = parseInt(this.getField("umland.siedlungsgebiet").value);
if (siedlungsgebiet) {summe = summe + siedlungsgebiet};
if (summe > 100)
{
  app.alert(unescape("Der Wert von 100 darf nicht #fcberschritten werden"),1,0);
  event.rc = false;
}
else {
  event.rc = true;
  if (summe == 100) {
    this.getField("check_ok_umland").checkThisBox(0,true);
    this.getField("check_ok_umland").display = display.visible;
    this.getField("check_n_umland").display = display.hidden;
  }
  else {
    this.getField("check_ok_umland").checkThisBox(0,false);
    this.getField("check_ok_umland").display = display.hidden;
    this.getField("check_n_umland").display = display.visible;
  }  
}
//</ACRO_script>
//</AcroForm>


