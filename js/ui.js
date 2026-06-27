/**
 * Capa de Interfaz de Usuario (UI) - Gestión de Sesiones, Vistas y Modales CRUD
 */

let usuarioActivo = null;
let idProductoEdicion = null; 

// 1. Inicialización de la UI
function initUI() {
  try {
    const sesionGuardada = sessionStorage.getItem("usuario_sesion");
    if (sesionGuardada) {
      usuarioActivo = JSON.parse(sesionGuardada);
      mostrarPanelPrincipal();
    } else {
      mostrarLoginModal();
    }

    setTimeout(() => {
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 150);
  } catch (error) {
    console.error("Error al arrancar la UI:", error);
  }
}

// 2. Controladores del Login
function mostrarLoginModal() {
  // Asegurarnos de limpiar si ya existía algún clon por error
  const loginViejo = document.getElementById("login-overlay");
  if(loginViejo) loginViejo.remove();

  const loginDiv = document.createElement('div');
  loginDiv.id = "login-overlay";
  loginDiv.className = "fixed inset-0 bg-slate-950 flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]";
  loginDiv.innerHTML = `
    <div class="bg-panel w-full max-w-md p-8 rounded-2xl border border-slate-800/80 shadow-2xl space-y-6">
      <div class="text-center space-y-2">
        <div class="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mx-auto border border-blue-500/20 shadow-lg">
          <i data-lucide="shield-check" class="w-6 h-6"></i>
        </div>
        <h3 class="text-xl font-bold text-white tracking-wide">Control de Acceso</h3>
        <p class="text-xs text-slate-400">Introduce tus credenciales institucionales</p>
      </div>
      
      <form id="form-login-autenticar" onsubmit="procesarLogin(event)" class="space-y-4 text-xs">
        <div>
          <label class="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Identificador de Usuario</label>
          <input type="text" id="login-username" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" placeholder="Ej. admin" required>
        </div>
        <div>
          <label class="block text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Clave de Seguridad</label>
          <input type="password" id="login-password" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition" placeholder="••••••••" required>
        </div>
        <button type="submit" class="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-400 hover:to-sky-500 text-white font-bold py-3 px-4 rounded-xl transition duration-200 shadow-md text-xs uppercase tracking-wider">
          Validar Firma Digital
        </button>
      </form>
      <div class="text-[10px] text-slate-500 text-center font-mono font-medium uppercase border-t border-slate-800/60 pt-4">TESH - Ingeniería en Sistemas Computacionales</div>
    </div>
  `;
  document.body.appendChild(loginDiv);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function procesarLogin(event) {
  event.preventDefault();
  const user = document.getElementById('login-username').value;
  const pass = document.getElementById('login-password').value;

  const usuario = verificarCredenciales(user, pass);

  if (usuario) {
    usuarioActivo = usuario;
    sessionStorage.setItem("usuario_sesion", JSON.stringify(usuario));
    document.getElementById('login-overlay').remove();
    mostrarPanelPrincipal();
  } else {
    alert("❌ Credenciales inválidas. Compruebe los usuarios semilla ('admin' o 'empleado').");
  }
}

function ejecutarLogout() {
  sessionStorage.removeItem("usuario_sesion");
  window.location.reload();
}

function mostrarPanelPrincipal() {
  document.getElementById('form-usuario').value = usuarioActivo.username;
  
  const headerInfo = document.querySelector('header div.text-right');
  if (headerInfo) {
    headerInfo.innerHTML = `
      <p class="font-bold text-white">${usuarioActivo.nombre}</p>
      <p class="text-sky-400 font-mono text-[10px] uppercase font-bold tracking-wider">${usuarioActivo.rol}</p>
    `;
  }
  
  const asideNav = document.querySelector('aside nav');
  if (asideNav && !document.getElementById('btn-logout')) {
    const btnLogout = document.createElement('button');
    btnLogout.id = "btn-logout";
    btnLogout.onclick = ejecutarLogout;
    btnLogout.className = "w-full text-left py-3 px-4 rounded-xl transition duration-200 text-rose-400 hover:bg-rose-500/10 flex items-center gap-3 mt-4 text-xs font-semibold";
    btnLogout.innerHTML = `<i data-lucide="log-out" class="w-4 h-4"></i> Cerrar Sesión`;
    asideNav.appendChild(btnLogout);
  }

  switchView('dashboard');
}

// 3. SPA Enrutador
function switchView(viewName) {
  if (!usuarioActivo) return;

  const views = ['dashboard', 'productos', 'movimientos'];
  
  views.forEach(v => {
    const section = document.getElementById(`view-${v}`);
    const btn = document.getElementById(`btn-${v}`);
    
    if (section && btn) {
      if (v === viewName) {
        section.classList.remove('hidden');
        btn.className = "w-full text-left py-3 px-4 rounded-xl transition duration-200 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium flex items-center gap-3 shadow-lg shadow-blue-600/10";
      } else {
        section.classList.add('hidden');
        btn.className = "w-full text-left py-3 px-4 rounded-xl transition duration-200 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 flex items-center gap-3";
      }
    }
  });

  const titleElem = document.getElementById('view-title');
  if (titleElem) {
    if (viewName === 'dashboard') {
      titleElem.innerText = "Resumen General";
      actualizarDashboard();
    } else if (viewName === 'productos') {
      titleElem.innerText = "Catálogo Maestro de Suministros";
      renderizarTablaProductos();
    } else if (viewName === 'movimientos') {
      titleElem.innerText = "Gestión de Flujos de Almacén";
      poblarSelectProductos();
    }
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 4. Catálogo Maestro Tabla
// 4. Catálogo Maestro Tabla (Orden de columnas corregido)
function renderizarTablaProductos() {
  const productos = obtenerReporteGeneral();
  const tablaGeneral = document.getElementById('table-productos-general');
  if(!tablaGeneral) return;
  
  const headerFila = document.querySelector('#view-productos table thead tr');
  if (headerFila && usuarioActivo.rol === 'ADMINISTRADOR' && !document.getElementById('th-acciones')) {
    const th = document.createElement('th');
    th.id = "th-acciones";
    th.className = "p-4 pr-6 text-right";
    th.textContent = "ACCIONES DE CONTROL";
    headerFila.appendChild(th);
  }

  let contenedorLista = document.querySelector('#view-productos .p-5');
  if (contenedorLista && usuarioActivo.rol === 'ADMINISTRADOR' && !document.getElementById('btn-abrir-alta')) {
    const btnAlta = document.createElement('button');
    btnAlta.id = "btn-abrir-alta";
    btnAlta.className = "mt-3 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg text-xs transition flex items-center gap-1.5 shadow-md";
    btnAlta.innerHTML = `<i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Dar de Alta Nuevo Producto`;
    btnAlta.onclick = () => abrirModalProducto();
    contenedorLista.appendChild(btnAlta);
  }

  tablaGeneral.innerHTML = '';

  if (productos.length === 0) {
    tablaGeneral.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-500">No hay registros cargados.</td></tr>`;
    return;
  }

  productos.forEach((row) => {
    // CORRECCIÓN AQUÍ: Cambiamos el orden de 'costo' y 'stock' para alinearse con la consulta de queries.js
    const [idProductoReal, codigo, producto, categoria, stock, costo, proveedor] = row;

    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-800/50 hover:bg-slate-900/40 transition text-xs";
    
    // El HTML mantiene su estructura visual correcta, pero ahora recibe las variables en su lugar real
    let filaHtml = `
      <td class="p-4 pl-6 font-mono font-semibold text-blue-400">${codigo}</td>
      <td class="p-4 font-semibold text-slate-200">${producto}</td>
      <td class="p-4 text-slate-400">${categoria}</td>
      <td class="p-4 text-slate-300 font-bold">${stock} pzas</td>
      <td class="p-4 text-emerald-400 font-semibold">$${Number(costo).toFixed(2)}</td>
      <td class="p-4 text-slate-400">${proveedor}</td>
    `;

    if (usuarioActivo.rol === 'ADMINISTRADOR') {
      filaHtml += `
        <td class="p-4 pr-6 text-right">
          <button onclick="abrirModalProducto(${idProductoReal})" class="text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 inline-flex">
            <i data-lucide="edit-3" class="w-3 h-3"></i> Editar
          </button>
        </td>
      `;
    }

    tr.innerHTML = filaHtml;
    tablaGeneral.appendChild(tr);
  });
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
}
// 5. Renderizar Dashboard
function actualizarDashboard() {
  const metricas = obtenerMetricasDashboard();
  
  const m1 = document.getElementById('metric-total-productos');
  const m2 = document.getElementById('metric-stock-critico');
  const m3 = document.getElementById('metric-total-movimientos');
  
  if(m1) m1.innerText = metricas.totalProductos;
  if(m2) m2.innerText = metricas.stockCriticoCount;
  if(m3) m3.innerText = metricas.totalMovimientos;

  const productosCriticos = obtenerStockCritico();
  const tablaCritica = document.getElementById('table-stock-critico');
  if(!tablaCritica) return;
  tablaCritica.innerHTML = '';

  if (productosCriticos.length === 0) {
    tablaCritica.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-500 italic">🟢 Todos los productos operan sobre el nivel de seguridad.</td></tr>`;
    return;
  }

  productosCriticos.forEach(row => {
    const [nombre, stock_actual, stock_minimo] = row;
    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-800/50 hover:bg-slate-900/40 transition text-xs";
    tr.innerHTML = `
      <td class="p-4 pl-6 font-medium text-slate-200">${nombre}</td>
      <td class="p-4 text-rose-400 font-bold">${stock_actual} pzas</td>
      <td class="p-4 text-slate-400">${stock_minimo} pzas</td>
      <td class="p-4 pr-6 text-right">
        <span class="bg-rose-500/10 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-500/20 uppercase">Abastecer</span>
      </td>
    `;
    tablaCritica.appendChild(tr);
  });
}

// 6. Modal CRUD Formulario
// 5. Mostrar Modal para Registrar / Editar Producto (Sincronizado)
function abrirModalProducto(idProducto = null) {
  idProductoEdicion = idProducto;
  const { cats, provs } = obtenerCategoriasYProveedores();
  
  let datosProd = ["", "", "", "", "", ""]; 
  let tituloModal = "Registrar Nuevo Suministro";

  if (idProducto) {
    tituloModal = "Modificar Atributos de Producto";
    const productoDb = obtenerProductoPorId(idProducto);
    if (productoDb) {
      datosProd = [productoDb[1], productoDb[2], productoDb[3], productoDb[4], productoDb[5], productoDb[6]];
    }
  }

  const modalDiv = document.createElement('div');
  modalDiv.id = "producto-modal";
  modalDiv.className = "fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.15s_ease-out]";
  modalDiv.innerHTML = `
    <div class="bg-panel w-full max-w-lg p-6 md:p-8 rounded-2xl border border-slate-800 shadow-2xl space-y-5">
      <div>
        <h3 class="text-base font-bold text-white flex items-center gap-2"><i data-lucide="package-plus" class="text-blue-400 w-5 h-5"></i> ${tituloModal}</h3>
        <p class="text-[11px] text-slate-400 mt-0.5">Control DML - Valida integridad referencial e índices únicos</p>
      </div>

      <form id="form-crud-producto" onsubmit="procesarFormularioProducto(event)" class="space-y-4 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">Código de Barras (EAN)</label>
            <input type="text" id="crud-codigo" value="${datosProd[0]}" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-medium focus:outline-none focus:border-blue-500 transition" placeholder="7501..." required>
          </div>
          <div>
            <label class="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">Nombre del Producto</label>
            <input type="text" id="crud-nombre" value="${datosProd[1]}" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-medium focus:outline-none focus:border-blue-500 transition" placeholder="Ej. Hub USB 3.0" required>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">Precio de Compra</label>
            <input type="number" step="0.01" id="crud-costo" value="${datosProd[2]}" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-medium focus:outline-none focus:border-blue-500 transition" placeholder="0.00" required>
          </div>
          <div>
            <label class="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">Stock Mínimo Alerta</label>
            <input type="number" id="crud-stockmin" value="${datosProd[3]}" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-medium focus:outline-none focus:border-blue-500 transition" placeholder="Ej. 5" required>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">Categoría Relacionada</label>
            <select id="crud-categoria" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white transition" required></select>
          </div>
          <div>
            <label class="block text-slate-400 font-semibold mb-1 uppercase tracking-wider">Proveedor Autorizado</label>
            <select id="crud-proveedor" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white transition" required></select>
          </div>
        </div>

        <div class="flex gap-3 pt-2">
          <button type="button" onclick="cerrarModalProducto()" class="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl transition uppercase tracking-wider text-[11px]">Cancelar</button>
          <button type="submit" class="w-1/2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-sky-400 text-white font-bold py-3 px-4 rounded-xl transition shadow-md uppercase tracking-wider text-[11px]">Guardar Cambios</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modalDiv);

  const selectCat = document.getElementById('crud-categoria');
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c[0]; opt.textContent = c[1];
    if(idProducto && c[0] === datosProd[4]) opt.selected = true;
    selectCat.appendChild(opt);
  });

  const selectProv = document.getElementById('crud-proveedor');
  provs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p[0]; opt.textContent = p[1];
    if(idProducto && p[0] === datosProd[5]) opt.selected = true;
    selectProv.appendChild(opt);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// 6. Procesar Guardar/Editar Producto (Sincronizado con los IDs exactos del Modal)
async function procesarFormularioProducto(event) {
  event.preventDefault();

  const codigo = document.getElementById('crud-codigo').value.trim();
  const nombre = document.getElementById('crud-nombre').value.trim();
  
  // CORRECCIÓN DE LOGICA: Mapeamos los IDs idénticos a los del HTML dinámico de arriba
  const costo = parseFloat(document.getElementById('crud-costo').value); 
  const stockMin = parseInt(document.getElementById('crud-stockmin').value);
  
  const idCat = parseInt(document.getElementById('crud-categoria').value);
  const idProv = parseInt(document.getElementById('crud-proveedor').value);

  if (isNaN(costo) || costo <= 0) {
    alert("❌ Por favor, ingrese un precio de compra válido y mayor a 0.");
    return;
  }

  const exito = await guardarProducto(idProductoEdicion, codigo, nombre, costo, stockMin, idCat, idProv);

  if (exito) {
    alert("🎉 Operación en catálogo completada exitosamente.");
    cerrarModalProducto();
    poblarSelectProductos(); 
    renderizarTablaProductos(); 
    
    // Si tienes una función para actualizar las métricas de las tarjetas del Dashboard, la llamamos aquí
    if (typeof actualizarTarjetasMetricas === 'function') {
      actualizarTarjetasMetricas();
    }
  }
}

function cerrarModalProducto() {
  const modal = document.getElementById('producto-modal');
  if(modal) modal.remove();
  idProductoEdicion = null;
}

// 6. Procesar Guardar/Editar Producto (Versión Corregida para el Precio)
async function procesarFormularioProducto(event) {
  event.preventDefault();

  const codigo = document.getElementById('crud-codigo').value.trim();
  const nombre = document.getElementById('crud-nombre').value.trim();
  
  // CORRECCIÓN: Usamos 'crud-precio' que coincide con el ID del input en index.html
  const costo = parseFloat(document.getElementById('crud-precio').value); 
  const stockMin = parseInt(document.getElementById('crud-stock-min').value);
  const idCat = parseInt(document.getElementById('crud-categoria').value);
  const idProv = parseInt(document.getElementById('crud-proveedor').value);

  // Validación rápida de seguridad
  if (isNaN(costo) || costo <= 0) {
    alert("❌ Por favor, ingrese un precio de compra válido y mayor a 0.");
    return;
  }

  const exito = await guardarProducto(idProductoEdicion, codigo, nombre, costo, stockMin, idCat, idProv);

  if (exito) {
    alert("🎉 Operación en catálogo completada exitosamente.");
    cerrarModalProducto();
    poblarSelectProductos(); 
    renderizarTablaProductos(); 
  }
}

// 7. Auxiliares del formulario de movimientos
function poblarSelectProductos() {
  const select = document.getElementById('form-producto');
  if(!select) return;
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

async function registrarTransaccion(event) {
  event.preventDefault(); 

  const tipo = document.getElementById('form-tipo').value;
  const idProducto = parseInt(document.getElementById('form-producto').value);
  const cantidad = parseInt(document.getElementById('form-cantidad').value);
  const usuario = usuarioActivo.username; 

  const exito = await insertarMovimiento(tipo, idProducto, cantidad, usuario);

  if (exito) {
    alert(`🎉 ¡Movimiento de ${tipo} registrado con éxito!`);
    document.getElementById('form-movimiento').reset();
    switchView('dashboard');
  }
}