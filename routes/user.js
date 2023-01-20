const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");

router.post("/sign-up", userController.postSignUp);
router.post("/log-in", userController.postLogIn);
router.post("/log-out", userController.postLogOut);
router.get("/refresh-token", userController.getRefreshToken);
router.put("/edit-image", userController.editUserImage);
router.get("/recommended-friends", userController.recommendedFriends);

module.exports = router;
