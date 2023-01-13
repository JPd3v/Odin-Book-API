const { verifyUser } = require("../utils/authenticate");
const { body, validationResult } = require("express-validator");
const Comments = require("../models/comment");
const Replies = require("../models/replies");

exports.postReply = [
  verifyUser,
  body("reply_text", "reply text cant be empty")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    try {
      const parentComment = await Comments.findById(req.params.commentId);
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
      ).populate("creator", "_id first_name last_name profile_image");
      parentComment.replies.push(savedNewreply._id);
      await parentComment.save();
      return res.status(200).json(savedNewreply);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.putReply = [
  verifyUser,
  body("reply_text", "reply text cant be empty")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    try {
      const foundReply = await Replies.findById(req.params.replyId);
      if (!foundReply) {
        return res.status(404).json({ message: "reply not found" });
      }

      if (foundReply.creator.toString() === req.user._id.toString()) {
        foundReply.content.text = req.body.reply_text;
        foundReply.edited = true;

        const saveReply = await foundReply.save();
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
  async (req, res) => {
    try {
      const foundReply = await Replies.findById(req.params.replyId);
      if (!foundReply) {
        return res.status(404).json({ message: "reply not found" });
      }

      if (foundReply.creator.toString() === req.user._id.toString()) {
        await Replies.findByIdAndDelete(req.params.replyId);
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
  async (req, res) => {
    try {
      const foundReply = await Replies.findById(req.params.id);
      if (!foundReply) {
        return res.status(404).json({ message: "reply not found" });
      }

      let userLikeIndex = foundReply.likes.findIndex(
        (element) => element.toString() === req.user._id.toString()
      );

      if (userLikeIndex === -1) {
        foundReply.likes.push(req.user._id);
        await foundReply.save();
        return res.status(200).json(foundReply.likes);
      }

      foundReply.likes.splice(userLikeIndex, 1);
      await foundReply.save();

      return res.status(200).json(foundReply.likes);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];
