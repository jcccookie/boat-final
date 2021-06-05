const { Router } = require('express');
const { ds, getEntityId } = require('../datastore');
const { USER } = require('./config');
const { userResponse } = require('./helpers');
const path = require('path');

const router = new Router();
const datastore = ds();

// User info page containing first, last name and id_token(JWT)
router.get('/info', (req, res, next) => {
  try {
    res.sendFile(path.join(__dirname, '../views/info.html'));
} catch (error) {
    next(error);
  }
});

// Save a user's data who logged in
router.post('/save', async (req, res, next) => {
  try {
    // Save a user's name, unique id (sub), and email address
    // User entity has three properties, name, sub(unique id), and email address
    const { sub } = req.body;

    // Find a user with the same email address in datastore
    const query = datastore
      .createQuery(USER)
      .filter('sub', '=', sub);

    const [users] = await datastore.runQuery(query);
    let key;
    const data = { ...req.body };

    // Check if the user already exist in datastore, 
    if (users.length === 0) {
      key = datastore.key(USER);
    } else {
      key = datastore.key([USER, parseInt(getEntityId(users[0]))]);
    }
    const entity = { key, data };
    await datastore.save(entity);

    res.status(201);
  } catch (error) {
    next(error);
  }
});

// Get all users (unprotected)
router.get('/', async (req, res, next) => {
  try {
    const query = datastore.createQuery(USER);
    const userEntities = await datastore.runQuery(query);
    
    const users = userEntities[0].map(user => {
      return userResponse({
        name: user.name,
        email: user.email,
        sub: user.sub
      })
    });

    const numOfUsers = userEntities[0].length;

    let results = {};
    results.users = users;
    results.count = numOfUsers;

    res.status(200).send(results);
  } catch (error) {
    next(error);
  }
})

module.exports = router;