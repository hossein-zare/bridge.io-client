class Crypto {
    static key = '!@#v/$&@$^#$%!WREs1grHWGeAS5DS';

    static encrypt(data) {
        return CryptoJS.AES.encrypt(data, Crypto.key).toString();
    }

    static decrypt(data) {
        const bytes = CryptoJS.AES.decrypt(data, Crypto.key);
        return bytes.toString(CryptoJS.enc.Utf8);
    }
}

class BridgeIO {
    constructor(server, config = {}) {
        this.server = server;
        this.config = Object.assign({
            protocol: [],
            attempts: null,
            timeout: 2000
        }, config);
        this.connection = null;
        this.opened = false;
        this.attempts = 0;
        this.disconnected = false;
        this.dontFireCloseEvent = false;
        this.casterId = 400;
        this.acknowledgments = {};
        this.events = {
            open: () => {},
            close: () => {},
            reconnecting: () => {},
            reconnected: () => {}
        };
    }

    isObject(o) {
        return o instanceof Object && o.constructor === Object;
    }

    /**
     * Predefined events.
     */
    defaultEvents() {
        // Open
        this.connection.addEventListener('open', (...args) => {
            if (! this.opened) {
                this.events.open(...args);
                this.opened = true;
            } else {
                this.events.reconnected(...args);
            }

            this.attempts = 0;
            this.heartbeat();
        });

        // Close
        this.connection.addEventListener('close', (e) => {
            clearTimeout(this.connection.pingTimeout);

            if (! this.dontFireCloseEvent)
                this.events.close(e);
            else
                this.dontFireCloseEvent = false;

            // Reconnect
            if (! e.wasClean && (this.config.attempts === null || this.attempts < this.config.attempts)) {
                setTimeout(() => this.reconnect(true), this.config.timeout);
            }
        });

        // Message
        this.connection.addEventListener('message', (e) => {
            if (e.data === '9') {
                // Ping
                this.connection.send(10);
                this.heartbeat();
            } else {
                const decrypted = Crypto.decrypt(e.data);
                const json = JSON.parse(decrypted)
                const {
                    event = null,
                    data = null
                } = json;
                
                if (event === 'ack' && this.isObject(data) && data.ack && Array.isArray(data.args)) {
                    // ACK
                    if (data.ack in this.acknowledgments) {
                        this.acknowledgments[data.ack](...data.args);
                        delete this.acknowledgments[data.acck];
                    }
                } else if (event in this.events) {
                    this.events[event](data);
                }
            }
        });
    }

    /**
     * Connect to the server.
     */
    connect() {
        if (this.connection) {
            // Don't continue if the connection has already been established
            if (this.connection.readyState === 1)
                return;

            this.dontFireCloseEvent = true;
            this.disconnect();
        }

        this.connection = new WebSocket(this.server, this.config.protocol);

        this.defaultEvents();

        this.attempts++;
        this.disconnected = false;
    }

    /**
     * Reconnect.
     * @param {object} e
     */
    reconnect(preserveAttempts = false) {
        if (this.disconnected)
            return;

        if (! preserveAttempts)
            this.attempts = 0;

        this.events.reconnecting();
        this.connect();
    }

    heartbeat() {
        clearTimeout(this.connection.pingTimeout);
    
        this.connection.pingTimeout = setTimeout(() => {
            this.connection.close();
            this.connect();
        }, 30000 + 1000);
    }

    /**
     * Event listener.
     * @param {string} event 
     * @param {callback} callback 
     */
    on(event, callback) {
        if (['error'].includes(event)) {
            this.connection.addEventListener(event, callback);
        }

        this.events[event] = callback;
    }

    cast(event, data, acknowledgment = null) {
        const message = {
            event,
            data,
        };

        if (acknowledgment) {
            message.ack = this.casterId;
            this.acknowledgments[this.casterId] = acknowledgment;
            this.casterId++;
        }

        const json = JSON.stringify(message);
        const encrypted = Crypto.encrypt(json);

        this.connection.send(encrypted);
    }

    /**
     * Disconnect.
     */
    disconnect() {
        if (! this.connection)
            return;

        clearTimeout(this.connection.pingTimeout);
        this.connection.close();
        this.connection = null;
        this.disconnected = true;
    }
}