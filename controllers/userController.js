const User = require("../models/user");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinaryConfig = require("../config/cloudinaryconfig");
const fs = require("node:fs/promises");
const differenceInYears = require("date-fns/differenceInYears");

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
const user = require("../models/user");

exports.postSignUp = [
  body("username", "email must not be empty")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .isEmail()
    .withMessage(
      "email provided not is a valid email address, example of valid email:example@example.com"
    ),
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
    .blacklist(" ")
    .escape(),
  body("last_name", "last name must not be empty")
    .trim()
    .isLength({ min: 1, max: 15 })
    .withMessage("Last name cannot have more than 15 characters ")
    .blacklist(" ")
    .escape(),
  body("gender", "gender must not be empty")
    .trim()
    .isLength({ min: 4 })
    .isIn(["male", "female", "other"])
    .withMessage("gender provided is not valid")
    .escape(),
  body("birthday", "birthday must not be empty")
    .trim()
    .escape()
    .isDate()
    .custom((value) => {
      const todayDate = new Date();
      return differenceInYears(todayDate, new Date(value)) >= 18;
    })
    .withMessage(
      "You need to be at least 18 years old to be allowed for sign up"
    ),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    try {
      const foundUser = await User.findOne({
        username: req.body.username,
      }).exec();
      if (foundUser) {
        return res.status(403).json({ message: "Email already in use" });
      }

      bcrypt.hash(req.body.password, 12, async (error, hashedPassword) => {
        if (error) {
          return res.status(500).json({ message: "something went wrong" });
        }

        const initials = `${req.body.first_name[0]}${req.body.last_name[0]}`;
        const userDefaultImage = `https://api.dicebear.com/5.x/initials/svg?seed=${initials}`;

        const newUser = new User({
          username: req.body.username,
          password: hashedPassword,
          first_name: req.body.first_name,
          last_name: req.body.last_name,
          gender: req.body.gender,
          birthday: req.body.birthday,
          profile_image: { img: userDefaultImage },
        });
        try {
          const savedUser = await newUser.save();

          const refreshToken = getRefreshToken({ _id: savedUser._id });
          const token = getToken({ _id: savedUser._id });

          savedUser.refresh_token = refreshToken;
          await savedUser.save();

          const userInfo = {
            _id: savedUser._id,
            first_name: savedUser.first_name,
            last_name: savedUser.last_name,
            profile_image: savedUser.profile_image.img,
            gender: savedUser.gender,
            email: savedUser.username,
            birthday: savedUser.birthday,
          };

          res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
          return res.status(200).json({ token, userInfo });
        } catch (error) {
          return res.status(500).json({ message: "something went wrong" });
        }
      });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
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
      "email provided not is a valid email address, example of valid email:example@example.com"
    ),
  body("password", "password must not be empty")
    .trim()
    .isLength({ min: 8 })
    .withMessage("password should be at least 8 characters long")
    .escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }
    next();
  },
  passport.authenticate("local", { session: false, failWithError: true }),
  async (req, res) => {
    if (req.body.error) {
      const message = req.body.error;
      return res.status(401).json(message);
    }

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
        email: foundUser.username,
        gender: foundUser.gender,
        birthday: foundUser.birthday,
      };

      res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
      return res.status(200).json({ token, userInfo });
    } catch (error) {
      res.status(500).json({ message: "something went wrong" });
    }
  },
  (err, req, res, next) => {
    return res.status(401).json({ message: "Incorrect username or password" });
  },
];

exports.guestAccount = async (req, res) => {
  try {
    const GUEST_ACCOUNT_ID = "63ed77897c0ba6b3f6fd4ebb";

    const foundGuestAccount = await User.findById(GUEST_ACCOUNT_ID);

    if (!foundGuestAccount) {
      return res
        .status(404)
        .json({ message: "something went wrong try again later" });
    }

    const refreshToken = getRefreshToken({ _id: foundGuestAccount._id });
    const token = getToken({ _id: foundGuestAccount._id });

    foundGuestAccount.refresh_token = refreshToken;
    await foundGuestAccount.save();

    const userInfo = {
      _id: foundGuestAccount._id,
      first_name: foundGuestAccount.first_name,
      last_name: foundGuestAccount.last_name,
      profile_image: foundGuestAccount.profile_image.img,
      email: foundGuestAccount.username,
      gender: foundGuestAccount.gender,
      birthday: foundGuestAccount.birthday,
    };

    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
    return res.status(200).json({ token, userInfo });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "something went wrong try again later" });
  }
};

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
      res.status(500).json({ message: "something went wrong" });
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

      const userInfo = {
        _id: foundUser._id,
        first_name: foundUser.first_name,
        last_name: foundUser.last_name,
        profile_image: foundUser.profile_image.img,
        email: foundUser.username,
        gender: foundUser.gender,
        birthday: foundUser.birthday,
        oAuth_id: foundUser.oAuth_id,
      };

      await foundUser.save();

      res.cookie("refreshToken", newRefreshToken, COOKIE_OPTIONS);
      return res.status(200).json({ token: newToken, userInfo });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  }
  return res.status(401).json({ message: "unauthorized" });
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

      return res.status(200).json(savedImg.url);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
  (error, req, res, next) => {
    return res.status(422).json({ message: error.message });
  },
];

exports.editUserInfo = [
  verifyUser,
  body("username")
    .trim()
    .optional()
    .isLength({ min: 1 })
    .escape()
    .isEmail()
    .withMessage(
      "Email provided not is a valid email address, example of valid email:example@example.com"
    )
    .custom((_value, { req }) => (req.body.confirmUsername ? true : false))
    .withMessage("Confirm new email is required"),
  body("confirmUsername")
    .trim()
    .isLength({ min: 1 })
    .optional()
    .custom((value, { req }) => value === req.body.username)
    .withMessage(
      "Confirm new email and new email field must have the same value"
    )
    .custom(async (value) => {
      try {
        const foundEmail = await User.findOne({ username: value });
        if (foundEmail) {
          return Promise.reject("Email already in use");
        }
        return true;
      } catch (error) {
        return Promise.reject("Something went wrong");
      }
    })
    .escape(),
  body("oldPassword")
    .trim()
    .optional()
    .isLength({ min: 8 })
    .custom(async (value, { req }) => {
      try {
        const passwordVerify = await bcrypt.compare(value, req.user.password);
        if (passwordVerify) {
          return true;
        }
        return Promise.reject("Account current password is incorrect");
      } catch (error) {
        return Promise.reject("Something went wrong");
      }
    })
    .escape(),
  body(
    "password",
    "confirm new password and new password field must have the same value"
  )
    .trim()
    .isLength({ min: 8 })
    .optional()
    .custom((_value, { req }) => (req.body.confirmPassword ? true : false))
    .withMessage("Confirm new password is required")
    .escape(),
  body(
    "confirmPassword",
    "confirm new password and new password field must have the same value"
  )
    .trim()
    .isLength({ min: 8 })
    .optional()
    .custom((value, { req }) => value === req.body.password)
    .custom((value, { req }) => {
      if (!req.body.oldPassword && value) {
        return false;
      }

      return true;
    })
    .withMessage("Old password is required if want to change it")
    .escape(),
  body("first_name", "first name must not be empty")
    .trim()
    .isLength({ min: 1, max: 15 })
    .optional()
    .withMessage("First name cannot have more than 15 characters ")
    .blacklist(" ")
    .escape(),
  body("last_name", "last name must not be empty")
    .trim()
    .optional()
    .isLength({ min: 1, max: 15 })
    .withMessage("Last name cannot have more than 15 characters ")
    .blacklist(" ")
    .escape(),
  body("gender", "gender must not be empty")
    .trim()
    .optional()
    .isLength({ min: 4 })
    .isIn(["male", "female", "other"])
    .withMessage("gender provided is not valid")
    .escape(),
  body("birthday", "birthday must not be empty")
    .trim()
    .optional()
    .escape()
    .isDate()
    .custom((value) => {
      const todayDate = new Date();
      return differenceInYears(todayDate, new Date(value)) >= 18;
    })
    .withMessage("You need to be at least 18 years old"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    const { user, body } = req;

    const editedUser = { ...body };
    delete editedUser.confirmUsername;
    delete editedUser.oldPassword;
    delete editedUser.confirmPassword;

    try {
      const findUser = await User.findById(user._id);

      if (!body.password) {
        const newUser = { ...findUser.toObject(), ...editedUser };

        const updatedUser = await User.findByIdAndUpdate(user._id, newUser, {
          returnDocument: "after",
        }).select(
          "-password -friend_requests -friend_list -creation_date -__v"
        );
        return res.status(200).json(updatedUser);
      }

      bcrypt.hash(body.password, 12, async (error, hashedPassword) => {
        if (error) {
          return res.status(500).json({ message: "something went wrong" });
        }

        editedUser.password = hashedPassword;
        const newUser = { ...findUser.toObject(), ...editedUser };

        const updatedUser = await User.findByIdAndUpdate(user._id, newUser, {
          returnDocument: "after",
        }).select(
          "-password -friend_requests -friend_list -creation_date -__v"
        );

        return res.status(200).json(updatedUser);
      });
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.recommendedFriends = [
  verifyUser,
  async (req, res) => {
    const responseLimit = req.query.pagesize ?? 5;
    try {
      const recommendedFriends = await user
        .find({
          friend_list: { $ne: req.user._id },
          friend_requests: { $ne: req.user._id },
          $and: [
            { _id: { $ne: req.user._id } },
            { _id: { $nin: req.user.friend_requests } },
          ],
        })
        .limit(responseLimit)
        .select("profile_image _id first_name last_name");

      return res.status(200).json(recommendedFriends);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.getUserInfo = [
  verifyUser,
  async (req, res) => {
    const { userId } = req.params;
    try {
      const foundUser = await user
        .findById(userId)
        .select("-creation_date -password -username")
        .populate("friend_list", "_id profile_image  first_name last_name");

      if (!foundUser) {
        return res.status(404).json({ message: "user not found" });
      }

      return res.status(200).json(foundUser);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.userFriendRequests = [
  verifyUser,
  async (req, res) => {
    const userId = req.params.userId;

    try {
      const foundUser = await User.findById(userId)
        .select("friend_requests")
        .populate("friend_requests", "profile_image first_name last_name");
      if (!foundUser) {
        return res.status(404).json({ message: "user not found" });
      }

      const friendRequests = foundUser.friend_requests;

      return res.status(200).json(friendRequests);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];

exports.acceptFriendRequest = [
  verifyUser,
  async (req, res) => {
    const { requestId } = req.params;
    try {
      const foundSenderUser = await User.findById(requestId);
      const foundCurrentUser = await User.findById(req.user._id);

      if (!foundSenderUser) {
        await User.findByIdAndUpdate(req.user._id, {
          $pull: { friend_requests: requestId },
        });
        return res.status(404).json({ error: "User not found" });
      }

      const friendRequestExist =
        foundCurrentUser.friend_requests.includes(requestId);

      if (!friendRequestExist) {
        return res.status(404).json({ error: "Friend request not found" });
      }

      const updatedFriendRequests = foundCurrentUser.friend_requests.filter(
        (element) => element.toString() !== req.params.requestId.toString()
      );

      foundCurrentUser.friend_requests = updatedFriendRequests;
      foundCurrentUser.friend_list.push(requestId);
      foundSenderUser.friend_list.push(req.user._id);

      await foundCurrentUser.save();
      await foundSenderUser.save();

      return res.status(200).json({ message: "friend added succefully" });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  },
];

exports.cancelFriendRequest = [
  verifyUser,
  async (req, res) => {
    const { requestId } = req.params;
    try {
      const foundUser = await User.findById(requestId);

      if (!foundUser) {
        return res.status(404).json({ error: "User not found" });
      }

      await User.findByIdAndUpdate(requestId, {
        $pull: { friend_requests: req.user._id },
      });
      return res
        .status(200)
        .json({ message: "friend request canceled successfully" });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  },
];

exports.declineFriendRequest = [
  verifyUser,
  async (req, res) => {
    if (!req.user.friend_requests.includes(req.params.requestId)) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    try {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { friend_requests: req.params.requestId },
      });
      return res
        .status(200)
        .json({ message: "friend request declined successfully" });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  },
];

exports.deleteFriend = [
  verifyUser,
  async (req, res) => {
    const { requestId } = req.params;
    const currentUserId = req.user._id;
    try {
      const foundSenderUser = await User.findById(requestId);
      const foundCurrentUser = await User.findById(req.user._id);

      if (!foundSenderUser) {
        await User.findByIdAndUpdate(req.user._id, {
          $pull: { friend_list: requestId },
        });
        return res.status(404).json({ error: "User not found" });
      }

      const isFriend = foundCurrentUser.friend_list.includes(requestId);

      if (!isFriend) {
        return res.status(404).json({ error: "Friend not found" });
      }

      await User.findByIdAndUpdate(req.user._id, {
        $pull: { friend_list: requestId },
      });

      await User.findByIdAndUpdate(requestId, {
        $pull: { friend_list: currentUserId },
      });

      return res.status(200).json({ message: "friend deleted succefully" });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  },
];

exports.sendFriendRequest = [
  verifyUser,
  async (req, res) => {
    try {
      const foundReceptor = await User.findById(req.params.userId);
      if (!foundReceptor) {
        return res.status(404).json({ error: "User not found" });
      }

      const userIsAlreadyfriend = foundReceptor.friend_list.includes(
        req.user._id
      );

      const userRequestAlreadyExists = foundReceptor.friend_requests.includes(
        req.user._id
      );

      const userAlreadyHaveRequestFromReceptor =
        req.user.friend_requests.includes(foundReceptor._id);

      if (userIsAlreadyfriend) {
        return res.status(409).json({
          error: "Can't send friend request because users are already friends",
        });
      }

      if (foundReceptor._id.toString() === req.user._id.toString()) {
        return res.status(409).json({
          error: "Can't send friend request to yourself",
        });
      }

      if (userRequestAlreadyExists) {
        return res
          .status(409)
          .json({ error: "User already have a friend request from you" });
      }

      if (userAlreadyHaveRequestFromReceptor) {
        return res.status(409).json({
          error:
            "Can't send friend request because you already have a friend request from this user",
        });
      }

      foundReceptor.friend_requests.unshift(req.user._id);
      await foundReceptor.save();
      return res
        .status(200)
        .json({ message: "Friend request sent successfully" });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  },
];

exports.search = [
  verifyUser,

  async (req, res) => {
    const { query } = req;

    const firstName = query.firstName;
    const lastName = query.lastName;
    const currentPage = query.page - 1;
    const pageSize = query.pageSize || 5;
    const skipPage = pageSize * currentPage;

    const firstNameRegex = new RegExp(`^${firstName}`, "i");
    const LastNameRegex = new RegExp(`^${lastName}`, "i");

    const mongoDBQuery = {};
    firstName ? (mongoDBQuery.first_name = firstNameRegex) : null;
    lastName ? (mongoDBQuery.last_name = LastNameRegex) : null;

    try {
      const foundUsers = await User.find(mongoDBQuery)
        .limit(pageSize)
        .skip(skipPage)
        .select("profile_image _id first_name last_name");

      return res.status(200).json(foundUsers);
    } catch (error) {
      return res.status(500).json({ message: "something went wrong" });
    }
  },
];
