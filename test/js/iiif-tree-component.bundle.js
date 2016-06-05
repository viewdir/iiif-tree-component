// base-component v1.0.1 https://github.com/edsilv/base-component#readme
/*!
 * EventEmitter2
 * https://github.com/hij1nx/EventEmitter2
 *
 * Copyright (c) 2013 hij1nx
 * Licensed under the MIT license.
 */
;!function(undefined) {

  var isArray = Array.isArray ? Array.isArray : function _isArray(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };
  var defaultMaxListeners = 10;

  function init() {
    this._events = {};
    if (this._conf) {
      configure.call(this, this._conf);
    }
  }

  function configure(conf) {
    if (conf) {

      this._conf = conf;

      conf.delimiter && (this.delimiter = conf.delimiter);
      conf.maxListeners && (this._events.maxListeners = conf.maxListeners);
      conf.wildcard && (this.wildcard = conf.wildcard);
      conf.newListener && (this.newListener = conf.newListener);

      if (this.wildcard) {
        this.listenerTree = {};
      }
    }
  }

  function EventEmitter(conf) {
    this._events = {};
    this.newListener = false;
    configure.call(this, conf);
  }
  EventEmitter.EventEmitter2 = EventEmitter; // backwards compatibility for exporting EventEmitter property

  //
  // Attention, function return type now is array, always !
  // It has zero elements if no any matches found and one or more
  // elements (leafs) if there are matches
  //
  function searchListenerTree(handlers, type, tree, i) {
    if (!tree) {
      return [];
    }
    var listeners=[], leaf, len, branch, xTree, xxTree, isolatedBranch, endReached,
        typeLength = type.length, currentType = type[i], nextType = type[i+1];
    if (i === typeLength && tree._listeners) {
      //
      // If at the end of the event(s) list and the tree has listeners
      // invoke those listeners.
      //
      if (typeof tree._listeners === 'function') {
        handlers && handlers.push(tree._listeners);
        return [tree];
      } else {
        for (leaf = 0, len = tree._listeners.length; leaf < len; leaf++) {
          handlers && handlers.push(tree._listeners[leaf]);
        }
        return [tree];
      }
    }

    if ((currentType === '*' || currentType === '**') || tree[currentType]) {
      //
      // If the event emitted is '*' at this part
      // or there is a concrete match at this patch
      //
      if (currentType === '*') {
        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+1));
          }
        }
        return listeners;
      } else if(currentType === '**') {
        endReached = (i+1 === typeLength || (i+2 === typeLength && nextType === '*'));
        if(endReached && tree._listeners) {
          // The next element has a _listeners, add it to the handlers.
          listeners = listeners.concat(searchListenerTree(handlers, type, tree, typeLength));
        }

        for (branch in tree) {
          if (branch !== '_listeners' && tree.hasOwnProperty(branch)) {
            if(branch === '*' || branch === '**') {
              if(tree[branch]._listeners && !endReached) {
                listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], typeLength));
              }
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            } else if(branch === nextType) {
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i+2));
            } else {
              // No match on this one, shift into the tree but not in the type array.
              listeners = listeners.concat(searchListenerTree(handlers, type, tree[branch], i));
            }
          }
        }
        return listeners;
      }

      listeners = listeners.concat(searchListenerTree(handlers, type, tree[currentType], i+1));
    }

    xTree = tree['*'];
    if (xTree) {
      //
      // If the listener tree will allow any match for this part,
      // then recursively explore all branches of the tree
      //
      searchListenerTree(handlers, type, xTree, i+1);
    }

    xxTree = tree['**'];
    if(xxTree) {
      if(i < typeLength) {
        if(xxTree._listeners) {
          // If we have a listener on a '**', it will catch all, so add its handler.
          searchListenerTree(handlers, type, xxTree, typeLength);
        }

        // Build arrays of matching next branches and others.
        for(branch in xxTree) {
          if(branch !== '_listeners' && xxTree.hasOwnProperty(branch)) {
            if(branch === nextType) {
              // We know the next element will match, so jump twice.
              searchListenerTree(handlers, type, xxTree[branch], i+2);
            } else if(branch === currentType) {
              // Current node matches, move into the tree.
              searchListenerTree(handlers, type, xxTree[branch], i+1);
            } else {
              isolatedBranch = {};
              isolatedBranch[branch] = xxTree[branch];
              searchListenerTree(handlers, type, { '**': isolatedBranch }, i+1);
            }
          }
        }
      } else if(xxTree._listeners) {
        // We have reached the end and still on a '**'
        searchListenerTree(handlers, type, xxTree, typeLength);
      } else if(xxTree['*'] && xxTree['*']._listeners) {
        searchListenerTree(handlers, type, xxTree['*'], typeLength);
      }
    }

    return listeners;
  }

  function growListenerTree(type, listener) {

    type = typeof type === 'string' ? type.split(this.delimiter) : type.slice();

    //
    // Looks for two consecutive '**', if so, don't add the event at all.
    //
    for(var i = 0, len = type.length; i+1 < len; i++) {
      if(type[i] === '**' && type[i+1] === '**') {
        return;
      }
    }

    var tree = this.listenerTree;
    var name = type.shift();

    while (name) {

      if (!tree[name]) {
        tree[name] = {};
      }

      tree = tree[name];

      if (type.length === 0) {

        if (!tree._listeners) {
          tree._listeners = listener;
        }
        else if(typeof tree._listeners === 'function') {
          tree._listeners = [tree._listeners, listener];
        }
        else if (isArray(tree._listeners)) {

          tree._listeners.push(listener);

          if (!tree._listeners.warned) {

            var m = defaultMaxListeners;

            if (typeof this._events.maxListeners !== 'undefined') {
              m = this._events.maxListeners;
            }

            if (m > 0 && tree._listeners.length > m) {

              tree._listeners.warned = true;
              console.error('(node) warning: possible EventEmitter memory ' +
                            'leak detected. %d listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit.',
                            tree._listeners.length);
              if(console.trace){
                console.trace();
              }
            }
          }
        }
        return true;
      }
      name = type.shift();
    }
    return true;
  }

  // By default EventEmitters will print a warning if more than
  // 10 listeners are added to it. This is a useful default which
  // helps finding memory leaks.
  //
  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.

  EventEmitter.prototype.delimiter = '.';

  EventEmitter.prototype.setMaxListeners = function(n) {
    this._events || init.call(this);
    this._events.maxListeners = n;
    if (!this._conf) this._conf = {};
    this._conf.maxListeners = n;
  };

  EventEmitter.prototype.event = '';

  EventEmitter.prototype.once = function(event, fn) {
    this.many(event, 1, fn);
    return this;
  };

  EventEmitter.prototype.many = function(event, ttl, fn) {
    var self = this;

    if (typeof fn !== 'function') {
      throw new Error('many only accepts instances of Function');
    }

    function listener() {
      if (--ttl === 0) {
        self.off(event, listener);
      }
      fn.apply(this, arguments);
    }

    listener._origin = fn;

    this.on(event, listener);

    return self;
  };

  EventEmitter.prototype.emit = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
      if (!this._events.newListener) {
        return false;
      }
    }

    var al = arguments.length;
    var args,l,i,j;
    var handler;

    if (this._all && this._all.length) {
      handler = this._all.slice();
      if (al > 3) {
        args = new Array(al);
        for (j = 1; j < al; j++) args[j] = arguments[j];
      }

      for (i = 0, l = handler.length; i < l; i++) {
        this.event = type;
        switch (al) {
        case 1:
          handler[i].call(this, type);
          break;
        case 2:
          handler[i].call(this, type, arguments[1]);
          break;
        case 3:
          handler[i].call(this, type, arguments[1], arguments[2]);
          break;
        default:
          handler[i].apply(this, args);
        }
      }
    }

    if (this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    } else {
      handler = this._events[type];
      if (typeof handler === 'function') {
        this.event = type;
        switch (al) {
        case 1:
          handler.call(this);
          break;
        case 2:
          handler.call(this, arguments[1]);
          break;
        case 3:
          handler.call(this, arguments[1], arguments[2]);
          break;
        default:
          args = new Array(al - 1);
          for (j = 1; j < al; j++) args[j - 1] = arguments[j];
          handler.apply(this, args);
        }
        return true;
      } else if (handler) {
        // need to make copy of handlers because list can change in the middle
        // of emit call
        handler = handler.slice();
      }
    }

    if (handler && handler.length) {
      if (al > 3) {
        args = new Array(al - 1);
        for (j = 1; j < al; j++) args[j - 1] = arguments[j];
      }
      for (i = 0, l = handler.length; i < l; i++) {
        this.event = type;
        switch (al) {
        case 1:
          handler[i].call(this);
          break;
        case 2:
          handler[i].call(this, arguments[1]);
          break;
        case 3:
          handler[i].call(this, arguments[1], arguments[2]);
          break;
        default:
          handler[i].apply(this, args);
        }
      }
      return true;
    } else if (!this._all && type === 'error') {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }

    return !!this._all;
  };

  EventEmitter.prototype.emitAsync = function() {

    this._events || init.call(this);

    var type = arguments[0];

    if (type === 'newListener' && !this.newListener) {
        if (!this._events.newListener) { return Promise.resolve([false]); }
    }

    var promises= [];

    var al = arguments.length;
    var args,l,i,j;
    var handler;

    if (this._all) {
      if (al > 3) {
        args = new Array(al);
        for (j = 1; j < al; j++) args[j] = arguments[j];
      }
      for (i = 0, l = this._all.length; i < l; i++) {
        this.event = type;
        switch (al) {
        case 1:
          promises.push(this._all[i].call(this, type));
          break;
        case 2:
          promises.push(this._all[i].call(this, type, arguments[1]));
          break;
        case 3:
          promises.push(this._all[i].call(this, type, arguments[1], arguments[2]));
          break;
        default:
          promises.push(this._all[i].apply(this, args));
        }
      }
    }

    if (this.wildcard) {
      handler = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handler, ns, this.listenerTree, 0);
    } else {
      handler = this._events[type];
    }

    if (typeof handler === 'function') {
      this.event = type;
      switch (al) {
      case 1:
        promises.push(handler.call(this));
        break;
      case 2:
        promises.push(handler.call(this, arguments[1]));
        break;
      case 3:
        promises.push(handler.call(this, arguments[1], arguments[2]));
        break;
      default:
        args = new Array(al - 1);
        for (j = 1; j < al; j++) args[j - 1] = arguments[j];
        promises.push(handler.apply(this, args));
      }
    } else if (handler && handler.length) {
      if (al > 3) {
        args = new Array(al - 1);
        for (j = 1; j < al; j++) args[j - 1] = arguments[j];
      }
      for (i = 0, l = handler.length; i < l; i++) {
        this.event = type;
        switch (al) {
        case 1:
          promises.push(handler[i].call(this));
          break;
        case 2:
          promises.push(handler[i].call(this, arguments[1]));
          break;
        case 3:
          promises.push(handler[i].call(this, arguments[1], arguments[2]));
          break;
        default:
          promises.push(handler[i].apply(this, args));
        }
      }
    } else if (!this._all && type === 'error') {
      if (arguments[1] instanceof Error) {
        return Promise.reject(arguments[1]); // Unhandled 'error' event
      } else {
        return Promise.reject("Uncaught, unspecified 'error' event.");
      }
    }

    return Promise.all(promises);
  };

  EventEmitter.prototype.on = function(type, listener) {

    if (typeof type === 'function') {
      this.onAny(type);
      return this;
    }

    if (typeof listener !== 'function') {
      throw new Error('on only accepts instances of Function');
    }
    this._events || init.call(this);

    // To avoid recursion in the case that type == "newListeners"! Before
    // adding it to the listeners, first emit "newListeners".
    this.emit('newListener', type, listener);

    if(this.wildcard) {
      growListenerTree.call(this, type, listener);
      return this;
    }

    if (!this._events[type]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    }
    else if(typeof this._events[type] === 'function') {
      // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];
    }
    else if (isArray(this._events[type])) {
      // If we've already got an array, just append.
      this._events[type].push(listener);

      // Check for listener leak
      if (!this._events[type].warned) {

        var m = defaultMaxListeners;

        if (typeof this._events.maxListeners !== 'undefined') {
          m = this._events.maxListeners;
        }

        if (m > 0 && this._events[type].length > m) {

          this._events[type].warned = true;
          console.error('(node) warning: possible EventEmitter memory ' +
                        'leak detected. %d listeners added. ' +
                        'Use emitter.setMaxListeners() to increase limit.',
                        this._events[type].length);
          if(console.trace){
            console.trace();
          }
        }
      }
    }
    return this;
  };

  EventEmitter.prototype.onAny = function(fn) {

    if (typeof fn !== 'function') {
      throw new Error('onAny only accepts instances of Function');
    }

    if(!this._all) {
      this._all = [];
    }

    // Add the function to the event listener collection.
    this._all.push(fn);
    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  EventEmitter.prototype.off = function(type, listener) {
    if (typeof listener !== 'function') {
      throw new Error('removeListener only takes instances of Function');
    }

    var handlers,leafs=[];

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);
    }
    else {
      // does not use listeners(), so no side effect of creating _events[type]
      if (!this._events[type]) return this;
      handlers = this._events[type];
      leafs.push({_listeners:handlers});
    }

    for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
      var leaf = leafs[iLeaf];
      handlers = leaf._listeners;
      if (isArray(handlers)) {

        var position = -1;

        for (var i = 0, length = handlers.length; i < length; i++) {
          if (handlers[i] === listener ||
            (handlers[i].listener && handlers[i].listener === listener) ||
            (handlers[i]._origin && handlers[i]._origin === listener)) {
            position = i;
            break;
          }
        }

        if (position < 0) {
          continue;
        }

        if(this.wildcard) {
          leaf._listeners.splice(position, 1);
        }
        else {
          this._events[type].splice(position, 1);
        }

        if (handlers.length === 0) {
          if(this.wildcard) {
            delete leaf._listeners;
          }
          else {
            delete this._events[type];
          }
        }

        this.emit("removeListener", type, listener);

        return this;
      }
      else if (handlers === listener ||
        (handlers.listener && handlers.listener === listener) ||
        (handlers._origin && handlers._origin === listener)) {
        if(this.wildcard) {
          delete leaf._listeners;
        }
        else {
          delete this._events[type];
        }

        this.emit("removeListener", type, listener);
      }
    }

    function recursivelyGarbageCollect(root) {
      if (root === undefined) {
        return;
      }
      var keys = Object.keys(root);
      for (var i in keys) {
        var key = keys[i];
        var obj = root[key];
        if ((obj instanceof Function) || (typeof obj !== "object"))
          continue;
        if (Object.keys(obj).length > 0) {
          recursivelyGarbageCollect(root[key]);
        }
        if (Object.keys(obj).length === 0) {
          delete root[key];
        }
      }
    }
    recursivelyGarbageCollect(this.listenerTree);

    return this;
  };

  EventEmitter.prototype.offAny = function(fn) {
    var i = 0, l = 0, fns;
    if (fn && this._all && this._all.length > 0) {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++) {
        if(fn === fns[i]) {
          fns.splice(i, 1);
          this.emit("removeListenerAny", fn);
          return this;
        }
      }
    } else {
      fns = this._all;
      for(i = 0, l = fns.length; i < l; i++)
        this.emit("removeListenerAny", fns[i]);
      this._all = [];
    }
    return this;
  };

  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;

  EventEmitter.prototype.removeAllListeners = function(type) {
    if (arguments.length === 0) {
      !this._events || init.call(this);
      return this;
    }

    if(this.wildcard) {
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      var leafs = searchListenerTree.call(this, null, ns, this.listenerTree, 0);

      for (var iLeaf=0; iLeaf<leafs.length; iLeaf++) {
        var leaf = leafs[iLeaf];
        leaf._listeners = null;
      }
    }
    else {
      if (!this._events || !this._events[type]) return this;
      this._events[type] = null;
    }
    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    if(this.wildcard) {
      var handlers = [];
      var ns = typeof type === 'string' ? type.split(this.delimiter) : type.slice();
      searchListenerTree.call(this, handlers, ns, this.listenerTree, 0);
      return handlers;
    }

    this._events || init.call(this);

    if (!this._events[type]) this._events[type] = [];
    if (!isArray(this._events[type])) {
      this._events[type] = [this._events[type]];
    }
    return this._events[type];
  };

  EventEmitter.prototype.listenersAny = function() {

    if(this._all) {
      return this._all;
    }
    else {
      return [];
    }

  };

  if (typeof define === 'function' && define.amd) {
     // AMD. Register as an anonymous module.
    define(function() {
      return EventEmitter;
    });
  } else if (typeof exports === 'object') {
    // CommonJS
    module.exports = EventEmitter;
  }
  else {
    // Browser global.
    window.EventEmitter2 = EventEmitter;
  }
}();

!function(f){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=f();else if("function"==typeof define&&define.amd)define([],f);else{var g;g="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,g.baseComponent=f()}}(function(){return function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a="function"==typeof require&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}for(var i="function"==typeof require&&require,o=0;o<r.length;o++)s(r[o]);return s}({1:[function(require,module,exports){var Components;!function(Components){function applyMixins(derivedCtor,baseCtors){baseCtors.forEach(function(baseCtor){Object.getOwnPropertyNames(baseCtor.prototype).forEach(function(name){derivedCtor.prototype[name]=baseCtor.prototype[name]})})}var BaseComponent=function(){function BaseComponent(options){this.options=$.extend(this._getDefaultOptions(),options)}return BaseComponent.prototype._init=function(){return this._$element=$(this.options.element),this._$element.length?(this._$element.empty(),!0):(console.warn("element not found"),!1)},BaseComponent.prototype._getDefaultOptions=function(){return{}},BaseComponent.prototype._emit=function(event){for(var args=[],_i=1;_i<arguments.length;_i++)args[_i-1]=arguments[_i];this.emit(event,args)},BaseComponent.prototype._resize=function(){},BaseComponent}();Components.BaseComponent=BaseComponent,Components.applyMixins=applyMixins,applyMixins(BaseComponent,[EventEmitter2])}(Components||(Components={})),function(w){w.Components||(w.Components=Components)}(window)},{}]},{},[1])(1)});
// utils v0.0.37 https://github.com/edsilv/utils
var Utils;!function(Utils){var Async=function(){function Async(){}return Async.waitFor=function(test,successCallback,failureCallback,interval,maxTries,numTries){interval||(interval=200),maxTries||(maxTries=100),numTries||(numTries=0),numTries+=1,numTries>maxTries?failureCallback&&failureCallback():test()?successCallback():setTimeout(function(){Async.waitFor(test,successCallback,failureCallback,interval,maxTries,numTries)},interval)},Async}();Utils.Async=Async}(Utils||(Utils={}));var Utils;!function(Utils){var Bools=function(){function Bools(){}return Bools.getBool=function(val,defaultVal){return null===val||"undefined"==typeof val?defaultVal:val},Bools}();Utils.Bools=Bools}(Utils||(Utils={}));var Utils;!function(Utils){var Clipboard=function(){function Clipboard(){}return Clipboard.copy=function(text){var $tempDiv=$("<div style='position:absolute;left:-9999px'>"),brRegex=/<br\s*[\/]?>/gi;text=text.replace(brRegex,"\n"),$("body").append($tempDiv),$tempDiv.append(text);var $tempInput=$("<textarea>");$tempDiv.append($tempInput),$tempInput.val($tempDiv.text()).select(),document.execCommand("copy"),$tempDiv.remove()},Clipboard.supportsCopy=function(){return document.queryCommandSupported&&document.queryCommandSupported("copy")},Clipboard}();Utils.Clipboard=Clipboard}(Utils||(Utils={}));var __extends=this&&this.__extends||function(d,b){function __(){this.constructor=d}for(var p in b)b.hasOwnProperty(p)&&(d[p]=b[p]);d.prototype=null===b?Object.create(b):(__.prototype=b.prototype,new __)},Utils;!function(Utils){var Collections;!function(Collections){function defaultCompare(a,b){return b>a?-1:a===b?0:1}function defaultEquals(a,b){return a===b}function defaultToString(item){return null===item?"COLLECTION_NULL":collections.isUndefined(item)?"COLLECTION_UNDEFINED":collections.isString(item)?"$s"+item:"$o"+item.toString()}function makeString(item,join){if(void 0===join&&(join=","),null===item)return"COLLECTION_NULL";if(collections.isUndefined(item))return"COLLECTION_UNDEFINED";if(collections.isString(item))return item.toString();var toret="{",first=!0;for(var prop in item)has(item,prop)&&(first?first=!1:toret+=join,toret=toret+prop+":"+item[prop]);return toret+"}"}function isFunction(func){return"function"==typeof func}function isUndefined(obj){return"undefined"==typeof obj}function isString(obj){return"[object String]"===Object.prototype.toString.call(obj)}function reverseCompareFunction(compareFunction){return collections.isFunction(compareFunction)?function(d,v){return-1*compareFunction(d,v)}:function(a,b){return b>a?1:a===b?0:-1}}function compareToEquals(compareFunction){return function(a,b){return 0===compareFunction(a,b)}}var collections=Collections,_hasOwnProperty=Object.prototype.hasOwnProperty,has=function(obj,prop){return _hasOwnProperty.call(obj,prop)};Collections.defaultCompare=defaultCompare,Collections.defaultEquals=defaultEquals,Collections.defaultToString=defaultToString,Collections.makeString=makeString,Collections.isFunction=isFunction,Collections.isUndefined=isUndefined,Collections.isString=isString,Collections.reverseCompareFunction=reverseCompareFunction,Collections.compareToEquals=compareToEquals;var arrays;!function(arrays){function indexOf(array,item,equalsFunction){for(var equals=equalsFunction||collections.defaultEquals,length=array.length,i=0;length>i;i++)if(equals(array[i],item))return i;return-1}function lastIndexOf(array,item,equalsFunction){for(var equals=equalsFunction||collections.defaultEquals,length=array.length,i=length-1;i>=0;i--)if(equals(array[i],item))return i;return-1}function contains(array,item,equalsFunction){return arrays.indexOf(array,item,equalsFunction)>=0}function remove(array,item,equalsFunction){var index=arrays.indexOf(array,item,equalsFunction);return 0>index?!1:(array.splice(index,1),!0)}function frequency(array,item,equalsFunction){for(var equals=equalsFunction||collections.defaultEquals,length=array.length,freq=0,i=0;length>i;i++)equals(array[i],item)&&freq++;return freq}function equals(array1,array2,equalsFunction){var equals=equalsFunction||collections.defaultEquals;if(array1.length!==array2.length)return!1;for(var length=array1.length,i=0;length>i;i++)if(!equals(array1[i],array2[i]))return!1;return!0}function copy(array){return array.concat()}function swap(array,i,j){if(0>i||i>=array.length||0>j||j>=array.length)return!1;var temp=array[i];return array[i]=array[j],array[j]=temp,!0}function toString(array){return"["+array.toString()+"]"}function forEach(array,callback){for(var lenght=array.length,i=0;lenght>i;i++)if(callback(array[i])===!1)return}arrays.indexOf=indexOf,arrays.lastIndexOf=lastIndexOf,arrays.contains=contains,arrays.remove=remove,arrays.frequency=frequency,arrays.equals=equals,arrays.copy=copy,arrays.swap=swap,arrays.toString=toString,arrays.forEach=forEach}(arrays=Collections.arrays||(Collections.arrays={}));var LinkedList=function(){function LinkedList(){this.firstNode=null,this.lastNode=null,this.nElements=0}return LinkedList.prototype.add=function(item,index){if(collections.isUndefined(index)&&(index=this.nElements),0>index||index>this.nElements||collections.isUndefined(item))return!1;var newNode=this.createNode(item);if(0===this.nElements)this.firstNode=newNode,this.lastNode=newNode;else if(index===this.nElements)this.lastNode.next=newNode,this.lastNode=newNode;else if(0===index)newNode.next=this.firstNode,this.firstNode=newNode;else{var prev=this.nodeAtIndex(index-1);newNode.next=prev.next,prev.next=newNode}return this.nElements++,!0},LinkedList.prototype.first=function(){return null!==this.firstNode?this.firstNode.element:void 0},LinkedList.prototype.last=function(){return null!==this.lastNode?this.lastNode.element:void 0},LinkedList.prototype.elementAtIndex=function(index){var node=this.nodeAtIndex(index);if(null!==node)return node.element},LinkedList.prototype.indexOf=function(item,equalsFunction){var equalsF=equalsFunction||collections.defaultEquals;if(collections.isUndefined(item))return-1;for(var currentNode=this.firstNode,index=0;null!==currentNode;){if(equalsF(currentNode.element,item))return index;index++,currentNode=currentNode.next}return-1},LinkedList.prototype.contains=function(item,equalsFunction){return this.indexOf(item,equalsFunction)>=0},LinkedList.prototype.remove=function(item,equalsFunction){var equalsF=equalsFunction||collections.defaultEquals;if(this.nElements<1||collections.isUndefined(item))return!1;for(var previous=null,currentNode=this.firstNode;null!==currentNode;){if(equalsF(currentNode.element,item))return currentNode===this.firstNode?(this.firstNode=this.firstNode.next,currentNode===this.lastNode&&(this.lastNode=null)):currentNode===this.lastNode?(this.lastNode=previous,previous.next=currentNode.next,currentNode.next=null):(previous.next=currentNode.next,currentNode.next=null),this.nElements--,!0;previous=currentNode,currentNode=currentNode.next}return!1},LinkedList.prototype.clear=function(){this.firstNode=null,this.lastNode=null,this.nElements=0},LinkedList.prototype.equals=function(other,equalsFunction){var eqF=equalsFunction||collections.defaultEquals;return other instanceof collections.LinkedList?this.size()!==other.size()?!1:this.equalsAux(this.firstNode,other.firstNode,eqF):!1},LinkedList.prototype.equalsAux=function(n1,n2,eqF){for(;null!==n1;){if(!eqF(n1.element,n2.element))return!1;n1=n1.next,n2=n2.next}return!0},LinkedList.prototype.removeElementAtIndex=function(index){if(!(0>index||index>=this.nElements)){var element;if(1===this.nElements)element=this.firstNode.element,this.firstNode=null,this.lastNode=null;else{var previous=this.nodeAtIndex(index-1);null===previous?(element=this.firstNode.element,this.firstNode=this.firstNode.next):previous.next===this.lastNode&&(element=this.lastNode.element,this.lastNode=previous),null!==previous&&(element=previous.next.element,previous.next=previous.next.next)}return this.nElements--,element}},LinkedList.prototype.forEach=function(callback){for(var currentNode=this.firstNode;null!==currentNode&&callback(currentNode.element)!==!1;)currentNode=currentNode.next},LinkedList.prototype.reverse=function(){for(var previous=null,current=this.firstNode,temp=null;null!==current;)temp=current.next,current.next=previous,previous=current,current=temp;temp=this.firstNode,this.firstNode=this.lastNode,this.lastNode=temp},LinkedList.prototype.toArray=function(){for(var array=[],currentNode=this.firstNode;null!==currentNode;)array.push(currentNode.element),currentNode=currentNode.next;return array},LinkedList.prototype.size=function(){return this.nElements},LinkedList.prototype.isEmpty=function(){return this.nElements<=0},LinkedList.prototype.toString=function(){return collections.arrays.toString(this.toArray())},LinkedList.prototype.nodeAtIndex=function(index){if(0>index||index>=this.nElements)return null;if(index===this.nElements-1)return this.lastNode;for(var node=this.firstNode,i=0;index>i;i++)node=node.next;return node},LinkedList.prototype.createNode=function(item){return{element:item,next:null}},LinkedList}();Collections.LinkedList=LinkedList;var Dictionary=function(){function Dictionary(toStrFunction){this.table={},this.nElements=0,this.toStr=toStrFunction||collections.defaultToString}return Dictionary.prototype.getValue=function(key){var pair=this.table["$"+this.toStr(key)];if(!collections.isUndefined(pair))return pair.value},Dictionary.prototype.setValue=function(key,value){if(!collections.isUndefined(key)&&!collections.isUndefined(value)){var ret,k="$"+this.toStr(key),previousElement=this.table[k];return collections.isUndefined(previousElement)?(this.nElements++,ret=void 0):ret=previousElement.value,this.table[k]={key:key,value:value},ret}},Dictionary.prototype.remove=function(key){var k="$"+this.toStr(key),previousElement=this.table[k];return collections.isUndefined(previousElement)?void 0:(delete this.table[k],this.nElements--,previousElement.value)},Dictionary.prototype.keys=function(){var array=[];for(var name in this.table)if(has(this.table,name)){var pair=this.table[name];array.push(pair.key)}return array},Dictionary.prototype.values=function(){var array=[];for(var name in this.table)if(has(this.table,name)){var pair=this.table[name];array.push(pair.value)}return array},Dictionary.prototype.forEach=function(callback){for(var name in this.table)if(has(this.table,name)){var pair=this.table[name],ret=callback(pair.key,pair.value);if(ret===!1)return}},Dictionary.prototype.containsKey=function(key){return!collections.isUndefined(this.getValue(key))},Dictionary.prototype.clear=function(){this.table={},this.nElements=0},Dictionary.prototype.size=function(){return this.nElements},Dictionary.prototype.isEmpty=function(){return this.nElements<=0},Dictionary.prototype.toString=function(){var toret="{";return this.forEach(function(k,v){toret=toret+"\n	"+k.toString()+" : "+v.toString()}),toret+"\n}"},Dictionary}();Collections.Dictionary=Dictionary;var LinkedDictionaryPair=function(){function LinkedDictionaryPair(key,value){this.key=key,this.value=value}return LinkedDictionaryPair.prototype.unlink=function(){this.prev.next=this.next,this.next.prev=this.prev},LinkedDictionaryPair}(),LinkedDictionary=function(_super){function LinkedDictionary(toStrFunction){_super.call(this,toStrFunction),this.head=new LinkedDictionaryPair(null,null),this.tail=new LinkedDictionaryPair(null,null),this.head.next=this.tail,this.tail.prev=this.head}return __extends(LinkedDictionary,_super),LinkedDictionary.prototype.appendToTail=function(entry){var lastNode=this.tail.prev;lastNode.next=entry,entry.prev=lastNode,entry.next=this.tail,this.tail.prev=entry},LinkedDictionary.prototype.getLinkedDictionaryPair=function(key){if(!collections.isUndefined(key)){var k="$"+this.toStr(key),pair=this.table[k];return pair}},LinkedDictionary.prototype.getValue=function(key){var pair=this.getLinkedDictionaryPair(key);return collections.isUndefined(pair)?void 0:pair.value},LinkedDictionary.prototype.remove=function(key){var pair=this.getLinkedDictionaryPair(key);return collections.isUndefined(pair)?void 0:(_super.prototype.remove.call(this,key),pair.unlink(),pair.value)},LinkedDictionary.prototype.clear=function(){_super.prototype.clear.call(this),this.head.next=this.tail,this.tail.prev=this.head},LinkedDictionary.prototype.replace=function(oldPair,newPair){var k="$"+this.toStr(newPair.key);newPair.next=oldPair.next,newPair.prev=oldPair.prev,this.remove(oldPair.key),newPair.prev.next=newPair,newPair.next.prev=newPair,this.table[k]=newPair,++this.nElements},LinkedDictionary.prototype.setValue=function(key,value){if(!collections.isUndefined(key)&&!collections.isUndefined(value)){var existingPair=this.getLinkedDictionaryPair(key),newPair=new LinkedDictionaryPair(key,value),k="$"+this.toStr(key);return collections.isUndefined(existingPair)?(this.appendToTail(newPair),this.table[k]=newPair,void++this.nElements):(this.replace(existingPair,newPair),existingPair.value)}},LinkedDictionary.prototype.keys=function(){var array=[];return this.forEach(function(key,value){array.push(key)}),array},LinkedDictionary.prototype.values=function(){var array=[];return this.forEach(function(key,value){array.push(value)}),array},LinkedDictionary.prototype.forEach=function(callback){for(var crawlNode=this.head.next;null!=crawlNode.next;){var ret=callback(crawlNode.key,crawlNode.value);if(ret===!1)return;crawlNode=crawlNode.next}},LinkedDictionary}(Dictionary);Collections.LinkedDictionary=LinkedDictionary;var MultiDictionary=function(){function MultiDictionary(toStrFunction,valuesEqualsFunction,allowDuplicateValues){void 0===allowDuplicateValues&&(allowDuplicateValues=!1),this.dict=new Dictionary(toStrFunction),this.equalsF=valuesEqualsFunction||collections.defaultEquals,this.allowDuplicate=allowDuplicateValues}return MultiDictionary.prototype.getValue=function(key){var values=this.dict.getValue(key);return collections.isUndefined(values)?[]:collections.arrays.copy(values)},MultiDictionary.prototype.setValue=function(key,value){if(collections.isUndefined(key)||collections.isUndefined(value))return!1;if(!this.containsKey(key))return this.dict.setValue(key,[value]),!0;var array=this.dict.getValue(key);return!this.allowDuplicate&&collections.arrays.contains(array,value,this.equalsF)?!1:(array.push(value),!0)},MultiDictionary.prototype.remove=function(key,value){if(collections.isUndefined(value)){var v=this.dict.remove(key);return!collections.isUndefined(v)}var array=this.dict.getValue(key);return collections.arrays.remove(array,value,this.equalsF)?(0===array.length&&this.dict.remove(key),!0):!1},MultiDictionary.prototype.keys=function(){return this.dict.keys()},MultiDictionary.prototype.values=function(){for(var values=this.dict.values(),array=[],i=0;i<values.length;i++)for(var v=values[i],j=0;j<v.length;j++)array.push(v[j]);return array},MultiDictionary.prototype.containsKey=function(key){return this.dict.containsKey(key)},MultiDictionary.prototype.clear=function(){this.dict.clear()},MultiDictionary.prototype.size=function(){return this.dict.size()},MultiDictionary.prototype.isEmpty=function(){return this.dict.isEmpty()},MultiDictionary}();Collections.MultiDictionary=MultiDictionary;var Heap=function(){function Heap(compareFunction){this.data=[],this.compare=compareFunction||collections.defaultCompare}return Heap.prototype.leftChildIndex=function(nodeIndex){return 2*nodeIndex+1},Heap.prototype.rightChildIndex=function(nodeIndex){return 2*nodeIndex+2},Heap.prototype.parentIndex=function(nodeIndex){return Math.floor((nodeIndex-1)/2)},Heap.prototype.minIndex=function(leftChild,rightChild){return rightChild>=this.data.length?leftChild>=this.data.length?-1:leftChild:this.compare(this.data[leftChild],this.data[rightChild])<=0?leftChild:rightChild},Heap.prototype.siftUp=function(index){for(var parent=this.parentIndex(index);index>0&&this.compare(this.data[parent],this.data[index])>0;)collections.arrays.swap(this.data,parent,index),index=parent,parent=this.parentIndex(index)},Heap.prototype.siftDown=function(nodeIndex){for(var min=this.minIndex(this.leftChildIndex(nodeIndex),this.rightChildIndex(nodeIndex));min>=0&&this.compare(this.data[nodeIndex],this.data[min])>0;)collections.arrays.swap(this.data,min,nodeIndex),nodeIndex=min,min=this.minIndex(this.leftChildIndex(nodeIndex),this.rightChildIndex(nodeIndex))},Heap.prototype.peek=function(){return this.data.length>0?this.data[0]:void 0},Heap.prototype.add=function(element){return collections.isUndefined(element)?void 0:(this.data.push(element),this.siftUp(this.data.length-1),!0)},Heap.prototype.removeRoot=function(){if(this.data.length>0){var obj=this.data[0];return this.data[0]=this.data[this.data.length-1],this.data.splice(this.data.length-1,1),this.data.length>0&&this.siftDown(0),obj}},Heap.prototype.contains=function(element){var equF=collections.compareToEquals(this.compare);return collections.arrays.contains(this.data,element,equF)},Heap.prototype.size=function(){return this.data.length},Heap.prototype.isEmpty=function(){return this.data.length<=0},Heap.prototype.clear=function(){this.data.length=0},Heap.prototype.forEach=function(callback){collections.arrays.forEach(this.data,callback)},Heap}();Collections.Heap=Heap;var Stack=function(){function Stack(){this.list=new LinkedList}return Stack.prototype.push=function(elem){return this.list.add(elem,0)},Stack.prototype.add=function(elem){return this.list.add(elem,0)},Stack.prototype.pop=function(){return this.list.removeElementAtIndex(0)},Stack.prototype.peek=function(){return this.list.first()},Stack.prototype.size=function(){return this.list.size()},Stack.prototype.contains=function(elem,equalsFunction){return this.list.contains(elem,equalsFunction)},Stack.prototype.isEmpty=function(){return this.list.isEmpty()},Stack.prototype.clear=function(){this.list.clear()},Stack.prototype.forEach=function(callback){this.list.forEach(callback)},Stack}();Collections.Stack=Stack;var Queue=function(){function Queue(){this.list=new LinkedList}return Queue.prototype.enqueue=function(elem){return this.list.add(elem)},Queue.prototype.add=function(elem){return this.list.add(elem)},Queue.prototype.dequeue=function(){if(0!==this.list.size()){var el=this.list.first();return this.list.removeElementAtIndex(0),el}},Queue.prototype.peek=function(){return 0!==this.list.size()?this.list.first():void 0},Queue.prototype.size=function(){return this.list.size()},Queue.prototype.contains=function(elem,equalsFunction){return this.list.contains(elem,equalsFunction)},Queue.prototype.isEmpty=function(){return this.list.size()<=0},Queue.prototype.clear=function(){this.list.clear()},Queue.prototype.forEach=function(callback){this.list.forEach(callback)},Queue}();Collections.Queue=Queue;var PriorityQueue=function(){function PriorityQueue(compareFunction){this.heap=new Heap(collections.reverseCompareFunction(compareFunction))}return PriorityQueue.prototype.enqueue=function(element){return this.heap.add(element)},PriorityQueue.prototype.add=function(element){return this.heap.add(element)},PriorityQueue.prototype.dequeue=function(){if(0!==this.heap.size()){var el=this.heap.peek();return this.heap.removeRoot(),el}},PriorityQueue.prototype.peek=function(){return this.heap.peek()},PriorityQueue.prototype.contains=function(element){return this.heap.contains(element)},PriorityQueue.prototype.isEmpty=function(){return this.heap.isEmpty()},PriorityQueue.prototype.size=function(){return this.heap.size()},PriorityQueue.prototype.clear=function(){this.heap.clear()},PriorityQueue.prototype.forEach=function(callback){this.heap.forEach(callback)},PriorityQueue}();Collections.PriorityQueue=PriorityQueue;var Set=function(){function Set(toStringFunction){this.dictionary=new Dictionary(toStringFunction)}return Set.prototype.contains=function(element){return this.dictionary.containsKey(element)},Set.prototype.add=function(element){return this.contains(element)||collections.isUndefined(element)?!1:(this.dictionary.setValue(element,element),!0)},Set.prototype.intersection=function(otherSet){var set=this;this.forEach(function(element){return otherSet.contains(element)||set.remove(element),!0})},Set.prototype.union=function(otherSet){var set=this;otherSet.forEach(function(element){return set.add(element),!0})},Set.prototype.difference=function(otherSet){var set=this;otherSet.forEach(function(element){return set.remove(element),!0})},Set.prototype.isSubsetOf=function(otherSet){if(this.size()>otherSet.size())return!1;var isSub=!0;return this.forEach(function(element){return otherSet.contains(element)?!0:(isSub=!1,!1)}),isSub},Set.prototype.remove=function(element){return this.contains(element)?(this.dictionary.remove(element),!0):!1},Set.prototype.forEach=function(callback){this.dictionary.forEach(function(k,v){return callback(v)})},Set.prototype.toArray=function(){return this.dictionary.values()},Set.prototype.isEmpty=function(){return this.dictionary.isEmpty()},Set.prototype.size=function(){return this.dictionary.size()},Set.prototype.clear=function(){this.dictionary.clear()},Set.prototype.toString=function(){return collections.arrays.toString(this.toArray())},Set}();Collections.Set=Set;var Bag=function(){function Bag(toStrFunction){this.toStrF=toStrFunction||collections.defaultToString,this.dictionary=new Dictionary(this.toStrF),this.nElements=0}return Bag.prototype.add=function(element,nCopies){if(void 0===nCopies&&(nCopies=1),collections.isUndefined(element)||0>=nCopies)return!1;if(this.contains(element))this.dictionary.getValue(element).copies+=nCopies;else{var node={value:element,copies:nCopies};this.dictionary.setValue(element,node)}return this.nElements+=nCopies,!0},Bag.prototype.count=function(element){return this.contains(element)?this.dictionary.getValue(element).copies:0},Bag.prototype.contains=function(element){return this.dictionary.containsKey(element)},Bag.prototype.remove=function(element,nCopies){if(void 0===nCopies&&(nCopies=1),collections.isUndefined(element)||0>=nCopies)return!1;if(this.contains(element)){var node=this.dictionary.getValue(element);return nCopies>node.copies?this.nElements-=node.copies:this.nElements-=nCopies,node.copies-=nCopies,node.copies<=0&&this.dictionary.remove(element),!0}return!1},Bag.prototype.toArray=function(){for(var a=[],values=this.dictionary.values(),vl=values.length,i=0;vl>i;i++)for(var node=values[i],element=node.value,copies=node.copies,j=0;copies>j;j++)a.push(element);return a},Bag.prototype.toSet=function(){for(var toret=new Set(this.toStrF),elements=this.dictionary.values(),l=elements.length,i=0;l>i;i++){var value=elements[i].value;toret.add(value)}return toret},Bag.prototype.forEach=function(callback){this.dictionary.forEach(function(k,v){for(var value=v.value,copies=v.copies,i=0;copies>i;i++)if(callback(value)===!1)return!1;return!0})},Bag.prototype.size=function(){return this.nElements},Bag.prototype.isEmpty=function(){return 0===this.nElements},Bag.prototype.clear=function(){this.nElements=0,this.dictionary.clear()},Bag}();Collections.Bag=Bag;var BSTree=function(){function BSTree(compareFunction){this.root=null,this.compare=compareFunction||collections.defaultCompare,this.nElements=0}return BSTree.prototype.add=function(element){return collections.isUndefined(element)?!1:null!==this.insertNode(this.createNode(element))?(this.nElements++,!0):!1},BSTree.prototype.clear=function(){this.root=null,this.nElements=0},BSTree.prototype.isEmpty=function(){return 0===this.nElements},BSTree.prototype.size=function(){return this.nElements},BSTree.prototype.contains=function(element){return collections.isUndefined(element)?!1:null!==this.searchNode(this.root,element)},BSTree.prototype.remove=function(element){var node=this.searchNode(this.root,element);return null===node?!1:(this.removeNode(node),this.nElements--,!0)},BSTree.prototype.inorderTraversal=function(callback){this.inorderTraversalAux(this.root,callback,{stop:!1})},BSTree.prototype.preorderTraversal=function(callback){this.preorderTraversalAux(this.root,callback,{stop:!1})},BSTree.prototype.postorderTraversal=function(callback){this.postorderTraversalAux(this.root,callback,{stop:!1})},BSTree.prototype.levelTraversal=function(callback){this.levelTraversalAux(this.root,callback)},BSTree.prototype.minimum=function(){return this.isEmpty()?void 0:this.minimumAux(this.root).element},BSTree.prototype.maximum=function(){return this.isEmpty()?void 0:this.maximumAux(this.root).element},BSTree.prototype.forEach=function(callback){this.inorderTraversal(callback)},BSTree.prototype.toArray=function(){var array=[];return this.inorderTraversal(function(element){return array.push(element),!0}),array},BSTree.prototype.height=function(){return this.heightAux(this.root)},BSTree.prototype.searchNode=function(node,element){for(var cmp=null;null!==node&&0!==cmp;)cmp=this.compare(element,node.element),0>cmp?node=node.leftCh:cmp>0&&(node=node.rightCh);return node},BSTree.prototype.transplant=function(n1,n2){null===n1.parent?this.root=n2:n1===n1.parent.leftCh?n1.parent.leftCh=n2:n1.parent.rightCh=n2,null!==n2&&(n2.parent=n1.parent)},BSTree.prototype.removeNode=function(node){if(null===node.leftCh)this.transplant(node,node.rightCh);else if(null===node.rightCh)this.transplant(node,node.leftCh);else{var y=this.minimumAux(node.rightCh);y.parent!==node&&(this.transplant(y,y.rightCh),y.rightCh=node.rightCh,y.rightCh.parent=y),this.transplant(node,y),y.leftCh=node.leftCh,y.leftCh.parent=y}},BSTree.prototype.inorderTraversalAux=function(node,callback,signal){null===node||signal.stop||(this.inorderTraversalAux(node.leftCh,callback,signal),signal.stop||(signal.stop=callback(node.element)===!1,signal.stop||this.inorderTraversalAux(node.rightCh,callback,signal)))},BSTree.prototype.levelTraversalAux=function(node,callback){var queue=new Queue;for(null!==node&&queue.enqueue(node);!queue.isEmpty();){if(node=queue.dequeue(),callback(node.element)===!1)return;null!==node.leftCh&&queue.enqueue(node.leftCh),null!==node.rightCh&&queue.enqueue(node.rightCh)}},BSTree.prototype.preorderTraversalAux=function(node,callback,signal){null===node||signal.stop||(signal.stop=callback(node.element)===!1,signal.stop||(this.preorderTraversalAux(node.leftCh,callback,signal),signal.stop||this.preorderTraversalAux(node.rightCh,callback,signal)))},BSTree.prototype.postorderTraversalAux=function(node,callback,signal){null===node||signal.stop||(this.postorderTraversalAux(node.leftCh,callback,signal),signal.stop||(this.postorderTraversalAux(node.rightCh,callback,signal),signal.stop||(signal.stop=callback(node.element)===!1)))},BSTree.prototype.minimumAux=function(node){for(;null!==node.leftCh;)node=node.leftCh;return node},BSTree.prototype.maximumAux=function(node){for(;null!==node.rightCh;)node=node.rightCh;return node},BSTree.prototype.heightAux=function(node){return null===node?-1:Math.max(this.heightAux(node.leftCh),this.heightAux(node.rightCh))+1},BSTree.prototype.insertNode=function(node){for(var parent=null,position=this.root,cmp=null;null!==position;){if(cmp=this.compare(node.element,position.element),0===cmp)return null;0>cmp?(parent=position,position=position.leftCh):(parent=position,position=position.rightCh)}return node.parent=parent,null===parent?this.root=node:this.compare(node.element,parent.element)<0?parent.leftCh=node:parent.rightCh=node,node},BSTree.prototype.createNode=function(element){return{element:element,leftCh:null,rightCh:null,parent:null}},BSTree}();Collections.BSTree=BSTree}(Collections=Utils.Collections||(Utils.Collections={}))}(Utils||(Utils={}));var Utils;!function(Utils){var Colors=function(){function Colors(){}return Colors.float32ColorToARGB=function(float32Color){var a=(4278190080&float32Color)>>>24,r=(16711680&float32Color)>>>16,g=(65280&float32Color)>>>8,b=255&float32Color,result=[a,r,g,b];return result},Colors._componentToHex=function(c){var hex=c.toString(16);return 1==hex.length?"0"+hex:hex},Colors.rgbToHexString=function(rgb){return Colors.coalesce(rgb),"#"+Colors._componentToHex(rgb[0])+Colors._componentToHex(rgb[1])+Colors._componentToHex(rgb[2])},Colors.argbToHexString=function(argb){return"#"+Colors._componentToHex(argb[0])+Colors._componentToHex(argb[1])+Colors._componentToHex(argb[2])+Colors._componentToHex(argb[3])},Colors.coalesce=function(arr){for(var i=1;i<arr.length;i++)"undefined"==typeof arr[i]&&(arr[i]=arr[i-1])},Colors}();Utils.Colors=Colors}(Utils||(Utils={}));var Utils;!function(Utils){var Dates=function(){function Dates(){}return Dates.getTimeStamp=function(){return(new Date).getTime()},Dates}();Utils.Dates=Dates}(Utils||(Utils={}));var Utils;!function(Utils){var Device=function(){function Device(){}return Device.getPixelRatio=function(ctx){var dpr=window.devicePixelRatio||1,bsr=ctx.webkitBackingStorePixelRatio||ctx.mozBackingStorePixelRatio||ctx.msBackingStorePixelRatio||ctx.oBackingStorePixelRatio||ctx.backingStorePixelRatio||1;return dpr/bsr},Device.isTouch=function(){return!!("ontouchstart"in window)||window.navigator.msMaxTouchPoints>0},Device}();Utils.Device=Device}(Utils||(Utils={}));var Utils;!function(Utils){var Documents=function(){function Documents(){}return Documents.isInIFrame=function(){try{return window.self!==window.top}catch(e){return!0}},Documents.supportsFullscreen=function(){var doc=document.documentElement,support=doc.requestFullscreen||doc.mozRequestFullScreen||doc.webkitRequestFullScreen||doc.msRequestFullscreen;return void 0!=support},Documents.isHidden=function(){var prop=Documents.getHiddenProp();return prop?document[prop]:!1},Documents.getHiddenProp=function(){var prefixes=["webkit","moz","ms","o"];if("hidden"in document)return"hidden";for(var i=0;i<prefixes.length;i++)if(prefixes[i]+"Hidden"in document)return prefixes[i]+"Hidden";return null},Documents}();Utils.Documents=Documents}(Utils||(Utils={}));var Utils;!function(Utils){var Events=function(){function Events(){}return Events.debounce=function(fn,debounceDuration){return debounceDuration=debounceDuration||100,function(){if(!fn.debouncing){var args=Array.prototype.slice.apply(arguments);fn.lastReturnVal=fn.apply(window,args),fn.debouncing=!0}return clearTimeout(fn.debounceTimeout),fn.debounceTimeout=setTimeout(function(){fn.debouncing=!1},debounceDuration),fn.lastReturnVal}},Events}();Utils.Events=Events}(Utils||(Utils={}));var Utils;!function(Utils){var Files=function(){function Files(){}return Files.simplifyMimeType=function(mime){switch(mime){case"text/plain":return"txt";case"image/jpeg":return"jpg";case"application/msword":return"doc";case"application/vnd.openxmlformats-officedocument.wordprocessingml.document":return"docx";default:var parts=mime.split("/");return parts[parts.length-1]}},Files}();Utils.Files=Files}(Utils||(Utils={}));var Utils;!function(Utils){var Keyboard=function(){function Keyboard(){}return Keyboard.getCharCode=function(e){var charCode="number"==typeof e.which?e.which:e.keyCode;return charCode},Keyboard}();Utils.Keyboard=Keyboard}(Utils||(Utils={}));var Utils;!function(Utils){var Maths;!function(Maths){var Vector=function(){function Vector(x,y){this.X=x,this.Y=y}return Vector.prototype.get=function(){return new Vector(this.X,this.Y)},Vector.prototype.set=function(x,y){this.X=x,this.Y=y},Vector.prototype.add=function(v){this.X+=v.X,this.Y+=v.Y},Vector.add=function(v1,v2){return new Vector(v1.X+v2.X,v1.Y+v2.Y)},Vector.prototype.sub=function(v){this.X-=v.X,this.Y-=v.Y},Vector.sub=function(v1,v2){return new Vector(v1.X-v2.X,v1.Y-v2.Y)},Vector.prototype.mult=function(n){this.X=this.X*n,this.Y=this.Y*n},Vector.mult=function(v1,v2){return new Vector(v1.X*v2.X,v1.Y*v2.Y)},Vector.multN=function(v1,n){return new Vector(v1.X*n,v1.Y*n)},Vector.prototype.Div=function(n){this.X=this.X/n,this.Y=this.Y/n},Vector.div=function(v1,v2){return new Vector(v1.X/v2.X,v1.Y/v2.Y)},Vector.divN=function(v1,n){return new Vector(v1.X/n,v1.Y/n)},Vector.prototype.mag=function(){return Math.sqrt(this.X*this.X+this.Y*this.Y)},Vector.prototype.magSq=function(){return this.X*this.X+this.Y*this.Y},Vector.prototype.normalise=function(){var m=this.mag();0!=m&&1!=m&&this.Div(m)},Vector.prototype.limit=function(max){this.magSq()>max*max&&(this.normalise(),
this.mult(max))},Vector.prototype.equals=function(v){return this.X==v.X&&this.Y==v.Y},Vector.prototype.heading=function(){var angle=Math.atan2(-this.Y,this.X);return-1*angle},Vector.random2D=function(){return Vector.fromAngle(Math.random()*Math.TAU)},Vector.fromAngle=function(angle){return new Vector(Math.cos(angle),Math.sin(angle))},Vector}();Maths.Vector=Vector}(Maths=Utils.Maths||(Utils.Maths={}))}(Utils||(Utils={}));var Utils;!function(Utils){var Measurements;!function(Measurements){var Size=function(){function Size(width,height){this.width=width,this.height=height}return Size}();Measurements.Size=Size;var Dimensions=function(){function Dimensions(){}return Dimensions.fitRect=function(width1,height1,width2,height2){var width,height,scale,ratio1=height1/width1,ratio2=height2/width2;return ratio2>ratio1&&(scale=width2/width1,width=width1*scale,height=height1*scale),ratio1>ratio2&&(scale=height2/height1,width=width1*scale,height=height1*scale),new Size(Math.floor(width),Math.floor(height))},Dimensions.hitRect=function(x,y,w,h,mx,my){return mx>x&&x+w>mx&&my>y&&y+h>my},Dimensions}();Measurements.Dimensions=Dimensions}(Measurements=Utils.Measurements||(Utils.Measurements={}))}(Utils||(Utils={}));var Utils;!function(Utils){var Numbers=function(){function Numbers(){}return Numbers.numericalInput=function(event){return 46==event.keyCode||8==event.keyCode||9==event.keyCode||27==event.keyCode||65==event.keyCode&&event.ctrlKey===!0||event.keyCode>=35&&event.keyCode<=39?!0:event.shiftKey||(event.keyCode<48||event.keyCode>57)&&(event.keyCode<96||event.keyCode>105)?(event.preventDefault(),!1):!0},Numbers}();Utils.Numbers=Numbers}(Utils||(Utils={}));var Utils;!function(Utils){var Storage=function(){function Storage(){}return Storage.clear=function(storageType){switch(void 0===storageType&&(storageType=Utils.StorageType.memory),storageType.value){case Utils.StorageType.memory.value:this._memoryStorage={};break;case Utils.StorageType.session.value:sessionStorage.clear();break;case Utils.StorageType.local.value:localStorage.clear()}},Storage.clearExpired=function(storageType){void 0===storageType&&(storageType=Utils.StorageType.memory);for(var items=this.getItems(storageType),i=0;i<items.length;i++){var item=items[i];this._isExpired(item)&&this.remove(item.key)}},Storage.get=function(key,storageType){void 0===storageType&&(storageType=Utils.StorageType.memory);var data;switch(storageType.value){case Utils.StorageType.memory.value:data=this._memoryStorage[key];break;case Utils.StorageType.session.value:data=sessionStorage.getItem(key);break;case Utils.StorageType.local.value:data=localStorage.getItem(key)}if(!data)return null;var item=JSON.parse(data);return this._isExpired(item)?null:(item.key=key,item)},Storage._isExpired=function(item){return!((new Date).getTime()<item.expiresAt)},Storage.getItems=function(storageType){void 0===storageType&&(storageType=Utils.StorageType.memory);var items=[];switch(storageType.value){case Utils.StorageType.memory.value:for(var keys=Object.keys(this._memoryStorage),i=0;i<keys.length;i++){var item=this.get(keys[i],Utils.StorageType.memory);item&&items.push(item)}break;case Utils.StorageType.session.value:for(var i=0;i<sessionStorage.length;i++){var key=sessionStorage.key(i),item=this.get(key,Utils.StorageType.session);item&&items.push(item)}break;case Utils.StorageType.local.value:for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i),item=this.get(key,Utils.StorageType.local);item&&items.push(item)}}return items},Storage.remove=function(key,storageType){switch(void 0===storageType&&(storageType=Utils.StorageType.memory),storageType.value){case Utils.StorageType.memory.value:delete this._memoryStorage[key];break;case Utils.StorageType.session.value:sessionStorage.removeItem(key);break;case Utils.StorageType.local.value:localStorage.removeItem(key)}},Storage.set=function(key,value,expirationSecs,storageType){void 0===storageType&&(storageType=Utils.StorageType.memory);var expirationMS=1e3*expirationSecs,record=new Utils.StorageItem;switch(record.value=value,record.expiresAt=(new Date).getTime()+expirationMS,storageType.value){case Utils.StorageType.memory.value:this._memoryStorage[key]=JSON.stringify(record);break;case Utils.StorageType.session.value:sessionStorage.setItem(key,JSON.stringify(record));break;case Utils.StorageType.local.value:localStorage.setItem(key,JSON.stringify(record))}return record},Storage._memoryStorage={},Storage}();Utils.Storage=Storage}(Utils||(Utils={}));var Utils;!function(Utils){var StorageItem=function(){function StorageItem(){}return StorageItem}();Utils.StorageItem=StorageItem}(Utils||(Utils={}));var Utils;!function(Utils){var StorageType=function(){function StorageType(value){this.value=value}return StorageType.prototype.toString=function(){return this.value},StorageType.memory=new StorageType("memory"),StorageType.session=new StorageType("session"),StorageType.local=new StorageType("local"),StorageType}();Utils.StorageType=StorageType}(Utils||(Utils={}));var Utils;!function(Utils){var Strings=function(){function Strings(){}return Strings.ellipsis=function(text,chars){if(text.length<=chars)return text;var trimmedText=text.substr(0,chars),lastSpaceIndex=trimmedText.lastIndexOf(" ");return-1!=lastSpaceIndex&&(trimmedText=trimmedText.substr(0,Math.min(trimmedText.length,lastSpaceIndex))),trimmedText+"&hellip;"},Strings.htmlDecode=function(encoded){var div=document.createElement("div");return div.innerHTML=encoded,div.firstChild.nodeValue},Strings}();Utils.Strings=Strings}(Utils||(Utils={}));var Utils;!function(Utils){var Urls=function(){function Urls(){}return Urls.getHashParameter=function(key,doc){doc||(doc=window.document);var regex=new RegExp("#.*[?&]"+key+"=([^&]+)(&|$)"),match=regex.exec(doc.location.hash);return match?decodeURIComponent(match[1].replace(/\+/g," ")):null},Urls.setHashParameter=function(key,value,doc){doc||(doc=window.document);var kvp=this.updateURIKeyValuePair(doc.location.hash.replace("#?",""),key,value),newHash="#?"+kvp,url=doc.URL,index=url.indexOf("#");-1!=index&&(url=url.substr(0,url.indexOf("#"))),doc.location.replace(url+newHash)},Urls.getQuerystringParameter=function(key,w){return w||(w=window),this.getQuerystringParameterFromString(key,w.location.search)},Urls.getQuerystringParameterFromString=function(key,querystring){key=key.replace(/[\[]/,"\\[").replace(/[\]]/,"\\]");var regex=new RegExp("[\\?&]"+key+"=([^&#]*)"),match=regex.exec(querystring);return match?decodeURIComponent(match[1].replace(/\+/g," ")):null},Urls.setQuerystringParameter=function(key,value,doc){doc||(doc=window.document);var kvp=this.updateURIKeyValuePair(doc.location.hash.replace("#?",""),key,value);window.location.search=kvp},Urls.updateURIKeyValuePair=function(uriSegment,key,value){key=encodeURIComponent(key),value=encodeURIComponent(value);var kvp=uriSegment.split("&");""==kvp[0]&&kvp.shift();for(var x,i=kvp.length;i--;)if(x=kvp[i].split("="),x[0]==key){x[1]=value,kvp[i]=x.join("=");break}return 0>i&&(kvp[kvp.length]=[key,value].join("=")),kvp.join("&")},Urls.getUrlParts=function(url){var a=document.createElement("a");return a.href=url,a},Urls.convertToRelativeUrl=function(url){var parts=this.getUrlParts(url),relUri=parts.pathname+parts.searchWithin;return relUri.startsWith("/")||(relUri="/"+relUri),relUri},Urls}();Utils.Urls=Urls}(Utils||(Utils={}));
!function(f){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=f();else if("function"==typeof define&&define.amd)define([],f);else{var g;g="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,g.iiifTreeComponent=f()}}(function(){return function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a="function"==typeof require&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}for(var i="function"==typeof require&&require,o=0;o<r.length;o++)s(r[o]);return s}({1:[function(require,module,exports){var IIIFComponents,__extends=this&&this.__extends||function(d,b){function __(){this.constructor=d}for(var p in b)b.hasOwnProperty(p)&&(d[p]=b[p]);d.prototype=null===b?Object.create(b):(__.prototype=b.prototype,new __)};!function(IIIFComponents){var TreeComponent=function(_super){function TreeComponent(options){_super.call(this,options),this._init()}return __extends(TreeComponent,_super),TreeComponent.prototype._init=function(){var success=_super.prototype._init.call(this);success||console.error("TreeComponent failed to initialise");var that=this;return this._$tree=$('<ul class="tree"></ul>'),this._$element.append(this._$tree),$.templates({pageTemplate:"{^{for nodes}}                                {^{tree/}}                            {{/for}}",treeTemplate:'<li>                                {^{if nodes && nodes.length}}                                    <div class="toggle" data-link="class{merge:expanded toggle=\'expanded\'}"></div>                                {{else}}                                <div class="spacer"></div>                                {{/if}}                                {^{if multiSelectEnabled}}                                    <input id="tree-checkbox-{{>id}}" type="checkbox" data-link="checked{:multiSelected ? \'checked\' : \'\'}" class="multiSelect" />                                {{/if}}                                {^{if selected}}                                    <a id="tree-link-{{>id}}" href="#" title="{{>label}}" class="selected">{{>label}}</a>                                {{else}}                                    <a id="tree-link-{{>id}}" href="#" title="{{>label}}">{{>label}}</a>                                {{/if}}                            </li>                            {^{if expanded}}                                <li>                                    <ul>                                        {^{for nodes}}                                            {^{tree/}}                                        {{/for}}                                    </ul>                                </li>                            {{/if}}'}),$.views.tags({tree:{toggleExpanded:function(){that._setNodeExpanded(this.data,!this.data.expanded)},toggleMultiSelect:function(){that._setNodeMultiSelected(this.data,!this.data.multiSelected),that._emit(TreeComponent.Events.TREE_NODE_MULTISELECTED,this.data)},init:function(tagCtx,linkCtx,ctx){this.data=tagCtx.view.data},onAfterLink:function(){var self=this;self.contents("li").first().on("click",".toggle",function(){self.toggleExpanded()}).on("click","a",function(e){e.preventDefault(),self.data.nodes.length&&self.toggleExpanded(),self.data.multiSelectEnabled?self.toggleMultiSelect():that._emit(TreeComponent.Events.TREE_NODE_SELECTED,self.data)}).on("click","input.multiSelect",function(e){self.toggleMultiSelect()})},template:$.templates.treeTemplate}}),success},TreeComponent.prototype.databind=function(rootNode){this._rootNode=rootNode,this._allNodes=null,this._multiSelectableNodes=null,this._$tree.link($.templates.pageTemplate,this._rootNode)},TreeComponent.prototype._getDefaultOptions=function(){return{}},TreeComponent.prototype.updateMultiSelectState=function(state){this._multiSelectState=state;for(var i=0;i<this._multiSelectState.ranges.length;i++){var range=this._multiSelectState.ranges[i],node=this._getMultiSelectableNodes().en().where(function(n){return n.data.id===range.id}).first();node&&(this._setNodeMultiSelectEnabled(node,range.multiSelectEnabled),this._setNodeMultiSelected(node,range.multiSelected))}},TreeComponent.prototype.allNodesSelected=function(){var applicableNodes=this._getMultiSelectableNodes(),multiSelectedNodes=this.getMultiSelectedNodes();return applicableNodes.length===multiSelectedNodes.length},TreeComponent.prototype._getMultiSelectableNodes=function(){var _this=this;return this._multiSelectableNodes?this._multiSelectableNodes:this._multiSelectableNodes=this._getAllNodes().en().where(function(n){return _this._nodeIsMultiSelectable(n)}).toArray()},TreeComponent.prototype._nodeIsMultiSelectable=function(node){return node.isManifest()&&node.nodes.length>0||node.isRange()},TreeComponent.prototype._getAllNodes=function(){return this._allNodes?this._allNodes:this._allNodes=this._rootNode.nodes.en().traverseUnique(function(node){return node.nodes}).toArray()},TreeComponent.prototype.getMultiSelectedNodes=function(){var _this=this;return this._getAllNodes().en().where(function(n){return _this._nodeIsMultiSelectable(n)&&n.multiSelected}).toArray()},TreeComponent.prototype.getNodeById=function(id){return this._getAllNodes().en().where(function(n){return n.id===id}).first()},TreeComponent.prototype._multiSelectTreeNode=function(node,isSelected){if(this._nodeIsMultiSelectable(node)){this._setNodeMultiSelected(node,isSelected);for(var i=0;i<node.nodes.length;i++){var n=node.nodes[i];this._multiSelectTreeNode(n,isSelected)}}},TreeComponent.prototype._expandParents=function(node){node.parentNode&&(this._setNodeExpanded(node.parentNode,!0),this._expandParents(node.parentNode))},TreeComponent.prototype._setNodeSelected=function(node,selected){$.observable(node).setProperty("selected",selected)},TreeComponent.prototype._setNodeExpanded=function(node,expanded){$.observable(node).setProperty("expanded",expanded)},TreeComponent.prototype._setNodeMultiSelected=function(node,selected){$.observable(node).setProperty("multiSelected",selected)},TreeComponent.prototype._setNodeMultiSelectEnabled=function(node,enabled){$.observable(node).setProperty("multiSelectEnabled",enabled)},TreeComponent.prototype.selectPath=function(path){if(this._rootNode){var pathArr=path.split("/");pathArr.length>=1&&pathArr.shift();var node=this.getNodeByPath(this._rootNode,pathArr);this.selectNode(node)}},TreeComponent.prototype.deselectCurrentNode=function(){this._selectedNode&&this._setNodeSelected(this._selectedNode,!1)},TreeComponent.prototype.selectNode=function(node){this._rootNode&&(this.deselectCurrentNode(),this._selectedNode=node,this._setNodeSelected(this._selectedNode,!0))},TreeComponent.prototype.getNodeByPath=function(parentNode,path){if(0===path.length)return parentNode;var index=path.shift(),node=parentNode.nodes[index];return this.getNodeByPath(node,path)},TreeComponent.prototype.show=function(){this._$element.show()},TreeComponent.prototype.hide=function(){this._$element.hide()},TreeComponent.prototype._resize=function(){},TreeComponent}(Components.BaseComponent);IIIFComponents.TreeComponent=TreeComponent}(IIIFComponents||(IIIFComponents={}));var IIIFComponents;!function(IIIFComponents){var TreeComponent;!function(TreeComponent){var Events=function(){function Events(){}return Events.TREE_NODE_MULTISELECTED="treeNodeMultiSelected",Events.TREE_NODE_SELECTED="treeNodeSelected",Events}();TreeComponent.Events=Events}(TreeComponent=IIIFComponents.TreeComponent||(IIIFComponents.TreeComponent={}))}(IIIFComponents||(IIIFComponents={})),function(w){w.IIIFComponents?w.IIIFComponents.TreeComponent=IIIFComponents.TreeComponent:w.IIIFComponents=IIIFComponents}(window)},{}]},{},[1])(1)});