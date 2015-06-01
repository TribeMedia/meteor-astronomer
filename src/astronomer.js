/*
 * When meteor starts, attempt to initialize analytics.js integration
 * and setup automatic tracking.
 */
Meteor.startup(() => {
  if (initalizeAnalyticsjs()) {
    if (typeof Meteor.user !== "undefined") {
      setupIdentify();
    } else {
      console.warn("Meteor accounts not detected, all events will be anonymous.");
    }
    setupRouteTracking();
    setupMethodTracking();
  } else {
    console.warn("Astronomer keys not found in Meteor.settings, skipping setup.")
  }
});

/**
 * Initialize the astronomer analytics.js integration.
 * @returns {Boolean} If the integration was able to initialize.
 */
function initalizeAnalyticsjs() {
  let settings = (Meteor.settings || {}).public || {};
  let accessKeyId = (settings.astronomer || {}).accessKeyId;
  let secretAccessKey = (settings.astronomer || {}).secretAccessKey;
  if (accessKeyId && secretAccessKey) {
    return analytics.initialize({
      "astronomer": {
        "accessKeyId": accessKeyId,
        "secretAccessKey": secretAccessKey
      }
    });
  }
}


/**
 * Setup an autorun, to identify a user whenever Meteor.userId changes.
 */
function setupIdentify() {
  Tracker.autorun(() => {
    let userId = Meteor.userId();
    if (userId) {
      analytics.identify(userId);
    }
  });
}

/**
 * Take a source object and extend it with session keys.
 * @returns {Object} The new properties object.
 */
function createProperties(obj={}) {
  return _.extend(obj, { session: Session.keys });
}

/**
 * Detect the router and hook in to run analytics.page.
 */
function setupRouteTracking() {

  function page(pageName, properties={}) {
    analytics.page(pageName, createProperties(properties));
  }

  if (typeof Router !== "undefined") {
    /** Setup Iron Router */
    Router.onRun(function() {

      /** Build properties to pass along with page */
      let routeParams = {};
      let keys = _.keys(this.params);
      _.each(keys, (key) => { routeParams[key] = this.params[key]; });

      /** Get the page name */
      let pageName = this.route.getName() || "Home";

      /** Send the page view with properties */
      page(pageName, { routeParams });
      this.next();
    });
  } else if (typeof FlowRouter !== "undefined") {
    /** Setup Flow Router */
    FlowRouter.middleware(function(path, next) {

      /** Get the page name */
      let pageName = path !== "/" ? path : "Home";

      /** Send the page view with properties */
      page(pageName);
      next();
    });
  }
}

/**
 * Override Meteor.apply (and Meteor.call) with our wrapper.
 * Our version wraps the user defined callback,
 * or defines a new one that will track an event if the method did not
 * throw an error.
 */
function setupMethodTracking() {
  Meteor.connection.apply = _.wrap(Meteor.connection.apply,
    function(func, name, args, options={}, callback) {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }

      let track = function(err, res) {
        if (!err) {
          let properties = createProperties({ args, res });
          analytics.track(`Called ${name} Method`, properties);
        }
      }

      if (callback) {
        callback = _.wrap(callback, function(originalCallback, err, res) {
          track(err, res);
          originalCallback(err, res);
        });
      } else {
        callback = track;
      }

      func = _.bind(func, this);
      func(name, args, options, callback);
    }
  );
}
