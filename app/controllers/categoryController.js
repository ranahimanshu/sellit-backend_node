'use strict';

const MESSAGES = require('../utils/messages');
const { createErrorResponse, createSuccessResponse } = require('../helpers/common/resHelper');
const SERVICES = require('../services');
const MODELS = require('../models');
const { convertIdToMongooseId } = require('../utils/utils');
const CONSTANTS = require('../utils/constants');

/**************************************************
 ***** Category controller for category CRUD operations ***
 **************************************************/
const categoryController = {};

/**
 * Create a new category
 * @param {*} payload 
 * @returns 
 */
categoryController.createCategory = async (payload) => {
	// Check if category with same name already exists
	const existingCategory = await SERVICES.dbService.findOne(MODELS.categoryModel, {
		name: payload.name,
		isDeleted: false
	});

	if (existingCategory) {
		throw createErrorResponse(MESSAGES.CATEGORY_ALREADY_EXISTS, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Generate slug from name if not provided
	let slug = payload.slug;
	if (!slug) {
		slug = payload.name.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
	}

	// Check if slug already exists
	const existingSlug = await SERVICES.dbService.findOne(MODELS.categoryModel, {
		slug: slug,
		isDeleted: false
	});

	if (existingSlug) {
		slug = `${slug}-${Date.now()}`;
	}

	// Validate parent category if provided
	if (payload.parentCategory) {
		const parentCategory = await SERVICES.dbService.findOne(MODELS.categoryModel, {
			_id: convertIdToMongooseId(payload.parentCategory),
			isDeleted: false
		});

		if (!parentCategory) {
			throw createErrorResponse(MESSAGES.PARENT_CATEGORY_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
		}
	}

	// Create category
	const categoryData = {
		name: payload.name,
		icon: payload.icon || null,
		description: payload.description || null,
		slug: slug,
		parentCategory: payload.parentCategory ? convertIdToMongooseId(payload.parentCategory) : null,
		order: payload.order || 0,
		isActive: payload.isActive !== undefined ? payload.isActive : true,
		isDeleted: false
	};

	const data = await SERVICES.dbService.create(MODELS.categoryModel, categoryData);

	return createSuccessResponse(MESSAGES.CATEGORY_CREATED_SUCCESSFULLY, data);
};

/**
 * Get all categories (with optional filters, pagination, and search)
 * @param {*} payload 
 * @returns 
 */
categoryController.getCategories = async (payload) => {
	const criteria = {
		isDeleted: false
	};

	// For public routes (when user is not admin), only show active categories
	if (!payload.user || !payload.user.admin) {
		criteria.isActive = true;
	}

	// Filter by parent category (null for top-level categories)
	if (payload.parentCategory !== undefined) {
		if (payload.parentCategory === null || payload.parentCategory === 'null') {
			criteria.parentCategory = null;
		} else {
			criteria.parentCategory = convertIdToMongooseId(payload.parentCategory);
		}
	}

	// Filter by active status (only for admin)
	if (payload.isActive !== undefined && payload.user && payload.user.admin) {
		criteria.isActive = payload.isActive === 'true' || payload.isActive === true;
	}

	// Search functionality - search by name, description, or slug
	if (payload.search && payload.search.trim()) {
		const searchRegex = new RegExp(payload.search.trim(), 'i'); // Case-insensitive search
		criteria.$or = [
			{ name: searchRegex },
			{ description: searchRegex },
			{ slug: searchRegex }
		];
	}

	// Pagination - skip and limit
	const skip = payload.skip ? parseInt(payload.skip, 10) : 0;
	const limit = payload.limit ? parseInt(payload.limit, 10) : CONSTANTS.PAGINATION.LIMIT;

	// Get total count for pagination
	const totalCount = await MODELS.categoryModel.countDocuments(criteria);

	// Get categories with pagination
	const categories = await MODELS.categoryModel
		.find(criteria)
		.sort({ order: 1, createdAt: -1 })
		.skip(skip)
		.limit(limit)
		.lean();

	return createSuccessResponse(MESSAGES.CATEGORIES_FETCHED_SUCCESSFULLY, {
		categories,
		totalCount,
		skip,
		limit,
		hasMore: skip + limit < totalCount
	});
};

/**
 * Get category by ID
 * @param {*} payload 
 * @returns 
 */
categoryController.getCategoryById = async (payload) => {
	const criteria = {
		_id: convertIdToMongooseId(payload.categoryId),
		isDeleted: false
	};

	// For public routes, only show active categories
	if (!payload.user || !payload.user.admin) {
		criteria.isActive = true;
	}

	const category = await SERVICES.dbService.findOne(MODELS.categoryModel, criteria);

	if (!category) {
		throw createErrorResponse(MESSAGES.CATEGORY_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Get subcategories if any
	const data = await SERVICES.dbService.find(MODELS.categoryModel, {
		parentCategory: category._id,
		isDeleted: false
	});

	return createSuccessResponse(MESSAGES.CATEGORY_FETCHED_SUCCESSFULLY, data);
};

/**
 * Update category
 * @param {*} payload 
 * @returns 
 */
categoryController.updateCategory = async (payload) => {
	const category = await SERVICES.dbService.findOne(MODELS.categoryModel, {
		_id: convertIdToMongooseId(payload.categoryId),
		isDeleted: false
	});

	if (!category) {
		throw createErrorResponse(MESSAGES.CATEGORY_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if name is being updated and if it already exists
	if (payload.name && payload.name !== category.name) {
		const existingCategory = await SERVICES.dbService.findOne(MODELS.categoryModel, {
			name: payload.name,
			_id: { $ne: convertIdToMongooseId(payload.categoryId) },
			isDeleted: false
		});

		if (existingCategory) {
			throw createErrorResponse(MESSAGES.CATEGORY_ALREADY_EXISTS, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
		}
	}

	// Generate slug if name is updated
	let slug = payload.slug || category.slug;
	if (payload.name && !payload.slug) {
		slug = payload.name.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');

		// Check if slug already exists
		const existingSlug = await SERVICES.dbService.findOne(MODELS.categoryModel, {
			slug: slug,
			_id: { $ne: convertIdToMongooseId(payload.categoryId) },
			isDeleted: false
		});

		if (existingSlug) {
			slug = `${slug}-${Date.now()}`;
		}
	}

	// Validate parent category if provided
	if (payload.parentCategory !== undefined) {
		if (payload.parentCategory === null || payload.parentCategory === 'null') {
			payload.parentCategory = null;
		} else {
			// Prevent setting parent to itself
			if (payload.parentCategory.toString() === payload.categoryId.toString()) {
				throw createErrorResponse(MESSAGES.CANNOT_SET_PARENT_TO_SELF, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
			}

			const parentCategory = await SERVICES.dbService.findOne(MODELS.categoryModel, {
				_id: convertIdToMongooseId(payload.parentCategory),
				isDeleted: false
			});

			if (!parentCategory) {
				throw createErrorResponse(MESSAGES.PARENT_CATEGORY_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
			}
		}
	}

	// Prepare update data
	const updateData = {};
	if (payload.name !== undefined) updateData.name = payload.name;
	if (payload.icon !== undefined) updateData.icon = payload.icon;
	if (payload.description !== undefined) updateData.description = payload.description;
	if (payload.slug !== undefined || payload.name !== undefined) updateData.slug = slug;
	if (payload.parentCategory !== undefined) updateData.parentCategory = payload.parentCategory ? convertIdToMongooseId(payload.parentCategory) : null;
	if (payload.order !== undefined) updateData.order = payload.order;
	if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

	// Update category
	const data = await SERVICES.dbService.findOneAndUpdate(
		MODELS.categoryModel,
		{ _id: convertIdToMongooseId(payload.categoryId) },
		updateData
	);

	return createSuccessResponse(MESSAGES.CATEGORY_UPDATED_SUCCESSFULLY, data);
};

/**
 * Delete category (soft delete)
 * @param {*} payload 
 * @returns 
 */
categoryController.deleteCategory = async (payload) => {
	const category = await SERVICES.dbService.findOne(MODELS.categoryModel, {
		_id: convertIdToMongooseId(payload.categoryId),
		isDeleted: false
	});

	if (!category) {
		throw createErrorResponse(MESSAGES.CATEGORY_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if category has subcategories
	const subcategories = await SERVICES.dbService.find(MODELS.categoryModel, {
		parentCategory: category._id,
		isDeleted: false
	});

	if (subcategories.length > 0) {
		throw createErrorResponse(MESSAGES.CANNOT_DELETE_CATEGORY_WITH_SUBCATEGORIES, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Soft delete category
	await SERVICES.dbService.findOneAndUpdate(
		MODELS.categoryModel,
		{ _id: convertIdToMongooseId(payload.categoryId) },
		{ isDeleted: true }
	);

	return createSuccessResponse(MESSAGES.CATEGORY_DELETED_SUCCESSFULLY);
};

/* export controller */
module.exports = categoryController;

