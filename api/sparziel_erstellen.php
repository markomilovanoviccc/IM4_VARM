<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../system/config.php';

$data = json_decode(file_get_contents('php://input'), true);

if (
    !$data ||
    !isset($data['geraete_id']) ||
    !isset($data['titel']) ||
    !isset($data['ziel_betrag'])
) {
    echo json_encode([
        "status" => "error",
        "message" => "Fehlende Daten"
    ]);
    exit;
}

$geraete_id = trim($data['geraete_id']);
$titel = trim($data['titel']);
$ziel_betrag = floatval($data['ziel_betrag']);

if ($geraete_id === "" || $titel === "" || $ziel_betrag <= 0) {
    echo json_encode([
        "status" => "error",
        "message" => "Ungueltige Eingabe"
    ]);
    exit;
}

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

    // Interne Datenbank-ID
    $sparschwein_id = $schwein['id'];

    $pdo->beginTransaction();

    // 2. Alle alten Sparziele dieses Sparschweins deaktivieren
    // So gibt es immer nur ein aktives Sparziel
    $stmt = $pdo->prepare("
        UPDATE sparziel
        SET ist_erreicht = 1
        WHERE sparschwein_id = :sparschwein_id
    ");

    $stmt->execute([
        'sparschwein_id' => $sparschwein_id
    ]);

    // 3. Neues Sparziel erstellen
    $stmt = $pdo->prepare("
        INSERT INTO sparziel
        (sparschwein_id, titel, ziel_betrag, ist_erreicht, erstellt_am)
        VALUES
        (:sparschwein_id, :titel, :ziel_betrag, 0, NOW())
    ");

    $stmt->execute([
        'sparschwein_id' => $sparschwein_id,
        'titel' => $titel,
        'ziel_betrag' => $ziel_betrag
    ]);

    $pdo->commit();

    echo json_encode([
        "status" => "success",
        "message" => "Sparziel gespeichert",
        "geraete_id" => $geraete_id,
        "sparschwein_id" => $sparschwein_id,
        "titel" => $titel,
        "ziel_betrag" => $ziel_betrag
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