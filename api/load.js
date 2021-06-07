const { Router } = require('express');
const { ds, getEntityId, getEntityKind } = require('../datastore');
const { BOAT, LOAD } = require('./config');
const dotenv = require('dotenv');
const moment = require('moment');

const { throwError,  loadResponse, createCarrierSelf } = require('./helpers');
const { verifyAccept, verifyContentType } = require('./middleware/helpers');

const router = new Router();
const datastore = ds();
dotenv.config();
const url = process.env.APP_URL;

// Create a new load
router.post(
  '/',
  verifyAccept("application/json"),
  verifyContentType("application/json"),
  async (req, res, next) => {
    try {
      // Creation date
      const today = moment().format('L');

      const key = datastore.key(LOAD);
      const data = {
        ...req.body,
        creation_date: today
      };

      // Save load to datastore
      const entity = { key, data };
      await datastore.save(entity);

      const load = await datastore.get(key);

      const id = getEntityId(load[0]);
      const { volume, content, creation_date, public } = load[0];

      res
        .status(201)
        .send(loadResponse({ id, volume, content, creation_date, public }));
    } catch (error) {
      next(error);
    }
  }
)

// Get a load
router.get(
  '/:load_id/users/:user_id',
  verifyAccept("application/json"),
  async (req, res, next) => {
    try {
      const key = datastore.key([LOAD, parseInt(req.params.load_id)]);

      const loadEntity = await datastore.get(key);

      // Check if the load exists
      if (loadEntity[0] === undefined) {
        throwError({
          code: 404,
          message: "No load with this load_id exists"
        })
      }

      const load = loadEntity[0];
      
      if (load.carrier) {
        // If carrier exists, check if owner of the carrier is matched with the user
        
        const userId = req.params.user_id; // user's unique id (sub)
        const carrierId = load.carrier.id; // boat id

        // Get carrier's owner
        const boatKey = datastore.key([BOAT, parseInt(carrierId)]);
        const boatEntity = await datastore.get(boatKey);

        // User and boat's owner are not matched
        if (boatEntity[0].owner !== userId) {
          throwError({
            code: 401,
            message: "You are not allowed to access to this load"
          })
        }
      }

      const id = getEntityId(load);
      const { volume, content, creation_date, public, carrier } = load;

      const loadToSend = loadResponse({ id, volume, content, creation_date, public, carrier });

      res.status(200).send(loadToSend);
    } catch (error) {
      next(error);
    }
  }
)

// Get all loads
// Returns public loads
router.get(
  '/', 
  verifyAccept("application/json"),
  async (req, res, next) => {
    try {
      // limit 5 loads per page
      let query = datastore
        .createQuery(LOAD)
        .limit(5)
        .filter('public', '=', true);

      // If the request includes a cursor query, set the start 
      if (Object.keys(req.query).includes("cursor")) {
        query = query.start(req.query.cursor);
      }

      const loadEntities = await datastore.runQuery(query);

      // Query for the total number of public loads
      let countQuery = datastore
        .createQuery(LOAD)
        .filter('public', '=', true);
      
      const countEntities = await datastore.runQuery(countQuery);
      const numOfLoads = countEntities[0].length;

      let results = {};

      results.loads = loadEntities[0].map(entity => {
        createCarrierSelf(entity.carrier);

        return loadResponse({
          id: getEntityId(entity),
          volume: entity.volume,
          content: entity.content,
          creation_date: entity.creation_date,
          public: entity.public,
          carrier: entity.carrier,
        });
      });

      // If there are more results, attach a next link to the result
      if (loadEntities[1].moreResults !== datastore.NO_MORE_RESULTS) {
        results.next = `${url}/loads?cursor=${loadEntities[1].endCursor}`;
      }

      // Save the total number of loads
      results.count = numOfLoads;

      res.status(200).send(results);
    } catch (error) {
      next(error);
    }
  }
);

// Edit a part of load
router.patch(
  '/:load_id',
  verifyAccept("application/json"),
  verifyContentType("application/json"),
  async (req, res, next) => {
    try {
      // Retrieve original data so we partially update it
      // We need original data because GCP won't allow us to update data partially, technically.
      const key = datastore.key([LOAD, parseInt(req.params.load_id)]);
      const load = await datastore.get(key);

      const entity = {
        key,
        data: {
          volume: req.body.volume ? req.body.volume : load[0].volume,
          content: req.body.content ? req.body.content : load[0].content,
          public: req.body.public ? req.body.public : load[0].public,
          creation_date: load[0].creation_date,
          carrier: load[0].carrier,
        }
      }

      datastore.update(entity, async err => {
        if (err) {
          res.status(404).send({ Error: "No load with this load_id exists" });
        } else {
          const load = await datastore.get(key);

          createCarrierSelf(load[0].carrier);

          res
            .status(200)
            .send(loadResponse({
              id: getEntityId(load[0]),
              volume: load[0].volume,
              content: load[0].content,
              creation_date: load[0].creation_date,
              public: load[0].public,
              carrier: load[0].carrier
            }));
        }
      })
    } catch (error) {
      next(error);
    }
  }
)

// Edit an entire load
router.put(
  '/:load_id',
  verifyAccept("application/json"),
  verifyContentType("application/json"),
  async (req, res, next) => {
    try {
      // Retrieve original data so we partially update it
      // We need original data because GCP won't allow us to update data partially, technically.
      const key = datastore.key([LOAD, parseInt(req.params.load_id)]);
      const load = await datastore.get(key);

      const entity = {
        key,
        data: {
          volume: req.body.volume,
          content: req.body.content,
          public: req.body.public,
          creation_date: load[0].creation_date,
          carrier: load[0].carrier,
        }
      }

      datastore.update(entity, async err => {
        if (err) {
          res.status(404).send({ Error: "No load with this load_id exists" });
        } else {
          const load = await datastore.get(key);

          createCarrierSelf(load[0].carrier);

          res
            .status(200)
            .send(loadResponse({
              id: getEntityId(load[0]),
              volume: load[0].volume,
              content: load[0].content,
              creation_date: load[0].creation_date,
              public: load[0].public,
              carrier: load[0].carrier
            }));
        }
      })
    } catch (error) {
      next(error);
    }
  }
)

// Delete a load
router.delete(
  '/:load_id', 
  async (req, res, next) => {
    try {
      const loadKey = datastore.key([LOAD, parseInt(req.params.load_id)]);

      // Get loads to delete the load in boat that holds it
      const loadEntity = await datastore.get(loadKey);

      if (loadEntity[0] === undefined) {
        throwError({
          code: 404,
          message: "Invalid Load Id"
        })
      }

      // Find a boat to delete its loads
      if (loadEntity[0].carrier) {
        const boatKey = datastore.key([BOAT, parseInt(loadEntity[0].carrier.id)]);
        const boatEntity = await datastore.get(boatKey);

        if (boatEntity[0] === undefined) {
          throwError({
            code: 404,
            message: "Invalid Boat Id"
          })
        } 

        const deletedLoads = boatEntity[0].loads.filter(load => load.id !== req.params.load_id);

        if (deletedLoads.length === boatEntity[0].loads.length) {
          throwError({
            code: 403,
            message: "The load is not in the boat"
          })
        }

        // Delete a load from a boat
        const boatToBeUpdated = {
          key: boatKey,
          data: {
            name: boatEntity[0].name,
            type: boatEntity[0].type,
            length: boatEntity[0].length,
            owner: boatEntity[0].owner,
            loads: deletedLoads
          }
        }

        await datastore.update(boatToBeUpdated);
      }

      await datastore.delete(loadKey);

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

// PUT on root load url is not allowed. There's no such support on this API
router.put('/', (req, res, next) => {
  try {
    res.set('Accept', 'POST, GET');
    res.status(405).send({ Error: "PUT method is not allowed for root load url" });
  } catch (error) {
    next(error);
  }
});

// DELETE on root load url is not allowed. There's no such support on this API
router.delete('/', (req, res, next) => {
  try {
    res.set('Accept', 'POST, GET');
    res.status(405).send({ Error: "DELETE method is not allowed for root load url" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;