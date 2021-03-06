"use strict";

Meteor.publish(null, function() {
    let userId = this.userId;

    // Resolve a settings object.
    let settings = global.AstronomerConfig
        || (((Meteor.settings || {}).public || {}).astronomer || {});

    // Return if no user or disabled user tracking.
    if (!userId || settings.disableUserTracking) {
        return this.ready();
    }

    // Build fields object.
    let fields = { "emails": 1 };

    if (Package["accounts-oauth"]) {
        let services = Package["accounts-base"].Accounts.oauth.serviceNames();
        _.each(services, s => fields[`services.${s}.email`] = 1);
    }

    // Find current user and send down email fields.
    let cursor = Meteor.users.find({ _id: userId }, { fields });

    // Publish to our client side collection.
    Mongo.Collection._publishCursor(cursor, this, "AstronomerUser");

    // Ready
    return this.ready();
});
