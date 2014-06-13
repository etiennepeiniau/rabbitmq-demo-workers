'use strict';

// natives
var app = require('http').createServer(handler)
  , fs = require('fs')
// dependencies
  , io = require('socket.io').listen(app)
  , amqp = require('amqp')
//  customs
  , queueManager = require('./lib/queue-manager.js')
  , ActionHandler = require('./lib/action-handler')
  , Action = require('./lib/action');


// start app server
function handler(req, res) {
  fs.readFile(__dirname + '/index.html',
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }

      res.writeHead(200);
      res.end(data);
    });
}
app.listen(8081);

// create amqp connection and wait for socket
var count = 0;
var connection = amqp.createConnection({url: "amqp://guest:guest@localhost:5672"});
var queueFactory = queueManager.factory(connection);
connection.on('ready', function () {
  // socket.io
  io.sockets.on('connection', function (socket) {
    // create an user and increase count
    var userName = 'user_' + count++;
    socket.emit('user.name', { name: userName });
    // receive user data
    socket.on('user.data', function (userData) {
      // Add binding keys to user data
      var userBindingKeys = queueFactory.createBindingKeys(userData.vendor, userData.platform);
      userData.bindingKeys = userBindingKeys;
      // add user to server
      connection.publish('server.add.user.queue', userData);
      // creating user queue and action handler
      var actionHandler = new ActionHandler(socket);
      var queue = queueFactory.createQueue(userName, userBindingKeys, function (message) {
        actionHandler.handle(new Action(message.type, message.value));
      });
      // handle io disconnect
      socket.on('disconnect', function () {
        queue.destroy();
        // remove user to server
        connection.publish('server.remove.user.queue', userData);
      });
    });
  });
  // handle SIGINT
  process.on('SIGINT', function () {
    for (var i = 0; i < count; i++) {
      // remove all users
      connection.publish('server.remove.user.queue', { name: 'user_' + i });
    }
    process.exit();
  });
});

