'use strict';

// natives
var app = require('http').createServer(handler)
  , fs = require('fs')
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

// create amqp connection and wait for socket
var connection = amqp.createConnection({url: "amqp://guest:guest@localhost:5672"});
connection.on('ready', function () {
  // socket.io
  var count = 0;
  io.sockets.on('connection', function (socket) {
    // create an user and increase count
    var user = 'user_' + count++;
    socket.emit('user.name', { name: user });
    // receive user data
    socket.on('user.data', function (userData) {
      // creating its queues
      handleUserQueue(user + '.queue', userData, new ActionHandler(socket), socket);
    });
  });
});

// handle new user queues
function handleUserQueue(queueName, userData, actionHandler, socket) {
  connection.queue(queueName, { durable: false, autoDelete: true, exclusive: true, closeChannelOnUnsubscribe: true }, function (queue) {
    console.log('Queue %s created', queueName);
    // bind the queue to the tree exchange
    queue.bind('rabbitmq.demo.direct', queueName);
    queue.bind('rabbitmq.demo.fanout', '');
    queue.bind('rabbitmq.demo.topic', 'TODO'); // TODO Get the user info + slug
    // subscribe to the queues
    var consumerTag;
    queue.subscribe(function (message) {
      if (message === 'clear') {
        actionHandler.handle(new Action('clear', ''));
      } else {
        actionHandler.handle(new Action('color', message));
      }
    }).addCallback(function (ok) {
        consumerTag = ok.consumerTag;
      });
    // handle io disconnect
    socket.on('disconnect', function () {
      console.log('Destroy queue %s', queueName);
      userQueue.unsubscribe(consumerTag); // should be called to close the channel
      userQueue.destroy();
    });
  });
}

