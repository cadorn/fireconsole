
(function(){

var listeners = [];

var FireConsoleAPI = function() {};

FireConsoleAPI.prototype.getVersion = function() {
    return top.FireConsole.version;
}

FireConsoleAPI.prototype.test = function(suite) {
    dispatchChromeEvent("test", {
        "suite": suite
    });
}

FireConsoleAPI.prototype.getPath = function(name) {
    return "/path/to/reps";
}

FireConsoleAPI.prototype.setPath = function(name, value) {
    // TODO
    console.log("set path for "+name+" to "+value);        
    
    dispatchPageEvent("path-updated", {"name": name});
}

FireConsoleAPI.prototype.bind = function(eventName, callback) {
    // TODO: check for duplicates
    listeners.push([eventName, callback]);
}

top.FireConsoleAPI = new FireConsoleAPI();


// fire ready event
var event = top.document.createEvent("Events");
event.initEvent("fireconsole-api-ready", true, false);
top.document.dispatchEvent(event);   

function dispatchChromeEvent(name, params) {
    var element = top.document.createElement("FireConsoleContentEvenData");
    element.setAttribute("___eventName", name);
    element.setAttribute("params", (params || ""));
    top.document.documentElement.appendChild(element);
    
    var evt = top.document.createEvent("Events");
    evt.initEvent("FireConsoleContentEvent", true, false);
    element.dispatchEvent(evt);
}

function dispatchPageEvent(name, params) {
    
    var event = {
        "name": name,
        "params": params
    };
    
    for( var i=0 ; i<listeners.length ; i++ ) {
        if(listeners[i][0]==name) {
            listeners[i][1](event);
        }
    }
}

})();