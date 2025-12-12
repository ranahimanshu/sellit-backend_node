'use strict';
/************* Modules ***********/
const MONGOOSE = require('mongoose');
const Schema = MONGOOSE.Schema;
/**************************************************
 ************* Files Model or collection ***********
 **************************************************/
const filesSchema = new Schema(
	{
		title: { type: String },
		alt: { type: String },
		fileName: { type: String },
		fileURL: { type: String },
	},
	{ versionKey: false }
);

filesSchema.set('timestamps', true);

module.exports = MONGOOSE.model('files', filesSchema);
