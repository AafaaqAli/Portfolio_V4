<?php
/**
 * HTTPS deploy endpoint for GitHub Actions.
 *
 * Upload:  POST path=<relative path>&content=<base64>
 * Cleanup: POST action=cleanup&manifest=<newline-separated paths>[&dry_run=1]
 *          Deletes every file under this folder that is not in the manifest,
 *          except the protected paths below and any listed in .deploy_keep.
 *
 * Auth: "Authorization: Bearer <secret>", where <secret> matches the
 * contents of .deploy_secret in this folder.
 */

header('Content-Type: application/json');

function reply($code, $data) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

$root = realpath(__DIR__);

// ---- Auth -----------------------------------------------------------------
$secretFile = $root . '/.deploy_secret';
if (!is_file($secretFile)) {
    reply(500, ['ok' => false, 'error' => 'Server has no .deploy_secret']);
}
$secret = trim(file_get_contents($secretFile));

$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if ($auth === '' && function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        if (strcasecmp($name, 'Authorization') === 0) {
            $auth = $value;
        }
    }
}
$token = preg_match('/^Bearer\s+(.+)$/i', trim($auth), $m) ? trim($m[1]) : '';

if ($secret === '' || $token === '' || !hash_equals($secret, $token)) {
    reply(401, ['ok' => false, 'error' => 'Unauthorized']);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(405, ['ok' => false, 'error' => 'POST only']);
}

// ---- Helpers --------------------------------------------------------------
function clean_path($path) {
    $path = str_replace('\\', '/', trim($path));
    $path = ltrim($path, '/');
    if ($path === '' || strpos($path, "\0") !== false) {
        return null;
    }
    foreach (explode('/', $path) as $part) {
        if ($part === '' || $part === '.' || $part === '..') {
            return null;
        }
    }
    return $path;
}

// Never deleted by cleanup. Directories protect everything inside them.
$protected = [
    'deploy.php',
    '.deploy_secret',
    '.deploy_keep',
    '.well-known',
    'cgi-bin',
    '.user.ini',
    'php.ini',
    '.ftpquota',
    'error_log',
];
$keepFile = $root . '/.deploy_keep';
if (is_file($keepFile)) {
    foreach (file($keepFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = clean_path(trim($line));
        if ($line !== null && $line[0] !== '#') {
            $protected[] = rtrim($line, '/');
        }
    }
}

function is_protected($rel, $protected) {
    foreach ($protected as $p) {
        if ($rel === $p || strpos($rel, $p . '/') === 0) {
            return true;
        }
    }
    return false;
}

$action = $_POST['action'] ?? 'upload';

// ---- Upload ---------------------------------------------------------------
if ($action === 'upload') {
    $rel = clean_path($_POST['path'] ?? '');
    if ($rel === null) {
        reply(400, ['ok' => false, 'error' => 'Invalid path']);
    }
    $content = base64_decode($_POST['content'] ?? '', true);
    if ($content === false) {
        reply(400, ['ok' => false, 'error' => 'Content is not valid base64']);
    }
    $target = $root . '/' . $rel;
    $dir = dirname($target);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        reply(500, ['ok' => false, 'error' => 'Cannot create folder for ' . $rel]);
    }
    if (strpos(realpath($dir), $root) !== 0) {
        reply(400, ['ok' => false, 'error' => 'Path escapes deploy folder']);
    }
    $tmp = $target . '.deploy-tmp';
    if (file_put_contents($tmp, $content) === false || !rename($tmp, $target)) {
        @unlink($tmp);
        reply(500, ['ok' => false, 'error' => 'Cannot write ' . $rel]);
    }
    reply(200, ['ok' => true, 'path' => $rel, 'bytes' => strlen($content)]);
}

// ---- Cleanup --------------------------------------------------------------
if ($action === 'cleanup') {
    $keep = [];
    foreach (preg_split('/\r?\n/', $_POST['manifest'] ?? '') as $line) {
        $line = clean_path($line);
        if ($line !== null) {
            $keep[$line] = true;
        }
    }
    // Refuse to run on a broken manifest rather than wipe the site.
    if (count($keep) < 3 || !isset($keep['index.html'])) {
        reply(400, ['ok' => false, 'error' => 'Manifest looks incomplete; nothing deleted']);
    }
    $dryRun = ($_POST['dry_run'] ?? '0') === '1';

    $deleted = [];
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($items as $item) {
        $rel = ltrim(substr($item->getPathname(), strlen($root)), '/');
        $rel = str_replace('\\', '/', $rel);
        if (is_protected($rel, $protected)) {
            continue;
        }
        if ($item->isDir() && !$item->isLink()) {
            // Remove folders the new site no longer uses, once they are empty.
            if (!$dryRun && count(scandir($item->getPathname())) === 2) {
                @rmdir($item->getPathname());
            }
            continue;
        }
        if (isset($keep[$rel])) {
            continue;
        }
        $deleted[] = $rel;
        if (!$dryRun) {
            @unlink($item->getPathname());
        }
    }
    sort($deleted);
    reply(200, ['ok' => true, 'dry_run' => $dryRun, 'deleted' => $deleted]);
}

reply(400, ['ok' => false, 'error' => 'Unknown action']);
