const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pointDesktop", {
  isDesktop: true,
  listDisplays: () => ipcRenderer.invoke("displays:list"),
  getAssignment: () => ipcRenderer.invoke("displays:getAssignment"),
  applyDisplays: (assignment) => ipcRenderer.invoke("displays:apply", assignment),
  showItemInFolder: (filePath) => ipcRenderer.invoke("shell:showItemInFolder", filePath),
  openPath: (targetPath) => ipcRenderer.invoke("shell:openPath", targetPath),
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
