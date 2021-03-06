'use strict';
/**
 * Send JSON Response
 *
 * Usage:
 * return res.json(statusCode);
 * return res.json(statusCode, data);
 *
 * @param  {Object} data
 */

/**
 * res.json() changed order of arguments a few times.
 * Sails.js /lib/router/res.js provides a private function to normalize the arguments.
 * https://github.com/balderdashy/sails/blob/0506f0681590dc92986985bc39609c88b718a997/lib/router/res.js#L329-L360
 */
/* eslint-disable */
function normalizeResArgs( args ) {

 // Traditional usage:
 // `method( other [,statusCode] )`
 var isNumeric = function (x) {
   return (+x === x);
 };
 if (isNumeric(args[0])) {
   return {
     statusCode: args[0],
     other: args[1]
   };
 }
 else return {
   statusCode: args[1],
   other: args[0]
 };
}
/* eslint-enable */

module.exports = function json() {
  var JSONAPISerializer = require('jsonapi-serializer').Serializer;
  var modelUtils = require('../utils/model-utils');
  var normUtils = require('../utils/norm-utils');
  var _ = require('lodash');

  var args = normalizeResArgs(arguments);
  var data = args.other;
  var statusCode = args.statusCode;
  var Model,
      modelName,
      opts,
      relationships,
      jsonApiRes;

  // Get access to `req`, `res`, & `sails`
  var req = this.req;
  var res = this.res;
  var sails = req._sails;

  sails.log.silly('res.json() :: Sending response');

  // Find model and begin constructing options
  modelName = modelUtils.getModelName(req);
  sails.log.verbose('[jsonapi] modelName ::', modelName);
  Model = sails.models[modelName];
  opts = {
    attributes: modelUtils.getAttributes(Model)
  };
  // Add related model data
  relationships = modelUtils.getRelationships(req);
  relationships.forEach(function (relationship) {
    var alias = relationship.alias;
    var collection = relationship.model || relationship.collection;
    Model = sails.models[collection];
    // Related model attributes
    opts[alias] = {
      attributes: modelUtils.getOwnAttributes(Model)
    };
    // add models as relationships
    modelUtils.getRef(Model, function (ref) {
      opts[alias].ref = ref;
    });
    // Compound Document options
    opts[alias].included = sails.config.jsonapi.compoundDoc;
  });

  // normalize relationships
  // jsonapi-serializer expects every relationship to be wrapped in an object
  relationships.forEach(function (relationship) {
    var alias = relationship.alias;
    var value = data[alias];
    // assume string or number to be id of related ressource
    if (typeof value === 'string' || typeof value === 'number') {
      data[alias] = { id: value };
    }
  });

  // Clean up data (removes 'add' and 'remove' functions)
  data = normUtils.normalizeData(data);

  // include many-to relationships for create
  // does not need to populate them cause there must be no other relationships
  // but the ones in request
  // watch out: req is already normalized to a plain object
  if (
    req.method === 'POST' &&
    typeof req.body === 'object'
  ) {
    // loop over all relationships in request
    relationships.forEach(function (relationship) {
      var alias = relationship.alias;

      // ignore one-to relationships
      if (!relationship.hasOwnProperty('collection')) {
        return;
      }

      // do not override populated relationships
      // data is already normalized
      if (data.hasOwnProperty(alias)) {
        return;
      }

      if (_.isArray(req.body[alias])) {
        data[alias] = req.body[alias].map(function (value) {
          return {
            id: value
          };
        });
      } else {
        // many-to relationships must be an array even if it's empty
        data[alias] = [];
      }
    });
  }

  // Serialize to jsonapi
  jsonApiRes = new JSONAPISerializer(modelName, opts).serialize(data);

  // Set mime type
  res.set('Content-Type', 'application/vnd.api+json');

  // Set status code
  if (statusCode) {
    res.status(statusCode);
  }

  // Send response
  return res.send(jsonApiRes);
};
