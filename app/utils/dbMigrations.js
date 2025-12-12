/* eslint-disable eqeqeq */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-console */

'use strict';

const MODELS = require('../models');
const CONFIG = require('../../config');
const { hashPassword } = require('../utils/utils');
const CONSTANTS = require('./constants');
const dummyTokensData = require('./dummyData/dummyTokens.json');

const dbMigrations = {};

/**
 * Function to run migrationsfor database based on version number.
 * @returns
 */
dbMigrations.migerateDatabase = async () => {

	let dbVersion = await MODELS.dbVersionModel.findOne({});

	if (! dbVersion) {
		dbVersion = 0;
	}

	if (!dbVersion || dbVersion.version < CONSTANTS.DATABASE_VERSIONS.ONE) {

		await dbMigrations.createAdmin();
		dbVersion = await MODELS.dbVersionModel
			.findOneAndUpdate({}, { version: CONSTANTS.DATABASE_VERSIONS.ONE }, { upsert: true, new: true });
		dbVersion = dbVersion.toJSON();
	} 
};

/**
 * Function to create admin
 * @returns 
 */
dbMigrations.createAdmin = async () => {
	const data = {
		email: CONFIG.ADMIN.EMAIL,
		password: hashPassword(CONFIG.ADMIN.PASSWORD),
		userName: CONFIG.ADMIN.NAME,
	};
	await MODELS.adminModel(data).save();
	return;
};

module.exports = dbMigrations;
