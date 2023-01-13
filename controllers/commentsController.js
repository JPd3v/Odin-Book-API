const { body, validationResult } = require("express-validator");
const Comments = require("../models/comment");
const Posts = require("../models/post");
const { verifyUser } = require("../utils/authenticate");

exports.getAllComments = async (req, res) => {
  try {
    const allComments = await Comments.find()
      .populate(
        "creator replies",
        "_id first_name last_name creator edited likes timestamp content"
      )
      .populate({
        path: "replies",
        populate: {
          path: "creator",
          select: "",
        },
      });

    return res.status(200).json(allComments);
  } catch (error) {
    return res.status(500).json({ message: "something went wrong" });
  }
};

exports.getSingleComment = async (req, res) => {
  try {
    const foundComment = await Comments.findById(req.params.id).populate(
      "creator",
      "_id first_name last_name"
    );
    if (!foundComment) {
      return res.status(404).json({ message: "comment not found" });
    }

    return res.status(200).json(foundComment);
  } catch (error) {
    return res.status(500).json({ message: "something went wrong" });
  }
};

exports.postComment = [
  verifyUser,
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
      const newComment = new Comments({
        creator: req.user._id,
        post_id: postId,
        content: { text: req.body.comment_text },
      });

      const foundPost = await Posts.findById(postId);
      if (!foundPost) {
        return res.status(404).json({ message: "post not found" });
      }
      const savedComment = await (
        await newComment.save()
      ).populate("creator", "_id first_name last_name profile_image");

      foundPost.comments.push(savedComment._id);
      await foundPost.save();

      return res.status(200).json(savedComment);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.putComment = [
  verifyUser,
  body("comment_text").trim().isLength({ min: 1 }).escape(),
  async (req, res) => {
    try {
      const foundComment = await Comments.findById(req.params.id);
      if (!foundComment) {
        return res.status(404).json({ message: "comment not found" });
      }

      if (foundComment.creator.toString() === req.user._id.toString()) {
        foundComment.content.text = req.body.comment_text;
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
  async (req, res) => {
    const commentId = req.params.id;
    try {
      const foundComment = await Comments.findById(commentId);

      if (!foundComment) {
        return res.status(404).json({ message: "comment not found" });
      }

      if (foundComment.creator.toString() === req.user._id.toString()) {
        await Comments.findByIdAndDelete(commentId);

        await Posts.findByIdAndUpdate(foundComment.post_id, {
          $pull: { comments: commentId },
        });

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
  async (req, res) => {
    try {
      const foundComment = await Comments.findById(req.params.id);
      if (!foundComment) {
        return res.status(404).json({ message: "comment not found" });
      }

      let userLikeIndex = foundComment.likes.findIndex(
        (element) => element.toString() === req.user._id.toString()
      );

      if (userLikeIndex === -1) {
        foundComment.likes.push(req.user._id);
        await foundComment.save();
        return res.status(200).json(foundComment.likes);
      }

      foundComment.likes.splice(userLikeIndex, 1);
      await foundComment.save();

      return res.status(200).json(foundComment.likes);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];
