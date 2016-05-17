import React from 'react';
import { DeviceScreen } from "../../components";

export default {

  path: '/device',

  action() {
    const props = {
      title: 'Device View',
      width: 320,
      height: 240,
      url: `ws://${window.location.hostname}:7376/`,
      reconnect: 2.0
    };

    return {
      title: props.title,
      component: DeviceScreen,
      props,
    };
  }

};
