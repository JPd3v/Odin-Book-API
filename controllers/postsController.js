const Posts = require("../models/post");
const { verifyUser } = require("../utils/authenticate");
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const cloudinaryConfig = require("../config/cloudinaryconfig");
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
      .populate({
        path: "comments",
        populate: [
          { path: "creator", select: "_id first_name last_name" },
          {
            path: "replies",
            select: "creator edited likes timestamp content",
            populate: {
              path: "creator",
              select: "_id first_name last_name",
            },
          },
        ],
      });

    return res.status(200).json(posts);
  } catch (error) {
    return res.status(500).json({ message: "something went wrong" });
  }
};

exports.userFeed = [
  verifyUser,
  async (req, res) => {
    const { user } = req;
    try {
      const currentPage = req.query.page - 1;
      const postPerQuery = req.query.pageSize || 5;
      const queryPage = postPerQuery * currentPage;

      const mongoDBQuery = [...user.friend_list, user._id];

      const posts = await Posts.find({ creator: { $in: mongoDBQuery } })
        .sort({
          timestamp: "desc",
        })
        .limit(postPerQuery)
        .skip(queryPage)
        .populate("creator", "_id first_name last_name profile_image")
        .populate({
          path: "comments",
          options: { sort: { timestamp: "desc" } },
          populate: [
            {
              path: "creator",
              select: "_id first_name last_name profile_image",
            },
            {
              path: "replies",
              select: "",
              populate: {
                path: "creator",
                select: "_id first_name last_name profile_image",
              },
            },
          ],
        });

      return res.status(200).json(posts);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.userPosts = [
  verifyUser,
  async (req, res) => {
    const user = req.params.userId;

    try {
      const currentPage = req.query.page - 1;
      const postPerQuery = req.query.pageSize || 5;
      const queryPage = postPerQuery * currentPage;

      const posts = await Posts.find({ creator: user })
        .sort({
          timestamp: "desc",
        })
        .limit(postPerQuery)
        .skip(queryPage)
        .populate("creator", "_id first_name last_name profile_image")
        .populate({
          path: "comments",
          options: { sort: { timestamp: "desc" } },
          populate: [
            {
              path: "creator",
              select: "_id first_name last_name profile_image",
            },
            {
              path: "replies",
              select: "",
              populate: {
                path: "creator",
                select: "_id first_name last_name profile_image",
              },
            },
          ],
        });
      return res.status(200).json(posts);
    } catch (error) {
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
      const uploadToCloudinary = await uploadImages(req.files);

      const images = [];

      uploadToCloudinary.map((image) => {
        const publicUrl = imagePublicUrl(image.public_id);
        return images.push({ public_id: image.public_id, img: publicUrl });
      });

      const newPost = new Posts({
        creator: req.user._id,
        content: { text: req.body.text, images: images },
      });

      async function deleteFIles(files) {
        try {
          await Promise.all(
            files.map(async (file) => await fs.unlink(file.path))
          );
        } catch (error) {
          console.log(error);
        }
      }

      await deleteFIles(req.files);
      const savedPost = await newPost.save();

      return res.status(200).json({ new_post: savedPost });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
  (error, req, res, next) => {
    return res.status(422).json({ message: error.message });
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
        return res.status(404).json({ message: "post not found" });
      }

      if (foundPost.creator.toString() === req.user._id.toString()) {
        foundPost.content.text = req.body.content.text;
        foundPost.edited = true;
        await foundPost.save();

        return res.status(200).json({ edited_post: foundPost });
      }

      return res
        .status(403)
        .json({ message: "you dont have permission to do edit this post" });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
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
        .json({ message: "you dont have permission to do delete this post" });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.postLike = [
  verifyUser,
  async (req, res) => {
    try {
      const foundPost = await Posts.findById(req.params.id);
      if (!foundPost) {
        return res.status(404).json({ message: "post not found" });
      }

      let userLikeIndex = foundPost.likes.findIndex(
        (element) => element.toString() === req.user._id.toString()
      );

      if (userLikeIndex === -1) {
        foundPost.likes.push(req.user._id);
        await foundPost.save();
        return res.status(200).json(foundPost.likes);
      }

      foundPost.likes.splice(userLikeIndex, 1);
      await foundPost.save();

      return res.status(200).json(foundPost.likes);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.getPost = [
  verifyUser,
  async (req, res) => {
    try {
      const foundPost = await Posts.findById(req.params.postId)
        .populate("creator", "_id first_name last_name profile_image")
        .populate({
          path: "comments",
          options: { sort: { timestamp: "desc" } },
          populate: [
            {
              path: "creator",
              select: "_id first_name last_name profile_image",
            },
            {
              path: "replies",
              select: "",
              populate: {
                path: "creator",
                select: "_id first_name last_name profile_image",
              },
            },
          ],
        });
      if (!foundPost) {
        return res.status(404).json({ message: "post not found" });
      }
      return res.status(200).json(foundPost);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];
