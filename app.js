require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();
const mongoDB = process.env.MONGODB_URL;

mongoose.set("strictQuery", false);
mongoose.connect(mongoDB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error"));

app.get("/", (req, res) => res.json({ response: "Hello World" }));

const PORT = 3000;
app.listen(PORT, () => console.log(`server listening in ${PORT}`));
