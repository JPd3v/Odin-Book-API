require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");

require("./strategies/JwtStrategy");
require("./strategies/LocalStrategy");

//cors configuarion
const whitelist = process.env.WHITELISTED_ORIGINS
  ? process.env.WHITELISTED_ORIGINS
  : [];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,PUT,POST,DELETE",
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));

app.use(bodyParser.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

// mongoDB config
const mongoDB = process.env.MONGODB_URL;
mongoose.set("strictQuery", false);
mongoose.connect(mongoDB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error"));

// Routes
const userRoutes = require("./routes/user");
const postsRoutes = require("./routes/posts");
const commentsRoutes = require("./routes/comment");
const repliesRoutes = require("./routes/replies");
const friendshipsRoutes = require("./routes/friendships");

app.use("/users", userRoutes);
app.use("/posts", postsRoutes);
app.use("/comments", commentsRoutes);
app.use("/replies", repliesRoutes);
app.use("/friendships", friendshipsRoutes);

const PORT = 3000;
app.listen(PORT, () => console.log(`server listening in ${PORT}`));
