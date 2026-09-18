<?php
// Hourly: pull Kalshi + Polymarket price history for the Brazil 2026 presidential markets
// and write data/kalshi.json and data/polymarket.json in the shape index.html expects.
// Run from Hostinger cron:  php /path/to/public_html/cron/update_markets.php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("forbidden\n"); }
date_default_timezone_set('UTC');
$ROOT = dirname(__DIR__);
$DATA = $ROOT . '/data';
$LOG  = __DIR__ . '/last_run_markets.log';
$DAY  = 86400;
$now  = time();
$log  = [];

function http_get(string $url, int $timeout = 25): ?string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'User-Agent: themachineobserver.com data refresh (contact via site)']]);
    $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return ($body !== false && $code === 200) ? $body : null;
}
function write_atomic(string $path, array $data): void {
    $tmp = $path . '.tmp'; file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)); rename($tmp, $path);
}

// ---------- Kalshi ----------
$kalshi_series = [
    ['name' => 'Flávio Bolsonaro',            'ticker' => 'KXBRPRES-26-FBOL'],
    ['name' => 'Luiz Inácio Lula da Silva',   'ticker' => 'KXBRPRES-26-LULA'],
    ['name' => 'Augusto Cury',                'ticker' => 'KXBRPRES-26-ACUR'],
    ['name' => 'Jair Bolsonaro',              'ticker' => 'KXBRPRES-26-JB'],
];
$K_SERIES = 'KXBRPRES';
$k_base = 'https://api.elections.kalshi.com/trade-api/v2/series/' . $K_SERIES . '/markets/';
$year_start = gmmktime(0, 0, 0, 1, 1, 2026);

function kalshi_points(string $url): ?array {
    $body = http_get($url); if ($body === null) return null;
    $j = json_decode($body, true); if (!isset($j['candlesticks']) || !is_array($j['candlesticks'])) return null;
    $out = [];
    foreach ($j['candlesticks'] as $c) {
        $t = (int)($c['end_period_ts'] ?? 0); if (!$t) continue;
        $close = null;
        if (isset($c['price']['close']) && $c['price']['close'] !== null) $close = (float)$c['price']['close'];
        elseif (isset($c['price']['close_dollars']) && $c['price']['close_dollars'] !== null) $close = round((float)$c['price']['close_dollars'] * 100, 2);
        $vol = isset($c['volume_fp']) ? (float)$c['volume_fp'] : (float)($c['volume'] ?? 0);
        $out[] = ['t' => $t * 1000, 'p' => $close, 'volume' => $vol];
    }
    return $out;
}

$k_out = ['provider' => 'Kalshi', 'source' => 'https://kalshi.com/markets/kxbrpres/brazil-presidency/kxbrpres-26', 'retrieved' => gmdate('Y-m-d', $now),
    'cutoff' => $now * 1000, 'time_basis' => 'Official API Unix timestamps, rendered in UTC.',
    'method' => 'Official public API: daily candlestick closes for ALL and hourly closes for recent ranges. Null closes are preserved; no interpolation.', 'series' => []];
$k_ok = true;
foreach ($kalshi_series as $s) {
    $daily  = kalshi_points($k_base . $s['ticker'] . '/candlesticks?start_ts=' . $year_start . '&end_ts=' . $now . '&period_interval=1440');
    $hourly = kalshi_points($k_base . $s['ticker'] . '/candlesticks?start_ts=' . ($now - 31 * $DAY) . '&end_ts=' . $now . '&period_interval=60');
    if ($daily === null || $hourly === null) { $k_ok = false; $log[] = 'kalshi FAIL ' . $s['ticker']; continue; }
    $quote = null; foreach (array_reverse($hourly) as $p) if ($p['p'] !== null) { $quote = $p['p']; break; }
    if ($quote === null) foreach (array_reverse($daily) as $p) if ($p['p'] !== null) { $quote = $p['p']; break; }
    $k_out['series'][] = ['name' => $s['name'], 'ticker' => $s['ticker'], 'quote' => $quote, 'points' => $daily, 'hourly' => $hourly];
    $log[] = 'kalshi ' . $s['ticker'] . ' daily=' . count($daily) . ' hourly=' . count($hourly) . ' quote=' . var_export($quote, true);
}
if ($k_ok && count($k_out['series']) === count($kalshi_series)) { write_atomic($DATA . '/kalshi.json', $k_out); $log[] = 'kalshi.json written'; }
else $log[] = 'kalshi.json NOT written (kept previous)';

// ---------- Polymarket ----------
$poly_series = [
    ['name' => 'Flávio Bolsonaro',          'token_id' => '109876868437950584369987384406356259939519193117253465815665152916226511121427'],
    ['name' => 'Luiz Inácio Lula da Silva', 'token_id' => '30630994248667897740988010928640156931882346081873066002335460180076741328029'],
    ['name' => 'Renan Santos',              'token_id' => '93998891488819623915454849994768171534113749478841216025646247933473925258016'],
    ['name' => 'Augusto Cury',              'token_id' => '61078489744701316174218443335134825688547680779921710765642429680039972907213'],
];
$poly_ranges = ['ALL' => ['max', 1440], '1M' => ['1m', 360], '1W' => ['1w', 60], '1D' => ['1d', 60]];
$p_out = ['provider' => 'Polymarket', 'source' => 'https://polymarket.com/event/brazil-presidential-election', 'api_source' => 'https://clob.polymarket.com/prices-history',
    'retrieved' => gmdate('Y-m-d', $now), 'cutoff' => $now * 1000, 'time_basis' => 'Official CLOB API Unix timestamps, rendered in UTC.',
    'method' => 'Official public CLOB price history for the four leading outcomes shown on the event page. Provider observations only; no interpolation or price reconstruction.', 'series' => []];
$p_ok = true;
foreach ($poly_series as $s) {
    $ranges = [];
    foreach ($poly_ranges as $key => [$interval, $fidelity]) {
        $body = http_get('https://clob.polymarket.com/prices-history?market=' . $s['token_id'] . '&interval=' . $interval . '&fidelity=' . $fidelity);
        $j = $body === null ? null : json_decode($body, true);
        if (!isset($j['history']) || !is_array($j['history'])) { $p_ok = false; $log[] = 'polymarket FAIL ' . $s['name'] . ' ' . $key; continue 2; }
        $pts = [];
        foreach ($j['history'] as $h) $pts[] = ['t' => (int)$h['t'] * 1000, 'p' => round((float)$h['p'] * 100, 2)];
        $ranges[$key] = $pts;
    }
    $quote = null; if (!empty($ranges['1D'])) $quote = end($ranges['1D'])['p']; elseif (!empty($ranges['ALL'])) $quote = end($ranges['ALL'])['p'];
    $p_out['series'][] = ['name' => $s['name'], 'token_id' => $s['token_id'], 'quote' => $quote, 'ranges' => $ranges];
    $log[] = 'polymarket ' . $s['name'] . ' ' . json_encode(array_map('count', $ranges)) . ' quote=' . var_export($quote, true);
}
if ($p_ok && count($p_out['series']) === count($poly_series)) { write_atomic($DATA . '/polymarket.json', $p_out); $log[] = 'polymarket.json written'; }
else $log[] = 'polymarket.json NOT written (kept previous)';

$line = gmdate('c') . ' | ' . implode(' | ', $log) . "\n";
file_put_contents($LOG, $line, FILE_APPEND);
echo $line;
