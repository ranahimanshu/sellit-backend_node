/* eslint-disable no-undef */

'use strict';

const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { REDIS } = require('../../config');

global.pubClient = createClient({ url: `${REDIS.URL}` });
global.subClient = pubClient.duplicate();

module.exports = async () => {
	await pubClient.connect();
	await subClient.connect();

	await global.io.adapter(createAdapter(pubClient, subClient));
};
