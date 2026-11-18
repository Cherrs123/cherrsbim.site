<?php
/**
 * CHERRS BIM — Contact form mail handler
 * Sends form submissions to contact@cherrsbim.in via Hostinger's SMTP server.
 *
 * SETUP (do this before going live):
 * 1. Set SMTP_PASSWORD below to the mailbox password for contact@cherrsbim.in
 *    (set/reset it in hPanel → Emails → your mailbox).
 * 2. Upload this file, and the /PHPMailer folder, to your Hostinger hosting
 *    (e.g. public_html/mail/send-mail.php) — same server as your website.
 * 3. In script.js, CONTACT_ENDPOINT must point to wherever you upload this file.
 */

// ---- Configuration ----
const SMTP_HOST     = 'smtp.hostinger.com';
const SMTP_PORT     = 465;                 // 465 = SSL, 587 = STARTTLS
const SMTP_USERNAME = 'contact@cherrsbim.in';
const SMTP_PASSWORD = 'Bholebaba@1#43';
const MAIL_TO       = 'contact@cherrsbim.in';
const MAIL_TO_NAME  = 'CHERRS BIM';

// TEMPORARY — shows the real error on-screen instead of a generic message.
// Set this back to false once the form is working, so SMTP details never
// leak to a visitor if something goes wrong later.
const DEBUG_MODE = false;

// ------------------------------------------------------------------

// Never let raw PHP warnings/notices leak into the response body —
// they would break the JSON and show up as a generic JS-side error.
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json');

function respond(bool $success, string $message): void {
    // Clear anything accidentally echoed before this point (stray
    // whitespace, a warning, etc.) so the output is valid JSON only.
    if (ob_get_length()) {
        ob_clean();
    }
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

ob_start();

// Catch anything PHP itself throws (fatal errors, missing files, etc.)
// that isn't a PHPMailer exception, so the response is always JSON.
set_exception_handler(function ($e) {
    error_log('Contact form fatal error: ' . $e->getMessage());
    respond(false, DEBUG_MODE ? 'DEBUG (fatal): ' . $e->getMessage() : 'Sorry, something went wrong. Please email us directly.');
});

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    respond(false, 'Method not allowed.');
}

require __DIR__ . '/PHPMailer/Exception.php';
require __DIR__ . '/PHPMailer/PHPMailer.php';
require __DIR__ . '/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

// ---- Honeypot spam trap (hidden field, must stay empty) ----
if (!empty($_POST['company'] ?? '')) {
    // Silently pretend success so bots don't learn anything.
    respond(true, 'Thanks — your message has been sent.');
}

// ---- Read + validate fields ----
$name        = trim(strip_tags($_POST['name'] ?? ''));
$email       = trim($_POST['email'] ?? '');
$projectType = trim(strip_tags($_POST['projectType'] ?? 'Not specified'));
$message     = trim(strip_tags($_POST['message'] ?? ''));

if ($name === '' || $email === '' || $message === '') {
    respond(false, 'Please fill in all required fields.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'Please enter a valid email address.');
}

if (mb_strlen($name) > 150 || mb_strlen($message) > 5000) {
    respond(false, 'Please shorten your message and try again.');
}

// ---- Optional attachment ----
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
$attachmentPath = null;
$attachmentName = null;

if (!empty($_FILES['attachment']) && $_FILES['attachment']['error'] !== UPLOAD_ERR_NO_FILE) {
    $file = $_FILES['attachment'];

    if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
        respond(false, 'The attached file is too large. Please attach a file under 10 MB.');
    }
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
        respond(false, 'The file could not be uploaded. Please try again.');
    }
    if ($file['size'] > MAX_ATTACHMENT_BYTES) {
        respond(false, 'The attached file is too large. Please attach a file under 10 MB.');
    }

    // Block executable/script file types; allow everything else.
    $blocked = ['php','phtml','phar','exe','bat','cmd','com','msi','js','vbs','sh','scr','jar','dll'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (in_array($ext, $blocked, true)) {
        respond(false, 'This file type can\'t be attached. Please send a PDF, image, or document.');
    }

    $attachmentPath = $file['tmp_name'];
    $attachmentName = preg_replace('/[^\w.\- ]+/u', '_', basename($file['name']));
}

// ---- Send via PHPMailer / Hostinger SMTP ----
$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USERNAME;
    $mail->Password   = SMTP_PASSWORD;
    $mail->SMTPSecure = SMTP_PORT === 465 ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = SMTP_PORT;

    $mail->setFrom(SMTP_USERNAME, 'CHERRS BIM Website');
    $mail->addAddress(MAIL_TO, MAIL_TO_NAME);
    $mail->addReplyTo($email, $name);

    if ($attachmentPath) {
        $mail->addAttachment($attachmentPath, $attachmentName);
    }

    $mail->isHTML(true);
    $mail->Subject = "New project enquiry — {$projectType}";
    $mail->Body    = "
        <h2>New enquiry from cherrsbim.in</h2>
        <p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>
        <p><strong>Email:</strong> " . htmlspecialchars($email) . "</p>
        <p><strong>Project type:</strong> " . htmlspecialchars($projectType) . "</p>
        <p><strong>Message:</strong><br>" . nl2br(htmlspecialchars($message)) . "</p>
    ";
    $mail->AltBody = "Name: {$name}\nEmail: {$email}\nProject type: {$projectType}\n\nMessage:\n{$message}";

    $mail->send();
    respond(true, 'Thanks — your message has been sent. We\'ll reply soon.');
} catch (PHPMailerException $e) {
    error_log('Contact form mail error: ' . $mail->ErrorInfo);
    if (DEBUG_MODE) {
        respond(false, 'DEBUG: ' . $mail->ErrorInfo);
    }
    respond(false, 'Sorry, something went wrong sending your message. Please email us directly.');
}
