const { Schema, model } = require("mongoose");

const replyLikesSchema = new Schema({
  reply_id: { type: Schema.Types.ObjectId, ref: "Replies", required: true, index: true },
  user_id: { type: Schema.Types.ObjectId, ref: "Users", required: true },
  timestamp: { type: Date, default: Date.now, required: true },
});

module.exports = model("reply_likes", replyLikesSchema);
