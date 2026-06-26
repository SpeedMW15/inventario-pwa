// Variable global para almacenar la instancia de la base de datos
let db;
const DB_NAME = "InventarioAED_IndexedDB";
const STORE_NAME = "sqlite_file";

// Inicializar el motor SQLite (WebAssembly) con persistencia en IndexedDB
async function initDatabase() {
  try {
    const SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    // 1. Intentar abrir IndexedDB y recuperar el archivo binario de la BD
    const bufferGuardado = await cargarDeIndexedDB();

    if (bufferGuardado) {
      // Si existe un respaldo físico previo, lo montamos en el motor de memoria
      db = new SQL.Database(new Uint8Array(bufferGuardado));
      console.log("🚀 Base de datos restaurada con éxito desde IndexedDB.");
    } else {
      // Si es la primera ejecución del usuario, inicializamos la estructura en blanco
      db = new SQL.Database();
      console.log("📦 Inicializando nueva base de datos relacional en memoria...");
      
      db.run("PRAGMA foreign_keys = ON;");
      crearTablas();
      insertarDatosIniciales();
      
      // Guardar inmediatamente este estado semilla
      await guardarEnIndexedDB();
    }

    // Arrancar los componentes visuales de la interfaz
    if (typeof initUI === 'function') {
      initUI();
    }

  } catch (error) {
    console.error("Error crítico en la inicialización con WebAssembly:", error);
  }
}

// ==========================================
// CAPA DE PERSISTENCIA REAL (IndexedDB ASÍNCRONO)
// ==========================================

function guardarEnIndexedDB() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();

    const binaryArray = db.export(); // Exporta como Uint8Array nativo
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (e) => {
      const database = e.target.result;
      const transaction = database.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      // Guardamos el buffer binario puro directamente, sin transformar a JSON string pesado
      const putRequest = store.put(binaryArray.buffer, "current_db");

      putRequest.onsuccess = () => {
        console.log("💾 Estado binario sincronizado permanentemente en IndexedDB.");
        resolve();
      };
      putRequest.onerror = () => reject(putRequest.error);
    };

    request.onerror = () => reject(request.error);
  });
}

function cargarDeIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (e) => {
      const database = e.target.result;
      const transaction = database.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get("current_db");

      getRequest.onsuccess = () => {
        resolve(getRequest.result); // Retorna el ArrayBuffer original o undefined si no hay nada
      };
      getRequest.onerror = () => reject(getRequest.error);
    };

    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// ESQUEMAS DDL Y DML (ESTRUCTURA ORIGINAL DEL REPORTE)
// ==========================================

function crearTablas() {
  db.run(`CREATE TABLE categorias (id_categoria INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE);`);
  db.run(`CREATE TABLE proveedores (id_proveedor INTEGER PRIMARY KEY AUTOINCREMENT, rfc TEXT NOT NULL UNIQUE, razon_social TEXT NOT NULL, telefono TEXT NOT NULL);`);
  db.run(`
    CREATE TABLE productos (
      id_producto INTEGER PRIMARY KEY AUTOINCREMENT, codigo_barras TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL,
      precio_compra REAL NOT NULL CHECK (precio_compra > 0), stock_actual INTEGER NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
      stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0), id_categoria INTEGER NOT NULL, id_proveedor INTEGER NOT NULL,
      FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (id_proveedor) REFERENCES proveedores (id_proveedor) ON UPDATE CASCADE ON DELETE RESTRICT
    );
  `);
  db.run(`CREATE TABLE movimientos (id_movimiento INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')), tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA')), usuario_reg TEXT NOT NULL);`);
  db.run(`CREATE TABLE detalle_movimientos (id_detalle INTEGER PRIMARY KEY AUTOINCREMENT, id_movimiento INTEGER NOT NULL, id_producto INTEGER NOT NULL, cantidad INTEGER NOT NULL CHECK (cantidad > 0), FOREIGN KEY (id_movimiento) REFERENCES movimientos (id_movimiento) ON UPDATE CASCADE ON DELETE CASCADE, FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON UPDATE CASCADE ON DELETE RESTRICT);`);
  console.log("DDL Listo.");
}

function insertarDatosIniciales() {
  db.run("INSERT INTO categorias (nombre) VALUES ('Cómputo'), ('Redes'), ('Accesorios');");
  db.run("INSERT INTO proveedores (rfc, razon_social, telefono) VALUES ('CUM951201H23', 'Suministros PC S.A. de C.V.', '5551234567'), ('NET010412TR8', 'Redes Globales de México', '5559876543');");
  db.run(`
    INSERT INTO productos (codigo_barras, nombre, precio_compra, stock_actual, stock_minimo, id_categoria, id_proveedor) 
    VALUES 
    ('7501234567011', 'Cable UTP Categoría 6 (305m)', 1250.00, 3, 5, 2, 2),
    ('7501234567028', 'Memoria RAM DDR4 16GB Kingston', 850.00, 15, 4, 1, 1),
    ('7501234567035', 'Switch Capa 3 Gestionable 24p', 4500.00, 1, 2, 2, 2),
    ('7501234567042', 'Mouse Óptico Ergonómico USB', 180.00, 25, 10, 3, 1),
    ('7501234567059', 'Disco Duro Sólido SSD 1TB NVMe', 1100.00, 2, 5, 1, 1);
  `);
  db.run("INSERT INTO movimientos (tipo, usuario_reg) VALUES ('ENTRADA', 'Luis_Fernando'), ('SALIDA', 'Luis_Fernando');");
  db.run("INSERT INTO detalle_movimientos (id_movimiento, id_producto, cantidad) VALUES (1, 1, 10), (2, 3, 1);");
  console.log("DML Listo.");
}

function exportarBaseDatos() {
  const binaryArray = db.export();
  const blob = new Blob([binaryArray], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "backup_inventario_sqlite.db";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

initDatabase();