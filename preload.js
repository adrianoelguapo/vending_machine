const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});

contextBridge.exposeInMainWorld('api', {
    fetchProducts: () => ipcRenderer.invoke('fetch-products'),
    getCredit: () => ipcRenderer.invoke('get-credit'),
    insertMoney: (denominationId) => ipcRenderer.invoke('insert-money', denominationId),
    purchaseProduct: (productCode) => ipcRenderer.invoke('purchase-product', productCode),
    returnMoney: () => ipcRenderer.invoke('return-money'),
    restockProduct: (productCode, quantity) => ipcRenderer.invoke('restock-product', productCode, quantity),
    changeProductPrice: (productCode, newPrice) => ipcRenderer.invoke('change-product-price', productCode, newPrice),
    fetchMoney: () => ipcRenderer.invoke('fetch-money'),
    withdrawMoneyDenomination: (denominationId) => ipcRenderer.invoke('withdraw-money-denomination', denominationId),
    withdrawAllMoney: () => ipcRenderer.invoke('withdraw-all-money'),
    changeProduct: (productCode, newName, newPrice, imageData) => ipcRenderer.invoke('change-product', productCode, newName, newPrice, imageData)
});