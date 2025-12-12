'use strict';

/************* Modules ***********/
const MONGOOSE = require('mongoose');
const Schema = MONGOOSE.Schema;
// const { USER_TYPE, USER_PLAYING_SPEED, USER_STATUS } = require('../utils/constants');

/************* User Model ***********/
const userSchema = new Schema({

	mobileNumber: { type: String },
	email: { type: String },
	username: { type: String, unique: true, sparse: true },
	password: { type: String },
	isEmailVerified: { type: Boolean, default: false },
	isDeleted: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false, collection: 'users' });

module.exports = MONGOOSE.model('users', userSchema);