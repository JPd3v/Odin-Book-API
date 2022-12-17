const express = require("express");
const router = express.Router();

const postsController = require("../controllers/postsController");

router.get("/", postsController.getAllPosts);
router.post("/", postsController.postPost);
router.put("/:id", postsController.putPost);
router.delete("/:id", postsController.deletePost);
router.post("/:id/like", postsController.postLike);

module.exports = router;
