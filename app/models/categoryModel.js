'use strict';

/************* Modules ***********/
const MONGOOSE = require('mongoose');
const Schema = MONGOOSE.Schema;

/************* Category Model ***********/
const categorySchema = new Schema({
	name: { type: String, required: true },
	icon: { type: String }, // URL or path to icon image
	description: { type: String }, // Optional description
	slug: { type: String, unique: true, sparse: true }, // URL-friendly name
	parentCategory: { type: Schema.Types.ObjectId, ref: 'categories', default: null }, // For subcategories
	order: { type: Number, default: 0 }, // For sorting/ordering categories
	isActive: { type: Boolean, default: true }, // To enable/disable category
	isDeleted: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false, collection: 'categories' });

// Create index for better query performance
categorySchema.index({ parentCategory: 1, isDeleted: 1 });
categorySchema.index({ slug: 1 });

module.exports = MONGOOSE.model('categories', categorySchema);

