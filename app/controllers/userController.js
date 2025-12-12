'use strict';

const MESSAGES = require('../utils/messages');
const { createErrorResponse, createSuccessResponse } = require('../helpers/common/resHelper');
const SERVICES = require('../services');
const MODELS = require('../models');
const { generateETHTradingWallet, generateSolanaTradingWallet, encryptJwt, hashPassword, compareHash, generateOTP, generateExpiryTime, sendEmail, createResetPasswordLink, decryptJwt } = require('../utils/utils');
const CONSTANTS = require('../utils/constants');


/**************************************************
 ***** Auth controller for authentication logic ***
 **************************************************/
const userController = {};


/**
 * function to generate trading wallet.
 * @param {*} payload 
 * @returns 
 */
userController.createTradingWallet = async (payload) => {

	let wallet = {};

	// check if trading wallet is created or not
	if (payload.user.isTradingWalletCreated) {
		throw createErrorResponse(MESSAGES.TRADING_WALLET_ALREADY_CREATED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);

	}


	if (payload.chain === CONSTANTS.CHAINS.ETH || payload.chain === CONSTANTS.CHAINS.BLAST || payload.chain === CONSTANTS.CHAINS.BASE) {
		wallet =  await generateETHTradingWallet();
	} else {
		wallet = await generateSolanaTradingWallet();
	}

	await SERVICES.dbService.findOneAndUpdate(MODELS.userModel, { walletAddress: payload.user.walletAddress }, { tradingWallet: wallet.publicKey, privateKey: wallet.privateKey, isTradingWalletCreated: true });


	return createSuccessResponse(MESSAGES.SUCCESS, wallet);

};

/**
 * function to generate trading wallet.
 * @param {*} payload 
 * @returns 
 */
userController.userAuth = async (payload) => {
	const checkIfAccountExists = await SERVICES.dbService.findOne(MODELS.userModel, { walletAddress: payload.walletAddress });

	let isTradingWalletCreated = true, token;

	if(!checkIfAccountExists) {
		isTradingWalletCreated = false;

		const userToCreate = { walletAddress: payload.walletAddress };
		let userWithReferralCode;

		if (payload.referralCode) {
			// check if this referral code belongs to a user
			userWithReferralCode = await SERVICES.dbService.findOne(MODELS.userModel, {
				referralCode: payload.referralCode,
				isDeleted: false,
			});
			
			if (! userWithReferralCode) {
				throw createErrorResponse(MESSAGES.REFERRAL_CODE_NOT_FOUND, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
			}

			// assign referral code to friend referral code key
			userToCreate.friendReferralCode = payload.referralCode;
		}

		const userData = await SERVICES.dbService.create(MODELS.userModel, userToCreate);

		if (userData.friendReferralCode) {
			await SERVICES.dbService.create(MODELS.referralModel, {
				refererUser: userWithReferralCode._id,
				referedUser: userData._id,
			});
		}

		token = encryptJwt({ _id: userData._id, date: Date.now() }, { expiresIn: '7d' });

	} else {
		token = encryptJwt({ _id: checkIfAccountExists._id, date: Date.now(), admin: false }, { expiresIn: '7d' });
	}

	return createSuccessResponse(MESSAGES.SUCCESS, { token, isTradingWalletCreated });

};




/**
 * Saves a referral code for a user.
 *
 * @param {Object} payload - The payload containing the user and referral code.
 * @param {Object} payload.user - The user object.
 * @param {string} payload.user.referralCode - The referral code to be saved.
 * @param {string} payload.referralCode - The referral code to be saved.
 * @throws {Error} If the user already has a referral code saved.
 * @throws {Error} If another user is already using the referral code.
 * @return {Promise<Object>} A success response if the referral code is saved successfully.
 */
userController.saveReferral = async (payload) => {
	if (payload.user.referralCode) {
		throw createErrorResponse(MESSAGES.REFERRAL_CODE_ALREADY_SAVED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// check if another user is using this referral code
	const userWithSameReferralCode = await SERVICES.dbService.findOne(MODELS.userModel, {
		referralCode: payload.referralCode,
		isDeleted: false,
	});

	if (userWithSameReferralCode) {
		throw createErrorResponse(MESSAGES.REFERRAL_CODE_ALREADY_USED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// update referral code
	await SERVICES.dbService.findOneAndUpdate(MODELS.userModel, { _id: payload.user._id }, { referralCode: payload.referralCode });

	return createSuccessResponse(MESSAGES.REFERRAL_CODE_SAVED_SUCCESSFULLY);
};

/**
 * Fetches referral statistics for a user.
 *
 * @param {Object} payload - The payload containing the user object.
 * @param {Object} payload.user - The user object.
 * @param {ObjectId} payload.user._id - The ID of the user.
 * @return {Promise<Object>} A promise that resolves to an object containing the referral statistics.
 * The object has the following properties:
 * - totalReferred: The total number of users referred by the user.
 * - totalTraders: The total number of traders referred by the user.
 * - totalVolume: The total trade volume of the traders referred by the user.
 */
userController.fetchReferralStats = async (payload) => {
	const data = (await SERVICES.dbService.aggregate(MODELS.referralModel, [
		{ $match: {
			refererUser: payload.user._id,
			isDeleted: false
		} },
		{ $group: {
			_id: 1,
			totalReferred: { $sum: 1 },
			totalTraders: { $sum: { $cond: {
				if: { $ne: [ '$tradeCount', 0 ] },
				then: 1,
				else: 0
			} } },
			totalVolume: { $sum: '$tradeVolume' }
		} }
	]))[0] ?? {
		totalReferred: 0,
		totalTraders: 0,
		totalVolume: 0,
	};

	return Object.assign(createSuccessResponse(MESSAGES.REFERRAL_STATS_FETCHED_SUCCESSFULLY), { data });
};

/**
 * Register a new user
 * @param {*} payload 
 * @returns 
 */
userController.registerUser = async (payload) => {
	// Check if user with email already exists
	const existingUserByEmail = await SERVICES.dbService.findOne(MODELS.userModel, { 
		email: payload.email,
		isDeleted: false 
	});
	
	if (existingUserByEmail) {
		throw createErrorResponse(MESSAGES.EMAIL_ALREADY_EXISTS, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if user with mobileNumber already exists
	if (payload.mobileNumber) {
		const existingUserByMobile = await SERVICES.dbService.findOne(MODELS.userModel, { 
			mobileNumber: payload.mobileNumber,
			isDeleted: false 
		});
		
		if (existingUserByMobile) {
			throw createErrorResponse(MESSAGES.NUMBER_ALREADY_EXIST, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
		}
	}

	// Check if username already exists
	const existingUserByUsername = await SERVICES.dbService.findOne(MODELS.userModel, { 
		username: payload.username,
		isDeleted: false 
	});
	
	if (existingUserByUsername) {
		throw createErrorResponse(MESSAGES.USERNAME_ALREADY_TAKEN, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Hash password
	const hashedPassword = hashPassword(payload.password);

	// Generate email verification OTP
	const emailOTP = generateOTP(CONSTANTS.OTP_LENGTH);

	console.log('emailOTP', emailOTP);
	const tokenExpDate = generateExpiryTime(CONSTANTS.OTP_EXPIRIED_TIME_IN_SECONDS || 300);

	// Create user
	const userData = await SERVICES.dbService.create(MODELS.userModel, {
		email: payload.email,
		mobileNumber: payload.mobileNumber,
		username: payload.username,
		password: hashedPassword,
		isEmailVerified: false
	});

	// Create session with email OTP
	await SERVICES.dbService.findOneAndUpdate(
		MODELS.sessionModel,
		{ userId: userData._id, tokenType: CONSTANTS.TOKEN_TYPES.OTP },
		{
			userId: userData._id,
			tokenType: CONSTANTS.TOKEN_TYPES.OTP,
			emailOTP: emailOTP,
			tokenExpDate: tokenExpDate
		},
		{ upsert: true }
	);

	// Send verification email
	try {
		await sendEmail({
			email: payload.email,
			userName: payload.username,
			token: emailOTP
		}, CONSTANTS.EMAIL_TYPES.VERIFICATION_EMAIL);
	} catch (error) {
		console.error('Error sending verification email:', error);
		// Continue even if email fails
	}

	return createSuccessResponse(MESSAGES.VERIFICATION_MAIL_SENT);
};

/**
 * Login user
 * @param {*} payload 
 * @returns 
 */
userController.loginUser = async (payload) => {
	// Find user by email or username (email field can contain either)
	const user = await SERVICES.dbService.findOne(MODELS.userModel, {
		email: payload.email,
		isDeleted: false
	});

	if (!user) {
		throw createErrorResponse(MESSAGES.EMAIL_NOT_EXIST, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if password exists (for users registered via wallet, password might not exist)
	if (!user.password) {
		throw createErrorResponse(MESSAGES.INVALID_PASSWORD, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Verify password
	const passwordMatched = compareHash(payload.password, user.password);
	if (!passwordMatched) {
		throw createErrorResponse(MESSAGES.PASSWORD_MISMATCHED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if email is verified
	if (!user.isEmailVerified) {
		throw createErrorResponse(MESSAGES.VERIFY_EMAIL_BEFORE_LOGIN, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Generate JWT token
	const token = encryptJwt({ _id: user._id, date: Date.now(), admin: false }, { expiresIn: '7d' });

	return createSuccessResponse(MESSAGES.LOGGED_IN_SUCCESSFULLY, { token, user: { _id: user._id, email: user.email, username: user.username } });
};

/**
 * Verify user email with OTP
 * @param {*} payload 
 * @returns 
 */
userController.verifyEmail = async (payload) => {
	// Find user by email
	const user = await SERVICES.dbService.findOne(MODELS.userModel, {
		email: payload.email,
		isDeleted: false
	});

	if (!user) {
		throw createErrorResponse(MESSAGES.EMAIL_NOT_EXIST, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if already verified
	if (user.isEmailVerified) {
		return createSuccessResponse(MESSAGES.EMAIL_VERIFIED);
	}

	// Find session with OTP
	const session = await SERVICES.dbService.findOne(MODELS.sessionModel, {
		userId: user._id,
		tokenType: CONSTANTS.TOKEN_TYPES.OTP
	});

	if (!session || !session.emailOTP) {
		throw createErrorResponse(MESSAGES.OTP_INVALID, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if OTP is expired
	if (new Date() > new Date(session.tokenExpDate)) {
		throw createErrorResponse(MESSAGES.OTP_EXPIRED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Verify OTP
	if (session.emailOTP !== payload.otp) {
		throw createErrorResponse(MESSAGES.OTP_INVALID, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Update user email verification status
	await SERVICES.dbService.findOneAndUpdate(
		MODELS.userModel,
		{ _id: user._id },
		{ isEmailVerified: true }
	);

	// Remove OTP from session
	await SERVICES.dbService.findOneAndUpdate(
		MODELS.sessionModel,
		{ userId: user._id, tokenType: CONSTANTS.TOKEN_TYPES.OTP },
		{ emailOTP: null }
	);

	return createSuccessResponse(MESSAGES.EMAIL_VERIFIED);
};

/**
 * Forgot password - Send reset password link to user's email
 * @param {*} payload 
 * @returns 
 */
userController.forgotPassword = async (payload) => {
	// Find user by email
	const user = await SERVICES.dbService.findOne(MODELS.userModel, {
		email: payload.email,
		isDeleted: false
	});

	if (!user) {
		// Don't reveal if email exists or not for security reasons
		// Return success message even if user doesn't exist
		return createSuccessResponse(MESSAGES.RESET_PASSWORD_LINK_SENT);
	}

	// Check if user has a password (users registered via wallet might not have password)
	if (!user.password) {
		throw createErrorResponse(MESSAGES.INVALID_PASSWORD, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Create reset password link (this generates the token internally)
	const resetPasswordLink = createResetPasswordLink({
		_id: user._id,
		email: user.email,
		role: CONSTANTS.AVAILABLE_AUTHS.USER
	});

	// Extract token from the link (token is the last part after the last '/')
	const resetToken = resetPasswordLink.split('/').pop();

	console.log('resetToken', resetToken);

	// Store token in session with expiration (1 hour)
	const tokenExpDate = generateExpiryTime(3600); // 1 hour = 3600 seconds
	await SERVICES.dbService.findOneAndUpdate(
		MODELS.sessionModel,
		{ userId: user._id, tokenType: CONSTANTS.TOKEN_TYPES.RESET_PASSWORD },
		{
			userId: user._id,
			tokenType: CONSTANTS.TOKEN_TYPES.RESET_PASSWORD,
			token: resetToken,
			tokenExpDate: tokenExpDate
		},
		{ upsert: true }
	);

	// Send reset password email
	try {
		await sendEmail({
			email: user.email,
			name: user.username || user.email,
			resetPasswordLink: resetPasswordLink
		}, CONSTANTS.EMAIL_TYPES.RESET_PASSWORD_EMAIL);
	} catch (error) {
		console.error('Error sending reset password email:', error);
		// Continue even if email fails
	}

	return createSuccessResponse(MESSAGES.RESET_PASSWORD_LINK_SENT);
};

/**
 * Reset password - Update user password using reset token
 * @param {*} payload 
 * @returns 
 */
userController.resetPassword = async (payload) => {
	// Validate token and get user data
	let decodedToken;
	try {
		decodedToken = decryptJwt(payload.token);
	} catch (error) {
		throw createErrorResponse(MESSAGES.INVALID_TOKEN, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if token has required fields
	if (!decodedToken._id || !decodedToken.email) {
		throw createErrorResponse(MESSAGES.INVALID_TOKEN, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Find user by ID from token
	const user = await SERVICES.dbService.findOne(MODELS.userModel, {
		_id: decodedToken._id,
		email: decodedToken.email,
		isDeleted: false
	});

	if (!user) {
		throw createErrorResponse(MESSAGES.EMAIL_NOT_EXIST, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Verify token exists in session and is not expired
	const session = await SERVICES.dbService.findOne(MODELS.sessionModel, {
		userId: user._id,
		tokenType: CONSTANTS.TOKEN_TYPES.RESET_PASSWORD
	});

	if (!session || !session.token) {
		throw createErrorResponse(MESSAGES.INVALID_TOKEN, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if token matches
	if (session.token !== payload.token) {
		throw createErrorResponse(MESSAGES.INVALID_TOKEN, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if token is expired
	if (session.tokenExpDate && new Date() > new Date(session.tokenExpDate)) {
		throw createErrorResponse(MESSAGES.OTP_EXPIRED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Validate password (minimum 6 characters)
	if (!payload.password || payload.password.length < 6) {
		throw createErrorResponse(MESSAGES.INVALID_PASSWORD, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Hash new password
	const hashedPassword = hashPassword(payload.password);

	// Update user password
	await SERVICES.dbService.findOneAndUpdate(
		MODELS.userModel,
		{ _id: user._id },
		{ password: hashedPassword }
	);

	// Clear reset token from session
	await SERVICES.dbService.findOneAndUpdate(
		MODELS.sessionModel,
		{ userId: user._id, tokenType: CONSTANTS.TOKEN_TYPES.RESET_PASSWORD },
		{ token: null, tokenExpDate: null }
	);

	return createSuccessResponse(MESSAGES.PASSWORD_CHANGED);
};

/**
 * Resend OTP - Resend email verification OTP to user
 * @param {*} payload 
 * @returns 
 */
userController.resendOTP = async (payload) => {
	// Find user by email
	const user = await SERVICES.dbService.findOne(MODELS.userModel, {
		email: payload.email,
		isDeleted: false
	});

	if (!user) {
		throw createErrorResponse(MESSAGES.EMAIL_NOT_EXIST, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Check if email is already verified
	if (user.isEmailVerified) {
		throw createErrorResponse(MESSAGES.EMAIL_VERIFIED, CONSTANTS.ERROR_TYPES.BAD_REQUEST);
	}

	// Generate new email verification OTP
	const emailOTP = generateOTP(CONSTANTS.OTP_LENGTH);
	const tokenExpDate = generateExpiryTime(CONSTANTS.OTP_EXPIRIED_TIME_IN_SECONDS || 300);

	// Update session with new OTP
	await SERVICES.dbService.findOneAndUpdate(
		MODELS.sessionModel,
		{ userId: user._id, tokenType: CONSTANTS.TOKEN_TYPES.OTP },
		{
			userId: user._id,
			tokenType: CONSTANTS.TOKEN_TYPES.OTP,
			emailOTP: emailOTP,
			tokenExpDate: tokenExpDate
		},
		{ upsert: true }
	);

	// Send verification email
	try {
		await sendEmail({
			email: user.email,
			userName: user.username || user.email,
			token: emailOTP
		}, CONSTANTS.EMAIL_TYPES.VERIFICATION_EMAIL);
	} catch (error) {
		console.error('Error sending verification email:', error);
		// Continue even if email fails
	}

	return createSuccessResponse(MESSAGES.OTP_SENT_TO_YOUR_EMAIL);
};

/* export controller */
module.exports = userController;
