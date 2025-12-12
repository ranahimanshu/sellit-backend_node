/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const pino = require('pino');
const BCRYPT = require('bcrypt');
const JWT = require('jsonwebtoken');
const MONGOOSE = require('mongoose');
const { createPinoBrowserSend, createWriteStream } = require('pino-logflare');
const handlebars = require('handlebars');
const CONSTANTS = require('./constants');
const CONFIG = require('../../config');
const AWS = require('aws-sdk');
const AWS_SES = new AWS.SES(CONFIG.SES);
const crypto = require('crypto');
const axios = require('axios');
const { ethers } = require('ethers');

const { Keypair } = require('@solana/web3.js');
const etherscan = require('etherscan-api').init('N1KVJ2VFVFRAEFJMZDNI94RSV1K96X7YTB');

const {
	PINO, LIVE_LOGGER_ENABLE,
} = require('../../config');

const PINO_CRED = { apiKey: PINO.API_KEY, sourceToken: PINO.API_SECRET };

const stream = createWriteStream(PINO_CRED); // create pino-logflare stream
const send = createPinoBrowserSend(PINO_CRED); // create pino-logflare browser stream

const sessionModel = require('../models/sessionModel');

const dbService = require('../services/dbService');


const commonFunctions = {};

/**
 * incrypt password in case user login implementation
 * @param {*} payloadString
 */
commonFunctions.hashPassword = (payloadString) => BCRYPT.hashSync(payloadString, CONSTANTS.SECURITY.BCRYPT_SALT);

/**
 * @param {string} plainText
 * @param {string} hash
 */
commonFunctions.compareHash = (payloadPassword, userPassword) => BCRYPT.compareSync(payloadPassword, userPassword);

/**
 * common function to create session
 * @param {*} payload 
 * @returns 
 */
commonFunctions.createSession = async (payload) => {
	const sessionData = {
		userId: payload.userId
	};

	if (payload.tokenType === CONSTANTS.TOKEN_TYPES.OTP) {
		Object.assign(sessionData, {
			mobileOTP: commonFunctions.generateOTP(CONSTANTS.OTP_LENGTH),
			emailOTP: commonFunctions.generateOTP(CONSTANTS.OTP_LENGTH),
			tokenExpDate: commonFunctions.generateExpiryTime(CONSTANTS.OTP_EXPIRIED_TIME_IN_SECONDS || 10)
		});
	} else {
		Object.assign(sessionData, {
			token: commonFunctions.encryptJwt({
				userId: payload.userId,
				date: Date.now(),
				role: payload.role
			})
		});
	}

	await dbService.findOneAndUpdate(
		sessionModel,
		{ userId: payload.userId, tokenType: payload.tokenType },
		sessionData,
		{ upsert: true }
	);

	return sessionData;
};


/**
 * function to get array of key-values by using key name of the object.
 */
commonFunctions.getEnumArray = (obj) => Object.keys(obj).map((key) => obj[key]);

/**
 * used for converting string id to mongoose object id
 */
commonFunctions.convertIdToMongooseId = (stringId) => MONGOOSE.Types.ObjectId(stringId);

/** used for comare mongoose object id */
commonFunctions.matchMongoId = (id1, id2) => id1.toString() === id2.toString();

/**
 * create jsonwebtoken
 */
commonFunctions.encryptJwt = (payload, expTime = '365d') => JWT.sign(payload, CONSTANTS.SECURITY.JWT_SIGN_KEY, { algorithm: 'HS256' }, { expTime: expTime });

/**
 * decrypt jsonwebtoken
 */
commonFunctions.decryptJwt = (token) => JWT.verify(token, CONSTANTS.SECURITY.JWT_SIGN_KEY, { algorithm: 'HS256' });

/**
 * function to convert an error into a readable form.
 * @param {} error
 */
commonFunctions.convertErrorIntoReadableForm = (error) => {
	let errorMessage = '';
	if (error.message.indexOf('[') > -1) {
		errorMessage = error.message.substr(error.message.indexOf('['));
	} else {
		errorMessage = error.message;
	}
	errorMessage = errorMessage.replace(/"/g, '');
	errorMessage = errorMessage.replace('[', '');
	errorMessage = errorMessage.replace(']', '');
	error.message = errorMessage;
	return error;
};

/**
 * Logger for error and success
 */
commonFunctions.log = {
	info: (data) => {
		console.log(`\x1b[33m${data}`, '\x1b[0m');
	},
	success: (data) => {
		console.log(`\x1b[32m${data}`, '\x1b[0m');
	},
	error: (data) => {
		console.log(`\x1b[31m${data}`, '\x1b[0m');
	},
	default: (data) => {
		console.log(data, '\x1b[0m');
	},
};

/**
 * function to get pagination condition for aggregate query.
 * @param {*} sort
 * @param {*} skip
 * @param {*} limit
 */
commonFunctions.getPaginationConditionForAggregate = (sort, skip, limit) => {
	const condition = [
		...(sort ? [ { $sort: sort } ] : []),
		{ $skip: skip },
		{ $limit: limit },
	];
	return condition;
};

/**
 * Function to send email from aws
 * @param {*} userData 
 * @param {*} type 
 * @returns 
 */
commonFunctions.sendEmailViaAWS = async (userData, subject, template) => {
	const params = {
		Source: CONFIG.SES.SENDER,
		Destination: {
			ToAddresses: [
				userData.email
			],
		},
		Message: {
			Body: {
				Html: {
					Charset: 'UTF-8',
					Data: template,
				},
			},
			Subject: {
				Charset: 'UTF-8',
				Data: subject,
			}
		},
	};

	return AWS_SES.sendEmail(params).promise();
};

/**
* Send an email to perticular user mail 
* @param {*} email email address
* @param {*} subject  subject
* @param {*} content content
* @param {*} cb callback
*/
commonFunctions.sendEmail = async (userData, type) => {

	const transporter = require('nodemailer').createTransport(CONFIG.SMTP.TRANSPORT);
	const handleBars = require('handlebars');
  
	userData.baseURL = CONFIG.CLIENT_URL;
	/** setup email data with unicode symbols **/
	const mailData = commonFunctions.emailTypes(userData, type),
		email = userData.email;
	mailData.template = fs.readFileSync(mailData.template, 'utf-8');
	const template = handleBars.compile(mailData.template);
  
	const result = template(mailData.data);
  
	const emailToSend = {
		to: email,
		from: CONFIG.SMTP.SENDER,
		subject: mailData.Subject,
		html: result,
	};
	return await transporter.sendMail(emailToSend);
};

/**
 * Function to make email details.
 * @param {*} user 
 * @param {*} type 
 * @returns 
 */
commonFunctions.emailTypes = (user, type) => {
	const EmailStatus = {
		Subject: '',
		data: {},
		template: ''
	};
	switch (type) {
	case CONSTANTS.EMAIL_TYPES.RESET_PASSWORD_EMAIL:
		EmailStatus['Subject'] = CONSTANTS.EMAIL_SUBJECTS.RESET_PASSWORD_EMAIL;
		EmailStatus.template = CONSTANTS.EMAIL_CONTENTS.RESET_PASSWORD_EMAIL;
		EmailStatus.data['name'] = user.name;
		EmailStatus.data['link'] = user.resetPasswordLink;
		EmailStatus.data['baseURL'] = user.baseURL;
		break;
		
	case CONSTANTS.EMAIL_TYPES.WELCOME_EMAIL:
		EmailStatus['Subject'] = CONSTANTS.EMAIL_SUBJECTS.WELCOME_EMAIL;
		EmailStatus.template = CONSTANTS.EMAIL_CONTENTS.WELCOME_EMAIL;
		EmailStatus.data['name'] = user.name;
		break;

	case CONSTANTS.EMAIL_TYPES.VERIFICATION_EMAIL:
		EmailStatus['Subject'] = CONSTANTS.EMAIL_SUBJECTS.VERIFICATION_EMAIL;
		EmailStatus.template = CONSTANTS.EMAIL_CONTENTS.EMAIL_VERIFICATION_TEMPLATE;
		EmailStatus.data['name'] = user.userName;
		EmailStatus.data['otp'] = user.token;
		EmailStatus.data['baseURL'] = user.baseURL;
		break;

	case CONSTANTS.EMAIL_TYPES.FORGOT_PASSWORD_EMAIL:
		EmailStatus['Subject'] = CONSTANTS.EMAIL_SUBJECTS.FORGOT_PASSWORD_EMAIL;
		EmailStatus.template = CONSTANTS.EMAIL_CONTENTS.FORGOT_PASSWORD_EMAIL;
		EmailStatus.data['name'] = user.name;
		EmailStatus.data['token'] = user.token;
		break;

	case CONSTANTS.EMAIL_TYPES.ICALENDER_EMAIL:
		EmailStatus['Subject'] = CONSTANTS.EMAIL_SUBJECTS.ICALENDER_EMAIL;
		break;
            
	default:
		EmailStatus['Subject'] = 'Welcome Email!';
		break;
	}
	return EmailStatus;
};
/**
 * function to make email template dynamic.
 */
commonFunctions.renderTemplate = (template, data) => handlebars.compile(template)(data);

/**
 * function to create reset password link.
 */
commonFunctions.createResetPasswordLink = (userData) => {
	const dataForJWT = { ...userData, Date: Date.now };
	const resetPasswordLink = (userData.role === CONSTANTS.AVAILABLE_AUTHS.ADMIN ? CONFIG.ADMIN_URL : CONFIG.CLIENT_URL) + '/auth/reset-password/' + commonFunctions.encryptJwt(dataForJWT, '1h');
	return resetPasswordLink;
};

/**
 * function to generate random otp string
 */
commonFunctions.generateOTP = (length) => {
	const chracters = '0123456789';
	let randomString = '';
	for (let i = length; i > 0; --i) { randomString += chracters[Math.floor(Math.random() * chracters.length)]; }

	return randomString;
};

/**
 * function to returns a random number between min and max (both included)
 */
commonFunctions.getRandomInteger = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Function to generate expiry time in seconds
 */
commonFunctions.generateExpiryTime = (seconds) => new Date(new Date().setSeconds(new Date().getSeconds() + seconds));

/**
 * function to convert seconds in HMS string
 */
commonFunctions.convertSecondsToHMS = (value) => {
	const sec = parseInt(value, 10);
	const hours = Math.floor(sec / 3600);
	const minutes = Math.floor((sec - (hours * 3600)) / 60);
	const seconds = sec - (hours * 3600) - (minutes * 60);
	let str = '';
	if (hours) str = str + hours + (hours > 1 ? ' Hours' : ' Hour');
	if (minutes) str = `${str} ${minutes}${minutes > 1 ? ' Minutes' : ' Minute'}`;
	if (seconds) str = `${str} ${seconds}${seconds > 1 ? ' Seconds' : ' Second'}`;

	return str.trim();
};

/**
 * Variable to create logging
 */
commonFunctions.logger = (() => {
	if (LIVE_LOGGER_ENABLE) {
		return pino({
			browser: {
				transmit: {
					send,
				},
			},
		}, stream);
	}

	if (!fs.existsSync('./error.log')) {
		fs.writeFileSync('./error.log', '');
	}
	return pino(pino.destination('./error.log'));
})();
/**
* function to add time
*/
commonFunctions.addMinutesToDate = (date, minutes) => {
	return new Date(date.getTime() + minutes * 60000);
};

commonFunctions.generateReferralCode = () => {
	let code = '';
	// without zero or 'O'  
	const characters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
	const charactersLength = characters.length;
	for (let i = 0; i < CONSTANTS.REFERRAL_CODE_LENGTH; i++) {
		code += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return code;
};

/** 
 * function to generate random password
 */
commonFunctions.generatePassword = () => {
	const numLc = 4;
	const numUc = 2;
	const numDigits = 2;
	const numSpecial = 1;

	const lowerCaseLetter = 'abcdefghijklmnopqrstuvwxyz';
	const uperCaseLetter = lowerCaseLetter.toUpperCase();
	const numbers = '0123456789';
	const special = '!?=#*$@+-';

	const pass = [];
	for (let i = 0; i < numLc; ++i) { pass.push(commonFunctions.getRandom(lowerCaseLetter)); }
	for (let i = 0; i < numUc; ++i) { pass.push(commonFunctions.getRandom(uperCaseLetter)); }
	for (let i = 0; i < numDigits; ++i) { pass.push(commonFunctions.getRandom(numbers)); }
	for (let i = 0; i < numSpecial; ++i) { pass.push(commonFunctions.getRandom(special)); }

	return commonFunctions.shuffle(pass).join('');

	// let chracters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	// let randomString = '';
	// for (let i = length; i > 0; --i) randomString += chracters[Math.floor(Math.random() * chracters.length)];
	// return randomString;
};

commonFunctions.getRandom = function (values) {
	return values.charAt(Math.floor(Math.random() * values.length));
};

commonFunctions.shuffle = function (o) {
	for (let j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
	return o;
};

commonFunctions.timeStampDiffernceInSeconds = (t1, t2) => {
	const result = Math.floor(Math.abs(+t1 - (+t2)) / 1000);
	return result;
};

/*
* Function to multiply two strings
*/
commonFunctions.multiplyString = (num1, num2) => {
	const len1 = num1.length;
	const len2 = num2.length;
	const res = Array(len1 + len2).fill(0);
	let carry = 0;
	let val = 0;
	let index = 0;

	for (let i = len1 - 1; i >= 0; i--) {
		carry = 0;
		for (let j = len2 - 1; j >= 0; j--) {
			index = len1 + len2 - 2 - i - j;
			val = (num1[i] * num2[j]) + carry + res[index];
			carry = Math.floor(val / 10);
			res[index] = val % 10;
		}
		if (carry) res[index + 1] = carry;
	}

	while (res.length > 1 && res[res.length - 1] === 0) res.pop();

	return res.reverse().join('');
};

/*
Function for encodeing upperCase string to number
*/
commonFunctions.encodeString = (string) => {
	let encodedRefrral = 0;
	for (let i = 0; i < string.length; i++) {
		encodedRefrral *= 100;
		encodedRefrral += string.charCodeAt(i);
	}
	return encodedRefrral;
};

/*
Function for decoding number to upperCase string
*/
commonFunctions.decodeNumberString = (encodedNumber) => {
	const decodedStringLength = encodedNumber.toString().length / 2;
	let output = '';
	let num = encodedNumber;

	for (let i = 0; i < decodedStringLength; i++) {
		const charCode = num / Math.pow(100, decodedStringLength - 1 - i);
		num = num % Math.pow(100, decodedStringLength - 1 - i);
		output += String.fromCharCode(charCode);
	}
	return output;
};

/**
 * Function to get the array of year and month of any table form the database.
 */
commonFunctions.getYearMonthAggregation = (criteria = {}) => {
	return [
	  { $match: criteria },
	  { $group: { _id: { 'year': { '$substr': [ '$createdAt', 0, 4 ] }, 'month': { '$substr': [ '$createdAt', 5, 2 ] } } } },
	  {
			$addFields: {
		  monthName: {
					$let: {
			  vars: {
							monthsInString: [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ],
							month: { $toInt: '$_id.month' }
			  },
			  in: {
							$arrayElemAt: [ '$$monthsInString', '$$month' ]
			  }
					}
		  }
			}
	  },
	  { $project: { monthName: 1, _id: 0, year: '$_id.year', month: '$_id.month' } },
	  { $sort: { year: -1, month: -1 } }
	];
};

commonFunctions.formatNumber = (number) => {
	if (isNaN(number)) {
		return number;
	}
	number = Number(number);
	number = Number.isInteger(number) ? number : number.toFixed(2);
	const localeCode = 'en-US';
	return number.toLocaleString(localeCode);
};


commonFunctions.replaceAll = async (obj, dynamicValues, visited = new Set()) => {
	for (const key in obj) {
	  if (typeof obj[key] === 'object') {
			if (!visited.has(obj[key])) {
		  visited.add(obj[key]);
		  await commonFunctions.replaceAll(obj[key], dynamicValues, visited);
			}
	  } else if (typeof obj[key] === 'string') {
			Object.keys(dynamicValues).forEach((dynamicKey) => {
		  const regex = new RegExp(`{{${dynamicKey}}}`, 'g');
		  obj[key] = obj[key].replace(regex, dynamicValues[dynamicKey]);
			});
	  }
	}
};

commonFunctions.convertToAppropriateUnit = (value) => {
	const numZeros = Math.floor(Math.log10(value));
	if (numZeros >= 6 && numZeros < 9) {
		const result = value / 1000000;
		return Math.round(result) + 'M';
	} else if (numZeros >= 9 && numZeros < 12) {
		const result = value / 1000000000;
		return Math.round(result) + 'B';
	} else if (numZeros >= 12) {
		const result = value / 1000000000000;
		return Math.round(result) + 'T';
	} else {
		return commonFunctions.formatNumber(value);
	}
};

/**
 * Function to hit Third party api's.
 */
commonFunctions.callThirdPartyAPI = {
	post: async ({ API = '', DATA = {}, HEADER = {} }) => {
		return axios.post(API, DATA, { headers: HEADER });
	},
	get: async ({ API = '', PARAMS = {}, HEADER = {}, responseType = 'json' }) => {
		return axios.get(API, { params: PARAMS, headers: HEADER, responseType });
	},
	put: async ({ API = '', DATA = {}, HEADER = {} }) => {
		return axios.put(API, DATA, { headers: HEADER });
	},
	delete: async ({ API = '', DATA = {}, HEADER = {} }) => {
		return axios.delete(API, DATA, { headers: HEADER });
	},
	patch: async ({ API = '', DATA = {}, HEADER = {} }) => {
		return axios.patch(API, DATA, { headers: HEADER });
	}
};

/**
 * Calculates the difference in days between two dates.
 *
 * @param {Date} date1 - The first date.
 * @param {Date} date2 - The second date.
 * @return {number} The difference in days between the two dates.
 */
commonFunctions.differenceInDays = (date1, date2) => {
	// Get the time values in milliseconds
	const time1 = date1.getTime();
	const time2 = date2.getTime();

	// Calculate the difference in milliseconds
	const differenceInMilliseconds = Math.abs(time2 - time1);

	// Convert milliseconds to days (1 day = 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
	const differenceInDays = differenceInMilliseconds / CONSTANTS.MATHEMATICAL.MILLISECONDS_IN_A_DAY;

	return differenceInDays;
};

/**
 * Compare signature and owner's public key.
 *
 * @param {type} signature - The signature to validate.
 * @param {type} publicKey - The public key to compare.
 * @return {boolean} Whether the public key matches the owner's public address.
 */
commonFunctions.validateWallet = (publicKey) => {
	return publicKey === CONFIG.SOLANA.CONTRACT_OWNER_PUBLIC_ADDRESS;
};
commonFunctions.convertUserIdToAuthString = async (objectId) => {
	return crypto.createHash('sha256').update(objectId + Date.now()).digest('hex');
};

// Fetch the latest block hash from Ethereum blockchain
commonFunctions.getBlockHash = async () => {
	try{
		const blocks = await etherscan.proxy.eth_blockNumber();
		const totalBlocks = parseInt(blocks.result, 16);

		const randomBlockNumber = Math.floor(Math.random() * totalBlocks);
		const block = await etherscan.proxy.eth_getBlockByNumber(`0x${randomBlockNumber.toString(16)}`, false);

		const blockHash = block.result.hash;
		const timestamp = new Date().getTime();
		return { blockHash, timestamp, randomBlockNumber };
	} catch(err){
		console.log(err);
	}
};

// Generate a random number using the block hash
commonFunctions.generateRandomNumber = async (limit = 100, blockHash, timestamp) => {
	let blockNumber;
	if (!blockHash) { 
		const latestBlock = await commonFunctions.getBlockHash();
		blockHash = latestBlock.blockHash;
		timestamp = latestBlock.timestamp;
		blockNumber = latestBlock.randomBlockNumber;
	}    
	// Use the block hash as a seed to create a random number
	const hash = crypto.createHash('sha256').update(blockHash + timestamp).digest('hex');
	const randomNumber = parseInt(hash, 16) % limit; // Example: random number between 0 and 99
    
	return { randomNumber, blockHash, timestamp, blockNumber };
};


/**
 * Generates an Ethereum trading wallet with a randomly generated public key and private key.
 *
 * @return {Promise<Object>} An object containing the generated public key and private key.
 */
commonFunctions.generateETHTradingWallet = async () => {
	const wallet = ethers.Wallet.createRandom();
	const publicKey = wallet.address;
	const privateKey = wallet.privateKey;
	return { publicKey, privateKey };
};

/**
 * Generates a Solana trading wallet with a randomly generated public key and base64-encoded private key.
 *
 * @return {Promise<{publicKey: string, privateKey: string}>} An object containing the generated public key and private key.
 */
commonFunctions.generateSolanaTradingWallet = async () => {
	const keypair = Keypair.generate();
	const publicKey = keypair.publicKey.toString();
	const privateKey = Buffer.from(keypair.secretKey).toString('base64');

	return { publicKey, privateKey };
};


module.exports = commonFunctions;
