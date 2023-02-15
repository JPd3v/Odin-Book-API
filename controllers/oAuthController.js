const passport = require("passport");
const { COOKIE_OPTIONS } = require("../utils/authenticate");

exports.facebookAuth = passport.authenticate("facebook");

exports.facebookAuthCb = [
  passport.authenticate("facebook", {
    failureMessage: true,
    session: false,
  }),
  (req, res) => {
    res.cookie("refreshToken", req.user.refresh_token, COOKIE_OPTIONS);
    res.redirect(process.env.FRONTEND_URL);
  },
];
