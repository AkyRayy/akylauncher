"use strict";
const electron = require("electron");
const bridge = {
  invoke: (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const wrapped = (_evt, payload) => listener(payload);
    electron.ipcRenderer.on(channel, wrapped);
    return () => electron.ipcRenderer.removeListener(channel, wrapped);
  }
};
electron.contextBridge.exposeInMainWorld("aky", bridge);
