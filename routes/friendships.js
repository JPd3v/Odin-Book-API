const express = require("express");
const router = express.Router();

const friendshipController = require("../controllers/friendshipController");

router.post("/", friendshipController.postFriendshipRequest);
router.put("/:requestId/accept", friendshipController.acceptFriendshipRequest);

module.exports = router;
