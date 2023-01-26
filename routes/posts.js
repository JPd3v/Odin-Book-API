const express = require("express");
const router = express.Router();

const postsController = require("../controllers/postsController");

router.get("/", postsController.getAllPosts);
router.get("/user-feed", postsController.userFeed);
router.get("/:userId/user-posts", postsController.userPosts);
router.post("/", postsController.postPost);
router.post("/:id/like", postsController.postLike);
router.put("/:id", postsController.putPost);
router.delete("/:id", postsController.deletePost);

module.exports = router;
