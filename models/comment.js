const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Replies = require("./replies");

const commentSchema = new Schema({
  creator: { type: Schema.Types.ObjectId, ref: "Users", required: true },
  post_id: { type: String, required: true },
  content: { text: { type: String, required: true } },
  edited: { type: Boolean, required: true, default: false },
  likes: [{ type: Schema.Types.ObjectId, ref: "Users" }],
  replies: [{ type: Schema.Types.ObjectId, ref: "Replies" }],
  timestamp: { type: Date, required: true, default: Date.now },
});

commentSchema.pre("deleteMany", async function () {
  try {
    const postId = this.getQuery().post_id;
    await Replies.deleteMany({ post_id: postId });
  } catch (error) {
    console.log(error);
  }
});

commentSchema.pre("findOneAndDelete", async function () {
  try {
    const commentId = this.getQuery()._id;
    await Replies.deleteMany({ comment_id: commentId });
  } catch (error) {
    console.log(error);
  }
});

module.exports = mongoose.model("Comments", commentSchema);
