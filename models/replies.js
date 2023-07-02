const mongoose = require("mongoose");
const repliesLikes = require("./repliesLikes");
const Schema = mongoose.Schema;

const replySchema = new Schema(
  {
    creator: { type: Schema.Types.ObjectId, ref: "Users", required: true },
    comment_id: { type: Schema.Types.ObjectId, ref: "Comments", required: true },
    post_id: { type: Schema.Types.ObjectId, ref: "Posts", required: true },
    content: { text: { type: String, required: true } },
    edited: { type: Boolean, required: true, default: false },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

replySchema.virtual("likesCount", {
  localField: "_id",
  foreignField: "reply_id",
  ref: "reply_likes",
  count: true,
});

replySchema.pre("findOneAndDelete", async function () {
  try {
    const replyId = this.getQuery()._id;
    await repliesLikes.deleteMany({ reply_id: replyId });
  } catch (error) {
    console.log(error);
  }
});

module.exports = mongoose.model("Replies", replySchema);
