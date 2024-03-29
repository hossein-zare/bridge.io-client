/*! Bridge.IO-Client 2.x
//@ Hossein Zare
*/
class EventEmitter {
    constructor(){
        this.events = {};
    }

    on(type, listener) {
        if (! this.events[type])
            this.events[type] = listener;
    }

    emit(type, ...args) {
        if (this.events[type])
            this.events[type](...args);
    }
}

export default class BridgeIO extends EventEmitter {
    constructor(opt = {}) {
        super();

        this.opt = Object.assign({
            server: 'ws://localhost',
            protocols: [],
            response_timeout: 5000,
            attempts: null,
            delay: 2000,
            reconnection: true
        }, opt);

        this.socket = null;
        this.rpcId = 0;
        this.responseCallbacks = {};
        this.errorCallbacks = {};
        this.rpcTimeouts = {};
        this.reconnectionAttempts = 0;
        this.reconnectionInterval = null;
        this.isReactNative = typeof navigator !== "undefined" && typeof navigator.product === "string" && navigator.product.toLowerCase() === "reactnative";

        this.connect();
    }

    connect() {
        if (this.socket === null || this.socket.readyState > 2) {
            this.socket = null;
            this.socket = new WebSocket(this.opt.server, this.opt.protocols);
            this.socket.binaryType = 'arraybuffer';
            this.socketEvents();

            // Clear reconnection interval
            clearInterval(this.reconnectionInterval);
        }
    }

    socketEvents() {
        this.socket.onopen = (e) => {
            const reconnected = this.reconnectionAttempts > 0;
            this.emit('open', e, reconnected);
        };

        this.socket.onerror = (e) => {
            this.emit('error', e);
        }

        this.socket.onclose = (e) => {
            this.emit('disconnected', e);

            if (! e.wasClean && this.opt.reconnection) {
                this.reconnectionInterval = setInterval(() => {
                    this.reconnectionAttempts++;

                    if (this.opt.attempts === null || this.reconnectionAttempts <= this.opt.attempts) {
                        this.emit('reconnecting', e);
                        this.connect();
                    } else {
                        clearInterval(this.reconnectionInterval);
                    }
                }, this.opt.delay);
            }
        };

        this.socket.onmessage = (e) => {
            const {data} = e;

            if (this.isReadyFlag(data)) {
                const reconnected = this.reconnectionAttempts > 0;
                this.emit('connection', e, reconnected);
                
                if (reconnected)
                    this.emit('reconnection', e);

                this.reconnectionAttempts = 0;
            } else if (this.isPong(data)) {
                this.ping();
            } else {
                try {
                    this.message(data);
                } catch (e) {
                    console.warn(e);
                }
            }
        }
    }

    message(message) {
        message = JSON.parse(message);

        const [event, data, id = undefined] = message;

        if (typeof event === 'string') {
            switch (event) {
                case 'rpc':
                    this.rpc(message);
                    break;
                default:
                    this.emit(event, data);
            }
        }
    }

    rpc(message) {
        const [event, data, id] = message;

        if (Object.prototype.toString.call(data) === "[object Object]") {
            if (data.hasOwnProperty('status') && Number.isInteger(data.status) && data.status >= 400) {
                if (this.errorCallbacks[id]) {
                    this.errorCallbacks[id](data);
                }
            } else {
                if (this.responseCallbacks[id]) {
                    this.responseCallbacks[id](data);
                }
            }
        } else {
            if (this.responseCallbacks[id]) {
                this.responseCallbacks[id](data);
            }
        }
        
        if (this.responseCallbacks[id])
            delete this.responseCallbacks[id];
        if (this.errorCallbacks[id])
            delete this.errorCallbacks[id];

        clearTimeout(this.rpcTimeouts[id]);
    }

    serializeMessage(event, data, id) {
        let message = [event, data, id];
            message = JSON.stringify(message);

        return message;
    }

    cast(event, data = null, responseCallback = null, errorCallback = null, config = {}) {
        let id;

        config = Object.assign({
            timeout: this.opt.response_timeout
        }, config);

        if (responseCallback) {
            id = ++this.rpcId;

            this.responseCallbacks[id] = responseCallback;
            this.errorCallbacks[id] = errorCallback;
            this.rpcTimeouts[id] = setTimeout(() => {
                if (this.responseCallbacks[id]) {
                    delete this.responseCallbacks[id];
                }

                if (this.errorCallbacks[id]) {
                    this.errorCallbacks[id](null); // timeout
                    delete this.errorCallbacks[id];
                }

                if (this.rpcTimeouts[id]) {
                    delete this.rpcTimeouts[id];
                }
            }, config.timeout);
        }

        const message = this.serializeMessage(event, data, id);

        this.socket.send(message);

        return id;
    }

    revoke(id) {
        if (this.responseCallbacks[id]) {
            delete this.responseCallbacks[id];
        }

        if (this.errorCallbacks[id]) {
            delete this.errorCallbacks[id];
        }

        if (this.rpcTimeouts[id]) {
            delete this.rpcTimeouts[id];
        }
    }

    isReadyFlag(data) {
        return Number(data) === 0xB;
    }

    isPong(data) {
        return Number(data) === 0xA;
    }

    ping() {
        this.socket.send(this.isReactNative ? '9' : 0x9)
    }
}