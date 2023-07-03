const express = require("express");
const router = express.Router();

const commentsController = require("../controllers/commentsController");
const { commentReplies } = require("../controllers/repliesController");

router.get("/", commentsController.getAllComments);
router.get("/:id", commentsController.getSingleComment);
router.get("/:id/replies", commentReplies);
router.post("/:postId", commentsController.postComment);
router.put("/:id", commentsController.putComment);
router.delete("/:id", commentsController.deleteComment);
router.post("/:id/like", commentsController.postCommentLike);

module.exports = router;
