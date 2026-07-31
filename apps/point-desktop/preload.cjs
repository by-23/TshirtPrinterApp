const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pointDesktop", {
  isDesktop: true,
  listDisplays: () => ipcRenderer.invoke("displays:list"),
  getAssignment: () => ipcRenderer.invoke("displays:getAssignment"),
  applyDisplays: (assignment) => ipcRenderer.invoke("displays:apply", assignment),
});
