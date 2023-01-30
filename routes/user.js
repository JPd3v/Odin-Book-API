const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const friends = require("../controllers/friendshipController");

// User
router.post("/sign-up", userController.postSignUp);
router.post("/log-in", userController.postLogIn);
router.post("/log-out", userController.postLogOut);
router.put("/edit-image", userController.editUserImage);
router.get("/search", userController.search);
router.get("/refresh-token", userController.getRefreshToken);
router.get("/recommended-friends", userController.recommendedFriends);
router.get("/:userId/friends-requests", userController.userFriendRequests);
router.put("/:userId/friends-requests", userController.sendFriendRequest);
router.put(
  "/friend-requests/:requestId/accept",
  userController.acceptFriendRequest
);
router.put(
  "/friend-requests/:requestId/cancel",
  userController.cancelFriendRequest
);
router.put(
  "/friend-requests/:requestId/decline",
  userController.declineFriendRequest
);
router.put("/friend-list/:requestId/delete", userController.deleteFriend);

router.get("/:userId", userController.getUserInfo);

module.exports = router;
