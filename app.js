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
app.listen(8080);

// create amqp connection and wait for socket
var connection = amqp.createConnection({url: "amqp://guest:guest@localhost:5672"});
var queueFactory = queueManager.factory(connection);
connection.on('ready', function () {
  // socket.io
  var count = 0;
  io.sockets.on('connection', function (socket) {
    // create an user and increase count
    var userName = 'user_' + count++;
    socket.emit('user.name', { name: userName });
    // receive user data
    socket.on('user.data', function (userData) {
      // creating user queue and action handler
      var actionHandler = new ActionHandler(socket);
      var userBindingKey = queueFactory.createBindingKey(userData.vendor, userData.platform);
      var queue = queueFactory.createQueue(userName, userBindingKey, function (message) {
        if (message === 'clear') {
          actionHandler.handle(new Action('clear', ''));
        } else {
          actionHandler.handle(new Action('color', message));
        }
      });
      // handle io disconnect
      socket.on('disconnect', function () {
        queue.destroy();
      });
    });
  });
});