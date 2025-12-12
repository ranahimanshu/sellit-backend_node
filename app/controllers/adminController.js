'use strict';

const MESSAGES = require('../utils/messages');
const { createErrorResponse, createSuccessResponse } = require('../helpers/common/resHelper');
const SERVICES = require('../services');
const MODELS = require('../models');
const { compareHash, encryptJwt, convertIdToMongooseId, hashPassword } = require('../utils/utils');
const CONSTANTS = require('../utils/constants');


/**************************************************
 ***** Auth controller for authentication logic ***
 **************************************************/
const adminController = {};

/**
 * Function to login admin
 * @param {*} payload 
 */
adminController.loginAdmin = async (payload) => {
	const account = await SERVICES.dbService.findOne( MODELS.adminModel, { email: payload.email });
	if (!account) {
		throw createErrorResponse(MESSAGES.EMAIL_NOT_EXIST, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	const passwordMatched = await compareHash(payload.password, account.password);
	if (!passwordMatched) {
		throw createErrorResponse(MESSAGES.PASSWORD_MISMATCHED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	const token = encryptJwt({ _id: account._id, date: Date.now(), admin: true }, { expiresIn: '7d' });
	return { ...createSuccessResponse(MESSAGES.LOGGED_IN_SUCCESSFULLY), token: token, data: account };
};

/**
 * Function to change admin password.
 * @param {*} payload 
 */
adminController.changePassword = async (payload) => {
	const account = await SERVICES.dbService.findOne( MODELS.adminModel, { email: payload.user.email });
	if (!account) {
		throw createErrorResponse(MESSAGES.EMAIL_NOT_EXIST, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	const passwordMatched = await compareHash(payload.currentPassword, account.password);
	if (!passwordMatched) {
		throw createErrorResponse(MESSAGES.CURRENT_PASSWORD_MISMATCHED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	await SERVICES.dbService.findOneAndUpdate(MODELS.adminModel, { _id: convertIdToMongooseId(payload.user._id) }, { password: hashPassword(payload.newPassword) }, CONSTANTS.NORMAL_PROJECTION);
	return createSuccessResponse(MESSAGES.PROFILE_UPDATE_SUCCESSFULLY);
};

/* export controller */
module.exports = adminController;