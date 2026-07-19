require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const tutorRoutes = require("./routes/tutor");
const profileRoutes = require("./routes/profile");
const authenticate = require("./middleware/authenticate");
const { seed } = require("./db/seed");

// Ensures the demo institute/student always exist, even on hosts that reset
// the filesystem between restarts (e.g. free-tier Render). Safe to run on
// every boot - it only creates data that isn't already there.
seed();

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);
app.use("/api/tutor", authenticate, tutorRoutes);
app.use("/api/profile", authenticate, profileRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nLearnAI platform running at http://localhost:${PORT}`);
  console.log(`If you haven't already, run "npm run seed" to create a demo institute + student.\n`);
});
