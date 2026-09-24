/**
 * Widget prenotazioni — file unico da incollare nel sito cliente. Zero server:
 * la richiesta parte come messaggio WhatsApp precompilato dal telefono del visitatore,
 * l'attività conferma rispondendo. Niente doppie prenotazioni, niente backend.
 *
 * <script src="https://.../widget-prenota.js"
 *         data-nome="El Filò"
 *         data-whatsapp="393712345678"          <- numero WhatsApp dell'attività, solo cifre con prefisso
 *         data-telefono="+39 0461 123456"       <- fallback "preferisci chiamare?"
 *         data-colore="#5a3e2b"
 *         data-tipo="tavolo"                    <- tavolo | appuntamento | camera
 *         data-orari="12:00-14:00,19:00-21:30"  <- finestre prenotabili, ultimo orario = ultimo slot (step 30 min)
 *         data-chiuso="lun"                     <- giorni di chiusura: dom,lun,mar,mer,gio,ven,sab
 *         data-servizi="Taglio,Colore,Piega"    <- solo tipo=appuntamento
 *         data-anticipo-min-ore="2"             <- niente slot tra meno di N ore (default 2)
 *         data-max-giorni="60"                  <- prenotabile fino a N giorni avanti (default 60)
 *         data-posizione="sinistra"></script>   <- bottone flottante: sinistra (default) o destra
 *
 * Modalità inline: se nella pagina esiste <div id="prenota-widget"></div>, il modulo
 * viene mostrato lì (sezione "Prenota" del sito) invece del bottone flottante.
 * Tipo "camera": check-in/check-out/ospiti, niente orari (richiesta disponibilità).
 */
(function () {
  var script = document.currentScript ||
    (function () { var s = document.getElementsByTagName("script"); return s[s.length - 1]; })();
  function attr(n, dft) { var v = script.getAttribute(n); return v === null || v === "" ? dft : v; }

  var NOME = attr("data-nome", "Attività");
  var WHATSAPP = attr("data-whatsapp", "").replace(/\D/g, "");
  var TELEFONO = attr("data-telefono", "");
  var COLORE = attr("data-colore", "#1f6f43");
  var TIPO = attr("data-tipo", "tavolo"); // tavolo | appuntamento | camera
  var CHIUSO = attr("data-chiuso", "").toLowerCase().split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  var SERVIZI = attr("data-servizi", "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  var ANTICIPO_ORE = parseFloat(attr("data-anticipo-min-ore", "2")) || 0;
  var MAX_GIORNI = parseInt(attr("data-max-giorni", "60"), 10) || 60;
  var LATO = attr("data-posizione", "sinistra") === "destra" ? "right" : "left";
  var ETICHETTA = attr("data-etichetta", TIPO === "camera" ? "Verifica disponibilità" : "Prenota");
  // Esempio nelle note: dipende dal tipo di attività, sovrascrivibile con data-nota-esempio
  var NOTA_ESEMPIO = attr("data-nota-esempio",
    TIPO === "appuntamento" ? "es. capelli molto lunghi, ho già fatto una tinta..."
    : TIPO === "camera" ? "es. letto aggiuntivo, arrivo in tarda serata..."
    : "es. seggiolone, terrazza...");

  var GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  var MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
              "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

  // ---------- Slot orari da data-orari ----------
  function parseSlots(spec) {
    var out = [];
    spec.split(",").forEach(function (win) {
      var m = win.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
      if (!m) return;
      var t = +m[1] * 60 + +m[2], end = +m[3] * 60 + +m[4];
      for (; t <= end; t += 30) {
        out.push(("0" + Math.floor(t / 60)).slice(-2) + ":" + ("0" + (t % 60)).slice(-2));
      }
    });
    return out;
  }
  var SLOTS = parseSlots(attr("data-orari", "12:00-14:00,19:00-21:30"));

  function pad(n) { return ("0" + n).slice(-2); }
  function isoData(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function dataLeggibile(iso) {
    var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return GIORNI[d.getDay()] + " " + d.getDate() + " " + MESI[d.getMonth()] + " " + p[0];
  }
  function giornoChiuso(iso) {
    var p = iso.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    return CHIUSO.indexOf(GIORNI[d.getDay()]) > -1;
  }
  // slot disponibili per la data scelta (oggi: rispetta l'anticipo minimo)
  function slotsPer(iso) {
    var oggi = new Date();
    if (iso !== isoData(oggi)) return SLOTS;
    var minuti = oggi.getHours() * 60 + oggi.getMinutes() + ANTICIPO_ORE * 60;
    return SLOTS.filter(function (s) {
      var p = s.split(":");
      return +p[0] * 60 + +p[1] >= minuti;
    });
  }

  // ---------- Stili ----------
  var css =
    "#pw-fab{position:fixed;bottom:20px;" + LATO + ":20px;padding:14px 22px;border-radius:999px;" +
    "background:" + COLORE + ";color:#fff;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25);" +
    "font-size:15px;font-weight:700;z-index:99996;font-family:system-ui,sans-serif;transition:transform .15s}" +
    "#pw-fab:hover{transform:scale(1.05)}" +
    "#pw-panel{position:fixed;bottom:78px;" + LATO + ":20px;width:340px;max-width:calc(100vw - 40px);" +
    "max-height:calc(100vh - 110px);overflow-y:auto;background:#fff;border-radius:14px;" +
    "box-shadow:0 8px 30px rgba(0,0,0,.3);display:none;z-index:99997;font-family:system-ui,sans-serif}" +
    "#pw-panel.open{display:block}" +
    "#pw-panel.pw-inline{position:static;display:block;box-shadow:0 2px 14px rgba(0,0,0,.12);max-height:none;width:100%;max-width:420px}" +
    ".pw-header{background:" + COLORE + ";color:#fff;padding:14px 16px;font-weight:600;font-size:15px;" +
    "display:flex;justify-content:space-between;align-items:center;border-radius:14px 14px 0 0}" +
    "#pw-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1}" +
    ".pw-body{padding:14px 16px;display:flex;flex-direction:column;gap:10px}" +
    ".pw-body label{font-size:12.5px;font-weight:600;color:#444;display:block;margin-bottom:3px}" +
    ".pw-body input,.pw-body select,.pw-body textarea{width:100%;box-sizing:border-box;padding:9px 10px;" +
    "border:1px solid #d5d8dc;border-radius:8px;font-size:14px;font-family:inherit;background:#fff;color:#222}" +
    ".pw-body textarea{resize:vertical;min-height:52px}" +
    ".pw-row{display:flex;gap:8px}.pw-row>div{flex:1}" +
    ".pw-err{color:#b3261e;font-size:12.5px;display:none}" +
    "#pw-invia{background:" + COLORE + ";color:#fff;border:none;border-radius:8px;padding:12px;font-size:15px;" +
    "font-weight:700;cursor:pointer;font-family:inherit}" +
    "#pw-invia:hover{filter:brightness(1.08)}" +
    ".pw-foot{font-size:12.5px;color:#666;text-align:center;padding:0 16px 14px}" +
    ".pw-foot a{color:" + COLORE + ";font-weight:600;text-decoration:none}" +
    ".pw-ok{padding:22px 18px;text-align:center;font-size:14.5px;color:#222;line-height:1.5}" +
    ".pw-ok .pw-check{font-size:34px;display:block;margin-bottom:8px}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- Campi per tipo ----------
  var oggi = new Date();
  var minData = isoData(oggi);
  var maxD = new Date(oggi.getTime() + MAX_GIORNI * 86400000);
  var maxData = isoData(maxD);

  function campoData(id, label) {
    return '<div><label for="' + id + '">' + label + '</label>' +
      '<input type="date" id="' + id + '" min="' + minData + '" max="' + maxData + '" required>' +
      '<div class="pw-err" id="' + id + '-err"></div></div>';
  }
  function campoOra() {
    return '<div><label for="pw-ora">Ora</label><select id="pw-ora" required></select>' +
      '<div class="pw-err" id="pw-ora-err"></div></div>';
  }

  var campi = "";
  if (TIPO === "camera") {
    campi =
      '<div class="pw-row">' + campoData("pw-checkin", "Check-in") + campoData("pw-checkout", "Check-out") + "</div>" +
      '<div><label for="pw-ospiti">Ospiti</label><select id="pw-ospiti">' +
      [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<option' + (n === 2 ? " selected" : "") + ">" + n + "</option>"; }).join("") +
      "</select></div>";
  } else {
    var terzo;
    if (TIPO === "appuntamento") {
      terzo = SERVIZI.length
        ? '<div><label for="pw-servizio">Servizio</label><select id="pw-servizio">' +
          SERVIZI.map(function (s) { return "<option>" + s + "</option>"; }).join("") + "</select></div>"
        : '<div><label for="pw-servizio">Servizio richiesto</label><input type="text" id="pw-servizio" placeholder="es. taglio"></div>';
    } else {
      terzo = '<div><label for="pw-persone">Persone</label><select id="pw-persone">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n) { return '<option' + (n === 2 ? " selected" : "") + ">" + n + "</option>"; }).join("") +
        '<option value="13+">più di 12</option></select></div>';
    }
    campi = '<div class="pw-row">' + campoData("pw-data", "Giorno") + campoOra() + "</div>" + terzo;
  }

  var formHtml =
    '<div class="pw-body">' +
    campi +
    '<div><label for="pw-nome">Nome</label><input type="text" id="pw-nome" maxlength="60" required placeholder="Il tuo nome">' +
    '<div class="pw-err" id="pw-nome-err"></div></div>' +
    '<div><label for="pw-note">Note (facoltative)</label><textarea id="pw-note" maxlength="200" placeholder="' + NOTA_ESEMPIO + '"></textarea></div>' +
    '<button id="pw-invia" type="button">' + (WHATSAPP ? "Invia richiesta su WhatsApp" : "Chiama per prenotare") + "</button>" +
    "</div>" +
    (TELEFONO ? '<div class="pw-foot">Preferisci parlare? <a href="tel:' + TELEFONO.replace(/\s/g, "") + '">' + TELEFONO + "</a></div>" : "");

  // ---------- DOM: inline oppure flottante ----------
  var inlineHost = document.getElementById("prenota-widget");
  var panel = document.createElement("div");
  panel.id = "pw-panel";
  panel.innerHTML =
    '<div class="pw-header"><span>' + esc(ETICHETTA) + " — " + esc(NOME) + "</span>" +
    (inlineHost ? "" : '<button id="pw-close" aria-label="Chiudi">&times;</button>') +
    "</div>" + formHtml;

  if (inlineHost) {
    panel.className = "pw-inline";
    inlineHost.appendChild(panel);
  } else {
    var fab = document.createElement("button");
    fab.id = "pw-fab";
    fab.textContent = ETICHETTA;
    document.body.appendChild(fab);
    document.body.appendChild(panel);
    fab.addEventListener("click", function () {
      panel.classList.toggle("open");
    });
    panel.querySelector("#pw-close").addEventListener("click", function () {
      panel.classList.remove("open");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") panel.classList.remove("open");
    });
  }

  // ---------- Logica date/orari ----------
  function el(id) { return panel.querySelector("#" + id); }
  function err(id, msg) {
    var box = el(id + "-err");
    if (!box) return;
    box.textContent = msg || "";
    box.style.display = msg ? "block" : "none";
  }

  if (TIPO !== "camera") {
    var dataInput = el("pw-data"), oraSelect = el("pw-ora");
    function aggiornaOre() {
      err("pw-data", "");
      var iso = dataInput.value;
      oraSelect.innerHTML = "";
      if (!iso) return;
      if (giornoChiuso(iso)) {
        err("pw-data", "Il " + dataLeggibile(iso).split(" ")[0] + " siamo chiusi — scegli un altro giorno.");
        return;
      }
      var slots = slotsPer(iso);
      if (!slots.length) {
        err("pw-data", "Per oggi non ci sono più orari prenotabili online: chiamaci!");
        return;
      }
      oraSelect.innerHTML = slots.map(function (s) { return "<option>" + s + "</option>"; }).join("");
    }
    dataInput.addEventListener("change", aggiornaOre);
  }

  // ---------- Invio ----------
  el("pw-invia").addEventListener("click", function () {
    var nome = el("pw-nome").value.trim();
    err("pw-nome", nome ? "" : "Serve il tuo nome.");
    if (!nome) return;
    var note = el("pw-note").value.trim();
    var righe = [];

    if (TIPO === "camera") {
      var ci = el("pw-checkin").value, co = el("pw-checkout").value;
      err("pw-checkin", ci ? "" : "Scegli la data.");
      err("pw-checkout", co ? "" : "Scegli la data.");
      if (!ci || !co) return;
      if (co <= ci) { err("pw-checkout", "Il check-out deve essere dopo il check-in."); return; }
      righe = ["Richiesta disponibilità camera — " + NOME,
               "Check-in: " + dataLeggibile(ci),
               "Check-out: " + dataLeggibile(co),
               "Ospiti: " + el("pw-ospiti").value];
    } else {
      var iso = el("pw-data").value, ora = el("pw-ora").value;
      err("pw-data", iso ? "" : "Scegli il giorno.");
      if (!iso) return;
      if (giornoChiuso(iso) || !ora) { err("pw-data", giornoChiuso(iso) ? "Quel giorno siamo chiusi." : "Scegli un orario."); return; }
      if (TIPO === "appuntamento") {
        var serv = el("pw-servizio").value.trim();
        righe = ["Richiesta appuntamento — " + NOME,
                 "Giorno: " + dataLeggibile(iso) + " alle " + ora].concat(serv ? ["Servizio: " + serv] : []);
      } else {
        righe = ["Richiesta prenotazione tavolo — " + NOME,
                 "Giorno: " + dataLeggibile(iso) + " alle " + ora,
                 "Persone: " + el("pw-persone").value];
      }
    }
    righe.push("Nome: " + nome);
    if (note) righe.push("Note: " + note);

    var testo = righe.join("\n");
    if (WHATSAPP) {
      window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(testo), "_blank", "noopener");
      conferma(
        '<span class="pw-check">&#9989;</span>Ti abbiamo aperto WhatsApp col messaggio già pronto: <strong>premi invia</strong> per completare la richiesta.<br><br>' +
        esc(NOME) + " ti risponderà per confermare." +
        (TELEFONO ? '<br><br>Non si è aperto? Chiama <a href="tel:' + TELEFONO.replace(/\s/g, "") + '" style="color:' + COLORE + ';font-weight:700">' + esc(TELEFONO) + "</a>" : "")
      );
    } else if (TELEFONO) {
      window.location.href = "tel:" + TELEFONO.replace(/\s/g, "");
    }
  });

  function conferma(html) {
    panel.querySelector(".pw-body").outerHTML = '<div class="pw-ok">' + html + "</div>";
    var foot = panel.querySelector(".pw-foot");
    if (foot) foot.remove();
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
