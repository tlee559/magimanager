/**
 * NoIPFraud go.php and state.php
 *
 * These are the core cloaker files.
 */

import { NP_FILES } from "./np-files";

// go.php - Main cloaker logic
NP_FILES["np/api/go.php"] = `<?php
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
		$camp = $ldb->querySingle('SELECT * FROM campaigns WHERE name=\\''.SQLite3::escapeString($clid).'\\'', true);
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
if (preg_match_all('!\\[{2}(.*?)\\]{2}!', $goto, $matches) > 0) {
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
`;

// state.php - Installation and upgrade logic
NP_FILES["np/api/state.php"] = `<?php

require_once('constants.php');

function localApiResponse($json, $header = 'HTTP/1.1 200 OK', $contentType = "application/json") {
	if ($header !== NULL) {
		header($header);
	}
	header("Content-Type: $contentType");
	echo $json;
}

$action = isset($_GET['a']) ? $_GET['a'] : 'check';
switch ($action) {
case 'check':
	// check api installed
	if (!file_exists('config.php')) {
		localApiResponse(json_encode(array('result' => false)));
		exit();
	}

	localApiResponse(json_encode(array('result' => true)));
	break;

case 'checkEnv':
	$errors = array();
	$warnings = array();
	$path = dirname(__FILE__);

	// warn: apc not installed
	if ( !APCU_ENABLED ) {
		$warnings[] = 'It is recommended that you install the PHP APCu extension for a significant performance gain.';
	}

	// pass: openSSL installed
	if ( !function_exists('openssl_random_pseudo_bytes') ) {
		$errors[] = 'Required dependency OpenSSL is not installed for PHP.';
	}

	// pass: SQLite3 installed
	if( !method_exists('SQLite3', 'escapeString') ) {
		$errors[] = 'Required dependency SQLite3 is not installed for PHP.';
	}

	// pass: curl installed
	if( !function_exists('curl_init') ) {
		$errors[] = 'Required dependency curl is not installed for PHP.';
	}

	// pass: mbstring loaded
	if ( !extension_loaded('mbstring') ) {
		$errors[] = 'Required extension mbstring is not installed for PHP.';
	}

	// pass: constants.php exists
	if ( !file_exists('constants.php') ) {
		$errors[] = 'Client installation corrupt: "constants.php" not found in '.$path. '. Try uploading a fresh copy of the client to your host.';
	}

	// pass: config.php does not exist
	if ( file_exists('config.php') ) {
		$errors[] = 'config.php exists in '.$path.' - remove this file and retry to reinstall.';
	}

	// pass: current path is writeable
	if ( !is_writeable($path) ) {
		$errors[] = 'API path ('.$path.') is not writeable. Make sure the directory and subdirectories owner and group have the permissions: Read, Write, and Execute (77x).';
	}

	// pass: no existing db directory, or existing db directory is writeable
	if ( is_dir($path.'/db') ) {
		if ( !is_writeable($path.'/db') ) {
			$errors[] = 'Existing database path ('.$path.'/db) is not writeable. Make sure the directory and subdirectories owner and group have the permissions: Read, Write, and Execute (77x).';
		}
	}

	// return result
	$r = array(
		'result' => (count($errors) == 0),
		'errors' => $errors,
		'warnings' => $warnings
	);
	localApiResponse(json_encode($r));
	break;

case 'inst':

	/*** validate request ***/
	$body = file_get_contents('php://input');
	$inst = json_decode($body, true);
	if ( !$inst || empty($inst) ||
		 empty($inst['apiKey']) || empty($inst['apiSecret']) || empty($inst['apiSecret']) ||
		 empty($inst['username']) || empty($inst['password']) ) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// initialize
	require_once('constants.php');
	$errors = array();
	$path = dirname(__FILE__);

	// fail: config.php exists
	if ( file_exists('config.php') ) {
		$error = 'config.php exists in '.$path.' - remove this file and retry to reinstall.';
		localApiResponse(json_encode(array('result'=>false, 'error'=>$error)), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	/*** validate API key & secret ***/
	$utc = time();
	$params = array('a'=>'info');
	$auth = array(
		'auth' => 2,
		'key' => $inst['apiKey'],
		'utc' => $utc,
		'sig' => hash_hmac('sha256', $utc.$inst['apiKey'], $inst['apiSecret'])
	);
	$q = http_build_query(array_merge($auth, $params));
	$url = 'http://'.API_DOMAIN.API_PATH.'api.php?'.$q;

	// execute request
	$ch = curl_init();
	$curl_config[CURLOPT_URL] = $url;
	curl_setopt_array($ch, $curl_config);
	$data = curl_exec($ch);
	$c_errno = curl_errno($ch);
	$c_err = curl_error($ch);
	curl_close($ch);

	// check curl success
	if ($c_errno !== 0) {
		$error = 'Error communicating with API: ('.$c_errno.') '.$c_err;
		localApiResponse(json_encode(array('result'=>false, 'error'=>$error)), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}
	// decode
	$res = json_decode($data, true);
	if (!$res) {
		$error = $data;
		localApiResponse(json_encode(array('result'=>false, 'error'=>$error)), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}
	// check status
	if (isset($res['error'])) {
		$error = $res['error'][0];
		localApiResponse(json_encode(array('result'=>false, 'error'=>$error)), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	/*** create DB ***/
	$db = array(
		'content' => array()
	);

	// make db path
	if ( !is_dir($path.'/db') ) {
		if ( !mkdir($path.'/db', 0755, true) ) {
			$error = 'Unable to create directory '.$path.'/db';
			localApiResponse(json_encode(array('result'=>false, 'error'=>$error)), 'HTTP/1.0 500 Internal Server Error');
			exit();
		}
	}

	// apache HTTP_AUTHORIZATION fix
	if (@file_put_contents($path.'/.htaccess','SetEnvIf Authorization .+ HTTP_AUTHORIZATION=$0') === false) {
		$error = 'Unable to write files to directory '.$path;
		localApiResponse(json_encode(array('result'=>false, 'error'=>$error)), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// secure directories
	if ( (@file_put_contents($path.'/db/.htaccess','deny from all') === false) ||
		 (@file_put_contents($path.'/db/index.html','') === false) ) {
		$error = 'Unable to write files to directory '.$path.'/db';
		localApiResponse(json_encode(array('result'=>false, 'error'=>$error)), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// generate db filename
	$bs = bin2hex(openssl_random_pseudo_bytes(16));
	$db['filename'] = substr(strtr(base64_encode($bs), '+/', '_-'), 0, 22).'.noipdb';
	$db['file'] = $path.'/db/'.$db['filename'];

	// generate db encryption key
	$bs = bin2hex(openssl_random_pseudo_bytes(16));
	$db['key'] = substr(base64_encode($bs), 0, 22);

	// escape inputs
	$db['content']['username'] = SQLite3::escapeString($inst['username']);
	$password = SQLite3::escapeString($inst['password']);

	// salt & encrypt user pass
	$bs = bin2hex(openssl_random_pseudo_bytes(16));
	$salt = substr(strtr(base64_encode($bs), '+', '.'), 0, 22);
	$db['content']['password'] = SQLite3::escapeString(crypt($password, '$2a$12$'.$salt));

	try {
		// create database
		$ldb = new SQLite3($db['file'], (SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE), $db['key']);

		// create config table
		$ok = $ldb->exec('CREATE TABLE config(
			username        TEXT,
			password        TEXT,
			enableIntercom  INT,
			version         TEXT,
			lastgoodapiaddr TEXT,
			useropt         TEXT
		);');
		if( !$ok )
			throw new Exception('Unable to create DB config table '.$ldb->lastErrorMsg());

		// create events table
		$ok = $ldb->exec('CREATE TABLE events(
			clid TEXT,
			type TEXT,
			time INTEGER
		);');
		if( !$ok )
			throw new Exception('Unable to create events table '.$ldb->lastErrorMsg());

		// create campaigns table
		$ok = $ldb->exec('CREATE TABLE campaigns(
			name TEXT,
			cv TEXT,
			maxrisk INT,
			info TEXT,
			fakeurl TEXT,
			realurl TEXT,
			dynvar TEXT,
			urlfilter TEXT,
			allowedcountries TEXT,
			allowedref TEXT,
			urlkeyword TEXT,
			active TEXT,
			traffic TEST,
			archived INT,
			device TEXT,
			rules TEXT,
			filters TEXT,
			schedule TEXT,
			pagelock TEXT,
			lptrack TEXT,
			dynautopt TEXT
		);');
		if( !$ok )
			throw new Exception('Unable to create campaigns table '.$ldb->lastErrorMsg());

		// insert config data
		$ok = $ldb->exec("INSERT INTO config VALUES(
			'".$db['content']['username']."',
			'".$db['content']['password']."',
			1,".
			"'".CLIENT_VERSION."',".
			"'',".
			"''
		);");
		if( !$ok )
			throw new Exception('Unable to write config table '.$ldb->lastErrorMsg());

		// set permissions
		chmod($db['file'], 0664);

	} catch (Exception $e) {
		$ldb->close();
		$error = 'Failed creating database: '.$e->getMessage();
		localApiResponse(json_encode(array('result'=>false, 'error'=>$error)), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	$ldb->close();

	/*** create config.php file ***/
	$cfgFile = "<?php \\n".
		"define('APIKEY','".$inst['apiKey']."');\\n".
		"define('APISECRET','".$inst['apiSecret']."');\\n".
		"define('DB_FILE','".$db['filename']."');\\n".
		"define('DB_KEY','".$db['key']."');\\n".
		"//DB_VER=".CLIENT_VERSION."\\n";
	if ( @file_put_contents('config.php', $cfgFile) === false ) {
		$error = 'Failed creating config.php file';
		localApiResponse(json_encode(array('result'=>false, 'error'=>$error)), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	/*** complete ***/
	localApiResponse(json_encode(array('result'=>true, 'error'=>array())));
	break;

default:
	$r = array('error' => 'unknown action');
	localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
	exit();
}
`;
