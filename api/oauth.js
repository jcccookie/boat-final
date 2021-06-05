const { Router } = require('express');
const path = require('path');

const router = new Router();

router.get('/', async (req, res, next) => {
  try {
    if (req.query.state !== req.cookies.sid) {
      res.sendFile(path.join(__dirname, '../views/error.html'));
    } else {
      const options = {
        expire: Date.now() + 3600000,
        httpOnly: false,
        encode: String
      };

      res.cookie("state", req.query.state, options);
      res.cookie("code", req.query.code, options);

      res.redirect(`/users/info`);
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;