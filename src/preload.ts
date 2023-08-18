import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ipc', {
  on: (channel: string, listener: () => any) => ipcRenderer.on(channel, listener),
  off: (channel: string, listener: () => any) => ipcRenderer.off(channel, listener),
  send: (channel: string, message: any) => ipcRenderer.send(channel, message),
});
