if (!Function.prototype.bind) {  
  Function.prototype.bind = function (oThis) {  
    if (typeof this !== "function") {  
      // closest thing possible to the ECMAScript 5 internal IsCallable function  
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");  
    }  
  
    var aArgs = Array.prototype.slice.call(arguments, 1),   
        fToBind = this,   
        fNOP = function () {},  
        fBound = function () {  
          return fToBind.apply(this instanceof fNOP  
                                 ? this  
                                 : oThis || window,  
                               aArgs.concat(Array.prototype.slice.call(arguments)));  
        };  
  
    fNOP.prototype = this.prototype;  
    fBound.prototype = new fNOP();  
  
    return fBound;  
  };  
}

/**
 * Provides requestAnimationFrame in a cross browser way.
 * http://paulirish.com/2011/requestanimationframe-for-smart-animating/
 */

if ( !window.requestAnimationFrame ) {

	window.requestAnimationFrame = ( function() {

		return window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		function( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element ) {

			window.setTimeout( callback, 1000 / 60 );

		};

	} )();

}

function Intrael(uri,sse){
    this._dtlisteners = [];
    this._erlisteners = [];
    this.uri = uri ? uri : "http://127.0.0.1:6661";
    this.query = null;
    this.extra = "";
    this.uniq = Date.now();
	this.sse = sse ? true : false;
}

Intrael.prototype = {

    constructor: Intrael,

    addListener: function(type, listener){
        switch(type){
			case 'data':
				this._dtlisteners.push(listener);
				break;
			case 'error':
				this._erlisteners.push(listener);
				break;		
			default: throw new Error("Only 'data' and 'error' event types supported");
		}
    },

    fire: function(event){
        if (typeof event == "string"){
            event = { type: event, blobs:[],header:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0] };
        }
        if (!event.target){
            event.target = this;
        }

        if (!event.type){  
            throw new Error("Event object missing 'type' property.");
        }
		switch(event.type){
			case 'data':
				var listeners = this._dtlisteners;
				break;
			case 'error':
				var listeners = this._erlisteners;
				break;
			default: throw new Error("Only 'data' and 'error' event types supported");
		}
        for (var i=0, len=listeners.length; i != len; i++) listeners[i].call(this, event);       
    },

    removeListener: function(type, listener){
		switch(type){
			case 'data':
				var listeners = this._dtlisteners;
				break;
			case 'error':
				var listeners = this._erlisteners;
				break;		
			default: throw new Error("Only 'data' and 'error' event types supported");
		}
		for (var i=0, len=listeners.length; i < len; i++){
			if (listeners[i] === listener){
				listeners.splice(i, 1);
				break;
			}
		}
    },
    
    start : function(){
		if(this.sse){
			this.evs = new EventSource(this.uri+this.uniq);
			this.evs.onmessage = this._processSSE.bind(this);
			this.evs.onerror = this._error.bind(this);
			if (window.XDomainRequest) {
				this.xhr = new XDomainRequest();
			} else {
				this.xhr = new XMLHttpRequest();
			}
		}else{
			if (window.XDomainRequest) {
				this.xhr = new XDomainRequest();
				this.xhr.onerror = this._error.bind(this);
				this.xhr.onload = this._processXHR.bind(this);
			} else {
				this.xhr = new XMLHttpRequest();
				this.xhr.onreadystatechange = this._processXHR.bind(this);
			}
			this._get();
		}	
	},
	_get : function(){
		this.xhr.abort();
		if(this.query){
			var opt=[];
			for(var i in this.query) opt.push( i+"="+this.query[i]);
			this.extra = "?"+opt.join("&");
		}
        this.xhr.open("GET", this.uri+"/00"+this.uniq+this.extra);
        this.extra="";
		this.xhr.send(null);	
	},

	stop : function(){
		if(this.evs){
			this.evs.close();
			delete this.evs;
		}
		if(this.xhr){
			this.xhr.abort();
			delete this.xhr;
		}
	},
	
	_error:function(){
		this.fire("error");
	},
	
	_processXHR : function(){
		if (this.xhr.readyState == 4) {
            if (this.xhr.status != 200) {
                this.fire("error");
            } else {
                var raw = JSON.parse(this.xhr.responseText);
				var data = this._parse(raw);
				data.type='data';
				this.fire(data);
                this._get();
            }
		}
	},

	_processSSE : function(e){
		var raw = JSON.parse(e.data);
		var data = this._parse(raw);
		data.type = 'data';
        this.fire(data);
        if(this.query){
			var extra="";
			var opt=[];
			for(var i in this.query) opt.push( i+"="+this.query[i]);
			extra = "?"+opt.join("&");
			this.xhr.open("GET", this.uri+this.id+extra);
			this.xhr.send(null);
			delete this.query;
		}
	},
	_spat: function(p){
		/* http://openkinect.org/wiki/Imaging_Information */
		p.sx = Math.round((2*p.x - 320) * (p.z -100) * 0.0028);
 	    p.sy = Math.round((2*p.y - 240) * (p.z -100) * 0.0021);
		return p;
	},
	_parse: function(data){
		var blobs=[];
		var labels = ["center","left","right","top","bottom","near","far"];
		for(var i=16,imax=data.length;i!=imax;i+=32){
			blob={px:data[i+28], rs:data[i+29], vr:data[i+30], dt:data[i+31]};
			for(var j=0,k=0;j != 28;j+= 4,k++)	blob[labels[k]] = this._spat({'x':data[i+j],'y':data[i+j+1],'z':data[i+j+2],'d':data[i+j+3]});	
			blobs.push(blob);
		}
		return {'blobs':blobs,'header':{'time':data[0],'last':data[1],'ext':data[2],'left':data[3],'right':data[4],'top':data[5],'bottom':data[6],'near':data[7],'far':data[8],'min':data[9],'max':data[10],'ax':data[11],'ay':data[12],'az':data[13],'angle':data[14],'motor':data[15]}};
	}
};
