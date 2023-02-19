const passport = require("passport");
const FacebookStrategy = require("passport-facebook");
const User = require("../models/user");
const { getRefreshToken } = require("../utils/authenticate");

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.HOST_URL_BACKEND_FACEBOOK_REDIRECT,
    },
    async function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      try {
        const foundUser = await User.findOne({ oAuth_id: profile.id });

        if (!foundUser) {
          const arrayName = profile.displayName.split(" ");
          const firstName = arrayName[0];
          const lastName = arrayName[1];

          const initials = `${firstName[0]}${lastName[0]}`;
          const userDefaultImage = `https://api.dicebear.com/5.x/initials/svg?seed=${initials}`;

          const newUser = new User({
            first_name: firstName,
            last_name: lastName,
            profile_image: { img: userDefaultImage },
            oAuth_id: profile.id,
          });
          const savedUser = await newUser.save();

          const refreshToken = getRefreshToken({ _id: savedUser._id });
          savedUser.refresh_token = refreshToken;
          await savedUser.save();

          return cb(null, savedUser);
        }

        const refreshToken = getRefreshToken({ _id: foundUser._id });
        foundUser.refresh_token = refreshToken;
        await foundUser.save();
        return cb(null, foundUser);
      } catch (error) {
        return cb(error, null);
      }
    }
  )
);
