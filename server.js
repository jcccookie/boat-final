const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

app.use(cookieParser());
app.enable('trust proxy');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "/views")));

// Routes
const boatRouter = require('./api/boat');
const loadRouter = require('./api/load');
const userRouter = require('./api/user');
const oauthRouter = require('./api/oauth');

app.use('/boats', boatRouter);
app.use('/loads', loadRouter);
app.use('/oauth', oauthRouter);
app.use('/users', userRouter);

// Index page
app.get('/', (req, res, next) => {
  try {
    res.sendFile(path.join(__dirname, '/views/index.html'));
  } catch (error) {
    next(error);
  }
});

// Error handling
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).send({
    Error: err.message
  });
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});