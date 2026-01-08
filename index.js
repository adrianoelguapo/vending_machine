/* --- Imports de módulos necesarios --- */
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const { MongoClient } = require('mongodb');
const path = require('node:path');
const fs = require('fs');

/* --- Creación de la ventana --- */
const createWindow = () => {

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  const windowWidth = Math.floor(screenWidth * 0.44);
  const windowHeight = screenHeight;
  
  const win = new BrowserWindow({

    width: windowWidth,
    height: windowHeight,
    resizable: false,
    webPreferences: {

      preload: path.join(__dirname, 'preload.js')

    }

  });

  win.loadFile('./html/index.html');

};

/* --- Variables de conexión a MongoDB --- */
const MONGO_URI = "mongodb+srv://admin:123@cluster0.tz018.mongodb.net/?appName=Cluster0";
const DB_NAME = "vending_machine";
const COLLECTION_NAME = "machine";

/* --- Valores de las cantidades de dinero --- */
const VALUES = {
  1: 0.10,
  2: 0.20,
  3: 0.50,
  4: 1.00,
  5: 2.00,
  6: 5.00,
  7: 10.00,
  8: 20.00
};

/* --- Cargar productos --- */
ipcMain.handle('fetch-products', async () => {
  const client = new MongoClient(MONGO_URI);

  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      const machineData = await collection.findOne({});

      return machineData ? machineData.products : [];

  } catch (error) {

      console.error("Failed to fetch products:", error);
      return [];


  } finally {

      await client.close();

  }
});

/* --- Obtener dinero metido en la máquina --- */
ipcMain.handle('get-credit', async () => {
  const client = new MongoClient(MONGO_URI);

  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      const machineData = await collection.findOne({});
      
      if (!machineData || !machineData.money_inserted) {

          return 0;

      }
      
      /* --- Se calcula la cantidad total sumando el valor de cada tipo de cantidad por la cantidad de insertada --- */
      let total = 0;
      machineData.money_inserted.forEach(denomination => {

          const value = VALUES[denomination.id] || 0;
          total += value * denomination.quantity;

      });
      
      return parseFloat(total.toFixed(2));

  } catch (error) {

      console.error("Failed to get credit:", error);
      return 0;

  } finally {

      await client.close();

  }

});

/* --- Insertar dinero en la máquina --- */
ipcMain.handle('insert-money', async (event, denominationId) => {
  const client = new MongoClient(MONGO_URI);

  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      
      /* --- Se incrementa el valor del crédito (dinero insertado en la máquina) en el valor de la cantidad de dinero insertada --- */
      await collection.updateOne(
          {},
          { $inc: { [`money_inserted.$[elem].quantity`]: 1 } },
          { arrayFilters: [{ "elem.id": denominationId }] }
      );
      
      /* --- Se obtiene el valor del crédito actualizado --- */
      const machineData = await collection.findOne({});

      let total = 0;
      machineData.money_inserted.forEach(denomination => {

          const value = VALUES[denomination.id] || 0;
          total += value * denomination.quantity;

      });
      
      return parseFloat(total.toFixed(2));

  } catch (error) {

      console.error("Failed to insert money:", error);
      return null;

  } finally {

      await client.close();

  }

});

/* --- Comprar un producto --- */
ipcMain.handle('purchase-product', async (event, productCode) => {
  const client = new MongoClient(MONGO_URI);

  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      
      const machineData = await collection.findOne({});
      
      if (!machineData) {

          return { success: false, message: "Machine data not found" };

      }
      
      /* --- Se busca el producto en la máquina --- */
      const product = machineData.products.find(p => p.code === productCode);
      
      /* --- Si el producto no se encuentra se muestra un mensaje de error --- */
      if (!product) {

          return { success: false, message: "INVALID CODE" };

      }
      
      /* --- Se verifica que haya stock del producto --- */
      if (product.quantity <= 0) {

          return { success: false, message: `${product.name} - OUT OF STOCK` };
          
      }
      
      /* --- Se calcula el crédito actual --- */
      let credit = 0;

      machineData.money_inserted.forEach(denomination => {

          const value = VALUES[denomination.id] || 0;
          credit += value * denomination.quantity;

      });
      
      /* --- Si no hay crédito se muestra la información del producto --- */
      if (credit === 0) {

          return { 

              success: false, 
              message: `${product.name} - €${product.price.toFixed(2)}`,
              showInfo: true 

          };
          
      }
      
      /* --- Se verifica si el crédito es suficiente para comprar el producto --- */
      if (credit < product.price) {
          
          return { 

              success: false, 
              message: `INSUFFICIENT FUNDS\n${product.name} costs €${product.price.toFixed(2)}\nCredit: €${credit.toFixed(2)}` 

          };
          
      }
      
      /* --- Se calcula el cambio necesario --- */
      const changeNeeded = parseFloat((credit - product.price).toFixed(2));
      
      /* --- Se verifica si se puede dar cambio (si es necesario) --- */
      if (changeNeeded > 0) {
          
          /* --- Se calcula el dinero disponible en la máquina (incluyendo lo que se está insertando) --- */
          const availableMoney = [];
          
          /* --- Se agregan los billetes y monedas de la máquina --- */
          machineData.money.forEach(denomination => {
              availableMoney.push({

                  id: denomination.id,
                  value: VALUES[denomination.id],
                  quantity: denomination.quantity

              });
              
          });
          
          /* --- Se añade el dinero insertado (se añadirá a la máquina después de la compra) --- */
          machineData.money_inserted.forEach(denomination => {

              const existing = availableMoney.find(m => m.id === denomination.id);

              if (existing) {

                  existing.quantity += denomination.quantity;

              }

          });
          
          /* --- Se calcula el cambio --- */
          const changeResult = makeChange(changeNeeded, availableMoney);
          
          /* --- Si no se puede dar cambio se muestra un mensaje de error --- */
          if (!changeResult.success) {

              return {

                  success: false,
                  message: `NO CHANGE\nPress X to return money`

              };
              
          }
          
          /* --- Se puede dar cambio, se procede con la compra --- */
          const updates = [];
          
          /* --- Se mueven todos los billetes y monedas insertados a la máquina --- */
          machineData.money_inserted.forEach(denomination => {

              if (denomination.quantity > 0) {

                  updates.push(

                      collection.updateOne(

                          {},
                          { 
                              $inc: { 
                                  [`money.$[elem].quantity`]: denomination.quantity,
                                  [`money_inserted.$[elem2].quantity`]: -denomination.quantity
                              } 
                          },
                          { 
                              arrayFilters: [
                                  { "elem.id": denomination.id },
                                  { "elem2.id": denomination.id }
                              ] 
                          }

                      )

                  );

              }
              
          });
          
          /* --- Se devuelve el cambio restando la cantidad de monedas y billetes --- */
          changeResult.change.forEach(coin => {

              if (coin.quantity > 0) {

                  updates.push(

                      collection.updateOne(
                          {},
                          { $inc: { [`money.$[elem].quantity`]: -coin.quantity } },
                          { arrayFilters: [{ "elem.id": coin.id }] }

                      )

                  );

              }
              
          });
          
          /* --- Se resta 1 al stock del producto --- */
          updates.push(

              collection.updateOne(

                  {},
                  { $inc: { [`products.$[elem].quantity`]: -1 } },
                  { arrayFilters: [{ "elem.code": productCode }] }

              )

          );
          
          await Promise.all(updates);
          
          return { 

              success: true, 
              message: `${product.name}\nPURCHASED!\nChange: €${changeNeeded.toFixed(2)}`,
              credit: 0

          };

          
      } else {

          /* --- Si no se necesita cambio --- */
          const updates = [];
          
          /* --- Se mueven todos los billetes y monedas insertados a la máquina --- */
          machineData.money_inserted.forEach(denomination => {

              if (denomination.quantity > 0) {

                  updates.push(

                      collection.updateOne(

                          {},
                          { 
                              $inc: { 
                                  [`money.$[elem].quantity`]: denomination.quantity,
                                  [`money_inserted.$[elem2].quantity`]: -denomination.quantity
                              } 
                          },
                          { 
                              arrayFilters: [
                                  { "elem.id": denomination.id },
                                  { "elem2.id": denomination.id }
                              ] 
                          }

                      )

                  );

              }
              
          });
          
          /* --- Se resta 1 al stock del producto --- */
          updates.push(

              collection.updateOne(

                  {},
                  { $inc: { [`products.$[elem].quantity`]: -1 } },
                  { arrayFilters: [{ "elem.code": productCode }] }

              )

          );
          
          await Promise.all(updates);
          
          return { 

              success: true, 
              message: `${product.name}\nPURCHASED!\nExact change - No change returned`,
              credit: 0

          };

      }
      
  } catch (error) {

      console.error("Failed to purchase product:", error);
      return { success: false, message: "PURCHASE FAILED" };

  } finally {

      await client.close();

  }

});

/* --- Helper para calcular el cambio, se ha utilizado la siguiente documentación para ver más o menos como se hace:
- https://fanzhongzeng78.medium.com/greedy-algorithm-in-javascript-88f2d71edf5d
- https://stackoverflow.com/questions/31090857/greedy-algorithm-in-javascript
--- */
function makeChange(amount, availableMoney) {

  const sorted = availableMoney.sort((a, b) => b.value - a.value);
  const change = [];
  let remaining = amount;
  
  for (const denomination of sorted) {

      if (remaining <= 0) break;
      
      const needed = Math.floor(remaining / denomination.value);
      const canUse = Math.min(needed, denomination.quantity);
      
      if (canUse > 0) {

          change.push({

              id: denomination.id,
              value: denomination.value,
              quantity: canUse

          });

          remaining = parseFloat((remaining - (canUse * denomination.value)).toFixed(2));

      }
      
  }
  
  if (remaining > 0.001) {

      return { success: false };

  }
  
  return { success: true, change };

}

/* --- Devolver el dinero insertado en la máquina --- */
ipcMain.handle('return-money', async () => {
  const client = new MongoClient(MONGO_URI);

  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      
      const machineData = await collection.findOne({});
      
      if (!machineData || !machineData.money_inserted) {

          return { success: false, credit: 0 };

      }
      
      /* --- Se resetean las cantidades de cada cantidad de dinero --- */
      const updates = machineData.money_inserted.map(denomination => 

          collection.updateOne(

              {},
              { $set: { [`money_inserted.$[elem].quantity`]: 0 } },
              { arrayFilters: [{ "elem.id": denomination.id }] }

          )

      );
      
      await Promise.all(updates);
      
      return { success: true, credit: 0 };
      
  } catch (error) {

      console.error("Failed to return money:", error);
      return { success: false, credit: 0 };

  } finally {

      await client.close();

  }

});

/* --- Responer stock de un producto --- */
ipcMain.handle('restock-product', async (event, productCode, quantity) => {
  const client = new MongoClient(MONGO_URI);

  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      
      /* --- Incrementar la cantidad del producto --- */
      const result = await collection.updateOne(

          {},
          { $inc: { [`products.$[elem].quantity`]: quantity } },
          { arrayFilters: [{ "elem.code": productCode }] }

      );
      
      if (result.modifiedCount === 0) {

          return { success: false, message: "Product not found" };

      }
      
      return { success: true };
      
  } catch (error) {

      console.error("Failed to restock product:", error);
      return { success: false, message: "Restock failed" };

  } finally {

      await client.close();

  }

});

/* --- Cambiar el precio de un producto --- */
ipcMain.handle('change-product-price', async (event, productCode, newPrice) => {
  const client = new MongoClient(MONGO_URI);

  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      
      /* --- Validar que el precio sea un número válido (double) --- */
      const priceFloat = parseFloat(newPrice);
      if (isNaN(priceFloat) || priceFloat <= 0) {

          return { success: false, message: "Invalid price value" };
          
      }
      
      /* --- Actualizar el precio del producto --- */
      const result = await collection.updateOne(

          {},
          { $set: { [`products.$[elem].price`]: priceFloat } },
          { arrayFilters: [{ "elem.code": productCode }] }

      );
      
      if (result.modifiedCount === 0) {

          return { success: false, message: "Product not found" };

      }
      
      return { success: true };
      
  } catch (error) {

      console.error("Failed to change product price:", error);
      return { success: false, message: "Price change failed" };

  } finally {

      await client.close();

  }

});

/* --- Obtener el dinero de la máquina --- */
ipcMain.handle('fetch-money', async () => {
  const client = new MongoClient(MONGO_URI);
  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      const machineData = await collection.findOne({});

      return machineData ? machineData.money : [];

  } catch (error) {

      console.error("Failed to fetch money:", error);
      return [];

  } finally {

      await client.close();

  }

});

/* --- Retirar dinero de la máquina (solo una cantidad) --- */
ipcMain.handle('withdraw-money-denomination', async (event, denominationId) => {
  const client = new MongoClient(MONGO_URI);

  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      
      /* --- Resetear la cantidad deseada --- */
      const result = await collection.updateOne(

          {},
          { $set: { [`money.$[elem].quantity`]: 0 } },
          { arrayFilters: [{ "elem.id": denominationId }] }

      );
      
      if (result.modifiedCount === 0) {

          return { success: false, message: "Denomination not found" };

      }
      
      return { success: true };
      
  } catch (error) {

      console.error("Failed to withdraw money denomination:", error);
      return { success: false, message: "Withdrawal failed" };

  } finally {

      await client.close();

  }

});

/* --- Retirar TODO el dinero de la máquina --- */
ipcMain.handle('withdraw-all-money', async () => {
  const client = new MongoClient(MONGO_URI);

  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      const machineData = await collection.findOne({});
      
      if (!machineData || !machineData.money) {
          return { success: false, message: "No money data found" };
      }
      
      /* --- Poner a 0 el valor de todas las cantidades de dinero --- */
      const updates = machineData.money.map(denomination =>
          collection.updateOne(
              {},
              { $set: { [`money.$[elem].quantity`]: 0 } },
              { arrayFilters: [{ "elem.id": denomination.id }] }
          )
      );
      
      await Promise.all(updates);
      
      return { success: true };
      
  } catch (error) {

      console.error("Failed to withdraw all money:", error);
      return { success: false, message: "Withdrawal failed" };

  } finally {

      await client.close();

  }

});

/* --- Cambiar un producto --- */
ipcMain.handle('change-product', async (event, productCode, newName, newPrice, imageData) => {
  const client = new MongoClient(MONGO_URI);
  try {

      await client.connect();
      const database = client.db(DB_NAME);
      const collection = database.collection(COLLECTION_NAME);
      
      /* --- Validar que el precio sea un número válido (double) --- */
      const priceFloat = parseFloat(newPrice);
      if (isNaN(priceFloat) || priceFloat <= 0) {

          return { success: false, message: "Invalid price value" };
          
      }
      
      /* --- Actualizar el producto en la base de datos (nombre, precio, resetear cantidad a 0) --- */
      const result = await collection.updateOne(

          {},
          { 
              $set: { 
                  [`products.$[elem].name`]: newName,
                  [`products.$[elem].price`]: priceFloat,
                  [`products.$[elem].quantity`]: 0
              } 
          },
          { arrayFilters: [{ "elem.code": productCode }] }

      );
      
      if (result.modifiedCount === 0) {

          return { success: false, message: "Product not found" };
          
      }
      
      /* --- Si se proporciona una nueva imagen, guardar la nueva imagen --- */
      if (imageData) {

          try {
              
              const imageFilename = `${productCode}.png`;
              const imagePath = path.join(__dirname, 'images', 'products', imageFilename);
              
              const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
              const imageBuffer = Buffer.from(base64Data, 'base64');
              
              fs.writeFileSync(imagePath, imageBuffer);

          } catch (error) {

              console.error("Failed to save image:", error);
              return { success: false, message: "Failed to save image" };

          }

      }
      
      return { success: true };
      
  } catch (error) {

      console.error("Failed to change product:", error);
      return { success: false, message: "Product change failed" };

  } finally {

      await client.close();

  }

});


app.whenReady().then(() => {

  createWindow();
  
});