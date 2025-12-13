/**
 * NoIPFraud Cloaker Files
 *
 * These files are embedded for inclusion in generated website ZIPs.
 * The np/ folder contains the cloaker system for traffic filtering.
 */

// File structure: path -> content
export const NP_FILES: Record<string, string> = {
  // Root files
  "np/index.php": `<?php
if (!file_exists('api/config.php')) {
	echo "It looks like you have not completed the install. Please check the install guide you were sent when you joined.";
	exit();
}
reset($_GET);
$clid = key($_GET);
$js = false;
if ((substr($clid, -3) == '_js') || (substr($clid, -3) == '.js')) {
	$clid = substr($clid, 0, -3);
	$js = true;
}
$_GET['clid'] = $clid;
include_once('api/go.php');
noIpFraud($js);
`,

  "np/go.php": `<?php
// for legacy campaigns
$pathAppend='api/';
include_once($pathAppend.'go.php');
`,

  "np/robots.txt": `User-agent: *
Disallow: /
`,

  // App folder
  "np/app/index.html": `<!DOCTYPE html>
<html lang="en" ng-app="client">
<head>
	<!-- stage test -->
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<title></title>
	<meta name="description" content="">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<!-- inject:css -->
	<link rel="stylesheet" href="//cdn2.noipfraud.com/app_1.8.css">
	<!-- endinject -->
</head>
<body ng-controller="InitCtrl" ng-cloak>

	<!--[if lt IE 8]>
		<p>You are using an <strong>outdated</strong> browser. Please <a href="//browsehappy.com/">upgrade your browser</a> to improve your experience.</p>
	<![endif]-->

	<div class="container-fluid">
		<div class="row vspace-20px">
			<div class="col-md-12">
				<div ng-if="criticalAlert" class="alert alert-danger text-center">{{criticalAlert}}</div>
				<div ui-view></div>
			</div>
		</div>
	</div>

	<footer ng-if="state.current.name!='login'" class="text-muted footer">&copy; <a ng-href="{{config.product.url}}" target="_BLANK">{{config.product.name}}</a> <strong>UTC</strong> {{getDate() | date: 'HH:mm' : 'UTC'}} (local {{getDate() | date: 'Z'}})</span></footer>

	<!-- native:js -->
	<!-- endinject -->
	<!-- inject:js -->
	<script src="//cdn2.noipfraud.com/app_1.8.js"></script>
	<!-- endinject -->
</body>
</html>
`,

  // CV folder
  "np/cv/index.php": `<?php

if (empty($_GET['subid'])) exit();

include('../api/constants.php');
include('../api/config.php');

$utc = time();
$sig = hash_hmac('sha256', $utc.APIKEY, APISECRET);
$auth2 = http_build_query(array(
	'auth'=>2,
	'key'=>APIKEY,
	'utc'=>$utc,
	'sig'=>$sig
));
$rq = '&'.http_build_query(array(
	'a'=>'conversion',
    'subid'=>$_GET['subid']
));

$url = 'http://'.API_DOMAIN.API_PATH.'api.php?'.$auth2.$rq;
$curl_config[CURLOPT_URL] = $url;
$ch = curl_init();
curl_setopt_array($ch, $curl_config);
curl_exec($ch);
curl_close($ch);
`,

  // API folder
  "np/api/index.html": `
`,

  "np/api/index.php": `<?php

header('HTTP/1.0 404 Not Found');
`,

  "np/api/constants.php": `<?php
define('CLIENT_VERSION','1.8.3');
define('API_DOMAIN','api.noipfraud.com');
define('DEFAULT_DEBUG',false);

define('API_VERSION','1.8');
define('API_PATH','/1.8/');

//constants
define('IP_REAL',0);
define('IP_SHARE',1);
define('IP_PROXY',2);

//variables
define('DEF_DYN_VARS','country,city,region,rnd,utc,devicetype,browser,platform,subid');

//memcached
define('APCU_ENABLED', extension_loaded('apcu') && function_exists('apcu_enabled') && apcu_enabled());
define('APC_EXPIRY', 1800); //number of seconds

//curl
$curl_config = Array(
	CURLOPT_HEADER=>0,
	CURLOPT_RETURNTRANSFER=>1,
	CURLOPT_CONNECTTIMEOUT=>2,
	CURLOPT_TIMEOUT=>10,
	CURLOPT_DNS_CACHE_TIMEOUT=>120, //seconds
	CURLOPT_FORBID_REUSE=>0,
	CURLOPT_FRESH_CONNECT=>0
);

//error reporting
define('DEBUG',isset($_GET['debug']) ? true : DEFAULT_DEBUG);
if (DEBUG) {
	ini_set('display_errors', 1);
	ini_set('display_startup_errors', 1);
	error_reporting(E_ALL);
} else {
	ini_set('display_errors', 0);
	ini_set('display_startup_errors', 0);
	error_reporting(E_ALL & ~E_NOTICE & ~E_STRICT & ~E_DEPRECATED);
}

//check for extra.php to define platform specific variable CUSTOM_INCL_PATH
//usage - create extra.php file with this content: <?php define('CUSTOM_INCL_PATH','/var/www/user/');
if (file_exists('extra.php')) {
	include('extra.php');
}
`,

  "np/api/common.php": `<?php
require_once('constants.php');
require_once('config.php');

function localApiResponse($json, $header = 'HTTP/1.1 200 OK', $contentType = "application/json") {
	if ($header !== NULL) {
		header($header);
	}
	header("Content-Type: $contentType");
	echo $json;
}

function getEventFromStatus($status) {
	$action = 'unknown';
	switch ($status) {
		case '-1':
			$action = 'paused';
			break;
		case '0':
			$action = 'under-review';
			break;
		case '1':
			$action = 'active';
			break;
		case '2':
			$action = 'allow-all';
			break;
		case '3':
			$action = 'scheduled';
			break;
	}
	return $action;
}

if (!function_exists('getLocalDb')) {
	function getLocalDb() {
		// get db path
		$dbpath = DB_FILE;
		if (strpos('/',DB_FILE) === false) {
			$dbpath = __DIR__.'/db/'.$dbpath;
		}

		// open db for read/write
		$ldb = new SQLite3($dbpath, SQLITE3_OPEN_READWRITE, DB_KEY);
		$ldb->busyTimeout(60000);
		return $ldb;
	}
}

function genToken($payload) {
	$payload = json_encode($payload);
	$sig = hash_hmac('sha256', $payload, APISECRET);
	return base64_encode($payload).'.'.base64_encode($sig);
}

function checkAuth($jwt) {
	@list($payload, $sig) = explode('.', $jwt);
	if (!$payload || !$sig) return false;

	$payload_json = base64_decode($payload);
	$payload = json_decode($payload_json,true);
	$sig = base64_decode($sig);
	if (!$payload || !$payload_json || !$sig) return false;

	if ($payload['role'] !== 'api') return false;
	if (time() > $payload['exp']) return false;

	$thisSig = hash_hmac('sha256', $payload_json, APISECRET);
	if ($sig !== $thisSig) return false;

	return $payload;
}

function noipApiRq($params, $post = NULL, $retry = false) {
	global $curl_config;

	// build url
	$utc = time();
	$auth = array(
		'auth' => 2,
		'key' => APIKEY,
		'utc' => $utc,
		'sig' => hash_hmac('sha256', $utc.APIKEY, APISECRET),
		'iid' => md5(DB_KEY)
	);
	$q = http_build_query(array_merge($auth, $params));
	$url = 'http://'.API_DOMAIN.API_PATH.'api.php?'.$q;

	// execute request
	$ch = curl_init();
	$curl_config[CURLOPT_URL] = $url;
	if ($post) {
		$curl_config[CURLOPT_POST] = 1;
		$curl_config[CURLOPT_POSTFIELDS] = $post;
	}
	curl_setopt_array($ch, $curl_config);
	$data = curl_exec($ch);
	$c_info = curl_getinfo($ch);
	$c_errno = curl_errno($ch);
	$c_err = curl_error($ch);
	curl_close($ch);

	// check success
	if ($c_errno !== 0) {
		if (!$retry) {
			return noipApiRq($params, $post, true); // retry
		} else {
			throw new Exception('Error communicating with API: ('.$c_errno.') '.$c_err);
		}
	}

	return $data;
}
`,

  "np/api/auth.php": `<?php
require_once('common.php');

function unauthorized() {
	header('HTTP/1.0 401 Unauthorized');
	exit();
}
function notFound() {
	header('HTTP/1.0 404 Not Found');
	exit();
}
if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
	$token = substr($_SERVER['HTTP_AUTHORIZATION'],7);
} elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
	$token = substr($_SERVER['REDIRECT_HTTP_AUTHORIZATION'],7);
} else {
	notFound();
}

if (!checkAuth($token)) unauthorized();
`,

  "np/api/login.php": `<?php

require_once('common.php');

$action = isset($_GET['a']) ? $_GET['a'] : 'auth';
switch ($action) {
case 'auth':
	// validate request
	$body = file_get_contents('php://input');
	$auth = json_decode($body, true);
	if (!$auth || empty($auth)) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// load local db
	try {
		$ldb = getLocalDb();
		$cfg = $ldb->querySingle('SELECT username, password FROM config', true);
		if( !$cfg || sizeof($cfg) == 0 ) { throw new Exception($ldb->lastErrorMsg()); }
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}
	$ldb->close();

	// validate auth
	if ( strtolower($auth['username']) !== strtolower($cfg['username']) ||
	(crypt($auth['password'], $cfg['password']) !== $cfg['password']) ) {
		localApiResponse('', 'HTTP/1.0 401 Authorization Required');
		sleep(2);
		exit();
	}

	$token = genToken(array('role' => 'api', 'username' => $auth['username'], 'exp' => strtotime('+3 hour')));
	localApiResponse(json_encode(array('token' => $token)));
	break;

default:
	$r = array('error' => 'unknown action');
	localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
	exit();
}
`,

  "np/api/support.php": `<?php

require_once('auth.php');

$action = isset($_GET['a']) ? $_GET['a'] : 'gen';
switch ($action) {
case 'gen':
	$tok = genToken(array('role' => 'support', 'api' => APIKEY, 'exp' => strtotime('+5 hour')));
	localApiResponse(json_encode(array('token'=>$tok)));
	break;

default:
	$r = array('error' => 'unknown action');
	localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
	exit();
}
`,

  "np/api/userconfig.php": `<?php

require_once('auth.php');

$action = isset($_GET['a']) ? $_GET['a'] : 'list';
switch ($action) {
case 'get':
	// load user config from sqlite
	try {
		$ldb = getLocalDb();
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}
	$res = $ldb->querySingle('SELECT enableIntercom FROM config', true);
	$lastError = $ldb->lastErrorMsg();
	$ldb->close();

	// check success
	if (!$res) {
		$r = array('error' => $lastError);
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// return result
	localApiResponse(json_encode($res));

	break;

case 'setKey':
	// validate request
	if (!isset($_GET['key']) || !isset($_GET['val'])) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// store user config to sqlite
	try {
		$ldb = getLocalDb();
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}
	// update status
	$ok = $ldb->exec("UPDATE config SET ".
		SQLite3::escapeString($_GET['key'])."='".SQLite3::escapeString($_GET['val'])."'"
	);
	$lastError = $ldb->lastErrorMsg();
	$ldb->close();

	// check success
	if (!$ok) {
		$r = array('error' => $lastError);
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// return result
	localApiResponse(''); // ok

	break;

default:
	$r = array('error' => 'unknown action');
	localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
	exit();
}
`,
};

// Large files stored separately to keep main export cleaner
// These are appended to NP_FILES at runtime

export const NP_API_PHP = `<?php

require_once('auth.php');

$action = isset($_GET['a']) ? $_GET['a'] : 'list';
switch ($action) {
case 'status':
	// get stats from api
	try {
		$ret = json_decode(noipApiRq(array(
			'a' => 'info'
		)), true);
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// return data
	localApiResponse(json_encode($ret));

	break;

case 'arbrq':
	// validate request
	$body = file_get_contents('php://input');
	if (!isset($_GET['r'])) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// post to api
	try {
		$apiJson = noipApiRq(array(
			'a' => $r
		), $body);
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// check success
	$apiData = json_decode($apiJson, true);
	if (isset($apiData['error'])) {
		localApiResponse($apiJson, 'HTTP/1.0 500 Internal Server Error');
		return;
	}

	// return response
	localApiResponse($apiJson);
	break;

case 'updatejs':

	try {
		$apiJson = noipApiRq(array(
			'a' => 'updatejs'
		));
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// check success
	$apiData = json_decode($apiJson, true);
	if (isset($apiData['error']) || !isset($apiData['data'])) {
		localApiResponse($apiJson, 'HTTP/1.0 500 Internal Server Error');
		return;
	}

	// save file
	$r = file_put_contents('c.js', $apiData['data']);
	if ($r === false) {
		localApiResponse(json_encode(array('error' => 'failed to save file')), 'HTTP/1.0 500 Internal Server Error');
		return;
	}

	// return response
	localApiResponse(''); // ok
	break;


default:
	$r = array('error' => 'unknown action');
	localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
	exit();
}
`;

// Add large files to NP_FILES
NP_FILES["np/api/api.php"] = NP_API_PHP;
