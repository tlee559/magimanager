/**
 * Large NoIPFraud Cloaker Files
 *
 * These are the larger PHP files that are stored separately.
 */

import { NP_FILES } from "./np-files";

// campaigns.php - Campaign management
NP_FILES["np/api/campaigns.php"] = `<?php

require_once('auth.php');

$action = isset($_GET['a']) ? $_GET['a'] : 'list';
switch ($action) {
case 'list':
	// load campaigns form sqlite
	try {
		$ldb = getLocalDb();
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}
	$c = array();
	$res = $ldb->query('SELECT * FROM campaigns');
	while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
		if($row['name'] != 'default') {
			$row['active'] = intval($row['active']);
			$row['archived'] = intval($row['archived']);
			$row['realurl'] = unserialize($row['realurl']);
			$row['dynvar'] = unserialize($row['dynvar']);
			$row['schedule'] = unserialize($row['schedule']);
			$row['urlfilter'] = unserialize($row['urlfilter']);
			$row['pagelock'] = unserialize($row['pagelock']);
			$row['total'] = 0;
			$row['block'] = 0;
			$row['cv'] = 0;
			$row['traffic'] = '--';
			$row['bleedrate'] = 0;
			$c[$row['name']] = $row;
		}
	}
	$ldb->close();

	// no campaigns
	if (sizeof($c) == 0) {
		localApiResponse(json_encode(array()));
		exit();
	}

	// specified date (defaults to today)
	$from = isset($_GET['from']) ? $_GET['from'] : date('Y-m-d', time());
	$to = isset($_GET['to']) ? $_GET['to'] : date('Y-m-d', time());

	// get stats from api
	try {
		$apiData = json_decode(noipApiRq(array(
			'a' => 'stats',
			'from' => $from,
			'to' => $to
		)), true);
	} catch (Exception $e) {
		localApiResponse(json_encode(array_values($c)));
		exit();
	}

	// check success
	if (!$apiData || isset($apiData['error']) || !isset($apiData['data'])) {
		$r = array('error' => isset($apiData['error']) ? $apiData['error'] : 'unknown error');
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// merge sqlite results with api results
	foreach ($apiData['data'] as $d) {
		$clid = $d['clid'];
		if (isset($c[$clid])) {
			$c[$clid]['traffic'] = $d['ts'];
			$c[$clid]['block'] = $d['block'];
			$c[$clid]['total'] = $d['total'];
			$c[$clid]['cv'] = $d['cv'];
			if ($d['total'] > 0) {
				$c[$clid]['bleedrate'] = ($d['block'] / $d['total']) * 100;
			}
		}
	}

	// return data
	localApiResponse(json_encode(array_values($c)));

	break;

case 'changeStatus':
	// validate request
	if (!isset($_GET['clid']) || !isset($_GET['status']) ||
	  ($_GET['status'] != '-1' && $_GET['status'] != '0' && $_GET['status'] != '1' && $_GET['status'] != '2' && $_GET['status'] != '3')) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// load local db
	try {
		$ldb = getLocalDb();
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// multiple clids
	$clids = explode('|', $_GET['clid']);

	// update sqlite
	foreach ($clids as $clid) {
		// set status
		$ok = $ldb->exec("UPDATE campaigns SET
				active=".SQLite3::escapeString($_GET['status'])."
			WHERE name='".SQLite3::escapeString($clid)."'
		");
		// check success
		if (!$ok) {
			$ldb->close();
			$r = array('error' => $ldb->lastErrorMsg());
			localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
			exit();
		}

		// add event
		$ldb->exec("INSERT INTO events VALUES (
			'".SQLite3::escapeString($clid)."',
			'".getEventFromStatus($_GET['status'])."',".
			time()."
		);");

		// clear apc
		if (APCU_ENABLED) apcu_delete('noipfraud-'.$clid);
	}

	$ldb->close();

	// clear apc
	if (APCU_ENABLED) apcu_delete('noipfraud-'.$_GET['clid']);

	localApiResponse(''); // ok

	break;

case 'get':
	// validate request
	if (!isset($_GET['clid'])) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// load campaign from sqlite
	try {
		$ldb = getLocalDb();
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}
	$res = $ldb->querySingle('SELECT * FROM campaigns WHERE name=\\''.SQLite3::escapeString($_GET['clid']).'\\'', true);
	$lastError = $ldb->lastErrorMsg();
	$ldb->close();

	// check success
	if (!$res) {
		$r = array('error' => $lastError);
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// parse fields
	if (sizeof($res) > 0) {
		// force integers
		if($res['name'] != 'default') {
			$res['realurl'] = unserialize($res['realurl']);
			for ($i=0;$i<sizeof($res['realurl']);$i++) {
				$res['realurl'][$i]['perc'] = intval($res['realurl'][$i]['perc']);
			}
			$res['active'] = intval($res['active']);
			$res['archived'] = intval($res['archived']);
			$res['dynvar'] = unserialize($res['dynvar']);
			$res['urlfilter'] = unserialize($res['urlfilter']);
			$res['rules'] = unserialize($res['rules']);
			$res['filters'] = unserialize($res['filters']);
			$res['schedule'] = unserialize($res['schedule']);
			$res['pagelock'] = unserialize($res['pagelock']);
		}
	}

	// return result
	localApiResponse(json_encode($res));

	break;

case 'create':
	// validate request
	$body = file_get_contents('php://input');
	$camp = json_decode($body, true);
	if (!$camp || empty($camp)) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// load local db
	try {
		$ldb = getLocalDb();
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// parse fields
	$res = null;
	do {
		if (empty($camp['name']) || !is_null($res)) {
			$camp['name'] = substr(str_repeat(str_shuffle("0123456789abcdefghijklmnopqrstuvwxyz"),mt_rand(2,4)), 0, 8);
		}
		$res = $ldb->querySingle('SELECT * FROM campaigns WHERE name=\\''.SQLite3::escapeString($camp['name']).'\\'');
	} while(!is_null($res));

	$camp['realurl'] = serialize($camp['realurl']);
	$camp['dynvar'] = serialize($camp['dynvar']);
	$camp['urlfilter'] = serialize($camp['urlfilter']);
	$camp['rules'] = serialize($camp['rules']);
	$camp['filters'] = serialize($camp['filters']);
	$camp['schedule'] = serialize($camp['schedule']);
	$camp['pagelock'] = serialize($camp['pagelock']);

	// save to sqlite
	$ok = $ldb->exec("INSERT INTO campaigns (
		name,
		cv,
		info,
		fakeurl,
		realurl,
		dynvar,
		urlfilter,
		active,
		traffic,
		archived,
		rules,
		filters,
		schedule,
		urlkeyword,
		pagelock,
		lptrack,
		dynautopt
	)
	VALUES(".
		"'".SQLite3::escapeString($camp['name'])."',".
		"'".SQLite3::escapeString(CLIENT_VERSION)."',".
		"'".SQLite3::escapeString($camp['info'])."',".
		"'".SQLite3::escapeString($camp['fakeurl'])."',".
		"'".SQLite3::escapeString($camp['realurl'])."',".
		"'".SQLite3::escapeString($camp['dynvar'])."',".
		"'".SQLite3::escapeString($camp['urlfilter'])."',".
		SQLite3::escapeString($camp['active']).",".
		"'".SQLite3::escapeString($camp['traffic'])."',".
		"0,".
		"'".SQLite3::escapeString($camp['rules'])."',".
		"'".SQLite3::escapeString($camp['filters'])."',".
		"'".SQLite3::escapeString($camp['schedule'])."',".
		"'".SQLite3::escapeString($camp['urlkeyword'])."',".
		"'".SQLite3::escapeString($camp['pagelock'])."',".
		"'".SQLite3::escapeString($camp['lptrack'])."',".
		"'".SQLite3::escapeString($camp['dynautopt'])."'
	)");
	$lastError = $ldb->lastErrorMsg();

	// check success
	if (!$ok) {
		$ldb->close();
		$r = array('error' => $lastError);
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// add created event
	$t = time();
	$ldb->exec("INSERT INTO events VALUES (
		'".SQLite3::escapeString($camp['name'])."',
		'created',".
		$t."
	);");

	// add under-review event
	$ldb->exec("INSERT INTO events VALUES (
		'".SQLite3::escapeString($camp['name'])."',
		'under-review',".
		($t+1)."
	);");

	$ldb->close();

	// return saved clid
	localApiResponse('{"clid": "'.$camp['name'].'"}');

	break;

case 'update':
	// validate request
	$body = file_get_contents('php://input');
	$camp = json_decode($body, true);
	if (!$camp || empty($camp)) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// load local db
	try {
		$ldb = getLocalDb();
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// get campaign
	$res = $ldb->querySingle('SELECT * FROM campaigns WHERE name=\\''.SQLite3::escapeString($camp['name']).'\\'', true);
	$lastError = $ldb->lastErrorMsg();
	// check success
	if (!$res) {
		$r = array('error' => $lastError);
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}
	// store event if status changed
	if ($res['active'] != $camp['active']) {
		$ldb->exec("INSERT INTO events VALUES (
			'".SQLite3::escapeString($camp['name'])."',
			'".getEventFromStatus($camp['active'])."', ".
			time()."
		);");
	}

	// disable pagelock if no urls
	if ($camp['pagelock']['enabled'] == true) {
		$plok = false;
		foreach ($camp['realurl'] as $u) {
			if (substr($u['url'], 0, 4) == 'http') $plok = true;
		}
		if ($plok === false) $camp['pagelock']['enabled'] = false;
	}

	// parse fields
	$camp['realurl'] = serialize($camp['realurl']);
	$camp['dynvar'] = serialize($camp['dynvar']);
	$camp['urlfilter'] = serialize($camp['urlfilter']);
	$camp['rules'] = serialize($camp['rules']);
	$camp['filters'] = serialize($camp['filters']);
	$camp['schedule'] = serialize($camp['schedule']);
	$camp['pagelock'] = serialize($camp['pagelock']);

	// save to sqlite
	$ok = $ldb->exec("UPDATE campaigns SET
			cv='".SQLite3::escapeString(CLIENT_VERSION)."',
			info='".SQLite3::escapeString($camp['info'])."',
			fakeurl='".SQLite3::escapeString($camp['fakeurl'])."',
			realurl='".SQLite3::escapeString($camp['realurl'])."',
			dynvar='".SQLite3::escapeString($camp['dynvar'])."',
			urlfilter='".SQLite3::escapeString($camp['urlfilter'])."',
			active=".SQLite3::escapeString($camp['active']).",
			traffic='".SQLite3::escapeString($camp['traffic'])."',
			rules='".SQLite3::escapeString($camp['rules'])."',
			filters='".SQLite3::escapeString($camp['filters'])."',
			schedule='".SQLite3::escapeString($camp['schedule'])."',
			urlkeyword='".SQLite3::escapeString($camp['urlkeyword'])."',
			pagelock='".SQLite3::escapeString($camp['pagelock'])."',
			lptrack='".SQLite3::escapeString($camp['lptrack'])."',
			dynautopt='".SQLite3::escapeString($camp['dynautopt'])."'
		WHERE name='".SQLite3::escapeString($camp['name'])."'
	");
	$lastError = $ldb->lastErrorMsg();
	$ldb->close();

	// check success
	if (!$ok) {
		$r = array('error' => $lastError);
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// clear apc
	if (APCU_ENABLED) apcu_delete('noipfraud-'.$camp['name']);

	// return saved clid
	localApiResponse('');

	break;

case 'archive':
	// validate request
	if (!isset($_GET['clid'])) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// load local db
	try {
		$ldb = getLocalDb();
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// multiple clids
	$clids = explode('|', $_GET['clid']);

	// update sqlite
	foreach ($clids as $clid) {
		// perform update
		$ok = $ldb->exec("UPDATE campaigns SET
				archived=1, active=-1
			WHERE name='".SQLite3::escapeString($clid)."'
		");
		// check success
		if (!$ok) {
			$ldb->close();
			$r = array('error' => $ldb->lastErrorMsg());
			localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
			exit();
		}

		// add event
		$ldb->exec("INSERT INTO events VALUES (
			'".SQLite3::escapeString($clid)."',
			'archived', ".
			time()."
		);");

		// clear apc
		if (APCU_ENABLED) apcu_delete('noipfraud-'.$clid);
	}

	$ldb->close();

	// return result
	localApiResponse(''); // ok

	break;

case 'unarchive':
	// validate request
	if (!isset($_GET['clid'])) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// load local db
	try {
		$ldb = getLocalDb();
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// multiple clids
	$clids = explode('|', $_GET['clid']);

	// update sqlite
	foreach ($clids as $clid) {
		// unarchive
		$ok = $ldb->exec("UPDATE campaigns SET
				archived=0
			WHERE name='".SQLite3::escapeString($clid)."'
		");
		// check success
		if (!$ok) {
			$ldb->close();
			$r = array('error' => $ldb->lastErrorMsg());
			localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
			exit();
		}

		// add event
		$ldb->exec("INSERT INTO events VALUES (
			'".SQLite3::escapeString($clid)."',
			'unarchived', ".
			time()."
		);");

		// clear apc
		if (APCU_ENABLED) apcu_delete('noipfraud-'.$clid);
	}

	$ldb->close();

	// return result
	localApiResponse(''); // ok

	break;

default:
	$r = array('error' => 'unknown action');
	localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
	exit();
}
`;

// events.php
NP_FILES["np/api/events.php"] = `<?php

require_once('auth.php');

$action = isset($_GET['a']) ? $_GET['a'] : 'list';
switch ($action) {
case 'log':
	// get events from api
	try {
		$apiData = json_decode(noipApiRq(array(
			'a' => 'eventlog'
		)), true);
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// check success
	if (!$apiData || isset($apiData['error']) || !isset($apiData['data'])) {
		$r = array('error' => isset($apiData['error']) ? $apiData['error'] : 'unknown error');
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// return data
	localApiResponse(json_encode($apiData));

	break;

case 'list':
	// get events from api
	try {
		$apiData = json_decode(noipApiRq(array(
			'a' => 'listevents'
		)), true);
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// check success
	if (!$apiData || isset($apiData['error']) || !isset($apiData['data'])) {
		$r = array('error' => isset($apiData['error']) ? $apiData['error'] : 'unknown error');
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// return data
	localApiResponse(json_encode($apiData));

	break;

case 'create':
	// validate request
	$body = file_get_contents('php://input');
	$ev = json_decode($body, true);
	if (!$ev || empty($ev)) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// post to api
	try {
		$apiJson = noipApiRq(array(
			'a' => 'createevent'
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

	// return created id
	localApiResponse($apiJson);
	break;

case 'delete':
	// validate request
	if (!isset($_GET['id'])) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// delete to api
	try {
		$apiJson = noipApiRq(array(
			'a' => 'deleteevent',
			'id' => $_GET['id']
		));
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

	// return result
	localApiResponse(''); // ok

	break;

case 'update':
	// validate request
	$body = file_get_contents('php://input');
	$ev = json_decode($body, true);
	if (!$ev || empty($ev)) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// post to api
	try {
		$apiJson = noipApiRq(array(
			'a' => 'updateevent'
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

	// return created id
	localApiResponse($apiJson);
	break;

default:
	$r = array('error' => 'unknown action');
	localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
	exit();
}
`;

// filters.php
NP_FILES["np/api/filters.php"] = `<?php

require_once('auth.php');

$action = isset($_GET['a']) ? $_GET['a'] : 'list';
switch ($action) {
case 'list':
	// get filters from api
	try {
		$apiData = json_decode(noipApiRq(array(
			'a' => 'listFilters'
		)), true);
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// check success
	if (!$apiData || isset($apiData['error']) || !isset($apiData['data'])) {
		$r = array('error' => isset($apiData['error']) ? $apiData['error'] : 'unknown error');
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// return data
	localApiResponse(json_encode($apiData));

	break;

case 'create':
	// validate request
	$body = file_get_contents('php://input');
	$filter = json_decode($body, true);
	if (!$filter || empty($filter)) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// post to api
	try {
		$apiJson = noipApiRq(array(
			'a' => 'createFilter'
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

	// return created id
	localApiResponse($apiJson);
	break;

case 'delete':
	// validate request
	if (!isset($_GET['id'])) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// delete to api
	try {
		$apiJson = noipApiRq(array(
			'a' => 'deleteFilter',
			'id' => $_GET['id']
		));
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

	// return result
	localApiResponse(''); // ok

	break;

case 'update':
	// validate request
	$body = file_get_contents('php://input');
	$filter = json_decode($body, true);
	if (!$filter || empty($filter)) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// post to api
	try {
		$apiJson = noipApiRq(array(
			'a' => 'updateFilter'
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

	// return created id
	localApiResponse($apiJson);
	break;

default:
	$r = array('error' => 'unknown action');
	localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
	exit();
}
`;

// traffic.php
NP_FILES["np/api/traffic.php"] = `<?php

require_once('auth.php');

$action = isset($_GET['a']) ? $_GET['a'] : 'list';
switch ($action) {
case 'list':
	// get traffic sources from api
	try {
		$apiData = json_decode(noipApiRq(array(
			'a' => 'listTraffic'
		)), true);
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// check success
	if (!$apiData || isset($apiData['error']) || !isset($apiData['data'])) {
		$r = array('error' => isset($apiData['error']) ? $apiData['error'] : 'unknown error');
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// return data
	localApiResponse(json_encode($apiData));

	break;

case 'create':
	// validate request
	$body = file_get_contents('php://input');
	$ts = json_decode($body, true);
	if (!$ts || empty($ts)) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// post to api
	try {
		$apiJson = noipApiRq(array(
			'a' => 'createTraffic'
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

	// return created id
	localApiResponse($apiJson);
	break;

case 'delete':
	// validate request
	if (!isset($_GET['id'])) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// delete to api
	try {
		$apiJson = noipApiRq(array(
			'a' => 'deleteTraffic',
			'id' => $_GET['id']
		));
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

	// return result
	localApiResponse(''); // ok

	break;

case 'update':
	// validate request
	$body = file_get_contents('php://input');
	$ts = json_decode($body, true);
	if (!$ts || empty($ts)) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// post to api
	try {
		$apiJson = noipApiRq(array(
			'a' => 'updateTraffic'
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

	// return created id
	localApiResponse($apiJson);
	break;

default:
	$r = array('error' => 'unknown action');
	localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
	exit();
}
`;

// stats.php
NP_FILES["np/api/stats.php"] = `<?php

// set UTC
date_default_timezone_set('UTC');

require_once('auth.php');

$action = isset($_GET['a']) ? $_GET['a'] : 'load';
switch ($action) {
case 'daily':
	// validate request
	if (!isset($_GET['clid'])) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// set timeframe
	$from = isset($_GET['from']) ? $_GET['from'] : date('Y-m-d', time());
	$to = isset($_GET['to']) ? $_GET['to'] : date('Y-m-d', time());

	// request from api
	try {
		$curl_config[CURLOPT_TIMEOUT] = 30;
		$apiData = json_decode(noipApiRq(array(
			'a' => 'dailystats',
			'clid' => $_GET['clid'],
			'from' => $from,
			'to' => $to
		)), true);

	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// check success
	if (!$apiData || isset($apiData['error']) || !isset($apiData['data'])) {
		$r = array('error' => isset($apiData['error']) ? $apiData['error'] : 'unknown error');
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}

	// return result
	localApiResponse(json_encode($apiData));

	break;

case 'events':
	// validate request
	if (!isset($_GET['clid'])) {
		$r = array('error' => 'invalid request');
		localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
		exit();
	}

	// load events form sqlite
	try {
		$ldb = getLocalDb();
	} catch (Exception $e) {
		$r = array('error' => $e->getMessage());
		localApiResponse(json_encode($r), 'HTTP/1.0 500 Internal Server Error');
		exit();
	}
	$c = array();
	$res = $ldb->query('SELECT * FROM events WHERE clid=\\''.SQLite3::escapeString($_GET['clid']).'\\' ORDER BY time DESC');
	while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
		array_push($c, $row);
	}
	$ldb->close();

	// return result
	localApiResponse(json_encode($c));

	break;

default:
	$r = array('error' => 'unknown action');
	localApiResponse(json_encode($r), 'HTTP/1.0 400 Bad Request');
	exit();
}
`;
