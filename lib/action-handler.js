'use strict';

// export the module
var ActionHandler = module.exports = function ActionHandler(socket) {
  this.socket = socket;
}

ActionHandler.prototype.handle = function (action) {
  if(action.value !== undefined) {
    console.log('Handling action: %s - %s', action.type, action.value.toString());
    this.socket.emit('workers', { type: action.type, value: action.value.toString() });
  } else {
    console.log('Handling action: %s - no value', action.type);
    this.socket.emit('workers', { type: action.type });
  }
}