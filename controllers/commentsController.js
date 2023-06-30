const { body, validationResult, param } = require("express-validator");
const Comments = require("../models/comment");
const Posts = require("../models/post");
const { verifyUser } = require("../utils/authenticate");
const commentLikes = require("../models/commentLikes");

exports.getAllComments = async (req, res) => {
  try {
    const allComments = await Comments.find()
      .populate(
        "creator replies",
        "_id first_name last_name creator edited likes timestamp content"
      )
      .populate("likesCount");

    return res.status(200).json(allComments);
  } catch (error) {
    return res.status(500).json({ message: "something went wrong" });
  }
};

exports.getSingleComment = [
  verifyUser,
  param("id").trim().isMongoId().withMessage("id should be a valid mongodb id").escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const commentId = req.params.id;
    try {
      const foundComment = await Comments.findById(commentId)
        .populate("creator", "_id first_name last_name")
        .populate("likesCount");
      if (!foundComment) {
        return res.status(404).json({ message: "comment not found" });
      }

      return res.status(200).json(foundComment);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.postComment = [
  verifyUser,
  param("postId")
    .trim()
    .isMongoId()
    .withMessage("id should be a valid mongodb id")
    .escape(),
  body("comment_text").trim().isLength({ min: 1 }).escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const postId = req.params.postId;
    if (!postId) {
      return res.status(400).json({ message: "postId is required" });
    }

    try {
      const foundPost = await Posts.findById(postId);
      if (!foundPost) {
        return res.status(404).json({ message: "post not found" });
      }

      const newComment = new Comments({
        creator: req.user._id,
        post_id: postId,
        content: { text: req.body.comment_text },
      });

      const savedComment = await (
        await newComment.save()
      ).populate("creator", "_id first_name last_name profile_image");

      return res.status(200).json(savedComment);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.putComment = [
  verifyUser,
  param("id").trim().isMongoId().withMessage("id should be a valid mongodb id").escape(),
  body("content.text").trim().isLength({ min: 1 }).escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    try {
      const foundComment = await Comments.findById(req.params.id);
      if (!foundComment) {
        return res.status(404).json({ message: "comment not found" });
      }

      if (foundComment.creator.toString() === req.user._id.toString()) {
        foundComment.content.text = req.body.content.text;
        foundComment.edited = true;

        const saveEditedComment = await foundComment.save();

        return res.status(200).json({ edited_comment: saveEditedComment });
      }

      return res
        .status(403)
        .json({ message: "you dont have permission to do edit this comment" });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.deleteComment = [
  verifyUser,
  param("id").trim().isMongoId().withMessage("id should be a valid mongodb id").escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const commentId = req.params.id;
    try {
      const foundComment = await Comments.findById(commentId);

      if (!foundComment) {
        return res.status(404).json({ message: "comment not found" });
      }

      if (foundComment.creator.toString() === req.user._id.toString()) {
        await Comments.findByIdAndDelete(commentId);

        return res.status(200).json({ message: "comment deleted succefully" });
      }

      return res.status(403).json({
        message: "you dont have permission to do delete this comment",
      });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.postCommentLike = [
  verifyUser,
  param("id").trim().isMongoId().withMessage("id should be a valid mongodb id").escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const userId = req.user._id;
    const commentId = req.params.id;

    try {
      const foundComment = await Comments.findById(commentId);
      if (!foundComment) {
        return res.status(404).json({ message: "comment not found" });
      }

      const userAlreadyLike = await commentLikes.findOne({
        user_id: userId,
        comment_id: commentId,
      });

      if (!userAlreadyLike) {
        await commentLikes.create({ comment_id: commentId, user_id: userId });
        return res.status(201).json({ message: "Comment like added successfully" });
      }

      await commentLikes.deleteOne({ comment_id: commentId, user_id: userId });
      return res.status(200).json({ message: "Comment like removed successfully" });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];
