const mongoose = require("mongoose");
const Posts = require("./post");
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  creator: { type: Schema.Types.ObjectId, ref: "Users", required: true },
  comment_id: { type: String, required: true },
  post_id: { type: String, required: true },
  content: { text: { type: String, required: true } },
  edited: { type: Boolean, required: true, default: false },
  likes: [{ type: Schema.Types.ObjectId, ref: "Users" }],
  timestamp: { type: Date, required: true, default: Date.now },
});

module.exports = mongoose.model("Replies", commentSchema);
