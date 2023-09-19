import { ipcRenderer as defaultIpcRenderer } from 'electron';

interface IpcMessages {
  backend: Record<string, any>;
  frontend: Record<string, any>;
}

interface IpcRenderer {
  on(channel: string, listener: ElectronEventListener): void;
  off(channel: string, listener: ElectronEventListener): void;
  send(channel: string, message: any): void;
}

type ElectronEventListener = (event: Electron.IpcRendererEvent, value: any) => void;
type EventListener<T = any> = (value: T, event: Electron.IpcRendererEvent) => void;

interface Ipc<T extends IpcMessages> {
  on<C extends keyof T['backend']>(channel: C, listener: EventListener<T['backend'][C]>): void;
  off<C extends keyof T['backend']>(channel: C, listener: EventListener<T['backend'][C]>): void;
  send<C extends keyof T['frontend']>(channel: C, message: EventListener<T['frontend'][C]>): void;
}

export function standaloneIpcFactory<T extends IpcMessages>(ipcRenderer: IpcRenderer = defaultIpcRenderer): Ipc<T> {
  const electronListeners: Partial<Record<keyof T['backend'], ElectronEventListener>> = {};
  const eventListeners: Partial<Record<keyof T['backend'], EventListener[]>> = {};
  return {
    on(channel, listener) {
      if (!eventListeners[channel] || !Array.isArray(eventListeners[channel])) {
        eventListeners[channel] = [];
      }
      const listeners = eventListeners[channel] as EventListener[];
      if (listeners.length === 0) {
        const electronEventListener: ElectronEventListener = (event, value) =>
          listeners.forEach((listener) => listener(value, event));
        electronListeners[channel] = electronEventListener;
        ipcRenderer.on(channel as string, electronEventListener);
      }
      listeners.push(listener);
    },
    off(channel, listener) {
      if (!eventListeners[channel] || !Array.isArray(eventListeners[channel])) return;
      const listeners = eventListeners[channel] as EventListener[];
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
      if (listeners.length === 0) {
        const electronListener = electronListeners[channel];
        if (electronListener) {
          ipcRenderer.off(channel as string, electronListener);
          electronListeners[channel] = undefined;
        }
      }
    },
    send(channel, message) {
      ipcRenderer.send(channel as string, message);
    },
  };
}
