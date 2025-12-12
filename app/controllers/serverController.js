'use strict';

const { createSuccessResponse } = require('../helpers');
const { MESSAGES } = require('../utils/constants');
const { generateRandomNumber } = require('../utils/utils');

/** ************************************************
 ***************** User Controller ***************
 ************************************************* */
const serverController = {};

/**
 * function to get server response.
 * @returns
 */
serverController.checkServerStatus = async () => createSuccessResponse(MESSAGES.SERVER_IS_WORKING_FINE);

/**
 * Asynchronously generates a random number and returns a success response with the message "SERVER_IS_WORKING_FINE" and the generated number.
 *
 * @return {Promise<Object>} A success response object with the message "SERVER_IS_WORKING_FINE" and the generated number.
 */
serverController.generateNumber = async () => {
	const number = await generateRandomNumber();
	return createSuccessResponse(MESSAGES.SERVER_IS_WORKING_FINE, number);
};

/**
 * Verifies a number using the provided payload.
 *
 * @param {Object} payload - The payload containing the hash and timestamp.
 * @param {string} payload.hash - The hash used to generate the random number.
 * @param {string} payload.timestamp - The timestamp used to generate the random number.
 * @return {Promise<Object>} A success response object with the message "SERVER_IS_WORKING_FINE" and the generated number.
 */
serverController.verifyNumber = async (payload) => {
	const number = await generateRandomNumber(100, payload.hash, payload.timestamp);
	return createSuccessResponse(MESSAGES.SERVER_IS_WORKING_FINE, number);
};

module.exports = serverController;
