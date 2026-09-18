<?php
// Every 10 minutes: pull data/polls.json (the poll table) from the public GitHub repository
// and install it when it changed. Only this data file is synced; code changes are deployed by hand.
// Run from Hostinger cron:  php /path/to/public_html/cron/sync_github.php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("forbidden\n"); }
date_default_timezone_set('UTC');
$ROOT = dirname(__DIR__);
$LOG  = __DIR__ . '/last_run_sync.log';
$RAW  = 'https://raw.githubusercontent.com/marcelogarciadoo/themachineobserver-site/main/';
$FILES = ['data/polls.json'];
$log = [];

function http_get(string $url): ?string {
    $ch = curl_init($url . '?nocache=' . time());
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Cache-Control: no-cache', 'User-Agent: themachineobserver.com sync']]);
    $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return ($body !== false && $code === 200) ? $body : null;
}
function valid(string $rel, string $body): bool {
    if (strlen($body) < 50) return false;
    if (substr($rel, -5) !== '.json') return false;
    $j = json_decode($body, true);
    if (!is_array($j) || !isset($j['polls']) || !is_array($j['polls']) || count($j['polls']) < 10) return false;
    foreach ($j['polls'] as $p) if (!isset($p['pollster'], $p['start'], $p['end'], $p['published'], $p['lula'], $p['flavio'], $p['sample'], $p['moe'], $p['source'])) return false;
    return true;
}

foreach ($FILES as $rel) {
    $body = http_get($RAW . $rel);
    if ($body === null) { $log[] = "$rel: fetch failed"; continue; }
    if (!valid($rel, $body)) { $log[] = "$rel: rejected (validation)"; continue; }
    $path = $ROOT . '/' . $rel;
    if (is_file($path) && hash('sha256', (string)file_get_contents($path)) === hash('sha256', $body)) { $log[] = "$rel: unchanged"; continue; }
    if (!is_dir(dirname($path))) mkdir(dirname($path), 0755, true);
    file_put_contents($path . '.tmp', $body); rename($path . '.tmp', $path);
    $log[] = "$rel: UPDATED (" . strlen($body) . " bytes)";
}
$line = gmdate('c') . ' | ' . implode(' | ', $log) . "\n";
file_put_contents($LOG, $line, FILE_APPEND);
echo $line;
