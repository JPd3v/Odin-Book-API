const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DEFAULT_PROFILE_IMG =
  "https://res.cloudinary.com/dvnawerv1/image/upload/v1671863396/obbtgos8csgnzrplinzs.jpg";

const userSchema = new Schema({
  username: { type: String, required: true },
  password: { type: String, required: true, minLength: 8 },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  profile_image: {
    public_id: { type: String },
    img: { type: String, required: true, default: DEFAULT_PROFILE_IMG },
  },
  creation_date: { type: Date, required: true, default: Date.now },
  gender: { type: String, enum: ["male", "female", "other"] },
  birthday: { type: String, required: true },
  refresh_token: { type: String, default: "" },
  friend_requests: [{ type: Schema.Types.ObjectId, ref: "User" }],
  friend_list: [{ type: Schema.Types.ObjectId, ref: "Users" }],
});

userSchema.set("toJSON", {
  transform: function (doc, ret, options) {
    delete ret.refresh_token;
    return ret;
  },
});
module.exports = mongoose.model("Users", userSchema);
