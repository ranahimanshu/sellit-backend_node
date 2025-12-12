'use strict';

const { createErrorResponse, createSuccessResponse } = require('../helpers/common/resHelper');
const { MESSAGES, ERROR_TYPES, NORMAL_PROJECTION } = require('../utils/constants');
const fileUploadService = require('../services/fileUploadService');
const { convertIdToMongooseId } = require('../utils/utils');

/**************************************************
    *********** File controller ************
 **************************************************/
const fileController = {};

/**
 * Function to fetch files.
 * @param {*} payload
 */
fileController.getFiles = async (payload) => {
	const data = await fileUploadService.getFiles(payload);
	return Object.assign(createSuccessResponse(MESSAGES.FILE_FETCHED_SUCCESSFULLY), data);
};

/**
 * Function to fetch file by id.
 * @param {*} payload
 */
fileController.getFileById = async (payload) => {
	const data = await fileUploadService.getFileById(payload);
	return Object.assign(createSuccessResponse(MESSAGES.FILE_FETCHED_SUCCESSFULLY), { data });
};

/**
 * Function to delete files.
 * @param {*} payload
 */
fileController.deleteFiles = async (payload) => {
	if (!Object.keys(payload.fileId).length) {
		throw createErrorResponse(MESSAGES.FILE_IS_REQUIRED, ERROR_TYPES.BAD_REQUEST);
	}
	const files = await fileUploadService.deleteFiles(payload);
	return Object.assign(createSuccessResponse(MESSAGES.FILE_DELETED_SUCCESSFULLY), files);
};

/**
 * Function to save file 
 */
fileController.saveFile = async (payload) => {
	// check whether the request contains valid payload.
	if (!Object.keys(payload.file).length) {
		throw createErrorResponse(MESSAGES.FILE_REQUIRED_IN_PAYLOAD, ERROR_TYPES.BAD_REQUEST);
	}

	const fileObj = await fileUploadService.uploadFile(payload);
	payload.fileUrl = fileObj.fileUrl;
	await fileUploadService.addFile(payload);
	return Object.assign(createSuccessResponse(MESSAGES.FILE_UPLOADED_SUCCESSFULLY), fileObj);
};

/**
 * Function ot update file.
 * @param {*} payload 
 */
fileController.updateFile = async (payload) => {
	const updatedFile = await fileUploadService.updateFile({ _id: convertIdToMongooseId(payload.fileId) }, payload, NORMAL_PROJECTION);
	return Object.assign(createSuccessResponse(MESSAGES.FILE_UPDATED_SUCCESSFULLY), { data: updatedFile });
};

/* export fileController */
module.exports = fileController;
