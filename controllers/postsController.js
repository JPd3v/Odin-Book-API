const Posts = require("../models/post");
const { verifyUser } = require("../utils/authenticate");
const { body, validationResult, param, query } = require("express-validator");
const multer = require("multer");
const cloudinaryConfig = require("../config/cloudinaryconfig");
const postLikes = require("../models/postLikes");
const { docIsLikedByUser, getPostsLikesIds } = require("../utils/docsHelpers");
const fs = require("fs").promises;

const upload = multer({
  dest: "./tmp",
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype == "image/png" ||
      file.mimetype == "image/jpg" ||
      file.mimetype == "image/jpeg"
    ) {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error("Only .png, .jpg and .jpeg format allowed"));
    }
  },
});

exports.getAllPosts = async (req, res) => {
  try {
    const posts = await Posts.find({})
      .populate("creator", "_id first_name last_name")
      .populate("likesCount commentCount")
      .lean();

    return res.status(200).json(posts);
  } catch (error) {
    return res.status(500).json({ message: "something went wrong" });
  }
};

exports.userFeed = [
  verifyUser,
  query("page").trim().isInt({ min: 1 }).withMessage("page should be minimum 1").escape(),
  query("pageSize")
    .trim()
    .isInt({ min: 1, max: 100 })
    .withMessage("pageSize should be min 1 and max 100")
    .escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const { user } = req;
    const { page, pageSize } = req.query;
    try {
      const currentPage = page - 1;
      const postPerQuery = pageSize;
      const queryPage = postPerQuery * currentPage;

      const mongoDBQuery = [...user.friend_list, user._id];

      const posts = await Posts.find({ creator: { $in: mongoDBQuery } })
        .sort({
          timestamp: "desc",
        })
        .limit(postPerQuery)
        .skip(queryPage)
        .populate("creator", "_id first_name last_name profile_image")
        .populate("likesCount commentCount")
        .lean();

      const foundLikes = await getPostsLikesIds(posts, user._id);

      const updatedPosts = docIsLikedByUser(posts, foundLikes);

      return res.status(200).json(updatedPosts);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.userPosts = [
  verifyUser,
  param("userId")
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
    .escape()
    .optional(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const user = req.params.userId;
    const { page, pageSize, sort } = req.query;
    const currentUserId = req.user._id;

    try {
      const currentPage = page - 1;
      const postPerQuery = pageSize;
      const queryPage = postPerQuery * currentPage;
      const pageSort = sort ?? "desc";

      const posts = await Posts.find({ creator: user })
        .sort({
          timestamp: pageSort,
        })
        .limit(postPerQuery)
        .skip(queryPage)
        .populate("creator", "_id first_name last_name profile_image")
        .populate("likesCount commentCount")
        .lean();

      const foundLikes = await getPostsLikesIds(posts, currentUserId);

      const updatedPosts = docIsLikedByUser(posts, foundLikes);

      return res.status(200).json(updatedPosts);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.postPost = [
  verifyUser,
  upload.any(),
  body("text", "text cant be empty").trim().isLength({ min: 1 }).escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    function uploadImage(image) {
      return cloudinaryConfig.uploader.upload(image.path);
    }

    function uploadImages(images) {
      let promises = [];
      images.map((image) => {
        promises.push(uploadImage(image));
      });
      return Promise.all(promises);
    }

    function imagePublicUrl(publicId) {
      const result = cloudinaryConfig.url(publicId, {
        quality: "auto",
        fetch_format: "auto",
      });
      return result;
    }
    try {
      const uploadToCloudinary = await uploadImages(req.files ?? []);

      const images = [];

      uploadToCloudinary.map((image) => {
        const publicUrl = imagePublicUrl(image.public_id);
        return images.push({ public_id: image.public_id, img: publicUrl });
      });

      const newPost = new Posts({
        creator: req.user._id,
        content: { text: req.body.text, images: images },
      });

      async function deleteFiles(files) {
        try {
          await Promise.all(files.map(async (file) => await fs.unlink(file.path)));
        } catch (error) {
          console.log(error);
        }
      }

      await deleteFiles(req.files);
      const savedPost = await (
        await newPost.save()
      ).populate(
        "likesCount commentCount creator",
        "_id first_name last_name profile_image"
      );

      const postObject = savedPost.toObject();
      postObject.isLikedByUser = false;

      return res.status(200).json({ new_post: postObject });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "something went wrong" });
    }
  },
  (error, req, res, next) => {
    return res.status(422).json({ message: error.message });
  },
];

exports.putPost = [
  verifyUser,
  body("content.text", "text cant be empty").trim().isLength({ min: 1 }).escape(),
  param("id").trim().isMongoId().withMessage("id should be a valid mongodb id").escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const postId = req.params.id;
    const userId = req.user._id;

    try {
      const foundPost = await Posts.findById(postId);

      if (!foundPost) {
        return res.status(404).json({ message: "post not found" });
      }

      if (foundPost.creator.toString() === userId.toString()) {
        foundPost.content.text = req.body.content.text;
        foundPost.edited = true;
        const savedEditedpost = await (
          await foundPost.save()
        ).populate(
          "likesCount commentCount creator",
          "_id first_name last_name profile_image"
        );

        const foundLikes = await getPostsLikesIds([savedEditedpost], userId);

        const updatedPosts = docIsLikedByUser([savedEditedpost.toObject()], foundLikes);

        return res.status(200).json(updatedPosts[0]);
      }

      return res
        .status(403)
        .json({ message: "you dont have permission to edit this post" });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.deletePost = [
  verifyUser,
  param("id").trim().isMongoId().withMessage("id should be a valid mongodb id").escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const postId = req.params.id;

    try {
      const foundPost = await Posts.findById(postId);
      if (!foundPost) {
        return res.status(404).json({ message: "post not found" });
      }

      if (foundPost.creator.toString() === req.user._id.toString()) {
        await Posts.findByIdAndDelete(postId);

        return res.status(200).json({ message: "Post deleted successfully" });
      }

      return res
        .status(403)
        .json({ message: "you dont have permission to do delete this post" });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.postLike = [
  verifyUser,
  param("id").trim().isMongoId().withMessage("id should be a valid mongodb id").escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const userId = req.user._id;
    const postId = req.params.id;

    try {
      const foundPost = await Posts.findById(postId);

      if (!foundPost) {
        return res.status(404).json({ message: "Post not found" });
      }

      const userAlreadyLiked = await postLikes.findOne({
        post_id: postId,
        user_id: userId,
      });

      if (!userAlreadyLiked) {
        await postLikes.create({ post_id: postId, user_id: userId });
        return res.status(201).json({ message: "Post like added successfully" });
      }

      await postLikes.deleteOne({ post_id: postId, user_id: userId });

      return res.status(200).json({ message: "Post like deleted successfully" });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.getPost = [
  verifyUser,
  param("postId")
    .trim()
    .isMongoId()
    .withMessage("postId should be a valid mongodb id")
    .escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    try {
      const foundPost = await Posts.findById(req.params.postId)
        .populate("creator", "_id first_name last_name profile_image")
        .populate("likesCount commentCount");

      if (!foundPost) {
        return res.status(404).json({ message: "post not found" });
      }
      return res.status(200).json(foundPost);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];
