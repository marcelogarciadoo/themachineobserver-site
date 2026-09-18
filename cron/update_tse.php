<?php
// Hourly: download the TSE open-data registry of 2026 electoral polls, keep the national
// presidential registrations whose planned release date has passed and that are not yet in
// data/polls.json (or listed in its "ignored" array), and write them to data/pending.json.
// The TSE files contain registration metadata only (no results); results are transcribed later.
// Run from Hostinger cron:  php /path/to/public_html/cron/update_tse.php     (add --inspect to print the CSV header)
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("forbidden\n"); }
date_default_timezone_set('UTC');
$ROOT = dirname(__DIR__);
$DATA = $ROOT . '/data';
$LOG  = __DIR__ . '/last_run_tse.log';
$ZIP_URL = 'https://cdn.tse.jus.br/estatistica/sead/odsele/pesquisa_eleitoral/pesquisa_eleitoral_2026.zip';
$inspect = in_array('--inspect', $argv ?? [], true) || false;
$log = [];

function fetch_url(string $url, int $timeout = 180): array { // [body|false, code, err]
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => $timeout,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER => ['Accept: */*', 'Accept-Language: pt-BR,pt;q=0.9', 'Referer: https://dadosabertos.tse.jus.br/dataset/pesquisas-eleitorais-2026']]);
    $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    return [$body, $code, $err];
}
function toISO(?string $d): ?string { // 17/09/2026 or 2026-09-17 -> 2026-09-17
    if (!$d) return null; $d = trim($d);
    if (preg_match('~^(\d{2})/(\d{2})/(\d{4})~', $d, $m)) return "$m[3]-$m[2]-$m[1]";
    if (preg_match('~^(\d{4})-(\d{2})-(\d{2})~', $d, $m)) return "$m[1]-$m[2]-$m[3]";
    return null;
}
function norm_protocol(string $p): string { // BR084282026 or BR-08428/2026 -> BR-08428/2026
    $p = strtoupper(trim($p));
    if (preg_match('~^([A-Z]{2})-?(\d{5})/?(\d{4})$~', $p, $m)) return "$m[1]-$m[2]/$m[3]";
    return $p;
}

// ---- 1. official TSE open data (zip with CSV) ----
$rows = []; // normalised: registration, pollster, contractor, start, end, release, registered, sample, statistician, cargo, uf
$via = null; $attempts = [];
foreach ([$ZIP_URL, str_replace('https://', 'http://', $ZIP_URL)] as $url) {
    [$body, $code, $err] = fetch_url($url);
    $attempts[] = "$url => http=$code" . ($err ? " err=$err" : '');
    if ($body === false || $code !== 200 || strlen($body) < 1000) continue;
    $tmpzip = sys_get_temp_dir() . '/pesquisa_eleitoral_2026.zip'; file_put_contents($tmpzip, $body);
    $zip = new ZipArchive(); if ($zip->open($tmpzip) !== true) { $attempts[] = 'zip open FAIL'; continue; }
    $csvName = null;
    for ($i = 0; $i < $zip->numFiles; $i++) { $n = $zip->getNameIndex($i); if (preg_match('/\.csv$/i', $n) && (stripos(basename($n), 'pesquisa_eleitoral') === 0 || $csvName === null)) $csvName = $n; }
    if ($csvName === null) { $zip->close(); $attempts[] = 'no csv in zip'; continue; }
    $csv = mb_convert_encoding((string)$zip->getFromName($csvName), 'UTF-8', 'ISO-8859-1'); $zip->close(); @unlink($tmpzip);
    $lines = preg_split("/\r\n|\n|\r/", $csv);
    $header = array_map(fn($h) => strtoupper(trim($h, " \"\xEF\xBB\xBF")), str_getcsv(array_shift($lines), ';', '"', '\\'));
    $idx = array_flip($header);
    $col = function(array $cands) use ($idx): ?int { foreach ($cands as $c) if (isset($idx[$c])) return $idx[$c]; return null; };
    $C = ['id' => $col(['NR_IDENTIFICACAO_PESQUISA', 'NR_IDENTIFICACAO', 'NR_REGISTRO', 'NR_PROTOCOLO_REGISTRO', 'NR_PROTOCOLO']),
        'cargo' => $col(['DS_CARGO', 'NM_CARGO']), 'uf' => $col(['SG_UF', 'SG_UE', 'DS_ABRANGENCIA']),
        'empresa' => $col(['NM_EMPRESA', 'NM_FANTASIA', 'NM_RAZAO_SOCIAL', 'NM_EMPRESA_PESQUISA']),
        'inicio' => $col(['DT_INICIO_PESQUISA', 'DT_INICIO', 'DT_INI_PESQUISA']), 'fim' => $col(['DT_FIM_PESQUISA', 'DT_FIM', 'DT_TERMINO_PESQUISA']),
        'divulgacao' => $col(['DT_DIVULGACAO', 'DT_DIVULGACAO_PESQUISA', 'DT_PREVISTA_DIVULGACAO']), 'registro' => $col(['DT_REGISTRO', 'DT_REGISTRO_PESQUISA', 'DT_CADASTRO']),
        'amostra' => $col(['QT_ENTREVISTADOS', 'QT_AMOSTRA', 'QT_ENTREVISTAS', 'NR_ENTREVISTADOS']), 'estat' => $col(['NM_ESTATISTICO', 'NM_ESTATISTICO_RESPONSAVEL']),
        'contratante' => $col(['NM_CONTRATANTE', 'NM_CONTRATANTE_PRINCIPAL'])];
    if ($inspect) { echo "csv: $csvName rows=" . count($lines) . "\nheader: " . implode(' | ', $header) . "\ncolumns: " . json_encode($C) . "\n"; foreach (array_slice($lines, 0, 3) as $l) echo $l . "\n"; exit; }
    if ($C['id'] === null || $C['cargo'] === null) { $attempts[] = 'header not recognised: ' . implode('|', $header); continue; }
    foreach ($lines as $line) {
        if (trim($line) === '') continue;
        $f = str_getcsv($line, ';', '"', '\\');
        $g = fn($k) => $C[$k] !== null ? trim((string)($f[$C[$k]] ?? '')) : '';
        $rows[] = ['registration' => norm_protocol($g('id')), 'pollster' => $g('empresa'), 'contractor' => $g('contratante'), 'start' => toISO($g('inicio')), 'end' => toISO($g('fim')),
            'release' => toISO($g('divulgacao')), 'registered' => toISO($g('registro')), 'sample' => (int)preg_replace('/\D/', '', $g('amostra')), 'statistician' => $g('estat'),
            'cargo' => strtoupper($g('cargo')), 'uf' => strtoupper($C['uf'] !== null ? $g('uf') : 'BR')];
    }
    $via = 'tse'; break;
}
// ---- 2. fallback: community mirror of the same TSE dataset (presidential registrations only) ----
if ($via === null) {
    [$body, $code, $err] = fetch_url('https://raw.githubusercontent.com/rafaujo/eleicoes-2026-pesquisas/main/data/tse-metadata.json', 60);
    $attempts[] = "mirror => http=$code" . ($err ? " err=$err" : '');
    $j = ($body !== false && $code === 200) ? json_decode($body, true) : null;
    if (is_array($j) && !empty($j['records'])) {
        foreach ($j['records'] as $r) {
            $rows[] = ['registration' => norm_protocol((string)($r['protocol'] ?? '')), 'pollster' => (string)($r['tradeName'] ?: ($r['company'] ?? '')), 'contractor' => is_array($r['contractors'] ?? null) ? implode('; ', array_map(fn($c) => is_array($c) ? ($c['name'] ?? json_encode($c)) : (string)$c, $r['contractors'])) : (string)($r['contractors'] ?? ''),
                'start' => toISO($r['fieldStart'] ?? null), 'end' => toISO($r['fieldEnd'] ?? null), 'release' => toISO($r['disclosureDate'] ?? null), 'registered' => toISO($r['registeredAt'] ?? null),
                'sample' => (int)($r['sample'] ?? 0), 'statistician' => (string)($r['statistician'] ?? ''), 'cargo' => 'PRESIDENTE', 'uf' => 'BR'];
        }
        $via = 'mirror';
    }
}
if ($via === null) { $m = gmdate('c') . ' | FAIL all sources: ' . implode(' ; ', $attempts) . "\n"; file_put_contents($LOG, $m, FILE_APPEND); exit($m); }

$polls = json_decode((string)file_get_contents($DATA . '/polls.json'), true) ?: ['polls' => [], 'ignored' => []];
$known = [];
foreach ($polls['polls'] ?? [] as $p) if (!empty($p['registration'])) $known[norm_protocol($p['registration'])] = true;
foreach ($polls['ignored'] ?? [] as $r) $known[norm_protocol(is_array($r) ? ($r['registration'] ?? '') : (string)$r)] = true;

$today = gmdate('Y-m-d');
$pending = []; $seen = []; $total = 0; $presidential = 0;
foreach ($rows as $r) {
    $total++;
    if (strpos($r['cargo'], 'PRESIDENTE') === false) continue;
    if ($r['uf'] !== '' && $r['uf'] !== 'BR' && $r['uf'] !== 'BRASIL' && $r['uf'] !== 'NACIONAL') continue;
    $presidential++;
    $id = $r['registration']; if ($id === '' || isset($seen[$id])) continue; $seen[$id] = true;
    if (isset($known[$id])) continue;
    if ($r['release'] !== null && $r['release'] > $today) continue; // still embargoed: nothing to look for yet
    unset($r['cargo'], $r['uf']); $r['via'] = $via;
    $pending[] = $r;
}
usort($pending, fn($a, $b) => strcmp((string)$b['release'], (string)$a['release']));
$tmp = $DATA . '/pending.json.tmp';
file_put_contents($tmp, json_encode($pending, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)); rename($tmp, $DATA . '/pending.json');
$m = gmdate('c') . " | via=$via rows=$total presidential_national=$presidential pending=" . count($pending) . " known=" . count($known) . " | " . implode(' ; ', $attempts) . "\n";
file_put_contents($LOG, $m, FILE_APPEND);
echo $m;
