const express = require("express");
const router = express.Router();

const repliesController = require("../controllers/repliesController");

router.post("/:commentId", repliesController.postReply);
router.put("/:replyId", repliesController.putReply);
router.delete("/:replyId", repliesController.deleteReply);
router.post("/:id/like", repliesController.postReplyLike);

module.exports = router;
