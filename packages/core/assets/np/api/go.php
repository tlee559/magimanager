<?php
// start timer
$timeStart = microtime(true);

// set UTC
date_default_timezone_set('UTC');

// check whether called from a non-footprint file
if ( !defined('APPLOC') ) {
	define('APPLOC','');
}

// includes
$pathAppend = isset($pathAppend) ? $pathAppend : '';
include(APPLOC.$pathAppend.'constants.php');
include(APPLOC.$pathAppend.'config.php');

// check cloaker camp id
$_GET['clid'] = isset($_GET['clid']) ? $_GET['clid'] : '';

function base64url_encode($data) { 
	return rtrim(strtr(base64_encode($data), '+/', '-_'), '='); 
}

function base64url_decode($data) { 
	return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4, '=', STR_PAD_RIGHT)); 
}

if (!function_exists('getallheaders')) {
	function getallheaders() { 
		$headers = array(); 
		foreach ($_SERVER as $name => $value) { 
			if (substr($name, 0, 5) == 'HTTP_') { 
				$headers[str_replace(' ', '-', str_replace('_', ' ', substr($name, 5)))] = $value; 
			} 
		}
		return $headers; 
	} 
}

function getAPCCamp($clid) {
	if (APCU_ENABLED) {
		if ( apcu_exists('noipfraud-'.$clid) ) {
			$camp = apcu_fetch('noipfraud-'.$clid, $success);
			if ( $success && !empty($camp) ) {
				$camp['source'] = 'apc';
				return $camp;
			}
		}
	}
	return false;
}

if (!function_exists('getLocalDb')) {
	function getLocalDb() {
		// get db path
		$dbpath = DB_FILE;
		if (strpos('/',DB_FILE) === false) {
			$dbpath = __DIR__.'/db/'.$dbpath;
		}
		$ldb = new SQLite3($dbpath, SQLITE3_OPEN_READONLY, DB_KEY); // open database
		$ldb->busyTimeout(60000); 
		return $ldb;
	}
}

function getDBCamp($clid) {
	try {
		$ldb = getLocalDb();
		$camp = $ldb->querySingle('SELECT * FROM campaigns WHERE name=\''.SQLite3::escapeString($clid).'\'', true);
		if( $camp == false ) { 
			throw new Exception($ldb->lastErrorMsg()); 
		} // invalid query
		$ldb->close();
		if( sizeof($camp) == 0 ) { return false; } // not found
		$camp['active'] = intval($camp['active']);
		$camp['archived'] = intval($camp['archived']);
		$camp['realurl'] = unserialize($camp['realurl']);
		$camp['dynvar'] = unserialize($camp['dynvar']);
		$camp['urlfilter'] = unserialize($camp['urlfilter']);
		$camp['rules'] = unserialize($camp['rules']);
		$camp['filters'] = unserialize($camp['filters']);
		$camp['schedule'] = unserialize($camp['schedule']);
		$camp['pagelock'] = unserialize($camp['pagelock']);
		return $camp;
	} catch (Exception $e) {
		if ($e->getCode() === 0) return false;
		$ldb->close();
		header("HTTP/1.1 500 Internal Server Error");
		exit();
	}
}

function setCampaignCtrl($ctrl) {
	try {
		$dbpath = DB_FILE;
		if (strpos('/',DB_FILE) === false) {
			$dbpath = __DIR__.'/db/'.$dbpath;
		}
		$ldb = new SQLite3($dbpath, SQLITE3_OPEN_READWRITE, DB_KEY); // open database
		$ldb->busyTimeout(60000);
		foreach ($ctrl as $clid => $sts) {
			$ex = "UPDATE campaigns SET
					active=".SQLite3::escapeString($sts); 
			$ex .= " WHERE name='".SQLite3::escapeString($clid)."' AND archived=0";
			$ok = $ldb->exec($ex);
			if (APCU_ENABLED) apcu_delete('noipfraud-'.$clid);
		}
		$ldb->close();
	} catch (Exception $e) {
		// do nothing
	}
}

function campaignNotFound() {
	header("HTTP/1.1 404 Not Found");
	exit();
}

function callCheckApi($curl_config) {
	$result = array();
	$ch = curl_init();
	curl_setopt_array($ch, $curl_config);
	$json = json_decode(curl_exec($ch));
	$info = curl_getinfo($ch);
	$error = curl_error($ch);
	$errno = curl_errno($ch);
	curl_close($ch);
	
	$result = array(
		'raw' => $json,
		'curl_errno' => $errno,
		'curl_error' => $error,
		'curl_info' => $info,
		'ctrl' => !empty($json->ctrl) ? get_object_vars($json->ctrl) : null,
		'geodata' => !empty($json->data) ? get_object_vars($json->data) : null,
		'result' => (!empty($json->result) ? (int) $json->result : 0),
		'error' => !empty($json->error) ? $json->error : ""
	);
	
	return $result;
}

// get campaign
$clid = $_GET['clid'];
if (empty($clid)) { campaignNotFound(); }
$camp = getAPCCamp($clid); 
if ( !$camp ) {
	$camp = getDBCamp($clid);
	$camp['source'] = 'db';
	if (!$camp) { campaignNotFound(); }
	if(APCU_ENABLED) {
		if ( !apcu_store('noipfraud-'.$clid, $camp, APC_EXPIRY) ) {
			$debug_msg['apc'][] = 'Failed to store clid '.$clid;
		} else {
			$debug_msg['apc'][] = 'Stored clid '.$clid;
		}
	}
}
$campArchived = $camp['archived'] == 1 ? true : false;

// get ip
if (isset($_SERVER['HTTP_CLIENT_IP'])) {
	//check ip from share internet
	$realIP=$_SERVER['HTTP_CLIENT_IP'];
	$fakeIP=$_SERVER['REMOTE_ADDR'];
	$ipType = IP_SHARE;
} elseif (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
	//to check ip is pass from proxy
	$realIP=$_SERVER['HTTP_X_FORWARDED_FOR'];
	$fakeIP=$_SERVER['REMOTE_ADDR'];
	$ipType = IP_PROXY;
} else {
	$realIP=$_SERVER['REMOTE_ADDR'];
	$fakeIP=$_SERVER['REMOTE_ADDR'];
	$ipType = IP_REAL;
}

// check for debug request
$debug = isset($_GET['debug']) ? '&debug' : '';
$test = isset($_GET['dummy']) ? '&dummy' : '';

// set utrck
$utrck = md5('just@r@nd0ms@lt'.date('U').mt_rand());

// set fingerprint
$fngr = $camp['traffic'];
$fngr .= isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
$fngr .= isset($_SERVER['HTTP_ACCEPT']) ? $_SERVER['HTTP_ACCEPT'] : '';
$fngr .= isset($_SERVER['HTTP_ACCEPT_ENCODING']) ? $_SERVER['HTTP_ACCEPT_ENCODING'] : '';
$fngr .= isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) ? $_SERVER['HTTP_ACCEPT_LANGUAGE'] : '';
$fngr .= isset($_SERVER['HTTP_ACCEPT_CHARSET']) ? $_SERVER['HTTP_ACCEPT_CHARSET'] : '';
$fngr = md5($fngr);

// process local filters
$isItSafe=true;
$querystr = http_build_query($_GET);
$shd = 'false';
$urlf = 'false';

if ( !empty($camp['urlkeyword']) && preg_match('!'.$camp['urlkeyword'].'!i', $querystr) )
	$urlf = 'true';

if ( !empty($camp['urlfilter']) ) {
	foreach($camp['urlfilter'] as $urlfilter) {
		if (!empty($urlfilter['variable'])) {
			switch($urlfilter['action']) {
				case "1":
					if (isset($_GET[$urlfilter['variable']]))
						$urlf = 'true';
					break;
				case "2":
					if (empty($_GET[$urlfilter['variable']])) 
						$urlf = 'true';
					break;
				case "3":
					if (isset($_GET[$urlfilter['variable']])) {
						if ($_GET[$urlfilter['variable']] == $urlfilter['value'])
							$urlf = 'true';
					}
					break;
				case "4":
					if (isset($_GET[$urlfilter['variable']])) {
						if ($_GET[$urlfilter['variable']] != $urlfilter['value'])
							$urlf = 'true';
					} else {
						$urlf = 'true';
					}
					break;
			}
		}
	}
}

if ($camp['active'] == 3) {
	$shd = 'true';
	$camp['active'] = -1;
	$cDay = date("N", time()) - 1;
	$cMin = (date("G", time())*60) + intval(date('i', time()));
	foreach($camp['schedule'] as $slot) {
		if ($cDay == $slot['day']) {
			if ($cMin >= $slot['start'] && $cMin <= $slot['stop']) {
				$camp['active'] = 1;
				break;
			}
		}
	}
}

// choose primary page
$primary = $camp['realurl'][chooseUrl($camp['realurl'])];
$primaryUrl = $primary['url'];
$cvtracking = (strpos($primaryUrl, '[[subid]]') !== false);

// dynamic variable tracking
$d = array();
if (!empty($camp['dynvar'])) {
	foreach($camp['dynvar'] as $dyn) {
		$trk = !empty($dyn['track']) ? $dyn['track'] : false;
		$name = $dyn['name'];
		if ($trk && !empty($name)) {
			$d[$name] = !empty($_GET[$name]) ? $_GET[$name] : '';
		}
	}
}
// landing page tracking
if ($camp['lptrack'] == true && !empty($primary['desc'])) {
	$d['_landingpage_'] = $primary['desc'];
}
$dyntrk = base64url_encode(json_encode($d));

//$hoststr = gethostbyaddr($realIP);
$utc = time();
$sig = hash_hmac('sha256', $utc.APIKEY, APISECRET);
$auth2 = http_build_query(array(
	'auth'=>2,
	'key'=>APIKEY,
	'utc'=>$utc,
	'sig'=>$sig
));

$rq = '&'.http_build_query(array(
	'clid'=>$_GET['clid'],
	'ts'=>$camp['traffic'],
	'cv'=>CLIENT_VERSION,
	'ref'=>isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '',
	'ua'=>$_SERVER['HTTP_USER_AGENT'],
	'fip'=>$fakeIP,
	'rip'=>$realIP,
	'ipt'=>$ipType,
	'status'=>$camp['active'],
	'trk'=>$utrck,
	'fgr'=>$fngr,
	'cookie'=>false,
	'shd'=>$shd,
	'urlf'=>$urlf,
	'dyntrk'=>$dyntrk,
	'iid'=>md5(DB_KEY),
	'sid'=>$cvtracking
));

$url = 'http://'.API_DOMAIN.API_PATH.'api.php?a=check&'.$auth2.$rq.$debug.$test;

// build params
$curl_config[CURLOPT_URL] = $url;
$cpost = array();
$cpost['headers'] = array_change_key_case(getallheaders(), CASE_LOWER);
if (isset($camp['rules']) && count($camp['rules']) > 0) {
	$cpost['rules'] = $camp['rules'];
}
if (isset($camp['filters']) && count($camp['filters']) > 0) {
	$cpost['filters'] = $camp['filters'];
}
if (count($cpost) > 0) {
	$curl_config[CURLOPT_POST] = 1;
	$curl_config[CURLOPT_POSTFIELDS] = json_encode($cpost);
}

// block prefetch requests
foreach($camp['filters'] as $filter) {
	if ($filter['$id'] == '5768041300eded16b8316f2e') {
		$lc = array_change_key_case($cpost['headers'], CASE_LOWER);
		if (!empty($lc['x-purpose'])&&strtolower($lc['x-purpose'])=='preview') {
				header('Location: /'.substr(md5(microtime()),0,rand(1,12)));
				header('Content-Length: '.rand(1,128));exit();
		}
	}
}

// get result
$apiResult = callCheckApi($curl_config);

// process campaign control
if (!empty($apiResult['ctrl']) && $apiResult['ctrl'] !== null)
	setCampaignCtrl($apiResult['ctrl']);

$isItSafe = $apiResult['result'] > 0 ? $isItSafe : false;

// set goto
$goto = $isItSafe ? $primaryUrl : $camp['fakeurl'];

// dynamic var passthrough
foreach($_GET as $k => $v) {
	if (stripos($goto, "[[$k]]") !== false) {
		$goto = str_ireplace("[[$k]]", urlencode($v), $goto);
	} elseif ($camp['dynautopt'] == true) {
		if ($k == 'clid' || $k == 'tok' || empty($v)) continue;
		if(strpos($goto, '?') !== false)
			$goto .= "&$k=".urlencode($v);
		else 
			$goto .= "?$k=".urlencode($v);
	}
}

// add built-in params
if (preg_match_all('!\[{2}(.*?)\]{2}!', $goto, $matches) > 0) {
	$ddv = explode(',', DEF_DYN_VARS);
	foreach($matches[1] as $v) {
		if ( in_array($v, $ddv, true) ) {
			$goto = str_ireplace("[[$v]]", isset($apiResult['geodata'][$v]) ? urlencode($apiResult['geodata'][$v]) : '', $goto);
		} else {
			$goto = str_ireplace("[[$v]]", '', $goto);
		}
	}
}

// add pagelock
if ($camp['pagelock']['enabled'] == true) {
	$enc = base64url_encode(strrev($utc).hash_hmac('sha256',$utc,APIKEY));
	$renc = str_shuffle($enc);
	$pagelock = strtolower(substr($renc,0,rand(3,6))).'='.$enc.substr($renc,-rand(1,10));
	if(strpos($goto, '?') !== false)
		$goto .= "&$pagelock";
	else 
		$goto .= "?$pagelock";
}

// check if included
if ( __FILE__ == $_SERVER['SCRIPT_FILENAME'] ) {
	//go.php is called direct so process as well
	noIpFraud();
}

function noIpFraud($js = false) {
	global $goto, $shd, $urlf, $timeStart, $debug_msg, $camp, $vid, $fakeIP, $realIP, $url, $param, $apiResult, $isItSafe, $campArchived, $pagelock;

	$doRedir = ( stripos($goto,'http://') === 0 || stripos($goto,'https://') === 0 );
	$dur = microtime(true) - $timeStart;

	if ( (DEBUG || isset($_GET['test'])) && loggedIn() ) {
		if ($campArchived) {
			$campStatus = 'Archived';
		} elseif ($shd == 'true') {
			$campStatus = ($camp['active'] == -1 ? 'Scheduled, blocking' : 'Scheduled, active');
		} else {
			switch ($camp['active']) {
				case -1:
					$campStatus = 'Paused';
					break;
				case 0:
					$campStatus = 'Under review';
					break;
				case 1:
					$campStatus = 'Active';
					break;
				case 2:
					$campStatus = 'Allowing all';
					break;
				default:
					$campStatus = 'Error';
			} 
		}
?>

		<html>
		<head>
			<title>Test link (<?php echo $_GET['clid'] ?>)</title>
			<style>
				body {
					font-size: 14px;
					font-family: monospace;
				}
			</style>
		</head>
		<body>
			<?php if (DEBUG) { ?><h1>DEBUG</h1><?php } ?>
			<p>
				Name: <?php echo $camp['info'] ?><br>
				CLID: <?php echo $_GET['clid'] ?><br>
				State: <?php echo $campStatus ?><br>
				Random Value: <?php echo mt_rand(); ?><br>
			</p>

			<p>
				Result: <?php echo $isItSafe ? 'Show primary page' : 'Show alternative page' ?><br>
				Action: <?php echo $doRedir ? 'Redirect to ' : 'Include file '?> <?php echo ($camp['pagelock']['enabled'] == true) ? preg_replace("/.$pagelock/", '', $goto, 1) : $goto; ?><br>
			</p>

			<p>
				API Errors: <?php echo isset($apiResult['error'][0]) ? $apiResult['error'][0] : 'no errors' ?><br>
				API Response in <?php echo round($apiResult['curl_info']['total_time']*1000,3); ?>ms<br>
			</p>

			<?php if (DEBUG) { ?>

			<h2>API Check Vars</h2>
			<ul>
				<li>API_DOMAIN: <?php echo API_DOMAIN; ?></li>
				<li>API_PATH: <?php echo API_PATH; ?></li>
				<li>API_KEY: <?php echo APIKEY; ?></li>
				<li>DEBUG: <?php echo DEBUG ? "On" : "Off" ?></li>
				<li>Referrer: <?php echo isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : 'None'; ?></li>
				<li>Useragent: <?php echo $_SERVER['HTTP_USER_AGENT']; ?></li>
				<li>Fakeip: <?php echo $fakeIP; ?></li>
				<li>Realip: <?php echo $realIP; ?></li>
				<li>Goto: <?php echo $goto; ?></li>
				<li>Type: <?php echo $doRedir ? 'Redir' : 'Include'; ?></li>
				<li>Param: <?php echo $param; ?></li>
				<li>Visitorid: <?php echo $vid; ?></li>
				<li>Api proc time: <?php echo round($apiResult['curl_info']['total_time']*1000, 3); ?>ms</li>
				<li>Client overhead: <?php echo round(($dur-$apiResult['curl_info']['total_time'])*1000, 3); ?>ms</li>
			</ul>
			
			<h2>PHP Key Info</h2>
			<ul>
				<li>PHP Version: <?php echo phpversion(); ?></li>
				<li>Server Software: <?php echo $_SERVER['SERVER_SOFTWARE']; ?></li>
				<li>Server IP: <?php echo $_SERVER['SERVER_ADDR']; ?></li>
				<li>Remote IP: <?php echo $_SERVER['REMOTE_ADDR']; ?></li>
				<li>cURL Loaded: <?php echo function_exists('curl_init') ? 'Yes' : 'No'; ?></li>
				<li>mbstring Loaded: <?php echo extension_loaded('mbstring') ? 'Yes' : 'No'; ?></li>
				<li>SQLite Loaded: <?php echo extension_loaded('sqlite3') ? 'Yes' : 'No'; ?></li>
				<li>OpenSSL Loaded: <?php echo extension_loaded('openssl') ? 'Yes' : 'No'; ?></li>
				<li>APCu Loaded: <?php echo extension_loaded('apcu') && ini_get('apc.enabled') ? 'Yes' : 'No'; ?></li>
			</ul>
			
			<h2>Campaign</h2>
			<ul>
				<li>Clid: <?php echo $camp['name']; ?></li>
				<li>Title: <?php echo $camp['info']; ?></li>
				<li>Client Version: <?php echo $camp['cv']; ?></li>
				<li>Source: <?php echo $camp['source']; ?></li>			
			</ul>
			<details>
				<summary>Full Campaign Data</summary>
				<pre><?php var_dump($camp); ?></pre>
			</details>
			<?php if ( APCU_ENABLED ) { ?>
			<details>
				<summary>APCu Cache Info Details</summary>
				<pre><?php var_dump(apcu_cache_info()); ?></pre>
			</details>
			<?php } ?>

			<h2>API Result</h2>
			<ul>
				<li>Result: <?php echo $apiResult['result'].' = '.($isItSafe ? "ALLOWED" : "BLOCKED") ?></li>
				<li>Event Control: <pre><?php print_r($apiResult['ctrl']) ?></pre></li>
			</ul>
			<details>
				<summary>API Result Details</summary>
				<pre><?php var_dump($apiResult); ?></pre>
			</details>

			<h2>Environment Check</h2>
			<iframe width="100%" border="0" style="border:0px;width:100%;" src="api/state.php?a=checkEnv"></iframe>
			
			<h2>PHP Info</h2>
			<?php phpinfo(); ?>
			<?php } ?>
		</body>
		</html>

<?php
	} else {
		// redirect
		if ( $doRedir ) {
			if ($js) {
				if($apiResult['result'] == 1) {
					header('Cache-Control: no-cache');
					header('Content-Type: text/javascript');
					$q = (strpos($goto, '?') === false) ? '?' : '&';
					if(isset($_GET['b']) && $_GET['b'] == '0') {
						echo "window.location.replace('".$goto.$q."'+window.location.search.substring(1));";
					} else {
						echo "top.location.replace('".$goto.$q."'+window.location.search.substring(1));";
					}
				}
			} else {
				if(!headers_sent()) {
					header('Location: '.$goto, true, 302);
					exit();
				} 
				?>
				<html>
				<head>
					<title>Redirecting...</title>
					<meta name="robots" content="noindex nofollow" />
					<script type="text/javascript">
						window.location.replace('<?php echo $goto ?>');
					</script>
					<noscript>
						<meta http-equiv="refresh" content="0;url='<?php echo $goto ?>'" />
					</noscript>
				</head>
				<body>
				You are being redirected to <a href="<?php echo $goto ?>" target="_top">your destination</a>.
				<script type="text/javascript">
					window.location.replace('<?php echo $goto ?>');
				</script>
				</body>
				</html>
				<?php
			}

		// include
		} else {
			//get url vars and put back into get
			$tmp = explode('?',$goto);
			if ( count($tmp) > 1 ) {
				parse_str($tmp[1],$getArr);
				$_GET = array_merge($_GET,$getArr);
			}
			include "$tmp[0]";
		}
	}
	exit();
}

function chooseUrl($url) {
	$r = mt_rand(1, 100);
	foreach ($url as $i => $u) {
		$weight = $u['perc'];
		$item = $u['url'];
		if  ($weight >= $r) {
			return $i;
		}
		$r -= $weight;
	}
}

function loggedIn() {
	require_once('common.php');
	if(empty($_GET['tok'])) return false;
	if(!checkAuth($_GET['tok'])) return false;
	return true;
}
