const EventEmitter = require('events');

const emitter = new EventEmitter();
emitter.on("fired", event => {
   console.log(event);
});

emitter.emit("fired", "1");
emitter.emit("fired", "2");
emitter.emit("fired_other", "3");
