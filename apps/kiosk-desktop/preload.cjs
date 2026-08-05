const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kioskDesktop", {
  isDesktop: true,
  getConfig: () => ipcRenderer.invoke("kiosk:getConfig"),
  saveAndConnect: (config) => ipcRenderer.invoke("kiosk:saveAndConnect", config),
  retryConnect: () => ipcRenderer.invoke("kiosk:retryConnect"),
  openSetup: () => ipcRenderer.invoke("kiosk:openSetup"),
  getUpdateStatus: () => ipcRenderer.invoke("desktop-update:getStatus"),
  installUpdate: () => ipcRenderer.invoke("desktop-update:install"),
  checkForUpdate: () => ipcRenderer.invoke("desktop-update:check"),
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") return () => undefined;
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("desktop-update:status", handler);
    return () => ipcRenderer.removeListener("desktop-update:status", handler);
  },
});
