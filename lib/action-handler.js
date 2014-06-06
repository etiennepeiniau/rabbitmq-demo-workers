'use strict';

// export the module
var ActionHandler = module.exports = function ActionHandler(socket) {
  this.socket = socket;
}

ActionHandler.prototype.handle = function (action) {
  console.log('Handling action: %s - %s', action.type, action.value.toString());
  this.socket.emit('workers', { type: action.type, value: action.value.toString() });
}