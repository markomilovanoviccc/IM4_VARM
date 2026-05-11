<?php
// register.php
session_start();
header('Content-Type: application/json');

require_once '../system/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $data = json_decode(file_get_contents("php://input"), true);

    $firstName = trim($data['first_name'] ?? '');
    $email     = trim($data['email'] ?? '');
    $password  = trim($data['password'] ?? '');

    if (!$firstName || !$email || !$password) {
        echo json_encode(["status" => "error", "message" => "First name, email and password are required"]);
        exit;
    }

    // Check if email already exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute([':email' => $email]);
    if ($stmt->fetch()) {
        echo json_encode(["status" => "error", "message" => "Email is already in use"]);
        exit;
    }

    // Hash the password
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    // Insert the new user (store first name)
    $insert = $pdo->prepare("INSERT INTO users (first_name, email, password) VALUES (:first_name, :email, :pass)");
    $insert->execute([
        ':first_name' => $firstName,
        ':email'      => $email,
        ':pass'       => $hashedPassword
    ]);

    echo json_encode(["status" => "success"]);
} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method"]);
}
