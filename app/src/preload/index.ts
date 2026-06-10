import { contextBridge, ipcRenderer } from 'electron';
import type { AkyBridge } from '@shared/ipc-contract';

const bridge: AkyBridge = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args) as never,
  on: (channel, listener) => {
    const wrapped = (_evt: unknown, payload: never) => listener(payload);
    ipcRenderer.on(channel, wrapped as never);
    return () => ipcRenderer.removeListener(channel, wrapped as never);
  }
};

contextBridge.exposeInMainWorld('aky', bridge);
