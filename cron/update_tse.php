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

$tmpzip = sys_get_temp_dir() . '/pesquisa_eleitoral_2026.zip';
$body = false; $code = 0; $err = '';
foreach (['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', 'curl/8.4.0'] as $ua) {
    $ch = curl_init($ZIP_URL);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 180, CURLOPT_USERAGENT => $ua,
        CURLOPT_HTTPHEADER => ['Accept: */*', 'Accept-Language: pt-BR,pt;q=0.9', 'Referer: https://dadosabertos.tse.jus.br/dataset/pesquisas-eleitorais-2026']]);
    $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    if ($body !== false && $code === 200 && strlen($body) > 1000) break;
}
if ($body === false || $code !== 200 || strlen($body) < 1000) { $m = gmdate('c') . " | download FAIL http=$code err=$err\n"; file_put_contents($LOG, $m, FILE_APPEND); exit($m); }
file_put_contents($tmpzip, $body);

$zip = new ZipArchive();
if ($zip->open($tmpzip) !== true) { $m = gmdate('c') . " | zip open FAIL\n"; file_put_contents($LOG, $m, FILE_APPEND); exit($m); }
$csvName = null;
for ($i = 0; $i < $zip->numFiles; $i++) { $n = $zip->getNameIndex($i); if (preg_match('/^pesquisa_eleitoral_2026.*\.csv$/i', basename($n))) { $csvName = $n; break; } }
if ($csvName === null) for ($i = 0; $i < $zip->numFiles; $i++) { $n = $zip->getNameIndex($i); if (preg_match('/\.csv$/i', $n)) { $csvName = $n; break; } }
if ($csvName === null) { $m = gmdate('c') . " | no csv in zip\n"; file_put_contents($LOG, $m, FILE_APPEND); exit($m); }
$csv = $zip->getFromName($csvName); $zip->close(); @unlink($tmpzip);
$csv = mb_convert_encoding($csv, 'UTF-8', 'ISO-8859-1');

$lines = preg_split("/\r\n|\n|\r/", $csv);
$header = str_getcsv(array_shift($lines), ';', '"', '\\');
$header = array_map(fn($h) => strtoupper(trim($h, " \"\xEF\xBB\xBF")), $header);
$idx = array_flip($header);

// column detection: first candidate found wins
function col(array $idx, array $cands): ?int { foreach ($cands as $c) if (isset($idx[$c])) return $idx[$c]; return null; }
$C = [
    'id'         => col($idx, ['NR_IDENTIFICACAO_PESQUISA', 'NR_IDENTIFICACAO', 'NR_REGISTRO', 'NR_PROTOCOLO_REGISTRO', 'NR_PROTOCOLO']),
    'cargo'      => col($idx, ['DS_CARGO', 'NM_CARGO', 'CD_CARGO']),
    'uf'         => col($idx, ['SG_UF', 'SG_UE', 'DS_ABRANGENCIA']),
    'empresa'    => col($idx, ['NM_EMPRESA', 'NM_FANTASIA', 'NM_RAZAO_SOCIAL', 'NM_EMPRESA_PESQUISA']),
    'inicio'     => col($idx, ['DT_INICIO_PESQUISA', 'DT_INICIO', 'DT_INI_PESQUISA']),
    'fim'        => col($idx, ['DT_FIM_PESQUISA', 'DT_FIM', 'DT_TERMINO_PESQUISA']),
    'divulgacao' => col($idx, ['DT_DIVULGACAO', 'DT_DIVULGACAO_PESQUISA', 'DT_PREVISTA_DIVULGACAO']),
    'registro'   => col($idx, ['DT_REGISTRO', 'DT_REGISTRO_PESQUISA', 'DT_CADASTRO']),
    'amostra'    => col($idx, ['QT_ENTREVISTADOS', 'QT_AMOSTRA', 'QT_ENTREVISTAS', 'NR_ENTREVISTADOS']),
    'estat'      => col($idx, ['NM_ESTATISTICO', 'NM_ESTATISTICO_RESPONSAVEL']),
    'contratante'=> col($idx, ['NM_CONTRATANTE', 'NM_CONTRATANTE_PRINCIPAL']),
];
if ($inspect) {
    echo "csv: $csvName rows=" . count($lines) . "\nheader: " . implode(' | ', $header) . "\ncolumns: " . json_encode($C) . "\n";
    foreach (array_slice($lines, 0, 3) as $l) echo $l . "\n";
    exit;
}
if ($C['id'] === null || $C['cargo'] === null) { $m = gmdate('c') . ' | header not recognised: ' . implode('|', $header) . "\n"; file_put_contents($LOG, $m, FILE_APPEND); exit($m); }

function toISO(?string $d): ?string { // 17/09/2026 or 2026-09-17 -> 2026-09-17
    if (!$d) return null; $d = trim($d);
    if (preg_match('~^(\d{2})/(\d{2})/(\d{4})~', $d, $m)) return "$m[3]-$m[2]-$m[1]";
    if (preg_match('~^(\d{4})-(\d{2})-(\d{2})~', $d, $m)) return "$m[1]-$m[2]-$m[3]";
    return null;
}

$polls = json_decode((string)file_get_contents($DATA . '/polls.json'), true) ?: ['polls' => [], 'ignored' => []];
$known = [];
foreach ($polls['polls'] ?? [] as $p) if (!empty($p['registration'])) $known[strtoupper(trim($p['registration']))] = true;
foreach ($polls['ignored'] ?? [] as $r) $known[strtoupper(trim(is_array($r) ? ($r['registration'] ?? '') : $r))] = true;

$today = gmdate('Y-m-d');
$pending = []; $seen = []; $total = 0; $presidential = 0;
foreach ($lines as $line) {
    if (trim($line) === '') continue;
    $f = str_getcsv($line, ';', '"', '\\'); $total++;
    $cargo = strtoupper((string)($f[$C['cargo']] ?? ''));
    if (strpos($cargo, 'PRESIDENTE') === false) continue;
    $uf = strtoupper(trim((string)($C['uf'] !== null ? ($f[$C['uf']] ?? '') : 'BR')));
    if ($uf !== '' && $uf !== 'BR' && $uf !== 'BRASIL' && $uf !== 'NACIONAL') continue;
    $presidential++;
    $id = strtoupper(trim((string)($f[$C['id']] ?? ''))); if ($id === '' || isset($seen[$id])) continue; $seen[$id] = true;
    if (isset($known[$id])) continue;
    $release = $C['divulgacao'] !== null ? toISO($f[$C['divulgacao']] ?? null) : null;
    if ($release !== null && $release > $today) continue; // still embargoed: nothing to look for yet
    $pending[] = [
        'registration' => $id,
        'pollster'     => $C['empresa'] !== null ? trim((string)$f[$C['empresa']]) : '',
        'contractor'   => $C['contratante'] !== null ? trim((string)$f[$C['contratante']]) : '',
        'start'        => $C['inicio'] !== null ? toISO($f[$C['inicio']] ?? null) : null,
        'end'          => $C['fim'] !== null ? toISO($f[$C['fim']] ?? null) : null,
        'release'      => $release,
        'registered'   => $C['registro'] !== null ? toISO($f[$C['registro']] ?? null) : null,
        'sample'       => $C['amostra'] !== null ? (int)preg_replace('/\D/', '', (string)$f[$C['amostra']]) : null,
        'statistician' => $C['estat'] !== null ? trim((string)$f[$C['estat']]) : '',
    ];
}
usort($pending, fn($a, $b) => strcmp((string)$b['release'], (string)$a['release']));
$tmp = $DATA . '/pending.json.tmp';
file_put_contents($tmp, json_encode($pending, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)); rename($tmp, $DATA . '/pending.json');
$m = gmdate('c') . " | rows=$total presidential_national=$presidential pending=" . count($pending) . " known=" . count($known) . "\n";
file_put_contents($LOG, $m, FILE_APPEND);
echo $m;
