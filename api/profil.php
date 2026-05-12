<?php
// index.php (API that returns JSON about the logged-in user)
session_start();

include_once "../system/config.php";

$userId = $_SESSION['user_id'];

$stmt = $pdo->prepare("SELECT * FROM users WHERE id = :user_id");
$stmt->execute([":user_id" => $userId]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

echo json_encode([
    "status" => "success",
    "user_id" => $user['id'],
    "email" => $user['email'],
    "vorname" => $user['firstname'],
    "nachname" => $user['lastname']
]);
