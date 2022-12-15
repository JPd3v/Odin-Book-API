const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  creator: { type: Schema.Types.ObjectId, ref: "Users", require: true },
  content: { text: { type: String, required: true } },
  edited: { type: Boolean, required: true, default: false },
  likes: [{ type: Schema.Types.ObjectId, ref: "Users" }],
  timestamp: { type: Date, required: true, default: Date.now },
});

module.exports = mongoose.model("Comments", commentSchema);
