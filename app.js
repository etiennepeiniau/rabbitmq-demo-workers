'use strict';

  // natives
var app = require('http').createServer(handler)
  , fs = require('fs')
  , readline = require('readline')
  // dependencies
  , io = require('socket.io').listen(app)
  , amqp = require('amqp')
  //  customs
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

// read line TODO Remove
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// create amqp connection and wait for it
var connection = amqp.createConnection({url: "amqp://guest:guest@localhost:5672"});
connection.on('ready', function () {
  // socket.io
  var count = 0;
  io.sockets.on('connection', function (socket) {
    // create the action handler
    var actionHandler = new ActionHandler(socket);
    // create an user and increase count
    var user = 'user_' + count++;
    console.log('New user: %s', user);
    socket.emit('user.name', { name: user });
    // receive user data
    socket.on('user.data', function( data ) {
      console.log('User data received %s', data);
      // creating its queues
      connection.queue( user + '.queue', { durable: false, autoDelete : true, exclusive : true },  function (queue) {
        console.log("Queue ready for %s", user);
        // bind the queue to the tree exchange
        queue.bind('rabbitmq.demo.direct', queue.name);
        queue.bind('rabbitmq.demo.fanout', '');
        queue.bind('rabbitmq.demo.topic', 'TODO'); // TODO Get the user info
        // handle io disconnect
        socket.on('disconnect', function () {
          console.log('User %s disconnected', user);
          queue.destroy();
        });
      });
    })
    // handle readline TODO Remove
    rl.on('line', function (line) {
      if (line === 'clear') {
        actionHandler.handle(new Action('clear', ''));
      } else {
        actionHandler.handle(new Action('color', line));
      }
    });
  });
});

