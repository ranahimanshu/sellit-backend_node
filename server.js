/* eslint-disable no-console */

'use strict';

/** *********************************
**** node module defined here *****
********************************** */
require('dotenv').config();
const http = require('http');
const process = require('process');
const EXPRESS = require('express');
const { SERVER } = require('./config');

/** creating express server app for server. */
const app = EXPRESS();

/** ******************************
***** Server Configuration *****
******************************* */
const server = http.Server(app);
global.io = require('socket.io')(server, {
	cors: {
		origin: '*',
		methods: [ 'GET', 'POST' ],
	},
});

/** Server is running here */
const startNodeserver = async () => {
	const isSwaggerWrite = true;
	// initialize mongo
	await require('./app/startup/db_mongo')();

	// initializing redis
	// await require('./app/startup/db_redis')(); //* not using right now

	await require('./app/startup/socket').connect(global.io);

	// await require('./app/startup/web3Socket')();

	await require('./app/startup/expressStartup')(app, isSwaggerWrite); // express startup.
	return new Promise((resolve, reject) => {
		server.listen(SERVER.PORT, "0.0.0.0", (err) => {
			if (err) reject(err);
			resolve();
		});
	});
};

startNodeserver().then(() => {
	console.log('Node server running on', SERVER.URL);
}).catch((err) => {
	console.log('Error in starting server', err);
	process.exit(1);
});
