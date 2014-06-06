'use strict';

var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
  , readline = require('readline')
  , ActionHandler = require('./lib/action-handler')
  , Action = require('./lib/action');

// read line
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// app server
app.listen(8080);

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

// socket.io
var count = 0;
io.sockets.on('connection', function (socket) {
  // create the action handler
  var actionHandler = new ActionHandler(socket);
  // create an user and increase count
  var user = 'user_' + count++;
  console.log('New user: %s', user);
  // handle disconnect
  socket.on('disconnect', function () {
    console.log('User %s disconnected', user);
  });
  // handle readline
  rl.on('line', function (line) {
    if (line === 'clear') {
      actionHandler.handle(new Action('clear', ''));
    } else {
      actionHandler.handle(new Action('color', line));
    }
  });
});
