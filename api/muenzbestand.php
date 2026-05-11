<?php
// Header setzen, damit die Web-App und das Sparschwein wissen, dass JSON kommt
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Erlaubt den Zugriff von deinem Frontend

// 1. Die sichere Config-Datei laden
// Diese Datei stellt nun die Variablen $host, $db, $user und $pass zur Verfügung
require_once __DIR__ . '/../system/config.php';

try {
    // 2. PDO-Verbindung aufbauen mit deinen spezifischen Variablen
    $pdo = new PDO("mysql:host=" . $host . ";dbname=" . $db . ";charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // Falls die Verbindung fehlschlägt
    echo json_encode(["status" => "error", "message" => "Verbindungsfehler zur Datenbank"]);
    exit;
}

// 3. Prüfen, ob eine sparschwein_id übergeben wurde (GET-Parameter)
if (!isset($_GET['sparschwein_id']) || empty($_GET['sparschwein_id'])) {
    echo json_encode(["status" => "error", "message" => "Parameter 'sparschwein_id' fehlt."]);
    exit;
}

$sparschwein_id = intval($_GET['sparschwein_id']);

try {
    // 4. Sichere SQL-Abfrage aus der Tabelle 'muenzbestand'
    $query = "SELECT muenz_wert, anzahl FROM muenzbestand WHERE sparschwein_id = :sparschwein_id";
    $stmt = $pdo->prepare($query);
    $stmt->bindParam(':sparschwein_id', $sparschwein_id, PDO::PARAM_INT);
    $stmt->execute();
    
    $muenzen = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $gesamtbetrag = 0.0;
    $bestand_details = [];

    // 5. Bestand durchlaufen und Gesamtbetrag berechnen
    foreach ($muenzen as $muenze) {
        $wert = (float)$muenze['muenz_wert'];
        $anzahl = (int)$muenze['anzahl'];
        
        $teilsumme = $wert * $anzahl;
        $gesamtbetrag += $teilsumme;
        
        // Detaillierte Auflistung pro Münzart speichern
        $bestand_details[] = [
            "muenz_wert" => $wert,
            "anzahl" => $anzahl,
            "teilsumme" => $teilsumme
        ];
    }

    // 6. JSON-Antwort für das Sparschwein / Frontend zusammenbauen
    $response = [
        "status" => "success",
        "sparschwein_id" => $sparschwein_id,
        "gesamtbetrag" => number_format($gesamtbetrag, 2, '.', ''), // Formatierung auf 2 Dezimalstellen
        "details" => $bestand_details
    ];

    // Ausgabe der Daten
    echo json_encode($response);

} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Fehler bei der Datenbankabfrage."]);
}
?>