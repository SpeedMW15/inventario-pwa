/**
 * Capa de Consultas SQL (Análisis y Extracción de Datos)
 * Este archivo aísla las sentencias SQL estructuradas en el reporte escrito.
 */

// 1. Obtener el Reporte Consolidado del Almacén (Sección 4.1 de tu reporte)
// Aplica JOINs para cruzar productos, categorías y proveedores
function obtenerReporteGeneral() {
  const query = `
    SELECT 
      p.codigo_barras AS Codigo, 
      p.nombre AS Producto, 
      c.nombre AS Categoria, 
      p.stock_actual AS Stock, 
      p.precio_compra AS Costo, 
      prov.razon_social AS Proveedor
    FROM productos p
    JOIN categorias c ON p.id_categoria = c.id_categoria
    JOIN proveedores prov ON p.id_proveedor = prov.id_proveedor;
  `;
  
  try {
    // db.exec devuelve un arreglo con la estructura [{columns: [...], values: [[...], [...]]}]
    const resultado = db.exec(query);
    return resultado.length > 0 ? resultado[0].values : [];
  } catch (error) {
    console.error("Error al ejecutar la consulta consolidada con JOINs:", error);
    return [];
  }
}

// 2. Obtener Alertas de Stock Crítico (Sección 4.2 de tu reporte)
// Filtra productos cuyas existencias sean menores o iguales al umbral mínimo
function obtenerStockCritico() {
  const query = `
    SELECT nombre, stock_actual, stock_minimo
    FROM productos
    WHERE stock_actual <= stock_minimo;
  `;
  
  try {
    const resultado = db.exec(query);
    return resultado.length > 0 ? resultado[0].values : [];
  } catch (error) {
    console.error("Error al ejecutar la consulta de optimización de stock crítico:", error);
    return [];
  }
}

// 3. Obtener Métricas Rápidas para las Tarjetas del Dashboard
function obtenerMetricasDashboard() {
  try {
    const totalProductos = db.exec("SELECT COUNT(*) FROM productos;")[0].values[0][0];
    const totalMovimientos = db.exec("SELECT COUNT(*) FROM movimientos;")[0].values[0][0];
    
    // Contar cuántos están en nivel crítico usando la misma lógica condicional
    const stockCriticoCount = db.exec("SELECT COUNT(*) FROM productos WHERE stock_actual <= stock_minimo;")[0].values[0][0];
    
    return {
      totalProductos,
      totalMovimientos,
      stockCriticoCount
    };
  } catch (error) {
    console.error("Error al calcular las métricas de control:", error);
    return { totalProductos: 0, totalMovimientos: 0, stockCriticoCount: 0 };
  }
}

// 4. Obtener Lista de Productos simplificada para poblar el elemento <select> del Formulario
function obtenerListaProductosSelect() {
  try {
    const resultado = db.exec("SELECT id_producto, nombre FROM productos;");
    return resultado.length > 0 ? resultado[0].values : [];
  } catch (error) {
    console.error("Error al recuperar el catálogo de productos para el formulario:", error);
    return [];
  }
}

// 5. Insertar una Nueva Transacción de Inventario (DML)
// Registra la cabecera del movimiento y su detalle, actualizando además el stock_actual
function insertarMovimiento(tipo, idProducto, cantidad, usuarioReg) {
  try {
    // Iniciar una transacción manual para asegurar las propiedades ACID en la operación mixta
    db.run("BEGIN TRANSACTION;");

    // A. Insertar en la cabecera (movimientos)
    // Usamos sentencias preparadas para evitar inyección SQL y simular buenas prácticas de desarrollo
    const stmtCabecera = db.prepare("INSERT INTO movimientos (tipo, usuario_reg) VALUES (?, ?);");
    stmtCabecera.run([tipo, usuarioReg]);
    stmtCabecera.free();

    // Recuperar el ID autoincremental generado para la cabecera
    const idMovimiento = db.exec("SELECT last_insert_rowid();")[0].values[0][0];

    // B. Insertar en el desglose (detalle_movimientos)
    const stmtDetalle = db.prepare("INSERT INTO detalle_movimientos (id_movimiento, id_producto, cantidad) VALUES (?, ?, ?);");
    stmtDetalle.run([idMovimiento, idProducto, cantidad]);
    stmtDetalle.free();

    // C. Actualizar el inventario físico (Ajuste del stock_actual en productos)
    if (tipo === 'ENTRADA') {
      db.run(`UPDATE productos SET stock_actual = stock_actual + ${cantidad} WHERE id_producto = ${idProducto};`);
    } else if (tipo === 'SALIDA') {
      // Validación previa para asegurar que la regla de negocio CHECK (stock_actual >= 0) no truene la app
      const stockActual = db.exec(`SELECT stock_actual FROM productos WHERE id_producto = ${idProducto};`)[0].values[0][0];
      if (stockActual < cantidad) {
        db.run("ROLLBACK;");
        alert("🚨 Error de Operación: No puedes registrar una SALIDA que supere las existencias físicas actuales (Violación de restricción CHECK).");
        return false;
      }
      db.run(`UPDATE productos SET stock_actual = stock_actual - ${cantidad} WHERE id_producto = ${idProducto};`);
    }

    // Confirmar los cambios si todo es consistente
    db.run("COMMIT;");
    console.log(`Transacción DML exitosa: Se registró un flujo de tipo ${tipo} para el producto ID ${idProducto}.`);
    return true;

  } catch (error) {
    // Si alguna restricción de llave o CHECK falla, revertimos para mantener la integridad referencial
    db.run("ROLLBACK;");
    console.error("Transacción abortada. Se ejecutó ROLLBACK debido a un fallo de integridad:", error);
    alert("❌ Error de integridad en la base de datos: Compruebe las restricciones.");
    return false;
  }
}