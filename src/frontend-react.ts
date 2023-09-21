import { useEffect } from 'react';
import type * as Electron from 'electron';

interface IpcMessages {
  backend: Record<string, any>;
  frontend: Record<string, any>;
}

interface ElectronWindow {
  ipc: {
    on(channel: string, listener: ElectronEventListener): void;
    off(channel: string, listener: ElectronEventListener): void;
    send(channel: string, message: any): void;
  };
}

type ElectronEventListener = (event: Electron.IpcRendererEvent, value: any) => void;
type EventListener<T = any> = (value: T, event: Electron.IpcRendererEvent) => void;

type UseIpcListener<T extends IpcMessages> = <C extends keyof T['backend']>(
  channel: C,
  listener: EventListener<T['backend'][C]>,
  props: any[]
) => void;
type SendIpcMessage<T extends IpcMessages> = <C extends keyof T['frontend']>(
  channel: C,
  value: T['frontend'][C]
) => void;

const globalWindow = window as unknown as ElectronWindow;

export function reactFrontendIpcFactory<T extends IpcMessages>(
  window: ElectronWindow = globalWindow
): [UseIpcListener<T>, SendIpcMessage<T>] {
  const electronListeners: Partial<Record<keyof T['backend'], ElectronEventListener>> = {};
  const eventListeners: Partial<Record<keyof T['backend'], EventListener[]>> = {};
  function useIpcListener<C extends keyof T['backend']>(
    channel: C,
    listener: (value: T['backend'][C], event: Electron.IpcRendererEvent) => void,
    props: any[] = []
  ) {
    if (!eventListeners[channel] || !Array.isArray(eventListeners[channel])) {
      eventListeners[channel] = [];
    }
    const listeners = eventListeners[channel] as EventListener[];
    if (listeners.length === 0) {
      const electronEventListener: ElectronEventListener = (event, value) =>
        listeners.forEach((listener) => listener(value, event));
      electronListeners[channel] = electronEventListener;
      window.ipc.on(channel as string, electronEventListener);
    }
    useEffect(() => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
        if (listeners.length === 0) {
          const electronListener = electronListeners[channel];
          if (electronListener) {
            window.ipc.off(channel as string, electronListener);
            electronListeners[channel] = undefined;
          }
        }
      };
    }, props);
  }
  function sendIpcMessage<C extends keyof T['frontend']>(channel: C, value: T['frontend'][C]): void {
    window.ipc.send(channel as string, value);
  }
  return [useIpcListener, sendIpcMessage];
}
