// js/protected.js

// Die ID des physischen Sparschweins (muss in deiner DB existieren!)
const GERAETE_ID = "SPAR001"; 

// 1. Authentifizierung prüfen (aus deiner originalen protected.js)
async function checkAuth() {
  try {
    const response = await fetch("api/protected.php", {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "login.html";
      return false;
    }

    const result = await response.json();

    // Begrüssung im Header aktualisieren
    document.getElementById("userFirstName").textContent = result.first_name || '';
    
    // Auth erfolgreich -> Lade jetzt die Sparschwein-Daten!
    ladeDashboardDaten();

    return true;
  } catch (error) {
    console.error("Auth check failed:", error);
    window.location.href = "login.html";
    return false;
  }
}

// 2. Daten von der API laden und ins neue UI einfügen
async function ladeDashboardDaten() {
  try {
    // --- Sparziel laden ---
    const goalResponse = await fetch(`api/sparziel.php?geraete_id=${GERAETE_ID}`);
    const goalData = await goalResponse.json();

    const isGoalActive = goalData.status === "success";
    const zielBetrag = parseFloat(goalData.ziel_betrag || 0).toFixed(2);
    const fortschritt = parseFloat(goalData.fortschritt || 0).toFixed(1);

    // UI für Sparziel updaten
    document.getElementById("ui-goal-amount").textContent = isGoalActive ? `CHF ${zielBetrag}` : "CHF 0.00";
    document.getElementById("ui-goal-title").textContent = isGoalActive ? `Noch CHF ${zielBetrag} bis zum Ziel` : "Kein aktives Ziel";
    document.getElementById("ui-progress-text").textContent = `${fortschritt}%`;
    document.getElementById("ui-progress-bar").style.width = `${fortschritt}%`;

    // --- Münzbestand laden ---
    const coinResponse = await fetch(`api/muenzbestand.php?geraete_id=${GERAETE_ID}`);
    const coinData = await coinResponse.json();

    let totalCoins = 0;
    if (coinData.details && coinData.details.length > 0) {
      coinData.details.forEach(coin => {
        totalCoins += parseInt(coin.anzahl);
      });
    }
    const gesamtBetrag = parseFloat(coinData.gesamtbetrag || 0).toFixed(2);

    // UI für Münzbestand updaten
    document.getElementById("ui-total-amount").textContent = `CHF ${gesamtBetrag}`;
    document.getElementById("ui-coin-count-top").textContent = `${totalCoins} Münzen eingeworfen`;
    document.getElementById("ui-piggy-amount").textContent = gesamtBetrag;
    document.getElementById("ui-piggy-coin-count").textContent = `${totalCoins} Münzen total`;

    // --- Ziel-Erreicht-Logik prüfen ---
    if (isGoalActive && fortschritt >= 100) {
      setTimeout(() => {
        if(confirm(`Glückwunsch! Du hast dein Ziel "${goalData.titel}" erreicht! Willst du es abschliessen und das Kässli leeren?`)) {
          schliesseSparzielAb();
        }
      }, 500); // Kurze Verzögerung, damit die Animation zuerst fertig lädt
    }

  } catch (error) {
    console.error("Fehler beim Laden der Dashboard-Daten:", error);
  }
}

// 3. Neues Sparziel erstellen (Event-Listener für den "ändern" Link)
document.addEventListener("DOMContentLoaded", () => {
  const changeGoalBtn = document.querySelector(".inline-link");
  if (changeGoalBtn) {
    changeGoalBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      
      const titel = prompt("Wie heisst dein neues Sparziel? (z.B. Fahrrad)");
      if (!titel) return;
    
      const betrag = prompt("Wie viel CHF möchtest du sparen? (z.B. 150)");
      if (!betrag || isNaN(betrag)) return;
    
      try {
        const response = await fetch("api/sparziel_erstellen.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            geraete_id: GERAETE_ID,
            titel: titel,
            ziel_betrag: parseFloat(betrag)
          })
        });
    
        const result = await response.json();
        if (result.status === "success") {
          alert("Neues Sparziel gespeichert!");
          ladeDashboardDaten(); // Dashboard sofort aktualisieren
        } else {
          alert("Fehler: " + result.message);
        }
      } catch (error) {
        console.error("Fehler beim Erstellen des Sparziels:", error);
      }
    });
  }
});

// 4. Sparziel abschliessen
async function schliesseSparzielAb() {
  try {
    const response = await fetch("api/sparziel_abschliessen.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geraete_id: GERAETE_ID })
    });

    const result = await response.json();
    if (result.status === "success") {
      alert("Sparziel erfolgreich abgeschlossen! Dein Kässli ist jetzt wieder bereit für das nächste Ziel.");
      ladeDashboardDaten(); // UI wieder auf 0 setzen
    } else {
      alert("Fehler: " + result.message);
    }
  } catch (error) {
    console.error("Fehler beim Abschliessen:", error);
  }
}

// Beim Laden der Seite die Authentifizierung starten
window.addEventListener("load", () => {
  checkAuth();
  
  // Optional: Dashboard alle 10 Sekunden updaten (wie in deiner alten Datei)
  setInterval(() => {
    ladeDashboardDaten();
  }, 10000);
});