const geraeteId = "SPAR001";

// -------------------------------
// Münzbestand laden
// -------------------------------
async function ladeMuenzbestand() {
  try {
    const response = await fetch(`/api/muenzbestand.php?geraete_id=${geraeteId}`);
    const data = await response.json();

    if (data.status === "success") {
      document.getElementById("muenzbestand").textContent = data.gesamtbetrag;
    } else {
      document.getElementById("muenzbestand").textContent = "0.00";
    }
  } catch (error) {
    console.error("Fehler beim Laden des Muenzbestands:", error);
    document.getElementById("muenzbestand").textContent = "Fehler";
  }
}

// -------------------------------
// Sparziel laden
// -------------------------------
async function ladeSparziel() {
  try {
    const response = await fetch(`/api/sparziel.php?geraete_id=${geraeteId}`);
    const data = await response.json();

    const zielErreichtBtn = document.getElementById("zielErreichtBtn");

    if (data.status === "success") {
      document.getElementById("sparzielTitel").textContent = data.titel;
      document.getElementById("sparzielBetrag").textContent =
        Number(data.ziel_betrag).toFixed(2);
      document.getElementById("fortschritt").textContent = data.fortschritt;

      // Button nur anzeigen, wenn Sparziel erreicht ist
      if (Number(data.fortschritt) >= 100) {
        zielErreichtBtn.style.display = "block";
      } else {
        zielErreichtBtn.style.display = "none";
      }
    } else {
      document.getElementById("sparzielTitel").textContent = "Noch kein Ziel";
      document.getElementById("sparzielBetrag").textContent = "0.00";
      document.getElementById("fortschritt").textContent = "0";

      if (zielErreichtBtn) {
        zielErreichtBtn.style.display = "none";
      }
    }
  } catch (error) {
    console.error("Fehler beim Laden des Sparziels:", error);
  }
}

// -------------------------------
// Neues Sparziel speichern
// -------------------------------
async function speichereSparziel(event) {
  event.preventDefault();

  const titel = document.getElementById("titel").value.trim();
  const zielBetrag = document.getElementById("zielBetrag").value;

  if (titel === "" || Number(zielBetrag) <= 0) {
    alert("Bitte gib ein gueltiges Sparziel ein.");
    return;
  }

  try {
    const response = await fetch("/api/sparziel_erstellen.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        geraete_id: geraeteId,
        titel: titel,
        ziel_betrag: zielBetrag,
      }),
    });

    const data = await response.json();

    if (data.status === "success") {
      alert("Sparziel gespeichert");

      document.getElementById("sparzielForm").reset();

      await ladeMuenzbestand();
      await ladeSparziel();
    } else {
      alert(data.message || "Sparziel konnte nicht gespeichert werden.");
    }
  } catch (error) {
    console.error("Fehler beim Speichern des Sparziels:", error);
    alert("Fehler beim Speichern");
  }
}

// -------------------------------
// Sparziel abschliessen
// -------------------------------
async function schliesseSparzielAb() {
  try {
    const response = await fetch("/api/sparziel_abschliessen.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        geraete_id: geraeteId,
      }),
    });

    const data = await response.json();

    if (data.status === "success") {
      alert("Sparziel abgeschlossen. Du kannst jetzt ein neues Ziel eingeben.");

      document.getElementById("sparzielTitel").textContent = "Noch kein Ziel";
      document.getElementById("sparzielBetrag").textContent = "0.00";
      document.getElementById("fortschritt").textContent = "0";
      document.getElementById("zielErreichtBtn").style.display = "none";

      document.getElementById("sparzielForm").reset();

      await ladeMuenzbestand();
      await ladeSparziel();
    } else {
      alert(data.message || "Sparziel konnte nicht abgeschlossen werden.");
    }
  } catch (error) {
    console.error("Fehler beim Abschliessen:", error);
    alert("Fehler beim Abschliessen");
  }
}

// -------------------------------
// Beim Laden der Seite starten
// -------------------------------
window.addEventListener("load", () => {
  ladeMuenzbestand();
  ladeSparziel();

  const form = document.getElementById("sparzielForm");
  const zielErreichtBtn = document.getElementById("zielErreichtBtn");

  if (form) {
    form.addEventListener("submit", speichereSparziel);
  }

  if (zielErreichtBtn) {
    zielErreichtBtn.addEventListener("click", schliesseSparzielAb);
  }

  // Alle 10 Sekunden automatisch aktualisieren
  setInterval(() => {
    ladeMuenzbestand();
    ladeSparziel();
  }, 10000);
});