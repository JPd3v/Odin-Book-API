const { verifyUser } = require("../utils/authenticate");
const { body, validationResult, param, query } = require("express-validator");
const Comments = require("../models/comment");
const Replies = require("../models/replies");
const repliesLikes = require("../models/repliesLikes");
const { getReplyLikesIds, docIsLikedByUser } = require("../utils/docsHelpers");

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

      const replyObject = savedNewreply.toObject();
      replyObject.isLikedByUser = false;

      return res.status(200).json(replyObject);
    } catch (error) {
      console.log(error);
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

    const userId = req.user._id;
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

        const replyLikeIds = await getReplyLikesIds([saveReply], userId);
        const replyLikedByUser = docIsLikedByUser([saveReply.toObject()], replyLikeIds);

        return res.status(200).json(replyLikedByUser[0]);
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

exports.commentReplies = [
  verifyUser,
  param("id").trim().isMongoId().withMessage("id should be a valid mongodb id").escape(),
  query("page").trim().isInt({ min: 1 }).withMessage("page should be minimum 1").escape(),
  query("pageSize")
    .trim()
    .isInt({ min: 1, max: 100 })
    .withMessage("pageSize should be min 1 and max 100")
    .escape(),
  query("sort")
    .trim()
    .isIn(["asc", "desc"])
    .withMessage("sort should be asc or desc")
    .escape()
    .optional(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const commentId = req.params.id;
    const userId = req.user._id;
    const { page, pageSize, sort } = req.query;
    try {
      const currentPage = page - 1;
      const offset = currentPage * pageSize;
      const pageSort = sort ?? "desc";
      const foundCommentReplies = await Replies.find({ comment_id: commentId })
        .sort({
          timestamp: pageSort,
        })
        .limit(pageSize)
        .skip(offset)
        .populate("likesCount creator", "_id first_name last_name profile_image")
        .lean();

      const replyLikeIds = await getReplyLikesIds(foundCommentReplies, userId);
      const repliesLikedByUser = docIsLikedByUser(foundCommentReplies, replyLikeIds);

      return res.status(200).json(repliesLikedByUser);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];
