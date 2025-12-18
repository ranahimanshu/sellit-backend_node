'use strict';

const MESSAGES = require('../utils/messages');
const { createErrorResponse, createSuccessResponse } = require('../helpers/common/resHelper');
const SERVICES = require('../services');
const MODELS = require('../models');
const { convertIdToMongooseId } = require('../utils/utils');
const CONSTANTS = require('../utils/constants');

/**************************************************
 ***** Ad controller for ad CRUD operations ***
 **************************************************/
const adController = {};

/**
 * Create a new ad
 * @param {*} payload 
 * @returns 
 */
adController.createAd = async (payload) => {
	// Validate category exists
	const category = await SERVICES.dbService.findOne(MODELS.categoryModel, {
		_id: convertIdToMongooseId(payload.categoryId),
		isDeleted: false,
	});

	if (!category) {
		throw createErrorResponse(MESSAGES.CATEGORY_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Create ad - status is pending content moderation
	const adData = {
		userId: payload.user._id,
		categoryId: convertIdToMongooseId(payload.categoryId),
		title: payload.title,
		description: payload.description || null,
		price: payload.price,
		transactionType: payload.transactionType,
		images: payload.images || [],
		location: {
			zipCode: payload.zipCode || null,
			city: payload.city || null,
			state: payload.state || null,
			country: payload.country || 'Sweden',
			coordinates: payload.coordinates || null
		},
		contactInfo: {
			showProfile: payload.showProfile !== undefined ? payload.showProfile : true,
			phone: payload.phone || null,
			email: payload.email || null
		},
		status: CONSTANTS.AD_STATUS.APPROVED, // Apprvoed for now will be changed to PENDING after content moderation later
		isDeleted: false,
		featured: false, // Only admin can set featured
		tags: payload.tags || []
	};

	// Set expiration date if provided (default: 30 days)
	if (payload.expiresAt) {
		adData.expiresAt = new Date(payload.expiresAt);
	} else {
		const expirationDate = new Date();
		expirationDate.setDate(expirationDate.getDate() + 30); // 30 days from now
		adData.expiresAt = expirationDate;
	}

	const ad = await SERVICES.dbService.create(MODELS.adModel, adData);

	return createSuccessResponse(MESSAGES.AD_CREATED_SUCCESSFULLY,  ad);
};

/**
 * Get all ads (with optional filters, pagination, and search)
 * @param {*} payload 
 * @returns 
 */
adController.getAds = async (payload) => {
	const criteria = {
		isDeleted: false
	};

	// For public routes, only show approved ads
	if (!payload.user || !payload.user.admin) {
		criteria.status = CONSTANTS.AD_STATUS.APPROVED;
		// Check if ad hasn't expired
		criteria.$or = [
			{ expiresAt: { $gte: new Date() } },
			{ expiresAt: null }
		];
	}

	// Filter by status (admin only)
	if (payload.status !== undefined && payload.user && payload.user.admin) {
		criteria.status = parseInt(payload.status, 10);
	}


	// Filter by category
	if (payload.categoryId) {
		criteria.categoryId = convertIdToMongooseId(payload.categoryId);
	}

	// Filter by user (for user's own ads)
	if (payload.userId) {
		criteria.userId = convertIdToMongooseId(payload.userId);
	}

	// Filter by transaction type
	if (payload.transactionType !== undefined) {
		criteria.transactionType = parseInt(payload.transactionType, 10);
	}

	// Filter by price range
	if (payload.minPrice !== undefined) {
		criteria.price = { $gte: parseFloat(payload.minPrice) };
	}
	if (payload.maxPrice !== undefined) {
		if (criteria.price) {
			criteria.price.$lte = parseFloat(payload.maxPrice);
		} else {
			criteria.price = { $lte: parseFloat(payload.maxPrice) };
		}
	}

	// Filter by location (zip code or city)
	if (payload.zipCode) {
		criteria['location.zipCode'] = payload.zipCode;
	}
	if (payload.city) {
		criteria['location.city'] = new RegExp(payload.city, 'i');
	}

	// Filter by featured
	if (payload.featured !== undefined) {
		criteria.featured = payload.featured === 'true' || payload.featured === true;
	}

	// Search functionality - search by title, description, or tags
	if (payload.search && payload.search.trim()) {
		const searchRegex = new RegExp(payload.search.trim(), 'i');
		criteria.$or = [
			{ title: searchRegex },
			{ description: searchRegex },
			{ tags: { $in: [searchRegex] } }
		];
	}

	// Pagination
	const skip = payload.skip ? parseInt(payload.skip, 10) : 0;
	const limit = payload.limit ? parseInt(payload.limit, 10) : CONSTANTS.PAGINATION.LIMIT;

	// Get total count
	const totalCount = await MODELS.adModel.countDocuments(criteria);

	// Sort options
	let sort = { createdAt: -1 }; // Default: newest first
	if (payload.sortBy) {
		switch (payload.sortBy) {
		case 'price_asc':
			sort = { price: 1 };
			break;
		case 'price_desc':
			sort = { price: -1 };
			break;
		case 'newest':
			sort = { createdAt: -1 };
			break;
		case 'oldest':
			sort = { createdAt: 1 };
			break;
		case 'featured':
			sort = { featured: -1, createdAt: -1 };
			break;
		default:
			sort = { createdAt: -1 };
		}
	}

	// Get ads with pagination
	const ads = await MODELS.adModel
		.find(criteria)
		.populate('userId', 'username email')
		.populate('categoryId', 'name icon slug')
		.sort(sort)
		.skip(skip)
		.limit(limit)
		.lean();

	return createSuccessResponse(MESSAGES.ADS_FETCHED_SUCCESSFULLY, {
		ads,
		totalCount,
		skip,
		limit,
		hasMore: skip + limit < totalCount
	});
};

/**
 * Get ad by ID
 * @param {*} payload 
 * @returns 
 */
adController.getAdById = async (payload) => {
	const criteria = {
		_id: convertIdToMongooseId(payload.adId),
		isDeleted: false
	};

	// For public routes, only show approved ads
	if (!payload.user || !payload.user.admin) {
		criteria.status = CONSTANTS.AD_STATUS.APPROVED;
		criteria.$or = [
			{ expiresAt: { $gte: new Date() } },
			{ expiresAt: null }
		];
	}

	const ad = await MODELS.adModel
		.findOne(criteria)
		.populate('userId', 'username email')
		.populate('categoryId', 'name icon slug parentCategory')
		.lean();

	if (!ad) {
		throw createErrorResponse(MESSAGES.AD_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Increment view count (only for public access)
	if (!payload.user || !payload.user.admin) {
		await MODELS.adModel.updateOne(
			{ _id: ad._id },
			{ $inc: { views: 1 } }
		);
		ad.views = (ad.views || 0) + 1;
	}

	return createSuccessResponse(MESSAGES.AD_FETCHED_SUCCESSFULLY, { ad });
};

/**
 * Update ad
 * @param {*} payload 
 * @returns 
 */
adController.updateAd = async (payload) => {
	const ad = await SERVICES.dbService.findOne(MODELS.adModel, {
		_id: convertIdToMongooseId(payload.adId),
		isDeleted: false
	});

	if (!ad) {
		throw createErrorResponse(MESSAGES.AD_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if user owns the ad or is admin
	if (ad.userId.toString() !== payload.user._id.toString() && !payload.user.admin) {
		throw createErrorResponse(MESSAGES.UNAUTHORIZED, CONSTANTS.ERROR_TYPES.FORBIDDEN);
	}

	// Validate category if being updated
	if (payload.categoryId) {
		const category = await SERVICES.dbService.findOne(MODELS.categoryModel, {
			_id: convertIdToMongooseId(payload.categoryId),
			isDeleted: false,
		});

		if (!category) {
			throw createErrorResponse(MESSAGES.CATEGORY_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
		}
	}

	// Prepare update data
	const updateData = {};
	if (payload.title !== undefined) updateData.title = payload.title;
	if (payload.description !== undefined) updateData.description = payload.description;
	if (payload.price !== undefined) updateData.price = payload.price;
	if (payload.categoryId !== undefined) updateData.categoryId = convertIdToMongooseId(payload.categoryId);
	if (payload.transactionType !== undefined) updateData.transactionType = parseInt(payload.transactionType, 10);
	if (payload.images !== undefined) updateData.images = payload.images;
	
	// Admin-only updates
	if (payload.user.admin) {
		if (payload.status !== undefined) {
			updateData.status = parseInt(payload.status, 10);
		}
		if (payload.featured !== undefined) updateData.featured = payload.featured;
	} else {
		// If user updates their ad, it needs re-approval
		if (payload.title !== undefined || payload.description !== undefined || payload.price !== undefined || 
			payload.categoryId !== undefined || payload.images !== undefined) {
			updateData.status = CONSTANTS.AD_STATUS.PENDING; // Back to pending for content moderation
			updateData.rejectionReason = null; // Clear previous rejection reason
		}
	}
	
	if (payload.tags !== undefined) updateData.tags = payload.tags;
	if (payload.expiresAt !== undefined) updateData.expiresAt = new Date(payload.expiresAt);

	// Update location
	if (payload.zipCode !== undefined || payload.city !== undefined || payload.state !== undefined || payload.country !== undefined || payload.coordinates !== undefined) {
		updateData.location = { ...ad.location };
		if (payload.zipCode !== undefined) updateData.location.zipCode = payload.zipCode;
		if (payload.city !== undefined) updateData.location.city = payload.city;
		if (payload.state !== undefined) updateData.location.state = payload.state;
		if (payload.country !== undefined) updateData.location.country = payload.country;
		if (payload.coordinates !== undefined) updateData.location.coordinates = payload.coordinates;
	}

	// Update contact info
	if (payload.showProfile !== undefined || payload.phone !== undefined || payload.email !== undefined) {
		updateData.contactInfo = { ...ad.contactInfo };
		if (payload.showProfile !== undefined) updateData.contactInfo.showProfile = payload.showProfile;
		if (payload.phone !== undefined) updateData.contactInfo.phone = payload.phone;
		if (payload.email !== undefined) updateData.contactInfo.email = payload.email;
	}

	// Update ad
	const updatedAd = await SERVICES.dbService.findOneAndUpdate(
		MODELS.adModel,
		{ _id: convertIdToMongooseId(payload.adId) },
		updateData
	);

	return createSuccessResponse(MESSAGES.AD_UPDATED_SUCCESSFULLY, updatedAd );
};

/**
 * Delete ad (soft delete)
 * @param {*} payload 
 * @returns 
 */
adController.deleteAd = async (payload) => {
	const ad = await SERVICES.dbService.findOne(MODELS.adModel, {
		_id: convertIdToMongooseId(payload.adId),
		isDeleted: false
	});

	if (!ad) {
		throw createErrorResponse(MESSAGES.AD_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if user owns the ad or is admin
	if (ad.userId.toString() !== payload.user._id.toString() && !payload.user.admin) {
		throw createErrorResponse(MESSAGES.UNAUTHORIZED, CONSTANTS.ERROR_TYPES.FORBIDDEN);
	}

	// Soft delete ad
	await SERVICES.dbService.findOneAndUpdate(
		MODELS.adModel,
		{ _id: convertIdToMongooseId(payload.adId) },
		{ isDeleted: true }
	);

	return createSuccessResponse(MESSAGES.AD_DELETED_SUCCESSFULLY);
};

/**
 * Get user's own ads
 * @param {*} payload 
 * @returns 
 */
adController.getMyAds = async (payload) => {
	const criteria = {
		userId: payload.user._id,
		isDeleted: false
	};


	// Pagination
	const skip = payload.skip ? parseInt(payload.skip, 10) : 0;
	const limit = payload.limit ? parseInt(payload.limit, 10) : CONSTANTS.PAGINATION.LIMIT;

	// Get total count
	const totalCount = await MODELS.adModel.countDocuments(criteria);

	// Get ads
	const ads = await MODELS.adModel
		.find(criteria)
		.populate('categoryId', 'name icon slug')
		.sort({ createdAt: -1 })
		.skip(skip)
		.limit(limit)
		.lean();

	return createSuccessResponse(MESSAGES.ADS_FETCHED_SUCCESSFULLY, {
		ads,
		totalCount,
		skip,
		limit,
		hasMore: skip + limit < totalCount
	});
};

/**
 * Approve content moderation (Content Moderation System/API)
 * After content moderation approves, ad goes to PENDING status (waiting for admin approval)
 * @param {*} payload 
 * @returns 
 */
adController.approveContentModeration = async (payload) => {
	const ad = await SERVICES.dbService.findOne(MODELS.adModel, {
		_id: convertIdToMongooseId(payload.adId),
		isDeleted: false
	});

	if (!ad) {
		throw createErrorResponse(MESSAGES.AD_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	if (ad.status === CONSTANTS.AD_STATUS.APPROVED) {
		throw createErrorResponse(MESSAGES.CONTENT_MODERATION_ALREADY_APPROVED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// After content moderation approves, move to PENDING (waiting for admin approval)
	const updateData = {
		status: CONSTANTS.AD_STATUS.PENDING, // Waiting for admin approval
		rejectionReason: null // Clear any previous rejection reason
	};

	const updatedAd = await SERVICES.dbService.findOneAndUpdate(
		MODELS.adModel,
		{ _id: convertIdToMongooseId(payload.adId) },
		updateData
	);

	return createSuccessResponse(MESSAGES.CONTENT_MODERATION_APPROVED_SUCCESSFULLY, { ad: updatedAd });
};

/**
 * Reject content moderation (Content Moderation System/API)
 * After content moderation rejects, ad goes to PENDING status (admin can review and approve)
 * @param {*} payload 
 * @returns 
 */
adController.rejectContentModeration = async (payload) => {
	const ad = await SERVICES.dbService.findOne(MODELS.adModel, {
		_id: convertIdToMongooseId(payload.adId),
		isDeleted: false
	});

	if (!ad) {
		throw createErrorResponse(MESSAGES.AD_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// After content moderation rejects, move to PENDING (admin can review and approve)
	const updateData = {
		status: CONSTANTS.AD_STATUS.PENDING, // Admin can review and approve
		rejectionReason: payload.rejectionReason || null
	};

	const updatedAd = await SERVICES.dbService.findOneAndUpdate(
		MODELS.adModel,
		{ _id: convertIdToMongooseId(payload.adId) },
		updateData
	);

	return createSuccessResponse(MESSAGES.CONTENT_MODERATION_REJECTED_SUCCESSFULLY, { ad: updatedAd });
};

/**
 * Approve ad (Admin only)
 * Admin approves ads that are in PENDING status (after content moderation)
 * @param {*} payload 
 * @returns 
 */
adController.approveAd = async (payload) => {
	const ad = await SERVICES.dbService.findOne(MODELS.adModel, {
		_id: convertIdToMongooseId(payload.adId),
		isDeleted: false
	});

	if (!ad) {
		throw createErrorResponse(MESSAGES.AD_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	if (ad.status === CONSTANTS.AD_STATUS.APPROVED) {
		throw createErrorResponse(MESSAGES.AD_ALREADY_APPROVED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	if (ad.status !== CONSTANTS.AD_STATUS.PENDING) {
		throw createErrorResponse('Ad must be in pending status for admin approval.', CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Admin approves ad
	const updateData = {
		status: CONSTANTS.AD_STATUS.APPROVED,
		rejectionReason: null // Clear rejection reason
	};

	const updatedAd = await SERVICES.dbService.findOneAndUpdate(
		MODELS.adModel,
		{ _id: convertIdToMongooseId(payload.adId) },
		updateData
	);

	return createSuccessResponse(MESSAGES.AD_APPROVED_SUCCESSFULLY, { ad: updatedAd });
};

/**
 * Reject ad (Admin only)
 * Admin rejects ads that are in PENDING status
 * @param {*} payload 
 * @returns 
 */
adController.rejectAd = async (payload) => {
	const ad = await SERVICES.dbService.findOne(MODELS.adModel, {
		_id: convertIdToMongooseId(payload.adId),
		isDeleted: false
	});

	if (!ad) {
		throw createErrorResponse(MESSAGES.AD_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	if (ad.status !== CONSTANTS.AD_STATUS.PENDING) {
		throw createErrorResponse('Ad must be in pending status for admin rejection.', CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Admin rejects ad
	const updateData = {
		status: CONSTANTS.AD_STATUS.REJECT,
		rejectionReason: payload.rejectionReason || null
	};

	const updatedAd = await SERVICES.dbService.findOneAndUpdate(
		MODELS.adModel,
		{ _id: convertIdToMongooseId(payload.adId) },
		updateData
	);

	return createSuccessResponse(MESSAGES.AD_REJECTED_SUCCESSFULLY, { ad: updatedAd });
};

/* export controller */
module.exports = adController;

