'use strict';

const { Joi } = require('../../utils/joiUtils');
const CONSTANTS = require('../../utils/constants');

//load controllers
const { categoryController } = require('../../controllers');

const routes = [
	{
		method: 'POST',
		path: '/v1/category',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Admin\'s JWT token.'),
			},
			body: {
				name: Joi.string().required().description('Category name'),
				icon: Joi.string().optional().description('Icon URL or path'),
				description: Joi.string().optional().description('Category description'),
				slug: Joi.string().optional().description('URL-friendly slug (auto-generated if not provided)'),
				parentCategory: Joi.string().objectId().optional().description('Parent category ID for subcategories'),
				order: Joi.number().optional().description('Display order (default: 0)'),
				isActive: Joi.boolean().optional().description('Whether category is active (default: true)'),
			},
			group: 'CATEGORY',
			description: 'Route to create a new category. Admin only.',
			model: 'CreateCategory'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.ADMIN,
		handler: categoryController.createCategory
	},
	{
		method: 'GET',
		path: '/v1/category',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Admin\'s JWT token.'),
			},
			query: {
				parentCategory: Joi.string().objectId().optional().description('Filter by parent category ID (null for top-level)'),
				isActive: Joi.boolean().optional().description('Filter by active status'),
				search: Joi.string().optional().description('Search by name, description, or slug'),
				skip: Joi.number().integer().min(0).optional().description('Number of records to skip (for pagination)'),
				limit: Joi.number().integer().min(1).optional().description('Number of records to return (for pagination)'),
			},
			group: 'CATEGORY',
			description: 'Route to get all categories with optional filters, pagination, and search. Admin only.',
			model: 'GetCategories'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.ADMIN,
		handler: categoryController.getCategories
	},
	{
		method: 'GET',
		path: '/v1/category/:categoryId',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Admin\'s JWT token.'),
			},
			params: {
				categoryId: Joi.string().objectId().required().description('Category ID')
			},
			group: 'CATEGORY',
			description: 'Route to get category by ID. Admin only.',
			model: 'GetCategoryById'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.ADMIN,
		handler: categoryController.getCategoryById
	},
	{
		method: 'PUT',
		path: '/v1/category/:categoryId',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Admin\'s JWT token.'),
			},
			params: {
				categoryId: Joi.string().objectId().required().description('Category ID')
			},
			body: {
				name: Joi.string().optional().description('Category name'),
				icon: Joi.string().optional().description('Icon URL or path'),
				description: Joi.string().optional().description('Category description'),
				slug: Joi.string().optional().description('URL-friendly slug'),
				parentCategory: Joi.string().objectId().optional().allow(null).description('Parent category ID (null for top-level)'),
				order: Joi.number().optional().description('Display order'),
				isActive: Joi.boolean().optional().description('Whether category is active'),
			},
			group: 'CATEGORY',
			description: 'Route to update category. Admin only.',
			model: 'UpdateCategory'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.ADMIN,
		handler: categoryController.updateCategory
	},
	{
		method: 'DELETE',
		path: '/v1/category/:categoryId',
		joiSchemaForSwagger: {
			headers: {
				authorization: Joi.string().required().description('Admin\'s JWT token.'),
			},
			params: {
				categoryId: Joi.string().objectId().required().description('Category ID')
			},
			group: 'CATEGORY',
			description: 'Route to delete category (soft delete). Admin only.',
			model: 'DeleteCategory'
		},
		auth: CONSTANTS.AVAILABLE_AUTHS.ADMIN,
		handler: categoryController.deleteCategory
	},
	// Public routes (for users to view categories)
	{
		method: 'GET',
		path: '/v1/categories',
		joiSchemaForSwagger: {
			query: {
				parentCategory: Joi.string().objectId().optional().description('Filter by parent category ID (null for top-level)'),
				search: Joi.string().optional().description('Search by name, description, or slug'),
				skip: Joi.number().integer().min(0).optional().description('Number of records to skip (for pagination)'),
				limit: Joi.number().integer().min(1).optional().description('Number of records to return (for pagination)'),
			},
			group: 'CATEGORY',
			description: 'Route to get all active categories with pagination and search (public).',
			model: 'GetCategoriesPublic'
		},
		handler: categoryController.getCategories
	},
	{
		method: 'GET',
		path: '/v1/category/:categoryId',
		joiSchemaForSwagger: {
			params: {
				categoryId: Joi.string().objectId().required().description('Category ID')
			},
			group: 'CATEGORY',
			description: 'Route to get category by ID (public).',
			model: 'GetCategoryByIdPublic'
		},
		handler: categoryController.getCategoryById
	},
];

module.exports = routes;

