'use strict';

// dependencies
var Q = require('q')
  , slug = require('slug');

// export the module
module.exports = {
  factory: function (connection) {
    return new QueueFactory(connection);
  }
}

function QueueFactory(connection) {
  this.connection = connection;
}

QueueFactory.prototype.createBindingKeys = function () {
  var args = Array.prototype.slice.call(arguments, 0);
  return args.map(function (value) {
    return slug(value)
      // removing rabbitmq special characters
      .replace('.', '')
      .replace('*', '')
      .replace('#', '')
  });
}

QueueFactory.prototype.createQueue = function (userName, userBindingKeys, callback) {
  var queue = new Queue(userName, userBindingKeys, this.connection);
  queue.createQueue(callback);
  return queue;
}

function Queue(userName, userBindingKeys, connection) {
  this.userName = userName;
  this.userBindingKeys = userBindingKeys;
  this.connection = connection;
}

Queue.prototype.createQueue = function (callback) {
  var self = this;
  self.queue = Q.defer();
  self.consumerTag = Q.defer();
  var queueName = this.userName + '.queue';
  this.connection.queue(queueName, { durable: false, autoDelete: true, exclusive: true, closeChannelOnUnsubscribe: true }, function (queue) {
    console.log('Queue %s created', queueName);
    // resolve the promises
    self.queue.resolve(queue);
    // bind the queue to the tree exchange
    queue.bind('server.direct.exchange', queueName);
    queue.bind('server.fanout.exchange', '');
    self.userBindingKeys.forEach(function(element, index, array) {
      if(index === 0) {
        queue.bind('server.topic.exchange', element + '.*');
      } else if(index === array.length - 1) {
        queue.bind('server.topic.exchange', '*.' + element);
      } else {
        queue.bind('server.topic.exchange', '*.' + element + '.*');
      }
    });
    // subscribe to the queues
    queue.subscribe(callback)
      .addCallback(function (ok) {
        // resolve the promise
        self.consumerTag.resolve(ok.consumerTag);
      });
  });
}

Queue.prototype.destroy = function () {
  console.log('Destroy queue %s', this.userName + '.queue');
  if (this.queue !== undefined) {
    Q.all([this.queue.promise, this.consumerTag.promise])
      .spread(function (queue, consumerTag) {
        queue.unsubscribe(consumerTag); // should be called to close the channel
        queue.destroy();
      });
  }
};
