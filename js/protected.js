// js/protected.js

const GERAETE_ID = "SPAR001"; // Eure vordefinierte Geräte-ID aus der DB
let myChart = null; // Globale Variable für das Chart

// 1. Authentifizierung prüfen
async function checkAuth() {
  try {
    const response = await fetch("api/protected.php", { credentials: "include" });

    if (response.status === 401) {
      window.location.href = "login.html";
      return false;
    }

    const result = await response.json();
    document.getElementById("userFirstName").textContent = result.first_name || '';
    
    // Auth erfolgreich -> Daten laden
    ladeDashboardDaten();
    return true;
  } catch (error) {
    console.error("Auth check failed:", error);
    window.location.href = "login.html";
    return false;
  }
}

// 2. Dashboard-Daten aus den PHP-APIs laden
async function ladeDashboardDaten() {
  try {
    // --- 2a. Sparziel laden ---
    const goalResponse = await fetch(`api/sparziel.php?geraete_id=${GERAETE_ID}`);
    const goalData = await goalResponse.json();

    const isGoalActive = goalData.status === "success";
    const zielBetrag = parseFloat(goalData.ziel_betrag || 0).toFixed(2);
    const fortschritt = parseFloat(goalData.fortschritt || 0).toFixed(1);

    document.getElementById("ui-goal-amount").textContent = isGoalActive ? `CHF ${zielBetrag}` : "CHF 0.00";
    document.getElementById("ui-goal-title").textContent = isGoalActive ? `Ziel: ${goalData.titel}` : "Kein aktives Ziel";
    document.getElementById("ui-progress-text").textContent = `${fortschritt}%`;
    document.getElementById("ui-progress-bar").style.width = `${fortschritt}%`;

    const completeBtn = document.getElementById("zielErreichtBtn");
    if (isGoalActive && fortschritt >= 100) {
      completeBtn.style.display = "block";
    } else {
      completeBtn.style.display = "none";
    }

    // --- 2b. Münzbestand laden ---
    const coinResponse = await fetch(`api/muenzbestand.php?geraete_id=${GERAETE_ID}`);
    const coinData = await coinResponse.json();

    let totalCoins = 0;
    if (coinData.details && coinData.details.length > 0) {
      coinData.details.forEach(coin => {
        totalCoins += parseInt(coin.anzahl);
      });
    }
    const gesamtBetrag = parseFloat(coinData.gesamtbetrag || 0).toFixed(2);

    document.getElementById("ui-total-amount").textContent = `CHF ${gesamtBetrag}`;
    document.getElementById("ui-coin-count-top").textContent = `${totalCoins} Münzen eingeworfen`;
    document.getElementById("ui-piggy-amount").textContent = gesamtBetrag;
    document.getElementById("ui-piggy-coin-count").textContent = `${totalCoins} Münzen total`;

    // --- 2c. Chart aktualisieren ---
    await loadStatistics();

  } catch (error) {
    console.error("Fehler beim Laden der Dashboard-Daten:", error);
  }
}

// --- 2c. Statistiken für Chart laden ---
async function loadStatistics() {
  try {
    const response = await fetch(`api/stats.php?geraete_id=${GERAETE_ID}`, {
      credentials: "include", 
    });

    if (response.status === 401) return;

    const result = await response.json();

    if (result.status === "success") {
      renderChart(result.labels, result.data);
    } else {
      console.error("Fehler beim Laden der Stats:", result.message);
    }
  } catch (error) {
    console.error("Fetch-Fehler Chart:", error);
  }
}

function renderChart(labels, data) {
  const ctx = document.getElementById('coinChart');
  if (!ctx) return;

  // WICHTIG: Altes Chart zerstören, bevor ein neues drüber gezeichnet wird
  if (myChart !== null) {
      myChart.destroy();
  }

  myChart = new Chart(ctx, {
    type: 'bar', 
    data: {
      labels: labels, 
      datasets: [{
        label: 'Anzahl Münzen',
        data: data, 
        backgroundColor: '#00E676', 
        borderRadius: 5 
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// 3. Modal-Steuerung & Event Listener
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("goalModal");
  const openBtn = document.getElementById("btn-open-modal");
  const closeX = document.getElementById("btn-close-modal");
  const cancelBtn = document.getElementById("btn-cancel-modal");
  const form = document.getElementById("sparzielForm");
  const completeBtn = document.getElementById("zielErreichtBtn");

  if (openBtn) openBtn.addEventListener("click", (e) => { e.preventDefault(); modal.style.display = "flex"; });
  
  const closeModal = () => { modal.style.display = "none"; if(form) form.reset(); };
  if (closeX) closeX.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  window.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const titel = document.getElementById("titel").value.trim();
      const zielBetrag = document.getElementById("zielBetrag").value;

      try {
        const response = await fetch("api/sparziel_erstellen.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geraete_id: GERAETE_ID, titel: titel, ziel_betrag: parseFloat(zielBetrag) })
        });
        const result = await response.json();
        if (result.status === "success") {
          closeModal();
          ladeDashboardDaten();
        } else {
          alert("Fehler: " + result.message);
        }
      } catch (error) { console.error("Fehler:", error); }
    });
  }

  if (completeBtn) {
    completeBtn.addEventListener("click", async () => {
      if (!confirm("Möchtest du dieses Sparziel wirklich abschliessen?")) return;
      try {
        const response = await fetch("api/sparziel_abschliessen.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geraete_id: GERAETE_ID })
        });
        const result = await response.json();
        if (result.status === "success") {
          alert("Ziel erfolgreich abgeschlossen!");
          ladeDashboardDaten();
        } else {
          alert("Fehler: " + result.message);
        }
      } catch (error) { console.error("Fehler:", error); }
    });
  }
});

// Automatischen Start triggern (nur noch EIN Load-Event!)
window.addEventListener("load", () => {
  checkAuth();
  
  // Alle 10 Sekunden live aktualisieren (aktualisiert jetzt auch das Chart!)
  setInterval(ladeDashboardDaten, 10000);
});