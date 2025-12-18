'use strict';

const { Joi } = require('../../utils/joiUtils');
const CONSTANTS = require('../../utils/constants');

//load controllers
const { adController } = require('../../controllers');

const routes = [
	// User routes (authenticated)
	{
		method: 'POST',
		path: '/v1/ad',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('User\'s JWT token.'),
			},
			body: {
				categoryId: Joi.string().objectId().required().description('Category ID'),
				title: Joi.string().required().description('Ad title'),
				description: Joi.string().optional().description('Ad description'),
				price: Joi.number().required().description('Price'),
				transactionType: Joi.number().valid(...Object.values(CONSTANTS.TRANSACTION_TYPES)).required().description('Transaction type: 1=Sell, 2=Buy, 3=Given Away'),
				images: Joi.array().items(Joi.string()).optional().description('Array of image URLs'),
				zipCode: Joi.string().optional().description('ZIP code'),
				city: Joi.string().optional().description('City'),
				state: Joi.string().optional().description('State'),
				country: Joi.string().optional().description('Country'),
				coordinates: Joi.object({
					latitude: Joi.number().optional(),
					longitude: Joi.number().optional()
				}).optional().description('Location coordinates'),
				showProfile: Joi.boolean().optional().description('Show profile picture and link'),
				phone: Joi.string().optional().description('Phone number'),
				email: Joi.string().optional().description('Email'),
				tags: Joi.array().items(Joi.string()).optional().description('Tags for search'),
				expiresAt: Joi.date().optional().description('Expiration date'),
			},
			group: 'AD',
			description: 'Route to create a new ad.',
			model: 'CreateAd'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.USER,
		handler: adController.createAd
	},
	{
		method: 'GET',
		path: '/v1/ad',
		joiSchemaForSwagger: {
			query: {
				categoryId: Joi.string().objectId().optional().description('Filter by category ID'),
				userId: Joi.string().objectId().optional().description('Filter by user ID'),
				transactionType: Joi.number().valid(...Object.values(CONSTANTS.TRANSACTION_TYPES)).optional().description('Filter by transaction type'),
				minPrice: Joi.number().optional().description('Minimum price'),
				maxPrice: Joi.number().optional().description('Maximum price'),
				zipCode: Joi.string().optional().description('Filter by ZIP code'),
				city: Joi.string().optional().description('Filter by city'),
				featured: Joi.boolean().optional().description('Filter by featured status'),
				search: Joi.string().optional().description('Search by title, description, or tags'),
				sortBy: Joi.string().valid('price_asc', 'price_desc', 'newest', 'oldest', 'featured').optional().description('Sort order'),
				skip: Joi.number().integer().min(0).optional().description('Number of records to skip'),
				limit: Joi.number().integer().min(1).optional().description('Number of records to return'),
			},
			group: 'AD',
			description: 'Route to get all ads with filters, pagination, and search (public).',
			model: 'GetAds'
		},
		handler: adController.getAds
	},
	{
		method: 'GET',
		path: '/v1/ad/my-ads',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('User\'s JWT token.'),
			},
			query: {
				skip: Joi.number().integer().min(0).optional().description('Number of records to skip'),
				limit: Joi.number().integer().min(1).optional().description('Number of records to return'),
			},
			group: 'AD',
			description: 'Route to get user\'s own ads.',
			model: 'GetMyAds'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.USER,
		handler: adController.getMyAds
	},
	{
		method: 'GET',
		path: '/v1/ad/:adId',
		joiSchemaForSwagger: {
			params: {
				adId: Joi.string().objectId().required().description('Ad ID')
			},
			group: 'AD',
			description: 'Route to get ad by ID (public).',
			model: 'GetAdById'
		},
		handler: adController.getAdById
	},
	{
		method: 'PUT',
		path: '/v1/ad/:adId',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('User\'s JWT token.'),
			},
			params: {
				adId: Joi.string().objectId().required().description('Ad ID')
			},
			body: {
				categoryId: Joi.string().objectId().optional().description('Category ID'),
				title: Joi.string().optional().description('Ad title'),
				description: Joi.string().optional().description('Ad description'),
				price: Joi.number().optional().description('Price'),
				transactionType: Joi.number().valid(...Object.values(CONSTANTS.TRANSACTION_TYPES)).optional().description('Transaction type: 1=Sell, 2=Buy, 3=Given Away'),
				images: Joi.array().items(Joi.string()).optional().description('Array of image URLs'),
				zipCode: Joi.string().optional().description('ZIP code'),
				city: Joi.string().optional().description('City'),
				state: Joi.string().optional().description('State'),
				country: Joi.string().optional().description('Country'),
				coordinates: Joi.object({
					latitude: Joi.number().optional(),
					longitude: Joi.number().optional()
				}).optional().description('Location coordinates'),
				showProfile: Joi.boolean().optional().description('Show profile picture and link'),
				phone: Joi.string().optional().description('Phone number'),
				email: Joi.string().optional().description('Email'),
				tags: Joi.array().items(Joi.string()).optional().description('Tags'),
				expiresAt: Joi.date().optional().description('Expiration date'),
			},
			group: 'AD',
			description: 'Route to update ad. User can only update their own ads.',
			model: 'UpdateAd'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.USER,
		handler: adController.updateAd
	},
	{
		method: 'DELETE',
		path: '/v1/ad/:adId',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('User\'s JWT token.'),
			},
			params: {
				adId: Joi.string().objectId().required().description('Ad ID')
			},
			group: 'AD',
			description: 'Route to delete ad. User can only delete their own ads.',
			model: 'DeleteAd'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.USER,
		handler: adController.deleteAd
	},
	// Admin routes
	{
		method: 'GET',
		path: '/v1/admin/ad',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Admin\'s JWT token.'),
			},
			query: {
				categoryId: Joi.string().objectId().optional().description('Filter by category ID'),
				userId: Joi.string().objectId().optional().description('Filter by user ID'),
				status: Joi.number().valid(...Object.values(CONSTANTS.AD_STATUS)).optional().description('Filter by status'),
				transactionType: Joi.number().valid(...Object.values(CONSTANTS.TRANSACTION_TYPES)).optional().description('Filter by transaction type'),
				search: Joi.string().optional().description('Search by title, description, or tags'),
				skip: Joi.number().integer().min(0).optional().description('Number of records to skip'),
				limit: Joi.number().integer().min(1).optional().description('Number of records to return'),
			},
			group: 'AD',
			description: 'Route to get all ads with admin filters. Admin only.',
			model: 'GetAdsAdmin'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.ADMIN,
		handler: adController.getAds
	},
	{
		method: 'POST',
		path: '/v1/admin/ad/:adId/approve',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Admin\'s JWT token.'),
			},
			params: {
				adId: Joi.string().objectId().required().description('Ad ID')
			},
			group: 'AD',
			description: 'Route to approve an ad. Admin only.',
			model: 'ApproveAd'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.ADMIN,
		handler: adController.approveAd
	},
	{
		method: 'POST',
		path: '/v1/admin/ad/:adId/reject',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Admin\'s JWT token.'),
			},
			params: {
				adId: Joi.string().objectId().required().description('Ad ID')
			},
			body: {
				rejectionReason: Joi.string().optional().description('Reason for rejection'),
			},
			group: 'AD',
			description: 'Route to reject an ad. Admin only.',
			model: 'RejectAd'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.ADMIN,
		handler: adController.rejectAd
	},
	// Content moderation routes (for content moderation system/API)
	{
		method: 'POST',
		path: '/v1/content-moderation/ad/:adId/approve',
		joiSchemaForSwagger: {
			params: {
				adId: Joi.string().objectId().required().description('Ad ID')
			},
			group: 'AD',
			description: 'Route to approve ad content moderation. After approval, ad goes to PENDING status (waiting for admin approval). Used by content moderation system.',
			model: 'ApproveContentModeration'
		},
		handler: adController.approveContentModeration
	},
	{
		method: 'POST',
		path: '/v1/content-moderation/ad/:adId/reject',
		joiSchemaForSwagger: {
			params: {
				adId: Joi.string().objectId().required().description('Ad ID')
			},
			body: {
				rejectionReason: Joi.string().optional().description('Reason for rejection'),
			},
			group: 'AD',
			description: 'Route to reject ad content moderation. After rejection, ad goes to PENDING status (admin can review and approve). Used by content moderation system.',
			model: 'RejectContentModeration'
		},
		handler: adController.rejectContentModeration
	},
];

module.exports = routes;

