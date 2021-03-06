'use strict';

module.exports = function jsonApiHook(sails) {
  var moduleUtils = require('./utils/module-utils');
  var _ = require('lodash');
  var normalizeQueryParams = require('./requests/query-params');
  var normalizePayload = require('./requests/payload');

  /**
   * Add custom response methods to `res`.
   *
   * @param {Request} req
   * @param {Response} res
   * @param  {Function} next [description]
   * @api private
   */
  var addResponseMethods = function (req, res) {
    // Attach custom responses to `res` object
    // Provide access to `req` and `res` in each of their `this` contexts.
    _.each(sails.middleware.jsonapi.responses, function eachMethod(responseFn, name) {
      sails.log.silly('Binding response ' + name + ' to ' + responseFn);
      res[name] = _.bind(responseFn, {
        req: req,
        res: res,
      });
    });
  };

  return {

    defaults: {
      __configKey__: {
        _hookTimeout: 10000, // wait 10 seconds before timing out
        compoundDoc : true,
        included    : true,
      }
    },

    loadModules: function (cb) {
      var hook = this;
      moduleUtils.loadResponses(sails, function loadedJsonapiResponseModules(err, responseDefs) {
        if (err) return cb(err);
        // Register responses as middleware
        hook.middleware.responses = responseDefs;
        return cb();
      });
    },

    /**
     * Shadow route bindings
     * @type {Object}
     */
    routes: {
      before: {

        'all /*': function (req, res, next) {
          addResponseMethods(req, res);
          next();
        },

        'GET /*': function (req, res, next) {
          addResponseMethods(req, res);
          normalizeQueryParams(req, res);
          next();
        },

        'POST /*': function (req, res, next) {
          addResponseMethods(req, res);
          normalizePayload(req, next);
        }
      }
    }
  };
};
