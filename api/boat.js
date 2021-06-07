const { Router } = require('express');
const { ds, getEntityId, getEntityKind } = require('../datastore');
const { BOAT, LOAD } = require('./config');
const dotenv = require('dotenv');

const { boatResponse, throwError, createLoadSelf, createCarrierSelf, loadResponse, isUnique, verifyUser } = require('./helpers');
const { verifyAccept, verifyContentType } = require('./middleware/helpers');
const { isJwtExist, isTokenValid } = require('./middleware/auth');

const router = new Router();
const datastore = ds();
dotenv.config();
const url = process.env.APP_URL;

// Create a Boat
// Created boat will be assigned to a user who created it
// Protected
router.post(
  '/', 
  isJwtExist(), 
  isTokenValid(), 
  verifyAccept("application/json"),
  verifyContentType("application/json"),
  async (req, res, next) => {
    try {
      // Check uniqueness of a boat by name
      const query = datastore.createQuery(BOAT);
      const boatEntities = await datastore.runQuery(query);

      if (req.body.name) {
        isUnique({
          entities: boatEntities[0],
          value: req.body.name,
          attribute: "name"
        })
      }

      const { sub } = req.payload;

      const key = datastore.key(BOAT);
      const data = {
        ...req.body,
        owner: sub // JWT
      };

      // Save boat to datastore
      const entity = { key, data };
      await datastore.save(entity);

      const boat = await datastore.get(key);

      const id = getEntityId(boat[0]);
      const { name, type, length, owner } = boat[0];

      res
        .status(201)
        .send(boatResponse({ id, name, type, length, owner }));
    } catch (error) {
      next(error);
    }
  }
);

// View a Boat
// Protected
router.get(
  '/:boat_id', 
  isJwtExist(),
  isTokenValid(),
  verifyAccept("application/json"),
  async (req, res, next) => {
    try {
      const key = datastore.key([BOAT, parseInt(req.params.boat_id, 10)]);

      const boatEntity = await datastore.get(key);

      if (boatEntity[0] === undefined) {
        throwError({
          code: 404,
          message: "No boat with this boat_id exists"
        })
      }

      // Check if the user is matched with the owner of the boat
      const userId = req.payload.sub;
      const ownerId = boatEntity[0].owner;

      verifyUser(userId, ownerId);

      // Create load self
      if (boatEntity[0].loads) {
        createLoadSelf(boatEntity[0].loads);
      }

      const id = getEntityId(boatEntity[0]);
      const { name, type, length, owner, loads } = boatEntity[0];

      const boat = boatResponse({ id, name, type, length, owner, loads });

      res.status(200).send(boat);
    } catch (error) {
      next(error);
    }
  }
);

// View all Boats
// Returns boats that correspondent to the user logged in. 
router.get(
  '/',
  isJwtExist(),
  isTokenValid(),
  verifyAccept("application/json"),
  async (req, res, next) => {
    try {
      const userId = req.payload.sub;

      let query = datastore
        .createQuery(BOAT)
        .filter('owner', '=', userId)
        .limit(5); // limit 5 boats per page

      // If the request includes a cursor query, set the start 
      if (Object.keys(req.query).includes("cursor")) {
        query = query.start(req.query.cursor);
      }

      const boatEntities = await datastore.runQuery(query);

      // Query for the total number of boats
      let countQuery = datastore
        .createQuery(BOAT)
        .filter('owner', '=', userId);

      const data = await datastore.runQuery(countQuery);
      const numOfBoats = data[0].length;

      let results = {};

      results.boats = boatEntities[0].map(entity => {
        createLoadSelf(entity.loads);

        return boatResponse({
          id: getEntityId(entity),
          name: entity.name,
          type: entity.type,
          length: entity.length,
          owner: entity.owner,
          loads: entity.loads,
        });
      });

      // If there are more results, attach a next link to the result
      if (boatEntities[1].moreResults !== datastore.NO_MORE_RESULTS) {
        results.next = `${url}/boats?cursor=${boatEntities[1].endCursor}`;
      }

      // Total number of boats
      results.count = numOfBoats;

      res.status(200).send(results);
    } catch (error) {
      next(error);
    }
  }
);

// Edit a part of boat (PATCH)
router.patch(
  '/:boat_id',
  isJwtExist(),
  isTokenValid(),
  verifyAccept("application/json"),
  verifyContentType("application/json"),
  async (req, res, next) => {
    try {
      const query = datastore.createQuery(BOAT);
      const boatEntities = await datastore.runQuery(query);

      // Check uniqueness of a boat by name
      if (req.body.name) {
        isUnique({
          entities: boatEntities[0],
          value: req.body.name,
          attribute: "name"
        })
      }

      // Retrieve original data so we partially update it
      // We need original data because GCP won't allow us to update data partially, technically.
      const key = datastore.key([BOAT, parseInt(req.params.boat_id)]);
      const boat = await datastore.get(key);

      if (boat[0] === undefined) {
        throwError({
          code: 404,
          message: "No boat with this boat_id exists"
        })
      }

      // Check if the user is matched with the owner of the boat
      const userId = req.payload.sub;
      const ownerId = boat[0].owner;

      verifyUser(userId, ownerId);

      const entity = {
        key,
        data: {
          name: req.body.name ? req.body.name : boat[0].name,
          type: req.body.type ? req.body.type : boat[0].type,
          length: req.body.length ? req.body.length : boat[0].length,
          owner: boat[0].owner,
          loads: boat[0].loads
        }
      }

      datastore.update(entity, async err => {
        if (err) {
          res.status(404).send({ Error: "No boat with this boat_id exists" });
        } else {
          const boat = await datastore.get(key);

          createLoadSelf(boat[0].loads);

          res
            .status(200)
            .send(boatResponse({
              id: getEntityId(boat[0]),
              name: boat[0].name,
              type: boat[0].type,
              length: boat[0].length,
              owner: boat[0].owner,
              loads: boat[0].loads
            }));
        }
      })
    } catch (error) {
      next(error);
    }
  }
)

// Edit an entire boat (PUT)
router.put(
  '/:boat_id',
  isJwtExist(),
  isTokenValid(),
  verifyAccept("application/json"),
  verifyContentType("application/json"),
  async (req, res, next) => {
    try {
      const query = datastore.createQuery(BOAT);
      const boatEntities = await datastore.runQuery(query);

      // Check uniqueness of a boat by name
      if (req.body.name) {
        isUnique({
          entities: boatEntities[0],
          value: req.body.name,
          attribute: "name"
        })
      }

      // Retrieve original data so we partially update it
      // We need original data because GCP won't allow us to update data partially, technically.
      const key = datastore.key([BOAT, parseInt(req.params.boat_id)]);
      const boat = await datastore.get(key);

      if (boat[0] === undefined) {
        throwError({
          code: 404,
          message: "No boat with this boat_id exists"
        })
      }

      // Check if the user is matched with the owner of the boat
      const userId = req.payload.sub;
      const ownerId = boat[0].owner;

      verifyUser(userId, ownerId);

      const entity = {
        key,
        data: {
          ...req.body,
          owner: boat[0].owner,
          loads: boat[0].loads
        }
      }

      datastore.update(entity, async err => {
        if (err) {
          res.status(404).send({ Error: "No boat with this boat_id exists" });
        } else {
          const boat = await datastore.get(key);

          createLoadSelf(boat[0].loads);

          res
            .status(200)
            .send(boatResponse({
              id: getEntityId(boat[0]),
              name: boat[0].name,
              type: boat[0].type,
              length: boat[0].length,
              owner: boat[0].owner,
              loads: boat[0].loads
            }));
        }
      })
    } catch (error) {
      next(error);
    }
  } 
)


// Assign Load to Boat
router.put(
  '/:boat_id/loads/:load_id',
  isJwtExist(),
  isTokenValid(),
  async (req, res, next) => {
  try {
    const keys = [
      datastore.key([BOAT, parseInt(req.params.boat_id)]),
      datastore.key([LOAD, parseInt(req.params.load_id)])
    ];

    const [boatKey, loadKey] = keys;
    const entities = await datastore.get(keys);

    // Check if either boat_id or load_id is valid
    if (entities[0].length < 2) {
        throwError({
        code: 404,
        message: "Invalid Boat or Load Id"
      })
    }

    let boatEntity, loadEntity;

    // Define variables for entities from Datastore based on kind
    entities[0].forEach(entity => {
      if (getEntityKind(entity) === BOAT) {
        boatEntity = entity;
      } else if (getEntityKind(entity) === LOAD) {
        loadEntity = entity;
      }
    });

    // Check if the user is matched with the owner of the boat
    const userId = req.payload.sub;
    const ownerId = boatEntity.owner;

    verifyUser(userId, ownerId);

    // Check if the load is already assigned to a boat
    if (loadEntity.carrier) {
      throwError({
        code: 403,
        message: "A load is already assigned to another boat"
      })
    }

    // Update Boat
    // Create a boat entity to update
    const boatToBeUpdated = {
      key: boatKey,
      data: {
        name: boatEntity.name,
        type: boatEntity.type,
        length: boatEntity.length,
        owner: boatEntity.owner,
        loads: boatEntity.loads ? [...boatEntity.loads]: []
      }
    };

    // Load to be updated to boat
    const loadToBoat = {
      id: getEntityId(loadEntity)
    };

    boatToBeUpdated.data.loads.push(loadToBoat);// Put load information to boat entity
    await datastore.update(boatToBeUpdated);// Update loads to boat in Datastore

    // Update Load
    // Create and update Load entity
    const loadToBeUpdated = {
      key: loadKey,
      data: {
        volume: loadEntity.volume,
        content: loadEntity.content,
        creation_date: loadEntity.creation_date,
        public: false,
        carrier: {
          id: getEntityId(boatEntity)
        }
      }
    };

    // Update load
    await datastore.update(loadToBeUpdated);

    // Get updated Boat and Load so we send response to client
    const updatedBoat = await datastore.get(boatKey);
    const updatedLoad = await datastore.get(loadKey);

    // Attach self url to every load in boat
    createLoadSelf(updatedBoat[0].loads);

    // Attach self url to carrier in load
    createCarrierSelf(updatedLoad[0].carrier);

    res
      .status(200)
      .json({
        boat: boatResponse({
          id: getEntityId(updatedBoat[0]),
          name: updatedBoat[0].name,
          type: updatedBoat[0].type, 
          length: updatedBoat[0].length,
          owner: updatedBoat[0].owner,
          loads: updatedBoat[0].loads,
        }),
        load: loadResponse({
          id: getEntityId(updatedLoad[0]),
          volume: updatedLoad[0].volume,
          content: updatedLoad[0].content,
          creation_date: updatedLoad[0].creation_date,
          public: updatedLoad[0].public,
          carrier: updatedLoad[0].carrier,
        })
      });
  } catch (error) {
    next(error);
  }
});

// Remove a Load from a Boat
router.delete(
  '/:boat_id/loads/:load_id', 
  isJwtExist(),
  isTokenValid(),
  async (req, res, next) => {
    try {
      const keys = [
        datastore.key([BOAT, parseInt(req.params.boat_id)]),
        datastore.key([LOAD, parseInt(req.params.load_id)])
      ];

      const [boatKey, loadKey] = keys;
      const entities = await datastore.get(keys);

      // Check if either boat_id or load_id is valid
      if (entities[0].length < 2) {
        throwError({
          code: 404,
          message: "Invalid Boat or Load Id"
        })
      }

      let boatEntity, loadEntity;

      // Define variables for entities from Datastore based on kind
      entities[0].forEach(entity => {
        if (getEntityKind(entity) === BOAT) {
          boatEntity = entity;
        } else if (getEntityKind(entity) === LOAD) {
          loadEntity = entity;
        }
      });

      // Check if the user is matched with the owner of the boat
      const userId = req.payload.sub;
      const ownerId = boatEntity.owner;

      verifyUser(userId, ownerId);

      // Delete the load from the Boat
      const deletedLoads = boatEntity.loads.filter(load => load.id !== req.params.load_id);
      
      // Check if the load is in the boat
      if (deletedLoads.length === boatEntity.loads.length) {
        throwError({
          code: 403,
          message: "The load is not in the boat"
        })
      }

      // Delete a carrier from a load
      const loadToBeUpdated = {
        key: loadKey,
        data: {
          volume: loadEntity.volume,
          content: loadEntity.content,
          creation_date: loadEntity.creation_date,
          public: true
        }
      };

      // Updated removed loads to the boat
      const boatToBeUpdated = {
        key: boatKey,
        data: {
          name: boatEntity.name,
          type: boatEntity.type,
          length: boatEntity.length,
          owner: boatEntity.owner,
          loads: deletedLoads
        }
      };

      await datastore.update(boatToBeUpdated);
      await datastore.update(loadToBeUpdated);

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

// Delete a boat
router.delete(
  '/:boat_id', 
  isJwtExist(),
  isTokenValid(),
  async (req, res, next) => {
    try {
      const boatKey = datastore.key([BOAT, parseInt(req.params.boat_id)]);

      // Get loads to delete carrier info in load
      const boatEntity = await datastore.get(boatKey);

      if (boatEntity[0] === undefined) {
        throwError({
          code: 404,
          message: "Invalid Boat Id"
        })
      }

      // Check if the user is matched with the owner of the boat
      const userId = req.payload.sub;
      const ownerId = boatEntity[0].owner;

      verifyUser(userId, ownerId);

      // Find loads and delete its carrier
      if (boatEntity[0].loads) {
        boatEntity[0].loads.forEach(async load => {
          try {
            const loadKey = datastore.key([LOAD, parseInt(load.id)]);
            const loadEntity = await datastore.get(loadKey);
    
            if (loadEntity[0] === undefined) {
              throwError({
                code: 404,
                message: "Invalid Load Id"
              })
            } 
    
            // Delete a carrier from a load
            const loadToBeUpdated = {
              key: loadKey,
              data: {
                volume: loadEntity[0].volume,
                content: loadEntity[0].content,
                creation_date: loadEntity[0].creation_date,
                public: true
              }
            };
    
            await datastore.update(loadToBeUpdated);
          } catch (error) {
            throw error;
          }
        });
      }

      await datastore.delete(boatKey);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

// PUT on root boat url is not allowed. There's no such support on this API
router.put(
  '/',
  isJwtExist(),
  isTokenValid(),
  (req, res, next) => {
  try {
    res.set('Accept', 'POST, GET');
    res.status(405).send({ Error: "PUT method is not allowed for root boat url" });
  } catch (error) {
    next(error);
  }
});

// DELETE on root boat url is not allowed. There's no such support on this API
router.delete(
  '/', 
  isJwtExist(),
  isTokenValid(),
  (req, res, next) => {
  try {
    res.set('Accept', 'POST, GET');
    res.status(405).send({ Error: "DELETE method is not allowed for root boat url" });
  } catch (error) {
    next(error);
  }
});

// Get all loads for a given boat
// router.get('/:boat_id/loads', async (req, res, next) => {
//   try {
//     const boatKey = datastore.key([BOAT, parseInt(req.params.boat_id)]);
//     const boatEntity = await datastore.get(boatKey);

//     if (boatEntity[0] === undefined) {
//       const error = new Error("Invalid Boat Id");
//       error.statusCode = 404;

//       throw error;
//     }

//     let loadKeys = [];

//     // Get loads from datastore to store it to container
//     const loadsToBeDisplayed = boatEntity[0].loads;

//     // Get loadKeys for all loads in a boat
//     loadsToBeDisplayed.forEach(load => {
//       const loadKey = datastore.key([LOAD, parseInt(load.id)]);

//       loadKeys.push(loadKey);
//     })

//     const loadEntities = await datastore.get(loadKeys);

//     let loadContainer = [];
//     // Put self link to carrier and put load to container to be sent as response
//     loadEntities[0].forEach(load => {
//       createCarrierSelf(load.carrier);

//       loadContainer.push(loadResponse({
//         id: getEntityId(load),
//         volume: load.volume,
//         content: load.content,
//         creation_date: load.creation_date,
//         carrier: load.carrier,
//       }));
//     });

//     res.status(200).send(loadContainer);
//   } catch (error) {
//     next(error);
//   }
// });

module.exports = router;