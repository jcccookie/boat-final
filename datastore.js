const { Datastore } = require('@google-cloud/datastore');

module.exports = {
  ds: () => {
    return new Datastore();
  },

  getEntityId: item => {
    return item[Datastore.KEY].id;
  },

  getEntityKind: item => {
    return item[Datastore.KEY].kind;
  }
}