<?php
// Header setzen, damit die Web-App und das Sparschwein wissen, dass JSON kommt
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Erlaubt den Zugriff von deinem Frontend

// 1. Die sichere Config-Datei laden (Variablen $host, $db, $user, $pass)
require_once __DIR__ . '/../system/config.php';

try {
    // 2. PDO-Verbindung aufbauen
    $pdo = new PDO("mysql:host=" . $host . ";dbname=" . $db . ";charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Verbindungsfehler zur Datenbank"]);
    exit;
}

// 3. Prüfen, ob die Hardware ihre 'geraete_id' übergeben hat (GET-Parameter)
if (!isset($_GET['geraete_id']) || empty($_GET['geraete_id'])) {
    echo json_encode(["status" => "error", "message" => "Parameter 'geraete_id' fehlt."]);
    exit;
}

// geraete_id aus der URL auslesen (z.B. "ESP32-ABC")
$geraete_id = $_GET['geraete_id'];

try {
    // 4. SQL JOIN: Wir verknüpfen muenzbestand (m) mit sparschwein (s)
    $query = "SELECT m.muenz_wert, m.anzahl 
              FROM muenzbestand m
              JOIN sparschwein s ON m.sparschwein_id = s.id
              WHERE s.geraete_id = :geraete_id";
              
    $stmt = $pdo->prepare($query);
    // PARAM_STR, da die geraete_id oft ein Text-String ist
    $stmt->bindParam(':geraete_id', $geraete_id, PDO::PARAM_STR);
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
        "geraete_id" => $geraete_id,
        "gesamtbetrag" => number_format($gesamtbetrag, 2, '.', ''), // Formatierung auf 2 Dezimalstellen
        "details" => $bestand_details
    ];

    // Ausgabe der Daten
    echo json_encode($response);

} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Fehler bei der Datenbankabfrage."]);
}
?>