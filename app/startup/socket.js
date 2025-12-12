/* eslint-disable no-console */
/** -- import all modules */
const { authService } = require('../services');
const { MESSAGES, SOCKET_EVENTS } = require('../utils/constants');

const socketConnection = {};

socketConnection.connect = (io) => {
	io.use(authService.socketAuthentication);
	io.on('connection', async (socket) => {
		console.log('connection established: ', socket.id);

		socket.use(async (packet, next) => {
			console.log('Socket hit:=>', packet);
			try {
				// await routeUtils.route(packet)
				next();
			} catch (error) {
				packet[2]({ success: false, message: error.message });
			}
		});

		socket.on(SOCKET_EVENTS.TEST, (payload, callback) => {
			callback({ success: true, message: MESSAGES.SOCKET.SOCKET_IS_RUNNING_FINE });
		});

		socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
			console.log('Disconnected socket id: ', socket.id);
		});
	});
};

module.exports = socketConnection;
