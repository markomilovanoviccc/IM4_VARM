<?php
// api/stats.php
session_start();
header('Content-Type: application/json');

require_once '../system/config.php';

// Prüfen, ob der User eingeloggt ist
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Nicht autorisiert"]);
    exit;
}

$user_id = $_SESSION['user_id'];

try {
    // Hole den Münzbestand für das Sparschwein des aktuellen Users
    // Wir joinen sparschwein und muenzbestand basierend auf der user_id
    $stmt = $pdo->prepare("
        SELECT m.muenz_wert, m.anzahl 
        FROM muenzbestand m
        JOIN sparschwein s ON m.sparschwein_id = s.id
        WHERE s.user_id = :user_id
        ORDER BY m.muenz_wert ASC
    ");
    $stmt->execute([':user_id' => $user_id]);
    $bestand = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Arrays für Chart.js vorbereiten
    $labels = [];
    $data = [];

    foreach ($bestand as $row) {
        // z.B. "1.00 CHF"
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