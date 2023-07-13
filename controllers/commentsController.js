const { body, validationResult, param, query } = require("express-validator");
const Comments = require("../models/comment");
const Posts = require("../models/post");
const { verifyUser } = require("../utils/authenticate");
const commentLikes = require("../models/commentLikes");
const { docIsLikedByUser, getCommentLikesIds } = require("../utils/docsHelpers");

exports.getAllComments = async (req, res) => {
  try {
    const allComments = await Comments.find().populate(
      "creator likesCount repliesCount",
      "_id first_name last_name profile_image"
    );

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
      const foundComment = await Comments.findById(commentId).populate(
        "creator likesCount repliesCount",
        "_id first_name last_name profile_image"
      );

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
    const userId = req.user._id;

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
      ).populate(
        "creator likesCount repliesCount",
        "_id first_name last_name profile_image"
      );
      const postObject = savedComment.toObject();
      postObject.isLikedByUser = false;

      return res.status(200).json(postObject);
    } catch (error) {
      console.log(error);
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
      const userId = req.user._id;

      const foundComment = await Comments.findById(req.params.id);
      if (!foundComment) {
        return res.status(404).json({ message: "comment not found" });
      }

      if (foundComment.creator.toString() === req.user._id.toString()) {
        foundComment.content.text = req.body.content.text;
        foundComment.edited = true;

        const saveEditedComment = await (
          await foundComment.save()
        ).populate(
          "creator likesCount repliesCount",
          "_id first_name last_name profile_image"
        );

        const foundLikes = await getCommentLikesIds([saveEditedComment], userId);
        const commentWithIsLiked = docIsLikedByUser(
          [saveEditedComment.toObject()],
          foundLikes
        );

        return res.status(200).json(commentWithIsLiked[0]);
      }

      return res
        .status(403)
        .json({ message: "you dont have permission to do edit this comment" });
    } catch (error) {
      console.log(error);
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

exports.postComments = [
  verifyUser,
  param("postId")
    .trim()
    .isMongoId()
    .withMessage("id should be a valid mongodb id")
    .escape(),
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
    .escape(),

  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const { page, pageSize, sort } = req.query;
    const { postId } = req.params;
    const userId = req.user._id;

    const currentPage = page - 1;
    const offset = currentPage * pageSize;

    try {
      const foundComments = await Comments.find({ post_id: postId })
        .sort({
          timestamp: sort,
        })
        .limit(pageSize)
        .skip(offset)
        .populate("likesCount repliesCount")
        .populate("creator", "_id first_name last_name profile_image")
        .lean();

      const foundLikes = await getCommentLikesIds(foundComments, userId);
      const commentWithIsLiked = docIsLikedByUser(foundComments, foundLikes);

      return res.status(200).json(commentWithIsLiked);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];
