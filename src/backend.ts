import type * as Electron from 'electron';
import { ipcMain as defaultIpcMain } from 'electron';

interface IpcMessages {
  backend: Record<string, any>;
  frontend: Record<string, any>;
}

type ElectronEventListener = (event: Electron.IpcMainEvent, value: any) => any;
type EventListener<T = any> = (value: T, event: Electron.IpcMainEvent) => any;
type Unsubscribe = () => void;

interface IpcMain {
  on(channel: string, listener: ElectronEventListener): void;
  off(channel: string, listener: ElectronEventListener): void;
}

interface BrowserWindow {
  webContents: {
    send(channel: string, value: any): void;
  };
}

export class BackendIpc<T extends IpcMessages> {
  private electronListeners: Partial<Record<keyof T['frontend'], ElectronEventListener>> = {};
  private listeners: Partial<Record<keyof T['frontend'], EventListener[]>> = {};
  private browserWindow: BrowserWindow | null = null;
  private outstandingMessages: Record<string, any[]> = {};
  constructor(private ipcMain: IpcMain = defaultIpcMain) {}
  public provideBrowserWindow(window: BrowserWindow) {
    this.browserWindow = window;
    for (const channel of Object.keys(this.outstandingMessages)) {
      for (const value of this.outstandingMessages[channel]) {
        window.webContents.send(channel, value);
      }
    }
    this.outstandingMessages = {};
  }
  public on<C extends keyof T['frontend']>(channel: C, listener: EventListener<T['frontend'][C]>): Unsubscribe {
    if (!this.listeners[channel] || !Array.isArray(this.listeners[channel])) {
      this.listeners[channel] = [];
    }
    const listeners = this.listeners[channel] as EventListener[];
    if (listeners.length === 0) {
      const electronEventListener: ElectronEventListener = (event, value) =>
        listeners.forEach((listener) => listener(value, event));
      this.electronListeners[channel] = electronEventListener;
      this.ipcMain.on(channel as string, electronEventListener);
    }
    listeners.push(listener);
    return this.off.bind(this, channel, listener);
  }
  public off(channel: keyof T['frontend'], listener: EventListener<any>): void {
    const listeners = this.listeners[channel];
    if (Array.isArray(listeners)) {
      const indexOfListener = listeners.indexOf(listener);
      if (indexOfListener < 0) return;
      listeners.splice(indexOfListener, 1);
      if (listeners.length === 0) {
        const electronListener = this.electronListeners[channel];
        if (electronListener) {
          this.ipcMain.off(channel as string, electronListener);
          this.electronListeners[channel] = undefined;
        }
      }
    }
  }
  public send<C extends keyof T['backend']>(channel: C, value: T['backend'][C]): void {
    if (this.browserWindow) {
      this.browserWindow.webContents.send(channel as string, value);
    } else {
      if (!this.outstandingMessages[channel as string]) {
        this.outstandingMessages[channel as string] = [];
      }
      this.outstandingMessages[channel as string].push(value);
    }
  }
}
