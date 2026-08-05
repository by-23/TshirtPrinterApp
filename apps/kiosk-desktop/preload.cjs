const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kioskDesktop", {
  isDesktop: true,
  getConfig: () => ipcRenderer.invoke("kiosk:getConfig"),
  saveAndConnect: (config) => ipcRenderer.invoke("kiosk:saveAndConnect", config),
  retryConnect: () => ipcRenderer.invoke("kiosk:retryConnect"),
  openSetup: () => ipcRenderer.invoke("kiosk:openSetup"),
});
