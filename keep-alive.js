var server = http.createServer(function(req, res){
  res.end('up');
});

server.listen(process.env.PORT, function(){
    console.log("Server listening on: http://localhost:%s", process.env.PORT || 3000);
});

var http = require("http");
setInterval(function() {
    http.get("http://gocodebot.herokuapp.com");
}, 300000); // every 5 minutes
