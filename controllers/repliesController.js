const { verifyUser } = require("../utils/authenticate");
const { body, validationResult, param } = require("express-validator");
const Comments = require("../models/comment");
const Replies = require("../models/replies");
const repliesLikes = require("../models/repliesLikes");

exports.postReply = [
  verifyUser,
  param("commentId")
    .trim()
    .isMongoId()
    .withMessage("commentId should be a valid mongodb id")
    .escape(),
  body("reply_text", "reply text cant be empty").trim().isLength({ min: 1 }).escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const commentId = req.params.commentId;

    try {
      const parentComment = await Comments.findById(commentId);
      if (!parentComment) {
        return res.status(404).json({ message: "comment not found" });
      }
      const newReply = new Replies({
        creator: req.user._id,
        content: { text: req.body.reply_text },
        post_id: parentComment.post_id,
        comment_id: parentComment._id,
      });

      const savedNewreply = await (
        await newReply.save()
      ).populate("creator likesCount", "_id first_name last_name profile_image");

      await parentComment.save();
      return res.status(200).json(savedNewreply);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.putReply = [
  verifyUser,
  param("replyId")
    .trim()
    .isMongoId()
    .withMessage("replyId should be a valid mongodb id")
    .escape(),
  body("content.text", "reply text cant be empty").trim().isLength({ min: 1 }).escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const replyId = req.params.replyId;
    try {
      const foundReply = await Replies.findById(replyId);
      if (!foundReply) {
        return res.status(404).json({ message: "reply not found" });
      }

      if (foundReply.creator.toString() === req.user._id.toString()) {
        foundReply.content.text = req.body.content.text;
        foundReply.edited = true;

        const saveReply = await (
          await foundReply.save()
        ).populate("creator likesCount", "_id first_name last_name profile_image");

        return res.status(200).json({ saved_reply: saveReply });
      }
      return res
        .status(403)
        .json({ message: "you dont have permission to do edit this reply" });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.deleteReply = [
  verifyUser,
  param("replyId")
    .trim()
    .isMongoId()
    .withMessage("replyId should be a valid mongodb id")
    .escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const replyId = req.params.replyId;
    try {
      const foundReply = await Replies.findById(replyId);
      if (!foundReply) {
        return res.status(404).json({ message: "reply not found" });
      }

      if (foundReply.creator.toString() === req.user._id.toString()) {
        await Replies.findByIdAndDelete(replyId);
        await Comments.findByIdAndUpdate(foundReply.comment_id, {
          $pull: { replies: foundReply._id },
        });
        return res.status(200).json({ message: "reply deleted succefully" });
      }

      return res
        .status(403)
        .json({ message: "you dont have permission to do delete this reply" });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.postReplyLike = [
  verifyUser,
  param("id").trim().isMongoId().withMessage("id should be a valid mongodb id").escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const replyId = req.params.id;
    const userId = req.user._id;
    try {
      const foundReply = await Replies.findById(replyId);
      if (!foundReply) {
        return res.status(404).json({ message: "reply not found" });
      }

      const isAlreadyLiked = await repliesLikes.findOne({
        reply_id: replyId,
        user_id: userId,
      });

      if (!isAlreadyLiked) {
        await repliesLikes.create({ reply_id: replyId, user_id: userId });

        return res.status(200).json({ message: "Reply like added successfully" });
      }

      await repliesLikes.deleteOne({ reply_id: replyId, user_id: userId });

      return res.status(200).json({ message: "Reply like deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];
