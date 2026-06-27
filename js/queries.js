/**
 * Capa de Abstracción de Datos - Consultas de Negocio y Transacciones SQL
 */

// 1. Obtener Catálogo Maestro Consolidado mediante JOINs de Tercera Forma Normal (3FN)
// 1. Obtener Catálogo Maestro Consolidado mediante JOINs de Tercera Forma Normal (3FN)
function obtenerReporteGeneral() {
  const query = `
    SELECT 
      p.id_producto,
      p.codigo_barras, 
      p.nombre, 
      c.nombre AS categoria, 
      p.stock_actual, 
      p.precio_compra, 
      prov.razon_social AS proveedor
    FROM productos p
    JOIN categorias c ON p.id_categoria = c.id_categoria
    JOIN proveedores prov ON p.id_proveedor = prov.id_proveedor;
  `;
  try {
    const res = db.exec(query);
    return res.length > 0 ? res[0].values : [];
  } catch (error) {
    console.error("Error en consulta general:", error);
    return [];
  }
}

// 2. Alertas de Control de Stock Crítico (Existencias <= Mínimo)
function obtenerStockCritico() {
  const query = `SELECT nombre, stock_actual, stock_minimo FROM productos WHERE stock_actual <= stock_minimo;`;
  try {
    const res = db.exec(query);
    return res.length > 0 ? res[0].values : [];
  } catch (error) {
    console.error("Error en stock crítico:", error);
    return [];
  }
}

// 3. Métricas Estadísticas para los KPI del Dashboard
function obtenerMetricasDashboard() {
  try {
    const totalProd = db.exec("SELECT COUNT(*) FROM productos;")[0].values[0][0];
    const criticos = db.exec("SELECT COUNT(*) FROM productos WHERE stock_actual <= stock_minimo;")[0].values[0][0];
    const totalMovs = db.exec("SELECT COUNT(*) FROM movimientos;")[0].values[0][0];
    
    return {
      totalProductos: totalProd,
      stockCriticoCount: criticos,
      totalMovimientos: totalMovs
    };
  } catch (e) {
    return { totalProductos: 0, stockCriticoCount: 0, totalMovimientos: 0 };
  }
}

// 4. Obtener Lista de Productos para Rellenar Selects del Formulario de Movimientos
function obtenerListaProductosSelect() {
  try {
    const res = db.exec("SELECT id_producto, nombre FROM productos;");
    return res.length > 0 ? res[0].values : [];
  } catch (e) {
    return [];
  }
}

// 5. Inserción de Movimientos (DML con Control de Atomicidad y Propiedades ACID)
async function insertarMovimiento(tipo, idProducto, cantidad, usuario) {
  try {
    db.run("BEGIN TRANSACTION;");

    // Validar existencias físicas en caso de ser un flujo de salida
    if (tipo === "SALIDA") {
      const res = db.exec(`SELECT stock_actual FROM productos WHERE id_producto = ${idProducto};`);
      const stockActual = res[0].values[0][0];
      if (stockActual < cantidad) {
        alert("❌ Error: Existencias insuficientes para procesar la salida solicitada.");
        db.run("ROLLBACK;");
        return false;
      }
    }

    // Insertar el log maestro del movimiento
    const stmtMov = db.prepare("INSERT INTO movimientos (tipo, usuario_reg) VALUES (?, ?);");
    stmtMov.run([tipo, usuario]);
    stmtMov.free();

    // Recuperar el ID incremental generado de forma automática
    const idMovimiento = db.exec("SELECT last_insert_rowid();")[0].values[0][0];

    // Vincular el detalle del artículo y unidades correspondientes
    const stmtDetalle = db.prepare("INSERT INTO detalle_movimientos (id_movimiento, id_producto, cantidad) VALUES (?, ?, ?);");
    stmtDetalle.run([idMovimiento, idProducto, cantidad]);
    stmtDetalle.free();

    // Actualizar de forma directa el Stock de la entidad Productos
    const factor = (tipo === "ENTRADA") ? cantidad : -cantidad;
    db.run(`UPDATE productos SET stock_actual = stock_actual + (${factor}) WHERE id_producto = ${idProducto};`);

    db.run("COMMIT;");
    
    // Guardar los cambios binarios de forma asíncrona
    await guardarEnIndexedDB();
    return true;
  } catch (error) {
    db.run("ROLLBACK;");
    console.error("Transacción abortada (Rollback automático):", error);
    return false;
  }
}

// 6. Validar Credenciales de Usuario (Login con paso seguro de parámetros)
function verificarCredenciales(username, password) {
  const query = `SELECT username, nombre_completo, rol FROM usuarios WHERE username = ? AND password = ?;`;
  try {
    const stmt = db.prepare(query);
    stmt.bind([username, password]);
    
    let usuario = null;
    if (stmt.step()) {
      const row = stmt.get();
      usuario = {
        username: row[0],
        nombre: row[1],
        rol: row[2]
      };
    }
    stmt.free();
    return usuario; 
  } catch (error) {
    console.error("Error en la consulta de autenticación:", error);
    return null;
  }
}

// 7. Insertar o Actualizar un Producto (UPSERT / Lógica CRUD Adaptativa)
async function guardarProducto(idProducto, codigo, nombre, costo, stockMin, idCat, idProv) {
  try {
    db.run("BEGIN TRANSACTION;");

    if (idProducto) {
      // MODO EDICIÓN: El registro ya posee una llave primaria existente
      const stmt = db.prepare(`
        UPDATE productos 
        SET codigo_barras = ?, nombre = ?, precio_compra = ?, stock_minimo = ?, id_categoria = ?, id_proveedor = ?
        WHERE id_producto = ?;
      `);
      stmt.run([codigo, nombre, costo, stockMin, idCat, idProv, idProducto]);
      stmt.free();
      console.log(`Producto ID ${idProducto} modificado exitosamente.`);
    } else {
      // MODO NUEVO ALTA: Inserta registro partiendo de existencias en cero
      const stmt = db.prepare(`
        INSERT INTO productos (codigo_barras, nombre, precio_compra, stock_actual, stock_minimo, id_categoria, id_proveedor)
        VALUES (?, ?, ?, 0, ?, ?, ?);
      `);
      stmt.run([codigo, nombre, costo, stockMin, idCat, idProv]);
      stmt.free();
      console.log("Nuevo producto ingresado al catálogo maestro.");
    }

    db.run("COMMIT;");
    await guardarEnIndexedDB();
    return true;
  } catch (error) {
    db.run("ROLLBACK;");
    console.error("Error de base de datos en guardarProducto:", error);
    alert("❌ Error de integridad: Compruebe que el código de barras no pertenezca a otro producto.");
    return false;
  }
}

// 8. Recuperar Atributos de un Producto por su ID (Para rellenar los inputs al editar)
function obtenerProductoPorId(id) {
  try {
    const query = `SELECT id_producto, codigo_barras, nombre, precio_compra, stock_minimo, id_categoria, id_proveedor FROM productos WHERE id_producto = ${id};`;
    const resultado = db.exec(query);
    return resultado.length > 0 ? resultado[0].values[0] : null;
  } catch (error) {
    console.error("Error al recuperar producto para edición:", error);
    return null;
  }
}

// 9. Obtener Listas Maestras Auxiliares (Poblar selects dinámicos de formularios)
function obtenerCategoriasYProveedores() {
  try {
    const cats = db.exec("SELECT id_categoria, nombre FROM categorias;")[0].values;
    const provs = db.exec("SELECT id_proveedor, razon_social FROM proveedores;")[0].values;
    return { cats, provs };
  } catch (e) {
    return { cats: [], provs: [] };
  }
}