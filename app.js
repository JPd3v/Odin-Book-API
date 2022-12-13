require("dotenv").config();
const express = require("express");
const app = express();

app.get("/", (req, res) => res.json({ response: "Hello World" }));

const PORT = 3000;
app.listen(PORT, () => console.log(`server listening in ${PORT}`));
