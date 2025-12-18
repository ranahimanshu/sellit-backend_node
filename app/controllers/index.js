'use strict';

/** ******************************
 * Managing all the controllers *
 ********* independently ********
 ******************************* */

module.exports = {
	serverController: require('./serverController'),
	userController: require('./userController'),
	adminController: require('./adminController'),
	fileController: require('./fileController'),
	categoryController: require('./categoryController'),
	adController: require('./adController')
};
