const { Schema, model } = require("mongoose");

const commentLikeSchema = new Schema({
  comment_id: {
    type: Schema.Types.ObjectId,
    ref: "Comments",
    required: true,
    index: true,
  },
  user_id: { type: Schema.Types.ObjectId, ref: "Users", required: true },
  timestamp: { type: Date, required: true, default: Date.now },
});

module.exports = model("Comment_likes", commentLikeSchema);
