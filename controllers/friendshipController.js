const { body, validationResult } = require("express-validator");
const { verifyUser } = require("../utils/authenticate");
const Users = require("../models/user");

exports.postFriendshipRequest = [
  verifyUser,
  body("receptor_id", "receptor_id should be 24 characters long")
    .trim()
    .isLength({ min: 24, max: 24 })
    .escape(),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(422).json(errors);
    }

    try {
      const foundReceptor = await Users.findById(req.body.receptor_id);
      if (!foundReceptor) {
        return res.status(404).json({ error: "User not found" });
      }

      const userIsAlreadyfriend = foundReceptor.friend_list.includes(
        req.user._id
      );

      const userRequestAlreadyExists = foundReceptor.friend_requests.includes(
        req.user._id
      );

      if (userIsAlreadyfriend) {
        return res.status(409).json({
          error: "Cant send friend request because users are already friends",
        });
      }

      if (foundReceptor._id.toString() === req.user._id.toString()) {
        return res.status(409).json({
          error: "Cant send friend request to yourself",
        });
      }

      if (!userRequestAlreadyExists) {
        foundReceptor.friend_requests.unshift(req.user._id);
        await foundReceptor.save();
        return res
          .status(200)
          .json({ message: "Friend request sent successfully" });
      }

      return res
        .status(409)
        .json({ error: "User already have a friend request from you" });
    } catch (error) {
      return res.status(500).json({ error: "something went wrong" });
    }
  },
];

exports.acceptFriendshipRequest = [
  verifyUser,
  async (req, res) => {
    const { requestId } = req.params;
    try {
      const foundSenderUser = await Users.findById(requestId);
      const foundCurrentUser = await Users.findById(req.user._id);

      if (!foundSenderUser) {
        await Users.findByIdAndUpdate(req.user._id, {
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

exports.cencelFriendshipRequest = [
  verifyUser,
  async (req, res) => {
    const { requestId } = req.params;
    try {
      const foundUser = await Users.findById(requestId);

      if (!foundUser) {
        return res.status(404).json({ error: "User not found" });
      }

      await Users.findByIdAndUpdate(requestId, {
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

exports.declineFriendshipRequest = [
  verifyUser,
  async (req, res) => {
    if (!req.user.friend_requests.includes(req.params.requestId)) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    try {
      await Users.findByIdAndUpdate(req.user._id, {
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
