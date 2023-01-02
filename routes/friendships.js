const express = require("express");
const router = express.Router();

const friendshipController = require("../controllers/friendshipController");

router.get("/", friendshipController.getUserFriendships);
router.post("/", friendshipController.postFriendshipRequest);
router.put("/:requestId/accept", friendshipController.acceptFriendshipRequest);
router.put("/:requestId/cancel", friendshipController.cencelFriendshipRequest);
router.put(
  "/:requestId/decline",
  friendshipController.declineFriendshipRequest
);
router.put("/:requestId/delete", friendshipController.deleteFriend);

module.exports = router;
