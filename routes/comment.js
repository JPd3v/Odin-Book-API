const express = require("express");
const router = express.Router();

const commentsController = require("../controllers/commentsController");

router.get("/", commentsController.getAllComments);
router.get("/:id", commentsController.getSingleComment);
router.post("/:postId", commentsController.postComment);
router.put("/:id", commentsController.putComment);
router.delete("/:id", commentsController.deleteComment);
router.post("/:id/like", commentsController.postCommentLike);

module.exports = router;
