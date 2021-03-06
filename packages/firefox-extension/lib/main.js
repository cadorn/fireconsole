// ========================================================================
// FireConsole -- Firebug Extension for Comprehensive Logging
// Copyright ©2007-2010 Christoph Dorn licensed under MIT
// ========================================================================

function dump(obj) { print(require('test/jsdump').jsDump.parse(obj)) };

var UTIL = require("util");
var SANDBOX = require("sandbox").Sandbox;
var APP = require("app", "nr-common").getApp();
var FIREBUG_INTERFACE = require("interface", "firebug");
var FIREBUG_CONSOLE = require("console", "firebug");
var VARIABLE_VIEWER = require("./VariableViewer");
var MESSAGE_BUS = require("./MessageBus");
var OBJECT_GRAPH = require("./ObjectGraph");
var SECURITY = require("./Security");
var TEMPLATE_PACK = require("./TemplatePack");
var RENDERER = require("./Renderer");
var DEV = require("console", "dev-sidebar");
var URI = require("uri");
var JSON = require("json");
var RENDERER = require("./Renderer");


var INSIGHT_PLUGINS = require("./Insight/Plugins");
var INSIGHT_MESSAGEBUS = require("./Insight/MessageBus");
var INSIGHT_FIREBUG = require("./Insight/Firebug");


var FIREBUG_MIN_VERSION = "1.5";
var FORCE_REP_RELOAD = false;


exports.main = function(args) {


var message = 'Another pop-up blocked'
var nb = APP.getChrome().getBrowser().getNotificationBox()


/*
    DEV.action('Test Log', function() {
        
        DEV.log("Hello World");


        try {

        throw new Error("oops 1!!!");
            
        } catch(e) {
            system.log.error(e);
        }

        throw new Error("oops 2!!!");

    });
*/
    
/*    
    DEV.action('Dump Console HTML', function() {
        var panel = FIREBUG_INTERFACE.getActiveContext().getPanel("console");
        print(panel.document.documentElement.innerHTML);
    });
*/

/*    
    DEV.action('Reload Page', function() {
        FIREBUG_INTERFACE.enable();
        FIREBUG_INTERFACE.selectPanel('console');
        CHROME_UTIL.reloadPage();
    });
    DEV.action('Test Logging', function() {
        FIREBUG_INTERFACE.enable();
        FIREBUG_INTERFACE.selectPanel('console');
        FIREBUG_INTERFACE.getConsole().log('Hello World');
    });
*/

    SECURITY.initialize({
        "TemplatePackAuthorizationListener": TemplatePackAuthorizationListener
    });

    MESSAGE_BUS.initialize({
        "ConsoleMessageListener": ConsoleMessageListener,
        "TemplatePackReceiverListener": TemplatePackReceiverListener,
        "ContentEventListener": ContentEventListener
    });


    INSIGHT_PLUGINS.initialize();
    INSIGHT_MESSAGEBUS.initialize();
    INSIGHT_FIREBUG.initialize();


    // handle clean shutdown
/*    
    // TODO: We need an event that triggers on app exit, not browser window close/unload
    var onUnload  = function() {
        VARIABLE_VIEWER.shutdown();
        MESSAGE_BUS.shutdown();
        SECURITY.shutdown();
    }
    var window = APP.getChrome().getWindow();
    window.addEventListener("unload", onUnload, false);
*/

        
    // notify NarwhalRunner that application is loaded    
    APP.started(exports);
}

exports.chrome = function(chrome) {

    var notificationType = false;
    // ensure firebug is available
    if(!FIREBUG_INTERFACE.isAvailable()) {
        showNotification("Install");
        return; // do not initialize our chrome
    } else {
        // ensure firebug is at least version FIREBUG_MIN_VERSION+
        var version = FIREBUG_INTERFACE.getVersion().replace(/X/, "");
        var result = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator).compare(version, FIREBUG_MIN_VERSION);
        if(result<0) {
            showNotification("Upgrade");
            return; // do not initialize our chrome
        }
    }
    function showNotification(type) {
        var notificationBox = APP.getChrome().getBrowser().getNotificationBox();
        notificationBox.appendNotification(
            "You need Firebug 1.5+ to use FireConsole!",
            "fireconsole-upgrade-firebug",
            APP.getAppPackage().getTemplateVariables()["Package.SkinBaseURL"] + "FireConsole_16.png",
            notificationBox.PRIORITY_CRITICAL_HIGH, [
                {
                    label: type,
                    callback: function(notification, button) {
                        APP.getChrome().openNewTab("http://www.getfirebug.com/");
                    }
//                }, {
//                    label: 'Dismiss',
//                    callback: function(notification, button) {
//                        // TODO: set preference to not show notification again
//                    }
                }
            ]
        );
    }


    chrome.registerInstance("VariableViewer", new VARIABLE_VIEWER.VariableViewer());

    // Mark-up JS objects logged with __fc_tpl_id
    var renderer = RENDERER.factory({
        "template": "registry.pinf.org/cadorn.org/github/fireconsole/packages/firefox-extension/packages/reps/master#ConsoleMessage",
        "domain": function() {
            var context = FIREBUG_INTERFACE.getActiveContext();
            if(!context) return null;
            return context.window.location.hostname;
        },
        "cssTracker": FIREBUG_CONSOLE.getCSSTracker(),
        "document": function() {
            var context = FIREBUG_INTERFACE.getActiveContext();
            if(!context) return null;
            return context.getPanel('console').document;
        },
        "eventListener": ConsoleTemplateEventListener,
        "cacheTemplatePack": false
    });
    FIREBUG_INTERFACE.getFirebug().registerRep(renderer.getRep(true));
}

var ContentEventListener = {
    onEvent: function(window, eventName, params) {
        switch(eventName) {
            case "test":
                require("./TestRunner").run(FIREBUG_CONSOLE);
                break;
            case "registerTemplatePack":
                TEMPLATE_PACK.requirePack(window.location.hostname, TEMPLATE_PACK.newDescriptorForClientInfo(params.info));
                break;
        }
    }
}

var TemplatePackReceiverListener = {
    onMessageReceived: function(context, message) {
        try {
            var data = JSON.decode(message.getData());
            if(data.action=="require") {
                TEMPLATE_PACK.requirePack(context.FirebugNetMonitorListener.context.window.location.hostname, TEMPLATE_PACK.newDescriptorForClientInfo(data));
            }
        } catch(e) {
            system.log.warn(e);
        }
    }
}

var TemplatePackAuthorizationListener = {
    isAuthorizing: false,
    onAuthorize: function(domain, descriptor) {
        this.isAuthorizing = true;
    },
    onDismiss: function(domain, descriptor) {
        this.isAuthorizing = false;
        if(ConsoleMessageListener.buffer.length>0) {
            FIREBUG_CONSOLE.info("[FireConsole] Discarding message as required template pack is not authorized to load.");
            ConsoleMessageListener.buffer = [];
        }
    },
    onAccept: function(domain, descriptor) {
        this.isAuthorizing = false;
        if(ConsoleMessageListener.buffer.length>0) {
            try {
                for( var i=0 ; i<ConsoleMessageListener.buffer.length ; i++ ) {
                    logMessage(ConsoleMessageListener.buffer[i][0], ConsoleMessageListener.buffer[i][1]);
                }
                ConsoleMessageListener.buffer = [];
            } catch(e) {
                system.log.warn(e);

                FIREBUG_CONSOLE.error("[FireConsole] Error while logging buffered template", e);
            }
        }        
    }
};

var ConsoleMessageListener = {

    buffer: [],

    onMessageGroupStart: function(context) {
        var renderer = RENDERER.factory({
            "template": "registry.pinf.org/cadorn.org/github/fireconsole/packages/firefox-extension/packages/reps/master#ConsoleOpenMessageGroup",
            "domain": URI.parse(context.FirebugNetMonitorListener.file.href).domain,
            "cssTracker": FIREBUG_CONSOLE.getCSSTracker()
        });
        FIREBUG_CONSOLE.logRep(renderer.getRep(), {
            "url": context.FirebugNetMonitorListener.file.href
        }, context.FirebugNetMonitorListener.context);
    },
    
    onMessageGroupEnd: function(context) {
        var renderer = RENDERER.factory({
            "template": "registry.pinf.org/cadorn.org/github/fireconsole/packages/firefox-extension/packages/reps/master#ConsoleCloseGroup",
            "domain": URI.parse(context.FirebugNetMonitorListener.file.href).domain,
            "cssTracker": FIREBUG_CONSOLE.getCSSTracker()
        });
        FIREBUG_CONSOLE.logRep(renderer.getRep(), null, context.FirebugNetMonitorListener.context);
    },

    onMessageReceived: function(context, message) {
        try {
            
            var data = {
                "og": OBJECT_GRAPH.generateFromMessage(message),
                "meta": JSON.decode(message.getMeta() || "{}"),
                "domain": URI.parse(context.FirebugNetMonitorListener.file.href).domain
            }

            logMessage(context, data);
            
        } catch(e) {
            
            if(TemplatePackAuthorizationListener.isAuthorizing) {
                // do not log error message yet - we are approving a template pack
                this.buffer.push([context, data]);
            } else {
                system.log.warn(e);

                FIREBUG_CONSOLE.error("[FireConsole] Error while logging template", e);
            }
        }
    }
}

function logMessage(context, data) {
    var renderer = RENDERER.factory({
        "template": "registry.pinf.org/cadorn.org/github/fireconsole/packages/firefox-extension/packages/reps/master#ConsoleMessage",
        "domain": URI.parse(context.FirebugNetMonitorListener.file.href).domain,
        "meta": data.meta,
        "cssTracker": FIREBUG_CONSOLE.getCSSTracker(),
        "eventListener": ConsoleTemplateEventListener
    });
    FIREBUG_CONSOLE.logRep(renderer.getRep(), data, context.FirebugNetMonitorListener.context);
}


var ConsoleTemplateEventListener =  {
    onEvent: function(name, args) {
        if(name=="click") {
            APP.getChrome().getInstance("VariableViewer").showFromConsoleRow(args[1]);           
        }
    }
}
