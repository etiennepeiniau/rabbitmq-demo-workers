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

QueueFactory.prototype.createBindingKey = function () {
  var args = Array.prototype.slice.call(arguments, 0);
  return args.map(function (value) {
    return slug(value)
      // removing rabbitmq special characters
      .replace('.', '')
      .replace('*', '')
      .replace('#', '')
  }).join('.');
}

QueueFactory.prototype.createQueue = function (userName, userBindingKey, callback) {
  var queue = new Queue(userName, userBindingKey, this.connection);
  queue.createQueue(callback);
  return queue;
}

function Queue(userName, userBindingKey, connection) {
  this.userName = userName;
  this.userBindingKey = userBindingKey;
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
    queue.bind('server.topic.exchange', self.userBindingKey);
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
