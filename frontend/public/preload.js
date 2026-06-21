const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  notify: (options) => ipcRenderer.send('notify', options),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  openExternal: (url) => ipcRenderer.send('open:external', url),
  setBadge: (count) => ipcRenderer.send('badge:set', count),
  platform: process.platform,
});
