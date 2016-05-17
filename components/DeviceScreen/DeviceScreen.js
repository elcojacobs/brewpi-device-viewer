import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import s from './DeviceScreen.css';

/**
 * Renders the screen from a remote device.
 * Currently just a proof of concept - screen size and
 * colour depth/format are hard-coded.
 */
export default class DeviceScreen extends Component {

  static propTypes = {
    url: React.PropTypes.string.isRequired,
    debug: React.PropTypes.bool.isRequired,
    reconnect: React.PropTypes.number,
    width: React.PropTypes.number.isRequired,
    height: React.PropTypes.number.isRequired,
  };

  static defaultProps = {
    debug: true,
    width: 320,
    height: 240,
  };

  constructor(props) {
    super(props);
    this.ws = undefined;
    this.state = {
      imagedata: undefined,
      connecting: undefined,
      connected: undefined,
    }
  }

	/**
   * Enables the connection prior to the component being rendered.
   */
  componentWillMount() {
    this.log('DeviceScreen componentWillMount');
    this.preventReconnection = false;
  }


   getMousePos = (element, evt) => {
    const rect = element.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  };

  clicked = (evt) => {
    const {x, y} = this.getMousePos(this.canvas, evt);
    this.log(`clicked ${x},${y}`);
    this.touchscreen(x,y);
  };

  touchscreen(x, y) {
    const ws = this.ws;
    if (ws) {
      const buf = new ArrayBuffer(5);
      const view = new DataView(buf);
      view.setInt8(0, 1);    // command
      view.setUint16(1, x, true);
      view.setUint16(3, y, true);
      ws.send(buf);
    }
  }

	/**
   * Notification that the component has been mounted.
   */
  componentDidMount() {
    this.canvas = ReactDOM.findDOMNode(this.refs.canvas);
    if (this.canvas) {
      this.canvas.addEventListener('click', this.clicked);
      this.ctx = this.canvas.getContext('2d');

      this.imagedata = this.ctx.getImageData(0, 0, this.props.width, this.props.height);
      if (!this.imagedata)
        this.log("mounted, but no image");
      const img = this.imagedata.data;
      for (let i = 0; i < this.props.width * this.props.height; i++) {
        img[i * 4] = 0;
        img[i * 4 + 1] = 0;
        img[i * 4 + 2] = 0;
        img[i * 4 + 3] = 255;
      }

      this.ctx.putImageData(this.imagedata, 0, 0);

      this._setupSocket();
    }
  }

  componentWillUnmount() {
    this.log('DeviceScreen componentWillUnmount');
    // we need to prevent reconnection! or we'll set state on an unmounted component
    this.preventReconnection = true;
    this.closeSocket();
    this.imagedata = undefined;
    this.canvas = undefined;
    this.ctx = undefined;
  }

  closeSocket() {
    const ws = this.ws;
    if (ws) {
      ws.close();
      this.ws = undefined;
      this.setState({connecting: false, connected:false});
    }
  }

  log(logline) {
    if (this.props.debug === true) {
      /*eslint no-console: 0*/
      console.log(logline);
    }
  }

  _setupSocket() {
    try {
      this._createSocket();
    }
    catch (e) {
      this.log(e);
      this._rescheduleSetup();
    }
  }

  _createSocket() {

    const ws = new WebSocket(this.props.url);
    this.log("connecting");
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    const self = this;
    this.setState({connecting:true});

    ws.onopen = () => {
      this.setState({connecting: false, connected:true});
      this.log('Websocket connected');
    };

    ws.onmessage = (msg) => {
      // self.log('Websocket incoming data');
      // self.log(msg);
      this._handleScreenUpdate(new DataView(msg.data), msg.data.byteLength);
    };

    ws.onclose = () => {
      this.log('Websocket disconnected');
      this.closeSocket();
      this._rescheduleSetup();
    };
  }

  _rescheduleSetup = () => {
    const self = this;
    if (self.props.reconnect && !self.preventReconnection) {
      this.log(`rescheduling socket connect in {this.props.reconnect}s`);
      const restartDelay = Math.random() * self.props.reconnect;
      setTimeout(() => {
        self.closeSocket();
        self.log('Websocket reconnecting');
        self._setupSocket();
      }, restartDelay * 1000);
    }
  };

  /**
   * Handles the screen update data from the device.
   * @param {DataView} buffer The message describing the screen update.
   * @private
   */
  _handleScreenUpdate = (buffer, length) => {
    if (this.imagedata!==undefined) {
      const img = this.imagedata.data;
      let index = 0;
      let s = "";
      while (index < length) {
        const base = buffer.getUint32(index, true);
        const color = buffer.getUint32(index + 4, true);

        const addr = base * 4;
        const x = base%360;
        const y = base/360;
        const rr = ((color >>> 11) % 32);
        const gg = ((color >>> 5) % 64);
        const bb = ((color >>> 0) % 32);
        // scale back up to 8 bits, ensuring that 0 maps to 0 and 0x1F maps to 0xFF
        const r = (rr << 3) | ((rr >>> 2) & 7);
        const g = (gg << 2) | ((gg >>> 3) & 3);
        const b = (bb << 3) | ((bb >>> 2) & 7);

        s += `(${x},${y}:${color}:${r},${g},${b}) `;

        img[addr] = r;
        img[addr+1] = g;
        img[addr+2] = b;
        img[addr+3] = 255;
        index += 8;
      }
      // this.log(s);
      this.ctx.putImageData(this.imagedata, 0, 0);
    }
  };

  render() {

    const connected = this.state.connected;

    const canvas =
      <div className={s.container}>
        <div className={s.background}>
          <div className={s.display}>
            <canvas ref="canvas"
                    style={{visibility: connected ? 'visible' : 'hidden'}}
                    className={s.view} width={this.props.width} height={this.props.height}/>
            <div className={s.glass}
                 style={{visibility: !connected ? 'visible' : 'visible'}}
                 width={this.props.width} height={this.props.height}>
            </div>
          </div>
        </div>
      </div>;


    return (
      <div className={s.root}>
          {canvas}
      </div>
    );
  }
}

