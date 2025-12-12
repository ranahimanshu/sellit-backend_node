'use strict';

/** *********** Modules ********** */
const MONGOOSE = require('mongoose');

const { Schema } = MONGOOSE;

/** *********** User Model ********** */
const adminSchema = new Schema({
	userName: { type: String },
	email: { type: String },
	password: { type: String },
}, { timestamps: true, versionKey: false, collection: 'admins' });

module.exports = MONGOOSE.model('admins', adminSchema);
