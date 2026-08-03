# Limpieza controlada de abonos

Este procedimiento nunca modifica la base indicada como entrada.

## Ejecución

```powershell
pnpm data:clean-abonos -- "C:\ruta\cartera.db"
```

Se crea una carpeta junto a la base con:

- `cartera-original-sin-cambios.db`
- `cartera-limpia.db`
- `resultado-limpieza.json`
- `LEEME.txt`

La limpieza conserva el primer registro de cada evento lógico:

- documento normalizado;
- total anterior;
- total nuevo;
- observación.

La fecha no se usa como identidad porque las repeticiones detectadas fueron generadas en importaciones distintas.

No reemplazar la base productiva hasta terminar la validación funcional.
