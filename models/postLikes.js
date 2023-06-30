const { Schema, model } = require("mongoose");

const postLikeSchema = new Schema({
  post_id: {
    type: Schema.Types.ObjectId,
    ref: "Posts",
    required: true,
    index: true,
  },
  user_id: { type: Schema.Types.ObjectId, ref: "Users", required: true },
  timestamp: { type: Date, required: true, default: Date.now },
});

module.exports = model("Post_likes", postLikeSchema);
