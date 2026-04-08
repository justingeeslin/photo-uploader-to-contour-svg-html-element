<?php
error_reporting(1);
header('Content-Type: application/json');

$uploadDir = __DIR__ . '/uploads/';
$objectMeasurerApplicationURL = "https://shrouded-tor-52623-62e8e1beefb8.herokuapp.com/";

// Build the current site base URL dynamically
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];

// If your script lives in a subdirectory, this captures it.
// Example: /myapp/upload.php -> /myapp
$scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');

// Build uploads base URL
$photoBaseURL = $scheme . '://' . $host . $scriptDir . '/uploads/';

if (!is_dir($uploadDir)) {
	mkdir($uploadDir, 0755, true);
}

if (!isset($_FILES['photos'])) {
	http_response_code(400);
	echo json_encode([
		"error" => "No files were uploaded."
	]);
	exit;
}

$results = [];

for ($i = 0; $i < count($_FILES['photos']['name']); $i++) {
	$originalName = $_FILES['photos']['name'][$i];
	$tmpName      = $_FILES['photos']['tmp_name'][$i];
	$error        = $_FILES['photos']['error'][$i];

	if ($error !== UPLOAD_ERR_OK) {
		$results[] = [
			"original_name" => $originalName,
			"status" => "error",
			"message" => "Upload error"
		];
		continue;
	}

	$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
	$safeName = uniqid('img_', true) . ($extension ? '.' . $extension : '');

	$destination = $uploadDir . $safeName;

	if (move_uploaded_file($tmpName, $destination)) {
		$fileURL = $photoBaseURL . $safeName;

		$results[] = [
			"original_name" => $originalName,
			"filename" => $safeName,
			"url" => $fileURL,
			"measure_url" => $objectMeasurerApplicationURL . "?url=" . urlencode($fileURL),
			"status" => "success"
		];
	} else {
		$results[] = [
			"original_name" => $originalName,
			"status" => "error",
			"message" => "Failed to save file"
		];
	}
}

echo json_encode([
	"files" => $results
]);