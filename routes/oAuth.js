const express = require("express");
const router = express.Router();

const oAuthController = require("../controllers/oAuthController");

router.get("/auth/facebook", oAuthController.facebookAuth);
router.get("/auth/facebook/callback", oAuthController.facebookAuthCb);

module.exports = router;
