'use strict';

const { Joi } = require('../../utils/joiUtils');
const CONSTANTS = require('../../utils/constants');

//load controllers
const { userController } = require('../../controllers');

const routes = [
	{
		method: 'POST',
		path: '/v1/user/createTradingWallet',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Your\'s JWT token.'),
			},
			body: {
				chain: Joi.number().valid(...Object.values(CONSTANTS.CHAINS)).required().description('Chain type')
			},
			group: 'USER',
			description: 'Route to create a cusotodial wallet .',
			model: 'CreateTradingWallet'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.USER,
		handler: userController.createTradingWallet
	},
	{
		method: 'PUT',
		path: '/v1/user/saveReferral',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('User\'s JWT token.'),
			},
			body: {
				referralCode: Joi.string().required().description('Referral code'),
			},
			group: 'USER',
			description: 'Route to save a user\'s referral code.',
			model: 'SaveReferral'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.USER,
		handler: userController.saveReferral
	},
	{
		method: 'GET',
		path: '/v1/user/referralStats',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('User\'s JWT token.'),
			},
			group: 'USER',
			description: 'Route to save a user\'s referral code.',
			model: 'FetchReferralStats'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.USER,
		handler: userController.fetchReferralStats
	},
	{
		method: 'POST',
		path: '/v1/user/auth',
		joiSchemaForSwagger: {
			body: {
				chain: Joi.number().valid(...Object.values(CONSTANTS.CHAINS)).required().description('Chain type'),
				walletAddress: Joi.string().optional().description('Wallet address'),
				referralCode: Joi.string().optional().description('Referral code'),
			},
			group: 'USER',
			description: 'Route for user auth.',
			model: 'UserAuth'
		},
		handler: userController.userAuth
	},
	{
		method: 'POST',
		path: '/v1/user/register',
		joiSchemaForSwagger: {
			body: {
				email: Joi.string().isValidEmail().required().description('User email address'),
				mobileNumber: Joi.string().optional().description('User mobile number'),
				username: Joi.string().required().description('Username'),
				password: Joi.string().min(6).required().description('User password'),
			},
			group: 'USER',
			description: 'Route to register a new user.',
			model: 'RegisterUser'
		},
		handler: userController.registerUser
	},
	{
		method: 'POST',
		path: '/v1/user/login',
		joiSchemaForSwagger: {
			body: {
				email: Joi.string().optional().description('User email address or username (use this field for both email and username)'),
				password: Joi.string().required().description('User password'),
			},
			group: 'USER',
			description: 'Route for user login. Use email field for both email and username.',
			model: 'LoginUser'
		},
		handler: userController.loginUser
	},
	{
		method: 'POST',
		path: '/v1/user/verify-email',
		joiSchemaForSwagger: {
			body: {
				email: Joi.string().isValidEmail().required().description('User email address'),
				otp: Joi.string().required().description('Email verification OTP'),
			},
			group: 'USER',
			description: 'Route to verify user email with OTP.',
			model: 'VerifyEmail'
		},
		handler: userController.verifyEmail
	},
	{
		method: 'POST',
		path: '/v1/user/resend-otp',
		joiSchemaForSwagger: {
			body: {
				email: Joi.string().isValidEmail().required().description('User email address'),
			},
			group: 'USER',
			description: 'Route to resend email verification OTP to user.',
			model: 'ResendOTP'
		},
		handler: userController.resendOTP
	},
	{
		method: 'POST',
		path: '/v1/user/forgot-password',
		joiSchemaForSwagger: {
			body: {
				email: Joi.string().isValidEmail().required().description('User email address'),
			},
			group: 'USER',
			description: 'Route to request password reset. Sends reset password link to user email.',
			model: 'ForgotPassword'
		},
		handler: userController.forgotPassword
	},
	{
		method: 'POST',
		path: '/v1/user/reset-password',
		joiSchemaForSwagger: {
			body: {
				token: Joi.string().required().description('Reset password token from email link'),
				password: Joi.string().min(6).required().description('New password (minimum 6 characters)'),
			},
			group: 'USER',
			description: 'Route to reset user password using token from email.',
			model: 'ResetPassword'
		},
		handler: userController.resetPassword
	},
];

module.exports = routes;