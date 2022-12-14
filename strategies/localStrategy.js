const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("../models/user");
const bcrypt = require("bcryptjs");

passport.use(
  new LocalStrategy((username, password, done) => {
    User.findOne({ username: username }, (err, user) => {
      if (err) {
        return done(err);
      }
      if (!user) {
        let error = "Incorrect username";
        return done(null, false, { message: "Incorrect username or password" });
      }
      bcrypt.compare(password, user.password, (err, res) => {
        if (res) {
          // passwords match log user in
          return done(null, user);
        } else {
          // passwords do not match
          return done(null, false, {
            message: "Incorrect username or password",
          });
        }
      });
    });
  })
);

module.exports = passport;
