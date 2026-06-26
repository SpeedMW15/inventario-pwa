// Variable global para almacenar la instancia de la base de datos
let db;

// Inicializar el motor SQLite (WebAssembly) con persistencia en LocalStorage
async function initDatabase() {
  try {
    const SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    // Intentar recuperar una sesión previa guardada en el navegador
    const estadoGuardado = localStorage.getItem("inventario_db_backup");

    if (estadoGuardado) {
      // Convertir la cadena de texto guardada de vuelta a un arreglo de bytes (Uint8Array)
      const u8array = new Uint8Array(JSON.parse(estadoGuardado));
      db = new SQL.Database(u8array);
      console.log("¡Base de datos restaurada con éxito desde el LocalStorage!");
    } else {
      // Si es la primera vez que abre la app, crear BD vacía en memoria
      db = new SQL.Database();
      console.log("¡Nueva base de datos iniciada en memoria!");
      
      db.run("PRAGMA foreign_keys = ON;");
      crearTablas();
      insertarDatosIniciales();
      
      // Guardar el estado inicial
      guardarEnLocalStorage();
    }

    if (typeof initUI === 'function') {
      initUI();
    }

  } catch (error) {
    console.error("Error crítico al inicializar la base de datos con WebAssembly:", error);
  }
}

// Nueva función para persistir el estado binario de SQLite en el navegador
function guardarEnLocalStorage() {
  if (db) {
    const binaryArray = db.export(); // Exporta la BD como Uint8Array
    const arrayPlano = Array.from(binaryArray); // Convierte a un arreglo común para poder serializarlo
    localStorage.setItem("inventario_db_backup", JSON.stringify(arrayPlano));
    console.log("Estado de la base de datos sincronizado en LocalStorage.");
  }
}

// Estructura DDL y DML para la base de datos SQLite en memoria (3FN)
function crearTablas() {
  // Tabla: categorias
  db.run(`
    CREATE TABLE categorias (
      id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    );
  `);

  // Tabla: proveedores
  db.run(`
    CREATE TABLE proveedores (
      id_proveedor INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc TEXT NOT NULL UNIQUE,
      razon_social TEXT NOT NULL,
      telefono TEXT NOT NULL
    );
  `);

  // Tabla: productos (Con restricciones CHECK)
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

  // Tabla: movimientos (Cabecera)
  db.run(`
    CREATE TABLE movimientos (
      id_movimiento INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA')),
      usuario_reg TEXT NOT NULL
    );
  `);

  // Tabla: detalle_movimientos
  db.run(`
    CREATE TABLE detalle_movimientos (
      id_detalle INTEGER PRIMARY KEY AUTOINCREMENT,
      id_movimiento INTEGER NOT NULL,
      id_producto INTEGER NOT NULL,
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      FOREIGN KEY (id_movimiento) REFERENCES movimientos (id_movimiento) ON UPDATE CASCADE ON DELETE CASCADE,
      FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON UPDATE CASCADE ON DELETE RESTRICT
    );
  `);
  
  console.log("Scripts DDL ejecutados: Estructura relacional creada exitosamente (3FN).");
}

// Carga de datos base (DML) para auditoría y visualización inicial
function insertarDatosIniciales() {
  // Insertar Categorías
  db.run("INSERT INTO categorias (nombre) VALUES ('Cómputo'), ('Redes'), ('Accesorios');");

  // Insertar Proveedores
  db.run("INSERT INTO proveedores (rfc, razon_social, telefono) VALUES ('CUM951201H23', 'Suministros PC S.A. de C.V.', '5551234567'), ('NET010412TR8', 'Redes Globales de México', '5559876543');");

  // Insertar Productos (Con stocks variados, algunos caerán en Stock Crítico deliberadamente)
  db.run(`
    INSERT INTO productos (codigo_barras, nombre, precio_compra, stock_actual, stock_minimo, id_categoria, id_proveedor) 
    VALUES 
    ('7501234567011', 'Cable UTP Categoría 6 (305m)', 1250.00, 3, 5, 2, 2),  -- STOCK CRÍTICO (3 <= 5)
    ('7501234567028', 'Memoria RAM DDR4 16GB Kingston', 850.00, 15, 4, 1, 1),
    ('7501234567035', 'Switch Capa 3 Gestionable 24p', 4500.00, 1, 2, 2, 2),  -- STOCK CRÍTICO (1 <= 2)
    ('7501234567042', 'Mouse Óptico Ergonómico USB', 180.00, 25, 10, 3, 1),
    ('7501234567059', 'Disco Duro Sólido SSD 1TB NVMe', 1100.00, 2, 5, 1, 1); -- STOCK CRÍTICO (2 <= 5)
  `);

  // Insertar un Historial de Movimientos Iniciales
  db.run("INSERT INTO movimientos (tipo, usuario_reg) VALUES ('ENTRADA', 'Luis_Fernando'), ('SALIDA', 'Luis_Fernando');");
  db.run("INSERT INTO detalle_movimientos (id_movimiento, id_producto, cantidad) VALUES (1, 1, 10), (2, 3, 1);");

  console.log("Scripts DML ejecutados: Base de datos poblada con registros iniciales.");
}

// Función obligatoria para la Rúbrica (Fase 4: Plan de Respaldos / Exportar .db real)
function exportarBaseDatos() {
  const binaryArray = db.export();
  const blob = new Blob([binaryArray], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = "backup_inventario_sqlite.db";
  document.body.appendChild(a);
  a.click();
  
  // Limpieza
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Arrancar el proceso de carga de la base de datos al cargar este script
initDatabase();