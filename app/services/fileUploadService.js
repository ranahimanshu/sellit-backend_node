const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const CONFIG = require('../../config');
const { AVAILABLE_EXTENSIONS_FOR_FILE_UPLOADS, SERVER, MESSAGES, ERROR_TYPES, FILES_WITH_CUSTOM_CONTENT_TYPES } = require('../utils/constants');
const { createErrorResponse } = require('../helpers/common/resHelper');
const { filesModel } = require('../models');
const { getYearMonthAggregation, convertIdToMongooseId } = require('../utils/utils');

const fileUploadService = {};
// AWS.config.update({ accessKeyId: CONFIG.s3Bucket.accessKeyId, secretAccessKey: CONFIG.s3Bucket.secretAccessKey });
const S3Bucket = new AWS.S3();

/**
 * function to upload a file to s3(AWS) bucket.
 */
fileUploadService.uploadFileToS3 = (payload, fileName, bucketName, fileExtention) => {
	return new Promise((resolve, reject) => {
		S3Bucket.upload(
			{
				Bucket: bucketName,
				Key: fileName,
				Body: payload.file.buffer,
				...( FILES_WITH_CUSTOM_CONTENT_TYPES[fileExtention] ? { ContentType: FILES_WITH_CUSTOM_CONTENT_TYPES[fileExtention] } : {})
			},
			function (err, data) {
				if (err) {
					console.error('Error here', err);
					return reject(err);
				}
				resolve(`${process.env.CLOUDFRONT_URL}/${data.Key}`);
			}
		);
	});
};

/**
 * function to upload file to local server.
 */
fileUploadService.uploadFileToLocal = async (payload, fileName, pathToUpload) => {
	console.log(pathToUpload, 'pathToUpload', __dirname);

	const directoryPath = pathToUpload ? pathToUpload : path.resolve(__dirname, '..', '..', CONFIG.PATH_TO_UPLOAD_SUBMISSIONS_ON_LOCAL, payload.user._id);
  
	// create user's directory if not present.
	if (!fs.existsSync(directoryPath)) {
		fs.mkdirSync(directoryPath, { recursive: true });
	}

	const fileSavePath = `${directoryPath}/${fileName}`;
	const writeStream = fs.createWriteStream(fileSavePath);
  
	return new Promise((resolve, reject) => {
		writeStream.write(payload.file.buffer);
		writeStream.on('error', function (err) {
			reject(err);
		});
		writeStream.end(async function (err) {
			if (err) {
				reject(err);
			} else {
				// pathToUpload ? `${CONFIG.SERVER_URL}${pathOnServer}/${fileName}` : `${CONFIG.SERVER_URL}${CONFIG.PATH_TO_UPLOAD_SUBMISSIONS_ON_LOCAL}/${payload.userid}/${fileName}`;
				const fileUrl = `${CONFIG.PATH_TO_UPLOAD_FILES_ON_LOCAL}/${fileName}`;
				resolve(fileUrl);
			}
		});
	});
};

/**
 * function to upload a file on either local server or on s3 bucket.
 */
fileUploadService.uploadFile = async (payload) => {
	const pathToUpload = path.resolve(__dirname + `../../..${CONFIG.PATH_TO_UPLOAD_FILES_ON_LOCAL}`),
		pathOnServer = CONFIG.PATH_TO_UPLOAD_FILES_ON_LOCAL;
	const fileExtention = payload.file.originalname.split('.').reverse()[0];
	if (AVAILABLE_EXTENSIONS_FOR_FILE_UPLOADS.indexOf(fileExtention.toLowerCase()) !== -SERVER.ONE) {
		const fileName = `upload_${Date.now()}.${fileExtention}`;
		let	fileUrl = '';
		const UPLOAD_TO_S3 = process.env.UPLOAD_TO_S3 ? process.env.UPLOAD_TO_S3 : '';
		if (UPLOAD_TO_S3.toLowerCase() === 'true') {
			const s3BucketName = CONFIG.s3Bucket.zipBucketName;
			fileUrl = await fileUploadService.uploadFileToS3(payload, fileName, s3BucketName, fileExtention);
		} else {
			fileUrl = await fileUploadService.uploadFileToLocal(payload, fileName, pathToUpload, pathOnServer);
		}
		return { fileUrl, fileName: payload.file.originalname };
	}
	throw createErrorResponse(MESSAGES.INVALID_FILE_TYPE, ERROR_TYPES.BAD_REQUEST);
};

/**
 * Function to fetch files from database.
 */
fileUploadService.getFiles = async (payload) => {
	let criteria = {  };
	if(payload.type){
		criteria.type = payload.type;
	}else{
		criteria = { ...criteria, type: { $exists: false } };
	}

	if (payload.startDate && payload.endDate)
		criteria.createdAt = { $gte: payload.startDate, $lte: payload.endDate.setHours(23, 59, 59, 999) };

	// Get all files filter by locationId or dates
	const files = await filesModel.find(criteria).sort({ createdAt: -1 });

	// Now, get the year and month array of the files
	const calenderData = await filesModel.aggregate(getYearMonthAggregation({ }));

	return { files, calender: calenderData };
};

/**
 * Function to get file by id.
 * @param {*} payload 
 */
fileUploadService.getFileById = async (payload) => {
	return filesModel.findById(convertIdToMongooseId(payload.fileId)).lean();
};

/**
 * Function to delete files from database and uploads folder.
 * @param {*} payload // Array of file ids
 */
fileUploadService.deleteFiles = async (payload) => {

	const pathToFiles = path.resolve(__dirname + `../../..${CONFIG.PATH_TO_UPLOAD_FILES_ON_LOCAL}`);

	const s3BucketName = CONFIG.s3Bucket.zipBucketName;
	for (let fileIdx = 0; fileIdx < payload.fileId.length; fileIdx++) {
		const file = await filesModel.findByIdAndDelete({ _id: convertIdToMongooseId(payload.fileId[fileIdx]) }).lean();

		if (file) {
			const UPLOAD_TO_S3 = process.env.UPLOAD_TO_S3 ? process.env.UPLOAD_TO_S3 : '';
			if (UPLOAD_TO_S3.toLowerCase() === 'true') {
				const fileName = file.fileURL.split('/').reverse()[0];
				// fs.unlinkSync(`${pathToFiles}/${file.fileURL.split('/').reverse()[0]}`);
				await deleteFileFromS3(fileName, s3BucketName);
			}else {
				fs.unlinkSync(`${pathToFiles}/${file.fileURL.split('/').reverse()[0]}`);
			}

		}
	}
};


async function deleteFileFromS3(fileName, bucketName) {
	return new Promise((resolve, reject) => {
		S3Bucket.deleteObject({
			Bucket: bucketName,
			Key: fileName
		}, function (err, data) {
			if (err) {
				console.log('S3 delete file error:', err);
				return reject(err);
			}
			resolve(data.Key);
		});
	});
};

/**
 * Function to add file in database
 * @param {*} payload
 */

fileUploadService.addFile = async (payload) => {
	return await filesModel({
		fileName: payload.file.originalname,
		fileURL: payload.fileUrl,
		title: payload.title,
		alt: payload.alt,
		...(payload.type ? { type: payload.type } : {}),
	}).save();
};

/**
 * Function to update file.
 * @param {*} criteria 
 * @param {*} dataToUpdate 
 * @param {*} options 
 * @returns 
 */
fileUploadService.updateFile = async (criteria, dataToUpdate, options = {}) => {
	return await filesModel.findOneAndUpdate(criteria, dataToUpdate, { new: true, projection: options }).lean();
};

/**
 * Find files based on the search query and projection query.
 *
 * @param {object} searchQuery - The search query to filter files.
 * @param {object} projectionQuery - The projection query to specify which fields to include or exclude.
 * @return {Promise<Array>} A promise that resolves to an array of file documents.
 */
fileUploadService.findFiles = async (searchQuery, projectionQuery) => {
	return filesModel.find(searchQuery, projectionQuery).lean();
};

module.exports = fileUploadService;
