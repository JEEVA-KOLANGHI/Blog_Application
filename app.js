import express from "express";
import session from "express-session";
import flash from "connect-flash";
import expressLayouts from "express-ejs-layouts";
import methodOverride from "method-override";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import db from "./db.js"; // your MySQL connection module

const app = express();
const port = 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

app.use(session({
  secret: "jeeva-secret",
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

// Test flash
app.get("/test-flash", (req, res) => {
  req.flash("error", "Flash test message");
  res.redirect("/login");
});

// Signup routes
app.get("/signup", (req, res) => res.render("signup"));
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const query = "INSERT INTO users (username, password) VALUES (?, ?)";
  db.query(query, [username, hashed], (err) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        req.flash("error", "Username already exists");
        return res.redirect("/signup");
      }
      req.flash("error", "Signup failed");
      return res.redirect("/signup");
    }
    req.flash("success", "Signup successful! Please login.");
    res.redirect("/login");
  });
});

// Login routes
app.get("/login", (req, res) => res.render("login"));
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err || results.length === 0) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }
    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash("error", "Invalid username or password");
      return res.redirect("/login");
    }
    req.session.user = user;
    req.flash("success", `Welcome back, ${user.username}!`);
    res.redirect("/");
  });
});

app.get("/logout", (req, res) => {
  req.flash("success", "You have been logged out!");
  req.session.destroy(() => {
    res.redirect("/");
  });
});


// Blog CRUD
app.get("/", (req, res) => {
  const q = "SELECT blogs.*, users.username FROM blogs JOIN users ON users.id = blogs.user_id";
  db.query(q, (err, results) => {
    if (err) return res.send("Error fetching blogs");
    res.render("home", { blogs: results });
  });
});
app.get("/blogs", (req, res) => res.redirect("/"));
app.get("/blogs/new", (req, res) => {
  if (!req.session.user) {
    req.flash("error", "Login required");
    return res.redirect("/login");
  }
  res.render("new");
});
app.post("/blogs", (req, res) => {
  if (!req.session.user) return res.send("Unauthorized");
  const { title, content } = req.body;
  db.query("INSERT INTO blogs (title, content, user_id) VALUES (?, ?, ?)",
    [title, content, req.session.user.id], (err) => {
      if (err) return res.send("Error");
      req.flash("success", "Blog created");
      res.redirect("/");
    });
});
app.get("/blogs/:id", (req, res) => {
  db.query("SELECT * FROM blogs WHERE id = ?", [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.send("Not found");
    res.render("show", { blog: results[0] });
  });
});
app.get("/blogs/:id/edit", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  db.query("SELECT * FROM blogs WHERE id = ?", [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.send("Not found");
    const blog = results[0];
    if (blog.user_id !== req.session.user.id) return res.send("Unauthorized");
    res.render("edit", { blog });
  });
});
app.put("/blogs/:id", (req, res) => {
  const { title, content } = req.body;
  db.query("UPDATE blogs SET title=?, content=? WHERE id=?", [title, content, req.params.id], (err) => {
    if (err) return res.send("Error");
    req.flash("success", "Blog updated");
    res.redirect(`/blogs/${req.params.id}`);
  });
});
app.delete("/blogs/:id", (req, res) => {
  db.query("SELECT * FROM blogs WHERE id=?", [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.send("Not found");
    if (results[0].user_id !== req.session.user.id) return res.send("Unauthorized");
    db.query("DELETE FROM blogs WHERE id=?", [req.params.id], (err) => {
      if (err) return res.send("Error");
      req.flash("success", "Blog deleted");
      res.redirect("/");
    });
  });
});

app.listen(port, () => console.log(`Server running on port ${port}`));
