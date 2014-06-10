'use strict';

// dependencies
var Q = require('q');

// export the module
module.exports = {
  factory: function (connection) {
    return new QueueFactory(connection);
  }
}

function QueueFactory(connection) {
  this.connection = connection;
}

QueueFactory.prototype.createQueue = function (userName, userBindingKey, callback) {
  var queueManager = new QueueManager(userName, userBindingKey, this.connection);
  queueManager.createQueue(callback);
  return queueManager;
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
    queue.bind('rabbitmq.demo.direct', queueName);
    queue.bind('rabbitmq.demo.fanout', '');
    queue.bind('rabbitmq.demo.topic', self.userBindingKey);
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
    this.queue.promise.unsubscribe(this.consumerTag.promise); // should be called to close the channel
    this.queue.promise.destroy();
  }
}