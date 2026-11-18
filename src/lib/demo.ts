// Datos fijos del perfil de ejemplo (todo ficticio). Los usa `npm run seed:demo`
// y el botón "Ver demo". IDs fijos para que el seed deje siempre lo mismo.

export const DEMO = {
  clave: "Demo1234",
  estudio: { id: "00000000-0000-4000-8000-000000000001", nombre: "Estudio Contable Demo", rut: "76999888-8" },
  ana: {
    id: "00000000-0000-4000-8000-0000000000a1",
    rut: "15111222-6",
    nombre: "Ana Demo",
    correo: "ana.demo@demo.rhsoftware.cl",
  },
  luis: {
    id: "00000000-0000-4000-8000-0000000000a2",
    rut: "16222333-K",
    nombre: "Luis Demo",
    correo: "luis.demo@demo.rhsoftware.cl",
  },
  visitante: {
    id: "00000000-0000-4000-8000-0000000000a3",
    rut: "10000000-8",
    nombre: "Visitante Demo",
    correo: "visitante.demo@demo.rhsoftware.cl",
  },
  // Cliente del Almacén: entra al portal del cliente.
  cliente: {
    id: "00000000-0000-4000-8000-0000000000a4",
    rut: "13444555-6",
    nombre: "José Pérez Demo",
    correo: "jose.perez@demo.rhsoftware.cl",
  },
  empresas: {
    almacen: "00000000-0000-4000-8000-0000000000e1",
    transportes: "00000000-0000-4000-8000-0000000000e2",
    consultora: "00000000-0000-4000-8000-0000000000e3",
  },
} as const;
