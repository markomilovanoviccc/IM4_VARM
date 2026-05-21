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
    
    // --- NEU: Namen dynamisch aus der Datenbank holen ---
    const firstName = result.first_name || "Dir"; 
    
    // Namen ins HTML-Feld schreiben (falls geladen)
    const nameDisplayElement = document.getElementById("userFirstNameDisplay");
    if (nameDisplayElement) {
        nameDisplayElement.textContent = firstName;
    }
    
    // Auch den Browsertab-Titel dynamisch anpassen
    document.title = `Dashboard - Kässeli von ${firstName}`;
    // -----------------------------------------------------

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

    // --- 2c. Chart aktualisieren ---
    await loadStatistics();

    // --- 2d. Achievements berechnen ---
    const fortschrittWert = parseFloat(fortschritt || 0);
    const maxZiel = parseFloat(zielBetrag || 0);
    berechneAchievements(totalCoins, fortschrittWert, maxZiel);

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

// --- Achievements live berechnen ---
function berechneAchievements(totalCoins, fortschrittPercent, zielBetrag) {
  let unlockedCount = 0;
  const totalAchievements = 6;
  
  const achItems = document.querySelectorAll('.achievement-item');
  if (achItems.length === 0) return;

  const achievements = [
    { type: 'coin', required: 1, max: 1 },                  
    { type: 'coin', required: 10, max: 10 },                
    { type: 'percent', required: 25, max: zielBetrag * 0.25 }, 
    { type: 'percent', required: 50, max: zielBetrag * 0.50 }, 
    { type: 'coin', required: 50, max: 50 },                
    { type: 'percent', required: 100, max: zielBetrag }        
  ];

  achievements.forEach((ach, index) => {
    const item = achItems[index];
    const progressDiv = item.querySelector('.ach-progress');
    let isUnlocked = false;

    if (ach.type === 'coin') {
      isUnlocked = totalCoins >= ach.required;
      const displayCoins = Math.min(totalCoins, ach.max); 
      progressDiv.textContent = `${displayCoins} / ${ach.max}`;
    } else {
      isUnlocked = fortschrittPercent >= ach.required;
      const currentChf = (zielBetrag * (fortschrittPercent / 100));
      const displayChf = Math.min(currentChf, ach.max).toFixed(2);
      const maxChf = isNaN(ach.max) || ach.max === 0 ? "0.00" : ach.max.toFixed(2);
      progressDiv.textContent = `${displayChf} / ${maxChf} CHF`;
    }

    if (isUnlocked && ach.max > 0) {
      item.classList.remove('locked');
      unlockedCount++;
    } else {
      item.classList.add('locked');
    }
  });

  const summaryText = document.querySelector('.achievements-header p');
  if (summaryText) summaryText.textContent = `${unlockedCount} von ${totalAchievements} freigeschaltet`;

  const totalPercent = Math.round((unlockedCount / totalAchievements) * 100);
  const badgeValue = document.querySelector('.achievements-badge .badge-value');
  if (badgeValue) badgeValue.textContent = `${totalPercent}%`;

  const progressBar = document.querySelector('.achievements-section .progress-bar.pink-gradient');
  if (progressBar) progressBar.style.width = `${totalPercent}%`;
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
          alert("Ziel erfolgreich abgeschlossen! Sparschwein öffnet sich...");
          ladeDashboardDaten();
        } else {
          alert("Fehler: " + result.message);
        }
      } catch (error) { console.error("Fehler:", error); }
    });
  }
});

// Automatischen Start triggern
window.addEventListener("load", () => {
  checkAuth();
  setInterval(ladeDashboardDaten, 10000);
});