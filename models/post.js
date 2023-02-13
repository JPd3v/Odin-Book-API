const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const postSchema = new Schema({
  creator: { type: Schema.Types.ObjectId, ref: "Users", required: true },
  content: {
    text: { type: String, required: true },
    images: [{ public_id: { type: String }, img: { type: String } }],
  },
  edited: { type: Boolean, required: true, default: false },
  likes: [{ type: Schema.Types.ObjectId, ref: "Users" }],
  timestamp: { type: Date, required: true, default: Date.now },
  comments: [{ type: Schema.Types.ObjectId, ref: "Comments" }],
});

module.exports = mongoose.model("Posts", postSchema);
