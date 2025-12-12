'use strict';

const { Joi } = require('../../utils/joiUtils');
const CONSTANTS = require('../../utils/constants');

//load controllers
const { adminController } = require('../../controllers');

const routes = [
	{
		method: 'POST',
		path: '/v1/admin/login',
		joiSchemaForSwagger: {
			body: {
				email: Joi.string().email().required().description('ADMIN\'s email.'),
				password: Joi.string().required().description('ADMIN\'s password.')
			},
			group: 'ADMIN',
			description: 'Route to login as admin.',
			model: 'ADMINLogin'
		},
		handler: adminController.loginAdmin
	},
	{
		method: 'PUT',
		path: '/v1/admin/changePassword',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Your\'s JWT token.'),
			},
			body: {
				currentPassword: Joi.string().optional().description('Current Password.'),
				newPassword: Joi.string().optional().description('New Password.')
			},
			group: 'ADMIN',
			description: 'Route to change admin password.',
			model: 'ChangePassword',
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.ADMIN,
		handler: adminController.changePassword,
	}
];

module.exports = routes;