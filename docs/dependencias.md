# Auditoría de dependencias

Revisión del 18 de noviembre de 2026. `npm audit --omit=dev` informó **0 vulnerabilidades conocidas** para el árbol de producción del lockfile. `npm audit` informó **11 alertas altas** en el árbol completo, con un único aviso directo y diez paquetes afectados por dependencia transitiva.

| Ámbito                 | Paquetes señalados                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aviso directo          | `picomatch@4.0.7`                                                                                                                                                                         |
| Resolución de archivos | `fdir`, `tinyglobby`                                                                                                                                                                      |
| Compilación y pruebas  | `vite`, `vitest`                                                                                                                                                                          |
| Lint                   | `typescript-eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils` |

`picomatch` puede consumir CPU excesiva al evaluar determinados patrones de glob. En DevDesk se usa en la cadena de compilación, lint y pruebas. La API pública no recibe patrones glob y la web desplegada sirve archivos compilados. El riesgo residual está en ejecutar herramientas de desarrollo o CI con patrones o configuración procedentes de fuentes no confiables. [Aviso de GitHub](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)

El registro consultado devolvió `4.0.7` como última versión, dentro del intervalo afectado. Se conserva el lockfile sin forzar un downgrade de herramientas ni silenciar avisos. Cuando se publique una versión corregida compatible, actualiza el lockfile, verifica que todas las ramas usen una versión corregida y repite auditoría, lint, pruebas y build.
