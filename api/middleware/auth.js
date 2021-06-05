const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.CLIENT_ID);

// Verify a user's token and return a payload
async function verify(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.CLIENT_ID,  // Specify the CLIENT_ID of the app that accesses the backend
  });

  const payload = ticket.getPayload();
  return payload;
}

// Check if jwt exists
exports.isJwtExist = () => {
  return (req, res, next) => {
    if (!req.headers.authorization) {
      res.status(401).send({
        Error: "Missing JWT"
      });
    } else {
      next();
    }
  };
};

// Check if a token is valid
exports.isTokenValid = () => {
  return async (req, res, next) => {
    // Get the bearer token
    const token = req.headers.authorization.split(" ")[1];

    try {
      const payload = await verify(token);
      req.payload = payload;

      next();
    } catch (error) {
      res.status(401).send({
        Error: "Invalid JWT"
      })
    }
  };
};