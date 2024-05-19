const { getTotalSalesAndPassengers } = require('./services');
const express = require("express");
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require("mongoose");
const passport = require("passport");
const bodyParser = require("body-parser");
const LocalStrategy = require("passport-local");
const passportLocalMongoose = require("passport-local-mongoose");
const path = require('path');
const User = require("./model/User");
const promClient = require('prom-client');

let app = express();

mongoose.connect("mongodb://127.0.0.1:27017/27017");

app.set('views', path.join(__dirname, 'views'));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/assets'));

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [50, 100, 300, 500, 1000, 3000, 5000]
});
register.registerMetric(httpRequestDurationMicroseconds);

app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : 'unknown', code: res.statusCode });
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use(require("express-session")({
  secret: "Rusty is a dog",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const server = http.createServer(app);
const io = socketIo(server);

const getCurrentDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

let globalSocket = null;

io.on('connection', (socket) => {
  console.log('New client connected');
  globalSocket = socket;

  socket.on('pageLoad', (page) => {
    if (page === 'elkhalijiyah') {
      const today = getCurrentDate();
      getTotalSalesAndPassengers(socket, today, today);
    }
  });

  socket.on('dateRangeChange', (data) => {
    const { startDate, endDate } = data;
    console.log(`Date range selected: ${startDate} to ${endDate}`);
    getTotalSalesAndPassengers(socket, startDate, endDate);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    globalSocket = null;
  });
});

function isLoggedIn(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
}

app.get("/index", isLoggedIn, function (req, res) {
  res.render("index", { username: req.session.user.username });
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.post("/login", async function(req, res) {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (user) {
      const result = req.body.password === user.password;
      if (result) {
        req.session.user = { username: user.username };
        res.render("index", { username: user.username });
      } else {
        res.status(400).json({ error: "Password doesn't match" });
      }
    } else {
      res.status(400).json({ error: "User doesn't exist" });
    }
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.get("/dss", function(req, res) {
  res.render("DSS");
});

app.get("/kpis", function(req, res) {
  res.render("KPIS");
});

app.get("/recommndation", function(req, res) {
  res.render("recommndation");
});

app.get("/", function(req, res) {
  res.render("entercode");
});

app.get("/expectatons", function(req, res) {
  res.render("Expectatons");
});

app.get("/elkhalijiyah", isLoggedIn, function(req, res) {
  res.render("elkhalijiyah");
});

app.get("/logout", function (req, res) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

let port = process.env.PORT || 3088;
server.listen(port, function () {
  console.log("Server Has Started!");
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', function (err) {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', function (reason, p) {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
