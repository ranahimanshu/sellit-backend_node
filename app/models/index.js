'use strict';

/** ******************************
 **** Managing all the models ***
 ********* independently ********
 ******************************* */
module.exports = {
	sessionModel: require('./sessionModel'),
	userModel: require('./userModel'),
	dbVersionModel: require('./dbVersionModel'),
	adminModel: require('./adminModel'),
	filesModel: require('./filesModel'),
	categoryModel: require('./categoryModel'),
	adModel: require('./adModel')
};
