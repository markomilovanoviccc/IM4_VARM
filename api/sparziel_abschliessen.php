<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../system/config.php';

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || !isset($data['geraete_id'])) {
    echo json_encode([
        "status" => "error",
        "message" => "geraete_id fehlt"
    ]);
    exit;
}

$geraete_id = trim($data['geraete_id']);

try {
    $pdo = new PDO(
        "mysql:host=" . $host . ";dbname=" . $db . ";charset=utf8mb4",
        $user,
        $pass
    );

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 1. Sparschwein anhand geraete_id suchen
    $stmt = $pdo->prepare("
        SELECT id
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

    // Ab hier brauchen wir die interne Datenbank-ID
    $sparschwein_id = $schwein['id'];

    $pdo->beginTransaction();

    // 2. Alle Sparziele dieses Sparschweins abschliessen
    $stmt = $pdo->prepare("
        UPDATE sparziel
        SET ist_erreicht = 1
        WHERE sparschwein_id = :sparschwein_id
    ");

    $stmt->execute([
        'sparschwein_id' => $sparschwein_id
    ]);

    // 3. Münzbestand zurücksetzen
    $stmt = $pdo->prepare("
        UPDATE muenzbestand
        SET anzahl = 0
        WHERE sparschwein_id = :sparschwein_id
    ");

    $stmt->execute([
        'sparschwein_id' => $sparschwein_id
    ]);

    $pdo->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Sparziel abgeschlossen und Bestand zurueckgesetzt",
        "geraete_id" => $geraete_id,
        "sparschwein_id" => $sparschwein_id
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
?>