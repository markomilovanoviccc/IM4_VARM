<?php
// api/stats.php
session_start();
header('Content-Type: application/json');

require_once '../system/config.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Nicht autorisiert"]);
    exit;
}

// Wir holen die geraete_id wie bei den anderen Skripten
$geraete_id = $_GET['geraete_id'] ?? 'SPAR001'; 

try {
    $stmt = $pdo->prepare("
        SELECT m.muenz_wert, m.anzahl 
        FROM muenzbestand m
        JOIN sparschwein s ON m.sparschwein_id = s.id
        WHERE s.geraete_id = :geraete_id
        ORDER BY m.muenz_wert ASC
    ");
    $stmt->execute([':geraete_id' => $geraete_id]);
    $bestand = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $labels = [];
    $data = [];

    foreach ($bestand as $row) {
        $labels[] = number_format($row['muenz_wert'], 2, '.', '') . " CHF";
        $data[] = (int)$row['anzahl'];
    }

    echo json_encode([
        "status" => "success",
        "labels" => $labels,
        "data" => $data
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Datenbankfehler."]);
}
?>