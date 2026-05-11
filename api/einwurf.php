<?php
// 1. Datenbankkonfiguration laden (nutzt deine bestehende config)
require_once '../system/config.php';

// 2. JSON-Input vom Sparschwein lesen
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (isset($data['geraete_id']) && isset($data['muenz_wert'])) {
    $geraete_id = $data['geraete_id'];
    $muenz_wert = floatval($data['muenz_wert']);

    try {
        $pdo = new PDO("mysql:host=$host;dbname=$db", $user, $pass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // 3. Sicherheitscheck & ID ermitteln: Gehört die geraete_id zu einem registrierten Sparschwein?
        $stmt = $pdo->prepare("SELECT id FROM sparschwein WHERE geraete_id = :geraete_id");
        $stmt->execute(['geraete_id' => $geraete_id]);
        $schwein = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($schwein) {
            $sparschwein_id = $schwein['id'];

            // --- DATENBANK-TRANSAKTION STARTEN ---
            $pdo->beginTransaction();

            // 4a. Historie eintragen (Tabelle: einwurf_historie)
            $stmtHist = $pdo->prepare("INSERT INTO einwurf_historie (sparschwein_id, muenz_wert, eingeworfen_am) VALUES (:sid, :wert, NOW())");
            $stmtHist->execute(['sid' => $sparschwein_id, 'wert' => $muenz_wert]);

            // 4b. Münzbestand aktualisieren (Tabelle: muenzbestand)
            // Prüfen, ob dieser Münzwert für dieses Sparschwein schon existiert
            $stmtCheck = $pdo->prepare("SELECT id, anzahl FROM muenzbestand WHERE sparschwein_id = :sid AND muenz_wert = :wert");
            $stmtCheck->execute(['sid' => $sparschwein_id, 'wert' => $muenz_wert]);
            $bestand = $stmtCheck->fetch(PDO::FETCH_ASSOC);

            if ($bestand) {
                // Update: Anzahl erhöhen
                $stmtUpdate = $pdo->prepare("UPDATE muenzbestand SET anzahl = anzahl + 1 WHERE id = :id");
                $stmtUpdate->execute(['id' => $bestand['id']]);
            } else {
                // Insert: Neue Münzart anlegen
                $stmtInsert = $pdo->prepare("INSERT INTO muenzbestand (sparschwein_id, muenz_wert, anzahl) VALUES (:sid, :wert, 1)");
                $stmtInsert->execute(['sid' => $sparschwein_id, 'wert' => $muenz_wert]);
            }

            // --- DATENBANK-TRANSAKTION ABSCHLIESSEN ---
            $pdo->commit();

            // 5. Erfolgsmeldung an das Sparschwein zurücksenden
            echo json_encode(["status" => "success", "message" => "Münze erfolgreich gespeichert."]);

        } else {
            http_response_code(404);
            echo json_encode(["status" => "error", "message" => "Unbekanntes Sparschwein."]);
        }
    } catch (PDOException $e) {
        if(isset($pdo)) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Datenbankfehler: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Fehlende Parameter."]);
}
?>