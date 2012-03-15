var express = require('express');
var http = require('http');
var Future = require('fibers/future');
var fs = require('fs');
var stat = Future.wrap(fs.stat);

var app = express.createServer();

var original_get = app.get;

app.get = function(path, cb) {
  original_get.call(app, path, function(req, res) {
    Fiber(function() {
      try {
        cb(req, res);
      } catch (e) {
        console.log("Error", e.message);
        console.log("Stack", e.stack);
        res.send("Errorz", 503);
      }
    }).run();
  });
};

function get_async(options) {
  var future = new Future();
  http.get(options, function(res) {
    var buf = "";
    res.on("data", function(data) {
      buf += data.toString();
    });

    res.on("end", function() {
      future.return(buf);
    });

    res.on("close", function(e) {
      future.throw(e);
    });

  }).on("error", function(e) {
    future.throw(e);
  });
  
  return future;
};

function get(options) {
  try {
    return get_async(options).wait();
  } catch (e) {
    // dodgy hack for nicer stacktraces. must be doing something wrong :(
    e.stack = new Error().stack;
    throw e;
  }
};

app.get('/', function(req, res) {
  var response = get({host: 'google.com'});
  console.log(response);
  res.send("hello world: " + response.length);
});

app.get('/error', function(req, res) {
  throw new Error("lols");
});

app.get('/crash', function(req, res) {
  var response = get({host: 'google.com'});
  get({host: 'localhost', port: 6666});
});

app.get('/crash2', function(req, res) {
  stat("/tmp/doesnotexist").wait();
});

app.listen(3000);
