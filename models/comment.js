const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Replies = require("./replies");
const commentLikes = require("./commentLikes");

const commentSchema = new Schema(
  {
    creator: { type: Schema.Types.ObjectId, ref: "Users", required: true },
    post_id: { type: String, required: true },
    content: { text: { type: String, required: true } },
    edited: { type: Boolean, required: true, default: false },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

commentSchema.virtual("likesCount", {
  ref: "Comment_likes",
  localField: "_id",
  foreignField: "comment_id",
  count: true,
});

commentSchema.virtual("repliesCount", {
  ref: "Replies",
  localField: "_id",
  foreignField: "comment_id",
  count: true,
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
    await commentLikes.deleteMany({ comment_id: commentId });
  } catch (error) {
    console.log(error);
  }
});

module.exports = mongoose.model("Comments", commentSchema);
