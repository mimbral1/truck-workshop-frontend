import { ROUTES } from './routes'

export interface AppNavigationItem {
  label: string
  path: string
  icon: string
  section?: string
  showInSidebar?: boolean
  children?: AppNavigationItem[]
  /** Clave de contador dinamico (ver useSidebarBadges), ej 'notifications'. */
  badge?: string
  /** Texto de apoyo opcional para tooltips/documentacion del menu. */
  description?: string
  /** Permiso requerido para ver el item (reservado para control de acceso). */
  permission?: string
}

export interface AppNavigationGroup {
  label: string
  description?: string
  items: AppNavigationItem[]
  /**
   * Roles que pueden ver el grupo. Si se omite, lo ven todos. Reservado para el
   * menu por rol: un jefe de taller vera Taller, finanzas vera Finanzas, etc.
   * Hoy los grupos no se restringen (todos ven todo); la estructura queda lista
   * para activarlo sin tocar el Sidebar.
   */
  roles?: string[]
}

export interface QuickAccessLink {
  label: string
  path: string
  icon: string
}

// Accesos rapidos / favoritos: lo que la gente operativa abre siempre. Estatico
// por ahora (maximo 4); pensado para volverse configurable por usuario.
const quickAccess: QuickAccessLink[] = [
  { label: 'Mis asignaciones', path: ROUTES.assignments, icon: 'calendar-check' },
  { label: 'Casos abiertos', path: ROUTES.cases, icon: 'clipboard-list' },
  { label: 'Agenda', path: ROUTES.schedule, icon: 'calendar-days' },
  { label: 'Reportes', path: ROUTES.reports, icon: 'bar-chart-3' },
]

const warehouseView = (view: string) => `${ROUTES.warehouse}?view=${view}`
const customerView = (view: string) => `${ROUTES.customers}?view=${view}`

// Arquitectura de navegacion: cada grupo representa UN dominio operativo y
// contiene un unico item "padre" con hijos agrupados por `section`. El Sidebar
// aplana ese padre (ver SidebarSection) y renderiza una jerarquia simple de
// dos niveles: Dominio -> Seccion -> Enlace. Los items rutinarios de creacion o
// de baja frecuencia se marcan con `showInSidebar: false`: siguen accesibles por
// URL, buscador del menu y paleta de comandos, pero no saturan el menu.
const navigationGroups: AppNavigationGroup[] = [
  {
    label: 'Inicio',
    description: 'Vista ejecutiva y foco operacional global',
    items: [
      { label: 'Dashboard operativo', path: ROUTES.dashboard, icon: 'layout-dashboard' },
    ],
  },
  {
    label: 'Taller',
    description: 'Recepción, diagnóstico, reparación y cierre de casos',
    items: [
      {
        label: 'Taller',
        path: ROUTES.cases,
        icon: 'wrench',
        children: [
          { label: 'Casos', path: ROUTES.cases, icon: 'clipboard-list', section: 'Operación', badge: 'criticalCases' },
          { label: 'Diagnóstico', path: ROUTES.diagnosticsRoot, icon: 'activity', section: 'Operación' },
          { label: 'Asignaciones', path: ROUTES.assignments, icon: 'calendar-check', section: 'Operación' },
          { label: 'Aprobaciones', path: ROUTES.approvals, icon: 'clipboard-check', section: 'Operación' },
          { label: 'Camiones en taller', path: ROUTES.trucks, icon: 'wrench', section: 'Operación' },
          { label: 'Nuevo caso', path: ROUTES.caseNew, icon: 'circle-plus', section: 'Operación', showInSidebar: false },
          { label: 'Cotizaciones', path: ROUTES.quotes, icon: 'file-text', section: 'Cotización y costos' },
          { label: 'Mano de obra', path: ROUTES.labor, icon: 'clock-3', section: 'Cotización y costos' },
          { label: 'Agenda taller', path: ROUTES.schedule, icon: 'calendar-days', section: 'Planificación' },
          { label: 'Estaciones', path: ROUTES.bays, icon: 'panel-top', section: 'Planificación' },
          { label: 'Checklists diagnóstico', path: ROUTES.checklists, icon: 'list-checks', section: 'Planificación' },
          { label: 'Mecánicos', path: ROUTES.mechanics, icon: 'users', section: 'Equipo' },
          { label: 'Especialidades', path: ROUTES.mechanicSpecialties, icon: 'badge-check', section: 'Equipo' },
          { label: 'Reportes taller', path: ROUTES.reports, icon: 'bar-chart-3', section: 'Análisis' },
        ],
      },
    ],
  },
  {
    label: 'Flota',
    description: 'Estado, mantenimiento y documentación de camiones',
    items: [
      {
        label: 'Flota',
        path: ROUTES.fleet,
        icon: 'truck',
        children: [
          { label: 'Centro de flota', path: ROUTES.fleet, icon: 'layout-dashboard', section: 'Control' },
          { label: 'Disponibilidad', path: ROUTES.fleetAvailability, icon: 'kanban-square', section: 'Control' },
          { label: 'Health Score', path: ROUTES.fleetHealthScore, icon: 'activity', section: 'Control' },
          { label: 'Ficha de flota', path: ROUTES.fleetTrucks, icon: 'truck', section: 'Activos' },
          { label: 'Documentos', path: ROUTES.truckDocuments, icon: 'files', section: 'Activos' },
          { label: 'Nuevo camión', path: ROUTES.truckNew, icon: 'circle-plus', section: 'Activos', showInSidebar: false },
          { label: 'Mantenimiento preventivo', path: ROUTES.preventiveMaintenance, icon: 'calendar-clock', section: 'Mantenimiento' },
          { label: 'Nuevo plan preventivo', path: ROUTES.preventiveMaintenanceNew, icon: 'circle-plus', section: 'Mantenimiento', showInSidebar: false },
          { label: 'Rendimiento neumáticos', path: ROUTES.tirePerformance, icon: 'gauge', section: 'Neumáticos' },
          { label: 'Ingreso neumáticos', path: ROUTES.tirePerformanceIntake, icon: 'package-plus', section: 'Neumáticos', showInSidebar: false },
          { label: 'Instalación neumáticos', path: ROUTES.tirePerformanceInstall, icon: 'wrench', section: 'Neumáticos', showInSidebar: false },
          { label: 'Retiro neumáticos', path: ROUTES.tirePerformanceRemove, icon: 'repeat-2', section: 'Neumáticos', showInSidebar: false },
          { label: 'Comparación neumáticos', path: ROUTES.tirePerformanceComparison, icon: 'bar-chart-3', section: 'Neumáticos', showInSidebar: false },
          { label: 'Telemetría / GPS', path: ROUTES.telematics, icon: 'satellite', section: 'Telemetria' },
          { label: 'Choferes', path: ROUTES.drivers, icon: 'users', section: 'Conductores' },
          { label: 'Nuevo chofer', path: ROUTES.driverNew, icon: 'circle-plus', section: 'Conductores', showInSidebar: false },
        ],
      },
    ],
  },
  {
    label: 'Fletes y viajes',
    description: 'Solicitudes, cotización, asignación y rentabilidad de fletes',
    items: [
      {
        label: 'Fletes',
        path: ROUTES.freightRequests,
        icon: 'route',
        children: [
          { label: 'Solicitudes', path: ROUTES.freightRequests, icon: 'clipboard-list', section: 'Solicitudes' },
          { label: 'Nueva solicitud', path: ROUTES.freightRequestNew, icon: 'circle-plus', section: 'Solicitudes', showInSidebar: false },
          { label: 'Portal cliente', path: ROUTES.freightClientPortal, icon: 'send', section: 'Solicitudes' },
          { label: 'Cotizaciones flete', path: ROUTES.freightQuotes, icon: 'file-text', section: 'Cotización' },
          { label: 'Asignación flete', path: ROUTES.freightAssignments, icon: 'calendar-check', section: 'Ejecución' },
          { label: 'Planillas choferes', path: ROUTES.driverTripSheets, icon: 'receipt-text', section: 'Ejecución' },
          { label: 'Facturación de fletes', path: ROUTES.freightInvoices, icon: 'receipt-text', section: 'Facturación' },
          { label: 'Nueva factura flete', path: ROUTES.freightInvoiceNew, icon: 'circle-plus', section: 'Facturación', showInSidebar: false },
          { label: 'Checklists viaje', path: ROUTES.tripChecklists, icon: 'list-checks', section: 'Viajes' },
          { label: 'Checklist salida', path: ROUTES.tripChecklistDeparture, icon: 'send', section: 'Viajes', showInSidebar: false },
          { label: 'Checklist llegada', path: ROUTES.tripChecklistArrival, icon: 'flag', section: 'Viajes', showInSidebar: false },
          { label: 'Rentabilidad fletes', path: ROUTES.freightProfitability, icon: 'trending-up', section: 'Análisis' },
        ],
      },
    ],
  },
  {
    label: 'Clientes',
    description: 'Cartera comercial, crédito, tarifas y relación',
    items: [
      {
        label: 'Clientes',
        path: ROUTES.customers,
        icon: 'building-2',
        children: [
          { label: 'Panel clientes', path: ROUTES.customers, icon: 'layout-dashboard', section: 'Gestion' },
          { label: 'Cartera', path: customerView('portfolio'), icon: 'building-2', section: 'Gestion' },
          { label: 'Nuevo cliente', path: customerView('create'), icon: 'circle-plus', section: 'Gestion', showInSidebar: false },
          { label: 'Credito y riesgo', path: customerView('credit'), icon: 'shield-check', section: 'Comercial' },
          { label: 'Tarifas', path: customerView('pricing'), icon: 'tags', section: 'Comercial' },
          { label: 'Operaciones', path: customerView('operations'), icon: 'route', section: 'Operación' },
          { label: 'Comunicaciones', path: customerView('communications'), icon: 'message-circle', section: 'Relacion' },
          { label: 'Rentabilidad', path: customerView('profitability'), icon: 'trending-up', section: 'Análisis' },
        ],
      },
    ],
  },
  {
    label: 'Abastecimiento',
    description: 'Bodega, compras, inventario y proveedores',
    items: [
      {
        label: 'Abastecimiento',
        path: ROUTES.warehouse,
        icon: 'warehouse',
        children: [
          { label: 'Panel de control', path: ROUTES.warehouse, icon: 'warehouse', section: 'Decision' },
          { label: 'Reposición sugerida', path: warehouseView('suggestions'), icon: 'package-search', section: 'Decision' },
          { label: 'Solicitudes de compra', path: warehouseView('requests'), icon: 'clipboard-list', section: 'Decision' },
          { label: 'Órdenes de compra', path: ROUTES.purchaseOrders, icon: 'shopping-cart', section: 'Compras' },
          { label: 'Recepción', path: warehouseView('receipts'), icon: 'package-plus', section: 'Compras' },
          { label: 'Facturas de compra', path: ROUTES.purchaseInvoices, icon: 'receipt-text', section: 'Compras' },
          { label: 'Proveedores', path: ROUTES.suppliers, icon: 'building-2', section: 'Compras' },
          { label: 'Nueva OC', path: ROUTES.purchaseOrderNew, icon: 'circle-plus', section: 'Compras', showInSidebar: false },
          { label: 'Nueva factura compra', path: ROUTES.purchaseInvoiceNew, icon: 'circle-plus', section: 'Compras', showInSidebar: false },
          { label: 'Nuevo proveedor', path: ROUTES.supplierNew, icon: 'circle-plus', section: 'Compras', showInSidebar: false },
          { label: 'Repuestos / SKUs', path: ROUTES.parts, icon: 'package-search', section: 'Inventario' },
          { label: 'Stock físico', path: ROUTES.warehouseStock, icon: 'package-search', section: 'Inventario' },
          { label: 'Ubicaciones', path: ROUTES.warehouseLocations, icon: 'warehouse', section: 'Inventario' },
          { label: 'Reportes', path: ROUTES.inventoryReport, icon: 'bar-chart-3', section: 'Análisis' },
          { label: 'Control documentos', path: warehouseView('documents'), icon: 'receipt-text', section: 'Análisis', showInSidebar: false },
          { label: 'Compradores / responsables', path: ROUTES.warehouseManagers, icon: 'users', section: 'Análisis', showInSidebar: false },
          { label: 'Auditoría de compras', path: warehouseView('audit'), icon: 'shield-check', section: 'Análisis', showInSidebar: false },
          { label: 'Calendario abastecimiento', path: warehouseView('calendar'), icon: 'calendar-days', section: 'Análisis', showInSidebar: false },
        ],
      },
    ],
  },
  {
    label: 'Finanzas',
    description: 'Costos por camión, combustible y desempeño',
    items: [
      {
        label: 'Finanzas',
        path: ROUTES.truckCosts,
        icon: 'circle-dollar-sign',
        children: [
          { label: 'Costos por camión', path: ROUTES.truckCosts, icon: 'circle-dollar-sign', section: 'Costos' },
          { label: 'Combustible', path: ROUTES.fuel, icon: 'fuel', section: 'Combustible' },
          { label: 'Reporte combustible', path: ROUTES.fuelReport, icon: 'bar-chart-3', section: 'Combustible' },
          { label: 'Nuevo combustible', path: ROUTES.fuelNew, icon: 'circle-plus', section: 'Combustible', showInSidebar: false },
          { label: 'Rendimiento choferes', path: ROUTES.driverPerformanceReport, icon: 'gauge', section: 'Desempeño' },
        ],
      },
    ],
  },
  {
    label: 'Administración',
    description: 'Incidentes, mensajería, permisos y preferencias',
    items: [
      {
        label: 'Administración',
        path: ROUTES.incidents,
        icon: 'shield-check',
        children: [
          { label: 'Incidentes', path: ROUTES.incidents, icon: 'triangle-alert', section: 'Operación', badge: 'incidents' },
          { label: 'Nuevo incidente', path: ROUTES.incidentsNew, icon: 'circle-plus', section: 'Operación', showInSidebar: false },
          { label: 'Notificaciones', path: ROUTES.notifications, icon: 'bell', section: 'Mensajeria', badge: 'notifications' },
          { label: 'Comunicaciones', path: ROUTES.communications, icon: 'message-circle', section: 'Mensajeria' },
          { label: 'Permisos', path: ROUTES.permissions, icon: 'shield-check', section: 'Configuración' },
          { label: 'Atajos y teclado', path: ROUTES.shortcutSettings, icon: 'keyboard', section: 'Configuración' },
        ],
      },
    ],
  },
]

export const appConfig = {
  name: 'Truck Workshop',
  company: 'Operaciones Taller',
  navigationGroups,
  quickAccess,
  navigation: navigationGroups.flatMap((group) => group.items),
}
