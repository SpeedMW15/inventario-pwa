/**
 * Capa de Arquitectura de Datos - Inicialización de SQLite y Persistencia en IndexedDB
 */

let db = null;
const DB_INDEXED_NAME = "InventarioAED_IndexedDB";
const STORE_NAME = "sqlite_file";
const ROW_ID = "current_db";

// Arrancar proceso automáticamente al cargar el DOM
document.addEventListener("DOMContentLoaded", initDatabase);

async function initDatabase() {
  try {
    // 1. Inicializar el motor WebAssembly de SQL.js
    const SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    // 2. Intentar recuperar datos previos guardados en IndexedDB
    const datosPersistidos = await cargarDeIndexedDB();

    if (datosPersistidos) {
      // Si existen datos, montamos la base de datos con ese estado binario
      db = new SQL.Database(new Uint8Array(datosPersistidos));
      console.log("💾 Base de datos restaurada con éxito desde IndexedDB.");
    } else {
      // Si no existen, creamos una base de datos nueva y vacía en memoria
      db = new SQL.Database();
      console.log("🧱 Creando base de datos limpia desde cero...");
      crearTablas();
      insertarDatosIniciales();
      await guardarEnIndexedDB();
    }

    // 3. Inicializar la interfaz visual (definida en ui.js)
    if (typeof initUI === 'function') {
      initUI();
    } else {
      console.error("❌ Error: La función initUI() no está disponible. Revisa el orden de tus scripts.");
    }
  } catch (error) {
    console.error("❌ Error crítico al inicializar la base de datos:", error);
  }
}

function crearTablas() {
  // Tabla de Usuarios para el Login y Roles
  db.run(`
    CREATE TABLE usuarios (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      nombre_completo TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('ADMINISTRADOR', 'ALMACENISTA'))
    );
  `);

  // Tablas del Catálogo Maestro
  db.run(`CREATE TABLE categorias (id_categoria INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE);`);
  db.run(`CREATE TABLE proveedores (id_proveedor INTEGER PRIMARY KEY AUTOINCREMENT, rfc TEXT NOT NULL UNIQUE, razon_social TEXT NOT NULL, telefono TEXT NOT NULL);`);
  
  db.run(`
    CREATE TABLE productos (
      id_producto INTEGER PRIMARY KEY AUTOINCREMENT, 
      codigo_barras TEXT NOT NULL UNIQUE, 
      nombre TEXT NOT NULL,
      precio_compra REAL NOT NULL CHECK (precio_compra > 0), 
      stock_actual INTEGER NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
      stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0), 
      id_categoria INTEGER NOT NULL, 
      id_proveedor INTEGER NOT NULL,
      FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (id_proveedor) REFERENCES proveedores (id_proveedor) ON UPDATE CASCADE ON DELETE RESTRICT
    );
  `);
  
  // Tablas de Historial y Auditoría de Movimientos
  db.run(`CREATE TABLE movimientos (id_movimiento INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')), tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA')), usuario_reg TEXT NOT NULL);`);
  db.run(`CREATE TABLE detalle_movimientos (id_detalle INTEGER PRIMARY KEY AUTOINCREMENT, id_movimiento INTEGER NOT NULL, id_producto INTEGER NOT NULL, cantidad INTEGER NOT NULL CHECK (cantidad > 0), FOREIGN KEY (id_movimiento) REFERENCES movimientos (id_movimiento) ON UPDATE CASCADE ON DELETE CASCADE, FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON UPDATE CASCADE ON DELETE RESTRICT);`);
  
  console.log("✔️ Estructura de tablas (DDL) creada exitosamente.");
}

function insertarDatosIniciales() {
  // Inyectar Usuarios Semilla para Control de Acceso
  db.run("INSERT INTO usuarios (username, password, nombre_completo, rol) VALUES ('admin', 'admin123', 'Luis Fernando (Admin)', 'ADMINISTRADOR');");
  db.run("INSERT INTO usuarios (username, password, nombre_completo, rol) VALUES ('empleado', 'user123', 'Almacenista TESH', 'ALMACENISTA');");

  // Datos del catálogo base
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
  
  // Logs iniciales de prueba
  db.run("INSERT INTO movimientos (tipo, usuario_reg) VALUES ('ENTRADA', 'admin'), ('SALIDA', 'admin');");
  db.run("INSERT INTO detalle_movimientos (id_movimiento, id_producto, cantidad) VALUES (1, 1, 10), (2, 3, 1);");
  console.log("✔️ Registros iniciales (DML) insertados con éxito.");
}

// Guarda el estado actual binario de la BD en IndexedDB
function guardarEnIndexedDB() {
  return new Promise((resolve, reject) => {
    try {
      // Exportamos y extraemos el buffer crudo para máxima compatibilidad con IndexedDB
      const exportacion = db.export();
      const arrayBinario = exportacion.buffer; 

      const request = indexedDB.open(DB_INDEXED_NAME, 1);

      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = (e) => {
        const database = e.target.result;
        const transaction = database.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        
        // Guardamos el ArrayBuffer, el cual es un clon estructurado válido
        const putRequest = store.put({ id: ROW_ID, data: arrayBinario });
        putRequest.onsuccess = () => resolve(true);
        putRequest.onerror = () => reject(putRequest.error);
      };

      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
}

// Recupera el archivo binario desde IndexedDB
function cargarDeIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_INDEXED_NAME, 1);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = (e) => {
      const database = e.target.result;
      const transaction = database.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      
      const getRequest = store.get(ROW_ID);
      getRequest.onsuccess = () => {
        if (getRequest.result && getRequest.result.data) {
          // Reconstruimos el Uint8Array pasándole el ArrayBuffer recuperado
          resolve(new Uint8Array(getRequest.result.data));
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    };

    request.onerror = () => reject(request.error);
  });
}

// Exportación física para planes de contingencia (Rúbrica de evaluación)
async function exportarBaseDatos() {
  try {
    const arrayBinario = db.export();
    const blob = new Blob([arrayBinario], { type: "application/x-sqlite3" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup_inventario_sqlite.db";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("📥 Archivo físico .db generado y descargado con éxito.");
  } catch (error) {
    console.error("Error al exportar archivo físico .db:", error);
  }
}