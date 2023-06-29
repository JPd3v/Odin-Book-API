const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Comments = require("./comment");
const cloudinaryConfig = require("../config/cloudinaryconfig");

const postSchema = new Schema({
  creator: { type: Schema.Types.ObjectId, ref: "Users", required: true },
  content: {
    text: { type: String, required: true },
    images: [{ public_id: { type: String }, img: { type: String } }],
  },
  edited: { type: Boolean, required: true, default: false },
  likes: [{ type: Schema.Types.ObjectId, ref: "Users" }],
  timestamp: { type: Date, required: true, default: Date.now },
});

postSchema.pre("findOneAndDelete", async function () {
  try {
    const post = await this.model.findById(this.getQuery()._id);

    await Promise.all(
      post.content.images.map((image) =>
        cloudinaryConfig.uploader.destroy(image.public_id)
      )
    );

    await Comments.deleteMany({ post_id: post._id });
  } catch (error) {
    console.log(error);
  }
});

module.exports = mongoose.model("Posts", postSchema);
