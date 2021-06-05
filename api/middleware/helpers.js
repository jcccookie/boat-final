// Verify Accept in request is application/json
exports.verifyAccept = (type) => {
  return (req, res, next) => {
    if (!req.accepts(type)) {
      res.status(406).send({
        Error: `Server only sends ${type} data`
      })
    } else {
      next();
    }
  };
};

exports.verifyContentType = (type) => {
  return (req, res, next) => {
    if (!req.is(type)) {
      res.status(415).send({
        Error: `Server only accepts ${type} data`
      })
    } else {
      next();
    }
  };
}