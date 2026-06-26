/**
 * Capa de Interfaz de Usuario (UI)
 * Conecta los elementos HTML con las consultas lógicas de SQLite.
 */

// Función de arranque de la interfaz, llamada automáticamente al iniciar db.js
function initUI() {
  actualizarDashboard();
  poblarSelectProductos();
  
  // Inicializar los iconos de Lucide (si se cargaron en el HTML)
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// 1. Controlador de Navegación Lateral (SPA)
function switchView(viewName) {
  // Lista de todas las vistas/secciones del HTML
  const views = ['dashboard', 'productos', 'movimientos'];
  
  views.forEach(v => {
    const section = document.getElementById(`view-shadow-${v}`) || document.getElementById(`view-${v}`);
    const btn = document.getElementById(`btn-${v}`);
    
    if (v === viewName) {
      section.classList.remove('hidden');
      // Resaltar botón activo
      btn.classList.add('bg-blue-600', 'text-white', 'font-medium');
      btn.classList.remove('hover:bg-slate-800', 'text-slate-300');
    } else {
      section.classList.add('hidden');
      // Restaurar botones inactivos
      btn.classList.remove('bg-blue-600', 'text-white', 'font-medium');
      btn.classList.add('hover:bg-slate-800', 'text-slate-300');
    }
  });

  // Modificar títulos dinámicamente según la sección
  const titleElem = document.getElementById('view-title');
  if (viewName === 'dashboard') {
    titleElem.innerText = "Resumen General";
    actualizarDashboard();
  } else if (viewName === 'productos') {
    titleElem.innerText = "Catálogo Maestro";
    renderizarTablaProductos();
  } else if (viewName === 'movimientos') {
    titleElem.innerText = "Gestión de Flujos de Almacén";
  }
}

// 2. Renderizar Datos del Dashboard (Métricas + Tabla de Stock Crítico)
function actualizarDashboard() {
  const metricas = obtenerMetricasDashboard();
  
  // Inyectar valores en las tarjetas de métricas
  document.getElementById('metric-total-productos').innerText = metricas.totalProductos;
  document.getElementById('metric-stock-critico').innerText = metricas.stockCriticoCount;
  document.getElementById('metric-total-movimientos').innerText = metricas.totalMovimientos;

  // Cargar registros de Alerta de Stock Crítico (Sección 4.2 del reporte)
  const productosCriticos = obtenerStockCritico();
  const tablaCritica = document.getElementById('table-stock-critico');
  tablaCritica.innerHTML = ''; // Limpiar filas anteriores

  if (productosCriticos.length === 0) {
    tablaCritica.innerHTML = `
      <tr>
        <td colspan="4" class="py-4 text-center text-slate-500 italic">
          🟢 Todos los productos se encuentran por encima del umbral mínimo de seguridad.
        </td>
      </tr>`;
    return;
  }

  productosCriticos.forEach(row => {
    const [nombre, stock_actual, stock_minimo] = row;
    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-800/50 hover:bg-slate-900/40 transition";
    tr.innerHTML = `
      <td class="py-3 font-medium text-slate-200">${nombre}</td>
      <td class="py-3 text-rose-400 font-bold">${stock_actual} pzas</td>
      <td class="py-3 text-slate-400">${stock_minimo} pzas</td>
      <td class="py-3">
        <span class="bg-rose-500/10 text-rose-400 text-[11px] font-semibold px-2 py-0.5 rounded border border-rose-500/20">
          REABASTECER
        </span>
      </td>
    `;
    tablaCritica.appendChild(tr);
  });
}

// 3. Renderizar Tabla General con Consultas Avanzadas (Sección 4.1 con JOINs)
function renderizarTablaProductos() {
  const productos = obtenerReporteGeneral();
  const tablaGeneral = document.getElementById('table-productos-general');
  tablaGeneral.innerHTML = '';

  if (productos.length === 0) {
    tablaGeneral.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500">No hay registros cargados.</td></tr>`;
    return;
  }

  productos.forEach(row => {
    const [codigo, producto, categoria, stock, costo, proveedor] = row;
    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-800/50 hover:bg-slate-900/40 transition";
    tr.innerHTML = `
      <td class="py-3 font-mono text-xs text-blue-400">${codigo}</td>
      <td class="py-3 font-medium text-slate-200">${producto}</td>
      <td class="py-3 text-slate-400">${categoria}</td>
      <td class="py-3 text-slate-300 font-semibold">${stock}</td>
      <td class="py-3 text-slate-300">$${Number(costo).toFixed(2)}</td>
      <td class="py-3 text-slate-400 text-xs">${proveedor}</td>
    `;
    tablaGeneral.appendChild(tr);
  });
}

// 4. Poblar las opciones del Formulario Dinámico
function poblarSelectProductos() {
  const select = document.getElementById('form-producto');
  const lista = obtenerListaProductosSelect();
  select.innerHTML = '';

  lista.forEach(prod => {
    const [id, nombre] = prod;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = nombre;
    select.appendChild(opt);
  });
}

// 5. Interceptar el envío del formulario DML
// Asegúrate de agregar 'async' al inicio de la función
async function registrarTransaccion(event) {
  event.preventDefault(); 

  const tipo = document.getElementById('form-tipo').value;
  const idProducto = parseInt(document.getElementById('form-producto').value);
  const cantidad = parseInt(document.getElementById('form-cantidad').value);
  const usuario = document.getElementById('form-usuario').value;

  // 🔥 Agrega 'await' aquí para que la app no cambie de página antes de guardar en IndexedDB
  const exito = await insertarMovimiento(tipo, idProducto, cantidad, usuario);

  if (exito) {
    alert(`🎉 ¡Movimiento de ${tipo} registrado con éxito en la base de datos!`);
    document.getElementById('form-movimiento').reset();
    document.getElementById('form-usuario').value = "Luis_Fernando"; 
    
    switchView('dashboard'); // Redirige y actualiza las métricas visuales
  }
}