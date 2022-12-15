const Posts = require("../models/post");
const { verifyUser } = require("../utils/authenticate");
const { body, validationResult } = require("express-validator");

exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Posts.find({}).populate(
      "creator",
      "_id first_name last_name"
    );
    return res.status(200).json(posts);
  } catch (error) {
    return res.status(500).json({ error: "something went wrong" });
  }
};

exports.postPost = [
  verifyUser,
  body("content.text", "text cant be empty")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const newPost = new Posts({
      creator: req.user._id,
      content: { text: req.body.content.text },
    });

    try {
      const savedPost = await newPost.save();
      return res.status(200).json({ new_post: savedPost });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  },
];

exports.putPost = [
  verifyUser,
  body("content.text", "text cant be empty")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const postId = req.params.id;

    try {
      const foundPost = await Posts.findById(postId);

      if (!foundPost) {
        return res.status(404).json({ error: "post not found" });
      }

      if (foundPost.creator.toString() === req.user._id.toString()) {
        foundPost.content.text = req.body.content.text;
        foundPost.edited = true;
        await foundPost.save();

        return res.status(200).json({ edited_post: foundPost });
      }

      return res
        .status(403)
        .json({ error: "you dont have permission to do edit this comment" });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  },
];

exports.deletePost = [
  verifyUser,
  async (req, res) => {
    try {
      const foundPost = await Posts.findById(req.params.id);
      if (!foundPost) {
        return res.status(404).json({ message: "post not found" });
      }

      if (foundPost.creator.toString() === req.user._id.toString()) {
        await Posts.findByIdAndDelete(req.params.id);

        return res.status(200).json({ message: "Post deleted successfully" });
      }

      return res
        .status(403)
        .json({ error: "you dont have permission to do delete this comment" });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  },
];
