require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

require("./strategies/JwtStrategy");
require("./strategies/LocalStrategy");

const app = express();

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

app.get("/", (req, res) => res.json({ response: "Hello World" }));
app.use("/users", userRoutes);

const PORT = 3000;
app.listen(PORT, () => console.log(`server listening in ${PORT}`));
