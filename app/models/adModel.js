'use strict';

/************* Modules ***********/
const MONGOOSE = require('mongoose');
const Schema = MONGOOSE.Schema;

/************* Ad Model ***********/
const adSchema = new Schema({
	userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
	categoryId: { type: Schema.Types.ObjectId, ref: 'categories', required: true },
	title: { type: String, required: true },
	description: { type: String },
	price: { type: Number, required: true },
	transactionType: { type: Number, default: 1 }, // 1: sell, 2: buy, 3: given_away
	images: [{ type: String }], // Array of image URLs
	location: {
		zipCode: { type: String },
		city: { type: String },
		state: { type: String },
		country: { type: String, default: 'Sweden' },
		coordinates: {
			latitude: { type: Number },
			longitude: { type: Number }
		}
	},
	contactInfo: {
		showProfile: { type: Boolean, default: true }, // Show profile picture and link
		phone: { type: String },
		email: { type: String }
	},
	status: { type: Number, default: 1 }, // 1: pending (after content moderation, waiting for admin), 2: reject (admin rejected), 3: approved (admin approved)
	rejectionReason: { type: String, default: null }, // Reason for rejection (from content moderation or admin)
	views: { type: Number, default: 0 },
	isDeleted: { type: Boolean, default: false },
	expiresAt: { type: Date }, // Optional expiration date
	featured: { type: Boolean, default: false }, // Featured ads
	tags: [{ type: String }] // Tags for better search
}, { timestamps: true, versionKey: false, collection: 'ads' });

// Create indexes for better query performance
adSchema.index({ userId: 1, isDeleted: 1 });
adSchema.index({ categoryId: 1, isDeleted: 1, status: 1 });
adSchema.index({ status: 1, isDeleted: 1 });
adSchema.index({ title: 'text', description: 'text', tags: 'text' }); // Text search index
adSchema.index({ price: 1 });
adSchema.index({ createdAt: -1 });
adSchema.index({ featured: -1, createdAt: -1 }); // For featured ads sorting

module.exports = MONGOOSE.model('ads', adSchema);

