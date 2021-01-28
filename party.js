const io = require('socket.io');
var server = undefined

function makeServer(http) {
    server = io(http)
    
}

module.exports= {

}