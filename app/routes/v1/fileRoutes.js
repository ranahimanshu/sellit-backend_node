'use strict';

const { Joi } = require('../../utils/joiUtils');
//load controllers
const { fileController } = require('../../controllers');

const routes = [
	{
		method: 'POST',
		path: '/v1/file/upload',
		joiSchemaForSwagger: {
			/** Route format to use for files upload */
			headers: {
				authorization: Joi.string().required().description('Your\'s JWT token.'),
			},
			formData: {
				file: Joi.file({ name: 'image', description: 'Single image file' }), // req.file -> File {fieldName: image}
				body: {
					title: Joi.string().optional().description('Title.'),
					alt: Joi.string().optional().description('Alt.'),
				},
			},
			group: 'File',
			description: 'Route to upload files in multiple formats',
			model: 'UploadFiles',
		},
		auth: 'admin',
		handler: fileController.saveFile,
	},
	{
		method: 'PUT',
		path: '/v1/file/update/:fileId',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Your\'s JWT token.'),
			},
			params: {
				fileId: Joi.string().objectId().required().description('File Id')
			},
			body: {
				title: Joi.string().optional().description('Title.'),
				alt: Joi.string().optional().description('Alt.'),
			},
			group: 'File',
			description: 'Route to update file.',
			model: 'UpdateFile',
		},
		auth: 'admin',
		handler: fileController.updateFile,
	},
	{
		method: 'GET',
		path: '/v1/file/getFiles',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Your\'s JWT token.'),
			},
			query: {
				startDate: Joi.date().optional().description('Start Date').label('StartDate'),
				endDate: Joi.date().optional().description('End Date').label('EndDate'),
			},
			group: 'File',
			description: 'Route to get files',
			model: 'GetFiles',
		},
		auth: 'admin',
		handler: fileController.getFiles,
	},
	{
		method: 'GET',
		path: '/v1/file/getFile/:fileId',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Your\'s JWT token.'),
			},
			params: {
				fileId: Joi.string().objectId().required().description('File Id')
			},
			group: 'File',
			description: 'Route to get file by id',
			model: 'GetFileById',
		},
		auth: 'admin',
		handler: fileController.getFileById,
	},
	{
		method: 'DELETE',
		path: '/v1/file/deleteFiles',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Your\'s JWT token.'),
			},
			body: {
				fileId: Joi.array()
					.items(
						Joi.string().required()
					)
					.required(),
			},
			group: 'File',
			description: 'Route to delete files',
			model: 'DeleteFiles',
		},
		auth: 'admin',
		handler: fileController.deleteFiles,
	}
];

module.exports = routes;
