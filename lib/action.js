'use strict';

// export the constructor
var Action = module.exports = function Action(type, value) {
  this.type = type;
  this.value = value;
}