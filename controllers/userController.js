const User = require("../models/user");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinaryConfig = require("../config/cloudinaryconfig");
const fs = require("node:fs/promises");

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
  limits: { fileSize: 3000000 }, // 3MB 3000000
});

const {
  COOKIE_OPTIONS,
  getToken,
  getRefreshToken,
  verifyUser,
} = require("../utils/authenticate");

exports.postSignUp = [
  body("username", "email must not be empty")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .isEmail(),
  body("password", "password must not be empty")
    .trim()
    .isLength({ min: 8 })
    .escape(),
  body(
    "confirm_password",
    "confirm password and password field must have the same value"
  )
    .trim()
    .isLength({ min: 8 })
    .custom((value, { req }) => value === req.body.password)
    .escape(),
  body("first_name", "first name must not be empty")
    .trim()
    .isLength({ min: 1, max: 15 })
    .withMessage("First name cannot have more than 15 characters ")
    .escape(),
  body("last_name", "last name must not be empty")
    .trim()
    .isLength({ min: 1, max: 15 })
    .withMessage("Last name cannot have more than 15 characters ")
    .escape(),
  body("gender", "gender must not be empty")
    .trim()
    .isLength({ min: 4 })
    .isIn(["male", "female", "other"])
    .escape(),
  body("birthday", "birthday must not be empty").trim().escape().isDate(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    try {
      const foundUser = await User.findOne({
        username: req.body.username,
      }).exec();
      if (foundUser) {
        return res.status(403).json({ response: "Email already in use" });
      }

      bcrypt.hash(req.body.password, 12, async (error, hashedPassword) => {
        if (error) {
          return res.status(500).json({ error: "something went wrong" });
        }

        const newUser = new User({
          username: req.body.username,
          password: hashedPassword,
          first_name: req.body.first_name,
          last_name: req.body.last_name,
          gender: req.body.gender,
          birthday: req.body.birthday,
        });
        try {
          const savedUser = await newUser.save();

          const refreshToken = getRefreshToken({ _id: savedUser._id });
          const token = getToken({ _id: savedUser._id });

          savedUser.refresh_token = refreshToken;
          await savedUser.save();

          const userInfo = {
            first_name: savedUser.first_name,
            last_name: savedUser.last_name,
          };

          res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
          return res.status(200).json({ token, userInfo });
        } catch (error) {
          return res.status(500).json({ error: "something went wrong" });
        }
      });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  },
];

exports.postLogIn = [
  body("username", "email must not be empty")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .isEmail()
    .withMessage(
      "email provided not is a valid email address,example of valid email:example@example.com"
    ),
  body("password", "password must not be empty")
    .trim()
    .isLength({ min: 8 })
    .withMessage("password should be at least 8 characters long")
    .escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors });
    }
    next();
  },
  passport.authenticate("local", { session: false, failWithError: true }),
  async (req, res) => {
    const refreshToken = getRefreshToken({ _id: req.user._id });
    const token = getToken({ _id: req.user._id });

    try {
      const foundUser = await User.findById(req.user._id);

      foundUser.refresh_token = refreshToken;
      await foundUser.save();

      const userInfo = {
        _id: foundUser._id,
        first_name: foundUser.first_name,
        last_name: foundUser.last_name,
        profile_image: foundUser.profile_image.img,
        friend_list: foundUser.friend_list,
        friend_requests: foundUser.friend_requests,
      };

      res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
      return res.status(200).json({ token, userInfo });
    } catch (error) {
      res.status(500).json({ error });
    }
  },
  (err, req, res, next) => {
    return res.status(401).send({ success: false, message: err });
  },
];

exports.postLogOut = [
  verifyUser,
  async (req, res) => {
    try {
      const foundUser = await User.findById(req.user._id);

      foundUser.refresh_token = "";

      await foundUser.save();

      res.clearCookie("refreshToken", COOKIE_OPTIONS);
      return res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "something went wrong" });
    }
  },
];

exports.getRefreshToken = async (req, res) => {
  const refreshToken = req.signedCookies.refreshToken;

  if (refreshToken) {
    try {
      const payload = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );

      const newToken = getToken({ _id: payload._id });
      const newRefreshToken = getRefreshToken({ _id: payload._id });

      const foundUser = await User.findById(payload._id);
      foundUser.refresh_token = newRefreshToken;

      await foundUser.save();

      res.cookie("refreshToken", newRefreshToken, COOKIE_OPTIONS);
      return res.status(200).json({ token: newToken });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  }
  return res.status(401).json({ error: "unauthorized" });
};
exports.editUserImage = [
  verifyUser,
  upload.single("profile_img"),
  async (req, res) => {
    try {
      const file = req.file;
      const savedImg = await cloudinaryConfig.uploader.upload(file.path);
      await fs.unlink(file.path);
      const saveUser = await User.findByIdAndUpdate(req.user._id, {
        profile_image: { public_id: savedImg.public_id, img: savedImg.url },
      });

      // if users already have a profile image delete old image from cloud storage
      req.user.profile_image.public_id
        ? await cloudinaryConfig.uploader.destroy(
            req.user.profile_image.public_id
          )
        : null;

      return res.status(200).json({ img: saveUser });
    } catch (error) {
      return res.status(500).json({ error: "somethin went wrong" });
    }
  },
  (error, req, res, next) => {
    return res.status(422).json({ error: error.message });
  },
];
