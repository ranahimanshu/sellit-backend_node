'use strict';

/** ******************************
 ********* Import All routes ***********
 ******************************* */
const v1Routes = [
	...require('./serverRoutes'),
	...require('./fileRoutes'),
	...require('./adminRoutes'),
	...require('./userRoutes'),
	...require('./categoryRoutes'),
];

module.exports = v1Routes;
