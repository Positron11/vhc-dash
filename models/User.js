const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const RCV = require("./RCV");

const Schema = mongoose.Schema;

const UserSchema = new Schema({
	approved: { type: Boolean, default: false }, // only approved users can log in
	roles: { type: Array },
	email: { type: String, required: true, unique: true },
	orcid: { type: String, required: true, unique: true },
	phone: { type: String },
	creationComment: { type: String } // comment submitted at registration
}, { timestamps: { createdAt: "created", updatedAt: "updated" } });

// sanitize empty ORCiD values
UserSchema.pre("save", function (next) {
	if (this.orcid === "") this.orcid = undefined;
	next();
});

// deletion cascade
UserSchema.pre("deleteOne", { document: true, query: false }, async function(next) { 
	// delete all RCV ballots cast by user 
	await RCV.updateMany(
		{ "ballots.voter": this._id },
		{ $pull: { ballots: { voter: this._id } } }
	); next();
});

UserSchema.plugin(passportLocalMongoose, {
	// filter query by approved users
	findByUsername: function(model, queryParameters) {
		queryParameters.approved = true;
		return model.findOne(queryParameters);
	}
});

module.exports = mongoose.model("User", UserSchema);