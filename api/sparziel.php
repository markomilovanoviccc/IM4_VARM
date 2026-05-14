<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../system/config.php';

if (!isset($_GET['geraete_id']) || empty($_GET['geraete_id'])) {
    echo json_encode([
        "status" => "error",
        "message" => "geraete_id fehlt"
    ]);
    exit;
}

$geraete_id = $_GET['geraete_id'];

try {
    $pdo = new PDO(
        "mysql:host=" . $host . ";dbname=" . $db . ";charset=utf8mb4",
        $user,
        $pass
    );

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Sparschwein anhand der geraete_id finden
    $stmt = $pdo->prepare("
        SELECT id, name
        FROM sparschwein
        WHERE geraete_id = :geraete_id
    ");

    $stmt->execute([
        'geraete_id' => $geraete_id
    ]);

    $schwein = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$schwein) {
        echo json_encode([
            "status" => "error",
            "message" => "Sparschwein nicht gefunden"
        ]);
        exit;
    }

    $sparschwein_id = $schwein['id'];

    // Nur aktives Sparziel holen
    // Abgeschlossene Ziele mit ist_erreicht = 1 werden ignoriert
    $stmt = $pdo->prepare("
        SELECT titel, ziel_betrag, ist_erreicht
        FROM sparziel
        WHERE sparschwein_id = :sid
        AND ist_erreicht = 0
        ORDER BY erstellt_am DESC
        LIMIT 1
    ");

    $stmt->execute([
        'sid' => $sparschwein_id
    ]);

    $ziel = $stmt->fetch(PDO::FETCH_ASSOC);

    // Wenn kein aktives Sparziel vorhanden ist
    if (!$ziel) {
        echo json_encode([
            "status" => "no_goal",
            "message" => "Kein aktives Sparziel vorhanden",
            "geraete_id" => $geraete_id,
            "sparschwein" => $schwein['name'],
            "titel" => null,
            "ziel_betrag" => 0,
            "aktueller_betrag" => 0,
            "fortschritt" => 0,
            "ist_erreicht" => false
        ]);
        exit;
    }

    // Gesamtbetrag aus aktuellem Muenzbestand berechnen
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(muenz_wert * anzahl), 0) AS gesamt
        FROM muenzbestand
        WHERE sparschwein_id = :sid
    ");

    $stmt->execute([
        'sid' => $sparschwein_id
    ]);

    $betrag = $stmt->fetch(PDO::FETCH_ASSOC);

    $gesamtbetrag = floatval($betrag['gesamt']);
    $zielbetrag = floatval($ziel['ziel_betrag']);

    // Fortschritt berechnen
    $fortschritt = 0;

    if ($zielbetrag > 0) {
        $fortschritt = ($gesamtbetrag / $zielbetrag) * 100;

        if ($fortschritt > 100) {
            $fortschritt = 100;
        }
    }

    echo json_encode([
        "status" => "success",
        "geraete_id" => $geraete_id,
        "sparschwein" => $schwein['name'],
        "titel" => $ziel['titel'],
        "ziel_betrag" => $zielbetrag,
        "aktueller_betrag" => $gesamtbetrag,
        "fortschritt" => round($fortschritt, 1),
        "ist_erreicht" => (bool)$ziel['ist_erreicht']
    ]);

} catch (Exception $e) {
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
?>