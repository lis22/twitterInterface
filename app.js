/**Project 7: Build a Twitter Interface + EXTRA CREDIT
 * Treehouse Tech Degree
 * January 20 2017
 * @author lis22
 *
 *
 * To get this program working please look for configRename.js
 *      Step 1: Rename configRename.js to config.js
 *      Step 2: Enter twitter Credentials from https://apps.twitter.com/
 *      Step 3: Enter your twitter username as well and save file
 *
 */

var express = require('express');
var app = express();

var path = require('path');
var config = require('./config');

var Twit = require('twit');
var T = new Twit(config);

var moment = require('moment');

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/static', express.static(path.join(__dirname, 'public')));

app.set('view engine', 'pug');
app.set('views', __dirname + '/views');

/**
 * GetUserInfo: Uses Twit to get required user information and saves it
 * Also gets required user background image for EXTRA CREDIT
 * @param req  - Express request object
 * @param res  - Express response object
 * @param next - Express next middleware function
 */
function getUserInfo(req, res, next) {
    T.get('users/show', { screen_name: config.screen_name }, function (err, data) {

        if (err) {
            err.message = 'Error connecting to Twitter. Could not get user information';
            return next(err);
        }
        res.locals.user = {
            screenName: data.screen_name,
            friendsCount: data.friends_count,
            profilePic: data.profile_image_url,
            backgroundPic: data.profile_banner_url,
        };
        next();
    });
}

/**
 * getTimeLine: uses Twit to get 5 timeline posts and saves required information
 * @param req  - Express request object
 * @param res  - Express response object
 * @param next - Express next middleware function
 */
function getTimeLine(req, res, next) {
    T.get('statuses/user_timeline', {count: 5 },  function (err, data) {
        if (err) {
            err.message = 'Error connecting to Twitter. Could not get time line information';
            return next(err);
        }

        res.locals.timeline = [];

        for(var i=0; i < data.length; i++) {
            res.locals.timeline.push({
                message: data[i].text,
                reTweet: data[i].retweet_count,
                likes: data[i].favorite_count,
                utcTimeStamp: data[i].created_at,
                screenName: data[i].user.screen_name,
                fullName: data[i].user.name,
                profilePic: data[i].user.profile_image_url,
            });
        }
        next();
    });
}

/**
 * getFriends: Uses Twit to get 5 friends and saves required information
 * @param req  - Express request object
 * @param res  - Express response object
 * @param next - Express next middleware function
 */
function getFriends(req, res, next) {
    T.get('friends/list', {count: 5, skip_status:true, include_user_entities: false},  function (err, data) {
        if (err) {
            err.message = 'Error connecting to Twitter. Could not get friends information';
            return next(err);
        }
        res.locals.following = [];

        for(var i=0; i < data.users.length; i++) {
            res.locals.following.push({
                profilePic: data.users[i].profile_image_url,
                fullName: data.users[i].name,
                screenName: data.users[i].screen_name,
            });
        }
        next();
    });
}

/**
 * getDMsReceived: uses Twit to get 5 DM received and saves it
 * @param req  - Express request object
 * @param res  - Express response object
 * @param next - Express next middleware function
 */
function getDMsReceived(req, res, next) {
    T.get('direct_messages', {count: 5},  function (err, data) {

        if (err) {
            err.message = 'Error connecting to Twitter. Could not direct messages received.';
            return next(err);
        }

        res.locals.msgsReceived = [];

        for(var i=0; i < data.length; i++) {
            res.locals.msgsReceived.push({
                message: data[i].text,
                utcTimeStamp: data[i].created_at,
                profilePic: data[i].sender.profile_image_url,
                screenName: data[i].sender.screen_name,
                fullName: data[i].sender.name,
                recipient: data[i].recipient_screen_name,
            });
        }
        next();
    });
}

/**
 * getDMsSent: Uses Twit to get 5 DMs sent and saves it
 * @param req  - Express request object
 * @param res  - Express response object
 * @param next - Express next middleware function
 */
function getDMsSent(req, res, next) {
    T.get('direct_messages/sent', {count: 5}, function (err, data) {

        if (err) {
            err.message = 'Error connecting to Twitter. Could not direct messages sent.';
            return next(err);
        }

        res.locals.msgsSent = [];

        for (var i = 0; i < data.length; i++) {
            res.locals.msgsSent.push({
                message: data[i].text,
                utcTimeStamp: data[i].created_at,
                profilePic: data[i].sender.profile_image_url,
                screenName: data[i].sender.screen_name,
                fullName: data[i].sender.name,
                recipient: data[i].recipient_screen_name,
            });
        }
        next();
    });
}

/**
 * mergeDMs: Takes the received and sent DMs and merges by timestamp. Keeps only 5 most recent.
 * @param req  - Express request object
 * @param res  - Express response object
 * @param next - Express next middleware function
 */
function mergeDMs(req, res, next) {

    var format = 'ddd MMM DD hh:mm:ss Z YYYY';
    res.locals.msgsMerged = [];
    var i=0, j=0;

    while(i < res.locals.msgsSent.length && j < res.locals.msgsReceived.length && res.locals.msgsMerged.length <5) {
        var sent = moment.utc(res.locals.msgsSent[i].utcTimeStamp, format);
        var rec = moment.utc(res.locals.msgsReceived[j].utcTimeStamp, format);
        if(sent.isAfter(rec)) {
            res.locals.msgsMerged.push(res.locals.msgsSent[i]);
            i++;
        }
        else {
            res.locals.msgsMerged.push(res.locals.msgsReceived[j]);
            j++;
        }
    }
    //switch order so the newest will show at the bottom of the page
    res.locals.msgsMerged.reverse();

    //remove old sent and receive since not needed anymore
    delete res.locals.msgsSent;
    delete res.locals.msgsReceived;

    next();
}
/**
 * addDMConversation: Keeps track of DM conversations
 * Since the DMs are sorted by timestamp, it looks at the previous message
 * to see if the current message sender/receiver are different.
 * It does not make a threaded conversation view since it is based on the timestamp.
 * This is useful for the "conversation with" part of the pug template
 * @param req  - Express request object
 * @param res  - Express response object
 * @param next - Express next middleware function
 */
function addDMConversation(req, res, next) {
    var count=1;
    res.locals.msgsMerged[0].conversation = count;

    for(var i=1; i < res.locals.msgsMerged.length; i++) {
        var previousMsg = res.locals.msgsMerged[i-1];
        var currentMsg  = res.locals.msgsMerged[i];

        if (previousMsg.recipient === currentMsg.screenName || previousMsg.recipient === currentMsg.recipient) {
            res.locals.msgsMerged[i].conversation = count;
        }
        else {
            res.locals.msgsMerged[i].conversation = ++count;
        }
    }
    next();
}

/**
 * addRelativeTime: Takes the timestamp and using moment saves a relative timestamp
 * @param req  - Express request object
 * @param res  - Express response object
 * @param next - Express next middleware function
 */
function addRelativeTime(req, res, next) {
    var tempTimeStamp;
    var format = 'ddd MMM DD hh:mm:ss Z YYYY';

    //create relative timestamps for the timeline
    for (var i = 0; i < res.locals.timeline.length; i++) {
        tempTimeStamp = res.locals.timeline[i].utcTimeStamp;
        res.locals.timeline[i].relativeTimeStamp = moment(tempTimeStamp, format).fromNow();
    }

    //create relative timestamps for the DMs
    for (var j = 0; j < res.locals.msgsMerged.length; j++) {
        tempTimeStamp = res.locals.msgsMerged[j].utcTimeStamp;
        res.locals.msgsMerged[j].relativeTimeStamp = moment(tempTimeStamp, format).fromNow();
    }
    next();
}
/**
 * renderAppPage: Renders the index page. All required values are in res.locals
 * @param req - Express request object
 * @param res - Express response object
 */
function renderAppPage(req, res) {
    res.render('index');
}

app.get('/', getUserInfo, getTimeLine, getFriends, getDMsReceived, getDMsSent, mergeDMs, addDMConversation, addRelativeTime, renderAppPage);


/**
 * Uses Twit to send status update to Twitter. Then refreshes the page
 * EXTRA CREDIT
 */
app.post('/', function(req, res, next) {
    T.post('statuses/update', {status: req.body.status}, function(err) {
        if (err) {
            err.message = 'Error connecting to Twitter. Could not post tweet.';
            return next(err);
        }
        res.redirect('/');
    });
});


/**
 * Used to catch all 404 errors.
 * EXTRA CREDIT
 */
app.use(function(req,res,next) {
    var err = new Error('Sorry ' + req.originalUrl + ' cannot be found.');
    err.status = 404;
    next(err);
});


/**
 * Custom error handler that renders error page and sends the error
 * EXTRA CREDIT
 */
app.use(function(err, req, res, next) {
    res.render('error',{ error: err.message});
});


app.listen(3000);