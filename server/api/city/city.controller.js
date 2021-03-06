'use strict';

// External helpers
var   _ = require('lodash'),
request = require('request'),
   slug = require('slug'),
  fuzzy = require('fuzzy');
// Internal helpers
var response = require("../response"),
   paginator = require("../paginator");
// Collections and models
var cities = require('./city.collection');
var docs   = require('../doc/doc.model');

const INDEX_EXCLUDE = ['months', 'neighborhoods', 'deciles'];

/**
 * @api {get} /api/cities List of cities
 * @apiParam {Number} [offset=0] Offset to start from (each page returns 50 cities)
 * @apiParam {Number} [has_neighborhoods=0] If '1', cities without neighborhoods are excluded.
 * @apiPermission Public
 * @apiGroup Cities
 * @apiName index
 *
 * @apiDescription
 *  Returns a series of statistical information for each European city with a population above 100,000 inhabitants that Rentswatch monitors.
 *  For each city, the method returns the average price, the standard error and the inequality index.
 *  Cities are not defined by their administrative boundaries but by a circle around a geographical center.
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://api.rentswatch.com/api/cities
 *
 * @apiSuccess {String}   name              Name of the city.
 * @apiSuccess {Number}   latitude          Latitude of the geographical center of the city.
 * @apiSuccess {Number}   longitude         Longitude of the geographical center of the city.
 * @apiSuccess {String}   country           ISO-alpha 3 code of the country.
 * @apiSuccess {Number}   radius            Radius of the city in kilometers.
 * @apiSuccess {String}   slug              A slug version of the name of the city.
 * @apiSuccess {Number}   total             Total number of data points used to generate the statistics.
 * @apiSuccess {Number}   avgPricePerSqm    Average price per square meter in Euro. The average price is the slope of the regression of each property's living space and total rent (including utilities).
 * @apiSuccess {Number}   lastSnapshot      Timestamp of the generation of these statistics. Starting point is September 2015 unless otherwise noted.
 * @apiSuccess {Number}   stdErr            Standard deviation of the average rent price. The actual rent prices in a city are avgPricePerSqm + or - stdErr per square meters.
 * @apiSuccess {Number}   inequalityIndex   A build-in inequality index. It is the standard deviation of the rent prices between neighborhoods. An inequality index of 0 means that rents in all neighborhoods are the same. The larger the differences, the larger the index.
 *
 */
exports.index = function(req, res) {
  // Build paginator parameters
  var params = paginator.offset(req);
  var list = cities.toArray()
  // Filter list to have only cities with a neighborhood
  if(1*req.query.has_neighborhoods) {
    list = list.filter(function(item) {
      return item.neighborhoods
    });
  }
  // Take a slice  of the list
  list = list.slice(params.offset, params.offset + params.limit);
  // Maps the cities array to remove some properties
  res.status(200).json(_.map(list, function(city) {
    city = _.cloneDeep(city);
    // Delete some properties
    INDEX_EXCLUDE.forEach(function(k) { delete city[k] });
    return city;
  }));
};

/**
 * @api {get} /api/cities/:slug Statistics about a single city
 * @apiParam {String} slug Slug of the city
 * @apiPermission Public
 * @apiGroup Cities
 * @apiName show
 *
 * @apiDescription
 *  A series of statistics for a given city.
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://api.rentswatch.com/api/cities/berlin
 *
 * @apiSuccess {String}   name              Name of the city.
 * @apiSuccess {Number}   latitude          Latitude of the geographical center of the city.
 * @apiSuccess {Number}   longitude         Longitude of the geographical center of the city.
 * @apiSuccess {String}   country           ISO-alpha 3 code of the country.
 * @apiSuccess {Number}   radius            Radius of the city in kilometers.
 * @apiSuccess {Object[]} neighborhoods     A list of neighborhoods for the city. For each neighborhood, the same statistics are provided.
 * @apiSuccess {String}   slug              A slug version of the name of the city.
 * @apiSuccess {Number}   total             Total number of data points used to generate the statistics.
 * @apiSuccess {Number}   avgPricePerSqm    Average price per square meter in Euro. The average price is the slope of the regression of each property's living space and total rent (including utilities).
 * @apiSuccess {Number}   lastSnapshot      Timestamp of the generation of these statistics. Starting point is September 2015 unless otherwise noted.
 * @apiSuccess {Number}   stdErr            Standard deviation of the average rent price. The actual rent prices in a city are avgPricePerSqm + or - stdErr per square meters.
 * @apiSuccess {Number}   inequalityIndex   A build-in inequality index. It is the standard deviation of the rent prices between neighborhoods. An inequality index of 0 means that rents in all neighborhoods are the same. The larger the differences, the larger the index.
 * @apiSuccess {Object[]} months            Statistics about rent prices in the city by month.
 *
 * @apiError 404 City not found
 * @apiErrorExample Response (example):
 *     HTTP/1.1 404 Not Authenticated
 *     {
 *       "error": "Not found."
 *     }
 */
exports.show = function(req, res) {
  var city = cities.get({ name: req.params.name });
  if(city) {
    // Temporary sync method to get city's stats
    if(req.query.sync && req.app.get('env') === 'development') {
      city.getStats().then(function(stats) {
        city = _.extend( _.cloneDeep(city), stats);
        res.status(200).json(city);
      }).fail( response.handleError(res, 500) );
    } else {
      res.status(200).json(city);
    }
  } else {
    response.handleError(res, 404)('Not found');
  }
};

/**
 * @api {get} /api/search Search a city by its name
 * @apiParam {String} q City name to look for.
 * @apiParam {Number} [has_neighborhoods=0] If '1', cities without neighborhoods are excluded.
 * @apiParam {Number} [offset=0] Offset to start from (each page returns 50 cities)
 * @apiPermission Public
 * @apiGroup Cities
 * @apiName search
 *
 * @apiDescription
 *  Find one or several cities for that Rentswatch monitors with there statistical information.
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://api.rentswatch.com/api/cities/search?q=Berlin
 *
 * @apiSuccess {String}   name              Name of the city.
 * @apiSuccess {Number}   latitude          Latitude of the geographical center of the city.
 * @apiSuccess {Number}   longitude         Longitude of the geographical center of the city.
 * @apiSuccess {String}   country           ISO-alpha 3 code of the country.
 * @apiSuccess {Number}   radius            Radius of the city in kilometers.
 * @apiSuccess {String}   slug              A slug version of the name of the city.
 * @apiSuccess {Number}   total             Total number of data points used to generate the statistics.
 * @apiSuccess {Number}   avgPricePerSqm    Average price per square meter in Euro. The average price is the slope of the regression of each property's living space and total rent (including utilities).
 * @apiSuccess {Number}   lastSnapshot      Timestamp of the generation of these statistics. Starting point is September 2015 unless otherwise noted.
 * @apiSuccess {Number}   stdErr            Standard deviation of the average rent price. The actual rent prices in a city are avgPricePerSqm + or - stdErr per square meters.
 * @apiSuccess {Number}   inequalityIndex   A build-in inequality index. It is the standard deviation of the rent prices between neighborhoods. An inequality index of 0 means that rents in all neighborhoods are the same. The larger the differences, the larger the index.
 *
 */
exports.search = function(req, res) {
  // Build paginator parameters
  var params = paginator.offset(req);
  var q = slug(req.query.q || "");
  // Must specified a query parameter
  if(!q || q.length < 1) {
    return response.validationError(res)({ error: "'q' parameter must not be empty."});
  }
  // Look for a city by its name
  var filtered = cities.filter(function(item) {
    if(1*req.query.has_neighborhoods && !item.neighborhoods) return false;
    // Slugify city's name with slug
    return fuzzy.test(q, slug(item.name || ''));
  });
  // Pick a slice
  filtered = filtered.toArray().slice(params.offset, params.offset + params.limit);
  // Maps the cities array to remove some properties
  res.status(200).json(_.map(filtered, function(city) {
    city = _.cloneDeep(city);
    // Delete some properties
    INDEX_EXCLUDE.forEach(function(k) { delete city[k] });
    return city;
  }));
};

/**
 * @api {get} /api/ranking Ranking of all cities
 * @apiParam {String} [indicator=avgPricePerSqm] Indicator to use to build the ranking. Can be `avgPricePerSqm`, `total` and `inequalityIndex`.
 * @apiPermission Public
 * @apiGroup Cities
 * @apiName ranking
 *
 * @apiDescription
 *  A ranking of every cities according to a given indicator.
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://api.rentswatch.com/api/cities/ranking?indicator=inequalityIndex
 *
 */
exports.ranking = function(req, res) {
  const indicators = ['avgPricePerSqm', 'total', 'inequalityIndex']
  var indicator = indicators.indexOf(req.query.indicator) > -1 ? req.query.indicator : 'avgPricePerSqm';
  // Pick a slice
  var ranking = _.chain(cities.toArray())
             .filter('ranked')
             .sortBy( (c)=> -1* c[indicator] )
             .map( (c)=>[ c.name, c[indicator] ])
             .value()
  // Maps the cities array to remove some properties
  res.status(200).json(ranking);
};

/**
 * @api {get} /api/geocode Statistics about a given location
 * @apiParam {String} q Query to geocode the location (can be an address or coordinates).
 * @apiParam {Number} [radius=20] Radius of the circle to generate statistics from.
 * @apiParam {Number} [limit=0] Maximum number of flats to analyse. '0' equals all.
 * @apiParam {Number} [min_living_space=0] Minimum living space size
 * @apiParam {Number} [max_living_space=200] Maximum living space size
 * @apiParam {Number} [no_rooms] A commat separated list of rooms numer
 * @apiParam {String} token User token (protected ressource).
 * @apiPermission Authenticated
 * @apiGroup Cities
 * @apiName geocode
 *
 * @apiDescription
 *  A series of statistical indicators for a given location and a given radius. The query is geolocated using Open Street Map. It accepts city names, neighborhoods, addresses or any other descriptor.
 *
 * @apiExample {curl} Example usage:
 *     curl -i http://api.rentswatch.com/api/cities/geocode?q=Marseille&token=<TOKEN>
 *     curl -i http://api.rentswatch.com/api/cities/geocode?q=Paris&no_rooms=1,2&token=<TOKEN>
 *
 * @apiSuccess {String}   name              Name of the location.
 * @apiSuccess {String}   type              OSM type of the location.
 * @apiSuccess {Number}   latitude          Latitude of the geographical center of the location.
 * @apiSuccess {Number}   longitude         Longitude of the geographical center of the location.
 * @apiSuccess {Number}   radius            Radius of the city in kilometers.
 * @apiSuccess {Number}   total             Total number of data points used to generate the statistics.
 * @apiSuccess {Number}   avgPricePerSqm    Average price per square meter in Euro. The average price is the slope of the regression of each property's living space and total rent (including utilities).
 * @apiSuccess {Number}   lastSnapshot      Timestamp of the generation of these statistics. Starting point is September 2015 unless otherwise noted.
 * @apiSuccess {Number}   stdErr            Standard deviation of the average rent price. The actual rent prices in a city are avgPricePerSqm + or - stdErr per square meters.
 * @apiSuccess {Object[]} months            Statistics about rent prices of the location by month.
 *
 * @apiError 401 Only authenticated users can access the data.
 * @apiErrorExample Response (example):
 *     HTTP/1.1 401 Not Authenticated
 *     {
 *       "error": "Unauthorized token."
 *     }
 */
exports.geocode = function(req, res) {
  if(!req.query.q) return response.handleError(res, 400)("Missing 'q' parameter.")
  // Validates radius
  var radius = req.query.radius || 20;
  radius = isNaN(radius) ? 20 : radius;
  radius = Math.min(radius, 20);
  // Validates minimum living splace
  var minLivingSpace = req.query.min_living_space || 0;
  minLivingSpace = isNaN(minLivingSpace) ? 0 : minLivingSpace;
  // Validates maximum living splace
  var maxLivingSpace = req.query.max_living_space || 200;
  maxLivingSpace = isNaN(maxLivingSpace) ? 200 : maxLivingSpace;
  // Validates number of rooms
  if(req.query.no_rooms) {
    var noRooms = req.query.no_rooms.split(',');
    noRooms = _.chain(noRooms).map(_.trim).map(Number).reject(isNaN).value()
  } else {
    var noRooms = null;
  }
  // Extract coordinates from query
  var latlng = _( req.query.q.split(',') ).map(_.trim).map(Number).reject(isNaN).value();
  // Send place's stats to the current request
  var sendCenter = function(place) {
    // Get rows for this place
    docs.center(place.latitude,
                place.longitude,
                place.radius,
                minLivingSpace,
                maxLivingSpace,
                noRooms,
                req.query.limit).then(function(rows) {
      place = _.extend(place, docs.getStats(rows, radius, true) );
      // Get deciles for this place
      docs.deciles(rows).then(function(deciles){
        place.deciles = deciles;
        // Return the place and the stats associated to it
        res.status(200).json(place);
      }, response.handleError(res, 500)).fail(response.handleError(res, 500));
    }, response.handleError(res, 500)).fail(response.handleError(res, 500));
  }
  // Get current radius
  // Default and maxium radius is 20
  var place = { radius: radius };
  // Skip geocoding if coordinates are given
  if( latlng.length === 2 ) {
    // Extend place with the result
    sendCenter(_.extend(place, {
      latitude:  latlng[0] * 1,
      longitude: latlng[1] * 1,
      name:      'unkown',
      type:      'unkown',
      deciles:   []
    }));
  } else {
    // Build geocoder URL
    var url = "http://nominatim.openstreetmap.org/search";
    // Build geocoder params
    var params = {
      format: "json",
      limit: 1,
      osm_type: "N",
      q: req.query.q,
    };
    // Geocode the query
    request({ url: url, json: true, qs: params }, function(err, resp, body) {
      // Field copied from OSM
      // No error?
      if(!err && body.length && body.push) {
        // Extend place with the result
        sendCenter(_.extend(place, {
          latitude:  body[0].lat * 1,
          longitude: body[0].lon * 1,
          name:      body[0].display_name,
          type:      body[0].type,
          deciles:   []
        }));
      } else {
        response.handleError(res, 404)('Not found');
      }
    });
  }
};
