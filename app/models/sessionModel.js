'use strict';

/** *********** Modules ********** */
const MONGOOSE = require('mongoose');

const { Schema } = MONGOOSE;
const { TOKEN_TYPES } = require('../utils/constants');

// NOTE: this model is uses for development only( not live and staging server)
/** *********** User Session Model ********** */
const sessionSchema = new Schema({
	userId: { type: Schema.Types.ObjectId, ref: 'users' },
	tokenType: { type: Number, default: TOKEN_TYPES.LOGIN },
	token: { type: String },
	mobileOTP: { type: String },
	emailOTP: { type: String },
	tokenExpDate: { type: Date }
}, { timestamps: true, versionKey: false });

module.exports = MONGOOSE.model('session', sessionSchema);
